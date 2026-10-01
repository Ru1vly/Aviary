#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build; fi
current="$repo_root/examples/geo-source-category-turnover.current.synthetic.example.json"
baseline="$repo_root/examples/geo-source-category-turnover.baseline.synthetic.example.json"
output_dir="${1:-reports/geo-source-category-prompt-jsd-gate}"
mkdir -p "$output_dir"

set +e
node "$repo_root/dist/cli.js" \
  --geo-answer-observations "$current" \
  --geo-answer-baseline-observations "$baseline" \
  --geo-answer-source-category publisher.example=Publisher \
  --geo-answer-source-category news.example=News \
  --geo-answer-source-category-mix-decomposition-csv "$output_dir/category-mix.csv" \
  --geo-answer-source-category-mix-decomposition-html "$output_dir/category-mix.html" \
  --fail-on-geo-answer-source-category-prompt-balanced-jsd-lower-ci-above 0.5 \
  --fail-on-geo-answer-source-category-prompt-balanced-jsd-min-prompts 2 \
  --geo-answer-source-category-prompt-balanced-jsd-gate-json "$output_dir/gate.json" 2>&1 | tee "$output_dir/gate.log"
status=${PIPESTATUS[0]}
set -e

if [[ "$status" -ne 1 ]]; then
  printf 'Expected the synthetic prompt-balanced JSD gate to exit 1, received %s.\n' "$status" >&2
  exit 1
fi
printf 'Synthetic prompt-balanced JSD gate fired as expected. Dashboard: %s/category-mix.html\n' "$output_dir"
