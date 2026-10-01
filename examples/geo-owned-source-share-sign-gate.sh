#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build; fi
output_dir="${1:-reports/geo-owned-source-share-sign-gate}"
mkdir -p "$output_dir"

set +e
node "$repo_root/dist/cli.js" \
  --geo-answer-observations "$repo_root/examples/geo-source-portfolio-current.synthetic.example.json" \
  --geo-answer-baseline-observations "$repo_root/examples/geo-source-portfolio-baseline.synthetic.example.json" \
  --geo-answer-owned-domain example.com \
  --fail-on-geo-answer-owned-source-share-sign-test-alpha 0.05 \
  --fail-on-geo-answer-owned-source-share-min-prompts 5 \
  --geo-answer-owned-source-share-gate-csv "$output_dir/owned-share-sign-gate.csv" \
  --geo-answer-owned-source-share-gate-json "$output_dir/owned-share-sign-gate.json"
result=$?
set -e

if [[ "$result" -ne 1 ]] || ! grep -q '^"summary","regression",' "$output_dir/owned-share-sign-gate.csv"; then
  printf 'Expected a regression assessment with exit 1; received exit %s.\n' "$result" >&2
  exit 1
fi
printf 'Expected sample regression recorded in %s/owned-share-sign-gate.csv and owned-share-sign-gate.json.\n' "$output_dir"
