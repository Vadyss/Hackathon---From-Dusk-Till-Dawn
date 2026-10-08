#!/usr/bin/env bash
set -euo pipefail
backend_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
dataset_image="${BACKEND_DATASET_IMAGE:-python:3.12-slim}"
dataset_output="${backend_dir}/datasets"
while (( $# )); do
  case "$1" in
    --output)
      if (( $# < 2 )); then
        printf '%s\n' 'Chybí cesta za --output.' >&2
        exit 2
      fi
      dataset_output="$2"
      shift 2
      ;;
    --output=*)
      dataset_output="${1#--output=}"
      shift
      ;;
    -h|--help)
      printf '%s\n' 'Použití: regen_datasets.sh [--output CESTA]' \
        'Deterministická regenerace v Dockeru s Pythonem 3.12; výchozí výstup backend/datasets.'
      exit 0
      ;;
    *)
      printf 'Neznámý parametr: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done
if [[ -z "$dataset_output" ]]; then
  printf '%s\n' 'Výstupní cesta nesmí být prázdná.' >&2
  exit 2
fi
mkdir -p -- "$dataset_output"
dataset_output="$(cd -- "$dataset_output" && pwd)"
docker run --rm --network none --read-only \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,source=${backend_dir},target=/workspace/backend,readonly" \
  --mount "type=bind,source=${dataset_output},target=/generated" \
  --env PYTHONDONTWRITEBYTECODE=1 \
  "$dataset_image" python /workspace/backend/datasets/generators/regenerate.py --output /generated
