# Copyright (c) 2026 Adam Krúpa and Ondra Csajka. All rights reserved.
"""Test-only transport adapter: submitted code still runs in a limited child."""
from __future__ import annotations

from typing import Any
from uuid import uuid4

from sandbox.server import execute_job


class InProcessSandbox:
    async def health(self) -> bool:
        return True

    async def execute(self, job: dict[str, Any]) -> dict[str, Any]:
        return await execute_job(job)

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
        pass
