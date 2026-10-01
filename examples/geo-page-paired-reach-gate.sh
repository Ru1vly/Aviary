#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build; fi
baseline="$repo_root/examples/geo-page-paired-reach-baseline.synthetic.example.json"
current="$repo_root/examples/geo-page-paired-reach-current.synthetic.example.json"
output_dir="${1:-reports/geo-page-paired-reach-gate}"
mkdir -p "$output_dir"

set +e
node "$repo_root/dist/cli.js" \
  --geo-answer-baseline-observations "$baseline" \
  --geo-answer-observations "$current" \
  --geo-answer-owned-domain publisher.example \
  --geo-answer-page-paired-reach-owned-only \
  --geo-answer-page-paired-reach-comparison-csv "$output_dir/page-reach.csv" \
  --fail-on-geo-answer-page-paired-reach-drop 50 \
  --geo-answer-page-paired-reach-metric top-three-reach \
  --fail-on-geo-answer-page-paired-reach-min-prompts 10 \
  --geo-answer-page-paired-reach-gate-json "$output_dir/gate.json" 2>&1 | tee "$output_dir/gate.log"
status=${PIPESTATUS[0]}
set -e

if [[ "$status" -ne 1 ]]; then
  printf 'Expected the synthetic page-reach gate to exit 1, received %s.\n' "$status" >&2
  exit 1
fi
printf 'Synthetic exact-page top-three gate fired as expected. Assessment: %s/gate.json\n' "$output_dir"
