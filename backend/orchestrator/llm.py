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

BASE_URL = "https://openrouter.apify.actor/api/v1"
MODEL = "openrouter/auto"
logger = logging.getLogger(__name__)
LlmBudget: ContextVar[Any | None] = ContextVar("llm_run_counters", default=None)


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
                   temperature: float = 0.2, context: dict | None = None) -> LlmResult: ...
    async def close(self) -> None: ...


def bind_run_counters(counters: Any) -> Token:
    return LlmBudget.set(counters)


def reset_run_counters(token: Token) -> None:
    LlmBudget.reset(token)


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


def _result(data: dict, model: str) -> LlmResult:
    try:
        content = data["choices"][0]["message"]["content"]
        if not isinstance(content, str):
            raise ValueError
        tokens = (data.get("usage") or {}).get("total_tokens")
        if type(tokens) is not int or tokens < 0:
            tokens = None
        return LlmResult(content, tokens, model)
    except (KeyError, IndexError, TypeError, AttributeError, ValueError):
        raise LlmError("Poskytovatel vrátil neplatnou odpověď.") from None


class HttpLlmClient:
    def __init__(self, settings, *, transport: httpx.AsyncBaseTransport | None = None, sleep=asyncio.sleep):
        self.settings = settings
        self._sleep = sleep
        self._http = httpx.AsyncClient(timeout=settings.llm_timeout_s, transport=transport,
                                       follow_redirects=False, trust_env=False)

    def _model(self, role: str) -> str:
        suffix = {"rule_author": "rule", "summarizer": "summary", "summary": "summary"}.get(role, role)
        return getattr(self.settings, f"llm_model_{suffix}", self.settings.llm_model) or self.settings.llm_model

    async def chat(self, role: str, system: str, user: str, *, max_tokens: int | None = None,
                   temperature: float = 0.2, context: dict | None = None) -> LlmResult:
        model = self._model(role)
        key = (self.settings.apify_token or self.settings.llm_api_key) if self.settings.llm_provider == "apify" else self.settings.llm_api_key
        if not key:
            raise LlmError("Chybí přístupový klíč jazykového modelu.")
        payload = {"model": model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                   "max_tokens": max_tokens or self.settings.llm_max_tokens, "temperature": temperature}
        started = time.monotonic()
        for attempt in range(self.settings.llm_max_retries + 1):
            count_call(self.settings.llm_max_calls_per_run)
            retry = False
            try:
                response = await self._http.post(self.settings.llm_base_url.rstrip("/") + "/chat/completions",
                                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, json=payload)
                retry = response.status_code == 429 or response.status_code >= 500
                if not retry:
                    if not 200 <= response.status_code < 300:
                        raise LlmError(f"Volání jazykového modelu selhalo (HTTP {response.status_code}).")
                    if len(response.content) > 2_000_000:
                        raise LlmError("Odpověď jazykového modelu je příliš velká.")
                    try:
                        result = _result(response.json(), model)
                    except ValueError:
                        raise LlmError("Poskytovatel vrátil neplatnou odpověď.") from None
                    count_tokens(result.total_tokens)
                    logger.info("LLM role=%s model=%s prompt_chars=%d response_chars=%d duration_ms=%d tokens=%s",
                                role, model, len(system) + len(user), len(result.text), int((time.monotonic() - started) * 1000), result.total_tokens)
                    safe_prompt = user
                    for secret in (self.settings.apify_token, self.settings.llm_api_key):
                        if secret:
                            safe_prompt = safe_prompt.replace(secret, "[REDACTED]")
                    logger.debug("LLM prompt=%s", safe_prompt[:500])
                    return result
            except (httpx.TimeoutException, httpx.NetworkError):
                retry = True
            except httpx.HTTPError:
                raise LlmError("Volání jazykového modelu selhalo.") from None
            if not retry or attempt == self.settings.llm_max_retries:
                raise LlmError("Volání jazykového modelu selhalo po opakování.") from None
            await self._sleep((1, 3)[min(attempt, 1)])
        raise LlmError("Volání jazykového modelu selhalo.")

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
    parsed = extract_json(result.text)
    if isinstance(parsed, ParseFailure):
        repair = dict(context, repair=True)
        repaired = await client.chat(role, system,
                                     user + "\n" + untrusted("invalid_output", result.text[:20000])
                                     + "\nReturn only valid JSON matching the required schema, with no additional text.", context=repair)
        return extract_json(repaired.text)
    return parsed


def ask(prompt: str, system: str | None = None, model: str = MODEL) -> str:
    """Original synchronous requests API retained for IDE scripts."""
    from orchestrator.config import Settings
    settings = Settings.from_env(load_env_file=True)
    if settings.llm_provider == "mock":
        raise LlmError("Synchronní ask vyžaduje skutečného poskytovatele; mock používá async chat.")
    key = (settings.apify_token or settings.llm_api_key) if settings.llm_provider == "apify" else settings.llm_api_key
    if not key:
        raise LlmError("Chybí přístupový klíč jazykového modelu.")
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    for attempt in range(settings.llm_max_retries + 1):
        count_call(settings.llm_max_calls_per_run)
        try:
            response = requests.post(settings.llm_base_url.rstrip("/") + "/chat/completions",
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                                     json={"model": model, "messages": messages, "max_tokens": settings.llm_max_tokens, "temperature": 0.2},
                                     timeout=settings.llm_timeout_s, allow_redirects=False)
            retry = response.status_code == 429 or response.status_code >= 500
            if not retry:
                if not 200 <= response.status_code < 300:
                    raise LlmError(f"Volání jazykového modelu selhalo (HTTP {response.status_code}).")
                result = _result(response.json(), model)
                count_tokens(result.total_tokens)
                return result.text
        except (requests.Timeout, requests.ConnectionError):
            retry = True
        except (requests.RequestException, ValueError):
            raise LlmError("Volání jazykového modelu selhalo.") from None
        if attempt == settings.llm_max_retries:
            raise LlmError("Volání jazykového modelu selhalo po opakování.") from None
        time.sleep((1, 3)[min(attempt, 1)])
    raise LlmError("Volání jazykového modelu selhalo.")
