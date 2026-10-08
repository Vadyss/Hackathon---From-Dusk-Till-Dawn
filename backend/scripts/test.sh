#!/bin/sh
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
test_image=${BACKEND_TEST_IMAGE:-python:3.12-slim}
skip_install=${BACKEND_TEST_SKIP_INSTALL:-0}
case "$skip_install" in
  0|1) ;;
  *) printf '%s\n' 'BACKEND_TEST_SKIP_INSTALL must be 0 or 1.' >&2; exit 2 ;;
esac
docker run --rm \
  --mount "type=bind,source=$repo_root,target=/workspace" \
  --workdir /workspace/backend \
  --env "BACKEND_TEST_SKIP_INSTALL=$skip_install" \
  "$test_image" sh -c '
    set -eu
    if [ "$BACKEND_TEST_SKIP_INSTALL" != 1 ]; then
      python -m pip install -r requirements.txt -r requirements-dev.txt -r ../sandbox/requirements.txt
    fi
    python -m pytest tests ../sandbox/tests "$@"
  ' sh "$@"
