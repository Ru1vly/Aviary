#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${1:-reports/geo-google-ai-citation-concordance}"
mkdir -p "$output_dir"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build:ts; fi

node "$repo_root/dist/cli.js" \
  --google-ai-csv "$repo_root/examples/geo-google-ai-citation-concordance.synthetic.example.csv" \
  --geo-answer-observations "$repo_root/examples/geo-google-ai-citation-concordance.answers.synthetic.example.json" \
  --geo-audit-json "$repo_root/examples/geo-google-ai-citation-concordance.sitewide-audit.synthetic.example.json" \
  --geo-answer-owned-domain example.com \
  --output "$output_dir/concordance.json" \
  --geo-google-ai-citation-concordance-csv "$output_dir/concordance.csv" \
  --geo-google-ai-citation-concordance-provider-csv "$output_dir/provider-pages.csv" \
  --geo-google-ai-citation-concordance-path-family-csv "$output_dir/path-families.csv" \
  --geo-google-ai-citation-concordance-path-depth-sweep-csv "$output_dir/path-depth-sweep.csv" \
  --geo-google-ai-citation-concordance-html "$output_dir/concordance.html"

printf 'URL concordance CSV: %s/concordance.csv\n' "$output_dir"
printf 'Provider-level page CSV: %s/provider-pages.csv\n' "$output_dir"
printf 'Path-depth sensitivity CSV: %s/path-depth-sweep.csv\n' "$output_dir"
printf 'Offline dashboard: %s/concordance.html\n' "$output_dir"
