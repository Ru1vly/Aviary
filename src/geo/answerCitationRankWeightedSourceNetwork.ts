import type {
  AiAnswerCitationObservationReport,
  AiAnswerCitationPromptProviderProfile,
} from './answerCitationObservations';
import {
  detectSourceNetworkCommunities,
  sourceCommunityAdjustedRandIndex,
  type SourceCommunityDetection,
} from './sourceNetworkCommunityDetection';

const MAX_DOMAINS_PER_PROVIDER = 100;
const MAX_PROVIDER_PANELS = 500;
const MAX_NODE_PROMPT_CHECKS = 5_000_000;
const MAX_PAIR_PROMPT_UPDATES = 5_000_000;
const MAX_OUTPUT_ROWS = 20_000;
const MAX_NETWORK_PROVIDER_SUMMARY_ROWS = MAX_PROVIDER_PANELS;
const MAX_NODE_ROWS = Math.floor((MAX_OUTPUT_ROWS - MAX_NETWORK_PROVIDER_SUMMARY_ROWS) / 2);
const MAX_EDGE_ROWS = MAX_OUTPUT_ROWS - MAX_NETWORK_PROVIDER_SUMMARY_ROWS - MAX_NODE_ROWS;
const MAX_COMPARISON_PROVIDER_ROWS = MAX_PROVIDER_PANELS;
const MAX_COMPARISON_TRANSITION_ROWS = 2_500;
const MAX_COMPARISON_NODE_ROWS = Math.floor(
  (MAX_OUTPUT_ROWS - MAX_COMPARISON_PROVIDER_ROWS - MAX_COMPARISON_TRANSITION_ROWS) / 2
);
const MAX_COMPARISON_EDGE_ROWS =
  MAX_OUTPUT_ROWS -
  MAX_COMPARISON_PROVIDER_ROWS -
  MAX_COMPARISON_TRANSITION_ROWS -
  MAX_COMPARISON_NODE_ROWS;

interface RankPrompt {
  promptKey: string;
  weights: Map<string, number>;
  shares: Map<string, number>;
}

interface RankPanel {
  provider: string;
  promptGroups: number;
  profiles: Map<string, AiAnswerCitationPromptProviderProfile>;
  catalogComplete: boolean;
}

interface RankDomain {
  domain: string;
  citationWeight: number;
  promptGroups: number;
  promptShareTotal: number;
}

interface RankEdge {
  left: RankDomain;
  right: RankDomain;
  promptGroups: number;
  strength: number;
}

