import type { AiAnswerCitationObservationReport } from './answerCitationObservations';

const MAX_PAIR_PROMPT_COMPARISONS = 25_000_000;
const MAX_BOOTSTRAP_DRAWS = 50_000_000;
const BOOTSTRAP_ITERATIONS = 1_000;
const MIN_BOOTSTRAP_ITERATIONS = 250;
const MAX_PROVIDER_PAIRS = 50_000;
const MAX_OUTPUT_ROWS = 20_000;

interface PromptSourceProfile {
  citationEvents: number;
  domainEvents: Map<string, number>;
  domainDetailComplete: boolean;
  rankDomainWeights: Map<string, number>;
  rankWeightTotal: number;
  rankDetailComplete: boolean;
}

interface ProviderPanel {
  provider: string;
  allPromptGroups: number;
  promptProfiles: Map<string, PromptSourceProfile>;
  catalogComplete: boolean;
}

interface PairContext {
  providerAKey: string;
  providerBKey: string;
  providerA: ProviderPanel;
  providerB: ProviderPanel;
  sharedPromptGroups: number;
  comparablePromptGroups: number;
  rankComparablePromptGroups: number;
  bothCitedPromptGroups: number;
  bothCitedSharedPromptGroups: number;
  oneSideUncitedPromptGroups: number;
  bothUncitedPromptGroups: number;
  unknownDetailPromptGroups: number;
  unknownRankDetailPromptGroups: number;
  bothCitedRankPromptGroups: number;
  complete: boolean;
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

function distributionJensenShannon(
  left: Map<string, number>,
  right: Map<string, number>
): number | null {
  const leftTotal = [...left.values()].reduce((sum, value) => sum + value, 0);
  const rightTotal = [...right.values()].reduce((sum, value) => sum + value, 0);
  if (leftTotal <= 0 || rightTotal <= 0) return null;
  let divergence = 0;
  const domains = new Set([...left.keys(), ...right.keys()]);
  for (const domain of domains) {
    const leftShare = (left.get(domain) ?? 0) / leftTotal;
    const rightShare = (right.get(domain) ?? 0) / rightTotal;
    const midpoint = (leftShare + rightShare) / 2;
    if (leftShare > 0) divergence += (leftShare * Math.log2(leftShare / midpoint)) / 2;
    if (rightShare > 0) divergence += (rightShare * Math.log2(rightShare / midpoint)) / 2;
  }
  return Math.max(0, Math.min(1, divergence));
}

function deterministicSeed(text: string): number {
  let seed = 2166136261;
  for (const character of text) seed = Math.imul(seed ^ character.codePointAt(0)!, 16777619) >>> 0;
  return seed === 0 ? 0x6d2b79f5 : seed;
}

function percentileInterval(
  values: number[],
  iterations: number
): { lower: number; upper: number } | null {
  if (values.length !== iterations || iterations < MIN_BOOTSTRAP_ITERATIONS) return null;
  values.sort((left, right) => left - right);
  return {
    lower: round(values[Math.floor((iterations - 1) * 0.025)]!, 6),
    upper: round(values[Math.ceil((iterations - 1) * 0.975)]!, 6),
  };
}

function bootstrapMeanJensenShannon(
  values: number[],
  seedText: string,
  iterations: number
): { lower: number; upper: number } | null {
  if (values.length < 2 || iterations < MIN_BOOTSTRAP_ITERATIONS) return null;
  let randomState = deterministicSeed(seedText);
  const means = new Array<number>(iterations);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let total = 0;
    for (let draw = 0; draw < values.length; draw += 1) {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      total += values[Math.floor((randomState / 0x1_0000_0000) * values.length)]!;
    }
    means[iteration] = total / values.length;
  }
  return percentileInterval(means, iterations);
}

