#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_FILE="${1:-reports/entity-prompt-matched-association.csv}"
HTML_FILE="${OUTPUT_FILE%.csv}.html"

mkdir -p "$(dirname "$OUTPUT_FILE")"
if [[ ! -f "$ROOT_DIR/dist/cli.js" ]]; then pnpm --dir "$ROOT_DIR" build:ts; fi
node "$ROOT_DIR/dist/cli.js" \
  --geo-answer-observations "$ROOT_DIR/examples/geo-entity-prompt-matched-association.synthetic.example.json" \
  --geo-answer-entity "Aviary" \
  --geo-answer-owned-domain example.com \
  --geo-answer-entity-prompt-matched-association-csv "$OUTPUT_FILE" \
  --geo-answer-entity-prompt-matched-association-html "$HTML_FILE"
