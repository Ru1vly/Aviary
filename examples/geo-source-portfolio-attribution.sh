#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build; fi
current="${1:-$repo_root/examples/geo-source-portfolio-current.synthetic.example.json}"
baseline="${2:-$repo_root/examples/geo-source-portfolio-baseline.synthetic.example.json}"
output_dir="${3:-reports/geo-source-portfolio-attribution}"
mkdir -p "$output_dir"

node "$repo_root/dist/cli.js" \
  --geo-answer-observations "$current" \
  --geo-answer-baseline-observations "$baseline" \
  --geo-answer-owned-domain example.com \
  --geo-answer-source-portfolio-drift-csv "$output_dir/drift.csv" \
  --geo-answer-source-portfolio-drift-html "$output_dir/drift.html" \
  --geo-answer-source-portfolio-drift-json "$output_dir/drift.json" \
  --geo-answer-source-portfolio-attribution-csv "$output_dir/domain-attribution.csv" \
  --geo-answer-source-portfolio-attribution-json "$output_dir/domain-attribution.json" \
  --geo-answer-source-portfolio-attribution-html "$output_dir/domain-attribution.html" \
  --fail-on-geo-answer-owned-source-share-drop 100 \
  --fail-on-geo-answer-owned-source-share-drop-lower-ci 100 \
  --fail-on-geo-answer-owned-source-share-sign-test-alpha 0.05 \
  --geo-answer-owned-source-share-gate-csv "$output_dir/owned-share-gate.csv" \
  --geo-answer-owned-source-share-gate-json "$output_dir/owned-share-gate.json"
