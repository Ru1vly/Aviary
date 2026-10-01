#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build; fi

if [[ $# -lt 2 ]]; then
  printf 'Usage: %s <current-batch.json> <baseline-batch.json> [output-dir] [gate [signal=<label>] [url=<exact-url>] [transition=<before=>after>] ...]\n' "$0" >&2
  exit 2
fi
if [[ $# -gt 3 && "${4:-}" != "gate" ]]; then
  printf 'The optional fourth argument must be "gate" before any filter selectors.\n' >&2
  exit 2
fi

current_report="$1"
baseline_report="$2"
output_dir="${3:-reports/geo-batch-baseline-comparison}"
gate_args=()
if [[ "${4:-}" == "gate" ]]; then
  gate_args+=(--fail-on-geo-change --geo-gate-output "$output_dir/geo-gate.json")
  shift 4
  for selector in "$@"; do
    case "$selector" in
      signal=*) value="${selector#signal=}"; [[ -n "$value" ]] || { printf 'signal= requires a non-empty exact label.\n' >&2; exit 2; }; gate_args+=(--fail-on-geo-change-signal "$value") ;;
      url=*) value="${selector#url=}"; [[ -n "$value" ]] || { printf 'url= requires a non-empty exact URL.\n' >&2; exit 2; }; gate_args+=(--fail-on-geo-change-url "$value") ;;
      transition=*) value="${selector#transition=}"; [[ "$value" == *'=>'* ]] || { printf 'transition= requires <before=>after>.\n' >&2; exit 2; }; gate_args+=(--fail-on-geo-change-transition "$value") ;;
      *) printf 'Unknown GEO gate selector "%s"; use signal=<label>, url=<exact-url>, or transition=<before=>after>.\n' "$selector" >&2; exit 2 ;;
    esac
  done
fi
mkdir -p "$output_dir"

node "$repo_root/dist/cli.js" \
  --render "$current_report" \
  --baseline "$baseline_report" \
  --html "$output_dir/current.html" \
  --pdf "$output_dir/current.pdf" \
  --markdown "$output_dir/current.md" \
  --comparison-output "$output_dir/comparison.json" \
  --geo-comparison-csv "$output_dir/geo-changes.csv" \
  --geo-summary-output "$output_dir/geo-summary.json" \
  --geo-summary-csv "$output_dir/geo-pages.csv" \
  --geo-entity-variants-csv "$output_dir/entity-variants.csv" \
  --geo-crawler-access-csv "$output_dir/crawler-access.csv" \
  "${gate_args[@]}"
