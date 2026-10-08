"""Bounded, process-local run history and atomic intake."""
from __future__ import annotations

import asyncio
import re
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from orchestrator.api_errors import ApiError
from orchestrator.models import RunInfo, RunStats

PHASES = ("intake", "plan", "forge", "rule", "validation", "approval", "done")
ACTIVE_STATUSES = {"running", "awaiting_approval"}
FINISHED_STATUSES = {"approved", "rejected", "failed"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@dataclass
class RunCounters:
    llm_calls: int = 0
    tokens_total: int | None = None
    cost_usd: float | None = None
    skills_built: int = 0
    skills_reused: int = 0
    started_monotonic: float = field(default_factory=time.monotonic)

    def snapshot(self) -> dict:
        return RunStats(duration_ms=max(0, int((time.monotonic() - self.started_monotonic) * 1000)),
                        llm_calls=self.llm_calls, tokens_total=self.tokens_total,
                        cost_usd=self.cost_usd,
                        skills_built=self.skills_built, skills_reused=self.skills_reused).model_dump(mode="json")


@dataclass
class PendingApproval:
    recipe: dict
    metrics_tuning: Any
    metrics_validation: Any
    new_skills: list
    attack_type: str


@dataclass
class RunState:
    run_id: str
    request: str
    status: str = "running"
    created_at: str = field(default_factory=now_iso)
    finished_at: str | None = None
    events: list[dict] = field(default_factory=list)
    last_seq: int = 0
    phase_index: int = 0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    decision_taken: bool = False
    pending: PendingApproval | None = None
    stats: RunCounters = field(default_factory=RunCounters)
    task: asyncio.Task | None = None
    voice_task: asyncio.Task | None = None
    audio: bytes | None = None

    @property
    def phase(self) -> str:
        return PHASES[self.phase_index]

    def info(self) -> dict:
        return RunInfo(run_id=self.run_id, request=self.request, status=self.status,
                       created_at=self.created_at, finished_at=self.finished_at,
                       last_seq=self.last_seq).model_dump(mode="json")


class RunStore:
    def __init__(self, max_runs: int = 50):
        self.runs: dict[str, RunState] = {}
        self.lock = asyncio.Lock()
        self.max_runs = max_runs

    async def create(self, request: str) -> RunState:
        async with self.lock:
            if any(r.status in ACTIVE_STATUSES for r in self.runs.values()):
                raise ApiError(409, "RUN_ALREADY_ACTIVE", "Předchozí běh ještě neskončil.")
            while len(self.runs) >= self.max_runs:
                oldest = next(r for r in self.runs.values() if r.status in FINISHED_STATUSES)
                if oldest.voice_task and not oldest.voice_task.done():
                    oldest.voice_task.cancel()
                del self.runs[oldest.run_id]
            run_id = "run_" + secrets.token_hex(4)
            while run_id in self.runs:
                run_id = "run_" + secrets.token_hex(4)
            run = RunState(run_id, request)
            self.runs[run_id] = run
            return run

    def get(self, run_id: str) -> RunState:
        if not re.fullmatch(r"run_[a-z0-9]{4,32}", run_id) or run_id not in self.runs:
            raise ApiError(404, "RUN_NOT_FOUND", "Běh neexistuje.")
        return self.runs[run_id]

    def list(self) -> list[dict]:
        return [r.info() for r in reversed(list(self.runs.values()))]

    async def close(self) -> None:
        tasks = [t for r in self.runs.values() for t in (r.task, r.voice_task) if t and not t.done()]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
