import type {
  AiAnswerCitationObservationReport,
  AiAnswerCitationPromptProviderProfile,
} from './answerCitationObservations';

const MAX_PROVIDER_PAIRS = 50_000;
const MAX_PAIR_PROMPT_CHECKS = 25_000_000;
const MAX_PAIR_EDGE_UPDATES = 25_000_000;
const MAX_PROMPT_JACCARD_BOOTSTRAP_DRAWS = 25_000_000;
const PROMPT_JACCARD_BOOTSTRAP_ITERATIONS = 1_000;
const MAX_PROVIDER_EDGE_CANDIDATES = 100_000;
const MAX_EXACT_MCNEMAR_DISCORDANCE = 500;
const MIN_PROVIDER_EDGE_SUPPORT = 2;
const MAX_OUTPUT_ROWS = 20_000;

interface ProviderPanel {
  provider: string;
  promptGroups: number;
  profiles: Map<string, AiAnswerCitationPromptProviderProfile>;
  catalogComplete: boolean;
}

interface MatchedSourcePrompt {
  leftDomains: Set<string>;
  rightDomains: Set<string>;
}

function normalizedLabel(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
}

function round(value: number, digits = 6): number {
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
  return [...events.values()].reduce((sum, value) => sum + value, 0) === profile.citationEvents
    ? events
    : null;
}

