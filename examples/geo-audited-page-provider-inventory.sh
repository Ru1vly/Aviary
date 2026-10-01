#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${1:-reports/geo-audited-page-provider-inventory}"
mkdir -p "$output_dir"
pnpm --dir "$repo_root" build:ts

node "$repo_root/dist/cli.js" \
  --geo-answer-observations "$repo_root/examples/geo-audited-page-provider-inventory.answers.synthetic.example.json" \
  --geo-answer-baseline-observations "$repo_root/examples/geo-audited-page-provider-inventory.baseline.synthetic.example.json" \
  --geo-answer-owned-domain example.com \
  --geo-audit-json "$repo_root/examples/geo-audited-page-provider-inventory.sitewide.synthetic.example.json" \
  --geo-audit-baseline-json "$repo_root/examples/geo-audited-page-provider-inventory.baseline-sitewide.synthetic.example.json" \
  --geo-answer-audited-owned-page-provider-inventory-csv "$output_dir/provider-inventory.csv" \
  --geo-answer-audited-owned-page-provider-inventory-html "$output_dir/provider-inventory.html" \
  --geo-answer-audited-owned-page-provider-inventory-comparison-csv "$output_dir/provider-inventory-period.csv" \
  --geo-answer-audited-owned-page-provider-inventory-comparison-html "$output_dir/provider-inventory-period.html" \
  --geo-answer-audited-owned-page-provider-inventory-comparison-json "$output_dir/provider-inventory-period.json"

printf 'Owned-page/provider inventory CSV: %s/provider-inventory.csv\n' "$output_dir"
printf 'Filterable offline review dashboard: %s/provider-inventory.html\n' "$output_dir"
printf 'Provider/page period comparison CSV: %s/provider-inventory-period.csv\n' "$output_dir"
printf 'Typed provider/page period comparison JSON: %s/provider-inventory-period.json\n' "$output_dir"
