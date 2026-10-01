#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${1:-}" == "--" ]]; then shift; fi
OUTPUT_DIR="${1:-$ROOT_DIR/reports/geo-citation-repeatability}"
mkdir -p "$OUTPUT_DIR"
node "$ROOT_DIR/examples/geo-citation-repeatability.mjs" \
  "$ROOT_DIR/examples/geo-citation-repeatability.synthetic.example.json" \
  "$OUTPUT_DIR/repeatability.csv" \
  --owned-domain example.com
