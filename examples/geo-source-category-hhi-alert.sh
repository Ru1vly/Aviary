#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build; fi
observations="$repo_root/examples/geo-source-category-hhi-alert.synthetic.example.json"
output_dir="${1:-reports/geo-source-category-hhi-alert}"
mkdir -p "$output_dir"

set +e
node "$repo_root/dist/cli.js" \
  --geo-answer-observations "$observations" \
  --geo-answer-source-category publisher.example=Publisher \
  --geo-answer-source-category news.example=News \
  --geo-answer-source-category-concentration-trends-csv "$output_dir/monthly-category-trends.csv" \
  --geo-answer-source-category-concentration-trends-html "$output_dir/monthly-category-trends.html" \
  --geo-answer-source-category-monthly-gates-json "$output_dir/monthly-gates.json" \
  --fail-on-geo-answer-source-category-monthly-hhi-above 0.8 \
  --fail-on-geo-answer-source-category-monthly-top-three-hhi-above 0.8 \
  --fail-on-geo-answer-source-category-monthly-hhi-rise-above 0.25 \
  --fail-on-geo-answer-source-category-monthly-top-three-hhi-rise-above 0.25 \
  --fail-on-geo-answer-source-category-monthly-min-events 10 2>&1 | tee "$output_dir/gate.log"
status=${PIPESTATUS[0]}
set -e

if [[ "$status" -ne 1 ]] || ! grep -Eiq '^Monthly (top-three )?source-category HHI' "$output_dir/gate.log"; then
  printf 'Expected the synthetic concentration HHI gates to fire (exit 1 with gate diagnostics); received exit %s.\n' "$status" >&2
  exit 1
fi
printf 'Synthetic HHI alerts fired as expected. Dashboard: %s/monthly-category-trends.html\n' "$output_dir"