function normalize(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function promptPairKeys(indexes: number[], domainCount: number): number[] {
  const keys: number[] = [];
  for (let left = 0; left < indexes.length; left += 1) {
    for (let right = left + 1; right < indexes.length; right += 1) {
      keys.push(indexes[left]! * domainCount + indexes[right]!);
    }
  }
  return keys;
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  const firstNonWhitespace = text.trimStart().charAt(0);
  if (typeof value !== 'number' && firstNonWhitespace && '=+-@'.includes(firstNonWhitespace))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function completeRankWeights(
  profile: AiAnswerCitationPromptProviderProfile
): { weights: Map<string, number>; total: number } | null {
  const total = profile.rankWeightedCitationWeightTotal;
  if (
    !Array.isArray(profile.rankWeightedDomainCitationEvents) ||
    profile.rankWeightedDomainsTruncated !== false ||
    !Number.isFinite(total) ||
    total! < 0 ||
    !Number.isFinite(profile.citationEvents) ||
    profile.citationEvents < 0
  )
    return null;
  const weights = new Map<string, number>();
  for (const item of profile.rankWeightedDomainCitationEvents) {
    if (!Number.isFinite(item.discountedCitationWeight) || item.discountedCitationWeight < 0)
      return null;
    const domain = item.domain.toLowerCase();
    weights.set(domain, (weights.get(domain) ?? 0) + item.discountedCitationWeight);
  }
  const listedTotal = [...weights.values()].reduce((sum, value) => sum + value, 0);
  const tolerance = Math.max(1e-9, total! * 1e-9);
  if (Math.abs(listedTotal - total!) > tolerance) return null;
  if (
    profile.citationEvents > 0
      ? total! <= 0 || total! > profile.citationEvents + tolerance
      : total! !== 0
  )
    return null;
  for (const [domain, weight] of weights) if (weight <= 0) weights.delete(domain);
  return { weights, total: total! };
}

function buildPanels(report: AiAnswerCitationObservationReport): Map<string, RankPanel> {
  const panels = new Map<string, RankPanel>();
  for (const provider of report.providers) {
    const key = normalize(provider.provider);
    if (panels.has(key)) panels.get(key)!.catalogComplete = false;
    else
      panels.set(key, {
        provider: provider.provider,
        promptGroups: provider.uniquePrompts,
        profiles: new Map(),
        catalogComplete: !report.promptsTruncated,
      });
  }
  for (const prompt of report.prompts) {
    const promptKey = normalize(prompt.prompt);
    if (!Array.isArray(prompt.providerProfiles)) {
      for (const panel of panels.values()) panel.catalogComplete = false;
      continue;
    }
    for (const profile of prompt.providerProfiles) {
      const providerKey = normalize(profile.provider);
      const panel = panels.get(providerKey) ?? {
        provider: profile.provider,
        promptGroups: 0,
        profiles: new Map<string, AiAnswerCitationPromptProviderProfile>(),
        catalogComplete: !report.promptsTruncated,
      };
      if (panel.profiles.has(promptKey)) panel.catalogComplete = false;
      else panel.profiles.set(promptKey, profile);
      panels.set(providerKey, panel);
    }
  }
  for (const panel of panels.values())
    if (panel.profiles.size !== panel.promptGroups) panel.catalogComplete = false;
  return panels;
}

function pageRankAndComponents(
  domains: RankDomain[],
  edges: RankEdge[],
  includeCommunities = true
): { rows: Array<Record<string, unknown>>; communities: SourceCommunityDetection | null } {
  const indexes = new Map(domains.map((domain, index) => [domain.domain, index]));
  const parent = domains.map((_, index) => index);
  const rootOf = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[index] !== index) {
      const next = parent[index]!;
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const adjacency = Array.from({ length: domains.length }, () => new Map<number, number>());
  for (const edge of edges) {
    const left = indexes.get(edge.left.domain)!;
    const right = indexes.get(edge.right.domain)!;
    adjacency[left]!.set(right, edge.strength);
    adjacency[right]!.set(left, edge.strength);
    const leftRoot = rootOf(left);
    const rightRoot = rootOf(right);
    if (leftRoot !== rightRoot)
      parent[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
  }
  let rank = new Array<number>(domains.length).fill(domains.length > 0 ? 1 / domains.length : 0);
  for (let iteration = 0; iteration < 100 && domains.length > 0; iteration += 1) {
    const next = new Array<number>(domains.length).fill(0.15 / domains.length);
    let dangling = 0;
    for (let node = 0; node < domains.length; node += 1) {
      const neighbors = adjacency[node]!;
      const totalWeight = [...neighbors.values()].reduce((sum, value) => sum + value, 0);
      if (totalWeight <= 0) {
        dangling += rank[node]!;
        continue;
      }
      for (const [neighbor, weight] of neighbors)
        next[neighbor]! += (0.85 * rank[node]! * weight) / totalWeight;
    }
    for (let node = 0; node < domains.length; node += 1)
      next[node]! += (0.85 * dangling) / domains.length;
    const difference = next.reduce((sum, value, index) => sum + Math.abs(value - rank[index]!), 0);
    rank = next;
    if (difference < 1e-12) break;
  }
  const components = new Map<number, string[]>();
  domains.forEach((domain, index) => {
    const root = rootOf(index);
    const members = components.get(root) ?? [];
    members.push(domain.domain);
    components.set(root, members);
  });
  const sortedComponents = [...components.values()]
    .map((members) => members.sort((left, right) => left.localeCompare(right)))
    .sort((left, right) => left[0]!.localeCompare(right[0]!));
  const componentIds = new Map<string, string>();
  const componentSizes = new Map<string, number>();
  sortedComponents.forEach((members, index) => {
    const id = `component-${String(index + 1).padStart(4, '0')}`;
    componentSizes.set(id, members.length);
    for (const domain of members) componentIds.set(domain, id);
  });
  const communities = includeCommunities
    ? detectSourceNetworkCommunities(
        domains.map((domain) => domain.domain),
        edges.map((edge) => ({
          left: edge.left.domain,
          right: edge.right.domain,
          weight: edge.strength,
        }))
      )
    : null;
  const rows = domains.map((domain, index) => {
    const weightedDegree = [...adjacency[index]!.values()].reduce((sum, value) => sum + value, 0);
    const componentId = componentIds.get(domain.domain);
    const community = communities?.byDomain.get(domain.domain);
    return {
      network_degree: adjacency[index]!.size,
      rank_weighted_degree: round(weightedDegree),
      rank_weighted_pagerank: round(rank[index] ?? 0, 8),
      connected_component_id: componentId,
      connected_component_size: componentSizes.get(componentId ?? '') ?? 1,
      ...(community
        ? {
            community_id: community.communityId,
            community_size: community.communitySize,
            community_internal_edge_count: community.communityInternalEdgeCount,
            community_internal_rank_weighted_cooccurrence_strength: round(
              community.communityInternalCooccurrenceWeight
            ),
            community_external_rank_weighted_cooccurrence_strength: round(
              community.communityExternalCooccurrenceWeight
            ),
            community_internal_edge_strength_share:
              community.communityInternalCooccurrenceShare === null
                ? null
                : round(community.communityInternalCooccurrenceShare, 6),
            community_modularity_contribution:
              community.communityModularityContribution === null
                ? null
                : round(community.communityModularityContribution, 8),
            network_weighted_modularity:
              community.networkWeightedModularity === null
                ? null
                : round(community.networkWeightedModularity, 8),
            community_detection_converged: community.communityDetectionConverged,
            community_detection_iterations: community.communityDetectionIterations,
            community_detection_neighbor_visits: community.communityDetectionNeighborVisits,
          }
        : {}),
    };
  });
  return { rows, communities };
}

/** Export source networks whose edge strength reflects reciprocal-log-rank citation weights. */
export function renderAiAnswerCitationRankWeightedSourceNetworkCsv(
  report: AiAnswerCitationObservationReport
): string {
  const panels = buildPanels(report);
  const providerKeys = [...panels.keys()].sort((left, right) =>
    panels.get(left)!.provider.localeCompare(panels.get(right)!.provider)
  );
  const nodeRows: Array<Record<string, unknown>> = [];
  const providerSummaryRows: Array<Record<string, unknown>> = [];
  let nodeRowsAvailable = 0;
  type OutputEdge = {
    provider: string;
    edge: RankEdge;
    promptGroups: number;
    unknown: number;
    catalogComplete: boolean;
    catalogTruncated: boolean;
  };
  let retainedEdges: OutputEdge[] = [];
  let edgeRowsAvailable = 0;
  let pairPromptUpdates = 0;
  let nodePromptChecks = 0;
  let panelsOmittedByBudget = 0;
  let panelsOmittedByCap = 0;
  let panelsEvaluated = 0;
  let rankUnknownPromptGroups = 0;
  let truncatedDomainCatalogs = 0;
  let communityNeighborVisits = 0;
  let communityConvergedProviders = 0;
  let communityIncompleteProviders = 0;
  const compareEdges = (left: OutputEdge, right: OutputEdge): number =>
    right.edge.strength - left.edge.strength ||
    left.provider.localeCompare(right.provider) ||
    left.edge.left.domain.localeCompare(right.edge.left.domain) ||
    left.edge.right.domain.localeCompare(right.edge.right.domain);

  for (let providerIndex = 0; providerIndex < providerKeys.length; providerIndex += 1) {
    if (providerIndex >= MAX_PROVIDER_PANELS) {
      panelsOmittedByCap = providerKeys.length - providerIndex;
      break;
    }
    const panel = panels.get(providerKeys[providerIndex]!)!;
    const rankPrompts: RankPrompt[] = [];
    let unknown = 0;
    const weightTotals = new Map<string, number>();
    const promptTotals = new Map<string, number>();
    for (const [promptKey, profile] of panel.profiles) {
      const complete = completeRankWeights(profile);
      if (!complete) {
        unknown += 1;
        continue;
      }
      const shares = new Map(
        [...complete.weights].map(([domain, weight]) => [
          domain,
          complete.total > 0 ? weight / complete.total : 0,
        ])
      );
      rankPrompts.push({ promptKey, weights: complete.weights, shares });
      for (const [domain, weight] of complete.weights) {
        if (weight <= 0) continue;
        weightTotals.set(domain, (weightTotals.get(domain) ?? 0) + weight);
        promptTotals.set(domain, (promptTotals.get(domain) ?? 0) + 1);
      }
    }
    const allDomains = [...weightTotals.keys()].sort(
      (left, right) =>
        promptTotals.get(right)! - promptTotals.get(left)! ||
        weightTotals.get(right)! - weightTotals.get(left)! ||
        left.localeCompare(right)
    );
    const selectedDomains = allDomains.slice(0, MAX_DOMAINS_PER_PROVIDER);
    const domainCatalogTruncated = allDomains.length > selectedDomains.length;
    const domainIndex = new Map(selectedDomains.map((domain, index) => [domain, index]));
    const selectedPrompts = rankPrompts.map((prompt) => ({
      prompt,
      indexes: [...prompt.shares.keys()]
        .filter((domain) => domainIndex.has(domain))
        .map((domain) => domainIndex.get(domain)!)
        .sort((left, right) => left - right),
    }));
    const providerNodeChecks = selectedPrompts.length * selectedDomains.length;
    const providerPairUpdates = selectedPrompts.reduce(
      (sum, prompt) => sum + (prompt.indexes.length * (prompt.indexes.length - 1)) / 2,
      0
    );
    if (
      nodePromptChecks + providerNodeChecks > MAX_NODE_PROMPT_CHECKS ||
      pairPromptUpdates + providerPairUpdates > MAX_PAIR_PROMPT_UPDATES
    ) {
      panelsOmittedByBudget = providerKeys.length - providerIndex;
      break;
    }
    nodePromptChecks += providerNodeChecks;
    pairPromptUpdates += providerPairUpdates;
    panelsEvaluated += 1;
    rankUnknownPromptGroups += unknown;
    if (domainCatalogTruncated) truncatedDomainCatalogs += 1;

    const domains: RankDomain[] = selectedDomains.map((domain) => ({
      domain,
      citationWeight: weightTotals.get(domain) ?? 0,
      promptGroups: 0,
      promptShareTotal: 0,
    }));
    const edgeStats = new Map<number, { promptGroups: number; strength: number }>();
    for (const { prompt, indexes } of selectedPrompts) {
      const includedIndexes = new Set(indexes);
      for (let index = 0; index < domains.length; index += 1) {
        if (!includedIndexes.has(index)) continue;
        const domain = domains[index]!;
        domain.promptGroups += 1;
        domain.promptShareTotal += prompt.shares.get(domain.domain) ?? 0;
      }
      for (let left = 0; left < indexes.length; left += 1) {
        for (let right = left + 1; right < indexes.length; right += 1) {
          const leftIndex = indexes[left]!;
          const rightIndex = indexes[right]!;
          const key = leftIndex * domains.length + rightIndex;
          const existing = edgeStats.get(key) ?? { promptGroups: 0, strength: 0 };
          existing.promptGroups += 1;
          const leftShare = prompt.shares.get(domains[leftIndex]!.domain) ?? 0;
          const rightShare = prompt.shares.get(domains[rightIndex]!.domain) ?? 0;
          existing.strength += Math.sqrt(leftShare * rightShare);
          edgeStats.set(key, existing);
        }
      }
    }
    const edges: RankEdge[] = [...edgeStats.entries()].map(([key, stats]) => ({
      left: domains[Math.floor(key / domains.length)]!,
      right: domains[key % domains.length]!,
      promptGroups: stats.promptGroups,
      strength: stats.strength,
    }));
    const centrality = pageRankAndComponents(domains, edges);
    if (centrality.communities) {
      communityNeighborVisits += centrality.communities.neighborVisits;
      if (centrality.communities.converged) communityConvergedProviders += 1;
      else communityIncompleteProviders += 1;
    }
    const communityMetrics = [...(centrality.communities?.byDomain.values() ?? [])];
    const communitySizes = new Map<string, number>();
    for (const community of communityMetrics)
      communitySizes.set(community.communityId, community.communitySize);
    providerSummaryRows.push({
      row_type: 'rank-weighted-source-network-provider-summary',
      provider: panel.provider,
      provider_prompt_groups: panel.promptGroups,
      complete_rank_weight_prompt_groups: rankPrompts.length,
      unknown_rank_detail_prompt_groups: unknown,
      rank_detail_complete: unknown === 0,
      provider_prompt_catalog_complete: panel.catalogComplete,
      domain_catalog_truncated: domainCatalogTruncated,
      network_complete: unknown === 0 && panel.catalogComplete && !domainCatalogTruncated,
      retained_source_domains: domains.length,
      retained_cocitation_edges: edges.length,
      community_count: communitySizes.size,
      largest_community_size: Math.max(0, ...communitySizes.values()),
      network_weighted_modularity:
        centrality.communities?.weightedModularity === null ||
        centrality.communities?.weightedModularity === undefined
          ? null
          : round(centrality.communities.weightedModularity, 8),
      community_detection_converged: centrality.communities?.converged ?? false,
      community_detection_iterations: centrality.communities?.iterations ?? 0,
      community_detection_neighbor_visits: centrality.communities?.neighborVisits ?? 0,
    });
    const providerNodeRows = domains.map((domain, index) => ({
      row_type: 'rank-weighted-source-node',
      provider: panel.provider,
      domain: domain.domain,
      discounted_citation_weight: round(domain.citationWeight),
      prompt_groups_with_source: domain.promptGroups,
      source_reach_percent:
        rankPrompts.length > 0 ? round((domain.promptGroups / rankPrompts.length) * 100, 4) : null,
      mean_prompt_rank_weight_share_percent:
        rankPrompts.length > 0
          ? round((domain.promptShareTotal / rankPrompts.length) * 100, 6)
          : null,
      ...centrality.rows[index],
      provider_prompt_groups: panel.promptGroups,
      complete_rank_weight_prompt_groups: rankPrompts.length,
      unknown_rank_detail_prompt_groups: unknown,
      rank_detail_complete: unknown === 0,
      provider_prompt_catalog_complete: panel.catalogComplete,
      domain_catalog_truncated: domainCatalogTruncated,
      network_complete: unknown === 0 && panel.catalogComplete && !domainCatalogTruncated,
    }));
    nodeRowsAvailable += providerNodeRows.length;
    if (nodeRows.length < MAX_NODE_ROWS)
      nodeRows.push(...providerNodeRows.slice(0, MAX_NODE_ROWS - nodeRows.length));

    const providerEdges: OutputEdge[] = edges
      .map((edge) => ({
        provider: panel.provider,
        edge,
        promptGroups: rankPrompts.length,
        unknown,
        catalogComplete: panel.catalogComplete,
        catalogTruncated: domainCatalogTruncated,
      }))
      .sort(compareEdges);
    edgeRowsAvailable += providerEdges.length;
    retainedEdges = [...retainedEdges, ...providerEdges].sort(compareEdges).slice(0, MAX_EDGE_ROWS);
  }

  const outputRowsTruncated =
    nodeRowsAvailable > nodeRows.length ||
    edgeRowsAvailable > retainedEdges.length ||
    providerSummaryRows.length > MAX_NETWORK_PROVIDER_SUMMARY_ROWS;
  const headers = [
    'row_type',
    'provider',
    'domain',
    'domain_a',
    'domain_b',
    'discounted_citation_weight',
    'prompt_groups_with_source',
    'source_reach_percent',
    'mean_prompt_rank_weight_share_percent',
    'network_degree',
    'rank_weighted_degree',
    'rank_weighted_pagerank',
    'connected_component_id',
    'connected_component_size',
    'community_id',
    'community_size',
    'community_internal_edge_count',
    'community_internal_rank_weighted_cooccurrence_strength',
    'community_external_rank_weighted_cooccurrence_strength',
    'community_internal_edge_strength_share',
    'community_modularity_contribution',
    'network_weighted_modularity',
    'community_detection_converged',
    'community_detection_iterations',
    'community_detection_neighbor_visits',
    'shared_exact_prompt_groups',
    'rank_weighted_cocitation_strength',
    'mean_rank_weighted_cocitation_strength_per_prompt',
    'jaccard_prompt_overlap',
    'cooccurrence_lift',
    'domain_a_given_b_prompt_rate_percent',
    'domain_b_given_a_prompt_rate_percent',
    'provider_prompt_groups',
    'complete_rank_weight_prompt_groups',
    'unknown_rank_detail_prompt_groups',
    'rank_detail_complete',
    'provider_prompt_catalog_complete',
    'domain_catalog_truncated',
    'network_complete',
    'retained_source_domains',
    'retained_cocitation_edges',
    'community_count',
    'largest_community_size',
    'providers_available',
    'providers_evaluated',
    'provider_panels_omitted_by_budget',
    'provider_panels_omitted_by_cap',
    'rank_detail_unknown_prompt_groups_total',
    'domain_catalog_truncated_providers',
    'node_prompt_checks_evaluated',
    'pair_prompt_updates_evaluated',
    'node_prompt_check_budget',
    'pair_prompt_update_budget',
    'domains_per_provider_cap',
    'provider_panel_cap',
    'output_nodes_available',
    'output_edges_available',
    'output_nodes_emitted',
    'output_edges_emitted',
    'community_detection_algorithm',
    'community_neighbor_visits_evaluated',
    'community_neighbor_visit_budget_per_provider',
    'community_iteration_cap',
    'community_converged_providers',
    'community_incomplete_providers',
    'output_provider_summaries_available',
    'output_provider_summaries_emitted',
    'output_provider_summary_cap',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note =
    'Rank weights use retained reciprocal-log-rank citation weights, normalized within each complete exact provider/prompt profile. Edge strength sums the geometric mean of the two source shares where both sources occur. Citation communities use deterministic weighted label propagation over this edge strength; per-provider work and convergence states are explicit. Weighted modularity compares community separation against a degree-preserving random-graph reference and is limited to the retained graph; it does not establish semantic coherence. Capped or inconsistent rank profiles are unknown, not absent. Centrality and communities describe this sampled graph and do not establish semantic agreement, influence, quality, or causation.';
  const summary: Record<string, unknown> = Object.fromEntries(
    headers.map((header) => [header, ''])
  );
  summary.row_type = 'summary';
  summary.providers_available = providerKeys.length;
  summary.providers_evaluated = panelsEvaluated;
  summary.provider_panels_omitted_by_budget = panelsOmittedByBudget;
  summary.provider_panels_omitted_by_cap = panelsOmittedByCap;
  summary.rank_detail_unknown_prompt_groups_total = rankUnknownPromptGroups;
  summary.domain_catalog_truncated_providers = truncatedDomainCatalogs;
  summary.node_prompt_checks_evaluated = nodePromptChecks;
  summary.pair_prompt_updates_evaluated = pairPromptUpdates;
  summary.node_prompt_check_budget = MAX_NODE_PROMPT_CHECKS;
  summary.pair_prompt_update_budget = MAX_PAIR_PROMPT_UPDATES;
  summary.domains_per_provider_cap = MAX_DOMAINS_PER_PROVIDER;
  summary.provider_panel_cap = MAX_PROVIDER_PANELS;
  summary.community_detection_algorithm = 'deterministic-weighted-label-propagation';
  summary.community_neighbor_visits_evaluated = communityNeighborVisits;
  summary.community_neighbor_visit_budget_per_provider = 50_000;
  summary.community_iteration_cap = 50;
  summary.community_converged_providers = communityConvergedProviders;
  summary.community_incomplete_providers = communityIncompleteProviders;
  summary.output_provider_summaries_available = providerSummaryRows.length;
  summary.output_provider_summaries_emitted = Math.min(
    providerSummaryRows.length,
    MAX_NETWORK_PROVIDER_SUMMARY_ROWS
  );
  summary.output_provider_summary_cap = MAX_NETWORK_PROVIDER_SUMMARY_ROWS;
  summary.output_nodes_available = nodeRowsAvailable;
  summary.output_edges_available = edgeRowsAvailable;
  summary.output_nodes_emitted = nodeRows.length;
  summary.output_edges_emitted = retainedEdges.length;
  summary.output_rows_truncated = outputRowsTruncated;
  summary.interpretation_note = note;
  const edgeRows = retainedEdges.map(
    ({ provider, edge, promptGroups, unknown, catalogComplete, catalogTruncated }) => {
      const promptUnion = edge.left.promptGroups + edge.right.promptGroups - edge.promptGroups;
      const expected =
        promptGroups > 0 ? (edge.left.promptGroups * edge.right.promptGroups) / promptGroups : 0;
      return {
        row_type: 'rank-weighted-source-edge',
        provider,
        domain_a: edge.left.domain,
        domain_b: edge.right.domain,
        shared_exact_prompt_groups: edge.promptGroups,
        rank_weighted_cocitation_strength: round(edge.strength),
        mean_rank_weighted_cocitation_strength_per_prompt:
          promptGroups > 0 ? round(edge.strength / promptGroups) : null,
        jaccard_prompt_overlap: promptUnion > 0 ? round(edge.promptGroups / promptUnion) : null,
        cooccurrence_lift: expected > 0 ? round(edge.promptGroups / expected) : null,
        domain_a_given_b_prompt_rate_percent:
          edge.right.promptGroups > 0
            ? round((edge.promptGroups / edge.right.promptGroups) * 100, 4)
            : null,
        domain_b_given_a_prompt_rate_percent:
          edge.left.promptGroups > 0
            ? round((edge.promptGroups / edge.left.promptGroups) * 100, 4)
            : null,
        provider_prompt_groups: promptGroups + unknown,
        complete_rank_weight_prompt_groups: promptGroups,
        unknown_rank_detail_prompt_groups: unknown,
        rank_detail_complete: unknown === 0,
        provider_prompt_catalog_complete: catalogComplete,
        domain_catalog_truncated: catalogTruncated,
        network_complete: unknown === 0 && catalogComplete && !catalogTruncated,
      };
    }
  );
  const rows: Array<Record<string, unknown>> = [
    summary,
    ...providerSummaryRows.slice(0, MAX_NETWORK_PROVIDER_SUMMARY_ROWS),
    ...nodeRows,
    ...edgeRows,
  ];
  return `${[headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(','))].join('\r\n')}\r\n`;
}

/** Compare reciprocal-log-rank-weighted provider source networks on shared exact prompts. */
export function renderAiAnswerCitationRankWeightedSourceNetworkComparisonCsv(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  const currentPanels = buildPanels(current);
  const baselinePanels = buildPanels(baseline);
  const providerKeys = [...new Set([...currentPanels.keys(), ...baselinePanels.keys()])].sort(
    (left, right) =>
      (currentPanels.get(left)?.provider ?? baselinePanels.get(left)!.provider).localeCompare(
        currentPanels.get(right)?.provider ?? baselinePanels.get(right)!.provider
      )
  );
  const pairedProviderKeys = providerKeys.filter(
    (key) => currentPanels.has(key) && baselinePanels.has(key)
  );
  const nodeRows: Array<Record<string, unknown>> = [];
  const providerRows: Array<Record<string, unknown>> = [];
  let nodeRowsAvailable = 0;
  type OutputEdge = { provider: string; row: Record<string, unknown>; change: number };
  let retainedEdges: OutputEdge[] = [];
  let edgeRowsAvailable = 0;
  type OutputTransition = { provider: string; row: Record<string, unknown>; sharedDomains: number };
  let retainedTransitions: OutputTransition[] = [];
  let transitionRowsAvailable = 0;
  let nodePromptChecks = 0;
  let pairPromptUpdates = 0;
  let providersEvaluated = 0;
  let providersOmittedByBudget = 0;
  let providersOmittedByCap = 0;
  let unknownRankPromptGroupsTotal = 0;
  let domainCatalogTruncatedProviders = 0;
  let communityNeighborVisits = 0;
  let communityConvergedProviderPeriods = 0;
  let communityIncompleteProviderPeriods = 0;
  const compareEdges = (left: OutputEdge, right: OutputEdge): number =>
    right.change - left.change ||
    left.provider.localeCompare(right.provider) ||
    String(left.row.domain_a).localeCompare(String(right.row.domain_a)) ||
    String(left.row.domain_b).localeCompare(String(right.row.domain_b));
  const compareTransitions = (left: OutputTransition, right: OutputTransition): number =>
    right.sharedDomains - left.sharedDomains ||
    left.provider.localeCompare(right.provider) ||
    String(left.row.baseline_community_id).localeCompare(String(right.row.baseline_community_id)) ||
    String(left.row.current_community_id).localeCompare(String(right.row.current_community_id));

  for (let providerIndex = 0; providerIndex < pairedProviderKeys.length; providerIndex += 1) {
    if (providersEvaluated >= MAX_PROVIDER_PANELS) {
      providersOmittedByCap = pairedProviderKeys.length - providerIndex;
      break;
    }
    const providerKey = pairedProviderKeys[providerIndex]!;
    const currentPanel = currentPanels.get(providerKey)!;
    const baselinePanel = baselinePanels.get(providerKey)!;
    const sharedPromptKeys = [...baselinePanel.profiles.keys()].filter((promptKey) =>
      currentPanel.profiles.has(promptKey)
    );
    const comparablePrompts: Array<{
      baselineWeights: Map<string, number>;
      currentWeights: Map<string, number>;
      baselineShares: Map<string, number>;
      currentShares: Map<string, number>;
    }> = [];
    let unknownRankPromptGroups = 0;
    const promptSupport = new Map<string, number>();
    const totalWeightByDomain = new Map<string, number>();
    for (const promptKey of sharedPromptKeys) {
      const baselineRank = completeRankWeights(baselinePanel.profiles.get(promptKey)!);
      const currentRank = completeRankWeights(currentPanel.profiles.get(promptKey)!);
      if (!baselineRank || !currentRank) {
        unknownRankPromptGroups += 1;
        continue;
      }
      const baselineShares = new Map(
        [...baselineRank.weights].map(([domain, weight]) => [
          domain,
          baselineRank.total > 0 ? weight / baselineRank.total : 0,
        ])
      );
      const currentShares = new Map(
        [...currentRank.weights].map(([domain, weight]) => [
          domain,
          currentRank.total > 0 ? weight / currentRank.total : 0,
        ])
      );
      comparablePrompts.push({
        baselineWeights: baselineRank.weights,
        currentWeights: currentRank.weights,
        baselineShares,
        currentShares,
      });
      for (const domain of new Set([...baselineShares.keys(), ...currentShares.keys()])) {
        const support = promptSupport.get(domain) ?? 0;
        promptSupport.set(domain, support + 1);
      }
      for (const [domain, weight] of baselineRank.weights)
        totalWeightByDomain.set(domain, (totalWeightByDomain.get(domain) ?? 0) + weight);
      for (const [domain, weight] of currentRank.weights)
        totalWeightByDomain.set(domain, (totalWeightByDomain.get(domain) ?? 0) + weight);
    }
    const allDomains = [...promptSupport.keys()].sort(
      (left, right) =>
        promptSupport.get(right)! - promptSupport.get(left)! ||
        totalWeightByDomain.get(right)! - totalWeightByDomain.get(left)! ||
        left.localeCompare(right)
    );
    const selectedDomains = allDomains.slice(0, MAX_DOMAINS_PER_PROVIDER);
    const domainCatalogTruncated = allDomains.length > selectedDomains.length;
    const domainIndex = new Map(selectedDomains.map((domain, index) => [domain, index]));
    const selectedPrompts = comparablePrompts.map((prompt) => ({
      baseline: [...prompt.baselineShares.keys()]
        .filter((domain) => domainIndex.has(domain))
        .map((domain) => domainIndex.get(domain)!)
        .sort((a, b) => a - b),
      current: [...prompt.currentShares.keys()]
        .filter((domain) => domainIndex.has(domain))
        .map((domain) => domainIndex.get(domain)!)
        .sort((a, b) => a - b),
      prompt,
    }));
    const providerNodeChecks = selectedPrompts.length * selectedDomains.length;
    const providerPairUpdates = selectedPrompts.reduce((sum, prompt) => {
      const baselinePairs = (prompt.baseline.length * (prompt.baseline.length - 1)) / 2;
      const currentPairs = (prompt.current.length * (prompt.current.length - 1)) / 2;
      return sum + baselinePairs + currentPairs + Math.min(baselinePairs, currentPairs);
    }, 0);
    if (
      nodePromptChecks + providerNodeChecks > MAX_NODE_PROMPT_CHECKS ||
      pairPromptUpdates + providerPairUpdates > MAX_PAIR_PROMPT_UPDATES
    ) {
      providersOmittedByBudget = pairedProviderKeys.length - providerIndex;
      break;
    }
    nodePromptChecks += providerNodeChecks;
    unknownRankPromptGroupsTotal += unknownRankPromptGroups;
    if (domainCatalogTruncated) domainCatalogTruncatedProviders += 1;
    providersEvaluated += 1;

    const baselineDomains: RankDomain[] = selectedDomains.map((domain) => ({
      domain,
      citationWeight: 0,
      promptGroups: 0,
      promptShareTotal: 0,
    }));
    const currentDomains: RankDomain[] = selectedDomains.map((domain) => ({
      domain,
      citationWeight: 0,
      promptGroups: 0,
      promptShareTotal: 0,
    }));
    const edgeStats = new Map<
      number,
      {
        baselinePrompts: number;
        currentPrompts: number;
        bothPrompts: number;
        baselineStrength: number;
        currentStrength: number;
      }
    >();
    const ensureEdge = (key: number) => {
      const existing = edgeStats.get(key);
      if (existing) return existing;
      const created = {
        baselinePrompts: 0,
        currentPrompts: 0,
        bothPrompts: 0,
        baselineStrength: 0,
        currentStrength: 0,
      };
      edgeStats.set(key, created);
      return created;
    };
    let actualPairPromptUpdates = 0;
    for (const prompt of selectedPrompts) {
      const baselineSet = new Set(prompt.baseline);
      const currentSet = new Set(prompt.current);
      for (
        let domainIndexValue = 0;
        domainIndexValue < selectedDomains.length;
        domainIndexValue += 1
      ) {
        const domainName = selectedDomains[domainIndexValue]!;
        const baselineDomain = baselineDomains[domainIndexValue]!;
        const currentDomain = currentDomains[domainIndexValue]!;
        if (baselineSet.has(domainIndexValue)) {
          baselineDomain.promptGroups += 1;
          baselineDomain.promptShareTotal += prompt.prompt.baselineShares.get(domainName) ?? 0;
          baselineDomain.citationWeight += prompt.prompt.baselineWeights.get(domainName) ?? 0;
        }
        if (currentSet.has(domainIndexValue)) {
          currentDomain.promptGroups += 1;
          currentDomain.promptShareTotal += prompt.prompt.currentShares.get(domainName) ?? 0;
          currentDomain.citationWeight += prompt.prompt.currentWeights.get(domainName) ?? 0;
        }
      }
      const baselinePairList = promptPairKeys(prompt.baseline, selectedDomains.length);
      const currentPairList = promptPairKeys(prompt.current, selectedDomains.length);
      const currentPairSet = new Set(currentPairList);
      for (const key of baselinePairList) {
        const edge = ensureEdge(key);
        edge.baselinePrompts += 1;
        const left = selectedDomains[Math.floor(key / selectedDomains.length)]!;
        const right = selectedDomains[key % selectedDomains.length]!;
        edge.baselineStrength += Math.sqrt(
          (prompt.prompt.baselineShares.get(left) ?? 0) *
            (prompt.prompt.baselineShares.get(right) ?? 0)
        );
        actualPairPromptUpdates += 1;
      }
      for (const key of currentPairList) {
        const edge = ensureEdge(key);
        edge.currentPrompts += 1;
        const left = selectedDomains[Math.floor(key / selectedDomains.length)]!;
        const right = selectedDomains[key % selectedDomains.length]!;
        edge.currentStrength += Math.sqrt(
          (prompt.prompt.currentShares.get(left) ?? 0) *
            (prompt.prompt.currentShares.get(right) ?? 0)
        );
        actualPairPromptUpdates += 1;
      }
      for (const key of baselinePairList) {
        if (!currentPairSet.has(key)) continue;
        ensureEdge(key).bothPrompts += 1;
        actualPairPromptUpdates += 1;
      }
    }
    pairPromptUpdates += actualPairPromptUpdates;

    const providerCatalogComplete = baselinePanel.catalogComplete && currentPanel.catalogComplete;
    const rankDetailComplete = unknownRankPromptGroups === 0;
    const networkComplete =
      providerCatalogComplete && rankDetailComplete && !domainCatalogTruncated;
    const periodEdges = (period: 'baseline' | 'current'): RankEdge[] =>
      [...edgeStats.entries()]
        .filter(
          ([, stats]) => stats[period === 'baseline' ? 'baselinePrompts' : 'currentPrompts'] > 0
        )
        .map(([key, stats]) => ({
          left: (period === 'baseline' ? baselineDomains : currentDomains)[
            Math.floor(key / selectedDomains.length)
          ]!,
          right: (period === 'baseline' ? baselineDomains : currentDomains)[
            key % selectedDomains.length
          ]!,
          promptGroups: stats[period === 'baseline' ? 'baselinePrompts' : 'currentPrompts'],
          strength: stats[period === 'baseline' ? 'baselineStrength' : 'currentStrength'],
        }));
    const baselineAnalysis = pageRankAndComponents(baselineDomains, periodEdges('baseline'));
    const currentAnalysis = pageRankAndComponents(currentDomains, periodEdges('current'));
    communityNeighborVisits +=
      (baselineAnalysis.communities?.neighborVisits ?? 0) +
      (currentAnalysis.communities?.neighborVisits ?? 0);
    for (const analysis of [baselineAnalysis, currentAnalysis]) {
      if (analysis.communities?.converged) communityConvergedProviderPeriods += 1;
      else communityIncompleteProviderPeriods += 1;
    }
    const baselineCentrality = baselineAnalysis.rows;
    const currentCentrality = currentAnalysis.rows;
    const baselineCommunityLabels = selectedDomains.map((_, index) =>
      String(baselineCentrality[index]?.community_id ?? '')
    );
    const currentCommunityLabels = selectedDomains.map((_, index) =>
      String(currentCentrality[index]?.community_id ?? '')
    );
    const communityStability = sourceCommunityAdjustedRandIndex(
      baselineCommunityLabels,
      currentCommunityLabels
    );
    const summarizePartition = (labels: string[]) => {
      const members = new Map<string, string[]>();
      labels.forEach((label, index) => {
        const group = members.get(label) ?? [];
        group.push(selectedDomains[index]!);
        members.set(label, group);
      });
      const signatures = new Map<string, string>();
      for (const [label, domains] of members) {
        signatures.set(
          label,
          JSON.stringify(domains.sort((left, right) => left.localeCompare(right)))
        );
      }
      return {
        signatures,
        count: members.size,
        sizes: [...members.values()].map((domains) => domains.length),
        sizesByLabel: new Map([...members].map(([label, domains]) => [label, domains.length])),
      };
    };
    const baselinePartition = summarizePartition(baselineCommunityLabels);
    const currentPartition = summarizePartition(currentCommunityLabels);
    let communityMembershipChanges = 0;
    for (let index = 0; index < selectedDomains.length; index += 1) {
      if (
        baselinePartition.signatures.get(baselineCommunityLabels[index]!) !==
        currentPartition.signatures.get(currentCommunityLabels[index]!)
      )
        communityMembershipChanges += 1;
    }
    const baselineConverged = baselineAnalysis.communities?.converged ?? false;
    const currentConverged = currentAnalysis.communities?.converged ?? false;
    const communityOverlaps = new Map<
      string,
      { baseline: string; current: string; domains: string[] }
    >();
    for (let index = 0; index < selectedDomains.length; index += 1) {
      const baseline = baselineCommunityLabels[index]!;
      const currentCommunity = currentCommunityLabels[index]!;
      const key = `${baseline}\u0000${currentCommunity}`;
      const overlap = communityOverlaps.get(key) ?? {
        baseline,
        current: currentCommunity,
        domains: [],
      };
      overlap.domains.push(selectedDomains[index]!);
      communityOverlaps.set(key, overlap);
    }
    const splitTargets = new Map<string, number>();
    const mergeSources = new Map<string, number>();
    for (const overlap of communityOverlaps.values()) {
      splitTargets.set(overlap.baseline, (splitTargets.get(overlap.baseline) ?? 0) + 1);
      mergeSources.set(overlap.current, (mergeSources.get(overlap.current) ?? 0) + 1);
    }
    const providerTransitions: OutputTransition[] = [...communityOverlaps.values()]
      .map((overlap) => {
        const baselineSignature = baselinePartition.signatures.get(overlap.baseline)!;
        const currentSignature = currentPartition.signatures.get(overlap.current)!;
        const shared = overlap.domains.length;
        const baselineSize = baselinePartition.sizesByLabel.get(overlap.baseline) ?? 0;
        const currentSize = currentPartition.sizesByLabel.get(overlap.current) ?? 0;
        const baselineSplitTargets = splitTargets.get(overlap.baseline) ?? 1;
        const currentMergeSources = mergeSources.get(overlap.current) ?? 1;
        const sameMembership = baselineSignature === currentSignature;
        const transitionType = sameMembership
          ? 'stable'
          : baselineSplitTargets > 1 && currentMergeSources > 1
            ? 'split-and-merge'
            : baselineSplitTargets > 1
              ? 'split'
              : currentMergeSources > 1
                ? 'merge'
                : 'reconfigured';
        const representative = overlap.domains[0]!;
        const index = selectedDomains.indexOf(representative);
        const row: Record<string, unknown> = {
          row_type: 'rank-weighted-community-transition',
          provider: currentPanel.provider,
          baseline_community_id: overlap.baseline,
          current_community_id: overlap.current,
          baseline_community_size: baselineSize,
          current_community_size: currentSize,
          transition_shared_domains: shared,
          baseline_member_retained_share: baselineSize > 0 ? round(shared / baselineSize, 6) : null,
          current_community_source_share: currentSize > 0 ? round(shared / currentSize, 6) : null,
          community_transition_jaccard:
            baselineSize + currentSize > shared
              ? round(shared / (baselineSize + currentSize - shared), 6)
              : null,
          baseline_community_split_targets: baselineSplitTargets,
          current_community_merged_sources: currentMergeSources,
          community_transition_type: transitionType,
          baseline_community_modularity_contribution:
            baselineCentrality[index]?.community_modularity_contribution,
          current_community_modularity_contribution:
            currentCentrality[index]?.community_modularity_contribution,
          baseline_community_converged: baselineConverged,
          current_community_converged: currentConverged,
          community_stability_complete: networkComplete && baselineConverged && currentConverged,
          provider_prompt_groups_baseline: baselinePanel.promptGroups,
          provider_prompt_groups_current: currentPanel.promptGroups,
          comparable_rank_weight_prompt_groups: comparablePrompts.length,
          network_complete: networkComplete,
        };
        return { provider: currentPanel.provider, row, sharedDomains: shared };
      })
      .sort(compareTransitions);
    transitionRowsAvailable += providerTransitions.length;
    retainedTransitions = [...retainedTransitions, ...providerTransitions]
      .sort(compareTransitions)
      .slice(0, MAX_COMPARISON_TRANSITION_ROWS);
    providerRows.push({
      row_type: 'rank-weighted-community-stability',
      provider: currentPanel.provider,
      baseline_community_count: baselinePartition.count,
      current_community_count: currentPartition.count,
      shared_domain_count: selectedDomains.length,
      adjusted_rand_index: communityStability === null ? null : round(communityStability, 6),
      community_membership_changed_sources: communityMembershipChanges,
      baseline_largest_community_size: Math.max(0, ...baselinePartition.sizes),
      current_largest_community_size: Math.max(0, ...currentPartition.sizes),
      baseline_community_converged: baselineConverged,
      current_community_converged: currentConverged,
      baseline_weighted_modularity:
        baselineAnalysis.communities?.weightedModularity === null ||
        baselineAnalysis.communities?.weightedModularity === undefined
          ? null
          : round(baselineAnalysis.communities.weightedModularity, 8),
      current_weighted_modularity:
        currentAnalysis.communities?.weightedModularity === null ||
        currentAnalysis.communities?.weightedModularity === undefined
          ? null
          : round(currentAnalysis.communities.weightedModularity, 8),
      weighted_modularity_change:
        baselineAnalysis.communities?.weightedModularity === null ||
        baselineAnalysis.communities?.weightedModularity === undefined ||
        currentAnalysis.communities?.weightedModularity === null ||
        currentAnalysis.communities?.weightedModularity === undefined
          ? null
          : round(
              currentAnalysis.communities.weightedModularity -
                baselineAnalysis.communities.weightedModularity,
              8
            ),
      community_stability_complete: networkComplete && baselineConverged && currentConverged,
      baseline_community_neighbor_visits: baselineAnalysis.communities?.neighborVisits ?? 0,
      current_community_neighbor_visits: currentAnalysis.communities?.neighborVisits ?? 0,
      baseline_community_iterations: baselineAnalysis.communities?.iterations ?? 0,
      current_community_iterations: currentAnalysis.communities?.iterations ?? 0,
      provider_prompt_groups_baseline: baselinePanel.promptGroups,
      provider_prompt_groups_current: currentPanel.promptGroups,
      shared_exact_prompt_groups: sharedPromptKeys.length,
      comparable_rank_weight_prompt_groups: comparablePrompts.length,
      unknown_rank_detail_prompt_groups: unknownRankPromptGroups,
      provider_prompt_catalog_complete: providerCatalogComplete,
      rank_detail_complete: rankDetailComplete,
      domain_catalog_truncated: domainCatalogTruncated,
      network_complete: networkComplete,
    });
    const providerNodeRows = selectedDomains.map((domain, index) => {
      const baseline = baselineDomains[index]!;
      const currentDomain = currentDomains[index]!;
      const baselineReach =
        comparablePrompts.length > 0
          ? (baseline.promptGroups / comparablePrompts.length) * 100
          : null;
      const currentReach =
        comparablePrompts.length > 0
          ? (currentDomain.promptGroups / comparablePrompts.length) * 100
          : null;
      return {
        row_type: 'rank-weighted-source-node-comparison',
        provider: currentPanel.provider,
        domain,
        baseline_discounted_citation_weight: round(baseline.citationWeight),
        current_discounted_citation_weight: round(currentDomain.citationWeight),
        baseline_prompt_groups_with_source: baseline.promptGroups,
        current_prompt_groups_with_source: currentDomain.promptGroups,
        baseline_source_reach_percent: baselineReach === null ? null : round(baselineReach, 4),
        current_source_reach_percent: currentReach === null ? null : round(currentReach, 4),
        source_reach_change_percentage_points:
          baselineReach === null || currentReach === null
            ? null
            : round(currentReach - baselineReach, 4),
        baseline_mean_prompt_rank_weight_share_percent:
          comparablePrompts.length > 0
            ? round((baseline.promptShareTotal / comparablePrompts.length) * 100, 6)
            : null,
        current_mean_prompt_rank_weight_share_percent:
          comparablePrompts.length > 0
            ? round((currentDomain.promptShareTotal / comparablePrompts.length) * 100, 6)
            : null,
        mean_prompt_rank_weight_share_change_percentage_points:
          comparablePrompts.length > 0
            ? round(
                ((currentDomain.promptShareTotal - baseline.promptShareTotal) /
                  comparablePrompts.length) *
                  100,
                6
              )
            : null,
        baseline_network_degree: baselineCentrality[index]?.network_degree,
        current_network_degree: currentCentrality[index]?.network_degree,
        network_degree_change:
          Number(currentCentrality[index]?.network_degree ?? 0) -
          Number(baselineCentrality[index]?.network_degree ?? 0),
        baseline_rank_weighted_degree: baselineCentrality[index]?.rank_weighted_degree,
        current_rank_weighted_degree: currentCentrality[index]?.rank_weighted_degree,
        rank_weighted_degree_change: round(
          Number(currentCentrality[index]?.rank_weighted_degree ?? 0) -
            Number(baselineCentrality[index]?.rank_weighted_degree ?? 0)
        ),
        baseline_rank_weighted_pagerank: baselineCentrality[index]?.rank_weighted_pagerank,
        current_rank_weighted_pagerank: currentCentrality[index]?.rank_weighted_pagerank,
        rank_weighted_pagerank_change: round(
          Number(currentCentrality[index]?.rank_weighted_pagerank ?? 0) -
            Number(baselineCentrality[index]?.rank_weighted_pagerank ?? 0),
          8
        ),
        baseline_component_id: baselineCentrality[index]?.connected_component_id,
        current_component_id: currentCentrality[index]?.connected_component_id,
        baseline_component_size: baselineCentrality[index]?.connected_component_size,
        current_component_size: currentCentrality[index]?.connected_component_size,
        baseline_community_id: baselineCentrality[index]?.community_id,
        current_community_id: currentCentrality[index]?.community_id,
        baseline_community_size: baselineCentrality[index]?.community_size,
        current_community_size: currentCentrality[index]?.community_size,
        community_membership_changed:
          baselinePartition.signatures.get(
            String(baselineCentrality[index]?.community_id ?? '')
          ) !==
          currentPartition.signatures.get(String(currentCentrality[index]?.community_id ?? '')),
        community_adjusted_rand_index:
          communityStability === null ? null : round(communityStability, 6),
        baseline_community_converged: baselineCentrality[index]?.community_detection_converged,
        current_community_converged: currentCentrality[index]?.community_detection_converged,
        baseline_community_modularity_contribution:
          baselineCentrality[index]?.community_modularity_contribution,
        current_community_modularity_contribution:
          currentCentrality[index]?.community_modularity_contribution,
        community_modularity_contribution_change:
          baselineCentrality[index]?.community_modularity_contribution === null ||
          currentCentrality[index]?.community_modularity_contribution === null
            ? null
            : round(
                Number(currentCentrality[index]?.community_modularity_contribution ?? 0) -
                  Number(baselineCentrality[index]?.community_modularity_contribution ?? 0),
                8
              ),
        baseline_network_weighted_modularity:
          baselineCentrality[index]?.network_weighted_modularity,
        current_network_weighted_modularity: currentCentrality[index]?.network_weighted_modularity,
        network_weighted_modularity_change:
          baselineCentrality[index]?.network_weighted_modularity === null ||
          currentCentrality[index]?.network_weighted_modularity === null
            ? null
            : round(
                Number(currentCentrality[index]?.network_weighted_modularity ?? 0) -
                  Number(baselineCentrality[index]?.network_weighted_modularity ?? 0),
                8
              ),
        provider_prompt_groups_baseline: baselinePanel.promptGroups,
        provider_prompt_groups_current: currentPanel.promptGroups,
        baseline_only_provider_prompt_groups: Math.max(
          0,
          baselinePanel.profiles.size - sharedPromptKeys.length
        ),
        current_only_provider_prompt_groups: Math.max(
          0,
          currentPanel.profiles.size - sharedPromptKeys.length
        ),
        shared_exact_prompt_groups: sharedPromptKeys.length,
        comparable_rank_weight_prompt_groups: comparablePrompts.length,
        unknown_rank_detail_prompt_groups: unknownRankPromptGroups,
        provider_prompt_catalog_complete: providerCatalogComplete,
        rank_detail_complete: rankDetailComplete,
        domain_catalog_truncated: domainCatalogTruncated,
        network_complete: networkComplete,
      };
    });
    nodeRowsAvailable += providerNodeRows.length;
    if (nodeRows.length < MAX_COMPARISON_NODE_ROWS)
      nodeRows.push(...providerNodeRows.slice(0, MAX_COMPARISON_NODE_ROWS - nodeRows.length));

    const providerEdges: OutputEdge[] = [...edgeStats.entries()]
      .filter(([, stats]) => stats.baselinePrompts > 0 || stats.currentPrompts > 0)
      .map(([key, stats]) => {
        const leftIndex = Math.floor(key / selectedDomains.length);
        const rightIndex = key % selectedDomains.length;
        const left = selectedDomains[leftIndex]!;
        const right = selectedDomains[rightIndex]!;
        const baselineLeft = baselineDomains[leftIndex]!;
        const baselineRight = baselineDomains[rightIndex]!;
        const currentLeft = currentDomains[leftIndex]!;
        const currentRight = currentDomains[rightIndex]!;
        const baselineUnion =
          baselineLeft.promptGroups + baselineRight.promptGroups - stats.baselinePrompts;
        const currentUnion =
          currentLeft.promptGroups + currentRight.promptGroups - stats.currentPrompts;
        const baselineExpected =
          comparablePrompts.length > 0
            ? (baselineLeft.promptGroups * baselineRight.promptGroups) / comparablePrompts.length
            : 0;
        const currentExpected =
          comparablePrompts.length > 0
            ? (currentLeft.promptGroups * currentRight.promptGroups) / comparablePrompts.length
            : 0;
        const row: Record<string, unknown> = {
          row_type: 'rank-weighted-source-edge-comparison',
          provider: currentPanel.provider,
          domain_a: left,
          domain_b: right,
          baseline_shared_exact_prompt_groups: stats.baselinePrompts,
          current_shared_exact_prompt_groups: stats.currentPrompts,
          gained_cocitation_prompt_groups: stats.currentPrompts - stats.bothPrompts,
          lost_cocitation_prompt_groups: stats.baselinePrompts - stats.bothPrompts,
          cocitation_present_both_periods: stats.bothPrompts,
          cocitation_absent_both_periods: Math.max(
            0,
            comparablePrompts.length -
              stats.baselinePrompts -
              stats.currentPrompts +
              stats.bothPrompts
          ),
          baseline_rank_weighted_cocitation_strength: round(stats.baselineStrength),
          current_rank_weighted_cocitation_strength: round(stats.currentStrength),
          rank_weighted_cocitation_strength_change: round(
            stats.currentStrength - stats.baselineStrength
          ),
          baseline_jaccard_prompt_overlap:
            baselineUnion > 0 ? round(stats.baselinePrompts / baselineUnion) : null,
          current_jaccard_prompt_overlap:
            currentUnion > 0 ? round(stats.currentPrompts / currentUnion) : null,
          jaccard_change:
            baselineUnion > 0 && currentUnion > 0
              ? round(stats.currentPrompts / currentUnion - stats.baselinePrompts / baselineUnion)
              : null,
          baseline_cooccurrence_lift:
            baselineExpected > 0 ? round(stats.baselinePrompts / baselineExpected) : null,
          current_cooccurrence_lift:
            currentExpected > 0 ? round(stats.currentPrompts / currentExpected) : null,
          provider_prompt_groups_baseline: baselinePanel.promptGroups,
          provider_prompt_groups_current: currentPanel.promptGroups,
          baseline_only_provider_prompt_groups: Math.max(
            0,
            baselinePanel.profiles.size - sharedPromptKeys.length
          ),
          current_only_provider_prompt_groups: Math.max(
            0,
            currentPanel.profiles.size - sharedPromptKeys.length
          ),
          shared_exact_prompt_groups: sharedPromptKeys.length,
          comparable_rank_weight_prompt_groups: comparablePrompts.length,
          unknown_rank_detail_prompt_groups: unknownRankPromptGroups,
          provider_prompt_catalog_complete: providerCatalogComplete,
          rank_detail_complete: rankDetailComplete,
          domain_catalog_truncated: domainCatalogTruncated,
          network_complete: networkComplete,
        };
        return {
          provider: currentPanel.provider,
          row,
          change: Math.abs(stats.currentStrength - stats.baselineStrength),
        };
      })
      .sort(compareEdges);
    edgeRowsAvailable += providerEdges.length;
    retainedEdges = [...retainedEdges, ...providerEdges]
      .sort(compareEdges)
      .slice(0, MAX_COMPARISON_EDGE_ROWS);
  }

  const outputRowsTruncated =
    nodeRowsAvailable > nodeRows.length ||
    edgeRowsAvailable > retainedEdges.length ||
    providerRows.length > MAX_COMPARISON_PROVIDER_ROWS ||
    transitionRowsAvailable > retainedTransitions.length;
  const headers = [
    'row_type',
    'provider',
    'domain',
    'domain_a',
    'domain_b',
    'baseline_discounted_citation_weight',
    'current_discounted_citation_weight',
    'baseline_prompt_groups_with_source',
    'current_prompt_groups_with_source',
    'baseline_source_reach_percent',
    'current_source_reach_percent',
    'source_reach_change_percentage_points',
    'baseline_mean_prompt_rank_weight_share_percent',
    'current_mean_prompt_rank_weight_share_percent',
    'mean_prompt_rank_weight_share_change_percentage_points',
    'baseline_network_degree',
    'current_network_degree',
    'network_degree_change',
    'baseline_rank_weighted_degree',
    'current_rank_weighted_degree',
    'rank_weighted_degree_change',
    'baseline_rank_weighted_pagerank',
    'current_rank_weighted_pagerank',
    'rank_weighted_pagerank_change',
    'baseline_component_id',
    'current_component_id',
    'baseline_component_size',
    'current_component_size',
    'baseline_community_id',
    'current_community_id',
    'baseline_community_size',
    'current_community_size',
    'community_membership_changed',
    'community_adjusted_rand_index',
    'baseline_community_converged',
    'current_community_converged',
    'baseline_community_modularity_contribution',
    'current_community_modularity_contribution',
    'community_modularity_contribution_change',
    'baseline_network_weighted_modularity',
    'current_network_weighted_modularity',
    'network_weighted_modularity_change',
    'baseline_community_count',
    'current_community_count',
    'shared_domain_count',
    'adjusted_rand_index',
    'community_membership_changed_sources',
    'baseline_largest_community_size',
    'current_largest_community_size',
    'transition_shared_domains',
    'baseline_member_retained_share',
    'current_community_source_share',
    'community_transition_jaccard',
    'baseline_community_split_targets',
    'current_community_merged_sources',
    'community_transition_type',
    'community_stability_complete',
    'baseline_weighted_modularity',
    'current_weighted_modularity',
    'weighted_modularity_change',
    'baseline_community_neighbor_visits',
    'current_community_neighbor_visits',
    'baseline_community_iterations',
    'current_community_iterations',
    'baseline_shared_exact_prompt_groups',
    'current_shared_exact_prompt_groups',
    'gained_cocitation_prompt_groups',
    'lost_cocitation_prompt_groups',
    'cocitation_present_both_periods',
    'cocitation_absent_both_periods',
    'baseline_rank_weighted_cocitation_strength',
    'current_rank_weighted_cocitation_strength',
    'rank_weighted_cocitation_strength_change',
    'baseline_jaccard_prompt_overlap',
    'current_jaccard_prompt_overlap',
    'jaccard_change',
    'baseline_cooccurrence_lift',
    'current_cooccurrence_lift',
    'provider_prompt_groups_baseline',
    'provider_prompt_groups_current',
    'baseline_only_provider_prompt_groups',
    'current_only_provider_prompt_groups',
    'shared_exact_prompt_groups',
    'comparable_rank_weight_prompt_groups',
    'unknown_rank_detail_prompt_groups',
    'provider_prompt_catalog_complete',
    'rank_detail_complete',
    'domain_catalog_truncated',
    'network_complete',
    'providers_available',
    'providers_with_both_samples',
    'providers_without_both_samples',
    'providers_evaluated',
    'providers_omitted_by_work_budget',
    'providers_omitted_by_panel_cap',
    'unknown_rank_detail_prompt_groups_total',
    'domain_catalog_truncated_providers',
    'node_prompt_checks_evaluated',
    'pair_prompt_updates_evaluated',
    'node_prompt_check_budget',
    'pair_prompt_update_budget',
    'domains_per_provider_cap',
    'provider_panel_cap',
    'community_detection_algorithm',
    'community_neighbor_visits_evaluated',
    'community_neighbor_visit_budget_per_graph',
    'community_iteration_cap',
    'community_converged_provider_periods',
    'community_incomplete_provider_periods',
    'output_provider_summaries_available',
    'output_provider_summaries_emitted',
    'output_provider_summary_cap',
    'output_community_transitions_available',
    'output_community_transitions_emitted',
    'output_community_transition_cap',
    'output_nodes_available',
    'output_edges_available',
    'output_nodes_emitted',
    'output_edges_emitted',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note =
    'This paired graph compares reciprocal-log-rank source shares over exact provider/prompt groups shared by baseline and current samples. Only profiles with complete rank-weight details in both periods are comparable; capped details remain unknown. A joint top-domain catalog is used, and co-citation gains/losses are prompt-level transitions. Provider summary rows compare weighted source-community partitions with the adjusted Rand index and weighted modularity; community-transition rows show stable, split, merged, and reconfigured groups by shared retained domains; node rows include period-local community labels and exact full-membership changes. Community assignments use bounded weighted label propagation, and incomplete convergence or a truncated domain catalog limits stability interpretation. Modularity compares retained-graph separation against a degree-preserving random-graph reference; it does not establish semantic coherence. Centrality and strength changes describe this matched captured sample, not source influence, quality, or causation.';
  const summary: Record<string, unknown> = Object.fromEntries(
    headers.map((header) => [header, ''])
  );
  summary.row_type = 'summary';
  summary.providers_available = providerKeys.length;
  summary.providers_with_both_samples = pairedProviderKeys.length;
  summary.providers_without_both_samples = providerKeys.length - pairedProviderKeys.length;
  summary.providers_evaluated = providersEvaluated;
  summary.providers_omitted_by_work_budget = providersOmittedByBudget;
  summary.providers_omitted_by_panel_cap = providersOmittedByCap;
  summary.unknown_rank_detail_prompt_groups_total = unknownRankPromptGroupsTotal;
  summary.domain_catalog_truncated_providers = domainCatalogTruncatedProviders;
  summary.node_prompt_checks_evaluated = nodePromptChecks;
  summary.pair_prompt_updates_evaluated = pairPromptUpdates;
  summary.node_prompt_check_budget = MAX_NODE_PROMPT_CHECKS;
  summary.pair_prompt_update_budget = MAX_PAIR_PROMPT_UPDATES;
  summary.domains_per_provider_cap = MAX_DOMAINS_PER_PROVIDER;
  summary.provider_panel_cap = MAX_PROVIDER_PANELS;
  summary.community_detection_algorithm = 'deterministic-weighted-label-propagation';
  summary.community_neighbor_visits_evaluated = communityNeighborVisits;
  summary.community_neighbor_visit_budget_per_graph = 50_000;
  summary.community_iteration_cap = 50;
  summary.community_converged_provider_periods = communityConvergedProviderPeriods;
  summary.community_incomplete_provider_periods = communityIncompleteProviderPeriods;
  summary.output_provider_summaries_available = providerRows.length;
  summary.output_provider_summaries_emitted = Math.min(
    providerRows.length,
    MAX_COMPARISON_PROVIDER_ROWS
  );
  summary.output_provider_summary_cap = MAX_COMPARISON_PROVIDER_ROWS;
  summary.output_community_transitions_available = transitionRowsAvailable;
  summary.output_community_transitions_emitted = retainedTransitions.length;
  summary.output_community_transition_cap = MAX_COMPARISON_TRANSITION_ROWS;
  summary.output_nodes_available = nodeRowsAvailable;
  summary.output_edges_available = edgeRowsAvailable;
  summary.output_nodes_emitted = nodeRows.length;
  summary.output_edges_emitted = retainedEdges.length;
  summary.output_rows_truncated = outputRowsTruncated;
  summary.interpretation_note = note;
  const rows: Array<Record<string, unknown>> = [
    summary,
    ...providerRows.slice(0, MAX_COMPARISON_PROVIDER_ROWS),
    ...retainedTransitions.map(({ row }) => row),
    ...nodeRows,
    ...retainedEdges.map(({ row }) => row),
  ];
  return `${[headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(','))].join('\r\n')}\r\n`;
}
