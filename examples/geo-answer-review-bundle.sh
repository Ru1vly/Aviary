#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

# pnpm forwards its conventional `--` separator to shell scripts.
if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ $# -ne 4 && $# -ne 7 && $# -ne 8 && $# -ne 9 ]]; then
  printf 'Usage: %s <baseline-observations.json> <current-observations.json> <owned-domain> <output-dir> [current-access-log current-sitewide-audit.json origin [baseline-crawler-report.json|- [baseline-sitewide-audit.json]]]\n' "$0" >&2
  exit 2
fi

baseline="$1"
current="$2"
owned_domain="$3"
output_dir="$4"
access_log="${5:-}"
sitewide_audit="${6:-}"
crawl_origin="${7:-}"
baseline_crawler_report="${8:-}"
baseline_sitewide_audit="${9:-}"
google_ai_export="${GEO_GOOGLE_AI_SEARCH_EXPORT:-}"
google_ai_baseline="${GEO_GOOGLE_AI_BASELINE_CONCORDANCE_JSON:-}"
repeatability_gate_rules="${GEO_CITATION_REPEATABILITY_GATE_RULES:-}"
panel_fail_on_warnings="${GEO_PANEL_COMPARABILITY_FAIL_ON_WARNINGS:-0}"
panel_thresholds_file="${GEO_PANEL_COMPARABILITY_THRESHOLDS_FILE:-}"
robots_current="${GEO_ROBOTS_CURRENT_TXT:-}"
robots_baseline="${GEO_ROBOTS_BASELINE_TXT:-}"
robots_audit="${GEO_ROBOTS_AUDIT_JSON:-${sitewide_audit:-}}"
robots_origin="${GEO_ROBOTS_ORIGIN:-${crawl_origin:-}}"
robots_fail_on_newly_blocked="${GEO_ROBOTS_FAIL_ON_NEWLY_BLOCKED:-0}"
robots_gate_status=0
category_gate_status=0
repeatability_gate_status=0
panel_gate_status=0
if [[ "$baseline_crawler_report" == "-" ]]; then
  baseline_crawler_report=""
fi
crawler_logs=()
if [[ -n "${GEO_CRAWLER_ACCESS_LOGS:-}" ]]; then
  while IFS= read -r log_file; do
    log_file="${log_file%$'\r'}"
    [[ -z "$log_file" ]] && continue
    crawler_logs+=("$log_file")
  done <<< "$GEO_CRAWLER_ACCESS_LOGS"
elif [[ -n "$access_log" ]]; then
  crawler_logs+=("$access_log")
