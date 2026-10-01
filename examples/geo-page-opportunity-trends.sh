#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build; fi
observations="$repo_root/examples/geo-page-opportunity-trends.synthetic.example.json"
output_dir="${1:-reports/geo-page-opportunity-trends}"
mkdir -p "$output_dir"

node "$repo_root/dist/cli.js" \
  --geo-answer-observations "$observations" \
  --geo-answer-owned-domain example.com \
  --geo-answer-page-opportunity-trends-csv "$output_dir/monthly-page-opportunities.csv" \
  --geo-answer-page-opportunity-path-family-trends-csv "$output_dir/monthly-page-opportunity-path-families.csv" \
  --geo-answer-page-opportunity-path-family-trends-html "$output_dir/monthly-page-opportunity-path-families.html"
printf 'UTC-month confirmed-no-owned-citation page opportunities: %s/monthly-page-opportunities.csv\n' "$output_dir"
printf 'UTC-month confirmed-no-owned-citation path families: %s/monthly-page-opportunity-path-families.csv\n' "$output_dir"
printf 'Offline path-family trend dashboard: %s/monthly-page-opportunity-path-families.html\n' "$output_dir"
