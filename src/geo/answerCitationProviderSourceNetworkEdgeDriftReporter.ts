import type { AiAnswerCitationObservationReport } from './answerCitationObservations';
import { renderAiAnswerCitationProviderSourceNetworkEdgeDriftCsv } from './answerCitationProviderSourceNetworkEdgeDrift';

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/u, ''));
      if (row.some((value) => value.length > 0)) records.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/u, ''));
    records.push(row);
  }
  return records;
}

function reportRows(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): { rows: Array<Record<string, string>>; summary: Record<string, string> } {
  const records = parseCsvRecords(
    renderAiAnswerCitationProviderSourceNetworkEdgeDriftCsv(current, baseline)
  );
  const headers = records[0] ?? [];
  const parsed = records
    .slice(1)
    .map((record) =>
      Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']))
    );
  const summary = parsed.find((row) => row.row_type === 'summary') ?? {};
  const rows = parsed
    .filter((row) => row.row_type === 'provider-edge-drift')
    .map((row) => ({
      provider_a: row.provider_a ?? '',
      provider_b: row.provider_b ?? '',
      baseline_analyzed_at: row.baseline_analyzed_at ?? '',
      current_analyzed_at: row.current_analyzed_at ?? '',
      domain_a: row.domain_a ?? '',
      domain_b: row.domain_b ?? '',
      edge_union_support_prompts: row.edge_union_support_prompts ?? '',
      shared_exact_prompt_groups: row.shared_exact_prompt_groups ?? '',
      unmatched_exact_prompt_groups: row.unmatched_exact_prompt_groups ?? '',
      comparable_complete_source_prompt_groups: row.comparable_complete_source_prompt_groups ?? '',
      unknown_source_detail_prompt_groups: row.unknown_source_detail_prompt_groups ?? '',
      baseline_provider_a_edge_prompt_share: row.baseline_provider_a_edge_prompt_share ?? '',
      baseline_provider_b_edge_prompt_share: row.baseline_provider_b_edge_prompt_share ?? '',
      baseline_provider_b_minus_a_edge_prompt_share:
        row.baseline_provider_b_minus_a_edge_prompt_share ?? '',
      current_provider_a_edge_prompt_share: row.current_provider_a_edge_prompt_share ?? '',
      current_provider_b_edge_prompt_share: row.current_provider_b_edge_prompt_share ?? '',
      current_provider_b_minus_a_edge_prompt_share:
        row.current_provider_b_minus_a_edge_prompt_share ?? '',
      provider_gap_difference_in_differences: row.provider_gap_difference_in_differences ?? '',
      difference_in_differences_lower_95: row.difference_in_differences_lower_95 ?? '',
      difference_in_differences_upper_95: row.difference_in_differences_upper_95 ?? '',
      difference_in_differences_leave_one_prompt_out_min:
        row.difference_in_differences_leave_one_prompt_out_min ?? '',
      difference_in_differences_leave_one_prompt_out_max:
        row.difference_in_differences_leave_one_prompt_out_max ?? '',
      leave_one_prompt_out_max_absolute_shift_percentage_points:
        row.leave_one_prompt_out_max_absolute_shift_percentage_points ?? '',
      difference_in_differences_p_value: row.difference_in_differences_p_value ?? '',
      holm_adjusted_p_value: row.holm_adjusted_p_value ?? '',
      holm_adjustment_status: row.holm_adjustment_status ?? '',
      difference_in_differences_test_method: row.difference_in_differences_test_method ?? '',
      provider_catalogs_complete: row.provider_catalogs_complete ?? '',
      source_detail_complete: row.source_detail_complete ?? '',
      comparison_complete: row.comparison_complete ?? '',
    }));
  return { rows, summary };
}

