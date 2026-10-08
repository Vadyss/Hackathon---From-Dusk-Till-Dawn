"""LLM transport, bounded retries, per-run accounting and JSON extraction."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from contextvars import ContextVar, Token
from dataclasses import dataclass
from functools import lru_cache
from html import escape
from pathlib import Path
from typing import Any, Protocol

import httpx
import requests

from gatekeeper.types import ParseFailure

BASE_URL = "https://piquant-peacoat--llm-relay.apify.actor/v1"
MODEL = "anthropic/claude-sonnet-5.5"
logger = logging.getLogger(__name__)
LlmBudget: ContextVar[Any | None] = ContextVar("llm_run_counters", default=None)


@dataclass
class ProviderState:
    failures: int = 0
    fallback: bool = False
    run_id: str = "unbound"


LlmProviderState: ContextVar[ProviderState | None] = ContextVar("llm_provider_state", default=None)


@dataclass(frozen=True)
class RunBinding:
    counters: Token
    provider: Token


class LlmError(Exception):
    """Safe provider error: never includes HTTP bodies, keys or prompts."""


class LlmBudgetExceeded(LlmError):
    pass


@dataclass(frozen=True)
class LlmResult:
    text: str
    total_tokens: int | None
    model: str


class LlmClient(Protocol):
    async def chat(self, role: str, system: str, user: str, *, max_tokens: int | None = None,
                   temperature: float = 0.2, context: dict | None = None) -> LlmResult | ParseFailure: ...
    async def close(self) -> None: ...


def bind_run_counters(counters: Any, run_id: str = "unbound") -> RunBinding:
    return RunBinding(LlmBudget.set(counters), LlmProviderState.set(ProviderState(run_id=run_id)))


def reset_run_counters(token: RunBinding) -> None:
    LlmBudget.reset(token.counters)
    LlmProviderState.reset(token.provider)


def count_call(max_calls: int) -> None:
    counters = LlmBudget.get()
    if counters is not None:
        if counters.llm_calls >= max_calls:
            raise LlmBudgetExceeded("Překročen rozpočet volání jazykového modelu.")
        counters.llm_calls += 1


def count_tokens(tokens: int | None) -> None:
    counters = LlmBudget.get()
    if counters is not None and tokens is not None:
        counters.tokens_total = (counters.tokens_total or 0) + tokens


def _strict_json(text: str):
    def reject_constant(value):
        raise ValueError("JSON does not support nonfinite numbers")
    return json.loads(text, parse_constant=reject_constant)


def extract_json(text: str) -> dict | ParseFailure:
    if not isinstance(text, str):
        return ParseFailure("Odpověď není řetězec.")
    text = text.strip()
    if text.startswith("```") and text.endswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:-3].strip()
    try:
        value = _strict_json(text)
    except (ValueError, TypeError, RecursionError):
        start = text.find("{")
        if start == -1:
            return ParseFailure("Odpověď neobsahuje JSON objekt.")
        depth = 0
        quoted = False
        escaped = False
        for index in range(start, len(text)):
            char = text[index]
            if quoted:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    quoted = False
            elif char == '"':
                quoted = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    try:
                        value = _strict_json(text[start:index + 1])
                    except (ValueError, RecursionError):
                        return ParseFailure("Odpověď obsahuje neplatný JSON.")
                    return value if isinstance(value, dict) else ParseFailure("Výstup musí být JSON objekt.")
        return ParseFailure("JSON objekt není uzavřený.")
    return value if isinstance(value, dict) else ParseFailure("Výstup musí být JSON objekt.")


def _usage_tokens(data: Any) -> int | None:
    usage = data.get("usage") if isinstance(data, dict) else None
    tokens = usage.get("total_tokens") if isinstance(usage, dict) else None
    return tokens if type(tokens) is int and tokens >= 0 else None


def _result(data: dict, model: str) -> LlmResult | ParseFailure:
    try:
        content = data["choices"][0]["message"]["content"]
        if not isinstance(content, str) or not content.strip():
            return ParseFailure("Jazykový model nevrátil neprázdný text odpovědi.")
        return LlmResult(content, _usage_tokens(data), model)
    except (KeyError, IndexError, TypeError, AttributeError, ValueError):
        raise LlmError("Poskytovatel vrátil neplatnou odpověď.") from None


def _provider_failed(settings, state: ProviderState, model: str) -> None:
    if _primary_model(settings, model) and not state.fallback:
        state.failures += 1
        if state.failures >= 2 and settings.llm_model_fallback:
            state.fallback = True
            logger.warning("LLM fallback run_id=%s primary=%s fallback=%s provider_failures=%d",
                           state.run_id, settings.llm_model, settings.llm_model_fallback, state.failures)


def _provider_succeeded(settings, state: ProviderState, model: str) -> None:
    if _primary_model(settings, model) and not state.fallback:
        state.failures = 0


def _primary_model(settings, model: str) -> bool:
    return model in {settings.llm_model, settings.llm_model_planner, settings.llm_model_forge,
                     settings.llm_model_rule, settings.llm_model_summary}


def _response_data(response, settings, state: ProviderState, model: str) -> tuple[Any, LlmResult | ParseFailure]:
    if len(getattr(response, "content", b"")) > 2_000_000:
        raise LlmError("Odpověď jazykového modelu je příliš velká.")
    try:
        data = response.json()
    except ValueError:
        raise LlmError("Poskytovatel vrátil neplatnou odpověď.") from None
    count_tokens(_usage_tokens(data))
    result = _result(data, model)
    _provider_succeeded(settings, state, model)
    return data, result


def _truncated(data: Any) -> bool:
    try:
        return data["choices"][0].get("finish_reason") == "length"
    except (KeyError, IndexError, TypeError, AttributeError):
        return False


class HttpLlmClient:
    def __init__(self, settings, *, transport: httpx.AsyncBaseTransport | None = None, sleep=asyncio.sleep):
        self.settings = settings
        self._sleep = sleep
        self._http = httpx.AsyncClient(timeout=settings.llm_timeout_s, transport=transport,
                                       follow_redirects=False, trust_env=False)
        self._standalone_state = ProviderState()

    def _model(self, role: str) -> str:
        state = LlmProviderState.get() or self._standalone_state
        if state.fallback:
            return self.settings.llm_model_fallback
        suffix = {"rule_author": "rule", "summarizer": "summary", "summary": "summary"}.get(role, role)
        return getattr(self.settings, f"llm_model_{suffix}", self.settings.llm_model) or self.settings.llm_model

    async def chat(self, role: str, system: str, user: str, *, max_tokens: int | None = None,
                   temperature: float = 0.2, context: dict | None = None) -> LlmResult | ParseFailure:
        state = LlmProviderState.get() or self._standalone_state
        key = (self.settings.apify_token or self.settings.llm_api_key) if self.settings.llm_provider == "apify" else self.settings.llm_api_key
        if not key:
            raise LlmError("Chybí přístupový klíč jazykového modelu.")
        token_limit = min(max_tokens or self.settings.llm_max_tokens, self.settings.llm_max_tokens_cap)
        payload = {"messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                   "max_tokens": token_limit, "temperature": temperature}
        started = time.monotonic()
        attempt = 0
        length_retried = False
        while True:
            model = self._model(role)
            payload["model"] = model
            count_call(self.settings.llm_max_calls_per_run)
            try:
                response = await self._http.post(self.settings.llm_base_url.rstrip("/") + "/chat/completions",
                                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json=payload)
                retry = response.status_code == 429 or response.status_code >= 500
                if retry:
                    _provider_failed(self.settings, state, model)
                else:
                    if not 200 <= response.status_code < 300:
                        raise LlmError(f"Volání jazykového modelu selhalo (HTTP {response.status_code}).")
                    try:
                        data, result = _response_data(response, self.settings, state, model)
                    except LlmError:
                        _provider_failed(self.settings, state, model)
                        raise
                    logger.info("LLM run_id=%s role=%s model=%s duration_ms=%d tokens=%s max_tokens=%d output=%s",
                                state.run_id, role, model, int((time.monotonic() - started) * 1000),
                                _usage_tokens(data), payload["max_tokens"], "empty" if isinstance(result, ParseFailure) else "text")
                    if isinstance(result, ParseFailure) and _truncated(data) and not length_retried:
                        enlarged = min(payload["max_tokens"] * 2, self.settings.llm_max_tokens_cap)
                        payload["max_tokens"] = enlarged
                        length_retried = True
                        continue
                    return result
            except (httpx.TimeoutException, httpx.NetworkError):
                _provider_failed(self.settings, state, model)
                retry = True
            except httpx.HTTPError:
                _provider_failed(self.settings, state, model)
                raise LlmError("Volání jazykového modelu selhalo.") from None
            if attempt == self.settings.llm_max_retries:
                raise LlmError("Volání jazykového modelu selhalo po opakování.") from None
            await self._sleep((1, 3)[min(attempt, 1)])
            attempt += 1

    async def close(self) -> None:
        await self._http.aclose()


def make_client(settings) -> LlmClient:
    if settings.llm_provider == "mock":
        from .llm_mock import MockLlm
        return MockLlm(settings)
    return HttpLlmClient(settings)


def json_value(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {key: json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_value(item) for item in value]
    return value


def untrusted(name: str, value: Any) -> str:
    content = json.dumps(json_value(value), ensure_ascii=False, separators=(",", ":"))
    return f'<untrusted_data name="{name}">{escape(content, quote=False)}</untrusted_data>'


@lru_cache(maxsize=8)
def prompt_for(role: str) -> str:
    return (Path(__file__).resolve().parent / "prompts" / f"{role}.md").read_text(encoding="utf-8")


async def json_chat(client: LlmClient, role: str, system: str, user: str, context: dict) -> dict | ParseFailure:
    result = await client.chat(role, system, user, context=context)
    if isinstance(result, ParseFailure):
        return result
    parsed = extract_json(result.text)
    if isinstance(parsed, ParseFailure):
        repair = dict(context, repair=True)
        repaired = await client.chat(role, system,
                                     user + "\n" + untrusted("invalid_output", result.text[:20000])
                                     + "\nReturn only valid JSON matching the required schema, with no additional text.", context=repair)
        return repaired if isinstance(repaired, ParseFailure) else extract_json(repaired.text)
    return parsed


def ask(prompt: str, system: str | None = None, model: str | None = None) -> str | ParseFailure:
    """Original synchronous requests API retained for IDE scripts."""
    from orchestrator.config import Settings
    settings = Settings.from_env(load_env_file=True)
    if settings.llm_provider == "mock":
        raise LlmError("Synchronní ask vyžaduje skutečného poskytovatele; mock používá async chat.")
    key = (settings.apify_token or settings.llm_api_key) if settings.llm_provider == "apify" else settings.llm_api_key
    if not key:
        raise LlmError("Chybí přístupový klíč jazykového modelu.")
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    state = LlmProviderState.get() or ProviderState()
    primary = model or settings.llm_model
    token_limit = settings.llm_max_tokens
    length_retried = False
    attempt = 0
    while True:
        model = settings.llm_model_fallback if state.fallback else primary
        count_call(settings.llm_max_calls_per_run)
        try:
            response = requests.post(settings.llm_base_url.rstrip("/") + "/chat/completions",
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                                     json={"model": model, "messages": messages, "max_tokens": token_limit, "temperature": 0.2},
                                     timeout=settings.llm_timeout_s, allow_redirects=False)
            retry = response.status_code == 429 or response.status_code >= 500
            if retry:
                _provider_failed(settings, state, model)
            else:
                if not 200 <= response.status_code < 300:
                    raise LlmError(f"Volání jazykového modelu selhalo (HTTP {response.status_code}).")
                try:
                    data, result = _response_data(response, settings, state, model)
                except LlmError:
                    _provider_failed(settings, state, model)
                    raise
                if isinstance(result, ParseFailure) and _truncated(data) and not length_retried:
                    enlarged = min(token_limit * 2, settings.llm_max_tokens_cap)
                    token_limit = enlarged
                    length_retried = True
                    continue
                return result if isinstance(result, ParseFailure) else result.text
        except (requests.Timeout, requests.ConnectionError):
            _provider_failed(settings, state, model)
            retry = True
        except (requests.RequestException, ValueError):
            raise LlmError("Volání jazykového modelu selhalo.") from None
        if attempt == settings.llm_max_retries:
            raise LlmError("Volání jazykového modelu selhalo po opakování.") from None
        time.sleep((1, 3)[min(attempt, 1)])
        attempt += 1
