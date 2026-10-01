import type { AiAnswerCitationObservationReport } from './answerCitationObservations';
import { renderAiAnswerCitationProviderSourceNetworkEdgeComparisonCsv } from './answerCitationProviderSourceNetworkOverlap';

function parseCsvRecords(csv: string): string[][] {
  const rows: string[][] = [];
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
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/u, ''));
    rows.push(row);
  }
  return rows;
}

function numeric(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function csvData(report: AiAnswerCitationObservationReport): {
  rows: Array<Record<string, string>>;
  summary: Record<string, string>;
} {
  const records = parseCsvRecords(
    renderAiAnswerCitationProviderSourceNetworkEdgeComparisonCsv(report)
  );
  const headers = records[0] ?? [];
  const parsed = records
    .slice(1)
    .map((record) =>
      Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']))
    );
  const summary = parsed.find((row) => row.row_type === 'summary') ?? {};
  const rows = parsed
    .filter((row) => row.row_type === 'provider-edge-pair')
    .map((row) => ({
      provider_a: row.provider_a ?? '',
      provider_b: row.provider_b ?? '',
      domain_a: row.domain_a ?? '',
      domain_b: row.domain_b ?? '',
      shared_exact_prompt_groups: row.shared_exact_prompt_groups ?? '',
      comparable_complete_source_prompt_groups: row.comparable_complete_source_prompt_groups ?? '',
      unknown_source_detail_prompt_groups: row.unknown_source_detail_prompt_groups ?? '',
      provider_a_only_edge_prompts: row.provider_a_only_edge_prompts ?? '',
      provider_b_only_edge_prompts: row.provider_b_only_edge_prompts ?? '',
      both_edge_prompts: row.both_edge_prompts ?? '',
      neither_edge_prompts: row.neither_edge_prompts ?? '',
      provider_a_edge_prompt_share: row.provider_a_edge_prompt_share ?? '',
      provider_b_edge_prompt_share: row.provider_b_edge_prompt_share ?? '',
      provider_b_minus_a_edge_prompt_share: row.provider_b_minus_a_edge_prompt_share ?? '',
      provider_b_minus_a_lower_95: row.provider_b_minus_a_lower_95 ?? '',
      provider_b_minus_a_upper_95: row.provider_b_minus_a_upper_95 ?? '',
      provider_b_minus_a_leave_one_prompt_out_min:
        row.provider_b_minus_a_leave_one_prompt_out_min ?? '',
      provider_b_minus_a_leave_one_prompt_out_max:
        row.provider_b_minus_a_leave_one_prompt_out_max ?? '',
      leave_one_prompt_out_max_absolute_shift: row.leave_one_prompt_out_max_absolute_shift ?? '',
      paired_mcnemar_p_value: row.paired_mcnemar_p_value ?? '',
      paired_test_method: row.paired_test_method ?? '',
      paired_holm_adjusted_mcnemar_p_value: row.paired_holm_adjusted_mcnemar_p_value ?? '',
      holm_adjustment_status: row.holm_adjustment_status ?? '',
    }));
  return { rows, summary };
}

/** Render a searchable offline review table for matched provider source-edge comparisons. */
export function renderAiAnswerCitationProviderSourceNetworkEdgeHtml(
  report: AiAnswerCitationObservationReport
): string {
  const { rows, summary } = csvData(report);
  const payload = {
    rows,
    summary: {
      providerPairsEvaluated: numeric(summary.provider_pairs_evaluated),
      providerPairsOmittedByWork: numeric(summary.provider_pairs_omitted_by_work_budget),
      providerPairsOmittedByCandidateCap: numeric(summary.provider_pairs_omitted_by_candidate_cap),
      providerPairsOmittedByCap: numeric(summary.provider_pairs_omitted_by_cap),
      unknownSourcePromptGroups: numeric(summary.unknown_source_detail_prompt_groups),
      edgeCandidates: numeric(summary.provider_edge_candidates_evaluated),
      edgeCatalogComplete: summary.provider_edge_catalog_complete === 'true',
      edgeCandidateCapExceeded: summary.edge_candidate_cap_exceeded === 'true',
      holmStatus: summary.holm_adjustment_status ?? 'unknown',
      holmFamilySize: numeric(summary.holm_family_size),
      outputRowsAvailable: numeric(summary.output_rows_available),
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
  <title>Aviary · Provider citation edge comparison</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e9eefb;background:#0a0f1b;font-synthesis:none;text-rendering:optimizeLegibility}
    *{box-sizing:border-box}body{margin:0;min-width:320px;background:radial-gradient(ellipse at 13% 0%,#142544 0,transparent 42%),#0a0f1b}
    header{padding:28px clamp(18px,4vw,54px) 22px;border-bottom:1px solid #202b40}.eyebrow{font-size:11px;letter-spacing:.17em;text-transform:uppercase;color:#83a8f4;font-weight:700}h1{font-size:clamp(25px,3vw,40px);letter-spacing:-.04em;margin:7px 0 6px}header p{margin:0;color:#9aa9c2;font-size:14px;line-height:1.55;max-width:900px}
    main{padding:22px clamp(14px,3vw,42px) 42px;max-width:1700px;margin:auto}.panel{border:1px solid #26334a;background:rgba(14,21,35,.94);border-radius:14px;overflow:hidden;box-shadow:0 18px 50px #0002}.toolbar{display:flex;align-items:end;gap:12px;flex-wrap:wrap;padding:15px;border-bottom:1px solid #26334a}label{display:flex;flex-direction:column;gap:6px;color:#aab7cc;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}select,input{height:38px;min-width:190px;border:1px solid #33415b;border-radius:8px;background:#101a2b;color:#eef3ff;padding:0 11px;font:inherit;letter-spacing:normal;text-transform:none}input[type=search]{min-width:220px}button{height:38px;border:1px solid #405473;border-radius:8px;background:#1b2b45;color:#e9eefb;padding:0 13px;font:inherit;font-weight:650;cursor:pointer}button:hover:not(:disabled){background:#263c5c}button:focus-visible{outline:2px solid #83a8f4;outline-offset:2px}button:disabled{opacity:.48;cursor:not-allowed}.result-count{margin:0 0 2px auto;color:#91a2bd;font-size:12px;font-variant-numeric:tabular-nums}
    .notice{display:none;margin:14px 15px 0;border:1px solid #76592c;border-radius:9px;padding:10px 12px;color:#f5d69a;background:#302513;font-size:12px;line-height:1.45}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;padding:14px 15px}.metric{padding:11px;border:1px solid #263650;border-radius:9px;background:#111c2d}.metric span{display:block;color:#8798b4;font-size:10px;text-transform:uppercase;letter-spacing:.07em}.metric strong{display:block;margin-top:5px;font-variant-numeric:tabular-nums;font-size:16px}.table-scroll{overflow:auto;max-height:72vh}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;font-size:12px}th{position:sticky;top:0;background:#111c2d;color:#9baac2;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em;z-index:1}th:first-child,td:first-child{text-align:left}td,th{padding:10px 11px;border-bottom:1px solid #222f45;white-space:nowrap}td{color:#d3ddef;text-align:right}td.domain{font-weight:650;color:#e7efff}.positive{color:#86e1b5!important}.negative{color:#f19f9f!important}.muted{color:#8293ae}.empty{padding:24px;color:#91a2bd;text-align:left}.method{color:#a9bad2}.footer{margin:14px 4px 0;color:#71819b;font-size:11px;line-height:1.6;max-width:1200px}
    @media(max-width:850px){.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.toolbar label{flex:1 1 40%}.result-count{margin:0 0 2px 0}}@media(max-width:520px){header{padding-top:20px}.toolbar label{flex-basis:100%}select,input,input[type=search]{width:100%;min-width:0}.summary{grid-template-columns:1fr 1fr}td,th{padding:8px;font-size:11px}}
  </style>
</head>
<body>
  <header><div class="eyebrow">Aviary GEO · observed answers</div><h1>Provider citation edge comparison</h1><p>Compare co-cited domain pairs on the same exact prompts. Pair labels are alphabetically ordered; positive B-minus-A values mean the edge appeared on a larger share of provider B’s comparable prompt groups.</p></header>
  <main>
    <section class="panel" aria-label="Provider co-citation edge comparison">
      <div class="toolbar">
        <label>Provider pair<select id="pair"></select></label>
        <label>Find a domain<input id="search" type="search" placeholder="domain.example"></label>
        <label>Minimum union support<input id="support-filter" type="number" min="2" step="1" value="2"></label>
        <button id="download" type="button" disabled>Download filtered CSV</button>
        <p id="result-count" class="result-count" aria-live="polite"></p>
      </div>
      <div id="notice" class="notice" role="status"></div>
      <div class="summary" id="summary" aria-label="Comparison summary"></div>
      <div class="table-scroll"><table><thead><tr><th scope="col">Co-cited domain pair</th><th scope="col">Shared prompts</th><th scope="col">A edge reach</th><th scope="col">B edge reach</th><th scope="col">B − A</th><th scope="col">95% interval</th><th scope="col">Leave-one-out Δ range</th><th scope="col">A only</th><th scope="col">B only</th><th scope="col">Both</th><th scope="col">Neither</th><th scope="col">McNemar p</th><th scope="col">Holm p</th><th scope="col">Test</th></tr></thead><tbody id="rows"></tbody></table></div>
    </section>
    <p class="footer">Edge rates use complete retained source lists only. Differences have nominal Newcombe intervals; intervals are not adjusted across the edge catalog. The leave-one-prompt-out range shows the smallest and largest B-minus-A difference after removing one comparable exact prompt, as a direct sensitivity check; it is available with at least two comparable prompts. McNemar uses the exact two-sided binomial method through 500 discordant prompt groups and a continuity-corrected normal approximation above that. Holm-adjusted p-values are available only when the full retained provider/edge comparison family is complete. These are descriptive captured-sample comparisons, not provider rankings or causal source effects.</p>
  </main>
  <script type="application/json" id="edge-data">__EDGE_DATA__</script>
  <script>
  (()=>{
    const data=JSON.parse(document.getElementById('edge-data').textContent||'{"rows":[],"summary":{}}');
    const pairSelect=document.getElementById('pair'),search=document.getElementById('search'),supportFilter=document.getElementById('support-filter'),body=document.getElementById('rows'),count=document.getElementById('result-count'),notice=document.getElementById('notice'),download=document.getElementById('download');
    const exportHeaders=['provider_a','provider_b','domain_a','domain_b','shared_exact_prompt_groups','comparable_complete_source_prompt_groups','provider_a_only_edge_prompts','provider_b_only_edge_prompts','both_edge_prompts','neither_edge_prompts','provider_a_edge_prompt_share','provider_b_edge_prompt_share','provider_b_minus_a_edge_prompt_share','provider_b_minus_a_lower_95','provider_b_minus_a_upper_95','provider_b_minus_a_leave_one_prompt_out_min','provider_b_minus_a_leave_one_prompt_out_max','leave_one_prompt_out_max_absolute_shift','paired_mcnemar_p_value','paired_test_method','paired_holm_adjusted_mcnemar_p_value','holm_adjustment_status'];
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
    const summary=data.summary||{};const summaryPanel=document.getElementById('summary');
    summaryPanel.append(metric('Provider pairs evaluated',fmt(summary.providerPairsEvaluated)),metric('Edge candidates',fmt(summary.edgeCandidates)),metric('Holm family size',fmt(summary.holmFamilySize)),metric('Holm status',summary.holmStatus||'—'));
    const warning=[];
    if(!summary.edgeCatalogComplete)warning.push('The retained provider/edge family is incomplete; Holm-adjusted p-values are withheld.');
    if(summary.unknownSourcePromptGroups)warning.push(fmt(summary.unknownSourcePromptGroups)+' shared prompt-pair source details were unknown and excluded.');
    if(summary.providerPairsOmittedByWork)warning.push(fmt(summary.providerPairsOmittedByWork)+' provider pairs were omitted by the prompt/edge work budget.');
    if(summary.providerPairsOmittedByCandidateCap)warning.push(fmt(summary.providerPairsOmittedByCandidateCap)+' provider pairs were omitted by the candidate-edge cap.');
    if(summary.providerPairsOmittedByCap)warning.push(fmt(summary.providerPairsOmittedByCap)+' provider pairs were omitted by the provider-pair cap.');
    if(summary.outputRowsTruncated)warning.push('The CSV output row cap omitted lower-ranked edge comparisons.');
    if(warning.length){notice.textContent=warning.join(' ');notice.style.display='block'}
    function refresh(){
      body.replaceChildren();
      const selected=pairSelect.value,query=search.value.trim().toLowerCase(),minimum=Math.max(2,Number(supportFilter.value)||2);
      const filtered=data.rows.filter(row=>pairKey(row)===selected&&number(row.provider_a_only_edge_prompts)+number(row.provider_b_only_edge_prompts)+number(row.both_edge_prompts)>=minimum&&(!query||(row.domain_a+' '+row.domain_b).toLowerCase().includes(query)));
      lastFiltered=filtered;download.disabled=filtered.length===0;
      count.textContent=filtered.length.toLocaleString()+' edge comparison(s)';
      if(!filtered.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=14;cell.className='empty';cell.textContent=pairs.length?'No edges match this provider pair and filter.':'No retained provider edge comparisons are available.';row.append(cell);body.append(row);return}
      for(const item of filtered){
        const row=document.createElement('tr'),domain=document.createElement('td');domain.className='domain';domain.textContent=item.domain_a+'  ×  '+item.domain_b;row.append(domain);
        const interval=number(item.provider_b_minus_a_lower_95)===null||number(item.provider_b_minus_a_upper_95)===null?'—':pp(item.provider_b_minus_a_lower_95)+' to '+pp(item.provider_b_minus_a_upper_95);
        const leaveOneOut=number(item.provider_b_minus_a_leave_one_prompt_out_min)===null||number(item.provider_b_minus_a_leave_one_prompt_out_max)===null?'—':pp(item.provider_b_minus_a_leave_one_prompt_out_min)+' to '+pp(item.provider_b_minus_a_leave_one_prompt_out_max);
        const delta=pp(item.provider_b_minus_a_edge_prompt_share),deltaCell=document.createElement('td');deltaCell.textContent=delta;deltaCell.className=number(item.provider_b_minus_a_edge_prompt_share)>0?'positive':number(item.provider_b_minus_a_edge_prompt_share)<0?'negative':'';
        const values=[fmt(item.shared_exact_prompt_groups),pct(item.provider_a_edge_prompt_share),pct(item.provider_b_edge_prompt_share),null,interval,null,fmt(item.provider_a_only_edge_prompts),fmt(item.provider_b_only_edge_prompts),fmt(item.both_edge_prompts),fmt(item.neither_edge_prompts),probability(item.paired_mcnemar_p_value),probability(item.paired_holm_adjusted_mcnemar_p_value),item.paired_test_method||'—'];
        for(let index=0;index<values.length;index++){if(index===3){row.append(deltaCell);continue}const cell=document.createElement('td');cell.textContent=index===5?leaveOneOut:values[index];if(index===12)cell.className='method';row.append(cell)}
        body.append(row);
      }
    }
    download.addEventListener('click',()=>{if(!lastFiltered.length)return;const csv=[exportHeaders,...lastFiltered.map(row=>exportHeaders.map(header=>row[header]??''))].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n',url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download='provider-source-network-edges-filtered.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),0)});
    pairSelect.addEventListener('change',refresh);search.addEventListener('input',refresh);supportFilter.addEventListener('input',refresh);refresh();
  })();
  </script>
</body>
</html>`;
  return document.replace('__EDGE_DATA__', serialized);
}
