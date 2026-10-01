#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -lt 4 || $# -gt 5 ]]; then
  printf 'Usage: %s <access-log> <geo-audit.json> <origin> <output-dir> [baseline-crawler-report.json]\n' "$0" >&2
  exit 2
fi

access_log="$1"
audit_report="$2"
origin="$3"
output_dir="$4"
baseline_report="${5:-}"
path_depth="${GEO_CRAWLER_PATH_DEPTH:-2}"

access_logs=()
if [[ -n "${GEO_CRAWLER_ACCESS_LOGS:-}" ]]; then
  while IFS= read -r log_file; do
    log_file="${log_file%$'\r'}"
    [[ -z "$log_file" ]] && continue
    access_logs+=("$log_file")
  done <<< "$GEO_CRAWLER_ACCESS_LOGS"
else
  access_logs+=("$access_log")
fi
if [[ ${#access_logs[@]} -eq 0 ]]; then
  printf 'GEO_CRAWLER_ACCESS_LOGS must contain at least one non-empty path.\n' >&2
  exit 2
fi

if [[ ! -f "$repo_root/dist/cli.js" ]]; then
  pnpm --dir "$repo_root" build:ts
fi

mkdir -p -- "$output_dir"

args=(
  --geo-audit-json "$audit_report"
  --geo-crawler-origin "$origin"
  --geo-crawler-path-depth "$path_depth"
  --geo-crawler-path-families-csv "$output_dir/path-families.csv"
  --geo-crawler-path-families-json "$output_dir/path-families.json"
  --geo-crawler-path-families-html "$output_dir/path-families.html"
  --geo-crawler-path-family-audit-csv "$output_dir/path-audit.csv"
  --geo-crawler-path-family-audit-json "$output_dir/path-audit.json"
  --geo-crawler-path-family-audit-html "$output_dir/path-audit.html"
  --output "$output_dir/crawler-report.json"
  --html "$output_dir/crawler-report.html"
)
for log_file in "${access_logs[@]}"; do
  args+=(--geo-crawler-log "$log_file")
done

if [[ -n "$baseline_report" ]]; then
  args+=(
    --geo-crawler-baseline-json "$baseline_report"
    --geo-crawler-path-family-comparison-csv "$output_dir/path-family-period.csv"
    --geo-crawler-path-family-comparison-json "$output_dir/path-family-period.json"
    --geo-crawler-path-family-comparison-html "$output_dir/path-family-period.html"
    --fail-on-geo-crawler-path-family-failure-rise 10
    --geo-crawler-path-family-failure-gate-json "$output_dir/path-family-failure-gate.json"
  )
fi

node "$repo_root/dist/cli.js" "${args[@]}"
