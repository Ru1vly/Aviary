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
const MAX_PAIR_PROMPT_COMPARISONS = 5_000_000;
const MAX_PAIRED_NODE_PROMPT_CHECKS = 5_000_000;
const MAX_PAIRED_EDGE_PROMPT_UPDATES = 5_000_000;
const MAX_OUTPUT_ROWS = 20_000;
const MAX_NETWORK_PROVIDER_SUMMARY_ROWS = MAX_PROVIDER_PANELS;
const MAX_OUTPUT_NODE_ROWS = Math.floor((MAX_OUTPUT_ROWS - MAX_NETWORK_PROVIDER_SUMMARY_ROWS) / 2);
const MAX_OUTPUT_EDGE_ROWS =
  MAX_OUTPUT_ROWS - MAX_NETWORK_PROVIDER_SUMMARY_ROWS - MAX_OUTPUT_NODE_ROWS;
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

interface PromptSourceSet {
  promptKey: string;
  domains: Set<string>;
}

interface ProviderSourcePanel {
  provider: string;
  promptGroups: number;
  profiles: Map<string, AiAnswerCitationPromptProviderProfile>;
  catalogComplete: boolean;
}

interface DomainNode {
  domain: string;
  citationEvents: number;
  promptGroups: number;
}

interface ProviderNetwork {
  provider: string;
  promptGroups: number;
  completeSourcePromptGroups: number;
  unknownSourcePromptGroups: number;
  catalogComplete: boolean;
  sourceDetailsComplete: boolean;
  domainCatalogTruncated: boolean;
  domains: DomainNode[];
  edges: Array<{
    left: DomainNode;
    right: DomainNode;
    both: number;
    leftOnly: number;
    rightOnly: number;
    neither: number;
    jaccard: number | null;
    lift: number | null;
    leftGivenRight: number | null;
    rightGivenLeft: number | null;
  }>;
  pairComparisons: number;
  complete: boolean;
}

interface PairedSourcePrompt {
  promptKey: string;
  baselineDomains: Set<string>;
  currentDomains: Set<string>;
  baselineEvents: Map<string, number>;
  currentEvents: Map<string, number>;
}

