#!/usr/bin/env python3
"""Real HTTP/WebSocket smoke, requiring a clean isolated mock demo registry."""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from urllib.parse import urlsplit, urlunsplit

import httpx
from websockets.asyncio.client import connect

SEQUENCE_A = [
    "run_started", "plan_ready", "skill_reused", "capability_missing", "forge_started",
    "skill_tests_failed", "forge_started", "skill_candidate_ready", "rule_drafted",
    "rule_evaluated", "rule_drafted", "rule_evaluated", "validation_done", "summary", "awaiting_approval",
]
SEQUENCE_B = [
    "run_started", "plan_ready", "skill_reused", "skill_reused", "rule_drafted",
    "rule_evaluated", "validation_done", "summary", "awaiting_approval",
]


async def smoke(base: str, timeout_s: float) -> None:
    parts = urlsplit(base.rstrip("/"))
    ws_url = urlunsplit(("wss" if parts.scheme == "https" else "ws", parts.netloc,
                        parts.path + "/api/ws", "", ""))
    observed: list[dict] = []
    async with httpx.AsyncClient(base_url=base.rstrip("/"), timeout=10, trust_env=False) as client:
        health = await client.get("/api/health")
        health.raise_for_status()
        assert health.json() == {"status": "ok", "contract_version": 1}, health.text
        skills = (await client.get("/api/skills")).json()["skills"]
        assert "distinct_count_window" not in {skill["name"] for skill in skills}, (
            "Smoke potřebuje nový demo registr. Použijte samostatný Compose projekt; existující data nemažte.")
        async with connect(ws_url, open_timeout=10, ping_interval=20) as websocket:
            async def collect() -> None:
                async for raw in websocket:
                    observed.append(json.loads(raw))
            collector = asyncio.create_task(collect())
            try:
                for request, expected, suffix, stats in (
                    ("Chci zachytit password spraying na SSH.", SEQUENCE_A,
                     ["skill_installed", "rule_approved"], (1, 1)),
                    ("Chci zachytit distribuovaný brute force na SSH.", SEQUENCE_B,
                     ["rule_approved"], (0, 2)),
                ):
                    created = await client.post("/api/runs", json={"request": request})
                    assert created.status_code == 202, created.text
                    run_id = created.json()["run_id"]
                    started = time.monotonic()
                    while True:
                        answer = await client.get(f"/api/runs/{run_id}/events")
                        answer.raise_for_status()
                        events = answer.json()["events"]
                        if events and events[-1]["type"] in {"awaiting_approval", "run_failed"}:
                            break
                        if time.monotonic() - started > timeout_s:
                            raise RuntimeError("Běh překročil časový limit smoke testu.")
                        await asyncio.sleep(0.1)
                    assert [event["type"] for event in events] == expected, events
                    summary = next(event["data"] for event in events if event["type"] == "summary")
                    assert (summary["stats"]["skills_built"], summary["stats"]["skills_reused"]) == stats
                    assert summary["stats"]["tokens_total"] is None
                    approved = await client.post(f"/api/runs/{run_id}/approve", json={"comment": "Kouřový test."})
                    assert approved.status_code == 200 and approved.json() == {"status": "approved"}, approved.text
                    events = (await client.get(f"/api/runs/{run_id}/events")).json()["events"]
                    assert [event["type"] for event in events] == expected + suffix, events
                    assert [event["seq"] for event in events] == list(range(1, len(events) + 1))
                    async with asyncio.timeout(5):
                        while len([event for event in observed if event["run_id"] == run_id]) < len(events):
                            await asyncio.sleep(0.01)
                    assert [event for event in observed if event["run_id"] == run_id] == events
                    print(f"{run_id}: " + " → ".join(event["type"] for event in events))
                skills = (await client.get("/api/skills")).json()["skills"]
                learned = next(skill for skill in skills if skill["name"] == "distinct_count_window")
                assert learned["origin"] == "agent" and learned["status"] == "installed"
                print("HTTP, WebSocket, skutečný sandbox, schválení a opětovné použití: OK.")
            finally:
                collector.cancel()
                await asyncio.gather(collector, return_exceptions=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://localhost:3000")
    parser.add_argument("--timeout", type=float, default=90)
    arguments = parser.parse_args()
    try:
        asyncio.run(smoke(arguments.base, arguments.timeout))
    except (AssertionError, httpx.HTTPError, RuntimeError, TimeoutError, OSError) as exc:
        print(f"Smoke selhal: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
