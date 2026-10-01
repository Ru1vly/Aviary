#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build; fi
current="${1:-$repo_root/examples/geo-source-category-turnover.current.synthetic.example.json}"
baseline="${2:-$repo_root/examples/geo-source-category-turnover.baseline.synthetic.example.json}"
output_dir="${3:-reports/geo-source-category-turnover}"
mkdir -p "$output_dir"

node "$repo_root/dist/cli.js" \
  --geo-answer-observations "$current" \
  --geo-answer-baseline-observations "$baseline" \
  --geo-answer-source-category publisher.example=Publisher \
  --geo-answer-source-category news.example=News \
  --geo-answer-source-category-mix-decomposition-csv "$output_dir/category-mix.csv" \
  --geo-answer-source-category-mix-decomposition-html "$output_dir/category-mix.html"