/** Render a searchable offline review page for matched-period provider edge-gap changes. */
export function renderAiAnswerCitationProviderSourceNetworkEdgeDriftHtml(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  const { rows, summary } = reportRows(current, baseline);
  const numeric = (value: string | undefined): number | null => {
    if (value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const payload = {
    rows,
    summary: {
      baselineDate: summary.baseline_analyzed_at ?? '',
      currentDate: summary.current_analyzed_at ?? '',
      baselineProviders: numeric(summary.baseline_unique_providers),
      currentProviders: numeric(summary.current_unique_providers),
      commonProviders: numeric(summary.providers_present_in_both_periods),
      baselineOnlyProviders: numeric(summary.baseline_only_providers),
      currentOnlyProviders: numeric(summary.current_only_providers),
      providerCatalogsMatch: summary.provider_catalogs_match === 'true',
      providerPairsEvaluated: numeric(summary.provider_pairs_evaluated),
      providerPairsOmitted:
        (numeric(summary.provider_pairs_omitted_by_work_budget) ?? 0) +
        (numeric(summary.provider_pairs_omitted_by_candidate_cap) ?? 0) +
        (numeric(summary.provider_pairs_omitted_by_cap) ?? 0),
      unknownSourceGroups: numeric(summary.unknown_source_detail_prompt_groups),
      edgeCatalogComplete: summary.edge_catalog_complete === 'true',
      edgeCandidateCapExceeded: summary.edge_candidate_cap_exceeded === 'true',
      holmStatus: summary.holm_adjustment_status ?? 'unknown',
      holmFamilySize: numeric(summary.holm_family_size),
      outputRowsTruncated: summary.output_rows_truncated === 'true',
    },
  };
  const serialized = JSON.stringify(payload)
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026');
  const document = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Aviary · Provider source-edge drift</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e9eefb;background:#0a0f1b;font-synthesis:none;text-rendering:optimizeLegibility}
    *{box-sizing:border-box}body{margin:0;min-width:320px;background:radial-gradient(ellipse at 13% 0%,#142544 0,transparent 42%),#0a0f1b}
    header{padding:28px clamp(18px,4vw,54px) 22px;border-bottom:1px solid #202b40}.eyebrow{font-size:11px;letter-spacing:.17em;text-transform:uppercase;color:#83a8f4;font-weight:700}h1{font-size:clamp(25px,3vw,40px);letter-spacing:-.04em;margin:7px 0 6px}header p{margin:0;color:#9aa9c2;font-size:14px;line-height:1.55;max-width:1000px}
    main{padding:22px clamp(14px,3vw,42px) 42px;max-width:1700px;margin:auto}.panel{border:1px solid #26334a;background:rgba(14,21,35,.94);border-radius:14px;overflow:hidden;box-shadow:0 18px 50px #0002}.toolbar{display:flex;align-items:end;gap:12px;flex-wrap:wrap;padding:15px;border-bottom:1px solid #26334a}label{display:flex;flex-direction:column;gap:6px;color:#aab7cc;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}select,input{height:38px;min-width:190px;border:1px solid #33415b;border-radius:8px;background:#101a2b;color:#eef3ff;padding:0 11px;font:inherit;letter-spacing:normal;text-transform:none}input[type=search]{min-width:220px}button{height:38px;border:1px solid #405473;border-radius:8px;background:#1b2b45;color:#e9eefb;padding:0 13px;font:inherit;font-weight:650;cursor:pointer}button:hover:not(:disabled){background:#263c5c}button:focus-visible{outline:2px solid #83a8f4;outline-offset:2px}button:disabled{opacity:.48;cursor:not-allowed}.result-count{margin:0 0 2px auto;color:#91a2bd;font-size:12px;font-variant-numeric:tabular-nums}
    .notice{display:none;margin:14px 15px 0;border:1px solid #76592c;border-radius:9px;padding:10px 12px;color:#f5d69a;background:#302513;font-size:12px;line-height:1.45}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;padding:14px 15px}.metric{padding:11px;border:1px solid #263650;border-radius:9px;background:#111c2d}.metric span{display:block;color:#8798b4;font-size:10px;text-transform:uppercase;letter-spacing:.07em}.metric strong{display:block;margin-top:5px;font-variant-numeric:tabular-nums;font-size:16px}.table-scroll{overflow:auto;max-height:72vh}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;font-size:12px}th{position:sticky;top:0;background:#111c2d;color:#9baac2;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;z-index:1}th:first-child,td:first-child{text-align:left}td,th{padding:10px 11px;border-bottom:1px solid #222f45;white-space:nowrap}td{color:#d3ddef;text-align:right}td.domain{font-weight:650;color:#e7efff}.positive{color:#86e1b5!important}.negative{color:#f19f9f!important}.empty{padding:24px;color:#91a2bd;text-align:left}.footer{margin:14px 4px 0;color:#71819b;font-size:11px;line-height:1.6;max-width:1250px}
    @media(max-width:850px){.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.toolbar label{flex:1 1 40%}.result-count{margin:0 0 2px 0}}@media(max-width:520px){header{padding-top:20px}.toolbar label{flex-basis:100%}select,input,input[type=search]{width:100%;min-width:0}.summary{grid-template-columns:1fr 1fr}td,th{padding:8px;font-size:11px}}
  </style>
</head>
<body>
  <header><div class="eyebrow">Aviary GEO · observed answers</div><h1>Provider source-edge drift</h1><p>Track whether provider B’s citation reach gap versus provider A changed between these samples. Every row uses exact prompts with complete source lists in both periods for both providers, giving all four reach rates the same prompt denominator.</p></header>
  <main>
    <section class="panel" aria-label="Matched-period source-edge change">
      <div class="toolbar">
        <label>Provider pair<select id="pair"></select></label>
        <label>Find a domain<input id="search" type="search" placeholder="domain.example"></label>
        <label>Minimum four-cell support<input id="support-filter" type="number" min="2" step="1" value="2"></label>
        <button id="download" type="button" disabled>Download filtered CSV</button>
        <p id="result-count" class="result-count" aria-live="polite"></p>
      </div>
      <div id="notice" class="notice" role="status"></div>
      <div class="summary" id="summary" aria-label="Comparison summary"></div>
      <div class="table-scroll"><table><thead><tr><th scope="col">Co-cited domain pair</th><th scope="col">Four-cell support</th><th scope="col">Matched prompts</th><th scope="col">Baseline A / B</th><th scope="col">Current A / B</th><th scope="col">Baseline gap</th><th scope="col">Current gap</th><th scope="col">Change in gap</th><th scope="col">95% interval</th><th scope="col">Leave-one-out range</th><th scope="col">p</th><th scope="col">Holm p</th><th scope="col">Method</th></tr></thead><tbody id="rows"></tbody></table></div>
    </section>
    <p class="footer">The change in gap is (current B − current A) − (baseline B − baseline A), with each exact prompt group weighted equally. The leave-one-out range shows the minimum and maximum change after removing any one matched prompt. Prompt-level normal intervals and p-values are shown only with at least 30 matched prompts and nonzero interaction variance. Intervals are nominal and not adjusted across edges. Model, surface, locale, or capture context can still shift within exact prompts. Holm results require the complete eligible edge family. These captured observational samples do not establish why a provider gap changed.</p>
  </main>
  <script type="application/json" id="edge-data">__EDGE_DATA__</script>
  <script>
  (()=>{
    const data=JSON.parse(document.getElementById('edge-data').textContent||'{"rows":[],"summary":{}}');
    const pairSelect=document.getElementById('pair'),search=document.getElementById('search'),supportFilter=document.getElementById('support-filter'),body=document.getElementById('rows'),count=document.getElementById('result-count'),notice=document.getElementById('notice'),download=document.getElementById('download');
    const exportHeaders=['provider_a','provider_b','baseline_analyzed_at','current_analyzed_at','domain_a','domain_b','edge_union_support_prompts','shared_exact_prompt_groups','unmatched_exact_prompt_groups','comparable_complete_source_prompt_groups','unknown_source_detail_prompt_groups','baseline_provider_a_edge_prompt_share','baseline_provider_b_edge_prompt_share','baseline_provider_b_minus_a_edge_prompt_share','current_provider_a_edge_prompt_share','current_provider_b_edge_prompt_share','current_provider_b_minus_a_edge_prompt_share','provider_gap_difference_in_differences','difference_in_differences_lower_95','difference_in_differences_upper_95','difference_in_differences_leave_one_prompt_out_min','difference_in_differences_leave_one_prompt_out_max','leave_one_prompt_out_max_absolute_shift_percentage_points','difference_in_differences_p_value','holm_adjusted_p_value','holm_adjustment_status','difference_in_differences_test_method','provider_catalogs_complete','source_detail_complete','comparison_complete'];
    let lastFiltered=[];
    const csvCell=value=>{const text=String(value??''),trimmed=text.trimStart(),numeric=text.trim()!==''&&Number.isFinite(Number(text)),safe=!numeric&&/^[=+\-@]/u.test(trimmed)?'\''+text:text;return '"'+safe.replace(/"/gu,'""')+'"'};
    const number=value=>{if(value===null||value===undefined||value==='')return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null};
    const fmt=value=>{const parsed=number(value);return parsed===null?'—':Math.round(parsed).toLocaleString()};
    const pct=value=>{const parsed=number(value);return parsed===null?'—':(parsed*100).toFixed(1)+'%'};
    const pp=value=>{const parsed=number(value);return parsed===null?'—':(parsed>0?'+':'')+(parsed*100).toFixed(1)+' pp'};
    const probability=value=>{const parsed=number(value);return parsed===null?'—':parsed===0?'0':parsed<.001?parsed.toExponential(2):parsed.toFixed(3)};
    const pairKey=row=>JSON.stringify([row.provider_a,row.provider_b]);
    const pairs=[...new Map(data.rows.map(row=>[pairKey(row),[row.provider_a,row.provider_b]])).entries()].sort((a,b)=>a[1][0].localeCompare(b[1][0])||a[1][1].localeCompare(b[1][1]));
    for(const [key,names] of pairs){const option=document.createElement('option');option.value=key;option.textContent=names[0]+'  vs  '+names[1];pairSelect.append(option)}
    const metric=(label,value)=>{const card=document.createElement('div'),title=document.createElement('span'),content=document.createElement('strong');card.className='metric';title.textContent=label;content.textContent=value;card.append(title,content);return card};
    const summary=data.summary||{},summaryPanel=document.getElementById('summary');
    summaryPanel.append(metric('Baseline sample',summary.baselineDate||'—'),metric('Current sample',summary.currentDate||'—'),metric('Provider pairs',fmt(summary.providerPairsEvaluated)),metric('Holm status',summary.holmStatus||'—'));
    const warning=[];
    if(!summary.providerCatalogsMatch)warning.push(fmt(summary.baselineOnlyProviders)+' baseline-only and '+fmt(summary.currentOnlyProviders)+' current-only providers are excluded from matched pairs.');
    if(!summary.edgeCatalogComplete)warning.push('The retained provider/edge family is incomplete; Holm-adjusted p-values are withheld.');
    if(summary.unknownSourceGroups)warning.push(fmt(summary.unknownSourceGroups)+' four-cell prompt groups had unknown source detail and were excluded.');
    if(summary.providerPairsOmitted)warning.push(fmt(summary.providerPairsOmitted)+' provider pairs were omitted by a scan cap.');
    if(summary.outputRowsTruncated)warning.push('The row cap omitted lower-ranked edge comparisons.');
    if(warning.length){notice.textContent=warning.join(' ');notice.style.display='block'}
    function refresh(){
      body.replaceChildren();
      const selected=pairSelect.value,query=search.value.trim().toLowerCase(),minimum=Math.max(2,Number(supportFilter.value)||2);
      const filtered=data.rows.filter(row=>pairKey(row)===selected&&number(row.edge_union_support_prompts)>=minimum&&(!query||(row.domain_a+' '+row.domain_b).toLowerCase().includes(query)));
      lastFiltered=filtered;download.disabled=filtered.length===0;
      count.textContent=filtered.length.toLocaleString()+' edge change(s)';
        if(!filtered.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=13;cell.className='empty';cell.textContent=pairs.length?'No edges match this provider pair and filter.':'No retained provider edge comparisons are available.';row.append(cell);body.append(row);return}
      for(const item of filtered){
        const row=document.createElement('tr'),domain=document.createElement('td');domain.className='domain';domain.textContent=item.domain_a+'  ×  '+item.domain_b;row.append(domain);
        const ci=number(item.difference_in_differences_lower_95)===null||number(item.difference_in_differences_upper_95)===null?'—':pp(item.difference_in_differences_lower_95)+' to '+pp(item.difference_in_differences_upper_95);
        const leaveOneOut=number(item.difference_in_differences_leave_one_prompt_out_min)===null||number(item.difference_in_differences_leave_one_prompt_out_max)===null?'—':pp(item.difference_in_differences_leave_one_prompt_out_min)+' to '+pp(item.difference_in_differences_leave_one_prompt_out_max);
        const gap=pp(item.provider_gap_difference_in_differences),gapCell=document.createElement('td');gapCell.textContent=gap;gapCell.className=number(item.provider_gap_difference_in_differences)>0?'positive':number(item.provider_gap_difference_in_differences)<0?'negative':'';
        const values=[fmt(item.edge_union_support_prompts),fmt(item.comparable_complete_source_prompt_groups),pct(item.baseline_provider_a_edge_prompt_share)+' / '+pct(item.baseline_provider_b_edge_prompt_share),pct(item.current_provider_a_edge_prompt_share)+' / '+pct(item.current_provider_b_edge_prompt_share),pp(item.baseline_provider_b_minus_a_edge_prompt_share),pp(item.current_provider_b_minus_a_edge_prompt_share),null,ci,null,probability(item.difference_in_differences_p_value),probability(item.holm_adjusted_p_value),item.difference_in_differences_test_method||'—'];
        for(let index=0;index<values.length;index++){if(index===6){row.append(gapCell);continue}const cell=document.createElement('td');cell.textContent=index===8?leaveOneOut:values[index];row.append(cell)}
        body.append(row);
      }
    }
    download.addEventListener('click',()=>{if(!lastFiltered.length)return;const csv=[exportHeaders,...lastFiltered.map(row=>exportHeaders.map(header=>row[header]??''))].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n',url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download='provider-source-network-edge-drift-filtered.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),0)});
    pairSelect.addEventListener('change',refresh);search.addEventListener('input',refresh);supportFilter.addEventListener('input',refresh);refresh();
  })();
  </script>
</body>
</html>`;
  return document.replace('__EDGE_DATA__', serialized);
}
