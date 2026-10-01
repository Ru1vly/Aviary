#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${1:-}" == "--" ]]; then shift; fi
output_dir="${1:-reports/geo-toolbox}"
mkdir -p "$output_dir"

bash "$repo_root/examples/geo-prompt-family-sensitivity.sh" \
  "$repo_root/examples/geo-answer-observations.example.json" "$output_dir/prompt-families"
bash "$repo_root/examples/geo-prompt-panel-plan.sh" \
  "$repo_root/examples/geo-answer-observations.example.json" "$output_dir/prompt-plan"
bash "$repo_root/examples/geo-page-opportunities.sh" "$output_dir/page-opportunities"
bash "$repo_root/examples/geo-page-opportunity-trends.sh" "$output_dir/page-opportunity-trends"
bash "$repo_root/examples/geo-source-category-monthly-turnover.sh" \
  "$repo_root/examples/geo-source-category-monthly-turnover.synthetic.example.json" "$output_dir/category-turnover"
bash "$repo_root/examples/geo-source-category-hhi-alert.sh" "$output_dir/category-hhi-alert"
bash "$repo_root/examples/geo-source-portfolio-attribution.sh" \
  "$repo_root/examples/geo-source-portfolio-current.synthetic.example.json" \
  "$repo_root/examples/geo-source-portfolio-baseline.synthetic.example.json" "$output_dir/source-portfolio"
bash "$repo_root/examples/geo-google-ai-citation-concordance.sh" "$output_dir/google-ai-concordance"
bash "$repo_root/examples/geo-entity-prompt-matched-association.sh" "$output_dir/entity-association/association.csv"
bash "$repo_root/examples/geo-crawler-route-family-review.synthetic.sh" "$output_dir/crawler-route-review"

cat > "$output_dir/index.html" <<'HTML'
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aviary GEO toolbox</title>
<style>
  :root { color-scheme: light; font: 16px/1.55 system-ui, sans-serif; color: #17212b; background: #f3f6f7; }
  body { max-width: 1040px; margin: 48px auto; padding: 0 20px; }
  main { background: white; border: 1px solid #dce4e7; border-radius: 16px; padding: 28px; }
  h1 { margin-top: 0; font-size: 1.65rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; padding: 0; list-style: none; }
  .grid li { border: 1px solid #dce4e7; border-radius: 12px; padding: 16px; }
  a { color: #075d55; font-weight: 650; }
  .group { color: #53636b; font-size: .78rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .grid p { margin: 8px 0 0; color: #46545c; }
  .note { border-left: 3px solid #e3a62f; padding-left: 14px; color: #46545c; }
</style>
<main>
  <h1>Aviary GEO toolbox</h1>
  <p>Ten offline GEO workflows. Choose by the question you need to answer; each report is generated from the synthetic sample data bundled with Aviary.</p>
  <ul class="grid">
    <li><span class="group">Sampling</span><br><a href="prompt-families/index.html">Prompt-family sensitivity</a><p>See whether source findings depend on one prompt family, category mapping, or cutoff.</p></li>
    <li><span class="group">Sampling</span><br><a href="prompt-plan/index.html">Provider/cohort prompt-panel plan</a><p>Plan a balanced panel against reach, pairwise overlap, and sampling-budget targets.</p></li>
    <li><span class="group">Content</span><br><a href="page-opportunities/page-opportunity-depth-sensitivity.html">Owned-page opportunity depth</a><p>Find owned pages and path families that appear in citation observations.</p></li>
    <li><span class="group">Content</span><br><a href="page-opportunity-trends/monthly-page-opportunity-path-families.html">Monthly owned-page trends</a><p>Track page and path-family opportunities across paired monthly snapshots.</p></li>
    <li><span class="group">Sources</span><br><a href="category-turnover/monthly-category-shares.html">Source-category turnover</a><p>Review which source categories gain or lose observed citation share over time.</p></li>
    <li><span class="group">Sources</span><br><a href="category-hhi-alert/monthly-category-trends.html">Source-category concentration</a><p>Flag when cited share concentrates in fewer mapped source categories.</p></li>
    <li><span class="group">Sources</span><br><a href="source-portfolio/drift.html">Source-portfolio drift</a><p>Attribute changes in the cited source portfolio between two snapshots.</p></li>
    <li><span class="group">Cross-surface</span><br><a href="google-ai-concordance/concordance.html">Google AI page/citation concordance</a><p>Compare audited owned-page evidence with captured Google AI citations.</p></li>
    <li><span class="group">Cross-surface</span><br><a href="entity-association/association.html">Entity prompt association</a><p>Compare entity mention and citation outcomes for matched prompts.</p></li>
    <li><span class="group">Crawling</span><br><a href="crawler-route-review/path-audit.html">Crawler route and audit review</a><p>Compare crawler route observations with saved crawl-access and page audit signals.</p></li>
  </ul>
  <p class="note">All inputs are synthetic. The reports demonstrate descriptive sample diagnostics and do not predict rankings, citation probability, or causal effects.</p>
</main>
</html>
HTML
