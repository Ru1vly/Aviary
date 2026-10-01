#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--" ]]; then
  shift
fi
observations="${1:-examples/geo-answer-observations.example.json}"
output_dir="${2:-reports/geo-prompt-panel-plan}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/dist/cli.js" ]]; then pnpm --dir "$repo_root" build:ts; fi
owned_domains=("${@:3}")
minimum_prompts="${GEO_PROMPT_PLAN_MIN_PROMPTS:-20}"
args=(
  --geo-answer-observations "$observations"
  --geo-answer-prompt-sampling-plan-csv "$output_dir/prompt-plan.csv"
  --geo-answer-prompt-sampling-plan-json "$output_dir/prompt-plan.json"
  --geo-answer-prompt-plan-provider-pairs-csv "$output_dir/provider-pair-budgets.csv"
  --geo-answer-prompt-plan-min-prompts "$minimum_prompts"
)

for domain in "${owned_domains[@]}"; do
  args+=(--geo-answer-owned-domain "$domain")
done
if (( ${#owned_domains[@]} > 0 )); then
  args+=(--geo-answer-prompt-plan-owned-reach-margin "${GEO_PROMPT_PLAN_OWNED_REACH_MARGIN:-5}")
fi
if [[ -n "${GEO_PROMPT_PLAN_MIN_JACCARD:-}" ]]; then
  args+=(--geo-answer-prompt-plan-min-jaccard "$GEO_PROMPT_PLAN_MIN_JACCARD")
fi
if [[ -n "${GEO_PROMPT_PLAN_MAX_TOTAL_PAIRED_GROUPS:-}" ]]; then
  args+=(
    --geo-answer-prompt-plan-max-total-paired-groups "$GEO_PROMPT_PLAN_MAX_TOTAL_PAIRED_GROUPS"
    --geo-answer-prompt-plan-total-allocation "${GEO_PROMPT_PLAN_TOTAL_ALLOCATION:-balanced}"
  )
fi
if [[ -n "${GEO_PROMPT_PLAN_COHORT_TARGETS:-}" ]]; then
  args+=(--geo-answer-prompt-plan-cohort-targets "$GEO_PROMPT_PLAN_COHORT_TARGETS")
fi
if [[ "${GEO_PROMPT_PLAN_FAIL_ON_MISS:-0}" == "1" ]]; then
  args+=(--fail-on-geo-answer-prompt-plan-miss)
fi

mkdir -p "$output_dir"
cli_status=0
node "$repo_root/dist/cli.js" "${args[@]}" || cli_status=$?
if [[ ! -f "$output_dir/prompt-plan.json" ]]; then
  if [[ "$cli_status" -eq 0 ]]; then cli_status=1; fi
  exit "$cli_status"
fi

node - "$output_dir/prompt-plan.json" "$output_dir/index.html" <<'NODE'
const fs = require('node:fs');
const [reportPath, htmlPath] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const summary = report.targetSummary ?? {};
const number = (value) => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('en-US') : 'not available';
const status = report.targetsMet === true ? 'Configured targets met' : 'Some configured targets are unmet';
fs.writeFileSync(htmlPath, `
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GEO prompt panel plan</title>
<style>
  :root { color-scheme: light; font: 16px/1.55 system-ui, sans-serif; color: #17212b; background: #f3f6f7; }
  body { max-width: 760px; margin: 48px auto; padding: 0 20px; }
  main { background: white; border: 1px solid #dce4e7; border-radius: 16px; padding: 28px; }
  h1 { margin-top: 0; font-size: 1.65rem; }
  li { margin: 12px 0; }
  a { color: #075d55; font-weight: 650; }
  .status { font-weight: 700; }
  dl { display: grid; grid-template-columns: 1fr auto; gap: 7px 16px; padding: 14px; background: #f3f6f7; border-radius: 10px; }
  dt, dd { margin: 0; }
  dd { font-variant-numeric: tabular-nums; font-weight: 650; }
  .note { border-left: 3px solid #e3a62f; padding-left: 14px; color: #46545c; }
</style>
<main>
  <h1>GEO prompt panel plan</h1>
  <p class="status">${status}</p>
  <p>Use the provider-pair budget to schedule matched capture work, then inspect each provider/cohort quota before collecting another panel.</p>
  <dl>
    <dt>Provider/cohort rows analyzed</dt><dd>${number(summary.cohortRowsAnalyzed)}</dd>
    <dt>Paired prompt groups planned / required</dt><dd>${number(summary.plannedPairedPromptGroups)} / ${number(summary.requiredPairedPromptGroups)}</dd>
    <dt>Paired prompt groups deferred by caps</dt><dd>${number(summary.deferredPairedPromptGroups)}</dd>
    <dt>Provider-specific new prompts</dt><dd>${number(summary.providerSpecificAdditionalPromptQuotas)}</dd>
  </dl>
  <ul>
    <li><a href="prompt-plan.csv">Provider and cohort capture plan</a></li>
    <li><a href="provider-pair-budgets.csv">Provider-pair effort summary</a></li>
    <li><a href="prompt-plan.json">Versioned plan JSON</a></li>
  </ul>
  <p class="note">Quotas balance the supplied panel and configured targets. They do not estimate market demand or make a hand-selected prompt sample representative.</p>
</main>
</html>
`);
NODE
exit "$cli_status"