function normalizedLabel(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  const firstNonWhitespace = text.trimStart().charAt(0);
  if (typeof value !== 'number' && firstNonWhitespace && '=+-@'.includes(firstNonWhitespace))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildProviderPanels(
  report: AiAnswerCitationObservationReport
): Map<string, ProviderSourcePanel> {
  const panels = new Map<string, ProviderSourcePanel>();
  for (const provider of report.providers) {
    panels.set(normalizedLabel(provider.provider), {
      provider: provider.provider,
      promptGroups: provider.uniquePrompts,
      profiles: new Map(),
      catalogComplete: !report.promptsTruncated,
    });
  }
  for (const prompt of report.prompts) {
    const promptKey = normalizedLabel(prompt.prompt);
    if (!Array.isArray(prompt.providerProfiles)) {
      for (const panel of panels.values()) panel.catalogComplete = false;
      continue;
    }
    for (const profile of prompt.providerProfiles) {
      const key = normalizedLabel(profile.provider);
      const panel = panels.get(key) ?? {
        provider: profile.provider,
        promptGroups: 0,
        profiles: new Map<string, AiAnswerCitationPromptProviderProfile>(),
        catalogComplete: !report.promptsTruncated,
      };
      if (panel.profiles.has(promptKey)) panel.catalogComplete = false;
      else panel.profiles.set(promptKey, profile);
      panels.set(key, panel);
    }
  }
  for (const panel of panels.values()) {
    if (panel.profiles.size !== panel.promptGroups) panel.catalogComplete = false;
  }
  return panels;
}

function buildProviderNetwork(
  panel: ProviderSourcePanel,
  pairComparisonBudget: number
): { network?: ProviderNetwork; pairComparisons: number } {
  const eventsByDomain = new Map<string, number>();
  const promptsByDomain = new Map<string, number>();
  const promptSets: PromptSourceSet[] = [];
  let unknownSourcePromptGroups = 0;
  for (const [promptKey, profile] of panel.profiles) {
    const domainEvents = new Map<string, number>();
    let validDetail = true;
    for (const item of profile.citedDomainCitationEvents ?? []) {
      if (!Number.isFinite(item.citationEvents) || item.citationEvents < 0) {
        validDetail = false;
        continue;
      }
      const domain = item.domain.toLowerCase();
      domainEvents.set(domain, (domainEvents.get(domain) ?? 0) + item.citationEvents);
    }
    const listedEvents = [...domainEvents.values()].reduce((sum, events) => sum + events, 0);
    const detailComplete =
      Array.isArray(profile.citedDomainCitationEvents) &&
      profile.citedDomainsTruncated === false &&
      validDetail &&
      listedEvents === profile.citationEvents;
    if (!detailComplete) {
      unknownSourcePromptGroups += 1;
      continue;
    }
    const domains = new Set(
      [...domainEvents].filter(([, events]) => events > 0).map(([domain]) => domain)
    );
    promptSets.push({ promptKey, domains });
    for (const [domain, events] of domainEvents) {
      if (events <= 0) continue;
      eventsByDomain.set(domain, (eventsByDomain.get(domain) ?? 0) + events);
      promptsByDomain.set(domain, (promptsByDomain.get(domain) ?? 0) + 1);
    }
  }
  const allDomains = [...eventsByDomain.keys()].sort(
    (left, right) =>
      promptsByDomain.get(right)! - promptsByDomain.get(left)! ||
      eventsByDomain.get(right)! - eventsByDomain.get(left)! ||
      left.localeCompare(right)
  );
  const selectedDomains = allDomains.slice(0, MAX_DOMAINS_PER_PROVIDER);
  const selectedDomainSet = new Set(selectedDomains);
  const domainCatalogTruncated = allDomains.length > selectedDomains.length;
  const domains: DomainNode[] = selectedDomains.map((domain) => ({
    domain,
    citationEvents: eventsByDomain.get(domain) ?? 0,
    promptGroups: promptsByDomain.get(domain) ?? 0,
  }));
  const domainIndex = new Map(domains.map((domain, index) => [domain.domain, index]));
  const selectedPrompts = promptSets.map((prompt) =>
    [...prompt.domains]
      .filter((domain) => selectedDomainSet.has(domain))
      .map((domain) => domainIndex.get(domain)!)
      .sort((left, right) => left - right)
  );
  const estimatedPairComparisons = selectedPrompts.reduce(
    (sum, indexes) => sum + (indexes.length * (indexes.length - 1)) / 2,
    0
  );
  if (estimatedPairComparisons > pairComparisonBudget)
    return { pairComparisons: estimatedPairComparisons };
  const pairPromptCounts = new Map<number, number>();
  let pairComparisons = 0;
  for (const indexes of selectedPrompts) {
    for (let left = 0; left < indexes.length; left += 1) {
      for (let right = left + 1; right < indexes.length; right += 1) {
        const key = indexes[left]! * domains.length + indexes[right]!;
        pairPromptCounts.set(key, (pairPromptCounts.get(key) ?? 0) + 1);
        pairComparisons += 1;
      }
    }
  }
  const completeSourcePromptGroups = promptSets.length;
  const edges = [...pairPromptCounts.entries()].map(([key, both]) => {
    const leftIndex = Math.floor(key / domains.length);
    const rightIndex = key % domains.length;
    const left = domains[leftIndex]!;
    const right = domains[rightIndex]!;
    const leftOnly = left.promptGroups - both;
    const rightOnly = right.promptGroups - both;
    const neither = Math.max(
      0,
      completeSourcePromptGroups - left.promptGroups - right.promptGroups + both
    );
    const union = left.promptGroups + right.promptGroups - both;
    const expected =
      completeSourcePromptGroups > 0
        ? (left.promptGroups * right.promptGroups) / completeSourcePromptGroups
        : 0;
    return {
      left,
      right,
      both,
      leftOnly,
      rightOnly,
      neither,
      jaccard: union > 0 ? both / union : null,
      lift: expected > 0 ? both / expected : null,
      leftGivenRight: right.promptGroups > 0 ? both / right.promptGroups : null,
      rightGivenLeft: left.promptGroups > 0 ? both / left.promptGroups : null,
    };
  });
  const network: ProviderNetwork = {
    provider: panel.provider,
    promptGroups: panel.promptGroups,
    completeSourcePromptGroups,
    unknownSourcePromptGroups,
    catalogComplete: panel.catalogComplete,
    sourceDetailsComplete: unknownSourcePromptGroups === 0,
    domainCatalogTruncated,
    domains,
    edges,
    pairComparisons,
    complete: panel.catalogComplete && unknownSourcePromptGroups === 0 && !domainCatalogTruncated,
  };
  return { network, pairComparisons };
}

function attachNetworkCentrality(
  network: ProviderNetwork,
  includeCommunities = true
): { rows: Array<Record<string, unknown>>; communities: SourceCommunityDetection | null } {
  const count = network.domains.length;
  const domainIndexes = new Map(network.domains.map((domain, index) => [domain, index]));
  const parent = network.domains.map((_, index) => index);
  const findRoot = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[index] !== index) {
      const next = parent[index]!;
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const adjacency = Array.from({ length: count }, () => new Map<number, number>());
  for (const edge of network.edges) {
    const left = domainIndexes.get(edge.left);
    const right = domainIndexes.get(edge.right);
    if (left === undefined || right === undefined) continue;
    adjacency[left]!.set(right, edge.both);
    adjacency[right]!.set(left, edge.both);
    const leftRoot = findRoot(left);
    const rightRoot = findRoot(right);
    if (leftRoot !== rightRoot)
      parent[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
  }
  let pageRank = new Array<number>(count).fill(count > 0 ? 1 / count : 0);
  for (let iteration = 0; iteration < 100 && count > 0; iteration += 1) {
    const next = new Array<number>(count).fill(0.15 / count);
    let danglingMass = 0;
    for (let node = 0; node < count; node += 1) {
      const neighbors = adjacency[node]!;
      const totalWeight = [...neighbors.values()].reduce((sum, weight) => sum + weight, 0);
      if (totalWeight <= 0) {
        danglingMass += pageRank[node]!;
        continue;
      }
      for (const [neighbor, weight] of neighbors)
        next[neighbor]! += (0.85 * pageRank[node]! * weight) / totalWeight;
    }
    for (let node = 0; node < count; node += 1) next[node]! += (0.85 * danglingMass) / count;
    const difference = next.reduce(
      (sum, value, node) => sum + Math.abs(value - pageRank[node]!),
      0
    );
    pageRank = next;
    if (difference < 1e-12) break;
  }
  const components = new Map<number, string[]>();
  network.domains.forEach((domain, index) => {
    const root = findRoot(index);
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
        network.domains.map((domain) => domain.domain),
        network.edges.map((edge) => ({
          left: edge.left.domain,
          right: edge.right.domain,
          weight: edge.both,
        }))
      )
    : null;
  const rows = network.domains.map((domain, index) => {
    const weightedDegree = [...adjacency[index]!.values()].reduce((sum, weight) => sum + weight, 0);
    const community = communities?.byDomain.get(domain.domain);
    return {
      row_type: 'source-node',
      provider: network.provider,
      domain: domain.domain,
      citation_events: domain.citationEvents,
      prompt_groups_with_source: domain.promptGroups,
      source_reach_percent:
        network.completeSourcePromptGroups > 0
          ? round((domain.promptGroups / network.completeSourcePromptGroups) * 100, 4)
          : null,
      network_degree: adjacency[index]!.size,
      weighted_degree_prompt_cooccurrences: weightedDegree,
      pagerank_centrality: round(pageRank[index] ?? 0, 8),
      connected_component_id: componentIds.get(domain.domain),
      connected_component_size: componentSizes.get(componentIds.get(domain.domain) ?? '') ?? 1,
      ...(community
        ? {
            community_id: community.communityId,
            community_size: community.communitySize,
            community_internal_edge_count: community.communityInternalEdgeCount,
            community_internal_prompt_cooccurrences: round(
              community.communityInternalCooccurrenceWeight
            ),
            community_external_prompt_cooccurrences: round(
              community.communityExternalCooccurrenceWeight
            ),
            community_internal_edge_share:
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
      provider_prompt_groups: network.promptGroups,
      complete_source_prompt_groups: network.completeSourcePromptGroups,
      unknown_source_detail_prompt_groups: network.unknownSourcePromptGroups,
      provider_prompt_catalog_complete: network.catalogComplete,
      source_detail_complete: network.sourceDetailsComplete,
      domain_catalog_truncated: network.domainCatalogTruncated,
      network_complete: network.complete,
    };
  });
  return { rows, communities };
}

/** Export source-domain co-citation edges and weighted network centrality by provider. */
export function renderAiAnswerCitationSourceNetworkCsv(
  report: AiAnswerCitationObservationReport
): string {
  const panels = buildProviderPanels(report);
  const providerKeys = [...panels.keys()].sort((left, right) =>
    panels.get(left)!.provider.localeCompare(panels.get(right)!.provider)
  );
  let providersEvaluated = 0;
  let pairComparisons = 0;
  let providerPanelsOmittedByBudget = 0;
  let outputNodeRowsAvailable = 0;
  let communityNeighborVisits = 0;
  let communityConvergedProviders = 0;
  let communityIncompleteProviders = 0;
  const providerSummaryRows: Array<Record<string, unknown>> = [];
  const outputNodeRows: Array<Record<string, unknown>> = [];
  type OutputEdge = {
    provider: string;
    edge: ProviderNetwork['edges'][number];
    providerPromptGroups: number;
    completeSourcePromptGroups: number;
    unknownSourcePromptGroups: number;
    catalogComplete: boolean;
    sourceDetailsComplete: boolean;
    domainCatalogTruncated: boolean;
    networkComplete: boolean;
  };
  const compareOutputEdges = (left: OutputEdge, right: OutputEdge): number =>
    right.edge.both - left.edge.both ||
    left.provider.localeCompare(right.provider) ||
    left.edge.left.domain.localeCompare(right.edge.left.domain) ||
    left.edge.right.domain.localeCompare(right.edge.right.domain);
  let retainedEdges: OutputEdge[] = [];
  let outputEdgesAvailable = 0;
  for (const providerKey of providerKeys) {
    if (providersEvaluated >= MAX_PROVIDER_PANELS) {
      providerPanelsOmittedByBudget = providerKeys.length - providersEvaluated;
      break;
    }
    const panel = panels.get(providerKey)!;
    const built = buildProviderNetwork(panel, MAX_PAIR_PROMPT_COMPARISONS - pairComparisons);
    if (!built.network) {
      providerPanelsOmittedByBudget = providerKeys.length - providersEvaluated;
      break;
    }
    const { network } = built;
    pairComparisons += network.pairComparisons;
    providersEvaluated += 1;
    const attached = attachNetworkCentrality(network);
    const nodeRows = attached.rows;
    if (attached.communities) {
      communityNeighborVisits += attached.communities.neighborVisits;
      if (attached.communities.converged) communityConvergedProviders += 1;
      else communityIncompleteProviders += 1;
    }
    const communityMetrics = [...(attached.communities?.byDomain.values() ?? [])];
    const communitySizes = new Map<string, number>();
    for (const community of communityMetrics)
      communitySizes.set(community.communityId, community.communitySize);
    providerSummaryRows.push({
      row_type: 'source-network-provider-summary',
      provider: network.provider,
      provider_prompt_groups: network.promptGroups,
      complete_source_prompt_groups: network.completeSourcePromptGroups,
      unknown_source_detail_prompt_groups: network.unknownSourcePromptGroups,
      provider_prompt_catalog_complete: network.catalogComplete,
      source_detail_complete: network.sourceDetailsComplete,
      domain_catalog_truncated: network.domainCatalogTruncated,
      network_complete: network.complete,
      retained_source_domains: network.domains.length,
      retained_cocitation_edges: network.edges.length,
      community_count: communitySizes.size,
      largest_community_size: Math.max(0, ...communitySizes.values()),
      network_weighted_modularity:
        attached.communities?.weightedModularity === null ||
        attached.communities?.weightedModularity === undefined
          ? null
          : round(attached.communities.weightedModularity, 8),
      community_detection_converged: attached.communities?.converged ?? false,
      community_detection_iterations: attached.communities?.iterations ?? 0,
      community_detection_neighbor_visits: attached.communities?.neighborVisits ?? 0,
    });
    outputNodeRowsAvailable += nodeRows.length;
    if (outputNodeRows.length < MAX_OUTPUT_NODE_ROWS) {
      outputNodeRows.push(...nodeRows.slice(0, MAX_OUTPUT_NODE_ROWS - outputNodeRows.length));
    }
    outputEdgesAvailable += network.edges.length;
    const providerEdges = network.edges
      .map((edge) => ({
        provider: network.provider,
        edge,
        providerPromptGroups: network.promptGroups,
        completeSourcePromptGroups: network.completeSourcePromptGroups,
        unknownSourcePromptGroups: network.unknownSourcePromptGroups,
        catalogComplete: network.catalogComplete,
        sourceDetailsComplete: network.sourceDetailsComplete,
        domainCatalogTruncated: network.domainCatalogTruncated,
        networkComplete: network.complete,
      }))
      .sort(compareOutputEdges);
    retainedEdges = [...retainedEdges, ...providerEdges]
      .sort(compareOutputEdges)
      .slice(0, MAX_OUTPUT_EDGE_ROWS);
  }
  const outputRowsTruncated =
    outputNodeRowsAvailable > outputNodeRows.length ||
    outputEdgesAvailable > retainedEdges.length ||
    providerSummaryRows.length > MAX_NETWORK_PROVIDER_SUMMARY_ROWS;
  const nodeRows = outputNodeRows;
  const edgeRows = retainedEdges.map(
    ({
      provider,
      edge,
      providerPromptGroups,
      completeSourcePromptGroups,
      unknownSourcePromptGroups,
      catalogComplete,
      sourceDetailsComplete,
      domainCatalogTruncated,
      networkComplete,
    }) => ({
      row_type: 'source-edge',
      provider,
      domain_a: edge.left.domain,
      domain_b: edge.right.domain,
      shared_exact_prompt_groups: edge.both,
      domain_a_only_prompt_groups: edge.leftOnly,
      domain_b_only_prompt_groups: edge.rightOnly,
      neither_prompt_groups: edge.neither,
      jaccard_prompt_overlap: edge.jaccard === null ? null : round(edge.jaccard, 6),
      cooccurrence_lift: edge.lift === null ? null : round(edge.lift, 6),
      domain_a_given_b_prompt_rate_percent:
        edge.leftGivenRight === null ? null : round(edge.leftGivenRight * 100, 4),
      domain_b_given_a_prompt_rate_percent:
        edge.rightGivenLeft === null ? null : round(edge.rightGivenLeft * 100, 4),
      provider_prompt_groups: providerPromptGroups,
      complete_source_prompt_groups: completeSourcePromptGroups,
      unknown_source_detail_prompt_groups: unknownSourcePromptGroups,
      provider_prompt_catalog_complete: catalogComplete,
      source_detail_complete: sourceDetailsComplete,
      domain_catalog_truncated: domainCatalogTruncated,
      network_complete: networkComplete,
    })
  );
  const headers = [
    'row_type',
    'provider',
    'domain',
    'citation_events',
    'prompt_groups_with_source',
    'source_reach_percent',
    'network_degree',
    'weighted_degree_prompt_cooccurrences',
    'pagerank_centrality',
    'connected_component_id',
    'connected_component_size',
    'community_id',
    'community_size',
    'community_internal_edge_count',
    'community_internal_prompt_cooccurrences',
    'community_external_prompt_cooccurrences',
    'community_internal_edge_share',
    'community_modularity_contribution',
    'network_weighted_modularity',
    'community_detection_converged',
    'community_detection_iterations',
    'community_detection_neighbor_visits',
    'domain_a',
    'domain_b',
    'shared_exact_prompt_groups',
    'domain_a_only_prompt_groups',
    'domain_b_only_prompt_groups',
    'neither_prompt_groups',
    'jaccard_prompt_overlap',
    'cooccurrence_lift',
    'domain_a_given_b_prompt_rate_percent',
    'domain_b_given_a_prompt_rate_percent',
    'provider_prompt_groups',
    'complete_source_prompt_groups',
    'unknown_source_detail_prompt_groups',
    'provider_prompt_catalog_complete',
    'source_detail_complete',
    'domain_catalog_truncated',
    'network_complete',
    'retained_source_domains',
    'retained_cocitation_edges',
    'community_count',
    'largest_community_size',
    'providers_available',
    'providers_evaluated',
    'provider_panels_omitted_by_budget',
    'pair_prompt_comparisons_evaluated',
    'domains_per_provider_cap',
    'pair_prompt_comparison_budget',
    'community_detection_algorithm',
    'community_neighbor_visits_evaluated',
    'community_neighbor_visit_budget_per_provider',
    'community_iteration_cap',
    'community_converged_providers',
    'community_incomplete_providers',
    'output_provider_summaries_available',
    'output_provider_summaries_emitted',
    'output_provider_summary_cap',
    'output_nodes_available',
    'output_edges_available',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note =
    'Nodes and edges use exact provider/prompt groups with complete retained cited-domain detail; capped source lists are unknown, not absent. Edges count prompt-level co-citation and report Jaccard, lift over the complete prompt panel, and directional conditional rates. Weighted degree and PageRank use retained co-citation prompt support among the top source domains. Citation communities use deterministic weighted label propagation on retained co-occurrence edges; per-provider neighbor-visit/iteration caps and convergence are explicit. Provider prompts repeat within groups are pooled to presence. This network describes sampled source co-occurrence, not semantic agreement, endorsements, trust, influence, or causation.';
  const summary: Record<string, unknown> = Object.fromEntries(
    headers.map((header) => [header, ''])
  );
  summary.row_type = 'summary';
  summary.providers_available = providerKeys.length;
  summary.providers_evaluated = providersEvaluated;
  summary.provider_panels_omitted_by_budget = providerPanelsOmittedByBudget;
  summary.pair_prompt_comparisons_evaluated = pairComparisons;
  summary.domains_per_provider_cap = MAX_DOMAINS_PER_PROVIDER;
  summary.pair_prompt_comparison_budget = MAX_PAIR_PROMPT_COMPARISONS;
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
  summary.output_nodes_available = outputNodeRowsAvailable;
  summary.output_edges_available = outputEdgesAvailable;
  summary.output_rows_truncated = outputRowsTruncated;
  summary.interpretation_note = note;
  const rows: Array<Record<string, unknown>> = [
    summary,
    ...providerSummaryRows.slice(0, MAX_NETWORK_PROVIDER_SUMMARY_ROWS),
    ...nodeRows,
    ...edgeRows,
  ];
  return `${[headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(','))].join('\r\n')}\r\n`;
}

function completeDomainEvents(
  profile: AiAnswerCitationPromptProviderProfile
): Map<string, number> | null {
  if (
    !Array.isArray(profile.citedDomainCitationEvents) ||
    profile.citedDomainsTruncated !== false ||
    !Number.isFinite(profile.citationEvents) ||
    profile.citationEvents < 0
  )
    return null;
  const events = new Map<string, number>();
  for (const item of profile.citedDomainCitationEvents) {
    if (!Number.isFinite(item.citationEvents) || item.citationEvents < 0) return null;
    const domain = item.domain.toLowerCase();
    events.set(domain, (events.get(domain) ?? 0) + item.citationEvents);
  }
  const listedEvents = [...events.values()].reduce((sum, count) => sum + count, 0);
  return listedEvents === profile.citationEvents ? events : null;
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

function pairRate(
  both: number,
  left: number,
  right: number,
  promptGroups: number
): {
  jaccard: number | null;
  lift: number | null;
  leftGivenRight: number | null;
  rightGivenLeft: number | null;
} {
  const union = left + right - both;
  const expected = promptGroups > 0 ? (left * right) / promptGroups : 0;
  return {
    jaccard: union > 0 ? both / union : null,
    lift: expected > 0 ? both / expected : null,
    leftGivenRight: right > 0 ? both / right : null,
    rightGivenLeft: left > 0 ? both / left : null,
  };
}

/** Compare provider-specific citation source networks on matched exact prompts across two samples. */
export function renderAiAnswerCitationSourceNetworkComparisonCsv(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  const currentPanels = buildProviderPanels(current);
  const baselinePanels = buildProviderPanels(baseline);
  const providerKeys = [...new Set([...currentPanels.keys(), ...baselinePanels.keys()])].sort(
    (left, right) =>
      (currentPanels.get(left)?.provider ?? baselinePanels.get(left)!.provider).localeCompare(
        currentPanels.get(right)?.provider ?? baselinePanels.get(right)!.provider
      )
  );
  const pairedProviderKeys = providerKeys.filter(
    (key) => currentPanels.has(key) && baselinePanels.has(key)
  );
  let providersEvaluated = 0;
  const nodeRows: Array<Record<string, unknown>> = [];
  const providerRows: Array<Record<string, unknown>> = [];
  let nodeRowsAvailable = 0;
  type OutputEdge = { provider: string; row: Record<string, unknown>; change: number };
  type OutputTransition = { provider: string; row: Record<string, unknown>; sharedDomains: number };
  let retainedEdges: OutputEdge[] = [];
  let retainedTransitions: OutputTransition[] = [];
  let edgeRowsAvailable = 0;
  let transitionRowsAvailable = 0;
  let nodePromptChecks = 0;
  let edgePromptUpdates = 0;
  let providersOmittedByBudget = 0;
  let providersOmittedByPanelCap = 0;
  let sourceDetailUnknownPromptGroups = 0;
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
      providersOmittedByPanelCap = pairedProviderKeys.length - providerIndex;
      break;
    }
    const providerKey = pairedProviderKeys[providerIndex]!;
    const currentPanel = currentPanels.get(providerKey)!;
    const baselinePanel = baselinePanels.get(providerKey)!;
    const sharedPromptKeys = [...baselinePanel.profiles.keys()].filter((promptKey) =>
      currentPanel.profiles.has(promptKey)
    );
    const promptPairs: PairedSourcePrompt[] = [];
    let unknownPromptGroups = 0;
    for (const promptKey of sharedPromptKeys) {
      const baselineEvents = completeDomainEvents(baselinePanel.profiles.get(promptKey)!);
      const currentEvents = completeDomainEvents(currentPanel.profiles.get(promptKey)!);
      if (!baselineEvents || !currentEvents) {
        unknownPromptGroups += 1;
        continue;
      }
      promptPairs.push({
        promptKey,
        baselineDomains: new Set(
          [...baselineEvents].filter(([, events]) => events > 0).map(([domain]) => domain)
        ),
        currentDomains: new Set(
          [...currentEvents].filter(([, events]) => events > 0).map(([domain]) => domain)
        ),
        baselineEvents,
        currentEvents,
      });
    }
    const promptSupport = new Map<string, number>();
    const eventSupport = new Map<string, number>();
    const baselineEventsByDomain = new Map<string, number>();
    const currentEventsByDomain = new Map<string, number>();
    for (const prompt of promptPairs) {
      for (const domain of new Set([...prompt.baselineDomains, ...prompt.currentDomains])) {
        promptSupport.set(domain, (promptSupport.get(domain) ?? 0) + 1);
      }
      for (const domain of prompt.baselineDomains) {
        const events = prompt.baselineEvents.get(domain) ?? 0;
        baselineEventsByDomain.set(domain, (baselineEventsByDomain.get(domain) ?? 0) + events);
        eventSupport.set(domain, (eventSupport.get(domain) ?? 0) + events);
      }
      for (const domain of prompt.currentDomains) {
        const events = prompt.currentEvents.get(domain) ?? 0;
        currentEventsByDomain.set(domain, (currentEventsByDomain.get(domain) ?? 0) + events);
        eventSupport.set(domain, (eventSupport.get(domain) ?? 0) + events);
      }
    }
    const allDomains = [...promptSupport.keys()].sort(
      (left, right) =>
        promptSupport.get(right)! - promptSupport.get(left)! ||
        eventSupport.get(right)! - eventSupport.get(left)! ||
        left.localeCompare(right)
    );
    const selectedDomains = allDomains.slice(0, MAX_DOMAINS_PER_PROVIDER);
    const domainCatalogTruncated = allDomains.length > selectedDomains.length;
    const domainIndex = new Map(selectedDomains.map((domain, index) => [domain, index]));
    const selectedPrompts = promptPairs.map((prompt) => ({
      baseline: [...prompt.baselineDomains]
        .filter((domain) => domainIndex.has(domain))
        .map((domain) => domainIndex.get(domain)!)
        .sort((a, b) => a - b),
      current: [...prompt.currentDomains]
        .filter((domain) => domainIndex.has(domain))
        .map((domain) => domainIndex.get(domain)!)
        .sort((a, b) => a - b),
    }));
    const providerNodeChecks = selectedPrompts.length * selectedDomains.length;
    let providerEdgeUpdates = 0;
    for (const prompt of selectedPrompts) {
      const baselinePairs = (prompt.baseline.length * (prompt.baseline.length - 1)) / 2;
      const currentPairs = (prompt.current.length * (prompt.current.length - 1)) / 2;
      providerEdgeUpdates += baselinePairs + currentPairs + Math.min(baselinePairs, currentPairs);
    }
    if (
      nodePromptChecks + providerNodeChecks > MAX_PAIRED_NODE_PROMPT_CHECKS ||
      edgePromptUpdates + providerEdgeUpdates > MAX_PAIRED_EDGE_PROMPT_UPDATES
    ) {
      providersOmittedByBudget = pairedProviderKeys.length - providerIndex;
      break;
    }
    nodePromptChecks += providerNodeChecks;
    sourceDetailUnknownPromptGroups += unknownPromptGroups;
    if (domainCatalogTruncated) domainCatalogTruncatedProviders += 1;

    const domainPromptCounts = new Map<string, { baseline: number; current: number }>();
    for (const domain of selectedDomains)
      domainPromptCounts.set(domain, { baseline: 0, current: 0 });
    const edgeCounts = new Map<number, { baseline: number; current: number; both: number }>();
    let actualProviderEdgeUpdates = 0;
    const ensureEdge = (key: number) => {
      const existing = edgeCounts.get(key);
      if (existing) return existing;
      const created = { baseline: 0, current: 0, both: 0 };
      edgeCounts.set(key, created);
      return created;
    };
    for (let index = 0; index < selectedPrompts.length; index += 1) {
      const prompt = selectedPrompts[index]!;
      const baselineSourceIndexes = new Set(prompt.baseline);
      const currentSourceIndexes = new Set(prompt.current);
      for (let domain = 0; domain < selectedDomains.length; domain += 1) {
        const counts = domainPromptCounts.get(selectedDomains[domain]!)!;
        if (baselineSourceIndexes.has(domain)) counts.baseline += 1;
        if (currentSourceIndexes.has(domain)) counts.current += 1;
      }
      const baselinePairList = promptPairKeys(prompt.baseline, selectedDomains.length);
      const currentPairList = promptPairKeys(prompt.current, selectedDomains.length);
      const currentPairSet = new Set(currentPairList);
      for (const key of baselinePairList) {
        ensureEdge(key).baseline += 1;
        actualProviderEdgeUpdates += 1;
      }
      for (const key of currentPairList) {
        ensureEdge(key).current += 1;
        actualProviderEdgeUpdates += 1;
      }
      for (const key of baselinePairList) {
        if (!currentPairSet.has(key)) continue;
        ensureEdge(key).both += 1;
        actualProviderEdgeUpdates += 1;
      }
    }
    edgePromptUpdates += actualProviderEdgeUpdates;

    const providerCatalogComplete = currentPanel.catalogComplete && baselinePanel.catalogComplete;
    const sourceDetailsComplete = unknownPromptGroups === 0;
    const networkComplete =
      providerCatalogComplete && sourceDetailsComplete && !domainCatalogTruncated;
    const nodesForPeriod = (period: 'baseline' | 'current'): DomainNode[] =>
      selectedDomains.map((domain) => ({
        domain,
        citationEvents:
          (period === 'baseline' ? baselineEventsByDomain : currentEventsByDomain).get(domain) ?? 0,
        promptGroups: domainPromptCounts.get(domain)?.[period] ?? 0,
      }));
    const networkForPeriod = (period: 'baseline' | 'current'): ProviderNetwork => {
      const nodes = nodesForPeriod(period);
      const edges = [...edgeCounts.entries()]
        .filter(([, counts]) => counts[period] > 0)
        .map(([key, counts]) => {
          const left = nodes[Math.floor(key / selectedDomains.length)]!;
          const right = nodes[key % selectedDomains.length]!;
          const both = counts[period];
          const union = left.promptGroups + right.promptGroups - both;
          const expected =
            promptPairs.length > 0
              ? (left.promptGroups * right.promptGroups) / promptPairs.length
              : 0;
          return {
            left,
            right,
            both,
            leftOnly: left.promptGroups - both,
            rightOnly: right.promptGroups - both,
            neither: Math.max(
              0,
              promptPairs.length - left.promptGroups - right.promptGroups + both
            ),
            jaccard: union > 0 ? both / union : null,
            lift: expected > 0 ? both / expected : null,
            leftGivenRight: right.promptGroups > 0 ? both / right.promptGroups : null,
            rightGivenLeft: left.promptGroups > 0 ? both / left.promptGroups : null,
          };
        });
      return {
        provider: currentPanel.provider,
        promptGroups:
          period === 'baseline' ? baselinePanel.promptGroups : currentPanel.promptGroups,
        completeSourcePromptGroups: promptPairs.length,
        unknownSourcePromptGroups: unknownPromptGroups,
        catalogComplete: providerCatalogComplete,
        sourceDetailsComplete,
        domainCatalogTruncated,
        domains: nodes,
        edges,
        pairComparisons: actualProviderEdgeUpdates,
        complete: networkComplete,
      };
    };
    const baselineNetwork = networkForPeriod('baseline');
    const currentNetwork = networkForPeriod('current');
    providersEvaluated += 1;
    const baselineAnalysis = attachNetworkCentrality(baselineNetwork);
    const currentAnalysis = attachNetworkCentrality(currentNetwork);
    communityNeighborVisits +=
      (baselineAnalysis.communities?.neighborVisits ?? 0) +
      (currentAnalysis.communities?.neighborVisits ?? 0);
    for (const analysis of [baselineAnalysis, currentAnalysis]) {
      if (analysis.communities?.converged) communityConvergedProviderPeriods += 1;
      else communityIncompleteProviderPeriods += 1;
    }
    const baselineCentrality = new Map(
      baselineAnalysis.rows.map((row) => [String(row.domain), row])
    );
    const currentCentrality = new Map(currentAnalysis.rows.map((row) => [String(row.domain), row]));
    const baselineCommunityLabels = selectedDomains.map((domain) =>
      String(baselineCentrality.get(domain)?.community_id ?? '')
    );
    const currentCommunityLabels = selectedDomains.map((domain) =>
      String(currentCentrality.get(domain)?.community_id ?? '')
    );
    const communityStability = sourceCommunityAdjustedRandIndex(
      baselineCommunityLabels,
      currentCommunityLabels
    );
    const membershipByCommunity = (
      labels: string[]
    ): Map<string, { signature: string; size: number }> => {
      const members = new Map<string, string[]>();
      labels.forEach((label, index) => {
        const group = members.get(label) ?? [];
        group.push(selectedDomains[index]!);
        members.set(label, group);
      });
      return new Map(
        [...members].map(([label, domains]) => {
          const sortedDomains = domains.sort((left, right) => left.localeCompare(right));
          return [label, { signature: JSON.stringify(sortedDomains), size: sortedDomains.length }];
        })
      );
    };
    const baselineCommunityMembers = membershipByCommunity(baselineCommunityLabels);
    const currentCommunityMembers = membershipByCommunity(currentCommunityLabels);
    let communityMembershipChanges = 0;
    for (const domain of selectedDomains) {
      const baselineLabel = String(baselineCentrality.get(domain)?.community_id ?? '');
      const currentLabel = String(currentCentrality.get(domain)?.community_id ?? '');
      if (
        baselineCommunityMembers.get(baselineLabel)?.signature !==
        currentCommunityMembers.get(currentLabel)?.signature
      )
        communityMembershipChanges += 1;
    }
    const baselineCommunitySizes = [...baselineCommunityMembers.values()].map(
      (members) => members.size
    );
    const currentCommunitySizes = [...currentCommunityMembers.values()].map(
      (members) => members.size
    );
    const baselineConverged = baselineAnalysis.communities?.converged ?? false;
    const currentConverged = currentAnalysis.communities?.converged ?? false;
    const communityOverlaps = new Map<
      string,
      { baseline: string; current: string; domains: string[] }
    >();
    for (const domain of selectedDomains) {
      const baseline = String(baselineCentrality.get(domain)?.community_id ?? '');
      const currentCommunity = String(currentCentrality.get(domain)?.community_id ?? '');
      const key = `${baseline}\u0000${currentCommunity}`;
      const overlap = communityOverlaps.get(key) ?? {
        baseline,
        current: currentCommunity,
        domains: [],
      };
      overlap.domains.push(domain);
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
        const baselineGroup = baselineCommunityMembers.get(overlap.baseline)!;
        const currentGroup = currentCommunityMembers.get(overlap.current)!;
        const shared = overlap.domains.length;
        const baselineSplitTargets = splitTargets.get(overlap.baseline) ?? 1;
        const currentMergeSources = mergeSources.get(overlap.current) ?? 1;
        const sameMembership = baselineGroup.signature === currentGroup.signature;
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
        const row: Record<string, unknown> = {
          row_type: 'source-community-transition',
          provider: currentPanel.provider,
          baseline_community_id: overlap.baseline,
          current_community_id: overlap.current,
          baseline_community_size: baselineGroup.size,
          current_community_size: currentGroup.size,
          transition_shared_domains: shared,
          baseline_member_retained_share: round(shared / baselineGroup.size, 6),
          current_community_source_share: round(shared / currentGroup.size, 6),
          community_transition_jaccard: round(
            shared / (baselineGroup.size + currentGroup.size - shared),
            6
          ),
          baseline_community_split_targets: baselineSplitTargets,
          current_community_merged_sources: currentMergeSources,
          community_transition_type: transitionType,
          baseline_community_modularity_contribution:
            baselineCentrality.get(representative)?.community_modularity_contribution,
          current_community_modularity_contribution:
            currentCentrality.get(representative)?.community_modularity_contribution,
          baseline_community_converged: baselineConverged,
          current_community_converged: currentConverged,
          community_stability_complete: networkComplete && baselineConverged && currentConverged,
          provider_prompt_groups_baseline: baselinePanel.promptGroups,
          provider_prompt_groups_current: currentPanel.promptGroups,
          comparable_source_prompt_groups: promptPairs.length,
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
      row_type: 'source-community-stability',
      provider: currentPanel.provider,
      baseline_community_count: baselineCommunityMembers.size,
      current_community_count: currentCommunityMembers.size,
      shared_domain_count: selectedDomains.length,
      adjusted_rand_index: communityStability === null ? null : round(communityStability, 6),
      community_membership_changed_sources: communityMembershipChanges,
      baseline_largest_community_size: Math.max(0, ...baselineCommunitySizes),
      current_largest_community_size: Math.max(0, ...currentCommunitySizes),
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
      comparable_source_prompt_groups: promptPairs.length,
      unknown_source_detail_prompt_groups: unknownPromptGroups,
      provider_prompt_catalog_complete: providerCatalogComplete,
      source_detail_complete: sourceDetailsComplete,
      domain_catalog_truncated: domainCatalogTruncated,
      network_complete: networkComplete,
    });
    const providerNodes = selectedDomains.map((domain) => {
      const baseCounts = domainPromptCounts.get(domain)!;
      const baselineNode = baselineCentrality.get(domain)!;
      const currentNode = currentCentrality.get(domain)!;
      const baselineReach =
        promptPairs.length > 0 ? (baseCounts.baseline / promptPairs.length) * 100 : null;
      const currentReach =
        promptPairs.length > 0 ? (baseCounts.current / promptPairs.length) * 100 : null;
      return {
        row_type: 'source-node-comparison',
        provider: currentPanel.provider,
        domain,
        baseline_citation_events: baselineEventsByDomain.get(domain) ?? 0,
        current_citation_events: currentEventsByDomain.get(domain) ?? 0,
        baseline_prompt_groups_with_source: baseCounts.baseline,
        current_prompt_groups_with_source: baseCounts.current,
        baseline_source_reach_percent: baselineReach === null ? null : round(baselineReach, 4),
        current_source_reach_percent: currentReach === null ? null : round(currentReach, 4),
        source_reach_change_percentage_points:
          baselineReach === null || currentReach === null
            ? null
            : round(currentReach - baselineReach, 4),
        baseline_network_degree: baselineNode.network_degree,
        current_network_degree: currentNode.network_degree,
        network_degree_change:
          Number(currentNode.network_degree) - Number(baselineNode.network_degree),
        baseline_weighted_degree_prompt_cooccurrences:
          baselineNode.weighted_degree_prompt_cooccurrences,
        current_weighted_degree_prompt_cooccurrences:
          currentNode.weighted_degree_prompt_cooccurrences,
        weighted_degree_change:
          Number(currentNode.weighted_degree_prompt_cooccurrences) -
          Number(baselineNode.weighted_degree_prompt_cooccurrences),
        baseline_pagerank_centrality: baselineNode.pagerank_centrality,
        current_pagerank_centrality: currentNode.pagerank_centrality,
        pagerank_change: round(
          Number(currentNode.pagerank_centrality) - Number(baselineNode.pagerank_centrality),
          8
        ),
        baseline_component_id: baselineNode.connected_component_id,
        current_component_id: currentNode.connected_component_id,
        baseline_component_size: baselineNode.connected_component_size,
        current_component_size: currentNode.connected_component_size,
        baseline_community_id: baselineNode.community_id,
        current_community_id: currentNode.community_id,
        baseline_community_size: baselineNode.community_size,
        current_community_size: currentNode.community_size,
        community_membership_changed:
          baselineCommunityMembers.get(String(baselineNode.community_id ?? ''))?.signature !==
          currentCommunityMembers.get(String(currentNode.community_id ?? ''))?.signature,
        community_adjusted_rand_index:
          communityStability === null ? null : round(communityStability, 6),
        baseline_community_converged: baselineNode.community_detection_converged,
        current_community_converged: currentNode.community_detection_converged,
        baseline_community_modularity_contribution: baselineNode.community_modularity_contribution,
        current_community_modularity_contribution: currentNode.community_modularity_contribution,
        community_modularity_contribution_change:
          baselineNode.community_modularity_contribution === null ||
          currentNode.community_modularity_contribution === null
            ? null
            : round(
                Number(currentNode.community_modularity_contribution) -
                  Number(baselineNode.community_modularity_contribution),
                8
              ),
        baseline_network_weighted_modularity: baselineNode.network_weighted_modularity,
        current_network_weighted_modularity: currentNode.network_weighted_modularity,
        network_weighted_modularity_change:
          baselineNode.network_weighted_modularity === null ||
          currentNode.network_weighted_modularity === null
            ? null
            : round(
                Number(currentNode.network_weighted_modularity) -
                  Number(baselineNode.network_weighted_modularity),
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
        comparable_source_prompt_groups: promptPairs.length,
        unknown_source_detail_prompt_groups: unknownPromptGroups,
        provider_prompt_catalog_complete: providerCatalogComplete,
        source_detail_complete: sourceDetailsComplete,
        domain_catalog_truncated: domainCatalogTruncated,
        network_complete: networkComplete,
      };
    });
    nodeRowsAvailable += providerNodes.length;
    if (nodeRows.length < MAX_COMPARISON_NODE_ROWS)
      nodeRows.push(...providerNodes.slice(0, MAX_COMPARISON_NODE_ROWS - nodeRows.length));

    const providerEdges: OutputEdge[] = [...edgeCounts.entries()]
      .filter(([, counts]) => counts.baseline > 0 || counts.current > 0)
      .map(([key, counts]) => {
        const leftIndex = Math.floor(key / selectedDomains.length);
        const rightIndex = key % selectedDomains.length;
        const left = selectedDomains[leftIndex]!;
        const right = selectedDomains[rightIndex]!;
        const leftCounts = domainPromptCounts.get(left)!;
        const rightCounts = domainPromptCounts.get(right)!;
        const baselineRate = pairRate(
          counts.baseline,
          leftCounts.baseline,
          rightCounts.baseline,
          promptPairs.length
        );
        const currentRate = pairRate(
          counts.current,
          leftCounts.current,
          rightCounts.current,
          promptPairs.length
        );
        const gained = counts.current - counts.both;
        const lost = counts.baseline - counts.both;
        const row: Record<string, unknown> = {
          row_type: 'source-edge-comparison',
          provider: currentPanel.provider,
          domain_a: left,
          domain_b: right,
          baseline_shared_exact_prompt_groups: counts.baseline,
          current_shared_exact_prompt_groups: counts.current,
          gained_co_citation_prompt_groups: gained,
          lost_co_citation_prompt_groups: lost,
          co_citation_present_both_periods: counts.both,
          co_citation_absent_both_periods: Math.max(
            0,
            promptPairs.length - counts.baseline - counts.current + counts.both
          ),
          co_citation_change_prompt_groups: counts.current - counts.baseline,
          baseline_jaccard_prompt_overlap:
            baselineRate.jaccard === null ? null : round(baselineRate.jaccard, 6),
          current_jaccard_prompt_overlap:
            currentRate.jaccard === null ? null : round(currentRate.jaccard, 6),
          jaccard_change:
            baselineRate.jaccard === null || currentRate.jaccard === null
              ? null
              : round(currentRate.jaccard - baselineRate.jaccard, 6),
          baseline_cooccurrence_lift:
            baselineRate.lift === null ? null : round(baselineRate.lift, 6),
          current_cooccurrence_lift: currentRate.lift === null ? null : round(currentRate.lift, 6),
          baseline_domain_a_given_b_percent:
            baselineRate.leftGivenRight === null
              ? null
              : round(baselineRate.leftGivenRight * 100, 4),
          current_domain_a_given_b_percent:
            currentRate.leftGivenRight === null ? null : round(currentRate.leftGivenRight * 100, 4),
          baseline_domain_b_given_a_percent:
            baselineRate.rightGivenLeft === null
              ? null
              : round(baselineRate.rightGivenLeft * 100, 4),
          current_domain_b_given_a_percent:
            currentRate.rightGivenLeft === null ? null : round(currentRate.rightGivenLeft * 100, 4),
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
          comparable_source_prompt_groups: promptPairs.length,
          unknown_source_detail_prompt_groups: unknownPromptGroups,
          provider_prompt_catalog_complete: providerCatalogComplete,
          source_detail_complete: sourceDetailsComplete,
          domain_catalog_truncated: domainCatalogTruncated,
          network_complete: networkComplete,
        };
        return {
          provider: currentPanel.provider,
          row,
          change: Math.abs(counts.current - counts.baseline),
        };
      })
      .sort(compareEdges);
    edgeRowsAvailable += providerEdges.length;
    retainedEdges = [...retainedEdges, ...providerEdges]
      .sort(compareEdges)
      .slice(0, MAX_COMPARISON_EDGE_ROWS);
  }

  const outputRowsTruncated =
    nodeRowsAvailable > nodeRows.length || edgeRowsAvailable > retainedEdges.length;
  const headers = [
    'row_type',
    'provider',
    'domain',
    'domain_a',
    'domain_b',
    'baseline_citation_events',
    'current_citation_events',
    'baseline_prompt_groups_with_source',
    'current_prompt_groups_with_source',
    'baseline_source_reach_percent',
    'current_source_reach_percent',
    'source_reach_change_percentage_points',
    'baseline_network_degree',
    'current_network_degree',
    'network_degree_change',
    'baseline_weighted_degree_prompt_cooccurrences',
    'current_weighted_degree_prompt_cooccurrences',
    'weighted_degree_change',
    'baseline_pagerank_centrality',
    'current_pagerank_centrality',
    'pagerank_change',
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
    'gained_co_citation_prompt_groups',
    'lost_co_citation_prompt_groups',
    'co_citation_present_both_periods',
    'co_citation_absent_both_periods',
    'co_citation_change_prompt_groups',
    'baseline_jaccard_prompt_overlap',
    'current_jaccard_prompt_overlap',
    'jaccard_change',
    'baseline_cooccurrence_lift',
    'current_cooccurrence_lift',
    'baseline_domain_a_given_b_percent',
    'current_domain_a_given_b_percent',
    'baseline_domain_b_given_a_percent',
    'current_domain_b_given_a_percent',
    'provider_prompt_groups_baseline',
    'provider_prompt_groups_current',
    'baseline_only_provider_prompt_groups',
    'current_only_provider_prompt_groups',
    'shared_exact_prompt_groups',
    'comparable_source_prompt_groups',
    'unknown_source_detail_prompt_groups',
    'provider_prompt_catalog_complete',
    'source_detail_complete',
    'domain_catalog_truncated',
    'network_complete',
    'providers_available',
    'providers_with_both_samples',
    'providers_without_both_samples',
    'providers_evaluated',
    'providers_omitted_by_work_budget',
    'providers_omitted_by_panel_cap',
    'source_detail_unknown_prompt_groups_total',
    'domain_catalog_truncated_providers',
    'node_prompt_checks_evaluated',
    'edge_prompt_updates_evaluated',
    'node_prompt_check_budget',
    'edge_prompt_update_budget',
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
    'This paired graph compares exact provider/prompt groups shared by baseline and current samples. Only prompts with complete cited-domain details in both periods are comparable; one-sided or capped details are unknown. The domain catalog is selected jointly by retained prompt reach and event support. Provider summary rows compare community partitions with the adjusted Rand index and weighted modularity; community-transition rows show stable, split, merged, and reconfigured groups by shared retained domains; node rows include period-local community IDs and exact membership-change states. Community assignments use bounded deterministic weighted label propagation, and incomplete convergence or a truncated domain catalog limits stability interpretation. Modularity measures retained-graph separation against a degree-preserving random-graph reference; it does not establish semantic coherence. Edge gained/lost counts are paired prompt transitions; changes are descriptive of these sampled answers, not source influence, quality, or causation. Centrality uses the retained top-domain graph in each period.';
  const summary: Record<string, unknown> = Object.fromEntries(
    headers.map((header) => [header, ''])
  );
  summary.row_type = 'summary';
  summary.providers_available = providerKeys.length;
  summary.providers_with_both_samples = pairedProviderKeys.length;
  summary.providers_without_both_samples = providerKeys.length - pairedProviderKeys.length;
  summary.providers_evaluated = providersEvaluated;
  summary.providers_omitted_by_work_budget = providersOmittedByBudget;
  summary.providers_omitted_by_panel_cap = providersOmittedByPanelCap;
  summary.source_detail_unknown_prompt_groups_total = sourceDetailUnknownPromptGroups;
  summary.domain_catalog_truncated_providers = domainCatalogTruncatedProviders;
  summary.node_prompt_checks_evaluated = nodePromptChecks;
  summary.edge_prompt_updates_evaluated = edgePromptUpdates;
  summary.node_prompt_check_budget = MAX_PAIRED_NODE_PROMPT_CHECKS;
  summary.edge_prompt_update_budget = MAX_PAIRED_EDGE_PROMPT_UPDATES;
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
  summary.output_rows_truncated =
    outputRowsTruncated ||
    providerRows.length > MAX_COMPARISON_PROVIDER_ROWS ||
    transitionRowsAvailable > retainedTransitions.length;
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
