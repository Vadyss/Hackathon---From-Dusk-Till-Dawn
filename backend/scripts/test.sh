#!/bin/sh
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
docker run --rm \
  --mount "type=bind,source=$repo_root,target=/workspace" \
  --workdir /workspace/backend \
  python:3.12-slim sh -c '
    set -eu
    python -m pip install -r requirements.txt -r requirements-dev.txt -r ../sandbox/requirements.txt
    python -m pytest tests ../sandbox/tests "$@"
  ' sh "$@"