function buildProviderPanels(
  report: AiAnswerCitationObservationReport
): Map<string, ProviderPanel> {
  const panels = new Map<string, ProviderPanel>();
  for (const provider of report.providers) {
    const key = normalizedLabel(provider.provider);
    panels.set(key, {
      provider: provider.provider,
      allPromptGroups: provider.uniquePrompts,
      promptProfiles: new Map(),
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
      const providerKey = normalizedLabel(profile.provider);
      const panel = panels.get(providerKey) ?? {
        provider: profile.provider,
        allPromptGroups: 0,
        promptProfiles: new Map<string, PromptSourceProfile>(),
        catalogComplete: !report.promptsTruncated,
      };
      const hasDomainEvents = Array.isArray(profile.citedDomainCitationEvents);
      const hasTruncationState = typeof profile.citedDomainsTruncated === 'boolean';
      const domainEvents = new Map<string, number>();
      let validDomainEvents = true;
      for (const item of profile.citedDomainCitationEvents ?? []) {
        if (!Number.isFinite(item.citationEvents) || item.citationEvents < 0) {
          validDomainEvents = false;
          continue;
        }
        const domainKey = item.domain.toLowerCase();
        domainEvents.set(domainKey, (domainEvents.get(domainKey) ?? 0) + item.citationEvents);
      }
      const listedEvents = [...domainEvents.values()].reduce((sum, events) => sum + events, 0);
      const domainDetailComplete =
        hasDomainEvents &&
        hasTruncationState &&
        !profile.citedDomainsTruncated &&
        validDomainEvents &&
        listedEvents === profile.citationEvents;
      const hasRankDomainWeights = Array.isArray(profile.rankWeightedDomainCitationEvents);
      const hasRankWeightTotal =
        Number.isFinite(profile.rankWeightedCitationWeightTotal) &&
        profile.rankWeightedCitationWeightTotal! >= 0;
      const hasRankTruncationState = typeof profile.rankWeightedDomainsTruncated === 'boolean';
      const rankDomainWeights = new Map<string, number>();
      let validRankDomainWeights = true;
      for (const item of profile.rankWeightedDomainCitationEvents ?? []) {
        if (!Number.isFinite(item.discountedCitationWeight) || item.discountedCitationWeight < 0) {
          validRankDomainWeights = false;
          continue;
        }
        const domainKey = item.domain.toLowerCase();
        rankDomainWeights.set(
          domainKey,
          (rankDomainWeights.get(domainKey) ?? 0) + item.discountedCitationWeight
        );
      }
      const listedRankWeight = [...rankDomainWeights.values()].reduce(
        (sum, weight) => sum + weight,
        0
      );
      const expectedRankWeight = profile.rankWeightedCitationWeightTotal ?? 0;
      const rankWeightTolerance = Math.max(1e-9, expectedRankWeight * 1e-9);
      const rankDetailComplete =
        hasRankDomainWeights &&
        hasRankWeightTotal &&
        hasRankTruncationState &&
        !profile.rankWeightedDomainsTruncated &&
        validRankDomainWeights &&
        Math.abs(listedRankWeight - expectedRankWeight) <= rankWeightTolerance &&
        (profile.citationEvents > 0
          ? expectedRankWeight > 0 &&
            expectedRankWeight <= profile.citationEvents + rankWeightTolerance
          : expectedRankWeight === 0);
      const existing = panel.promptProfiles.get(promptKey);
      if (existing) {
        for (const [domain, events] of domainEvents)
          existing.domainEvents.set(domain, (existing.domainEvents.get(domain) ?? 0) + events);
        for (const [domain, weight] of rankDomainWeights)
          existing.rankDomainWeights.set(
            domain,
            (existing.rankDomainWeights.get(domain) ?? 0) + weight
          );
        existing.citationEvents += profile.citationEvents;
        existing.rankWeightTotal += expectedRankWeight;
        existing.domainDetailComplete &&= domainDetailComplete;
        existing.rankDetailComplete &&= rankDetailComplete;
      } else {
        panel.promptProfiles.set(promptKey, {
          citationEvents: profile.citationEvents,
          domainEvents,
          domainDetailComplete,
          rankDomainWeights,
          rankWeightTotal: expectedRankWeight,
          rankDetailComplete,
        });
      }
      panels.set(providerKey, panel);
    }
  }
  for (const panel of panels.values()) {
    if (panel.promptProfiles.size !== panel.allPromptGroups) panel.catalogComplete = false;
  }
  return panels;
}

function buildPairContext(
  providerAKey: string,
  providerBKey: string,
  providerA: ProviderPanel,
  providerB: ProviderPanel
): PairContext {
  const smaller =
    providerA.promptProfiles.size <= providerB.promptProfiles.size
      ? providerA.promptProfiles
      : providerB.promptProfiles;
  let sharedPromptGroups = 0;
  let comparablePromptGroups = 0;
  let rankComparablePromptGroups = 0;
  let bothCitedPromptGroups = 0;
  let bothCitedSharedPromptGroups = 0;
  let bothCitedRankPromptGroups = 0;
  let oneSideUncitedPromptGroups = 0;
  let bothUncitedPromptGroups = 0;
  for (const promptKey of smaller.keys()) {
    const left = providerA.promptProfiles.get(promptKey);
    const right = providerB.promptProfiles.get(promptKey);
    if (!left || !right) continue;
    sharedPromptGroups += 1;
    if (left.citationEvents > 0 && right.citationEvents > 0) bothCitedSharedPromptGroups += 1;
    else if (left.citationEvents > 0 || right.citationEvents > 0) oneSideUncitedPromptGroups += 1;
    else bothUncitedPromptGroups += 1;
    if (left.domainDetailComplete && right.domainDetailComplete) {
      comparablePromptGroups += 1;
      if (left.citationEvents > 0 && right.citationEvents > 0) bothCitedPromptGroups += 1;
    }
    if (left.rankDetailComplete && right.rankDetailComplete) {
      rankComparablePromptGroups += 1;
      if (left.citationEvents > 0 && right.citationEvents > 0) bothCitedRankPromptGroups += 1;
    }
  }
  const unknownDetailPromptGroups = sharedPromptGroups - comparablePromptGroups;
  const unknownRankDetailPromptGroups = sharedPromptGroups - rankComparablePromptGroups;
  const complete =
    providerA.catalogComplete && providerB.catalogComplete && unknownDetailPromptGroups === 0;
  return {
    providerAKey,
    providerBKey,
    providerA,
    providerB,
    sharedPromptGroups,
    comparablePromptGroups,
    rankComparablePromptGroups,
    bothCitedPromptGroups,
    bothCitedSharedPromptGroups,
    oneSideUncitedPromptGroups,
    bothUncitedPromptGroups,
    unknownDetailPromptGroups,
    unknownRankDetailPromptGroups,
    bothCitedRankPromptGroups,
    complete,
  };
}

/** Compare provider citation-domain distributions over the same exact prompts in one captured sample. */
export function renderAiAnswerCitationProviderSourceDivergenceCsv(
  report: AiAnswerCitationObservationReport
): string {
  const panels = buildProviderPanels(report);
  const providerKeys = [...panels.keys()].sort((left, right) =>
    panels.get(left)!.provider.localeCompare(panels.get(right)!.provider)
  );
  const availablePairCount = (providerKeys.length * (providerKeys.length - 1)) / 2;
  const contexts: PairContext[] = [];
  let comparisonsEvaluated = 0;
  let providerPairsOmittedByBudget = 0;
  let totalBothCitedSupport = 0;
  let totalBothCitedRankSupport = 0;
  for (let index = 0; index < providerKeys.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < providerKeys.length; otherIndex += 1) {
      const providerAKey = providerKeys[index]!;
      const providerBKey = providerKeys[otherIndex]!;
      const providerA = panels.get(providerAKey)!;
      const providerB = panels.get(providerBKey)!;
      const smallerPromptCount = Math.min(
        providerA.promptProfiles.size,
        providerB.promptProfiles.size
      );
      if (
        contexts.length >= MAX_PROVIDER_PAIRS ||
        comparisonsEvaluated + smallerPromptCount > MAX_PAIR_PROMPT_COMPARISONS
      ) {
        providerPairsOmittedByBudget +=
          availablePairCount - contexts.length - providerPairsOmittedByBudget;
        break;
      }
      const context = buildPairContext(providerAKey, providerBKey, providerA, providerB);
      contexts.push(context);
      comparisonsEvaluated += smallerPromptCount;
      totalBothCitedSupport += context.bothCitedPromptGroups;
      totalBothCitedRankSupport += context.bothCitedRankPromptGroups;
    }
    if (providerPairsOmittedByBudget > 0) break;
  }
  const pairsTruncated = providerPairsOmittedByBudget > 0;
  const totalBootstrapSupport = totalBothCitedSupport + totalBothCitedRankSupport;
  const bootstrapIterations =
    totalBootstrapSupport > 0
      ? Math.min(BOOTSTRAP_ITERATIONS, Math.floor(MAX_BOOTSTRAP_DRAWS / totalBootstrapSupport))
      : 0;
  const usableBootstrapIterations =
    bootstrapIterations >= MIN_BOOTSTRAP_ITERATIONS ? bootstrapIterations : 0;
  const outputTruncated = contexts.length > MAX_OUTPUT_ROWS;
  const outputContexts = contexts.slice(0, MAX_OUTPUT_ROWS);
  const headers = [
    'row_type',
    'provider_a',
    'provider_b',
    'provider_a_prompt_groups',
    'provider_b_prompt_groups',
    'shared_exact_prompt_groups',
    'comparable_domain_detail_prompt_groups',
    'unknown_domain_detail_prompt_groups',
    'shared_both_cited_prompt_groups',
    'event_detail_eligible_both_cited_prompt_groups',
    'one_side_uncited_prompt_groups',
    'both_uncited_prompt_groups',
    'provider_a_pooled_citation_events_on_both_cited_support',
    'provider_b_pooled_citation_events_on_both_cited_support',
    'pooled_domain_jensen_shannon_divergence_bits',
    'prompt_balanced_mean_jensen_shannon_divergence_bits',
    'prompt_balanced_median_jensen_shannon_divergence_bits',
    'prompt_balanced_mean_jsd_ci95_lower',
    'prompt_balanced_mean_jsd_ci95_upper',
    'bootstrap_resamples',
    'rank_weighted_comparable_prompt_groups',
    'rank_weighted_unknown_detail_prompt_groups',
    'rank_weighted_detail_eligible_both_cited_prompt_groups',
    'provider_a_pooled_rank_weight_on_both_cited_support',
    'provider_b_pooled_rank_weight_on_both_cited_support',
    'pooled_rank_weighted_domain_jsd_bits',
    'prompt_balanced_mean_rank_weighted_jsd_bits',
    'prompt_balanced_median_rank_weighted_jsd_bits',
    'prompt_balanced_mean_rank_weighted_jsd_ci95_lower',
    'prompt_balanced_mean_rank_weighted_jsd_ci95_upper',
    'rank_weighted_bootstrap_resamples',
    'prompt_catalog_complete',
    'matched_domain_detail_complete',
    'comparison_complete',
    'pair_panel_budget_truncated',
    'rank_weighted_detail_complete',
    'rank_weighted_comparison_complete',
    'rank_weighted_bootstrap_interval_state',
    'provider_pairs_available',
    'provider_pairs_evaluated',
    'provider_pairs_omitted_by_budget',
    'pair_prompt_comparisons_evaluated',
    'output_rows_truncated',
    'bootstrap_interval_state',
    'bootstrap_budget_state',
    'interpretation_note',
  ];
  const note =
    'Event-weighted and reciprocal-log-rank-weighted Jensen–Shannon divergences use base-2 logarithms and range from 0 (identical normalized source shares) to 1 (disjoint source distributions). Providers are compared on the same exact prompt groups. Prompt-balanced means weight each both-cited prompt equally; pooled divergence aggregates source weights over matched support. Shared prompts with incomplete source detail are unknown, and prompts where either provider has no citation events are counted separately and excluded from divergence. Rank weights use 1/log2(rank+1). The deterministic bootstrap resamples comparable exact-prompt clusters and describes this supplied sample; it is not a provider ranking or visibility estimate.';
  const summary: Record<string, unknown> = Object.fromEntries(
    headers.map((header) => [header, ''])
  );
  summary.row_type = 'summary';
  summary.provider_pairs_available = availablePairCount;
  summary.provider_pairs_evaluated = contexts.length;
  summary.provider_pairs_omitted_by_budget = providerPairsOmittedByBudget;
  summary.pair_prompt_comparisons_evaluated = comparisonsEvaluated;
  summary.bootstrap_resamples = usableBootstrapIterations;
  summary.rank_weighted_bootstrap_resamples = usableBootstrapIterations;
  summary.pair_panel_budget_truncated = pairsTruncated;
  summary.bootstrap_interval_state =
    usableBootstrapIterations > 0
      ? 'available-under-common-budget'
      : 'insufficient-support-or-budget';
  summary.rank_weighted_bootstrap_interval_state =
    usableBootstrapIterations > 0
      ? 'available-under-common-budget'
      : 'insufficient-support-or-budget';
  summary.bootstrap_budget_state =
    usableBootstrapIterations === 0
      ? 'insufficient-support-or-budget'
      : usableBootstrapIterations === BOOTSTRAP_ITERATIONS
        ? 'full-budget'
        : 'reduced-budget';
  summary.output_rows_truncated = outputTruncated;
  summary.interpretation_note = note;
  const rows: Array<Record<string, unknown>> = outputContexts.map((context) => {
    const smaller =
      context.providerA.promptProfiles.size <= context.providerB.promptProfiles.size
        ? context.providerA.promptProfiles
        : context.providerB.promptProfiles;
    const pooledA = new Map<string, number>();
    const pooledB = new Map<string, number>();
    const pooledRankA = new Map<string, number>();
    const pooledRankB = new Map<string, number>();
    const promptJsdValues: number[] = [];
    const promptRankJsdValues: number[] = [];
    let providerACitationEvents = 0;
    let providerBCitationEvents = 0;
    let providerARankWeight = 0;
    let providerBRankWeight = 0;
    for (const promptKey of smaller.keys()) {
      const profileA = context.providerA.promptProfiles.get(promptKey);
      const profileB = context.providerB.promptProfiles.get(promptKey);
      if (!profileA || !profileB || profileA.citationEvents === 0 || profileB.citationEvents === 0)
        continue;
      if (profileA.domainDetailComplete && profileB.domainDetailComplete) {
        const divergence = distributionJensenShannon(profileA.domainEvents, profileB.domainEvents);
        if (divergence !== null) {
          promptJsdValues.push(divergence);
          providerACitationEvents += profileA.citationEvents;
          providerBCitationEvents += profileB.citationEvents;
          for (const [domain, events] of profileA.domainEvents)
            pooledA.set(domain, (pooledA.get(domain) ?? 0) + events);
          for (const [domain, events] of profileB.domainEvents)
            pooledB.set(domain, (pooledB.get(domain) ?? 0) + events);
        }
      }
      if (profileA.rankDetailComplete && profileB.rankDetailComplete) {
        const divergence = distributionJensenShannon(
          profileA.rankDomainWeights,
          profileB.rankDomainWeights
        );
        if (divergence !== null) {
          promptRankJsdValues.push(divergence);
          providerARankWeight += profileA.rankWeightTotal;
          providerBRankWeight += profileB.rankWeightTotal;
          for (const [domain, weight] of profileA.rankDomainWeights)
            pooledRankA.set(domain, (pooledRankA.get(domain) ?? 0) + weight);
          for (const [domain, weight] of profileB.rankDomainWeights)
            pooledRankB.set(domain, (pooledRankB.get(domain) ?? 0) + weight);
        }
      }
    }
    const pooledJsd = distributionJensenShannon(pooledA, pooledB);
    const pooledRankJsd = distributionJensenShannon(pooledRankA, pooledRankB);
    const promptMean =
      promptJsdValues.length > 0
        ? round(promptJsdValues.reduce((sum, value) => sum + value, 0) / promptJsdValues.length, 6)
        : null;
    const sortedPromptJsds = [...promptJsdValues].sort((left, right) => left - right);
    const medianPromptJsd =
      sortedPromptJsds.length > 0
        ? round(
            sortedPromptJsds.length % 2 === 1
              ? sortedPromptJsds[Math.floor(sortedPromptJsds.length / 2)]!
              : (sortedPromptJsds[sortedPromptJsds.length / 2 - 1]! +
                  sortedPromptJsds[sortedPromptJsds.length / 2]!) /
                  2,
            6
          )
        : null;
    const rankPromptMean =
      promptRankJsdValues.length > 0
        ? round(
            promptRankJsdValues.reduce((sum, value) => sum + value, 0) / promptRankJsdValues.length,
            6
          )
        : null;
    const sortedRankPromptJsds = [...promptRankJsdValues].sort((left, right) => left - right);
    const medianRankPromptJsd =
      sortedRankPromptJsds.length > 0
        ? round(
            sortedRankPromptJsds.length % 2 === 1
              ? sortedRankPromptJsds[Math.floor(sortedRankPromptJsds.length / 2)]!
              : (sortedRankPromptJsds[sortedRankPromptJsds.length / 2 - 1]! +
                  sortedRankPromptJsds[sortedRankPromptJsds.length / 2]!) /
                  2,
            6
          )
        : null;
    const interval = context.complete
      ? bootstrapMeanJensenShannon(
          promptJsdValues,
          `${context.providerAKey}\u0000${context.providerBKey}\u0000source-jsd`,
          usableBootstrapIterations
        )
      : null;
    const rankInterval =
      context.providerA.catalogComplete &&
      context.providerB.catalogComplete &&
      context.unknownRankDetailPromptGroups === 0
        ? bootstrapMeanJensenShannon(
            promptRankJsdValues,
            `${context.providerAKey}\u0000${context.providerBKey}\u0000rank-source-jsd`,
            usableBootstrapIterations
          )
        : null;
    const intervalState =
      !context.providerA.catalogComplete || !context.providerB.catalogComplete
        ? 'prompt-catalog-incomplete'
        : context.unknownDetailPromptGroups > 0
          ? 'matched-domain-detail-incomplete'
          : promptJsdValues.length < 2
            ? 'insufficient-both-cited-prompts'
            : usableBootstrapIterations < MIN_BOOTSTRAP_ITERATIONS
              ? 'budget-limited'
              : interval === null
                ? 'unavailable'
                : 'available';
    const rankIntervalState =
      !context.providerA.catalogComplete || !context.providerB.catalogComplete
        ? 'prompt-catalog-incomplete'
        : context.unknownRankDetailPromptGroups > 0
          ? 'rank-domain-detail-incomplete'
          : promptRankJsdValues.length < 2
            ? 'insufficient-both-cited-prompts'
            : usableBootstrapIterations < MIN_BOOTSTRAP_ITERATIONS
              ? 'budget-limited'
              : rankInterval === null
                ? 'unavailable'
                : 'available';
    return {
      row_type: 'provider-pair',
      provider_a: context.providerA.provider,
      provider_b: context.providerB.provider,
      provider_a_prompt_groups: context.providerA.allPromptGroups,
      provider_b_prompt_groups: context.providerB.allPromptGroups,
      shared_exact_prompt_groups: context.sharedPromptGroups,
      comparable_domain_detail_prompt_groups: context.comparablePromptGroups,
      unknown_domain_detail_prompt_groups: context.unknownDetailPromptGroups,
      shared_both_cited_prompt_groups: context.bothCitedSharedPromptGroups,
      event_detail_eligible_both_cited_prompt_groups: context.bothCitedPromptGroups,
      one_side_uncited_prompt_groups: context.oneSideUncitedPromptGroups,
      both_uncited_prompt_groups: context.bothUncitedPromptGroups,
      provider_a_pooled_citation_events_on_both_cited_support: providerACitationEvents,
      provider_b_pooled_citation_events_on_both_cited_support: providerBCitationEvents,
      pooled_domain_jensen_shannon_divergence_bits: pooledJsd === null ? null : round(pooledJsd, 6),
      prompt_balanced_mean_jensen_shannon_divergence_bits: promptMean,
      prompt_balanced_median_jensen_shannon_divergence_bits: medianPromptJsd,
      prompt_balanced_mean_jsd_ci95_lower: interval?.lower ?? null,
      prompt_balanced_mean_jsd_ci95_upper: interval?.upper ?? null,
      bootstrap_resamples: usableBootstrapIterations,
      rank_weighted_comparable_prompt_groups: context.rankComparablePromptGroups,
      rank_weighted_unknown_detail_prompt_groups: context.unknownRankDetailPromptGroups,
      rank_weighted_detail_eligible_both_cited_prompt_groups: context.bothCitedRankPromptGroups,
      provider_a_pooled_rank_weight_on_both_cited_support: round(providerARankWeight, 6),
      provider_b_pooled_rank_weight_on_both_cited_support: round(providerBRankWeight, 6),
      pooled_rank_weighted_domain_jsd_bits: pooledRankJsd === null ? null : round(pooledRankJsd, 6),
      prompt_balanced_mean_rank_weighted_jsd_bits: rankPromptMean,
      prompt_balanced_median_rank_weighted_jsd_bits: medianRankPromptJsd,
      prompt_balanced_mean_rank_weighted_jsd_ci95_lower: rankInterval?.lower ?? null,
      prompt_balanced_mean_rank_weighted_jsd_ci95_upper: rankInterval?.upper ?? null,
      rank_weighted_bootstrap_resamples: usableBootstrapIterations,
      prompt_catalog_complete:
        context.providerA.catalogComplete && context.providerB.catalogComplete,
      matched_domain_detail_complete: context.unknownDetailPromptGroups === 0,
      comparison_complete: context.complete,
      rank_weighted_detail_complete: context.unknownRankDetailPromptGroups === 0,
      rank_weighted_comparison_complete:
        context.providerA.catalogComplete &&
        context.providerB.catalogComplete &&
        context.unknownRankDetailPromptGroups === 0,
      rank_weighted_bootstrap_interval_state: rankIntervalState,
      pair_panel_budget_truncated: pairsTruncated,
      bootstrap_interval_state: intervalState,
      interpretation_note: note,
    };
  });
  return `${[summary, ...rows].map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(',')).join('\r\n')}\r\n`;
}
