#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build; fi
observations="${1:-$repo_root/examples/geo-source-category-monthly-turnover.synthetic.example.json}"
output_dir="${2:-reports/geo-source-category-monthly-turnover}"
mkdir -p "$output_dir"

node "$repo_root/dist/cli.js" \
  --geo-answer-observations "$observations" \
  --geo-answer-source-category publisher.example=Publisher \
  --geo-answer-source-category news.example=News \
  --geo-answer-source-category-concentration-trends-csv "$output_dir/monthly-category-trends.csv" \
  --geo-answer-source-category-concentration-trends-html "$output_dir/monthly-category-trends.html" \
  --geo-answer-source-category-share-trends-csv "$output_dir/monthly-category-shares.csv" \
  --geo-answer-source-category-share-trends-html "$output_dir/monthly-category-shares.html"
