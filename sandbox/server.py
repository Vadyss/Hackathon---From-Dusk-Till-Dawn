# Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
"""HTTP boundary and per-job process isolation for untrusted Python skills."""
from __future__ import annotations

import asyncio
import json
import math
import os
from pathlib import Path
import resource
import signal
import subprocess
import sys
import tempfile
import threading
import time
from typing import Any

from fastapi import FastAPI, Request

MAX_BODY_BYTES = 8_000_000
MAX_INPUT_BYTES = 5_000_000
MAX_OUTPUT_BYTES = 10_000_000
MEMORY_BYTES = 256 * 1024 * 1024
ALLOWED_MODULES = frozenset({
    "re", "datetime", "collections", "itertools", "functools", "math",
    "statistics", "ipaddress", "json", "typing", "dataclasses", "bisect",
    "heapq", "string", "operator", "enum", "decimal", "fractions",
    "hashlib", "base64", "binascii",
})
RUNNER_PATH = Path(__file__).with_name("runner.py").resolve()
# A process-wide semaphore also works with separate TestClient event loops.
_JOBS = threading.BoundedSemaphore(2)
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


def response(status: str, *, error: str | None = None, result: Any = None,
             tests: dict[str, Any] | None = None, duration_ms: int = 0) -> dict[str, Any]:
    return {"status": status, "result": result,
            "tests": tests or {"total": 0, "failed": 0, "failures": []},
            "error": error[:2000] if error else None, "duration_ms": duration_ms}


def validate_job(job: Any) -> str | None:
    if not isinstance(job, dict):
        return "Úloha musí být JSON objekt."
    if not isinstance(job.get("job_id"), str) or not 1 <= len(job["job_id"]) <= 128:
        return "Neplatný identifikátor úlohy."
    if job.get("mode") not in ("run", "test") or job.get("entrypoint", "run") != "run":
        return "Neplatný režim nebo vstupní bod úlohy."
    files = job.get("files")
    if not isinstance(files, dict) or not files or set(files) - {"skill.py", "test_skill.py"}:
        return "Neplatné názvy souborů úlohy."
    if "skill.py" not in files or (job["mode"] == "test" and "test_skill.py" not in files):
        return "Chybí soubor dovednosti nebo testů."
    if any(not isinstance(source, str) for source in files.values()):
        return "Obsah souborů musí být text."
    if not isinstance(job.get("inputs", []), list) or not isinstance(job.get("params", {}), dict):
        return "Neplatný vstup nebo parametry."
    imports = job.get("allowed_imports", [])
    if not isinstance(imports, list) or any(not isinstance(name, str) or name not in ALLOWED_MODULES
                                            for name in imports):
        return "Import není v bezpečném seznamu modulů."
    timeout = job.get("timeout_s", 10)
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not 0 < timeout <= 30 or not math.isfinite(timeout):
        return "Časový limit musí být větší než 0 a nejvýš 30 sekund."
    try:
        body = json.dumps(job, ensure_ascii=False, allow_nan=False).encode("utf-8")
        inputs = json.dumps(job.get("inputs", []), ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (TypeError, ValueError, RecursionError):
        return "Úlohu nelze serializovat do JSON."
    if len(body) > MAX_BODY_BYTES or len(inputs) > MAX_INPUT_BYTES:
        return "Úloha překračuje limit velikosti vstupu."
    return None


def _limits(timeout_s: float) -> None:
    cpu = math.ceil(timeout_s) + 1
    for kind, value in ((resource.RLIMIT_CPU, cpu), (resource.RLIMIT_AS, MEMORY_BYTES),
                        (resource.RLIMIT_FSIZE, MAX_OUTPUT_BYTES), (resource.RLIMIT_NOFILE, 64),
                        (resource.RLIMIT_CORE, 0)):
        resource.setrlimit(kind, (value, value))


def execute_job_sync(job: Any) -> dict[str, Any]:
    """Execute in a fresh Python process; never import submitted source here."""
    started = time.monotonic()
    validation_error = validate_job(job)
    if validation_error:
        return response("rejected", error=validation_error)
    with _JOBS:
        with tempfile.TemporaryDirectory(prefix="skill-job-", dir="/tmp") as dirname:
            workdir = Path(dirname)
            for filename, source in job["files"].items():
                (workdir / filename).write_text(source, encoding="utf-8")
            (workdir / "input.json").write_text(
                json.dumps(job, ensure_ascii=False, allow_nan=False), encoding="utf-8")
            timeout_s = float(job.get("timeout_s", 10))
            process = subprocess.Popen(
                [sys.executable, "-I", "-B", str(RUNNER_PATH), dirname], cwd=dirname,
                env={"PATH": os.defpath}, start_new_session=True,
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                preexec_fn=lambda: _limits(timeout_s),
            )
            try:
                process.wait(timeout=timeout_s)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:  # Child exited while timeout fired.
                    pass
                process.wait()
                return response("timeout", error="Překročen časový limit.",
                                duration_ms=round((time.monotonic() - started) * 1000))
            result_path = workdir / "result.json"
            try:
                if result_path.stat().st_size > MAX_OUTPUT_BYTES:
                    raise ValueError("Výstup překračuje limit velikosti.")
                answer = json.loads(result_path.read_text(encoding="utf-8"))
                if not isinstance(answer, dict) or answer.get("status") not in {"ok", "error"}:
                    raise ValueError("Neplatný výstup runneru.")
            except (OSError, ValueError, RecursionError):
                answer = response("error", error="Runner selhal nebo překročil limit zdrojů.")
            answer["duration_ms"] = round((time.monotonic() - started) * 1000)
            return answer


async def execute_job(job: Any) -> dict[str, Any]:
    return await asyncio.to_thread(execute_job_sync, job)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/execute")
async def execute(request: Request) -> dict[str, Any]:
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_BODY_BYTES:
            return response("rejected", error="Tělo úlohy překračuje 8 MB.")
        body.extend(chunk)
    try:
        job = json.loads(body)
    except (ValueError, UnicodeError, RecursionError):
        return response("rejected", error="Neplatný JSON úlohy.")
    return await execute_job(job)
