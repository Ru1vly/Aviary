import type { AiAnswerCitationObservationReport } from './answerCitationObservations';
import { renderAiAnswerCitationSourceNetworkCsv } from './answerCitationSourceNetwork';
import { renderAiAnswerCitationRankWeightedSourceNetworkCsv } from './answerCitationRankWeightedSourceNetwork';

type NetworkWeighting = 'events' | 'rank';

interface NetworkNode {
  domain: string;
  sourceWeight: number;
  promptGroups: number;
  reachPercent: number;
  degree: number;
  weightedDegree: number;
  pageRank: number;
  componentId: string;
  componentSize: number;
  communityId: string;
  communitySize: number;
  communityInternalShare: number | null;
  communityModularityContribution: number | null;
  networkModularity: number | null;
  communityConverged: boolean;
}

interface NetworkEdge {
  left: string;
  right: string;
  support: number;
  strength: number;
  jaccard: number;
  lift: number | null;
}

interface ProviderGraph {
  weighting: NetworkWeighting;
  provider: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  promptGroups: number;
  completePromptGroups: number;
  unknownPromptGroups: number;
  complete: boolean;
  domainCatalogTruncated: boolean;
  communityCount: number;
  largestCommunitySize: number;
  weightedModularity: number | null;
}

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

function numeric(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumeric(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildGraphsFromCsv(
  csv: string,
  weighting: NetworkWeighting
): { graphs: ProviderGraph[]; outputTruncated: boolean } {
  const records = parseCsvRecords(csv);
  const headers = records[0] ?? [];
  const rows = records
    .slice(1)
    .map((record) =>
      Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']))
    );
  const summary = rows.find((row) => row.row_type === 'summary');
  const nodeType = weighting === 'events' ? 'source-node' : 'rank-weighted-source-node';
  const edgeType = weighting === 'events' ? 'source-edge' : 'rank-weighted-source-edge';
  const providerSummaryType =
    weighting === 'events'
      ? 'source-network-provider-summary'
      : 'rank-weighted-source-network-provider-summary';
  const providerNames = [
    ...new Set(
      rows
        .filter((row) => row.row_type === nodeType || row.row_type === edgeType)
        .map((row) => row.provider)
        .filter(
          (provider): provider is string => typeof provider === 'string' && provider.length > 0
        )
    ),
  ].sort((left, right) => left.localeCompare(right));
  const graphs = providerNames
    .map((provider): ProviderGraph => {
      const providerRows = rows.filter((row) => row.provider === provider);
      const providerSummary = providerRows.find((row) => row.row_type === providerSummaryType);
      const nodes: NetworkNode[] = providerRows
        .filter((row) => row.row_type === nodeType)
        .map((row) => ({
          domain: String(row.domain ?? ''),
          sourceWeight: numeric(
            weighting === 'events' ? row.citation_events : row.discounted_citation_weight
          ),
          promptGroups: numeric(row.prompt_groups_with_source),
          reachPercent: numeric(row.source_reach_percent),
          degree: numeric(row.network_degree),
          weightedDegree: numeric(
            weighting === 'events'
              ? row.weighted_degree_prompt_cooccurrences
              : row.rank_weighted_degree
          ),
          pageRank: numeric(
            weighting === 'events' ? row.pagerank_centrality : row.rank_weighted_pagerank
          ),
          componentId: String(row.connected_component_id ?? ''),
          componentSize: numeric(row.connected_component_size),
          communityId: String(row.community_id ?? ''),
          communitySize: numeric(row.community_size),
          communityInternalShare: nullableNumeric(
            weighting === 'events'
              ? row.community_internal_edge_share
              : row.community_internal_edge_strength_share
          ),
          communityModularityContribution: nullableNumeric(row.community_modularity_contribution),
          networkModularity: nullableNumeric(row.network_weighted_modularity),
          communityConverged: row.community_detection_converged === 'true',
        }))
        .filter((node) => node.domain.length > 0);
      const nodeSet = new Set(nodes.map((node) => node.domain));
      const edges: NetworkEdge[] = providerRows
        .filter((row) => row.row_type === edgeType)
        .map((row) => ({
          left: String(row.domain_a ?? ''),
          right: String(row.domain_b ?? ''),
          support: numeric(row.shared_exact_prompt_groups),
          strength: numeric(
            weighting === 'events'
              ? row.shared_exact_prompt_groups
              : row.rank_weighted_cocitation_strength
          ),
          jaccard: numeric(row.jaccard_prompt_overlap),
          lift: nullableNumeric(row.cooccurrence_lift),
        }))
        .filter((edge) => nodeSet.has(edge.left) && nodeSet.has(edge.right));
      const first = providerRows[0];
      return {
        weighting,
        provider,
        nodes,
        edges,
        promptGroups: numeric(first?.provider_prompt_groups),
        completePromptGroups: numeric(
          weighting === 'events'
            ? first?.complete_source_prompt_groups
            : first?.complete_rank_weight_prompt_groups
        ),
        unknownPromptGroups: numeric(
          weighting === 'events'
            ? first?.unknown_source_detail_prompt_groups
            : first?.unknown_rank_detail_prompt_groups
        ),
        complete: first?.network_complete === 'true',
        domainCatalogTruncated: first?.domain_catalog_truncated === 'true',
        communityCount: numeric(providerSummary?.community_count),
        largestCommunitySize: numeric(providerSummary?.largest_community_size),
        weightedModularity: nullableNumeric(providerSummary?.network_weighted_modularity),
      };
    })
    .filter((graph) => graph.nodes.length > 0);
  return { graphs, outputTruncated: summary?.output_rows_truncated === 'true' };
}

function buildGraphs(report: AiAnswerCitationObservationReport): {
  eventGraphs: ProviderGraph[];
  rankGraphs: ProviderGraph[];
  eventTruncated: boolean;
  rankTruncated: boolean;
} {
  const event = buildGraphsFromCsv(renderAiAnswerCitationSourceNetworkCsv(report), 'events');
  const rank = buildGraphsFromCsv(
    renderAiAnswerCitationRankWeightedSourceNetworkCsv(report),
    'rank'
  );
  return {
    eventGraphs: event.graphs,
    rankGraphs: rank.graphs,
    eventTruncated: event.outputTruncated,
    rankTruncated: rank.outputTruncated,
  };
}

/** Render a dependency-free, interactive browser view of the bounded source-network CSV. */
export function renderAiAnswerCitationSourceNetworkHtml(
  report: AiAnswerCitationObservationReport
): string {
  const { eventGraphs, rankGraphs, eventTruncated, rankTruncated } = buildGraphs(report);
  const serialized = JSON.stringify({ eventGraphs, rankGraphs, eventTruncated, rankTruncated })
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026');
  const document = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Aviary · Citation source network</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e9eefb;background:#0a0f1b;font-synthesis:none;text-rendering:optimizeLegibility}
    *{box-sizing:border-box}body{margin:0;min-width:320px;background:radial-gradient(ellipse at 14% 0%,#142544 0,transparent 42%),#0a0f1b}
    header{padding:26px clamp(18px,4vw,52px) 20px;border-bottom:1px solid #202b40;display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap}
    .eyebrow{font-size:11px;letter-spacing:.17em;text-transform:uppercase;color:#83a8f4;font-weight:700}h1{font-size:clamp(24px,3vw,38px);letter-spacing:-.04em;margin:7px 0 5px}header p{margin:0;color:#9aa9c2;font-size:14px;max-width:760px;line-height:1.5}
    main{padding:20px clamp(14px,3vw,38px) 38px;max-width:1680px;margin:auto}.toolbar{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin-bottom:14px}
    label{display:flex;flex-direction:column;gap:6px;color:#aab7cc;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}select,input{height:38px;min-width:180px;border:1px solid #33415b;border-radius:8px;background:#101a2b;color:#eef3ff;padding:0 11px;font:inherit;letter-spacing:normal;text-transform:none}
    input[type=number]{min-width:112px;width:112px}.hint{font-size:12px;color:#8392aa;margin:0 0 8px auto}.notice{display:none;border:1px solid #76592c;border-radius:8px;padding:10px 12px;color:#f5d69a;background:#302513;font-size:12px;margin-bottom:12px}
    .layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px}.panel{border:1px solid #26334a;background:rgba(14,21,35,.92);border-radius:14px;overflow:hidden;box-shadow:0 18px 50px #0002}.canvas-wrap{position:relative;min-height:520px;height:min(68vh,780px);background:radial-gradient(ellipse at center,#121e32 0,#0c1321 66%)}canvas{width:100%;height:100%;display:block;touch-action:none}.canvas-help{position:absolute;left:13px;bottom:11px;color:#7788a3;font-size:11px;pointer-events:none}.side{padding:18px}.side h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#91a4c2;margin:0 0 12px}.selected{font-size:21px;letter-spacing:-.03em;overflow-wrap:anywhere;margin:0 0 16px}.empty{color:#8494ae;line-height:1.5;font-size:13px}.metric-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.metric{padding:10px;border:1px solid #263650;border-radius:9px;background:#111c2d}.metric span{display:block;color:#8798b4;font-size:10px;text-transform:uppercase;letter-spacing:.07em}.metric strong{display:block;margin-top:5px;font-variant-numeric:tabular-nums;font-size:16px}.component{margin-top:12px;padding:11px;border-radius:9px;background:#121d2d;color:#adbad0;font-size:12px;line-height:1.5}.legend{display:flex;gap:14px;flex-wrap:wrap;padding:11px 14px;border-top:1px solid #26334a;color:#8f9fb8;font-size:11px}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:-1px}.footer{margin-top:14px;color:#71819b;font-size:11px;line-height:1.55;max-width:1200px}
    .sources-panel{margin-top:14px;padding:16px}.sources-heading{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:10px}.sources-heading h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#91a4c2;margin:0}.sources-heading span{font-size:11px;color:#8293ae}.table-scroll{overflow:auto;max-height:360px}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;font-size:12px}th{position:sticky;top:0;background:#111c2d;color:#9baac2;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.06em}th:first-child,td:first-child{text-align:left}td,th{padding:9px 10px;border-bottom:1px solid #222f45;white-space:nowrap}td{color:#d3ddef;text-align:right}td button{border:0;background:none;color:#91b9ff;padding:0;font:inherit;text-align:left;cursor:pointer}td button:hover,td button:focus-visible{text-decoration:underline;outline:2px solid #6494eb;outline-offset:3px;border-radius:2px}.no-rows{text-align:left;color:#8293ae;padding:15px}
    @media(max-width:900px){.layout{grid-template-columns:1fr}.canvas-wrap{height:58vh;min-height:420px}.side{min-height:190px}.hint{margin:0}}
    @media(max-width:520px){header{padding-top:19px}.toolbar{align-items:stretch}.toolbar label{flex:1 1 44%}select,input{min-width:0;width:100%}.canvas-wrap{min-height:370px;height:54vh}.side{padding:14px}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  </style>
</head>
<body>
  <header><div><div class="eyebrow">Aviary GEO · observed answers</div><h1>Citation source network</h1><p>Explore which domains appear together across exact prompts for each provider. Nodes represent cited domains; links count prompt-level co-citations.</p></div><div class="eyebrow">Local report · no external assets</div></header>
  <main>
    <div id="truncation" class="notice">A row cap removed part of this graph. The CSV summary row records retained and omitted counts.</div>
    <div class="toolbar">
      <label>Weighting<select id="weighting"><option value="events">Citation events</option><option value="rank">Citation positions</option></select></label>
      <label>Provider<select id="provider"></select></label>
      <label>Minimum shared prompts<input id="minimum" type="number" min="1" step="1" value="1"></label>
      <label>Find source<input id="search" type="search" placeholder="domain.example"></label>
      <p id="support" class="hint"></p>
    </div>
    <div class="layout">
      <section class="panel" aria-label="Citation source co-occurrence graph"><div class="canvas-wrap"><canvas id="graph" aria-label="Interactive citation source graph"></canvas><div class="canvas-help">Drag to pan · scroll to zoom · click a source for details</div></div><div class="legend"><span><i class="dot" style="background:#69a7ff"></i>Node size = exact-prompt reach</span><span>Node color = co-citation community</span><span id="edge-weight-legend">Link width = shared prompt support</span><span>Link opacity = Jaccard overlap</span></div></section>
      <aside class="panel side" aria-live="polite"><h2>Selected source</h2><p id="selected" class="selected">Choose a node</p><p id="empty" class="empty">Select a domain in the graph to inspect its observed citation reach and network position.</p><div id="metrics" class="metric-grid"></div><div id="component" class="component" hidden></div></aside>
    </div>
    <section class="panel sources-panel" aria-labelledby="source-table-title"><div class="sources-heading"><h2 id="source-table-title">Source details</h2><span id="source-count"></span></div><div class="table-scroll"><table><thead><tr><th scope="col">Source</th><th scope="col">Reach</th><th scope="col">Prompt groups</th><th id="source-weight-heading" scope="col">Citation events</th><th scope="col">Degree</th><th id="pagerank-heading" scope="col">PageRank</th><th scope="col">Community</th><th scope="col">Component</th><th scope="col">Modularity contribution</th></tr></thead><tbody id="source-rows"></tbody></table></div></section>
    <p class="footer">The event graph requires complete retained citation-domain lists; the position graph independently requires complete reciprocal-log-rank profiles. Truncated details are unknown, not absent. Node communities use deterministic weighted label propagation over the retained prompt co-citation graph; convergence, source-detail state, and domain caps appear in the data. Weighted modularity compares the partition with a degree-preserving random-graph reference; a stronger score is not evidence of semantic topic coherence. Link lift compares observed co-citation with the rate expected from each source’s prompt reach. These graphs describe the captured sample; co-citation and centrality do not establish semantic agreement, source influence, trust, quality, or causation.</p>
  </main>
      <script type="application/json" id="network-data">__NETWORK_DATA__</script>
  <script>
  (()=>{
    const payload=JSON.parse(document.getElementById('network-data').textContent||'{"eventGraphs":[],"rankGraphs":[]}');
    const providerSelect=document.getElementById('provider'),weightingSelect=document.getElementById('weighting'),minInput=document.getElementById('minimum'),searchInput=document.getElementById('search');
    const canvas=document.getElementById('graph'),ctx=canvas.getContext('2d'),support=document.getElementById('support'),sourceRows=document.getElementById('source-rows'),sourceCount=document.getElementById('source-count');
    const selectedText=document.getElementById('selected'),emptyText=document.getElementById('empty'),metrics=document.getElementById('metrics'),component=document.getElementById('component');
    const weightHeading=document.getElementById('source-weight-heading'),pageRankHeading=document.getElementById('pagerank-heading'),edgeLegend=document.getElementById('edge-weight-legend');
    let active=null,nodes=[],edges=[],scale=1,panX=0,panY=0,hovered=null,drag=null,dpr=1;
    const number=(value,digits=1)=>Number.isFinite(value)?value.toFixed(digits):'—';
    const colorFor=(text)=>{let value=0;for(let i=0;i<text.length;i++)value=(value*31+text.charCodeAt(i))>>>0;return 'hsl('+Math.round(value%360)+' 66% 64%)'};
    function updateLabels(weighting){
      weightHeading.textContent=weighting==='events'?'Citation events':'Discounted rank weight';
      pageRankHeading.textContent=weighting==='events'?'PageRank':'Rank-weighted PageRank';
      edgeLegend.textContent=weighting==='events'?'Link width = shared prompt support':'Link width = rank-weighted edge strength';
    }
    function prepare(graph){
      active=graph;nodes=graph.nodes.map((node,index)=>Object.assign({},node,{x:Math.cos(2*Math.PI*index/Math.max(1,graph.nodes.length))*260,y:Math.sin(2*Math.PI*index/Math.max(1,graph.nodes.length))*215,vx:0,vy:0}));
      const lookup=new Map(nodes.map(node=>[node.domain,node]));edges=graph.edges.map(edge=>Object.assign({},edge,{a:lookup.get(edge.left),b:lookup.get(edge.right)})).filter(edge=>edge.a&&edge.b);
      const supportText=number(graph.completePromptGroups,0)+(graph.weighting==='events'?' complete event-source prompts':' complete rank-weight profiles')+' · '+number(graph.nodes.length,0)+' sources · '+number(graph.edges.length,0)+' links · '+number(graph.communityCount,0)+' communities · largest '+number(graph.largestCommunitySize,0)+' · weighted modularity '+number(graph.weightedModularity,4)+(graph.complete?' · complete retained detail':' · incomplete or capped detail');
      support.textContent=supportText;
      updateLabels(graph.weighting);
      const minimum=Math.max(1,Number(minInput.value)||1);
      const visibleEdges=edges.filter(edge=>edge.support>=minimum);
      for(let iteration=0;iteration<210;iteration++){
        for(const node of nodes){node.vx+=(0-node.x)*.0007;node.vy+=(0-node.y)*.0007}
        for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
          const a=nodes[i],b=nodes[j],dx=a.x-b.x,dy=a.y-b.y,d2=Math.max(25,dx*dx+dy*dy),force=780/d2;
          a.vx+=dx*force;a.vy+=dy*force;b.vx-=dx*force;b.vy-=dy*force;
        }
        for(const edge of visibleEdges){
          const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,distance=Math.max(1,Math.hypot(dx,dy));
          const target=64+72*(1-Math.min(1,edge.jaccard||0)),force=(distance-target)*.0018;
          edge.a.vx+=dx/distance*force;edge.a.vy+=dy/distance*force;edge.b.vx-=dx/distance*force;edge.b.vy-=dy/distance*force;
        }
        for(const node of nodes){node.vx*=.83;node.vy*=.83;node.x+=node.vx;node.y+=node.vy;node.x=Math.max(-450,Math.min(450,node.x));node.y=Math.max(-360,Math.min(360,node.y))}
      }
      scale=1;panX=0;panY=0;draw();refreshSourceRows();
    }
    function dimensions(){const rect=canvas.getBoundingClientRect();dpr=window.devicePixelRatio||1;canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);return {width:rect.width,height:rect.height}}
    function draw(){
      const size=dimensions(),minimum=Math.max(1,Number(minInput.value)||1),query=searchInput.value.trim().toLowerCase();
      ctx.clearRect(0,0,size.width,size.height);ctx.save();ctx.translate(size.width/2+panX,size.height/2+panY);ctx.scale(scale,scale);
      const visibleEdges=edges.filter(edge=>edge.support>=minimum);
      const maxSupport=Math.max(1,...visibleEdges.map(edge=>active.weighting==='rank'?edge.strength:edge.support));
      for(const edge of visibleEdges){const focus=!query||edge.left.toLowerCase().includes(query)||edge.right.toLowerCase().includes(query),weight=active.weighting==='rank'?edge.strength:edge.support;ctx.beginPath();ctx.moveTo(edge.a.x,edge.a.y);ctx.lineTo(edge.b.x,edge.b.y);ctx.lineWidth=.6+Math.sqrt(weight/maxSupport)*4;ctx.strokeStyle='rgba(110,153,213,'+(focus ? .12+Math.min(.58,edge.jaccard*.7) : .035)+')';ctx.stroke()}
      const maxReach=Math.max(1,...nodes.map(node=>node.reachPercent));
      for(const node of nodes){const match=!query||node.domain.toLowerCase().includes(query),radius=4+9*Math.sqrt(node.reachPercent/maxReach),focus=!query||match;ctx.beginPath();ctx.arc(node.x,node.y,radius,0,Math.PI*2);ctx.fillStyle=colorFor(node.communityId||node.componentId||node.domain);ctx.globalAlpha=focus?(.56+Math.min(.4,node.reachPercent/250)):.13;ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=hovered===node?2.5:1;ctx.strokeStyle=hovered===node?'#fff':'rgba(230,239,255,.62)';ctx.stroke();if((nodes.length<=26||match&&query||hovered===node)&&focus){ctx.font='11px ui-sans-serif,system-ui';ctx.textAlign='center';ctx.fillStyle='#e7edf8';ctx.fillText(node.domain,node.x,node.y-radius-7)}}
      ctx.restore();
    }
    function screenToWorld(event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left-rect.width/2-panX)/scale,y:(event.clientY-rect.top-rect.height/2-panY)/scale}}
    function hit(event){const point=screenToWorld(event);let found=null,distance=Infinity;for(const node of nodes){const current=Math.hypot(node.x-point.x,node.y-point.y);if(current<18&&current<distance){found=node;distance=current}}return found}
    function showNode(node){
      selectedText.textContent=node?node.domain:'Choose a node';emptyText.hidden=Boolean(node);metrics.replaceChildren();component.hidden=!node;
      if(!node)return;
      const values=[['Prompt reach',number(node.reachPercent,2)+'%'],['Prompt groups',number(node.promptGroups,0)],[active.weighting==='events'?'Citation events':'Discounted rank weight',number(node.sourceWeight,1)],['Network degree',number(node.degree,0)],[active.weighting==='events'?'Weighted degree':'Rank-weighted degree',number(node.weightedDegree,3)],[active.weighting==='events'?'PageRank':'Rank-weighted PageRank',number(node.pageRank,8)],['Community contribution',number(node.communityModularityContribution,6)],['Network modularity',number(node.networkModularity,6)]];
      for(const [label,value] of values){const card=document.createElement('div'),title=document.createElement('span'),content=document.createElement('strong');card.className='metric';title.textContent=label;content.textContent=value;card.append(title,content);metrics.append(card)}
      component.textContent='Citation community '+(node.communityId||'—')+' · '+number(node.communitySize,0)+' source(s), '+(node.communityInternalShare===null?'—':number(node.communityInternalShare*100,1)+'% of incident co-occurrence weight within the community')+'. Its modularity contribution is '+number(node.communityModularityContribution,6)+' in a network with weighted modularity '+number(node.networkModularity,6)+'. '+(node.communityConverged?'Community clustering converged.':'Community clustering stopped at a work or iteration cap.')+' Connected component '+(node.componentId||'—')+' · '+number(node.componentSize,0)+' source(s). Co-cited links: '+edges.filter(edge=>(edge.left===node.domain||edge.right===node.domain)&&edge.support>=Math.max(1,Number(minInput.value)||1)).length+'.';
    }
    function refreshSourceRows(){
      sourceRows.replaceChildren();
      const query=searchInput.value.trim().toLowerCase();
      const filtered=active?active.nodes.filter(node=>!query||node.domain.toLowerCase().includes(query)).sort((a,b)=>b.reachPercent-a.reachPercent||b.weightedDegree-a.weightedDegree||a.domain.localeCompare(b.domain)):[];
      sourceCount.textContent=filtered.length+' source(s)'+(filtered.length>50?' · showing top 50':'');
      if(!filtered.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=9;cell.className='no-rows';cell.textContent=active?'No sources match this provider and search.':'No retained source network is available.';row.append(cell);sourceRows.append(row);return}
      for(const node of filtered.slice(0,50)){
        const row=document.createElement('tr'),domainCell=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent=node.domain;button.addEventListener('click',()=>{hovered=node;showNode(node);draw();canvas.focus()});domainCell.append(button);row.append(domainCell);
        for(const value of [number(node.reachPercent,2)+'%',number(node.promptGroups,0),number(node.sourceWeight,1),number(node.degree,0),number(node.pageRank,8),node.communityId+' · '+number(node.communitySize,0),node.componentId+' · '+number(node.componentSize,0),number(node.communityModularityContribution,6)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}
        sourceRows.append(row);
      }
    }
    function graphsForMode(){return weightingSelect.value==='rank'?payload.rankGraphs:payload.eventGraphs}
    function populateProviders(){
      const previous=providerSelect.value,graphs=graphsForMode();providerSelect.replaceChildren();
      updateLabels(weightingSelect.value);
      for(const graph of graphs)providerSelect.add(new Option(graph.provider,graph.provider));
      const graph=graphs.find(item=>item.provider===previous)||graphs[0];
      const truncated=weightingSelect.value==='rank'?payload.rankTruncated:payload.eventTruncated;
      document.getElementById('truncation').style.display=truncated?'block':'none';
      showNode(null);
      if(graph){providerSelect.value=graph.provider;prepare(graph)}
      else{active=null;nodes=[];edges=[];support.textContent='No complete retained source network is available for this weighting.';dimensions();ctx.clearRect(0,0,canvas.width,canvas.height);refreshSourceRows()}
    }
    providerSelect.addEventListener('change',()=>{const graph=graphsForMode().find(item=>item.provider===providerSelect.value);showNode(null);if(graph)prepare(graph)});
    weightingSelect.addEventListener('change',populateProviders);
    minInput.addEventListener('input',()=>{draw();if(hovered)showNode(hovered)});searchInput.addEventListener('input',()=>{draw();refreshSourceRows()});
    canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,panX,panY,moved:false};canvas.setPointerCapture(event.pointerId)});
    canvas.addEventListener('pointermove',event=>{if(drag){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;panX=drag.panX+dx;panY=drag.panY+dy;draw();return}const next=hit(event);if(next!==hovered){hovered=next;canvas.style.cursor=next?'pointer':'grab';draw()}});
    canvas.addEventListener('pointerup',event=>{if(!drag)return;if(!drag.moved){const node=hit(event);if(node){hovered=node;showNode(node);draw()}}drag=null});
    canvas.addEventListener('wheel',event=>{event.preventDefault();scale=Math.max(.35,Math.min(2.8,scale*(event.deltaY<0?1.1:.9)));draw()},{passive:false});
    window.addEventListener('resize',draw);
    populateProviders();
  })();
  </script>
</body>
</html>`;
  return document.replace('__NETWORK_DATA__', serialized);
}