function buildPanels(report: AiAnswerCitationObservationReport): Map<string, ProviderPanel> {
  const panels = new Map<string, ProviderPanel>();
  for (const provider of report.providers) {
    const key = normalizedLabel(provider.provider);
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
  for (const panel of panels.values())
    if (panel.profiles.size !== panel.promptGroups) panel.catalogComplete = false;
  return panels;
}

function edgeKeys(domains: Set<string>): string[] {
  const ordered = [...domains].sort((left, right) => left.localeCompare(right));
  const keys: string[] = [];
  for (let left = 0; left < ordered.length; left += 1) {
    for (let right = left + 1; right < ordered.length; right += 1)
      keys.push(`${ordered[left]}\u0000${ordered[right]}`);
  }
  return keys;
}

function jensenShannon(left: Map<string, number>, right: Map<string, number>): number | null {
  const leftTotal = [...left.values()].reduce((sum, value) => sum + value, 0);
  const rightTotal = [...right.values()].reduce((sum, value) => sum + value, 0);
  if (leftTotal <= 0 || rightTotal <= 0) return null;
  let divergence = 0;
  for (const edge of new Set([...left.keys(), ...right.keys()])) {
    const leftShare = (left.get(edge) ?? 0) / leftTotal;
    const rightShare = (right.get(edge) ?? 0) / rightTotal;
    const midpoint = (leftShare + rightShare) / 2;
    if (leftShare > 0) divergence += (leftShare * Math.log2(leftShare / midpoint)) / 2;
    if (rightShare > 0) divergence += (rightShare * Math.log2(rightShare / midpoint)) / 2;
  }
  return Math.max(0, Math.min(1, divergence));
}

function bootstrapMeanInterval(
  values: number[],
  seedText: string
): { lower: number; upper: number } {
  let seed = 2166136261;
  for (const character of seedText)
    seed = Math.imul(seed ^ character.codePointAt(0)!, 16777619) >>> 0;
  if (seed === 0) seed = 0x6d2b79f5;
  let state = seed;
  const means = new Array<number>(PROMPT_JACCARD_BOOTSTRAP_ITERATIONS);
  for (let iteration = 0; iteration < PROMPT_JACCARD_BOOTSTRAP_ITERATIONS; iteration += 1) {
    let total = 0;
    for (let sample = 0; sample < values.length; sample += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      total += values[Math.floor((state / 0x1_0000_0000) * values.length)]!;
    }
    means[iteration] = total / values.length;
  }
  means.sort((left, right) => left - right);
  return {
    lower: round(means[Math.floor((PROMPT_JACCARD_BOOTSTRAP_ITERATIONS - 1) * 0.025)]!),
    upper: round(means[Math.ceil((PROMPT_JACCARD_BOOTSTRAP_ITERATIONS - 1) * 0.975)]!),
  };
}

function exactPairedEdgePValue(providerBGains: number, providerAGains: number): number {
  const discordant = providerBGains + providerAGains;
  if (discordant === 0 || providerBGains === providerAGains) return 1;
  const lowerTail = Math.min(providerBGains, providerAGains);
  let logProbability = -discordant * Math.LN2;
  let logCumulativeProbability = Number.NEGATIVE_INFINITY;
  for (let successes = 0; successes <= lowerTail; successes += 1) {
    const maximum = Math.max(logCumulativeProbability, logProbability);
    logCumulativeProbability =
      maximum + Math.log1p(Math.exp(Math.min(logCumulativeProbability, logProbability) - maximum));
    if (successes < lowerTail)
      logProbability += Math.log(discordant - successes) - Math.log(successes + 1);
  }
  return Number(Math.min(1, Math.exp(Math.LN2 + logCumulativeProbability)).toPrecision(15));
}

function pairedEdgeMcNemar(
  providerBGains: number,
  providerAGains: number
): { pValue: number; method: string } {
  const discordant = providerBGains + providerAGains;
  if (discordant <= MAX_EXACT_MCNEMAR_DISCORDANCE) {
    return {
      pValue: exactPairedEdgePValue(providerBGains, providerAGains),
      method: 'two-sided-exact-binomial',
    };
  }
  const z = Math.max(0, Math.abs(providerBGains - providerAGains) - 1) / Math.sqrt(discordant);
  const t = 1 / (1 + (0.3275911 * z) / Math.sqrt(2));
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp((-z * z) / 2);
  return {
    pValue: Math.max(0, Math.min(1, 1 - erf)),
    method: 'two-sided-normal-approximation-continuity-corrected',
  };
}

function holmAdjustedEdgePValues(pValues: number[]): number[] {
  const ranked = pValues
    .map((pValue, index) => ({ pValue, index }))
    .sort((left, right) => left.pValue - right.pValue || left.index - right.index);
  const adjusted = new Array<number>(pValues.length);
  let monotoneMaximum = 0;
  ranked.forEach(({ pValue, index }, rank) => {
    monotoneMaximum = Math.max(monotoneMaximum, Math.min(1, pValue * (ranked.length - rank)));
    adjusted[index] = Number(monotoneMaximum.toPrecision(15));
  });
  return adjusted;
}

function wilsonBounds(successes: number, total: number): { lower: number; upper: number } | null {
  if (total <= 0) return null;
  const z = 1.959963984540054;
  const proportion = successes / total;
  const zSquared = z * z;
  const denominator = 1 + zSquared / total;
  const center = (proportion + zSquared / (2 * total)) / denominator;
  const halfWidth =
    (z * Math.sqrt((proportion * (1 - proportion)) / total + zSquared / (4 * total * total))) /
    denominator;
  return { lower: Math.max(0, center - halfWidth), upper: Math.min(1, center + halfWidth) };
}

interface ProviderEdgeTransition {
  domainA: string;
  domainB: string;
  both: number;
  onlyA: number;
  onlyB: number;
}

/** Compare co-citation edge distributions for provider pairs on shared exact prompts. */
export function renderAiAnswerCitationProviderSourceNetworkOverlapCsv(
  report: AiAnswerCitationObservationReport
): string {
  const panels = buildPanels(report);
  const providerKeys = [...panels.keys()].sort((left, right) =>
    panels.get(left)!.provider.localeCompare(panels.get(right)!.provider)
  );
  const providerPairsAvailable = (providerKeys.length * (providerKeys.length - 1)) / 2;
  const providerPairs: Array<[string, string]> = [];
  for (let left = 0; left < providerKeys.length; left += 1) {
    for (
      let right = left + 1;
      right < providerKeys.length && providerPairs.length < MAX_PROVIDER_PAIRS;
      right += 1
    ) {
      providerPairs.push([providerKeys[left]!, providerKeys[right]!]);
    }
    if (providerPairs.length >= MAX_PROVIDER_PAIRS) break;
  }
  const rows: Array<Record<string, unknown>> = [];
  let evaluatedPairs = 0;
  const pairsOmittedByCap = providerPairsAvailable - providerPairs.length;
  let pairsOmittedByWorkBudget = 0;
  let promptChecks = 0;
  let edgeUpdates = 0;
  let promptJaccardBootstrapDraws = 0;
  let unknownSourcePromptGroups = 0;

  for (let pairIndex = 0; pairIndex < providerPairs.length; pairIndex += 1) {
    const [leftKey, rightKey] = providerPairs[pairIndex]!;
    const leftPanel = panels.get(leftKey)!;
    const rightPanel = panels.get(rightKey)!;
    const smaller =
      leftPanel.profiles.size <= rightPanel.profiles.size
        ? leftPanel.profiles
        : rightPanel.profiles;
    const larger = smaller === leftPanel.profiles ? rightPanel.profiles : leftPanel.profiles;
    const sharedPromptKeys = [...smaller.keys()]
      .filter((promptKey) => larger.has(promptKey))
      .sort((left, right) => left.localeCompare(right));
    if (promptChecks + sharedPromptKeys.length > MAX_PAIR_PROMPT_CHECKS) {
      pairsOmittedByWorkBudget = providerPairs.length - pairIndex;
      break;
    }
    promptChecks += sharedPromptKeys.length;
    const matched: MatchedSourcePrompt[] = [];
    let unknownForPair = 0;
    let estimatedEdgeUpdates = 0;
    for (const promptKey of sharedPromptKeys) {
      const leftEvents = completeDomainEvents(leftPanel.profiles.get(promptKey)!);
      const rightEvents = completeDomainEvents(rightPanel.profiles.get(promptKey)!);
      if (!leftEvents || !rightEvents) {
        unknownForPair += 1;
        continue;
      }
      const leftDomains = new Set(
        [...leftEvents].filter(([, count]) => count > 0).map(([domain]) => domain)
      );
      const rightDomains = new Set(
        [...rightEvents].filter(([, count]) => count > 0).map(([domain]) => domain)
      );
      const leftPairs = (leftDomains.size * (leftDomains.size - 1)) / 2;
      const rightPairs = (rightDomains.size * (rightDomains.size - 1)) / 2;
      estimatedEdgeUpdates += leftPairs + rightPairs + leftPairs;
      matched.push({ leftDomains, rightDomains });
    }
    if (edgeUpdates + estimatedEdgeUpdates > MAX_PAIR_EDGE_UPDATES) {
      pairsOmittedByWorkBudget = providerPairs.length - pairIndex;
      break;
    }
    evaluatedPairs += 1;
    unknownSourcePromptGroups += unknownForPair;

    const leftEdgeSupport = new Map<string, number>();
    const rightEdgeSupport = new Map<string, number>();
    let promptEdgeJaccardTotal = 0;
    const promptEdgeJaccards: number[] = [];
    let promptsWithAtLeastOneEdge = 0;
    let promptsWithNoEdgesForEitherProvider = 0;
    let gainedEdges = 0;
    let lostEdges = 0;
    let sharedEdges = 0;
    let actualPairEdgeUpdates = 0;
    const sharedDomainsLeft = new Set<string>();
    const sharedDomainsRight = new Set<string>();
    for (const prompt of matched) {
      for (const domain of prompt.leftDomains) sharedDomainsLeft.add(domain);
      for (const domain of prompt.rightDomains) sharedDomainsRight.add(domain);
      const leftEdges = edgeKeys(prompt.leftDomains);
      const rightEdges = edgeKeys(prompt.rightDomains);
      const rightSet = new Set(rightEdges);
      const leftSet = new Set(leftEdges);
      actualPairEdgeUpdates += leftEdges.length + rightEdges.length + leftEdges.length;
      for (const edge of leftEdges) leftEdgeSupport.set(edge, (leftEdgeSupport.get(edge) ?? 0) + 1);
      for (const edge of rightEdges)
        rightEdgeSupport.set(edge, (rightEdgeSupport.get(edge) ?? 0) + 1);
      let both = 0;
      for (const edge of leftSet) if (rightSet.has(edge)) both += 1;
      const union = leftSet.size + rightSet.size - both;
      if (union > 0) {
        const promptJaccard = both / union;
        promptEdgeJaccardTotal += promptJaccard;
        promptEdgeJaccards.push(promptJaccard);
        promptsWithAtLeastOneEdge += 1;
        gainedEdges += rightSet.size - both;
        lostEdges += leftSet.size - both;
        sharedEdges += both;
      } else promptsWithNoEdgesForEitherProvider += 1;
    }
    const leftEdgeSet = new Set(leftEdgeSupport.keys());
    const rightEdgeSet = new Set(rightEdgeSupport.keys());
    let sharedUniqueEdges = 0;
    for (const edge of leftEdgeSet) if (rightEdgeSet.has(edge)) sharedUniqueEdges += 1;
    const uniqueEdgeUnion = leftEdgeSet.size + rightEdgeSet.size - sharedUniqueEdges;
    edgeUpdates += actualPairEdgeUpdates;
    const providerCatalogComplete = leftPanel.catalogComplete && rightPanel.catalogComplete;
    const sourceDetailComplete = unknownForPair === 0;
    let promptJaccardInterval: { lower: number; upper: number } | null = null;
    let promptJaccardIntervalState = 'insufficient-nonempty-prompts';
    const requiredBootstrapDraws = promptEdgeJaccards.length * PROMPT_JACCARD_BOOTSTRAP_ITERATIONS;
    if (promptEdgeJaccards.length >= 2) {
      if (
        promptJaccardBootstrapDraws + requiredBootstrapDraws <=
        MAX_PROMPT_JACCARD_BOOTSTRAP_DRAWS
      ) {
        promptJaccardInterval = bootstrapMeanInterval(
          promptEdgeJaccards,
          `${normalizedLabel(leftPanel.provider)}\u0000${normalizedLabel(rightPanel.provider)}`
        );
        promptJaccardBootstrapDraws += requiredBootstrapDraws;
        promptJaccardIntervalState = 'complete';
      } else promptJaccardIntervalState = 'work-budget-exceeded';
    }
    rows.push({
      row_type: 'provider-network-pair',
      provider_a: leftPanel.provider,
      provider_b: rightPanel.provider,
      provider_a_prompt_groups: leftPanel.promptGroups,
      provider_b_prompt_groups: rightPanel.promptGroups,
      shared_exact_prompt_groups: sharedPromptKeys.length,
      comparable_source_prompt_groups: matched.length,
      unknown_source_detail_prompt_groups: unknownForPair,
      unmatched_provider_a_prompt_groups: Math.max(
        0,
        leftPanel.profiles.size - sharedPromptKeys.length
      ),
      unmatched_provider_b_prompt_groups: Math.max(
        0,
        rightPanel.profiles.size - sharedPromptKeys.length
      ),
      provider_a_distinct_cocitation_edges: leftEdgeSet.size,
      provider_b_distinct_cocitation_edges: rightEdgeSet.size,
      shared_distinct_cocitation_edges: sharedUniqueEdges,
      distinct_edge_catalog_jaccard:
        uniqueEdgeUnion > 0 ? round(sharedUniqueEdges / uniqueEdgeUnion) : null,
      pooled_edge_support_jensen_shannon_bits: jensenShannon(leftEdgeSupport, rightEdgeSupport),
      mean_matched_prompt_edge_jaccard:
        promptsWithAtLeastOneEdge > 0
          ? round(promptEdgeJaccardTotal / promptsWithAtLeastOneEdge)
          : null,
      mean_prompt_edge_jaccard_lower_95: promptJaccardInterval?.lower ?? null,
      mean_prompt_edge_jaccard_upper_95: promptJaccardInterval?.upper ?? null,
      mean_prompt_edge_jaccard_bootstrap_draws: promptJaccardInterval ? requiredBootstrapDraws : 0,
      mean_prompt_edge_jaccard_interval_state: promptJaccardIntervalState,
      prompts_with_any_cocitation_edge: promptsWithAtLeastOneEdge,
      prompts_with_no_edges_for_either_provider: promptsWithNoEdgesForEitherProvider,
      paired_edge_gains_in_b: gainedEdges,
      paired_edge_losses_in_b: lostEdges,
      paired_edges_present_for_both: sharedEdges,
      provider_a_distinct_source_domains: sharedDomainsLeft.size,
      provider_b_distinct_source_domains: sharedDomainsRight.size,
      provider_prompt_catalogs_complete: providerCatalogComplete,
      source_detail_complete: sourceDetailComplete,
      comparison_complete: providerCatalogComplete && sourceDetailComplete,
      interpretation_note:
        'Compares domain-pair co-citation topology on shared exact prompts with complete source lists. Edge JSD is based on pooled prompt support across observed domain pairs; prompt edge Jaccard is averaged only over prompts with at least one pair. Empty pair networks and capped lists are reported separately. This describes sampled citations, not provider quality or causation.',
    });
  }

  rows.sort(
    (left, right) =>
      Number(right.pooled_edge_support_jensen_shannon_bits ?? -1) -
        Number(left.pooled_edge_support_jensen_shannon_bits ?? -1) ||
      String(left.provider_a).localeCompare(String(right.provider_a)) ||
      String(left.provider_b).localeCompare(String(right.provider_b))
  );
  const outputRowsTruncated = rows.length > MAX_OUTPUT_ROWS;
  const headers = [
    'row_type',
    'provider_a',
    'provider_b',
    'provider_a_prompt_groups',
    'provider_b_prompt_groups',
    'shared_exact_prompt_groups',
    'comparable_source_prompt_groups',
    'unknown_source_detail_prompt_groups',
    'unmatched_provider_a_prompt_groups',
    'unmatched_provider_b_prompt_groups',
    'provider_a_distinct_cocitation_edges',
    'provider_b_distinct_cocitation_edges',
    'shared_distinct_cocitation_edges',
    'distinct_edge_catalog_jaccard',
    'pooled_edge_support_jensen_shannon_bits',
    'mean_matched_prompt_edge_jaccard',
    'mean_prompt_edge_jaccard_lower_95',
    'mean_prompt_edge_jaccard_upper_95',
    'mean_prompt_edge_jaccard_bootstrap_draws',
    'mean_prompt_edge_jaccard_interval_state',
    'prompts_with_any_cocitation_edge',
    'prompts_with_no_edges_for_either_provider',
    'paired_edge_gains_in_b',
    'paired_edge_losses_in_b',
    'paired_edges_present_for_both',
    'provider_a_distinct_source_domains',
    'provider_b_distinct_source_domains',
    'provider_prompt_catalogs_complete',
    'source_detail_complete',
    'comparison_complete',
    'interpretation_note',
    'provider_pairs_available',
    'provider_pairs_evaluated',
    'provider_pairs_omitted_by_work_budget',
    'provider_pairs_omitted_by_cap',
    'pair_prompt_checks_evaluated',
    'pair_edge_updates_evaluated',
    'mean_prompt_edge_jaccard_bootstrap_draws_evaluated',
    'mean_prompt_edge_jaccard_bootstrap_draw_budget',
    'pair_prompt_check_budget',
    'pair_edge_update_budget',
    'output_rows_available',
    'output_rows_emitted',
    'output_rows_truncated',
  ];
  const summary: Record<string, unknown> = Object.fromEntries(
    headers.map((header) => [header, ''])
  );
  summary.row_type = 'summary';
  summary.provider_pairs_available = providerPairsAvailable;
  summary.provider_pairs_evaluated = evaluatedPairs;
  summary.provider_pairs_omitted_by_work_budget = pairsOmittedByWorkBudget;
  summary.provider_pairs_omitted_by_cap = pairsOmittedByCap;
  summary.pair_prompt_checks_evaluated = promptChecks;
  summary.pair_edge_updates_evaluated = edgeUpdates;
  summary.mean_prompt_edge_jaccard_bootstrap_draws_evaluated = promptJaccardBootstrapDraws;
  summary.mean_prompt_edge_jaccard_bootstrap_draw_budget = MAX_PROMPT_JACCARD_BOOTSTRAP_DRAWS;
  summary.pair_prompt_check_budget = MAX_PAIR_PROMPT_CHECKS;
  summary.pair_edge_update_budget = MAX_PAIR_EDGE_UPDATES;
  summary.output_rows_available = rows.length;
  summary.output_rows_emitted = Math.min(rows.length, MAX_OUTPUT_ROWS);
  summary.output_rows_truncated = outputRowsTruncated;
  summary.interpretation_note = `Unknown source-detail prompt groups across evaluated pairs: ${unknownSourcePromptGroups}.`;
  const output: Array<Record<string, unknown>> = [
    Object.fromEntries(headers.map((header) => [header, header])),
    summary,
    ...rows.slice(0, MAX_OUTPUT_ROWS),
  ];
  return `${output.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(',')).join('\r\n')}\r\n`;
}

/** Compare provider-specific co-citation edge reach on the same exact prompt groups. */
export function renderAiAnswerCitationProviderSourceNetworkEdgeComparisonCsv(
  report: AiAnswerCitationObservationReport
): string {
  const panels = buildPanels(report);
  const providerKeys = [...panels.keys()].sort((left, right) =>
    panels.get(left)!.provider.localeCompare(panels.get(right)!.provider)
  );
  const providerPairsAvailable = (providerKeys.length * (providerKeys.length - 1)) / 2;
  const providerPairs: Array<[string, string]> = [];
  for (let left = 0; left < providerKeys.length; left += 1) {
    for (
      let right = left + 1;
      right < providerKeys.length && providerPairs.length < MAX_PROVIDER_PAIRS;
      right += 1
    ) {
      providerPairs.push([providerKeys[left]!, providerKeys[right]!]);
    }
    if (providerPairs.length >= MAX_PROVIDER_PAIRS) break;
  }

  const headers = [
    'row_type',
    'provider_a',
    'provider_b',
    'provider_a_prompt_groups',
    'provider_b_prompt_groups',
    'unmatched_provider_a_prompt_groups',
    'unmatched_provider_b_prompt_groups',
    'domain_a',
    'domain_b',
    'shared_exact_prompt_groups',
    'comparable_complete_source_prompt_groups',
    'unknown_source_detail_prompt_groups',
    'provider_a_only_edge_prompts',
    'provider_b_only_edge_prompts',
    'both_edge_prompts',
    'neither_edge_prompts',
    'provider_a_edge_prompt_share',
    'provider_b_edge_prompt_share',
    'provider_b_minus_a_edge_prompt_share',
    'provider_b_minus_a_lower_95',
    'provider_b_minus_a_upper_95',
    'provider_b_minus_a_leave_one_prompt_out_min',
    'provider_b_minus_a_leave_one_prompt_out_max',
    'leave_one_prompt_out_max_absolute_shift',
    'provider_b_edge_lift',
    'paired_mcnemar_p_value',
    'paired_test_method',
    'paired_holm_adjusted_mcnemar_p_value',
    'holm_adjustment_status',
    'minimum_union_edge_support',
    'provider_prompt_catalogs_complete',
    'source_detail_complete',
    'comparison_complete',
    'interpretation_note',
    'provider_pairs_available',
    'provider_pairs_evaluated',
    'provider_pairs_omitted_by_work_budget',
    'provider_pairs_omitted_by_cap',
    'pair_prompt_checks_evaluated',
    'pair_edge_operations_evaluated',
    'pair_prompt_check_budget',
    'pair_edge_operation_budget',
    'provider_edge_candidates_evaluated',
    'provider_edge_candidate_cap',
    'provider_edge_catalog_complete',
    'edge_candidate_cap_exceeded',
    'provider_pairs_omitted_by_candidate_cap',
    'edge_comparisons_below_minimum_support',
    'holm_family_size',
    'output_rows_available',
    'output_rows_emitted',
    'output_rows_truncated',
  ];
  const summary: Record<string, unknown> = Object.fromEntries(
    headers.map((header) => [header, ''])
  );
  summary.row_type = 'summary';
  summary.provider_pairs_available = providerPairsAvailable;
  summary.provider_pairs_omitted_by_cap = providerPairsAvailable - providerPairs.length;
  summary.minimum_union_edge_support = MIN_PROVIDER_EDGE_SUPPORT;
  summary.pair_prompt_check_budget = MAX_PAIR_PROMPT_CHECKS;
  summary.pair_edge_operation_budget = MAX_PAIR_EDGE_UPDATES;
  summary.provider_edge_candidate_cap = MAX_PROVIDER_EDGE_CANDIDATES;

  const rows: Array<Record<string, unknown>> = [];
  let pairsEvaluated = 0;
  let pairsOmittedByWorkBudget = 0;
  let pairsOmittedByCandidateCap = 0;
  let promptChecks = 0;
  let edgeOperations = 0;
  let edgeCandidates = 0;
  let edgesBelowMinimumSupport = 0;
  let unknownSourcePromptGroups = 0;
  let anyCatalogIncomplete = providerPairsAvailable > providerPairs.length;
  let workBudgetExceeded = false;
  let edgeCandidateCapExceeded = false;

  for (let pairIndex = 0; pairIndex < providerPairs.length; pairIndex += 1) {
    const [leftKey, rightKey] = providerPairs[pairIndex]!;
    const leftPanel = panels.get(leftKey)!;
    const rightPanel = panels.get(rightKey)!;
    const smaller =
      leftPanel.profiles.size <= rightPanel.profiles.size
        ? leftPanel.profiles
        : rightPanel.profiles;
    const larger = smaller === leftPanel.profiles ? rightPanel.profiles : leftPanel.profiles;
    const sharedPromptKeys = [...smaller.keys()]
      .filter((promptKey) => larger.has(promptKey))
      .sort((left, right) => left.localeCompare(right));
    if (promptChecks + sharedPromptKeys.length > MAX_PAIR_PROMPT_CHECKS) {
      pairsOmittedByWorkBudget = providerPairs.length - pairIndex;
      workBudgetExceeded = true;
      break;
    }
    const edgeCounts = new Map<string, ProviderEdgeTransition>();
    let comparablePrompts = 0;
    let unknownForPair = 0;
    let pairPromptChecks = 0;
    let pairEdgeOperations = 0;
    let pairInterrupted = false;

    for (const promptKey of sharedPromptKeys) {
      pairPromptChecks += 1;
      const leftEvents = completeDomainEvents(leftPanel.profiles.get(promptKey)!);
      const rightEvents = completeDomainEvents(rightPanel.profiles.get(promptKey)!);
      if (!leftEvents || !rightEvents) {
        unknownForPair += 1;
        continue;
      }
      const leftDomains = new Set(
        [...leftEvents].filter(([, count]) => count > 0).map(([domain]) => domain)
      );
      const rightDomains = new Set(
        [...rightEvents].filter(([, count]) => count > 0).map(([domain]) => domain)
      );
      const leftEdges = edgeKeys(leftDomains);
      const rightEdges = edgeKeys(rightDomains);
      const leftSet = new Set(leftEdges);
      const rightSet = new Set(rightEdges);
      const unionEdges = new Set([...leftEdges, ...rightEdges]);
      const operationCost =
        leftEdges.length + rightEdges.length + leftEdges.length + unionEdges.size;
      const additionalCandidates = [...unionEdges].filter((edge) => !edgeCounts.has(edge)).length;
      if (
        edgeOperations + pairEdgeOperations + operationCost > MAX_PAIR_EDGE_UPDATES ||
        edgeCandidates + edgeCounts.size + additionalCandidates > MAX_PROVIDER_EDGE_CANDIDATES
      ) {
        pairInterrupted = true;
        workBudgetExceeded =
          edgeOperations + pairEdgeOperations + operationCost > MAX_PAIR_EDGE_UPDATES;
        edgeCandidateCapExceeded =
          edgeCandidates + edgeCounts.size + additionalCandidates > MAX_PROVIDER_EDGE_CANDIDATES;
        if (workBudgetExceeded) pairsOmittedByWorkBudget = providerPairs.length - pairIndex;
        if (edgeCandidateCapExceeded) pairsOmittedByCandidateCap = providerPairs.length - pairIndex;
        break;
      }
      pairEdgeOperations += operationCost;
      comparablePrompts += 1;
      for (const edge of unionEdges) {
        let transition = edgeCounts.get(edge);
        if (!transition) {
          const [domainA, domainB] = edge.split('\u0000');
          transition = { domainA: domainA!, domainB: domainB!, both: 0, onlyA: 0, onlyB: 0 };
          edgeCounts.set(edge, transition);
        }
        const inA = leftSet.has(edge);
        const inB = rightSet.has(edge);
        if (inA && inB) transition.both += 1;
        else if (inA) transition.onlyA += 1;
        else transition.onlyB += 1;
      }
    }

    promptChecks += pairPromptChecks;
    edgeOperations += pairEdgeOperations;
    edgeCandidates += edgeCounts.size;
    unknownSourcePromptGroups += unknownForPair;
    if (pairInterrupted) break;
    pairsEvaluated += 1;
    const catalogsComplete = leftPanel.catalogComplete && rightPanel.catalogComplete;
    const sourceDetailComplete = unknownForPair === 0;
    if (!catalogsComplete || !sourceDetailComplete) anyCatalogIncomplete = true;
    for (const transition of edgeCounts.values()) {
      const unionSupport = transition.both + transition.onlyA + transition.onlyB;
      if (unionSupport < MIN_PROVIDER_EDGE_SUPPORT) {
        edgesBelowMinimumSupport += 1;
        continue;
      }
      const aSupport = transition.both + transition.onlyA;
      const bSupport = transition.both + transition.onlyB;
      const aShare = comparablePrompts > 0 ? aSupport / comparablePrompts : null;
      const bShare = comparablePrompts > 0 ? bSupport / comparablePrompts : null;
      const difference = aShare !== null && bShare !== null ? bShare - aShare : null;
      const aInterval = wilsonBounds(aSupport, comparablePrompts);
      const bInterval = wilsonBounds(bSupport, comparablePrompts);
      const differenceLower =
        difference !== null && aInterval && bInterval
          ? difference -
            Math.sqrt((bShare! - bInterval.lower) ** 2 + (aInterval.upper - aShare!) ** 2)
          : null;
      const differenceUpper =
        difference !== null && aInterval && bInterval
          ? difference +
            Math.sqrt((bInterval.upper - bShare!) ** 2 + (aShare! - aInterval.lower) ** 2)
          : null;
      const leaveOneOutDifferences: number[] = [];
      if (comparablePrompts >= 2) {
        if (transition.onlyA > 0)
          leaveOneOutDifferences.push(
            (transition.onlyB - transition.onlyA + 1) / (comparablePrompts - 1)
          );
        if (transition.onlyB > 0)
          leaveOneOutDifferences.push(
            (transition.onlyB - transition.onlyA - 1) / (comparablePrompts - 1)
          );
        if (comparablePrompts - transition.onlyA - transition.onlyB > 0)
          leaveOneOutDifferences.push(
            (transition.onlyB - transition.onlyA) / (comparablePrompts - 1)
          );
      }
      const leaveOneOutMin =
        leaveOneOutDifferences.length > 0 ? Math.min(...leaveOneOutDifferences) : null;
      const leaveOneOutMax =
        leaveOneOutDifferences.length > 0 ? Math.max(...leaveOneOutDifferences) : null;
      const pairedTest = pairedEdgeMcNemar(transition.onlyB, transition.onlyA);
      rows.push({
        row_type: 'provider-edge-pair',
        provider_a: leftPanel.provider,
        provider_b: rightPanel.provider,
        provider_a_prompt_groups: leftPanel.promptGroups,
        provider_b_prompt_groups: rightPanel.promptGroups,
        unmatched_provider_a_prompt_groups: Math.max(
          0,
          leftPanel.profiles.size - sharedPromptKeys.length
        ),
        unmatched_provider_b_prompt_groups: Math.max(
          0,
          rightPanel.profiles.size - sharedPromptKeys.length
        ),
        domain_a: transition.domainA,
        domain_b: transition.domainB,
        shared_exact_prompt_groups: sharedPromptKeys.length,
        comparable_complete_source_prompt_groups: comparablePrompts,
        unknown_source_detail_prompt_groups: unknownForPair,
        provider_a_only_edge_prompts: transition.onlyA,
        provider_b_only_edge_prompts: transition.onlyB,
        both_edge_prompts: transition.both,
        neither_edge_prompts: comparablePrompts - unionSupport,
        provider_a_edge_prompt_share: aShare === null ? null : round(aShare),
        provider_b_edge_prompt_share: bShare === null ? null : round(bShare),
        provider_b_minus_a_edge_prompt_share: difference === null ? null : round(difference),
        provider_b_minus_a_lower_95: differenceLower === null ? null : round(differenceLower),
        provider_b_minus_a_upper_95: differenceUpper === null ? null : round(differenceUpper),
        provider_b_minus_a_leave_one_prompt_out_min:
          leaveOneOutMin === null ? null : round(leaveOneOutMin),
        provider_b_minus_a_leave_one_prompt_out_max:
          leaveOneOutMax === null ? null : round(leaveOneOutMax),
        leave_one_prompt_out_max_absolute_shift:
          difference !== null && leaveOneOutDifferences.length > 0
            ? round(
                Math.max(...leaveOneOutDifferences.map((value) => Math.abs(value - difference))) *
                  100
              )
            : null,
        provider_b_edge_lift:
          aShare !== null && bShare !== null && aShare > 0 ? round(bShare / aShare) : null,
        paired_mcnemar_p_value: pairedTest.pValue,
        paired_test_method: pairedTest.method,
        paired_holm_adjusted_mcnemar_p_value: null,
        holm_adjustment_status: '',
        minimum_union_edge_support: MIN_PROVIDER_EDGE_SUPPORT,
        provider_prompt_catalogs_complete: catalogsComplete,
        source_detail_complete: sourceDetailComplete,
        comparison_complete: catalogsComplete && sourceDetailComplete,
        interpretation_note:
          'Paired edge presence is compared on shared exact prompts with complete source lists. Provider B minus A is a prompt-balanced difference; McNemar uses exact binomial through 500 discordant prompts and a continuity-corrected normal approximation above that. Wilson/Newcombe intervals are nominal; multiple-edge intervals are not adjusted. Holm adjustment is withheld unless the complete retained provider/edge family was screened. Results describe this sample, not causal influence or provider quality.',
      });
    }
  }

  const candidateCatalogComplete =
    !anyCatalogIncomplete &&
    pairsOmittedByWorkBudget === 0 &&
    !workBudgetExceeded &&
    !edgeCandidateCapExceeded;
  const holmStatus =
    rows.length === 0
      ? candidateCatalogComplete
        ? 'no-testable-edge-comparisons'
        : 'suppressed-incomplete-edge-catalog'
      : candidateCatalogComplete
        ? 'complete'
        : 'suppressed-incomplete-edge-catalog';
  const holmAdjusted = candidateCatalogComplete
    ? holmAdjustedEdgePValues(rows.map((row) => Number(row.paired_mcnemar_p_value)))
    : [];
  rows.forEach((row, index) => {
    row.paired_holm_adjusted_mcnemar_p_value = candidateCatalogComplete
      ? holmAdjusted[index]!
      : null;
    row.holm_adjustment_status = holmStatus;
  });
  rows.sort(
    (left, right) =>
      Math.abs(Number(right.provider_b_minus_a_edge_prompt_share ?? 0)) -
        Math.abs(Number(left.provider_b_minus_a_edge_prompt_share ?? 0)) ||
      Number(left.paired_mcnemar_p_value) - Number(right.paired_mcnemar_p_value) ||
      String(left.provider_a).localeCompare(String(right.provider_a)) ||
      String(left.provider_b).localeCompare(String(right.provider_b)) ||
      String(left.domain_a).localeCompare(String(right.domain_a)) ||
      String(left.domain_b).localeCompare(String(right.domain_b))
  );
  const outputRowsTruncated = rows.length > MAX_OUTPUT_ROWS;
  summary.provider_pairs_evaluated = pairsEvaluated;
  summary.provider_pairs_omitted_by_work_budget = pairsOmittedByWorkBudget;
  summary.provider_pairs_omitted_by_candidate_cap = pairsOmittedByCandidateCap;
  summary.pair_prompt_checks_evaluated = promptChecks;
  summary.pair_edge_operations_evaluated = edgeOperations;
  summary.provider_edge_candidates_evaluated = edgeCandidates;
  summary.provider_edge_catalog_complete = candidateCatalogComplete;
  summary.edge_candidate_cap_exceeded = edgeCandidateCapExceeded;
  summary.edge_comparisons_below_minimum_support = edgesBelowMinimumSupport;
  summary.holm_family_size = candidateCatalogComplete ? rows.length : 0;
  summary.holm_adjustment_status = holmStatus;
  summary.unknown_source_detail_prompt_groups = unknownSourcePromptGroups;
  summary.output_rows_available = rows.length;
  summary.output_rows_emitted = Math.min(rows.length, MAX_OUTPUT_ROWS);
  summary.output_rows_truncated = outputRowsTruncated;
  summary.interpretation_note = `Unknown shared source-detail prompt groups: ${unknownSourcePromptGroups}; edge work budget exceeded: ${workBudgetExceeded}; candidate-edge cap exceeded: ${edgeCandidateCapExceeded}.`;
  const output: Array<Record<string, unknown>> = [
    Object.fromEntries(headers.map((header) => [header, header])),
    summary,
    ...rows.slice(0, MAX_OUTPUT_ROWS),
  ];
  return `${output.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(',')).join('\r\n')}\r\n`;
}
