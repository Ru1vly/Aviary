#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ $# -lt 3 || $# -gt 5 ]]; then
  echo "Usage: $0 <first-urls.txt> <second-urls.txt> <output-dir> [settle-ms] [wait-until]" >&2
  exit 2
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
first_urls="$1"
second_urls="$2"
out_dir="$3"
settle_ms="${4:-1500}"
wait_until="${5:-domcontentloaded}"

if [[ ! -f "$first_urls" || ! -f "$second_urls" ]]; then
  echo 'Both URL-list arguments must be readable files.' >&2
  exit 2
fi
if [[ ! "$settle_ms" =~ ^[0-9]+$ ]] || (( settle_ms > 30000 )); then
  echo 'settle-ms must be an integer from 0 to 30000.' >&2
  exit 2
fi
case "$wait_until" in
  domcontentloaded|load|networkidle) ;;
  *) echo 'wait-until must be domcontentloaded, load, or networkidle.' >&2; exit 2 ;;
esac

mkdir -p "$out_dir"
run_audit() {
  local label="$1"
  local urls="$2"
  node "$root/dist/cli.js" --urls "$urls" \
    --wait-until "$wait_until" --settle-ms "$settle_ms" \
    --concurrency "${AVIARY_CONCURRENCY:-2}" \
    -o "$out_dir/$label.json" \
    --html "$out_dir/$label.html" \
    --geo-summary-output "$out_dir/$label-geo.json"
  node "$root/examples/geo-opportunity-review.mjs" \
    "$out_dir/$label-geo.json" "$out_dir/$label-opportunities.md" \
    --audit "$out_dir/$label.json"
}

run_audit first "$first_urls"
run_audit second "$second_urls"
node "$root/examples/geo-render-parity.mjs" \
  "$out_dir/first.json" "$out_dir/second.json" "$out_dir/host-parity.md"
printf 'GEO host review written to %s\n' "$out_dir"
