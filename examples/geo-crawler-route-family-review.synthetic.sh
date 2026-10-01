#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${1:-}" == "--" ]]; then shift; fi
output_dir="${1:-reports/geo-crawler-route-family-review}"
bash "$repo_root/examples/geo-crawler-route-family-review.sh" \
  "$repo_root/examples/geo-crawler-route-families.current.synthetic.example.jsonl" \
  "$repo_root/examples/geo-crawler-audit.current.synthetic.example.json" \
  "https://example.com" "$output_dir"
