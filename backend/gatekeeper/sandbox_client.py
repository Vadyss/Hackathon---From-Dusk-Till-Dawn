"""Typed HTTP transport; skill failures are data, transport failures exceptions."""
from __future__ import annotations

import json
import math
from typing import Any
from uuid import uuid4

import httpx

from .types import SandboxError

MAX_RESPONSE_BYTES = 10_000_000


def validate_response(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or value.get("status") not in ("ok", "error", "timeout", "rejected"):
        raise SandboxError("Sandbox vrátil neplatný stav úlohy.")
    if set(value) != {"status", "result", "tests", "error", "duration_ms"}:
        raise SandboxError("Sandbox vrátil neplatnou obálku úlohy.")
    duration = value["duration_ms"]
    if isinstance(duration, bool) or not isinstance(duration, int) or duration < 0:
        raise SandboxError("Sandbox vrátil neplatnou dobu úlohy.")
    error = value["error"]
    if error is not None and (not isinstance(error, str) or len(error) > 2000):
        raise SandboxError("Sandbox vrátil neplatný popis chyby.")
    if value["result"] is not None and not isinstance(value["result"], list):
        raise SandboxError("Sandbox vrátil neplatný výstup dovednosti.")
    tests = value["tests"]
    if not isinstance(tests, dict) or set(tests) != {"total", "failed", "failures"}:
        raise SandboxError("Sandbox vrátil neplatný výsledek testů.")
    if any(isinstance(tests[k], bool) or not isinstance(tests[k], int) or tests[k] < 0 for k in ("total", "failed")):
        raise SandboxError("Sandbox vrátil neplatné počty testů.")
    if tests["failed"] > tests["total"] or not isinstance(tests["failures"], list):
        raise SandboxError("Sandbox vrátil neplatné počty selhání.")
    for failure in tests["failures"]:
        if not isinstance(failure, dict) or set(failure) != {"name", "error"} or any(not isinstance(v, str) for v in failure.values()):
            raise SandboxError("Sandbox vrátil neplatné selhání testu.")
        if len(failure["name"]) > 200 or len(failure["error"]) > 500:
            raise SandboxError("Sandbox vrátil příliš dlouhé selhání testu.")
    try:
        json.dumps(value, allow_nan=False)
    except (ValueError, TypeError, RecursionError) as exc:
        raise SandboxError("Sandbox vrátil neserializovatelný výsledek.") from exc
    return value


class SandboxClient:
    def __init__(self, base_url: str = "http://sandbox:8000", timeout_s: float = 30,
                 *, transport: httpx.AsyncBaseTransport | None = None) -> None:
        if not math.isfinite(timeout_s) or timeout_s <= 0:
            raise ValueError("Časový limit klienta musí být kladný.")
        self.timeout_s = timeout_s
        self.client = httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=timeout_s,
                                        transport=transport, trust_env=False)

    async def health(self) -> bool:
        try:
            answer = await self.client.get("/health", timeout=min(5, self.timeout_s))
            return answer.status_code == 200 and answer.json() == {"status": "ok"}
        except (httpx.HTTPError, ValueError):
            return False

    async def execute(self, job: dict[str, Any]) -> dict[str, Any]:
        try:
            async with self.client.stream("POST", "/execute", json=job) as answer:
                if answer.status_code != 200:
                    raise SandboxError("Sandbox je nedostupný nebo odmítl protokol HTTP.")
                body = bytearray()
                async for chunk in answer.aiter_bytes():
                    if len(body) + len(chunk) > MAX_RESPONSE_BYTES:
                        raise SandboxError("Odpověď sandboxu překračuje limit velikosti.")
                    body.extend(chunk)
            value = json.loads(body)
        except SandboxError:
            raise
        except (httpx.HTTPError, ValueError, TypeError, RecursionError) as exc:
            # Do not expose exception URLs, headers or attacker-controlled body.
            raise SandboxError("Sandbox je nedostupný nebo vrátil neplatnou odpověď.") from exc
        return validate_response(value)

    async def run(self, code: str, inputs: list, params: dict, *,
                  allowed_imports: list[str], timeout_s: float = 15) -> dict[str, Any]:
        return await self.execute({"job_id": uuid4().hex, "mode": "run", "files": {"skill.py": code},
                                   "entrypoint": "run", "inputs": inputs, "params": params,
                                   "allowed_imports": allowed_imports, "timeout_s": timeout_s})

    async def test(self, code: str, tests: str, *,
                   allowed_imports: list[str], timeout_s: float = 10) -> dict[str, Any]:
        return await self.execute({"job_id": uuid4().hex, "mode": "test",
                                   "files": {"skill.py": code, "test_skill.py": tests},
                                   "entrypoint": "run", "inputs": [], "params": {},
                                   "allowed_imports": allowed_imports, "timeout_s": timeout_s})

    async def close(self) -> None:
        await self.client.aclose()
