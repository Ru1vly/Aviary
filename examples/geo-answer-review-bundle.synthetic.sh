#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${1:-}" == "--" ]]; then
  shift
fi
output_dir="${1:-$repo_root/tmp/geo-answer-review-bundle-synthetic}"
baseline_crawler_dir="$(mktemp -d "${TMPDIR:-/tmp}/aviary-geo-review-baseline.XXXXXX")"
trap 'rm -rf -- "$baseline_crawler_dir"' EXIT

if [[ ! -f "$repo_root/dist/cli.js" ]]; then
  pnpm --dir "$repo_root" build:ts
fi

mkdir -p -- "$output_dir"
env -u GEO_CRAWLER_ACCESS_LOGS bash "$repo_root/examples/geo-crawler-route-family-review.sh" \
  "$repo_root/examples/geo-crawler-route-families.baseline.synthetic.example.jsonl" \
  "$repo_root/examples/geo-audited-page-provider-inventory.baseline-sitewide.synthetic.example.json" \
  https://example.com \
  "$baseline_crawler_dir"
baseline_crawler_report="$output_dir/baseline-crawler-report.json"
cp -- "$baseline_crawler_dir/crawler-report.json" "$baseline_crawler_report"
baseline_google_ai_concordance="$baseline_crawler_dir/google-ai-citation-concordance.json"
node "$repo_root/dist/cli.js" \
  --geo-answer-observations "$repo_root/examples/geo-audited-page-provider-inventory.baseline.synthetic.example.json" \
  --geo-answer-owned-domain example.com \
  --geo-google-ai-citation-concordance-csv "$baseline_crawler_dir/google-ai-citation-concordance.csv" \
  --google-ai-csv "$repo_root/examples/geo-google-ai-citation-concordance.synthetic.example.csv" \
  --geo-audit-json "$repo_root/examples/geo-audited-page-provider-inventory.baseline-sitewide.synthetic.example.json" \
  --output "$baseline_google_ai_concordance"

GEO_ANSWER_SOURCE_CATEGORIES=$'example.com=Owned\nnews.example=News\ncommunity.example=Community' \
GEO_GOOGLE_AI_SEARCH_EXPORT="$repo_root/examples/geo-google-ai-citation-concordance.synthetic.example.csv" \
GEO_GOOGLE_AI_BASELINE_CONCORDANCE_JSON="$baseline_google_ai_concordance" \
GEO_ROBOTS_CURRENT_TXT="$repo_root/examples/geo-robots.synthetic.current.txt" \
GEO_ROBOTS_BASELINE_TXT="$repo_root/examples/geo-robots.synthetic.baseline.txt" \
GEO_ROBOTS_AUDIT_JSON="$repo_root/examples/geo-audited-page-provider-inventory.sitewide.synthetic.example.json" \
GEO_ROBOTS_ORIGIN=https://example.com \
env -u GEO_CRAWLER_ACCESS_LOGS bash "$repo_root/examples/geo-answer-review-bundle.sh" \
  "$repo_root/examples/geo-audited-page-provider-inventory.baseline.synthetic.example.json" \
  "$repo_root/examples/geo-audited-page-provider-inventory.answers.synthetic.example.json" \
  example.com \
  "$output_dir" \
  "$repo_root/examples/geo-crawler-route-families.current.synthetic.example.jsonl" \
  "$repo_root/examples/geo-audited-page-provider-inventory.sitewide.synthetic.example.json" \
  https://example.com \
  "$baseline_crawler_report" \
  "$repo_root/examples/geo-audited-page-provider-inventory.baseline-sitewide.synthetic.example.json"

printf 'Synthetic GEO answer/crawler review bundle written to %s\n' "$output_dir"
