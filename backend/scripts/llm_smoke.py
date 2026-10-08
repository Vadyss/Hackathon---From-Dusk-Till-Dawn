#!/usr/bin/env python3
"""Explicit manual provider probe. No datasets, registry or generated code run."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from orchestrator.config import Settings
from orchestrator.llm import LlmError, extract_json, make_client
from gatekeeper.types import ParseFailure


async def main() -> int:
    settings = Settings.from_env()
    client = make_client(settings)
    try:
        result = await client.chat("planner", 'Return only JSON {"ok":true}.', "Connection check; do not produce source code.")
        parsed = result if isinstance(result, ParseFailure) else extract_json(result.text)
        if isinstance(parsed, ParseFailure):
            print("Poskytovatel odpověděl, ale nevrátil platný JSON.")
            return 1
        print(f"Spojení funguje. Model: {result.model}; tokeny: {result.total_tokens}.")
        return 0
    except LlmError as error:
        print(str(error))
        return 1
    finally:
        await client.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
