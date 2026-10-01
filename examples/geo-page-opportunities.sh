#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build; fi
observations="$repo_root/examples/geo-page-opportunities.synthetic.example.json"
output_dir="${1:-reports/geo-page-opportunities}"
mkdir -p "$output_dir"

node "$repo_root/dist/cli.js" \
  --geo-answer-observations "$observations" \
  --geo-answer-owned-domain publisher.example \
  --geo-answer-page-opportunities-csv "$output_dir/page-opportunities.csv"
node "$repo_root/dist/cli.js" \
  --geo-answer-observations "$observations" \
  --geo-answer-owned-domain publisher.example \
  --geo-answer-page-opportunity-path-depth 2 \
  --geo-answer-page-opportunity-path-families-csv "$output_dir/page-opportunity-path-families.csv" \
  --geo-answer-page-opportunity-path-family-depth-sweep-csv "$output_dir/page-opportunity-depth-sensitivity.csv" \
  --geo-answer-page-opportunity-path-family-depth-sweep-html "$output_dir/page-opportunity-depth-sensitivity.html"
printf 'Confirmed-no-owned-citation exact pages: %s/page-opportunities.csv\n' "$output_dir"
printf 'Path-family depth sensitivity (1–5 segments): %s/page-opportunity-depth-sensitivity.csv\n' "$output_dir"
printf 'Path-family depth sensitivity dashboard: %s/page-opportunity-depth-sensitivity.html\n' "$output_dir"