fi
if [[ -n "$access_log" && ${#crawler_logs[@]} -eq 0 ]]; then
  printf 'GEO_CRAWLER_ACCESS_LOGS must contain at least one non-empty path.\n' >&2
  exit 2
fi

if [[ -n "$access_log$sitewide_audit$crawl_origin" && ( -z "$access_log" || -z "$sitewide_audit" || -z "$crawl_origin" ) ]]; then
  printf 'Crawler review requires all three optional inputs: access log, sitewide audit JSON, and origin.\n' >&2
  exit 2
fi

for input in "$baseline" "$current"; do
  if [[ ! -f "$input" ]]; then
    printf 'Input file not found: %s\n' "$input" >&2
    exit 2
  fi
done
if [[ ${#crawler_logs[@]} -gt 0 ]]; then
  for input in "${crawler_logs[@]}" "$sitewide_audit"; do
    if [[ ! -f "$input" ]]; then
      printf 'Input file not found: %s\n' "$input" >&2
      exit 2
    fi
  done
fi
if [[ -n "$baseline_crawler_report" && ${#crawler_logs[@]} -eq 0 ]]; then
  printf 'A baseline crawler report requires the current crawler inputs.\n' >&2
  exit 2
fi
if [[ -n "$baseline_crawler_report" && ! -f "$baseline_crawler_report" ]]; then
  printf 'Input file not found: %s\n' "$baseline_crawler_report" >&2
  exit 2
fi
if [[ -n "$baseline_sitewide_audit" && ${#crawler_logs[@]} -eq 0 ]]; then
  printf 'A baseline sitewide audit requires the current crawler inputs.\n' >&2
  exit 2
fi
if [[ -n "$baseline_sitewide_audit" && ! -f "$baseline_sitewide_audit" ]]; then
  printf 'Input file not found: %s\n' "$baseline_sitewide_audit" >&2
  exit 2
fi
if [[ -n "$google_ai_export" && ! -f "$google_ai_export" ]]; then
  printf 'Google AI export not found: %s\n' "$google_ai_export" >&2
  exit 2
fi
if [[ -n "$google_ai_baseline" && ! -f "$google_ai_baseline" ]]; then
  printf 'Google AI baseline concordance not found: %s\n' "$google_ai_baseline" >&2
  exit 2
fi
if [[ -n "$repeatability_gate_rules" && ! -f "$repeatability_gate_rules" ]]; then
  printf 'GEO citation repeatability gate rules not found: %s\n' "$repeatability_gate_rules" >&2
  exit 2
fi
if [[ "$panel_fail_on_warnings" != 0 && "$panel_fail_on_warnings" != 1 ]]; then
  printf 'GEO_PANEL_COMPARABILITY_FAIL_ON_WARNINGS must be 0 or 1.\n' >&2
  exit 2
fi
if [[ -n "$panel_thresholds_file" && ! -f "$panel_thresholds_file" ]]; then
  printf 'GEO panel comparability thresholds file not found: %s\n' "$panel_thresholds_file" >&2
  exit 2
fi
if [[ -n "$google_ai_baseline" && -z "$google_ai_export" ]]; then
  printf 'GEO_GOOGLE_AI_BASELINE_CONCORDANCE_JSON requires GEO_GOOGLE_AI_SEARCH_EXPORT.\n' >&2
  exit 2
fi
if [[ -n "$robots_baseline" && -z "$robots_current" ]]; then
  printf 'GEO_ROBOTS_BASELINE_TXT requires GEO_ROBOTS_CURRENT_TXT.\n' >&2
  exit 2
fi
if [[ "$robots_fail_on_newly_blocked" != 0 && "$robots_fail_on_newly_blocked" != 1 ]]; then
  printf 'GEO_ROBOTS_FAIL_ON_NEWLY_BLOCKED must be 0 or 1.\n' >&2
  exit 2
fi
if [[ "$robots_fail_on_newly_blocked" == 1 && -z "$robots_baseline" ]]; then
  printf 'GEO_ROBOTS_FAIL_ON_NEWLY_BLOCKED=1 requires GEO_ROBOTS_BASELINE_TXT.\n' >&2
  exit 2
fi
if [[ -n "$robots_current" && ( -z "$robots_audit" || -z "$robots_origin" ) ]]; then
  printf 'Robots replay requires GEO_ROBOTS_AUDIT_JSON (or the current sitewide audit input) and GEO_ROBOTS_ORIGIN (or the crawler origin).\n' >&2
  exit 2
fi
for input in "$robots_current" "$robots_baseline" "$robots_audit"; do
  if [[ -n "$input" && ! -f "$input" ]]; then
    printf 'Robots replay input not found: %s\n' "$input" >&2
    exit 2
  fi
done
if [[ ! -f "$repo_root/dist/cli.js" ]]; then
  pnpm --dir "$repo_root" build:ts
fi

mkdir -p -- "$output_dir"
answer_args=(
  --geo-answer-baseline-observations "$baseline"
  --geo-answer-observations "$current"
  --geo-answer-owned-domain "$owned_domain"
  --geo-answer-comparison-csv "$output_dir/answer-comparison.csv"
  --geo-answer-domain-paired-reach-comparison-csv "$output_dir/domain-paired-reach.csv"
  --geo-answer-domain-paired-reach-comparison-json "$output_dir/domain-paired-reach.json"
  --geo-answer-page-paired-reach-owned-only
  --geo-answer-page-paired-reach-comparison-csv "$output_dir/owned-page-paired-reach.csv"
  --geo-answer-page-paired-reach-comparison-json "$output_dir/owned-page-paired-reach.json"
  --geo-answer-page-opportunities-csv "$output_dir/current-page-opportunities.csv"
  --geo-answer-source-portfolio-drift-csv "$output_dir/source-portfolio-drift.csv"
  --geo-answer-source-portfolio-drift-json "$output_dir/source-portfolio-drift.json"
  --geo-answer-source-portfolio-drift-html "$output_dir/source-portfolio-drift.html"
  --geo-answer-source-network-comparison-html "$output_dir/source-network-drift.html"
  --geo-answer-source-network-comparison-csv "$output_dir/source-network-drift.csv"
  --geo-answer-rank-weighted-source-network-comparison-csv "$output_dir/rank-weighted-source-network-drift.csv"
  --geo-answer-source-rarefaction-csv "$output_dir/source-rarefaction.csv"
  --geo-answer-source-diversity-uncertainty-html "$output_dir/source-diversity-uncertainty.html"
  --geo-answer-source-diversity-comparison-csv "$output_dir/source-diversity-comparison.csv"
  --geo-answer-source-diversity-comparison-html "$output_dir/source-diversity-comparison.html"
  --geo-answer-provider-source-divergence-csv "$output_dir/provider-source-divergence.csv"
  --geo-answer-provider-source-network-overlap-csv "$output_dir/provider-source-network-overlap.csv"
  --geo-answer-provider-source-network-edge-drift-csv "$output_dir/provider-network-edge-drift.csv"
  --geo-answer-provider-source-network-edge-drift-html "$output_dir/provider-network-edge-drift.html"
  --geo-answer-prompt-families-html "$output_dir/prompt-family-sensitivity.html"
)

source_categories=()
if [[ -n "${GEO_ANSWER_SOURCE_CATEGORIES:-}" ]]; then
  while IFS= read -r mapping; do
    mapping="${mapping%$'\r'}"
    [[ -z "$mapping" ]] && continue
    if [[ "$mapping" != *=* || "$mapping" == *= ]]; then
      printf 'Invalid GEO_ANSWER_SOURCE_CATEGORIES row; expected domain=Category: %s\n' "$mapping" >&2
      exit 2
    fi
    source_categories+=("$mapping")
  done <<< "$GEO_ANSWER_SOURCE_CATEGORIES"
fi
for mapping in "${source_categories[@]}"; do
  answer_args+=(--geo-answer-source-category "$mapping")
done
if [[ ${#source_categories[@]} -gt 0 ]]; then
  answer_args+=(
    --geo-answer-path-depth "${GEO_ANSWER_PATH_DEPTH:-2}"
    --geo-answer-source-category-mix-decomposition-csv "$output_dir/source-category-mix.csv"
    --geo-answer-source-category-mix-decomposition-html "$output_dir/source-category-mix.html"
    --geo-answer-source-category-path-families-csv "$output_dir/source-category-path-families.csv"
    --geo-answer-source-category-path-family-comparison-csv "$output_dir/source-category-path-family-period.csv"
    --geo-answer-source-category-concentration-trends-csv "$output_dir/source-category-concentration-trends.csv"
    --geo-answer-source-category-concentration-trends-html "$output_dir/source-category-concentration-trends.html"
  )
fi
if [[ -n "${GEO_ANSWER_SOURCE_CATEGORY_PROMPT_BALANCED_JSD_MAX:-}" ]]; then
  if [[ ${#source_categories[@]} -eq 0 ]]; then
    printf 'GEO_ANSWER_SOURCE_CATEGORY_PROMPT_BALANCED_JSD_MAX requires GEO_ANSWER_SOURCE_CATEGORIES.\n' >&2
    exit 2
  fi
  answer_args+=(
    --fail-on-geo-answer-source-category-prompt-balanced-jsd-lower-ci-above "$GEO_ANSWER_SOURCE_CATEGORY_PROMPT_BALANCED_JSD_MAX"
    --fail-on-geo-answer-source-category-prompt-balanced-jsd-min-prompts "${GEO_ANSWER_SOURCE_CATEGORY_PROMPT_BALANCED_JSD_MIN_PROMPTS:-2}"
    --geo-answer-source-category-prompt-balanced-jsd-gate-json "$output_dir/source-category-prompt-jsd-gate.json"
  )
fi
if [[ ${#crawler_logs[@]} -gt 0 ]]; then
  answer_args+=(
    --geo-audit-json "$sitewide_audit"
    --geo-answer-audited-owned-page-provider-inventory-csv "$output_dir/owned-page-provider-inventory.csv"
    --geo-answer-audited-owned-page-provider-inventory-html "$output_dir/owned-page-provider-inventory.html"
  )
fi
if [[ -n "$baseline_sitewide_audit" ]]; then
  answer_args+=(
    --geo-audit-baseline-json "$baseline_sitewide_audit"
    --geo-answer-audited-owned-page-provider-inventory-comparison-csv "$output_dir/owned-page-provider-inventory-period.csv"
    --geo-answer-audited-owned-page-provider-inventory-comparison-html "$output_dir/owned-page-provider-inventory-period.html"
    --geo-answer-audited-owned-page-provider-inventory-comparison-json "$output_dir/owned-page-provider-inventory-period.json"
  )
fi
category_manifest_flag=""
if [[ ${#source_categories[@]} -gt 0 ]]; then
  category_manifest_flag="with-categories"
fi
crawler_manifest_flag=""
if [[ ${#crawler_logs[@]} -gt 0 ]]; then
  crawler_manifest_flag="with-crawler"
fi
if [[ -n "${GEO_ANSWER_SOURCE_CATEGORY_PROMPT_BALANCED_JSD_MAX:-}" ]]; then
  if node "$repo_root/dist/cli.js" "${answer_args[@]}"; then
    :
  else
    category_gate_status=$?
    if [[ $category_gate_status -ne 1 ]]; then
      exit "$category_gate_status"
    fi
  fi
else
  node "$repo_root/dist/cli.js" "${answer_args[@]}"
fi

node "$repo_root/examples/geo-citation-repeatability.mjs" \
  "$baseline" "$output_dir/baseline-citation-repeatability.csv" --owned-domain "$owned_domain"
node "$repo_root/examples/geo-citation-repeatability.mjs" \
  "$current" "$output_dir/current-citation-repeatability.csv" --owned-domain "$owned_domain"
node "$repo_root/examples/geo-citation-repeatability-compare.mjs" \
  "$output_dir/baseline-citation-repeatability-prompts.csv" \
  "$output_dir/current-citation-repeatability-prompts.csv" \
  "$output_dir/citation-repeatability-change.csv"
panel_comparability_args=(node "$repo_root/examples/geo-panel-comparability.mjs" "$baseline" "$current" "$output_dir/panel-comparability")
if [[ -n "$panel_thresholds_file" ]]; then
  panel_comparability_args+=(--thresholds-file "$panel_thresholds_file")
  threshold_copy="$output_dir/panel-comparability-thresholds.json"
  node - "$panel_thresholds_file" "$threshold_copy" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(process.argv[2]);
const destination = path.resolve(process.argv[3]);
const sourceRealPath = fs.realpathSync(source);
const destinationRealPath = fs.existsSync(destination) ? fs.realpathSync(destination) : destination;
if (sourceRealPath !== destinationRealPath) fs.copyFileSync(source, destination);
NODE
  chmod 600 "$threshold_copy"
fi
if [[ "$panel_fail_on_warnings" == 1 ]]; then panel_comparability_args+=(--fail-on-warnings); fi
if "${panel_comparability_args[@]}"; then
  :
else
  panel_gate_status=$?
  if [[ $panel_gate_status -ne 1 ]]; then exit "$panel_gate_status"; fi
  if [[ ! -s "$output_dir/panel-comparability.json" ]]; then
    printf 'Panel comparability gate failed before writing its report.\n' >&2
    exit 1
  fi
  node --input-type=module - "$output_dir/panel-comparability.json" <<'NODE'
import { readFile } from 'node:fs/promises';
const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (report.warningGate?.enabled !== true || report.warningGate.status !== 'failed') throw new Error('Panel preflight exited nonzero without a failed warning-gate decision.');
NODE
fi
if [[ -n "$repeatability_gate_rules" ]]; then
  node - "$repeatability_gate_rules" "$output_dir/citation-repeatability-gate-rules.json" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(process.argv[2]);
const destination = path.resolve(process.argv[3]);
const sourceRealPath = fs.realpathSync(source);
const destinationRealPath = fs.existsSync(destination) ? fs.realpathSync(destination) : destination;
if (sourceRealPath !== destinationRealPath) fs.copyFileSync(source, destination);
NODE
  rm -f -- "$output_dir/citation-repeatability-gate.json"
  if node "$repo_root/examples/geo-citation-repeatability-gate.mjs" \
    "$output_dir/citation-repeatability-change.json" "$output_dir/citation-repeatability-gate-rules.json" \
    "$output_dir/citation-repeatability-gate.json"; then
    :
  else
    repeatability_gate_status=$?
    if [[ $repeatability_gate_status -ne 1 ]]; then
      exit "$repeatability_gate_status"
    fi
    if [[ ! -s "$output_dir/citation-repeatability-gate.json" ]]; then
      printf 'Citation repeatability gate failed before writing its decision report.\n' >&2
      exit 1
    fi
    node --input-type=module - "$output_dir/citation-repeatability-gate.json" <<'NODE'
import { readFile } from 'node:fs/promises';
const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (!['failed', 'inconclusive'].includes(report.status)) throw new Error('Gate exited nonzero without a failed or inconclusive decision.');
NODE
  fi
fi

if [[ -n "$google_ai_export" ]]; then
  google_ai_args=(
    --geo-answer-observations "$current"
    --geo-answer-owned-domain "$owned_domain"
    --geo-google-ai-citation-concordance-csv "$output_dir/google-ai-citation-concordance.csv"
    --geo-google-ai-citation-concordance-html "$output_dir/google-ai-citation-concordance.html"
    --geo-google-ai-citation-concordance-provider-csv "$output_dir/google-ai-citation-providers.csv"
    --geo-google-ai-citation-concordance-path-family-csv "$output_dir/google-ai-citation-path-families.csv"
    --geo-google-ai-citation-concordance-path-depth-sweep-csv "$output_dir/google-ai-citation-path-depth-sweep.csv"
    --geo-google-ai-citation-concordance-path-depth "${GEO_GOOGLE_AI_PATH_DEPTH:-2}"
    --output "$output_dir/google-ai-citation-concordance.json"
  )
  if [[ "$google_ai_export" == *.[xX][lL][sS][xX] ]]; then
    google_ai_args+=(--google-ai-xlsx "$google_ai_export")
  else
    google_ai_args+=(--google-ai-csv "$google_ai_export")
  fi
  if [[ -n "$sitewide_audit" ]]; then
    google_ai_args+=(--geo-audit-json "$sitewide_audit")
  fi
  if [[ -n "$google_ai_baseline" ]]; then
    bundled_google_ai_baseline="$output_dir/google-ai-citation-concordance-baseline.json"
    if [[ ! -e "$bundled_google_ai_baseline" || ! "$google_ai_baseline" -ef "$bundled_google_ai_baseline" ]]; then
      cp -- "$google_ai_baseline" "$bundled_google_ai_baseline"
    fi
    google_ai_args+=(
      --geo-google-ai-citation-concordance-baseline-json "$google_ai_baseline"
      --geo-google-ai-citation-concordance-comparison-csv "$output_dir/google-ai-citation-concordance-period.csv"
      --geo-google-ai-citation-concordance-comparison-json "$output_dir/google-ai-citation-concordance-period.json"
      --geo-google-ai-citation-concordance-comparison-html "$output_dir/google-ai-citation-concordance-period.html"
      --geo-google-ai-citation-concordance-provider-comparison-csv "$output_dir/google-ai-citation-providers-period.csv"
    )
  fi
  node "$repo_root/dist/cli.js" "${google_ai_args[@]}"
fi

if [[ -n "$robots_current" ]]; then
  robots_args=(
    --geo-audit-json "$robots_audit"
    --geo-robots-origin "$robots_origin"
    --geo-robots-txt "$robots_current"
    --output "$output_dir/geo-robots-replay.json"
    --html "$output_dir/geo-robots-replay.html"
  )
  if [[ -n "$robots_baseline" ]]; then
    robots_args+=(--geo-robots-baseline-txt "$robots_baseline")
  fi
  if [[ "$robots_fail_on_newly_blocked" == 1 ]]; then
    robots_args+=(--fail-on-newly-blocked-geo-audit-pages)
  fi
  if [[ -n "${GEO_ROBOTS_TOKENS:-}" ]]; then
    while IFS= read -r token; do
      token="${token%$'\r'}"
      [[ -z "$token" ]] && continue
      robots_args+=(--geo-robots-token "$token")
    done <<< "$GEO_ROBOTS_TOKENS"
  fi
  if [[ "$robots_fail_on_newly_blocked" == 1 ]]; then
    if node "$repo_root/dist/cli.js" "${robots_args[@]}"; then
      :
    else
      robots_gate_status=$?
      if [[ $robots_gate_status -ne 1 ]]; then
        exit "$robots_gate_status"
      fi
    fi
  else
    node "$repo_root/dist/cli.js" "${robots_args[@]}"
  fi
fi

if [[ ${#crawler_logs[@]} -gt 0 ]]; then
  crawler_args=(
    --geo-audit-json "$sitewide_audit" \
    --geo-crawler-origin "$crawl_origin" \
    --geo-crawler-path-depth "${GEO_CRAWLER_PATH_DEPTH:-2}" \
    --geo-crawler-path-families-csv "$output_dir/crawler-path-families.csv" \
    --geo-crawler-path-families-json "$output_dir/crawler-path-families.json" \
    --geo-crawler-path-families-html "$output_dir/crawler-path-families.html" \
    --geo-crawler-path-family-audit-csv "$output_dir/crawler-path-audit.csv" \
    --geo-crawler-path-family-audit-json "$output_dir/crawler-path-audit.json" \
    --geo-crawler-path-family-audit-html "$output_dir/crawler-path-audit.html" \
    --output "$output_dir/crawler-report.json" \
    --html "$output_dir/crawler-report.html"
  )
  for log_file in "${crawler_logs[@]}"; do
    crawler_args+=(--geo-crawler-log "$log_file")
  done
  if [[ -n "$baseline_crawler_report" ]]; then
    crawler_args+=(
      --geo-crawler-baseline-json "$baseline_crawler_report"
      --geo-crawler-path-family-comparison-csv "$output_dir/crawler-path-period.csv"
      --geo-crawler-path-family-comparison-json "$output_dir/crawler-path-period.json"
      --geo-crawler-path-family-comparison-html "$output_dir/crawler-path-period.html"
      --geo-crawler-path-family-audit-comparison-csv "$output_dir/crawler-audit-period.csv"
      --geo-crawler-path-family-audit-comparison-json "$output_dir/crawler-audit-period.json"
      --geo-crawler-path-family-audit-comparison-html "$output_dir/crawler-audit-period.html"
    )
  fi
  node "$repo_root/dist/cli.js" "${crawler_args[@]}"
fi

cat > "$output_dir/README.md" <<'EOF'
# GEO answer review bundle

This bundle summarizes the supplied baseline/current answer-capture samples. It does not estimate search-engine visibility or establish that a site change caused a citation change.

| Artifact | Use |
| --- | --- |
| `answer-comparison.csv` | Broad provider and owned-citation period summary |
| `domain-paired-reach.csv` / `.json` | Exact provider/prompt domain reach changes on matched prompts |
| `owned-page-paired-reach.csv` / `.json` | Exact owned-page reach changes on matched prompts |
| `current-page-opportunities.csv` | Current capture's owned-citation gaps, prioritized by observed alternative-domain evidence |
| `baseline-citation-repeatability.*` / `current-citation-repeatability.*` | Within-period URL/domain and rank repeatability, with prompt-balanced intervals |
| `baseline-citation-repeatability-prompts.csv` / `current-citation-repeatability-prompts.csv` | Prompt-level metric and completeness detail keyed by a stable SHA-256 prompt ID; prompt text is omitted |
| `citation-repeatability-change.csv` / `.json` / `.html` | Paired baseline/current within-prompt repeatability shifts, prompt support, and bootstrap intervals |
| `panel-comparability.*` | Exact-context observation-share and unique-prompt mix balance, matched-prompt overlap, metadata coverage, capture depth, incomplete-list preflight, and stable warning codes |
| `panel-comparability-thresholds.json` | Optional custom panel-warning profile copied when configured |
| `citation-repeatability-gate-rules.json` / `citation-repeatability-gate.json` | Optional reproducible regression rules and the support-aware repeatability gate decision |
| `source-portfolio-drift.csv` / `.json` / `.html` | Source mix, rank, and portfolio changes with an offline review dashboard |
| `source-network-drift.html` | Matched-prompt co-citation graph, community transitions, and network drift |
| `source-network-drift.csv` / `rank-weighted-source-network-drift.csv` | Event and reciprocal-rank-weighted network comparisons |
| `source-rarefaction.csv` / `source-diversity-uncertainty.html` | Current prompt-panel source discovery and prompt-cluster uncertainty |
| `source-diversity-comparison.csv` / `.html` | Matched-period event/rank source diversity changes and intervals |
| `provider-source-divergence.csv` / `provider-source-network-overlap.csv` | Provider source-mix and co-citation-network differences on shared prompts |
| `google-ai-citation-concordance.*` / `google-ai-citation-providers.csv` / `google-ai-citation-path-families.csv` / `google-ai-citation-path-depth-sweep.csv` | Optional Google AI page-export and observed-answer citation URL concordance, including path rollups at depths 1–5 |
| `google-ai-citation-concordance-period.*` / `google-ai-citation-providers-period.csv` | Optional changes against a saved baseline Google AI concordance report |
| `geo-robots-replay.json` / `.html` | Optional replay of audited URLs against robots rules, with baseline/current crawler-token changes and optional CI gate |
| `provider-network-edge-drift.csv` | Machine-readable provider-pair source-edge gap changes |
| `provider-network-edge-drift.html` | Provider-pair source-edge gap changes on the same exact prompts across periods |
| `prompt-family-sensitivity.html` | Sensitivity to lexical prompt-family grouping thresholds |
| `source-category-mix.csv` / `.html` | Optional mapped source-category mix comparison |
| `source-category-path-families.csv` / `source-category-path-family-period.csv` | Optional category distribution by URL path family and baseline/current changes |
| `source-category-concentration-trends.csv` / `.html` | Optional monthly mapped-category coverage, concentration, and distribution-divergence trends |
| `source-category-prompt-jsd-gate.json` | Optional prompt-balanced category-distribution change gate |
| `crawler-path-families.*` / `crawler-path-audit.*` / `crawler-report.*` | Optional current crawler access and audited route-family review |
| `crawler-path-period.*` / `crawler-audit-period.*` | Optional baseline/current route-family and audited page-signal comparisons |
| `baseline-crawler-report.json` | Optional saved prior crawler report used for those comparisons |
| `owned-page-provider-inventory.*` | Optional join between captured owned citations, provider, and audited page signals |
| `owned-page-provider-inventory-period.*` | Optional baseline/current owned citation and audited page-signal comparison |
| `index.html` | Offline launch page for dashboards and data artifacts |
| `overview.html` / `overview.json` | Readable and machine-readable summaries of panel comparability, retained reach, provider source drift, Google page transitions, robots access changes, and any enabled gate outcomes |
| `manifest.json` | Inventory of bundle-owned files with sizes and SHA-256 checksums (the manifest excludes itself) |

Interpret comparisons with their support counts, completeness states, and uncertainty fields. The samples are observational and may reflect changes in model, surface, locale, capture method, or prompt mix. Set `GEO_CITATION_REPEATABILITY_GATE_RULES` to a repeatability gate configuration JSON to evaluate the paired repeatability report. Set `GEO_PANEL_COMPARABILITY_THRESHOLDS_FILE` to a version 1 JSON profile to customize advisory panel-warning thresholds and optionally gate selected warning codes; the effective cutoffs are in the report and the selected profile is copied into the checksum manifest. Set `GEO_PANEL_COMPARABILITY_FAIL_ON_WARNINGS=1` to fail closed on any panel-preflight warning after all bundle artifacts are written. The bundle copies repeatability rules into the artifact set and records pass, failure, or inconclusive support in its overview; failed or inconclusive rules still leave a complete bundle before the command returns status 1. Set `GEO_ANSWER_SOURCE_CATEGORIES` to newline-separated `domain=Category` mappings to include source-category mix, category-by-URL-path-family output, and monthly mapped-category concentration/divergence trends; use `GEO_ANSWER_PATH_DEPTH` from 1 to 5 (default 2) to set the family depth. Add `GEO_ANSWER_SOURCE_CATEGORY_PROMPT_BALANCED_JSD_MAX` to gate on the lower confidence bound of prompt-balanced category-distribution divergence; set `GEO_ANSWER_SOURCE_CATEGORY_PROMPT_BALANCED_JSD_MIN_PROMPTS` to change the minimum comparable-prompt support (default 2). Insufficient support also fails closed. A failed gate still produces the bundle and machine-readable decision before returning status 1. Set `GEO_GOOGLE_AI_SEARCH_EXPORT` to a page-dimension Google AI Search CSV/XLSX export for concordance. Also set `GEO_GOOGLE_AI_BASELINE_CONCORDANCE_JSON` to a saved earlier concordance report to compare page and provider transitions; use the same surface and audit/domain settings across periods. Set `GEO_ROBOTS_CURRENT_TXT` to replay audit URLs against current robots rules, and optionally `GEO_ROBOTS_BASELINE_TXT` to compare prior allow/block decisions. Set `GEO_ROBOTS_FAIL_ON_NEWLY_BLOCKED=1` to return a failing status when a page becomes newly blocked or comparison coverage is incomplete; the bundle and evidence reports are still written. Supply the audit with `GEO_ROBOTS_AUDIT_JSON` (or the current sitewide audit input) and set `GEO_ROBOTS_ORIGIN` (or reuse the crawler origin); newline-separated `GEO_ROBOTS_TOKENS` adds custom user-agent tokens. Pass all three optional inputs after the output directory to add a crawler review: access log, current sitewide audit JSON, and origin. Set `GEO_CRAWLER_ACCESS_LOGS` to newline-separated paths to aggregate rotated/current logs. Append a baseline Aviary crawler report to compare route-family traffic and append a baseline sitewide audit JSON to compare captured owned citations with audited page signals across periods.
EOF

node - "$output_dir" "$crawler_manifest_flag" "${baseline_crawler_report:+with-crawler-baseline}" "$category_manifest_flag" "${baseline_sitewide_audit:+with-audit-baseline}" "${google_ai_export:+with-google-ai-export}" "${google_ai_baseline:+with-google-ai-baseline}" "${robots_current:+with-robots}" "${repeatability_gate_rules:+with-repeatability-gate}" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const outputDir = process.argv[2];
const includesCrawlerReview = process.argv[3] === 'with-crawler';
const includesCategories = process.argv[5] === 'with-categories';
const includesAuditBaseline = process.argv[6] === 'with-audit-baseline';
const includesGoogleAiExport = process.argv[7] === 'with-google-ai-export';
const includesGoogleAiBaseline = process.argv[8] === 'with-google-ai-baseline';
const includesRobotsReplay = process.argv[9] === 'with-robots';
const includesRepeatabilityGate = process.argv[10] === 'with-repeatability-gate';
const readJson = (filename) => {
  const filePath = path.join(outputDir, filename);
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
};
const domainReachReport = readJson('domain-paired-reach.json');
const pageReachReport = readJson('owned-page-paired-reach.json');
const sourcePortfolioReport = readJson('source-portfolio-drift.json');
const googleAiCurrent = includesGoogleAiExport ? readJson('google-ai-citation-concordance.json') : null;
const googleAiPeriod = includesGoogleAiBaseline ? readJson('google-ai-citation-concordance-period.json') : null;
const robotsReplay = includesRobotsReplay ? readJson('geo-robots-replay.json') : null;
const categoryJsdGate = process.env.GEO_ANSWER_SOURCE_CATEGORY_PROMPT_BALANCED_JSD_MAX
  ? readJson('source-category-prompt-jsd-gate.json') : null;
const repeatabilityGate = includesRepeatabilityGate ? readJson('citation-repeatability-gate.json') : null;
const panelReport = readJson('panel-comparability.json');
const domainRows = domainReachReport?.rows ?? [];
const pageRows = (pageReachReport?.rows ?? []).filter((row) => typeof row.page_url === 'string');
const robotsComparison = robotsReplay?.comparison ?? null;
const robotsIncomplete = Boolean(robotsComparison && (robotsReplay.rowsTruncated || robotsReplay.pagesSkipped > 0 ||
  robotsReplay.auditPagesUnavailable > 0 || robotsReplay.targetsMayBeTruncated || robotsComparison.changesTruncated ||
  robotsComparison.urlTokenPairsNotComparable > 0 || robotsComparison.urlTokenPairsMissingFromBaseline > 0 ||
  robotsComparison.urlTokenPairsMissingFromCurrent > 0));
const overview = {
  artifact_type: 'geo-answer-review-overview',
  schema_version: 1,
  generated_at_utc: new Date().toISOString(),
  answer_domain_reach: domainReachReport ? {
    provider_domain_comparison_rows: domainRows.length,
    comparable_prompt_groups_across_rows: domainRows.reduce((sum, row) => sum + (Number(row.comparable_prompt_groups) || 0), 0),
    gained_domain_prompt_rows: domainRows.reduce((sum, row) => sum + (Number(row.gained_prompts) || 0), 0),
    lost_domain_prompt_rows: domainRows.reduce((sum, row) => sum + (Number(row.lost_prompts) || 0), 0),
    all_rows_comparison_complete: domainRows.every((row) => row.comparison_complete === true),
    rows_truncated: domainRows.some((row) => row.output_rows_truncated === true),
  } : null,
  owned_page_reach: pageReachReport ? {
    retained_page_provider_rows: pageRows.length,
    unique_owned_pages: new Set(pageRows.map((row) => row.page_url)).size,
    rows_with_prompt_gains: pageRows.filter((row) => Number(row.gained_prompts) > 0).length,
    rows_with_prompt_losses: pageRows.filter((row) => Number(row.lost_prompts) > 0).length,
    all_rows_comparison_complete: pageRows.every((row) => row.comparison_complete === true),
    rows_truncated: Boolean(pageReachReport.summary?.output_rows_truncated || pageReachReport.summary?.prompt_page_evaluations_truncated),
  } : null,
  source_portfolio_by_provider: sourcePortfolioReport ? (sourcePortfolioReport.providerRows ?? []).map((row) => ({
    provider: row.provider,
    shared_exact_prompt_groups: row.shared_exact_prompt_groups,
    source_domain_presence_gains: row.source_domain_presence_gains,
    source_domain_presence_losses: row.source_domain_presence_losses,
    event_weighted_jsd_bits: row.pooled_event_weighted_source_jsd_bits,
    prompt_balanced_mean_jsd_bits: row.prompt_balanced_mean_source_jsd_bits,
    prompt_balanced_mean_jsd_ci95_lower: row.prompt_balanced_mean_source_jsd_ci95_lower,
    prompt_balanced_mean_jsd_ci95_upper: row.prompt_balanced_mean_source_jsd_ci95_upper,
    rank_weighted_jsd_bits: row.pooled_rank_weighted_source_jsd_bits,
    rank_prompt_balanced_mean_jsd_bits: row.prompt_balanced_mean_rank_source_jsd_bits,
    rank_prompt_balanced_ci95_lower: row.prompt_balanced_mean_rank_source_jsd_ci95_lower,
    rank_prompt_balanced_ci95_upper: row.prompt_balanced_mean_rank_source_jsd_ci95_upper,
    event_comparison_complete: row.event_comparison_complete,
    rank_comparison_complete: row.rank_comparison_complete,
  })) : null,
  google_ai_page_concordance: googleAiPeriod ? {
    baseline_comparison_available: true,
    surface: googleAiPeriod.googleAiSurface,
    baseline_unique_pages: googleAiPeriod.baselineGoogleAiUniquePages,
    current_unique_pages: googleAiPeriod.currentGoogleAiUniquePages,
    matched_pages_change: googleAiPeriod.matchedPagesChange,
    matched_citation_events_change: googleAiPeriod.matchedCitationEventsChange,
    appeared_pages: googleAiPeriod.appearedPages,
    disappeared_pages: googleAiPeriod.disappearedPages,
    baseline_incomplete_answer_lists: googleAiPeriod.baselineIncompleteCitationListObservations,
    current_incomplete_answer_lists: googleAiPeriod.currentIncompleteCitationListObservations,
    answer_citation_page_detail_truncated: Boolean(googleAiPeriod.baselineAnswerCitationPagesTruncated || googleAiPeriod.currentAnswerCitationPagesTruncated),
  } : googleAiCurrent ? {
    baseline_comparison_available: false,
    surface: googleAiCurrent.googleAiSurface,
    baseline_unique_pages: null,
    current_unique_pages: googleAiCurrent.googleAiUniquePages,
    matched_pages_change: null,
    matched_citation_events_change: null,
    appeared_pages: null,
    disappeared_pages: null,
    baseline_incomplete_answer_lists: null,
    current_incomplete_answer_lists: googleAiCurrent.answerIncompleteCitationListObservations,
    answer_citation_page_detail_truncated: googleAiCurrent.answerCitationPagesTruncated === true,
  } : null,
  robots_access_comparison: robotsReplay ? {
    audited_urls: robotsReplay.uniqueAuditUrls,
    urls_evaluated_on_origin: robotsReplay.pagesOnOrigin,
    urls_skipped: robotsReplay.pagesSkipped,
    unavailable_audit_pages: robotsReplay.auditPagesUnavailable,
    baseline_comparison_available: Boolean(robotsComparison),
    compared_url_token_pairs: robotsComparison?.urlTokenPairsCompared ?? null,
    newly_blocked_url_token_pairs: robotsComparison?.urlTokenPairsNewlyBlocked ?? null,
    newly_allowed_url_token_pairs: robotsComparison?.urlTokenPairsNewlyAllowed ?? null,
    incomplete_coverage: robotsComparison ? robotsIncomplete : null,
  } : null,
  category_prompt_jsd_gate: categoryJsdGate ? {
    threshold_bits: categoryJsdGate.thresholdBits,
    minimum_comparable_prompt_groups: categoryJsdGate.minimumComparablePromptGroups,
    comparable_prompt_groups: categoryJsdGate.comparablePromptGroups,
    confidence_interval_complete: categoryJsdGate.complete,
    lower_bound_bits: categoryJsdGate.promptBalancedJsdCi95LowerBits,
    exceeded: categoryJsdGate.exceeded,
    passed: categoryJsdGate.complete === true && categoryJsdGate.exceeded === false,
  } : null,
  citation_repeatability_gate: repeatabilityGate ? {
    status: repeatabilityGate.status,
    rule_count: repeatabilityGate.ruleCount,
    failed_rules: repeatabilityGate.rules.filter((rule) => rule.status === 'failed').length,
    inconclusive_rules: repeatabilityGate.rules.filter((rule) => rule.status === 'inconclusive').length,
    sign_test_family_state: repeatabilityGate.method.signTestFamily.state,
    sign_test_family_size: repeatabilityGate.method.signTestFamily.familySize,
  } : null,
  panel_comparability: panelReport ? {
    matched_contexts: panelReport.summary.matched_contexts,
    low_support_contexts: panelReport.summary.low_support_contexts,
    minimum_matched_prompts: panelReport.method.warningThresholds.minimumMatchedPrompts,
    duplicate_observation_rows_baseline: panelReport.inputs.baseline.duplicateObservationRows,
    duplicate_observation_rows_current: panelReport.inputs.current.duplicateObservationRows,
    total_contexts: panelReport.summary.union_contexts,
    matched_prompt_groups: panelReport.summary.matched_prompt_groups,
    prompt_group_jaccard_pct: panelReport.summary.prompt_group_jaccard_pct,
    max_context_observation_share_shift_pp: panelReport.summary.max_context_observation_share_shift_pp,
    context_mix_total_variation_pp: panelReport.summary.context_mix_total_variation_pp,
    prompt_mix_total_variation_pp: panelReport.summary.prompt_mix_total_variation_pp,
    maximum_capture_window_gap_days: panelReport.summary.maximum_capture_window_gap_days,
    maximum_internal_capture_gap_days: panelReport.summary.maximum_internal_capture_gap_days,
    capture_timeline_rows: panelReport.summary.capture_timeline_rows,
    baseline_effective_prompt_sample_size: panelReport.summary.baseline_effective_prompt_sample_size,
    current_effective_prompt_sample_size: panelReport.summary.current_effective_prompt_sample_size,
    baseline_capture_redundancy_factor: panelReport.summary.baseline_capture_redundancy_factor,
    current_capture_redundancy_factor: panelReport.summary.current_capture_redundancy_factor,
    baseline_largest_prompt_capture_share_pct: panelReport.summary.baseline_largest_prompt_capture_share_pct,
    current_largest_prompt_capture_share_pct: panelReport.summary.current_largest_prompt_capture_share_pct,
    warning_gate_enabled: panelReport.warningGate.enabled,
    warning_gate_status: panelReport.warningGate.status,
    warnings: panelReport.summary.warnings,
    warning_codes: (panelReport.warningDetails ?? []).map((detail) => detail.code),
    failed_warning_codes: panelReport.warningGate.failedCodes ?? [],
  } : null,
  release_gate_failures: [
    ...(categoryJsdGate && (categoryJsdGate.complete !== true || categoryJsdGate.exceeded === true) ? ['source-category-prompt-jsd'] : []),
    ...(robotsReplay && process.env.GEO_ROBOTS_FAIL_ON_NEWLY_BLOCKED === '1' && Number(robotsComparison?.urlTokenPairsNewlyBlocked) > 0
      ? ['newly-blocked-robots-pairs'] : []),
    ...(robotsReplay && process.env.GEO_ROBOTS_FAIL_ON_NEWLY_BLOCKED === '1' && robotsIncomplete
      ? ['robots-comparison-incomplete'] : []),
    ...(repeatabilityGate && repeatabilityGate.status !== 'passed' ? ['citation-repeatability-regression'] : []),
    ...(panelReport.warningGate.enabled && panelReport.warningGate.status === 'failed' ? ['panel-comparability-warning'] : []),
  ],
  interpretation: 'Aggregates retained counts from the linked reports. Comparisons describe supplied samples and are not estimates of engine visibility or causal effects; use each source report for its denominator, uncertainty, and completeness notes.',
};
fs.writeFileSync(path.join(outputDir, 'overview.json'), `${JSON.stringify(overview, null, 2)}\n`);
const escapeOverviewHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const displayValue = (value, suffix = '') => value === null || value === undefined ? 'Not available' : `${value}${suffix}`;
const generatedAt = escapeOverviewHtml(overview.generated_at_utc);
const renderMetrics = (rows) => `<dl>${rows.map(([label, value]) => `<div><dt>${escapeOverviewHtml(label)}</dt><dd>${escapeOverviewHtml(value)}</dd></div>`).join('')}</dl>`;
const renderCard = (id, title, rows, report) => `<section class="card" aria-labelledby="${id}"><h2 id="${id}">${escapeOverviewHtml(title)}</h2>${renderMetrics(rows)}<p><a href="${escapeOverviewHtml(report)}">Open detailed report</a></p></section>`;
const sourceRows = (overview.source_portfolio_by_provider ?? []).map((row) => {
  const interval = (lower, upper) => lower === null || upper === null ? 'Not available' : `${lower}–${upper} bits`;
  return `<tr><th scope="row">${escapeOverviewHtml(row.provider)}</th><td>${escapeOverviewHtml(displayValue(row.shared_exact_prompt_groups))}</td><td>${escapeOverviewHtml(displayValue(row.event_weighted_jsd_bits, ' bits'))}</td><td>${escapeOverviewHtml(displayValue(row.prompt_balanced_mean_jsd_bits, ' bits'))}</td><td>${escapeOverviewHtml(interval(row.prompt_balanced_mean_jsd_ci95_lower, row.prompt_balanced_mean_jsd_ci95_upper))}</td><td>${escapeOverviewHtml(displayValue(row.rank_weighted_jsd_bits, ' bits'))}</td><td>${escapeOverviewHtml(displayValue(row.rank_prompt_balanced_mean_jsd_bits, ' bits'))}</td><td>${escapeOverviewHtml(interval(row.rank_prompt_balanced_ci95_lower, row.rank_prompt_balanced_ci95_upper))}</td><td>${escapeOverviewHtml(row.event_comparison_complete ? 'Complete' : 'Incomplete')}</td><td>${escapeOverviewHtml(row.rank_comparison_complete ? 'Complete' : 'Incomplete')}</td></tr>`;
}).join('');
const gateEnabled = Boolean(overview.category_prompt_jsd_gate || overview.citation_repeatability_gate || overview.panel_comparability?.warning_gate_enabled || process.env.GEO_ROBOTS_FAIL_ON_NEWLY_BLOCKED === '1');
const gateState = overview.release_gate_failures.length ? 'Failed' : gateEnabled ? 'Passed' : 'Not enabled';
const gateCard = renderCard('release-gates', 'Release gates', [
  ['Gate state', gateState],
  ['Failed gates', overview.release_gate_failures.length ? overview.release_gate_failures.join(', ') : 'None'],
  ['Source-category support complete', overview.category_prompt_jsd_gate ? String(overview.category_prompt_jsd_gate.confidence_interval_complete) : 'Not configured'],
  ['Category JSD lower bound / threshold', overview.category_prompt_jsd_gate ? `${displayValue(overview.category_prompt_jsd_gate.lower_bound_bits)} / ${overview.category_prompt_jsd_gate.threshold_bits} bits` : 'Not configured'],
  ['Comparable prompt groups / minimum', overview.category_prompt_jsd_gate ? `${overview.category_prompt_jsd_gate.comparable_prompt_groups} / ${overview.category_prompt_jsd_gate.minimum_comparable_prompt_groups}` : 'Not configured'],
  ['Robots comparison incomplete', overview.robots_access_comparison?.incomplete_coverage === null ? 'No baseline comparison' : overview.robots_access_comparison?.incomplete_coverage === undefined ? 'Not configured' : String(overview.robots_access_comparison.incomplete_coverage)],
  ['Citation repeatability gate', overview.citation_repeatability_gate?.status ?? 'Not configured'],
  ['Failed / inconclusive citation rules', overview.citation_repeatability_gate ? `${overview.citation_repeatability_gate.failed_rules} / ${overview.citation_repeatability_gate.inconclusive_rules}` : 'Not configured'],
  ['Sign-test family', overview.citation_repeatability_gate ? `${overview.citation_repeatability_gate.sign_test_family_state} (${overview.citation_repeatability_gate.sign_test_family_size})` : 'Not configured'],
], 'overview.json');
const sourceCard = overview.source_portfolio_by_provider === null ? '' : `<section class="card" aria-labelledby="source-drift"><h2 id="source-drift">Source portfolio drift by provider</h2><div class="table-wrap"><table><thead><tr><th scope="col">Provider</th><th scope="col">Shared prompts</th><th scope="col">Event JSD</th><th scope="col">Prompt-balanced event JSD</th><th scope="col">Event 95% CI</th><th scope="col">Rank-weighted JSD</th><th scope="col">Prompt-balanced rank JSD</th><th scope="col">Rank 95% CI</th><th scope="col">Event comparison</th><th scope="col">Rank comparison</th></tr></thead><tbody>${sourceRows}</tbody></table></div><p><a href="source-portfolio-drift.html">Open source portfolio dashboard</a></p></section>`;
const googleAiCard = overview.google_ai_page_concordance === null ? '' : renderCard('google-ai-concordance', 'Google AI page concordance', [
  ['Surface', displayValue(overview.google_ai_page_concordance.surface)],
  ['Baseline comparison', overview.google_ai_page_concordance.baseline_comparison_available ? 'Available' : 'Not supplied'],
  ['Unique pages, baseline / current', `${displayValue(overview.google_ai_page_concordance.baseline_unique_pages)} / ${displayValue(overview.google_ai_page_concordance.current_unique_pages)}`],
  ['Appeared / disappeared pages', `${displayValue(overview.google_ai_page_concordance.appeared_pages)} / ${displayValue(overview.google_ai_page_concordance.disappeared_pages)}`],
  ['Matched citation-event change', displayValue(overview.google_ai_page_concordance.matched_citation_events_change)],
  ['Incomplete answer lists, baseline / current', `${displayValue(overview.google_ai_page_concordance.baseline_incomplete_answer_lists)} / ${displayValue(overview.google_ai_page_concordance.current_incomplete_answer_lists)}`],
], overview.google_ai_page_concordance.baseline_comparison_available ? 'google-ai-citation-concordance-period.html' : 'google-ai-citation-concordance.html');
const robotsCard = overview.robots_access_comparison === null ? '' : renderCard('robots-access', 'Robots access replay', [
  ['Audited URLs / on-origin', `${displayValue(overview.robots_access_comparison.audited_urls)} / ${displayValue(overview.robots_access_comparison.urls_evaluated_on_origin)}`],
  ['Baseline comparison', overview.robots_access_comparison.baseline_comparison_available ? 'Available' : 'Not supplied'],
  ['Compared URL/token pairs', displayValue(overview.robots_access_comparison.compared_url_token_pairs)],
  ['Newly blocked / allowed pairs', `${displayValue(overview.robots_access_comparison.newly_blocked_url_token_pairs)} / ${displayValue(overview.robots_access_comparison.newly_allowed_url_token_pairs)}`],
  ['Incomplete coverage', overview.robots_access_comparison.incomplete_coverage === null ? 'No baseline comparison' : displayValue(overview.robots_access_comparison.incomplete_coverage)],
], 'geo-robots-replay.html');
const overviewHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark">
<title>GEO answer review overview</title>
<style>
:root{color-scheme:light dark;font:16px/1.5 system-ui,sans-serif;background:#101820;color:#e8eff4}body{max-width:1040px;margin:40px auto;padding:0 24px}h1{font-size:2rem;text-wrap:balance}h2{font-size:1.2rem;margin-top:0}.lead,.note{color:#b6c4cf}.notice{border-left:3px solid #e3ad57;padding:12px 16px;background:#1d2a33}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px}.card{border:1px solid #394853;border-radius:10px;padding:18px;background:#17232c}.card dl{display:grid;grid-template-columns:minmax(130px,1fr) auto;gap:8px 16px;margin:0}.card dl div{display:contents}.card dt{color:#b6c4cf}.card dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}.card p{margin:18px 0 0}.card a,.back a{color:#80d6c0;text-decoration:underline;text-underline-offset:3px}.card a:focus-visible,.back a:focus-visible{outline:3px solid #f0c878;outline-offset:3px;border-radius:2px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;text-align:left;font-variant-numeric:tabular-nums}th,td{padding:8px;border-bottom:1px solid #394853;white-space:nowrap}.skip-link{position:absolute;left:-9999px;top:8px;background:#f0c878;color:#101820;padding:8px 12px;z-index:1}.skip-link:focus-visible{left:8px}.back{margin-top:24px}
</style></head><body><a class="skip-link" href="#overview">Skip to overview</a><header><h1 id="overview">GEO answer review overview</h1><p class="lead">A compact view of retained comparisons from the supplied samples.</p><p class="notice">These metrics describe captured answers, page exports, audits, and policy snapshots. They do not estimate engine visibility or establish causation. Review completeness and uncertainty in each detailed report.</p></header>
<main><p class="lead">Generated at <time datetime="${generatedAt}">${generatedAt}</time></p><div class="cards">
${renderCard('answer-domain-reach', 'Answer domain reach', [
  ['Provider/domain rows', displayValue(overview.answer_domain_reach?.provider_domain_comparison_rows)],
  ['Comparable prompt groups across rows', displayValue(overview.answer_domain_reach?.comparable_prompt_groups_across_rows)],
  ['Rows with gains / losses', `${displayValue(overview.answer_domain_reach?.gained_domain_prompt_rows)} / ${displayValue(overview.answer_domain_reach?.lost_domain_prompt_rows)}`],
  ['All rows complete', displayValue(overview.answer_domain_reach?.all_rows_comparison_complete)],
], 'domain-paired-reach.csv')}
${renderCard('owned-page-reach', 'Owned-page reach', [
  ['Unique owned pages', displayValue(overview.owned_page_reach?.unique_owned_pages)],
  ['Page/provider rows with prompt gains', displayValue(overview.owned_page_reach?.rows_with_prompt_gains)],
  ['Page/provider rows with prompt losses', displayValue(overview.owned_page_reach?.rows_with_prompt_losses)],
  ['All rows complete', displayValue(overview.owned_page_reach?.all_rows_comparison_complete)],
], 'owned-page-paired-reach.csv')}
${renderCard('panel-comparability', 'Capture panel comparability', [
  ['Matched contexts / total', `${displayValue(overview.panel_comparability?.matched_contexts)} / ${displayValue(overview.panel_comparability?.total_contexts)}`],
  [`Matched contexts under ${displayValue(overview.panel_comparability?.minimum_matched_prompts)} prompts`, displayValue(overview.panel_comparability?.low_support_contexts)],
  ['Exact duplicate rows (baseline / current)', `${displayValue(overview.panel_comparability?.duplicate_observation_rows_baseline)} / ${displayValue(overview.panel_comparability?.duplicate_observation_rows_current)}`],
  ['Exact-prompt Jaccard', displayValue(overview.panel_comparability?.prompt_group_jaccard_pct, '%')],
  ['Largest context-share shift', displayValue(overview.panel_comparability?.max_context_observation_share_shift_pp, ' pp')],
  ['Context mix total variation', displayValue(overview.panel_comparability?.context_mix_total_variation_pp, ' pp')],
  ['Unique prompt mix total variation', displayValue(overview.panel_comparability?.prompt_mix_total_variation_pp, ' pp')],
  ['Largest period gap', displayValue(overview.panel_comparability?.maximum_capture_window_gap_days, ' days')],
  ['Largest within-panel capture gap', displayValue(overview.panel_comparability?.maximum_internal_capture_gap_days, ' days')],
  ['Capture timeline rows', displayValue(overview.panel_comparability?.capture_timeline_rows)],
  ['Effective prompt sample size', `${displayValue(overview.panel_comparability?.baseline_effective_prompt_sample_size)} → ${displayValue(overview.panel_comparability?.current_effective_prompt_sample_size)}`],
  ['Capture redundancy factor', `${displayValue(overview.panel_comparability?.baseline_capture_redundancy_factor)} → ${displayValue(overview.panel_comparability?.current_capture_redundancy_factor)}`],
  ['Largest prompt share', `${displayValue(overview.panel_comparability?.baseline_largest_prompt_capture_share_pct, '%')} → ${displayValue(overview.panel_comparability?.current_largest_prompt_capture_share_pct, '%')}`],
  ['Panel warning gate', overview.panel_comparability?.warning_gate_status ?? 'Not configured'],
  ['Gate failed codes', overview.panel_comparability?.failed_warning_codes?.join(', ') || 'none'],
  ['Warning codes', overview.panel_comparability?.warning_codes?.join(', ') || 'none'],
  ['Review warnings', displayValue(overview.panel_comparability?.warnings?.length)],
], 'panel-comparability.html')}
${googleAiCard}${robotsCard}
${gateCard}${sourceCard}</div><p class="back"><a href="index.html">Back to all reports</a> · <a href="overview.json">Download overview data</a></p></main></body></html>\n`;
fs.writeFileSync(path.join(outputDir, 'overview.html'), overviewHtml);
const generatedPaths = [
  'README.md',
  'overview.json',
  'overview.html',
  'index.html',
  'answer-comparison.csv',
  'domain-paired-reach.csv',
  'domain-paired-reach.json',
  'owned-page-paired-reach.csv',
  'owned-page-paired-reach.json',
  'current-page-opportunities.csv',
  'baseline-citation-repeatability.csv',
  'baseline-citation-repeatability.json',
  'baseline-citation-repeatability.html',
  'baseline-citation-repeatability-prompts.csv',
  'current-citation-repeatability.csv',
  'current-citation-repeatability.json',
  'current-citation-repeatability.html',
  'current-citation-repeatability-prompts.csv',
  'citation-repeatability-change.csv',
  'citation-repeatability-change.json',
  'citation-repeatability-change.html',
  'panel-comparability.json',
  'panel-comparability.contexts.csv',
  'panel-comparability.prompts.csv',
  'panel-comparability.timeline.csv',
  'panel-comparability.dimensions.csv',
  'panel-comparability.warnings.csv',
  'panel-comparability.html',
  ...(process.env.GEO_PANEL_COMPARABILITY_THRESHOLDS_FILE ? ['panel-comparability-thresholds.json'] : []),
  'source-portfolio-drift.csv',
  'source-portfolio-drift.json',
  'source-portfolio-drift.html',
  'source-network-drift.csv',
  'rank-weighted-source-network-drift.csv',
  'source-network-drift.html',
  'source-rarefaction.csv',
  'source-diversity-uncertainty.html',
  'source-diversity-comparison.csv',
  'source-diversity-comparison.html',
  'provider-source-divergence.csv',
  'provider-source-network-overlap.csv',
  'provider-network-edge-drift.csv',
  'provider-network-edge-drift.html',
  'prompt-family-sensitivity.html',
];
if (includesCrawlerReview) generatedPaths.push(
  'crawler-path-families.csv',
  'crawler-path-families.json',
  'crawler-path-families.html',
  'crawler-path-audit.csv',
  'crawler-path-audit.json',
  'crawler-path-audit.html',
  'crawler-report.json',
  'crawler-report.html',
  'owned-page-provider-inventory.csv',
  'owned-page-provider-inventory.html',
);
if (process.argv[4] === 'with-crawler-baseline') generatedPaths.push(
  'baseline-crawler-report.json',
  'crawler-path-period.csv',
  'crawler-path-period.json',
  'crawler-path-period.html',
  'crawler-audit-period.csv',
  'crawler-audit-period.json',
  'crawler-audit-period.html',
);
if (includesCategories) generatedPaths.push('source-category-mix.csv', 'source-category-mix.html', 'source-category-path-families.csv', 'source-category-path-family-period.csv', 'source-category-concentration-trends.csv', 'source-category-concentration-trends.html');
if (process.env.GEO_ANSWER_SOURCE_CATEGORY_PROMPT_BALANCED_JSD_MAX) generatedPaths.push('source-category-prompt-jsd-gate.json');
if (includesAuditBaseline) generatedPaths.push(
  'owned-page-provider-inventory-period.csv',
  'owned-page-provider-inventory-period.html',
  'owned-page-provider-inventory-period.json',
);
if (includesGoogleAiExport) generatedPaths.push(
  'google-ai-citation-concordance.csv',
  'google-ai-citation-concordance.json',
  'google-ai-citation-concordance.html',
  'google-ai-citation-providers.csv',
  'google-ai-citation-path-families.csv',
  'google-ai-citation-path-depth-sweep.csv',
);
if (includesGoogleAiBaseline) generatedPaths.push(
  'google-ai-citation-concordance-baseline.json',
  'google-ai-citation-concordance-period.csv',
  'google-ai-citation-concordance-period.json',
  'google-ai-citation-concordance-period.html',
  'google-ai-citation-providers-period.csv',
);
if (includesRobotsReplay) generatedPaths.push('geo-robots-replay.json', 'geo-robots-replay.html');
if (includesRepeatabilityGate) generatedPaths.push('citation-repeatability-gate-rules.json', 'citation-repeatability-gate.json');
const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const links = generatedPaths.filter((file) => file !== 'index.html').map((file) => {
  const label = file.replace(/\.(csv|json|html|md)$/, '').replace(/[-_]+/g, ' ');
  const download = /\.(csv|json|md)$/.test(file) ? ' download' : '';
  return `<li><a href="${escapeHtml(file)}"${download}>${escapeHtml(label)}</a><span>${escapeHtml(path.extname(file).slice(1).toUpperCase())}</span></li>`;
}).join('\n');
fs.writeFileSync(path.join(outputDir, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>GEO answer review bundle</title>
<style>
:root{color-scheme:light dark;font:16px/1.5 system-ui,sans-serif;background:#101820;color:#e8eff4}body{max-width:920px;margin:48px auto;padding:0 24px}h1{font-size:2rem;text-wrap:balance}p{color:#b6c4cf}.notice{border-left:3px solid #e3ad57;padding:12px 16px;background:#1d2a33}ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:10px}li{display:flex;justify-content:space-between;gap:16px;border:1px solid #394853;border-radius:8px;padding:14px}a{color:#80d6c0;text-decoration:none;text-transform:capitalize;touch-action:manipulation;-webkit-tap-highlight-color:rgba(128,214,192,.25)}a:hover{text-decoration:underline}a:focus-visible{outline:3px solid #f0c878;outline-offset:3px;border-radius:2px}.skip-link{position:absolute;left:-9999px;top:8px;background:#f0c878;color:#101820;padding:8px 12px;z-index:1}.skip-link:focus-visible{left:8px}span{font-size:.78rem;color:#9caeb9}label{display:block;margin:0 0 6px;font-weight:600}input[type=search]{box-sizing:border-box;width:100%;max-width:440px;margin:0 0 18px;padding:10px 12px;border:1px solid #647582;border-radius:6px;background:#1d2a33;color:#e8eff4;font:inherit}input[type=search]:focus-visible{outline:3px solid #f0c878;outline-offset:2px}li[hidden]{display:none}
</style></head>
<body><a class="skip-link" href="#reports">Skip to reports</a><header><h1>GEO answer review</h1><p>Offline report bundle. Open a dashboard or download an analysis artifact below.</p><p class="notice">These comparisons describe the supplied samples. They do not estimate engine visibility or establish causation. Check each report's support, completeness, and uncertainty notes.</p></header><main><h2 id="reports">Reports</h2><label for="report-filter">Filter reports</label><input id="report-filter" type="search" placeholder="Search report names" autocomplete="off"><nav aria-label="GEO review artifacts"><ul>
${links}<li><a href="manifest.json">manifest</a><span>JSON</span></li>
</ul></nav></main><script>document.querySelector("#report-filter").addEventListener("input",event=>{const query=event.currentTarget.value.trim().toLowerCase();document.querySelectorAll("nav li").forEach(item=>{item.hidden=!item.textContent.toLowerCase().includes(query)});});</script></body></html>\n`);
const files = generatedPaths.map((relativePath) => {
    if (!fs.statSync(path.join(outputDir, relativePath)).isFile()) {
      throw new Error(`Expected bundle artifact is not a file: ${relativePath}`);
    }
    const content = fs.readFileSync(path.join(outputDir, relativePath));
    const extension = path.extname(relativePath);
    const mediaType = extension === '.html' ? 'text/html'
      : extension === '.json' ? 'application/json'
        : extension === '.csv' ? 'text/csv'
          : 'text/markdown';
    return {
      path: relativePath,
      media_type: mediaType,
      size_bytes: content.length,
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
    };
  }).sort((left, right) => left.path.localeCompare(right.path));

fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify({
  artifact_type: 'geo-answer-review-bundle',
  schema_version: 1,
  generated_at_utc: new Date().toISOString(),
  files,
}, null, 2)}\n`);
NODE

printf 'GEO answer review bundle written to %s\n' "$output_dir"
if [[ $robots_gate_status -ne 0 || $category_gate_status -ne 0 || $repeatability_gate_status -ne 0 || $panel_gate_status -ne 0 ]]; then
  printf 'A GEO release gate failed; review the decision reports in %s.\n' "$output_dir" >&2
  exit 1
fi
