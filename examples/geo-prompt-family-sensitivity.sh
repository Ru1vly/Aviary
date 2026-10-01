#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--" ]]; then
  shift
fi
observations="${1:-examples/geo-answer-observations.example.json}"
output_dir="${2:-reports/geo-prompt-family-sensitivity}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build:ts; fi
prompt_threshold="${GEO_PROMPT_FAMILY_THRESHOLD:-0.85}"
if [[ ! "$prompt_threshold" =~ ^(0([.][0-9]+)?|1([.]0+)?)$ ]]; then
  echo "GEO_PROMPT_FAMILY_THRESHOLD must be a number from 0 through 1." >&2
  exit 2
fi
source_categories=("${@:3}")
if (( ${#source_categories[@]} == 0 )); then
  source_categories=(
    "example.com=Publisher"
    "design.example.org=Design"
    "example.net=Standards"
  )
fi
mkdir -p "$output_dir"

cli_args=(
  --geo-answer-observations "$observations"
  --geo-answer-prompt-family-threshold "$prompt_threshold"
  --geo-answer-source-category-mapping-audit-csv "$output_dir/category-mapping-audit.csv"
  --geo-answer-prompt-families-csv "$output_dir/families.csv"
  --geo-answer-prompt-families-html "$output_dir/weighting-sensitivity.html"
  --geo-answer-prompt-family-influence-csv "$output_dir/family-influence.csv"
  --geo-answer-prompt-family-influence-html "$output_dir/family-influence.html"
  --geo-answer-prompt-family-threshold-sweep-csv "$output_dir/threshold-sweep.csv"
  --geo-answer-prompt-family-threshold-sweep-html "$output_dir/threshold-sweep.html"
  --geo-answer-prompt-family-source-rarefaction-csv "$output_dir/family-source-discovery.csv"
  --geo-answer-prompt-family-source-rarefaction-html "$output_dir/family-source-discovery.html"
  --geo-answer-prompt-family-source-rarefaction-sweep-csv "$output_dir/family-source-discovery-thresholds.csv"
  --geo-answer-prompt-family-source-rarefaction-sweep-html "$output_dir/family-source-discovery-thresholds.html"
  --geo-answer-provider-prompt-family-source-overlap-csv "$output_dir/provider-family-source-overlap.csv"
  --geo-answer-provider-prompt-family-source-overlap-html "$output_dir/provider-family-source-overlap.html"
  --geo-answer-provider-prompt-family-source-overlap-sweep-csv "$output_dir/provider-family-overlap-thresholds.csv"
  --geo-answer-provider-prompt-family-source-overlap-sweep-html "$output_dir/provider-family-overlap-thresholds.html"
)
for mapping in "${source_categories[@]}"; do
  cli_args+=(--geo-answer-source-category "$mapping")
done

node "$repo_root/dist/cli.js" \
  "${cli_args[@]}"

cat > "$output_dir/index.html" <<HTML
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GEO prompt-family sensitivity review</title>
<style>
  :root { color-scheme: light; font: 16px/1.55 system-ui, sans-serif; color: #17212b; background: #f3f6f7; }
  body { max-width: 760px; margin: 48px auto; padding: 0 20px; }
  main { background: white; border: 1px solid #dce4e7; border-radius: 16px; padding: 28px; }
  h1 { margin-top: 0; font-size: 1.65rem; }
  li { margin: 12px 0; }
  a { color: #075d55; font-weight: 650; }
  .note { border-left: 3px solid #e3a62f; padding-left: 14px; color: #46545c; }
</style>
<main>
  <h1>GEO prompt-family sensitivity review</h1>
  <p>Selected prompt-family cutoff: <strong>${prompt_threshold}</strong> cosine similarity.</p>
  <p>Review whether source reach and concentration conclusions shift when similar prompts are grouped, individual families are omitted, or the lexical cutoff changes.</p>
  <ul>
    <li><a href="threshold-sweep.html">Threshold sweep dashboard</a> — family topology, provider reach, and mapped category concentration across cutoffs.</li>
    <li><a href="family-influence.html">Leave-one-family-out dashboard</a> — which lexical groups most affect provider reach and source concentration.</li>
    <li><a href="weighting-sensitivity.html">Family weighting dashboard</a> — compare prompt-weighted and family-balanced views.</li>
    <li><a href="family-source-discovery.html">Family source-discovery dashboard</a> — expected observed-domain discovery as unique prompt families are added.</li>
    <li><a href="family-source-discovery-thresholds.html">Source-discovery cutoff sweep</a> — sensitivity to prompt-family thresholds.</li>
    <li><a href="provider-family-source-overlap.html">Provider family-source overlap</a> — source portfolio divergence within shared lexical families.</li>
    <li><a href="provider-family-overlap-thresholds.html">Provider overlap cutoff sweep</a> — whether source divergence changes with family grouping.</li>
  </ul>
  <p>CSV detail: <a href="families.csv">families</a>, <a href="family-influence.csv">family influence</a>, <a href="threshold-sweep.csv">threshold sweep</a>, <a href="family-source-discovery.csv">family discovery</a>, <a href="provider-family-source-overlap.csv">provider overlap</a>, <a href="category-mapping-audit.csv">category mapping audit</a>.</p>
  <p class="note">Lexical families are a sensitivity aid, not semantic intent labels. These captured-answer summaries do not establish causation, provider quality, or population-wide citation behavior.</p>
</main>
</html>
HTML
