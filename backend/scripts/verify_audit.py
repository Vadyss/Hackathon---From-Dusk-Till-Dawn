#!/usr/bin/env python3
"""Verify the persisted audit trail without modifying it."""
from __future__ import annotations
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from gatekeeper.audit import verify_audit


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify the SHA-256 audit chain.")
    parser.add_argument("path", type=Path, nargs="?", default=Path("/data/audit.jsonl"))
    args = parser.parse_args()
    if not args.path.is_file():
        print("Audit file not found.", file=sys.stderr)
        return 1
    ok, errors = verify_audit(args.path)
    if ok:
        print("The audit chain is valid.")
        return 0
    for error in errors:
        print(error, file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
