import type { AiAnswerCitationObservationReport } from './answerCitationObservations';

const MAX_PROVIDER_ROWS = 50_000;
const MAX_PROMPT_COMPARISONS = 5_000_000;
const MAX_BOOTSTRAP_DRAWS = 50_000_000;
const BOOTSTRAP_ITERATIONS = 1_000;
const MIN_BOOTSTRAP_ITERATIONS = 250;
const MAX_OUTPUT_ROWS = 20_000;

const SOURCE_PORTFOLIO_DRIFT_HEADERS = [
  'row_type',
  'provider',
  'baseline_provider_present',
  'current_provider_present',
  'baseline_prompt_groups',
  'current_prompt_groups',
  'shared_exact_prompt_groups',
  'event_detail_comparable_prompt_groups',
  'event_detail_unknown_prompt_groups',
  'shared_both_cited_prompt_groups',
  'both_cited_event_detail_prompt_groups',
  'one_side_uncited_prompt_groups',
  'both_uncited_prompt_groups',
  'source_domain_presence_gains',
  'source_domain_presence_losses',
  'baseline_pooled_citation_events_on_both_cited_support',
  'current_pooled_citation_events_on_both_cited_support',
  'pooled_event_weighted_source_jsd_bits',
  'prompt_balanced_mean_source_jsd_bits',
  'prompt_balanced_median_source_jsd_bits',
  'prompt_balanced_mean_source_jsd_ci95_lower',
  'prompt_balanced_mean_source_jsd_ci95_upper',
  'rank_detail_comparable_prompt_groups',
  'rank_detail_unknown_prompt_groups',
  'both_cited_rank_detail_prompt_groups',
  'rank_weighted_source_presence_gains',
  'rank_weighted_source_presence_losses',
  'baseline_pooled_rank_weight_on_both_cited_support',
  'current_pooled_rank_weight_on_both_cited_support',
  'pooled_rank_weighted_source_jsd_bits',
  'prompt_balanced_mean_rank_source_jsd_bits',
  'prompt_balanced_median_rank_source_jsd_bits',
  'prompt_balanced_mean_rank_source_jsd_ci95_lower',
  'prompt_balanced_mean_rank_source_jsd_ci95_upper',
  'event_catalog_complete',
  'event_source_detail_complete',
  'event_comparison_complete',
  'rank_catalog_complete',
  'rank_source_detail_complete',
  'rank_comparison_complete',
  'event_bootstrap_resamples',
  'rank_bootstrap_resamples',
  'event_bootstrap_interval_state',
  'rank_bootstrap_interval_state',
  'interpretation_note',
  'baseline_providers_available',
  'current_providers_available',
  'providers_available',
  'providers_evaluated',
  'providers_omitted_by_budget',
  'prompt_comparisons_evaluated',
  'output_rows_truncated',
];

interface PromptSourceProfile {
  citationEvents: number;
  domainEvents: Map<string, number>;
  eventDetailComplete: boolean;
  rankDomainWeights: Map<string, number>;
  rankWeightTotal: number;
  rankDetailComplete: boolean;
}

interface ProviderPanel {
  provider: string;
  promptGroups: number;
  promptProfiles: Map<string, PromptSourceProfile>;
  catalogComplete: boolean;
}

interface DriftProviderResult {
  row_type: string;
  provider: string;
  baseline_provider_present: boolean;
  current_provider_present: boolean;
  baseline_prompt_groups: number;
  current_prompt_groups: number;
  shared_exact_prompt_groups: number;
  event_detail_comparable_prompt_groups: number;
  event_detail_unknown_prompt_groups: number;
  shared_both_cited_prompt_groups: number;
  both_cited_event_detail_prompt_groups: number;
  one_side_uncited_prompt_groups: number;
  both_uncited_prompt_groups: number;
  source_domain_presence_gains: number;
  source_domain_presence_losses: number;
  baseline_pooled_citation_events_on_both_cited_support: number;
  current_pooled_citation_events_on_both_cited_support: number;
  pooled_event_weighted_source_jsd_bits: number | null;
  prompt_balanced_mean_source_jsd_bits: number | null;
  prompt_balanced_median_source_jsd_bits: number | null;
  prompt_balanced_mean_source_jsd_ci95_lower: number | null;
  prompt_balanced_mean_source_jsd_ci95_upper: number | null;
  rank_detail_comparable_prompt_groups: number;
  rank_detail_unknown_prompt_groups: number;
  both_cited_rank_detail_prompt_groups: number;
  rank_weighted_source_presence_gains: number;
  rank_weighted_source_presence_losses: number;
  baseline_pooled_rank_weight_on_both_cited_support: number;
  current_pooled_rank_weight_on_both_cited_support: number;
  pooled_rank_weighted_source_jsd_bits: number | null;
  prompt_balanced_mean_rank_source_jsd_bits: number | null;
  prompt_balanced_median_rank_source_jsd_bits: number | null;
  prompt_balanced_mean_rank_source_jsd_ci95_lower: number | null;
  prompt_balanced_mean_rank_source_jsd_ci95_upper: number | null;
  event_catalog_complete: boolean;
  event_source_detail_complete: boolean;
  event_comparison_complete: boolean;
  rank_catalog_complete: boolean;
  rank_source_detail_complete: boolean;
  rank_comparison_complete: boolean;
  event_bootstrap_resamples: number;
  rank_bootstrap_resamples: number;
  event_bootstrap_interval_state: string;
  rank_bootstrap_interval_state: string;
  interpretation_note: string;
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

function bootstrapInterval(
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
  means.sort((left, right) => left - right);
  return {
    lower: round(means[Math.floor((iterations - 1) * 0.025)]!, 6),
    upper: round(means[Math.ceil((iterations - 1) * 0.975)]!, 6),
  };
}

function exactBinomialUpperTail(successes: number, trials: number): number {
  if (trials < 1 || successes < 0 || successes > trials) return 1;
  let logProbability = -trials * Math.LN2;
  let logTail = Number.NEGATIVE_INFINITY;
  for (let outcome = 0; outcome <= trials; outcome += 1) {
    if (outcome >= successes) {
      const larger = Math.max(logTail, logProbability);
      logTail = larger + Math.log(Math.exp(logTail - larger) + Math.exp(logProbability - larger));
    }
    if (outcome < trials) logProbability += Math.log(trials - outcome) - Math.log(outcome + 1);
  }
  return Math.min(1, Math.exp(logTail));
}

function holmAdjustedPValues(pValues: number[]): number[] {
  const order = pValues
    .map((pValue, index) => ({ pValue, index }))
    .sort((left, right) => left.pValue - right.pValue || left.index - right.index);
  const adjusted = new Array<number>(pValues.length);
  let monotoneMinimum = 0;
  order.forEach(({ pValue, index }, rank) => {
    monotoneMinimum = Math.max(monotoneMinimum, Math.min(1, pValue * (order.length - rank)));
    adjusted[index] = monotoneMinimum;
  });
  return adjusted;
}

function buildProviderPanels(
  report: AiAnswerCitationObservationReport
): Map<string, ProviderPanel> {
  const panels = new Map<string, ProviderPanel>();
  for (const provider of report.providers) {
    const key = normalizedLabel(provider.provider);
    panels.set(key, {
      provider: provider.provider,
      promptGroups: provider.uniquePrompts,
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
        promptGroups: 0,
        promptProfiles: new Map<string, PromptSourceProfile>(),
        catalogComplete: !report.promptsTruncated,
      };
      const domainEvents = new Map<string, number>();
      let validDomainEvents = true;
      for (const item of profile.citedDomainCitationEvents ?? []) {
        if (!Number.isFinite(item.citationEvents) || item.citationEvents < 0) {
          validDomainEvents = false;
          continue;
        }
        const key = item.domain.toLowerCase();
        domainEvents.set(key, (domainEvents.get(key) ?? 0) + item.citationEvents);
      }
      const listedEvents = [...domainEvents.values()].reduce((sum, events) => sum + events, 0);
      const eventDetailComplete =
        Array.isArray(profile.citedDomainCitationEvents) &&
        typeof profile.citedDomainsTruncated === 'boolean' &&
        !profile.citedDomainsTruncated &&
        validDomainEvents &&
        listedEvents === profile.citationEvents;

      const rankDomainWeights = new Map<string, number>();
      let validRankWeights = true;
      for (const item of profile.rankWeightedDomainCitationEvents ?? []) {
        if (!Number.isFinite(item.discountedCitationWeight) || item.discountedCitationWeight < 0) {
          validRankWeights = false;
          continue;
        }
        const key = item.domain.toLowerCase();
        rankDomainWeights.set(
          key,
          (rankDomainWeights.get(key) ?? 0) + item.discountedCitationWeight
        );
      }
      const rankWeightTotal = profile.rankWeightedCitationWeightTotal ?? 0;
      const listedRankWeight = [...rankDomainWeights.values()].reduce(
        (sum, weight) => sum + weight,
        0
      );
      const rankWeightTolerance = Math.max(1e-9, rankWeightTotal * 1e-9);
      const rankDetailComplete =
        Array.isArray(profile.rankWeightedDomainCitationEvents) &&
        Number.isFinite(profile.rankWeightedCitationWeightTotal) &&
        rankWeightTotal >= 0 &&
        typeof profile.rankWeightedDomainsTruncated === 'boolean' &&
        !profile.rankWeightedDomainsTruncated &&
        validRankWeights &&
        Math.abs(listedRankWeight - rankWeightTotal) <= rankWeightTolerance &&
        (profile.citationEvents > 0
          ? rankWeightTotal > 0 && rankWeightTotal <= profile.citationEvents + rankWeightTolerance
          : rankWeightTotal === 0);

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
        existing.rankWeightTotal += rankWeightTotal;
        existing.eventDetailComplete &&= eventDetailComplete;
        existing.rankDetailComplete &&= rankDetailComplete;
      } else {
        panel.promptProfiles.set(promptKey, {
          citationEvents: profile.citationEvents,
          domainEvents,
          eventDetailComplete,
          rankDomainWeights,
          rankWeightTotal,
          rankDetailComplete,
        });
      }
      panels.set(providerKey, panel);
    }
  }
  for (const panel of panels.values()) {
    if (panel.promptProfiles.size !== panel.promptGroups) panel.catalogComplete = false;
  }
  return panels;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted.length % 2 === 1
    ? round(sorted[Math.floor(sorted.length / 2)]!, 6)
    : round((sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2, 6);
}

/** Compare citation source-distribution drift on matched provider/exact-prompt groups across two samples. */
export function renderAiAnswerCitationSourcePortfolioDriftCsv(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  const currentPanels = buildProviderPanels(current);
  const baselinePanels = buildProviderPanels(baseline);
  const providerKeys = [...new Set([...baselinePanels.keys(), ...currentPanels.keys()])].sort(
    (left, right) =>
      (currentPanels.get(left)?.provider ?? baselinePanels.get(left)!.provider).localeCompare(
        currentPanels.get(right)?.provider ?? baselinePanels.get(right)!.provider
      )
  );
  const contexts: Array<{
    providerKey: string;
    baselinePanel?: ProviderPanel;
    currentPanel?: ProviderPanel;
    profileCount: number;
    result: DriftProviderResult;
    eventValues: number[];
    rankValues: number[];
  }> = [];
  let comparisonsEvaluated = 0;
  let sharedPromptGroupsEvaluated = 0;
  let providersOmittedByBudget = 0;
  let totalBootstrapSupport = 0;
  for (const providerKey of providerKeys) {
    const baselinePanel = baselinePanels.get(providerKey);
    const currentPanel = currentPanels.get(providerKey);
    const profileCount = Math.min(
      baselinePanel?.promptProfiles.size ?? 0,
      currentPanel?.promptProfiles.size ?? 0
    );
    if (
      contexts.length >= MAX_PROVIDER_ROWS ||
      comparisonsEvaluated + profileCount > MAX_PROMPT_COMPARISONS
    ) {
      providersOmittedByBudget = providerKeys.length - contexts.length;
      break;
    }
    const smaller =
      (baselinePanel?.promptProfiles.size ?? 0) <= (currentPanel?.promptProfiles.size ?? 0)
        ? baselinePanel?.promptProfiles
        : currentPanel?.promptProfiles;
    let sharedPrompts = 0;
    let eventComparablePrompts = 0;
    let rankComparablePrompts = 0;
    let bothCitedPrompts = 0;
    let oneSideUncitedPrompts = 0;
    let bothUncitedPrompts = 0;
    let sourceGains = 0;
    let sourceLosses = 0;
    let rankSourceGains = 0;
    let rankSourceLosses = 0;
    const eventValues: number[] = [];
    const rankValues: number[] = [];
    const baselinePooledEvents = new Map<string, number>();
    const currentPooledEvents = new Map<string, number>();
    const baselinePooledRank = new Map<string, number>();
    const currentPooledRank = new Map<string, number>();
    let baselineCitationEvents = 0;
    let currentCitationEvents = 0;
    let baselineRankWeight = 0;
    let currentRankWeight = 0;
    if (smaller && baselinePanel && currentPanel) {
      for (const promptKey of smaller.keys()) {
        const baselineProfile = baselinePanel.promptProfiles.get(promptKey);
        const currentProfile = currentPanel.promptProfiles.get(promptKey);
        if (!baselineProfile || !currentProfile) continue;
        sharedPrompts += 1;
        if (baselineProfile.citationEvents > 0 && currentProfile.citationEvents > 0)
          bothCitedPrompts += 1;
        else if (baselineProfile.citationEvents > 0 || currentProfile.citationEvents > 0)
          oneSideUncitedPrompts += 1;
        else bothUncitedPrompts += 1;

        if (baselineProfile.eventDetailComplete && currentProfile.eventDetailComplete) {
          eventComparablePrompts += 1;
          const baselineDomains = new Set(
            [...baselineProfile.domainEvents]
              .filter(([, count]) => count > 0)
              .map(([domain]) => domain)
          );
          const currentDomains = new Set(
            [...currentProfile.domainEvents]
              .filter(([, count]) => count > 0)
              .map(([domain]) => domain)
          );
          for (const domain of currentDomains) if (!baselineDomains.has(domain)) sourceGains += 1;
          for (const domain of baselineDomains) if (!currentDomains.has(domain)) sourceLosses += 1;
          if (baselineProfile.citationEvents > 0 && currentProfile.citationEvents > 0) {
            const divergence = distributionJensenShannon(
              baselineProfile.domainEvents,
              currentProfile.domainEvents
            );
            if (divergence !== null) {
              eventValues.push(divergence);
              baselineCitationEvents += baselineProfile.citationEvents;
              currentCitationEvents += currentProfile.citationEvents;
              for (const [domain, events] of baselineProfile.domainEvents)
                baselinePooledEvents.set(domain, (baselinePooledEvents.get(domain) ?? 0) + events);
              for (const [domain, events] of currentProfile.domainEvents)
                currentPooledEvents.set(domain, (currentPooledEvents.get(domain) ?? 0) + events);
            }
          }
        }
        if (baselineProfile.rankDetailComplete && currentProfile.rankDetailComplete) {
          rankComparablePrompts += 1;
          const baselineDomains = new Set(
            [...baselineProfile.rankDomainWeights]
              .filter(([, weight]) => weight > 0)
              .map(([domain]) => domain)
          );
          const currentDomains = new Set(
            [...currentProfile.rankDomainWeights]
              .filter(([, weight]) => weight > 0)
              .map(([domain]) => domain)
          );
          for (const domain of currentDomains)
            if (!baselineDomains.has(domain)) rankSourceGains += 1;
          for (const domain of baselineDomains)
            if (!currentDomains.has(domain)) rankSourceLosses += 1;
          if (baselineProfile.citationEvents > 0 && currentProfile.citationEvents > 0) {
            const divergence = distributionJensenShannon(
              baselineProfile.rankDomainWeights,
              currentProfile.rankDomainWeights
            );
            if (divergence !== null) {
              rankValues.push(divergence);
              baselineRankWeight += baselineProfile.rankWeightTotal;
              currentRankWeight += currentProfile.rankWeightTotal;
              for (const [domain, weight] of baselineProfile.rankDomainWeights)
                baselinePooledRank.set(domain, (baselinePooledRank.get(domain) ?? 0) + weight);
              for (const [domain, weight] of currentProfile.rankDomainWeights)
                currentPooledRank.set(domain, (currentPooledRank.get(domain) ?? 0) + weight);
            }
          }
        }
      }
    }
    comparisonsEvaluated += profileCount;
    sharedPromptGroupsEvaluated += sharedPrompts;
    totalBootstrapSupport += eventValues.length + rankValues.length;
    const eventCatalogComplete = Boolean(
      baselinePanel?.catalogComplete && currentPanel?.catalogComplete
    );
    const rankCatalogComplete = eventCatalogComplete;
    const eventDetailComplete =
      baselinePanel !== undefined &&
      currentPanel !== undefined &&
      eventCatalogComplete &&
      sharedPrompts === eventComparablePrompts;
    const rankDetailComplete =
      baselinePanel !== undefined &&
      currentPanel !== undefined &&
      rankCatalogComplete &&
      sharedPrompts === rankComparablePrompts;
    contexts.push({
      providerKey,
      baselinePanel,
      currentPanel,
      profileCount,
      eventValues,
      rankValues,
      result: {
        row_type: 'provider',
        provider: currentPanel?.provider ?? baselinePanel?.provider ?? providerKey,
        baseline_provider_present: baselinePanel !== undefined,
        current_provider_present: currentPanel !== undefined,
        baseline_prompt_groups: baselinePanel?.promptGroups ?? 0,
        current_prompt_groups: currentPanel?.promptGroups ?? 0,
        shared_exact_prompt_groups: sharedPrompts,
        event_detail_comparable_prompt_groups: eventComparablePrompts,
        event_detail_unknown_prompt_groups: sharedPrompts - eventComparablePrompts,
        shared_both_cited_prompt_groups: bothCitedPrompts,
        both_cited_event_detail_prompt_groups: eventValues.length,
        one_side_uncited_prompt_groups: oneSideUncitedPrompts,
        both_uncited_prompt_groups: bothUncitedPrompts,
        source_domain_presence_gains: sourceGains,
        source_domain_presence_losses: sourceLosses,
        baseline_pooled_citation_events_on_both_cited_support: baselineCitationEvents,
        current_pooled_citation_events_on_both_cited_support: currentCitationEvents,
        pooled_event_weighted_source_jsd_bits: null,
        prompt_balanced_mean_source_jsd_bits: eventValues.length
          ? round(eventValues.reduce((sum, value) => sum + value, 0) / eventValues.length, 6)
          : null,
        prompt_balanced_median_source_jsd_bits: median(eventValues),
        prompt_balanced_mean_source_jsd_ci95_lower: null,
        prompt_balanced_mean_source_jsd_ci95_upper: null,
        rank_detail_comparable_prompt_groups: rankComparablePrompts,
        rank_detail_unknown_prompt_groups: sharedPrompts - rankComparablePrompts,
        both_cited_rank_detail_prompt_groups: rankValues.length,
        rank_weighted_source_presence_gains: rankSourceGains,
        rank_weighted_source_presence_losses: rankSourceLosses,
        baseline_pooled_rank_weight_on_both_cited_support: round(baselineRankWeight, 6),
        current_pooled_rank_weight_on_both_cited_support: round(currentRankWeight, 6),
        pooled_rank_weighted_source_jsd_bits: null,
        prompt_balanced_mean_rank_source_jsd_bits: rankValues.length
          ? round(rankValues.reduce((sum, value) => sum + value, 0) / rankValues.length, 6)
          : null,
        prompt_balanced_median_rank_source_jsd_bits: median(rankValues),
        prompt_balanced_mean_rank_source_jsd_ci95_lower: null,
        prompt_balanced_mean_rank_source_jsd_ci95_upper: null,
        event_catalog_complete: eventCatalogComplete,
        event_source_detail_complete: sharedPrompts === eventComparablePrompts,
        event_comparison_complete: eventDetailComplete,
        rank_catalog_complete: rankCatalogComplete,
        rank_source_detail_complete: sharedPrompts === rankComparablePrompts,
        rank_comparison_complete: rankDetailComplete,
        event_bootstrap_resamples: 0,
        rank_bootstrap_resamples: 0,
        event_bootstrap_interval_state: 'not-computed',
        rank_bootstrap_interval_state: 'not-computed',
        interpretation_note: '',
      },
    });
    const context = contexts[contexts.length - 1]!;
    context.result.pooled_event_weighted_source_jsd_bits = distributionJensenShannon(
      baselinePooledEvents,
      currentPooledEvents
    );
    if (context.result.pooled_event_weighted_source_jsd_bits !== null)
      context.result.pooled_event_weighted_source_jsd_bits = round(
        context.result.pooled_event_weighted_source_jsd_bits,
        6
      );
    context.result.pooled_rank_weighted_source_jsd_bits = distributionJensenShannon(
      baselinePooledRank,
      currentPooledRank
    );
    if (context.result.pooled_rank_weighted_source_jsd_bits !== null)
      context.result.pooled_rank_weighted_source_jsd_bits = round(
        context.result.pooled_rank_weighted_source_jsd_bits,
        6
      );
  }

  const bootstrapIterations =
    totalBootstrapSupport > 0
      ? Math.min(BOOTSTRAP_ITERATIONS, Math.floor(MAX_BOOTSTRAP_DRAWS / totalBootstrapSupport))
      : 0;
  const usableBootstrapIterations =
    bootstrapIterations >= MIN_BOOTSTRAP_ITERATIONS ? bootstrapIterations : 0;
  const outputTruncated = contexts.length > MAX_OUTPUT_ROWS;
  const outputContexts = contexts.slice(0, MAX_OUTPUT_ROWS);
  const note =
    'Jensen–Shannon divergence uses base-2 logarithms and ranges from 0 (identical normalized source shares) to 1 (disjoint source distributions). Each provider is compared on matched exact prompts. Prompt-balanced means weight each both-cited prompt equally; pooled divergence aggregates the matched citation events or reciprocal-log-rank weights. Source-presence gains/losses count domain-by-prompt transitions over comparable detail, including one-sided uncited prompts. Capped or missing prompt/domain detail is unknown. Intervals resample exact prompt clusters and describe these supplied samples; they are not causal or model-visibility estimates.';
  const headers = SOURCE_PORTFOLIO_DRIFT_HEADERS;
  const outputRows: Array<Record<string, unknown>> = [];
  for (const context of outputContexts) {
    const eventInterval = context.result.event_comparison_complete
      ? bootstrapInterval(
          context.eventValues,
          `${context.providerKey}\u0000event-source-drift`,
          usableBootstrapIterations
        )
      : null;
    const rankInterval = context.result.rank_comparison_complete
      ? bootstrapInterval(
          context.rankValues,
          `${context.providerKey}\u0000rank-source-drift`,
          usableBootstrapIterations
        )
      : null;
    context.result.prompt_balanced_mean_source_jsd_ci95_lower = eventInterval?.lower ?? null;
    context.result.prompt_balanced_mean_source_jsd_ci95_upper = eventInterval?.upper ?? null;
    context.result.prompt_balanced_mean_rank_source_jsd_ci95_lower = rankInterval?.lower ?? null;
    context.result.prompt_balanced_mean_rank_source_jsd_ci95_upper = rankInterval?.upper ?? null;
    context.result.event_bootstrap_resamples = usableBootstrapIterations;
    context.result.rank_bootstrap_resamples = usableBootstrapIterations;
    context.result.event_bootstrap_interval_state = !context.result.event_catalog_complete
      ? 'prompt-catalog-incomplete'
      : !context.result.event_source_detail_complete
        ? 'matched-source-detail-incomplete'
        : context.eventValues.length < 2
          ? 'insufficient-both-cited-prompts'
          : usableBootstrapIterations < MIN_BOOTSTRAP_ITERATIONS
            ? 'budget-limited'
            : eventInterval
              ? 'available'
              : 'unavailable';
    context.result.rank_bootstrap_interval_state = !context.result.rank_catalog_complete
      ? 'prompt-catalog-incomplete'
      : !context.result.rank_source_detail_complete
        ? 'matched-rank-detail-incomplete'
        : context.rankValues.length < 2
          ? 'insufficient-both-cited-prompts'
          : usableBootstrapIterations < MIN_BOOTSTRAP_ITERATIONS
            ? 'budget-limited'
            : rankInterval
              ? 'available'
              : 'unavailable';
    context.result.interpretation_note = note;
    outputRows.push({ ...context.result });
  }
  const summary: Record<string, unknown> = Object.fromEntries(
    headers.map((header) => [header, ''])
  );
  summary.row_type = 'summary';
  summary.baseline_providers_available = baselinePanels.size;
  summary.current_providers_available = currentPanels.size;
  summary.shared_exact_prompt_groups = sharedPromptGroupsEvaluated;
  summary.event_bootstrap_resamples = usableBootstrapIterations;
  summary.rank_bootstrap_resamples = usableBootstrapIterations;
  summary.event_bootstrap_interval_state =
    usableBootstrapIterations === 0 ? 'insufficient-support-or-budget' : 'shared-budget-available';
  summary.rank_bootstrap_interval_state =
    usableBootstrapIterations === 0 ? 'insufficient-support-or-budget' : 'shared-budget-available';
  summary.event_comparison_complete =
    providersOmittedByBudget === 0 &&
    contexts.every((context) => context.result.event_comparison_complete);
  summary.rank_comparison_complete =
    providersOmittedByBudget === 0 &&
    contexts.every((context) => context.result.rank_comparison_complete);
  summary.interpretation_note = `${note} Summary reports provider and prompt-comparison budget usage; output_rows_truncated=${outputTruncated}.`;
  summary.providers_available = providerKeys.length;
  summary.providers_evaluated = contexts.length;
  summary.providers_omitted_by_budget = providersOmittedByBudget;
  summary.prompt_comparisons_evaluated = comparisonsEvaluated;
  summary.output_rows_truncated = outputTruncated;
  return `${[summary, ...outputRows].map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(',')).join('\r\n')}\r\n`;
}

function parseSourcePortfolioDriftCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (!quoted && character === ',') {
      row.push(field);
      field = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
    } else field += character;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((values) => values.map((value) => value.replace(/^(\s*)'(?=[=+\-@])/, '$1')));
}

function sourcePortfolioDriftRecords(csv: string): Array<Record<string, unknown>> {
  const booleanFields = new Set([
    'baseline_provider_present',
    'current_provider_present',
    'event_catalog_complete',
    'event_source_detail_complete',
    'event_comparison_complete',
    'rank_catalog_complete',
    'rank_source_detail_complete',
    'rank_comparison_complete',
    'output_rows_truncated',
  ]);
  const stringFields = new Set([
    'row_type',
    'provider',
    'event_bootstrap_interval_state',
    'rank_bootstrap_interval_state',
    'interpretation_note',
  ]);
  return parseSourcePortfolioDriftCsv(csv)
    .filter((row) => row.length > 1)
    .map((values) =>
      Object.fromEntries(
        SOURCE_PORTFOLIO_DRIFT_HEADERS.map((header, index) => {
          const value = values[index] ?? '';
          if (stringFields.has(header)) return [header, value];
          if (booleanFields.has(header)) return [header, value === '' ? null : value === 'true'];
          if (value === '') return [header, null];
          const numericValue = Number(value);
          return [header, Number.isFinite(numericValue) ? numericValue : value];
        })
      )
    );
}

/** Render a standalone, filterable dashboard from a source-portfolio drift export. */
export function renderAiAnswerCitationSourcePortfolioDriftHtmlFromCsv(csv: string): string {
  const headers = SOURCE_PORTFOLIO_DRIFT_HEADERS;
  const records = sourcePortfolioDriftRecords(csv);
  const summary = records.find((row) => row.row_type === 'summary') ?? {};
  const providers = records.filter((row) => row.row_type === 'provider');
  const safeJson = JSON.stringify({ headers, summary, providers })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GEO source portfolio drift</title><style>
:root{color-scheme:dark;--bg:#101513;--panel:#18211c;--ink:#edf5ee;--muted:#a8b8aa;--line:#34463a;--mint:#a6efc3;--red:#ff9586;--green:#74d6a0}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 12% 0%,#25372b,var(--bg) 45%);color:var(--ink);font:15px/1.5 ui-sans-serif,system-ui,sans-serif}main{max-width:1320px;margin:auto;padding:36px 22px 64px}h1{font-size:clamp(28px,5vw,48px);line-height:1.05;letter-spacing:-.04em;margin:12px 0}.eyebrow{color:var(--mint);font:700 11px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}p,.muted{color:var(--muted);max-width:1000px}.controls,.cards,.panel{border:1px solid var(--line);background:#18211ce8;border-radius:18px}.controls{display:flex;gap:12px;align-items:end;flex-wrap:wrap;padding:16px;margin:24px 0}.controls label{display:grid;gap:6px;color:var(--muted);font:12px ui-monospace,monospace}select,input,button{background:#111814;color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:10px 12px;font:inherit}button{cursor:pointer;color:var(--mint)}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:1px;overflow:hidden;margin-bottom:20px}.card{background:#18211c;padding:17px}.card b{display:block;font-size:25px;letter-spacing:-.03em}.card span{color:var(--muted);font:11px ui-monospace,monospace}.panel{padding:20px;margin:18px 0}.panel h2{font-size:18px;margin:0 0 8px}.chart{display:grid;gap:12px;margin-top:18px}.barrow{display:grid;grid-template-columns:minmax(110px,190px) 1fr 180px;gap:12px;align-items:center}.provider{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px ui-monospace,monospace}.track{height:14px;background:#29352d;border-radius:99px;position:relative}.bar{height:100%;position:absolute;left:0;top:0;border-radius:99px;background:linear-gradient(90deg,#53b982,var(--mint))}.interval{height:2px;position:absolute;top:6px;background:#fff;z-index:1}.interval:before,.interval:after{content:'';position:absolute;width:2px;height:8px;top:-3px;background:#fff}.interval:before{left:0}.interval:after{right:0}.value{text-align:right;font:11px ui-monospace,monospace;color:var(--muted)}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:1160px}th,td{text-align:left;padding:10px 9px;border-bottom:1px solid var(--line);font-size:12px;vertical-align:top}th{color:var(--muted);font:11px ui-monospace,monospace;position:sticky;top:0;background:var(--panel)}td.num{text-align:right;font-variant-numeric:tabular-nums}td.state{font:11px ui-monospace,monospace}.pill{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:2px 7px;color:var(--mint)}.empty{color:var(--muted);padding:20px;text-align:center}.note{font-size:12px;line-height:1.7}@media(max-width:680px){main{padding:24px 14px}.barrow{grid-template-columns:95px 1fr 120px;gap:8px}.value{font-size:10px}}
</style></head><body><main><div class="eyebrow">Aviary · Generative Engine Optimization</div><h1>Source portfolio drift</h1><p>Compare citation-source distributions across matched provider and exact-prompt groups. Prompt-balanced divergence gives each both-cited prompt one vote; pooled divergence preserves citation volume. Intervals resample prompt groups.</p><section class="controls"><label>Provider<select id="provider"><option value="all">All providers</option></select></label><label>Distribution<select id="weighting"><option value="event">Citation events</option><option value="rank">Reciprocal log rank</option></select></label><label>Find provider<input id="search" type="search" placeholder="Filter provider names"></label><button id="download" type="button">Download filtered CSV</button></section><section class="cards" id="cards"></section><section class="panel"><h2>Prompt-balanced source divergence</h2><p class="muted">Jensen–Shannon divergence ranges from 0 for identical source shares to 1 for disjoint distributions. Whiskers show nominal 95% prompt-cluster intervals when available.</p><div id="chart" class="chart"></div></section><section class="panel"><h2>Provider detail</h2><div class="table-wrap"><table><thead><tr><th>Provider</th><th>Shared / both-cited prompts</th><th>Event mean / median JSD · 95% interval</th><th>Event pooled JSD</th><th>Event gains / losses</th><th>Event state</th><th>Rank mean / median JSD · 95% interval</th><th>Rank pooled JSD</th><th>Rank gains / losses</th><th>Rank state</th></tr></thead><tbody id="rows"></tbody></table></div></section><p id="note" class="note"></p></main><script>
const data=${safeJson};const providerSelect=document.querySelector('#provider');const search=document.querySelector('#search');const weightingSelect=document.querySelector('#weighting');const cards=document.querySelector('#cards');const chart=document.querySelector('#chart');const rows=document.querySelector('#rows');const note=document.querySelector('#note');for(const row of data.providers){const option=document.createElement('option');option.value=row.provider;option.textContent=row.provider;providerSelect.append(option)}const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));const number=value=>value===''||value===null||value===undefined?null:Number(value);const choose=(row,metric)=>metric==='event'?{mean:number(row.prompt_balanced_mean_source_jsd_bits),lower:number(row.prompt_balanced_mean_source_jsd_ci95_lower),upper:number(row.prompt_balanced_mean_source_jsd_ci95_upper),pooled:number(row.pooled_event_weighted_source_jsd_bits),gains:number(row.source_domain_presence_gains),losses:number(row.source_domain_presence_losses),state:row.event_bootstrap_interval_state}:{mean:number(row.prompt_balanced_mean_rank_source_jsd_bits),lower:number(row.prompt_balanced_mean_rank_source_jsd_ci95_lower),upper:number(row.prompt_balanced_mean_rank_source_jsd_ci95_upper),pooled:number(row.pooled_rank_weighted_source_jsd_bits),gains:number(row.rank_weighted_source_presence_gains),losses:number(row.rank_weighted_source_presence_losses),state:row.rank_bootstrap_interval_state};function fmt(value,digits=4){return value===null?'—':value.toFixed(digits)}function update(){const selected=providerSelect.value;const query=search.value.trim().toLowerCase();const visible=data.providers.filter(row=>(selected==='all'||row.provider===selected)&&row.provider.toLowerCase().includes(query));const metric=weightingSelect.value;const selectedRows=visible;const shared=selectedRows.reduce((sum,row)=>sum+Number(row.shared_exact_prompt_groups||0),0);const both=selectedRows.reduce((sum,row)=>sum+Number(row.shared_both_cited_prompt_groups||0),0);const measures=selectedRows.map(row=>choose(row,metric));const available=measures.filter(value=>value.mean!==null);const mean=available.length?available.reduce((sum,value)=>sum+value.mean,0)/available.length:null;const intervals=measures.filter(value=>value.lower!==null&&value.upper!==null).length;const gain=selectedRows.reduce((sum,row)=>sum+Number(choose(row,metric).gains||0),0);const loss=selectedRows.reduce((sum,row)=>sum+Number(choose(row,metric).losses||0),0);cards.innerHTML=[['Providers',selectedRows.length],['Shared prompt groups',shared],['Both cited prompts',both],['Mean prompt-balanced JSD',fmt(mean)],['Intervals available',intervals],['Source domain gains',gain],['Source domain losses',loss]].map(([label,value])=>'<div class="card"><b>'+esc(value)+'</b><span>'+esc(label)+'</span></div>').join('');const sorted=[...visible].sort((a,b)=>(choose(b,metric).mean??-1)-(choose(a,metric).mean??-1));chart.innerHTML=sorted.length?sorted.slice(0,60).map(row=>{const v=choose(row,metric);const width=Math.max(0,Math.min(100,(v.mean??0)*100));const interval=v.lower===null||v.upper===null?'':'<i class="interval" style="left:'+(v.lower*100)+'%;width:'+((v.upper-v.lower)*100)+'%"></i>';return '<div class="barrow"><span class="provider" title="'+esc(row.provider)+'">'+esc(row.provider)+'</span><span class="track">'+interval+'<i class="bar" style="width:'+width+'%"></i></span><span class="value">'+(v.mean===null?'unavailable':fmt(v.mean)+' bits · '+esc(v.state))+'</span></div>'}).join(''):'<div class="empty">No providers match this filter.</div>';rows.innerHTML=sorted.slice(0,500).map(row=>{const e=choose(row,'event'),r=choose(row,'rank');const interval=v=>v.lower===null||v.upper===null?'—':fmt(v.lower)+' to '+fmt(v.upper);return '<tr><td>'+esc(row.provider)+'<br><span class="pill">'+esc(row.event_comparison_complete==='true'?'event detail complete':'event detail partial')+'</span></td><td class="num">'+esc(row.shared_exact_prompt_groups)+' shared<br>'+esc(row.shared_both_cited_prompt_groups)+' both cited</td><td class="num">'+fmt(e.mean)+' mean · '+fmt(number(row.prompt_balanced_median_source_jsd_bits))+' median<br>'+interval(e)+'</td><td class="num">'+fmt(e.pooled)+'</td><td class="num">'+esc(e.gains)+' / '+esc(e.losses)+'</td><td class="state">'+esc(row.event_bootstrap_interval_state)+'</td><td class="num">'+fmt(r.mean)+' mean · '+fmt(number(row.prompt_balanced_median_rank_source_jsd_bits))+' median<br>'+interval(r)+'</td><td class="num">'+fmt(r.pooled)+'</td><td class="num">'+esc(r.gains)+' / '+esc(r.losses)+'</td><td class="state">'+esc(row.rank_bootstrap_interval_state)+'</td></tr>'}).join('');note.textContent=data.summary.interpretation_note||''}function csvCell(value){let text=String(value??'');const first=text.trimStart().charAt(0);if(first&&'=+-@'.includes(first))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'}for(const control of [providerSelect,weightingSelect])control.addEventListener('change',update);search.addEventListener('input',update);document.querySelector('#download').addEventListener('click',()=>{const selected=providerSelect.value;const query=search.value.trim().toLowerCase();const filtered=data.providers.filter(row=>(selected==='all'||row.provider===selected)&&row.provider.toLowerCase().includes(query));const values=[data.headers,...[data.summary,...filtered].map(row=>data.headers.map(header=>row[header]??''))];const csv=values.map(row=>row.map(csvCell).join(',')).join('\\r\\n')+'\\r\\n';const link=document.createElement('a');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.href=url;link.download='source-portfolio-drift-filtered.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),0)});update();
</script></body></html>`;
}

/** Render a standalone, filterable dashboard for matched-prompt source-portfolio drift. */
export function renderAiAnswerCitationSourcePortfolioDriftHtml(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  return renderAiAnswerCitationSourcePortfolioDriftHtmlFromCsv(
    renderAiAnswerCitationSourcePortfolioDriftCsv(current, baseline)
  );
}

/** Serialize drift summary and provider rows as versioned structured data without raw prompts. */
export function renderAiAnswerCitationSourcePortfolioDriftJsonFromCsv(csv: string): string {
  const records = sourcePortfolioDriftRecords(csv);
  const summary = records.find((row) => row.row_type === 'summary') ?? {};
  const providerRows = records.filter((row) => row.row_type === 'provider');
  return `${JSON.stringify({ formatVersion: 1, summary, providerRows }, null, 2)}\n`;
}

/** Render versioned structured source-portfolio drift data. */
export function renderAiAnswerCitationSourcePortfolioDriftJson(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  return renderAiAnswerCitationSourcePortfolioDriftJsonFromCsv(
    renderAiAnswerCitationSourcePortfolioDriftCsv(current, baseline)
  );
}

type SourceAttributionWeighting = 'citation-events' | 'reciprocal-log-rank';
type SourceAttributionComparisonState =
  | 'provider-missing-in-period'
  | 'prompt-catalog-incomplete'
  | 'matched-source-detail-incomplete'
  | 'insufficient-both-cited-prompts'
  | 'available';

interface SourceAttributionDomainRow {
  row_type: 'domain';
  provider: string;
  weighting: SourceAttributionWeighting;
  domain: string;
  owned_domain_scope: 'owned' | 'non-owned' | 'not-configured' | 'configuration-mismatch';
  shared_exact_prompt_groups: number;
  source_detail_comparable_prompt_groups: number;
  both_cited_prompt_groups: number;
  one_period_uncited_prompt_groups: number;
  both_uncited_prompt_groups: number;
  source_detail_unknown_prompt_groups: number;
  baseline_mean_prompt_share_percent: number | null;
  current_mean_prompt_share_percent: number | null;
  mean_prompt_share_change_percentage_points: number | null;
  mean_prompt_share_change_ci95_lower: number | null;
  mean_prompt_share_change_ci95_upper: number | null;
  bootstrap_resamples: number;
  bootstrap_state:
    | 'available'
    | 'comparison-incomplete'
    | 'insufficient-support'
    | 'budget-limited'
    | 'change-profile-capped'
    | 'not-computed';
  mean_absolute_prompt_share_change_percentage_points: number | null;
  baseline_pooled_share_percent: number | null;
  current_pooled_share_percent: number | null;
  pooled_share_change_percentage_points: number | null;
  prompt_presence_gains: number;
  prompt_presence_losses: number;
  baseline_catalog_complete: boolean;
  current_catalog_complete: boolean;
  source_detail_complete: boolean;
  comparison_state: SourceAttributionComparisonState;
  comparison_complete: boolean;
}

interface SourceAttributionProviderRow {
  row_type: 'provider_summary';
  provider: string;
  weighting: SourceAttributionWeighting;
  baseline_provider_present: boolean;
  current_provider_present: boolean;
  baseline_prompt_groups: number;
  current_prompt_groups: number;
  shared_exact_prompt_groups: number;
  source_detail_comparable_prompt_groups: number;
  both_cited_prompt_groups: number;
  one_period_uncited_prompt_groups: number;
  both_uncited_prompt_groups: number;
  source_detail_unknown_prompt_groups: number;
  domains_available: number;
  domains_emitted: number;
  domain_rows_truncated: boolean;
  baseline_catalog_complete: boolean;
  current_catalog_complete: boolean;
  source_detail_complete: boolean;
  comparison_state: SourceAttributionComparisonState;
  comparison_complete: boolean;
}

interface SourceAttributionAnalysis {
  providerRows: SourceAttributionProviderRow[];
  domainRows: SourceAttributionDomainRow[];
  summary: Record<string, unknown>;
  ownedSourceShareDeclinesByProvider: Map<string, number[]>;
}

interface SourceAttributionAnalysisOptions {
  computeDomainBootstrapIntervals?: boolean;
  retainOwnedSourceSharePromptProfiles?: boolean;
}

function isSourceDomainOwned(domain: string, configuredOwnedDomains: Set<string>): boolean {
  for (const ownedDomain of configuredOwnedDomains) {
    if (domain === ownedDomain || domain.endsWith(`.${ownedDomain}`)) return true;
  }
  return false;
}

const MAX_SOURCE_ATTRIBUTION_ROWS = 20_000;
const MAX_SOURCE_ATTRIBUTION_PROVIDER_ROWS = 50_000;
const MAX_SOURCE_ATTRIBUTION_PROMPT_COMPARISONS = 5_000_000;
const MAX_SOURCE_ATTRIBUTION_BOOTSTRAP_VALUES = 2_000_000;
const MAX_SOURCE_ATTRIBUTION_BOOTSTRAP_DRAWS = 20_000_000;
const SOURCE_ATTRIBUTION_BOOTSTRAP_ITERATIONS = 1_000;
const MIN_SOURCE_ATTRIBUTION_BOOTSTRAP_ITERATIONS = 250;
const MAX_OWNED_SOURCE_SHARE_GATE_BOOTSTRAP_DRAWS = 20_000_000;

interface SourceAttributionDomainProfile {
  row: SourceAttributionDomainRow;
  observedChanges: number[];
  bootstrapValuesComplete: boolean;
}

function bootstrapSparseMeanInterval(
  observedChanges: number[],
  totalPromptGroups: number,
  seedText: string,
  iterations: number
): { lower: number; upper: number } | null {
  if (
    totalPromptGroups < 2 ||
    observedChanges.length > totalPromptGroups ||
    iterations < MIN_SOURCE_ATTRIBUTION_BOOTSTRAP_ITERATIONS
  )
    return null;
  let randomState = deterministicSeed(seedText);
  const means = new Array<number>(iterations);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let total = 0;
    for (let draw = 0; draw < totalPromptGroups; draw += 1) {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      const sampleIndex = Math.floor((randomState / 0x1_0000_0000) * totalPromptGroups);
      total += sampleIndex < observedChanges.length ? observedChanges[sampleIndex]! : 0;
    }
    means[iteration] = total / totalPromptGroups;
  }
  means.sort((left, right) => left - right);
  return {
    lower: round(means[Math.floor((iterations - 1) * 0.025)]!, 6),
    upper: round(means[Math.ceil((iterations - 1) * 0.975)]!, 6),
  };
}

function analyzeAiAnswerCitationSourcePortfolioAttribution(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport,
  options: SourceAttributionAnalysisOptions = {}
): SourceAttributionAnalysis {
  const computeDomainBootstrapIntervals = options.computeDomainBootstrapIntervals !== false;
  const retainOwnedSourceSharePromptProfiles =
    options.retainOwnedSourceSharePromptProfiles === true;
  const currentPanels = buildProviderPanels(current);
  const baselinePanels = buildProviderPanels(baseline);
  const ownedDomainSetsMatch =
    JSON.stringify([...current.ownedDomains].sort()) ===
    JSON.stringify([...baseline.ownedDomains].sort());
  const configuredOwnedDomains = new Set(
    current.ownedDomains.map((domain) => domain.toLowerCase())
  );
  const providerKeys = [...new Set([...baselinePanels.keys(), ...currentPanels.keys()])].sort(
    (left, right) =>
      (currentPanels.get(left)?.provider ?? baselinePanels.get(left)!.provider).localeCompare(
        currentPanels.get(right)?.provider ?? baselinePanels.get(right)!.provider
      )
  );
  const providerRows: SourceAttributionProviderRow[] = [];
  const domainProfiles: SourceAttributionDomainProfile[] = [];
  const ownedSourceShareDeclinesByProvider = new Map<string, number[]>();
  let comparisonsEvaluated = 0;
  let providersOmittedByBudget = 0;
  let outputTruncated = false;
  let bootstrapValuesStored = 0;

  for (const providerKey of providerKeys) {
    const baselinePanel = baselinePanels.get(providerKey);
    const currentPanel = currentPanels.get(providerKey);
    const provider = currentPanel?.provider ?? baselinePanel?.provider ?? providerKey;
    const pairCount = Math.min(
      baselinePanel?.promptProfiles.size ?? 0,
      currentPanel?.promptProfiles.size ?? 0
    );
    if (
      providerRows.length >= MAX_SOURCE_ATTRIBUTION_PROVIDER_ROWS * 2 ||
      comparisonsEvaluated + pairCount > MAX_SOURCE_ATTRIBUTION_PROMPT_COMPARISONS
    ) {
      providersOmittedByBudget = providerKeys.length - providerRows.length / 2;
      break;
    }
    const smaller =
      (baselinePanel?.promptProfiles.size ?? 0) <= (currentPanel?.promptProfiles.size ?? 0)
        ? baselinePanel?.promptProfiles
        : currentPanel?.promptProfiles;
    const promptPairs: Array<{ baseline: PromptSourceProfile; current: PromptSourceProfile }> = [];
    if (baselinePanel && currentPanel && smaller) {
      for (const promptKey of smaller.keys()) {
        const before = baselinePanel.promptProfiles.get(promptKey);
        const after = currentPanel.promptProfiles.get(promptKey);
        if (before && after) promptPairs.push({ baseline: before, current: after });
      }
    }
    comparisonsEvaluated += pairCount;

    for (const weighting of ['citation-events', 'reciprocal-log-rank'] as const) {
      const eligible = promptPairs.filter(({ baseline: before, current: after }) =>
        weighting === 'citation-events'
          ? before.eventDetailComplete && after.eventDetailComplete
          : before.rankDetailComplete && after.rankDetailComplete
      );
      const bothCited = eligible.filter(
        ({ baseline: before, current: after }) =>
          before.citationEvents > 0 && after.citationEvents > 0
      );
      if (weighting === 'citation-events' && retainOwnedSourceSharePromptProfiles) {
        const declines = bothCited.map(({ baseline: before, current: after }) => {
          let baselineOwnedEvents = 0;
          let currentOwnedEvents = 0;
          for (const [domain, events] of before.domainEvents) {
            if (isSourceDomainOwned(domain, configuredOwnedDomains)) baselineOwnedEvents += events;
          }
          for (const [domain, events] of after.domainEvents) {
            if (isSourceDomainOwned(domain, configuredOwnedDomains)) currentOwnedEvents += events;
          }
          const baselineShare = baselineOwnedEvents / before.citationEvents;
          const currentShare = currentOwnedEvents / after.citationEvents;
          return (baselineShare - currentShare) * 100;
        });
        ownedSourceShareDeclinesByProvider.set(`${providerKey}\u0000citation-events`, declines);
      }
      const oneSideUncited = eligible.filter(
        ({ baseline: before, current: after }) =>
          before.citationEvents > 0 !== after.citationEvents > 0
      ).length;
      const bothUncited = eligible.length - bothCited.length - oneSideUncited;
      const sourceUnknown = promptPairs.length - eligible.length;
      const sums = new Map<
        string,
        {
          baselineShare: number;
          currentShare: number;
          absoluteChange: number;
          gains: number;
          losses: number;
          observedChanges: number[];
          bootstrapValuesComplete: boolean;
        }
      >();
      const baselinePooled = new Map<string, number>();
      const currentPooled = new Map<string, number>();
      let baselinePooledTotal = 0;
      let currentPooledTotal = 0;

      for (const { baseline: before, current: after } of bothCited) {
        const beforeWeights =
          weighting === 'citation-events' ? before.domainEvents : before.rankDomainWeights;
        const afterWeights =
          weighting === 'citation-events' ? after.domainEvents : after.rankDomainWeights;
        const beforeTotal =
          weighting === 'citation-events' ? before.citationEvents : before.rankWeightTotal;
        const afterTotal =
          weighting === 'citation-events' ? after.citationEvents : after.rankWeightTotal;
        if (beforeTotal <= 0 || afterTotal <= 0) continue;
        baselinePooledTotal += beforeTotal;
        currentPooledTotal += afterTotal;
        for (const [domain, weight] of beforeWeights)
          baselinePooled.set(domain, (baselinePooled.get(domain) ?? 0) + weight);
        for (const [domain, weight] of afterWeights)
          currentPooled.set(domain, (currentPooled.get(domain) ?? 0) + weight);
        const domains = new Set([...beforeWeights.keys(), ...afterWeights.keys()]);
        for (const domain of domains) {
          const beforeShare = (beforeWeights.get(domain) ?? 0) / beforeTotal;
          const afterShare = (afterWeights.get(domain) ?? 0) / afterTotal;
          const existing = sums.get(domain) ?? {
            baselineShare: 0,
            currentShare: 0,
            absoluteChange: 0,
            gains: 0,
            losses: 0,
            observedChanges: [],
            bootstrapValuesComplete: true,
          };
          existing.baselineShare += beforeShare;
          existing.currentShare += afterShare;
          existing.absoluteChange += Math.abs(afterShare - beforeShare);
          const shareChange = afterShare - beforeShare;
          if (
            computeDomainBootstrapIntervals &&
            shareChange !== 0 &&
            existing.bootstrapValuesComplete
          ) {
            if (bootstrapValuesStored < MAX_SOURCE_ATTRIBUTION_BOOTSTRAP_VALUES) {
              existing.observedChanges.push(shareChange);
              bootstrapValuesStored += 1;
            } else {
              existing.bootstrapValuesComplete = false;
            }
          }
          if (beforeShare === 0 && afterShare > 0) existing.gains += 1;
          if (beforeShare > 0 && afterShare === 0) existing.losses += 1;
          sums.set(domain, existing);
        }
      }

      const sourceDetailComplete =
        Boolean(baselinePanel?.catalogComplete && currentPanel?.catalogComplete) &&
        sourceUnknown === 0;
      const comparisonState: SourceAttributionComparisonState =
        !baselinePanel || !currentPanel
          ? 'provider-missing-in-period'
          : !baselinePanel.catalogComplete || !currentPanel.catalogComplete
            ? 'prompt-catalog-incomplete'
            : sourceUnknown > 0
              ? 'matched-source-detail-incomplete'
              : bothCited.length === 0
                ? 'insufficient-both-cited-prompts'
                : 'available';
      const comparisonComplete = comparisonState === 'available';
      const rankedDomains = [...sums.entries()]
        .map(([domain, values]): SourceAttributionDomainProfile => {
          const support = bothCited.length;
          const baselinePooledShare =
            baselinePooledTotal > 0
              ? ((baselinePooled.get(domain) ?? 0) / baselinePooledTotal) * 100
              : null;
          const currentPooledShare =
            currentPooledTotal > 0
              ? ((currentPooled.get(domain) ?? 0) / currentPooledTotal) * 100
              : null;
          const baselineMean = support > 0 ? (values.baselineShare / support) * 100 : null;
          const currentMean = support > 0 ? (values.currentShare / support) * 100 : null;
          return {
            observedChanges: values.observedChanges,
            bootstrapValuesComplete: values.bootstrapValuesComplete,
            row: {
              row_type: 'domain' as const,
              provider,
              weighting,
              domain,
              owned_domain_scope: !ownedDomainSetsMatch
                ? ('configuration-mismatch' as const)
                : configuredOwnedDomains.size === 0
                  ? ('not-configured' as const)
                  : isSourceDomainOwned(domain, configuredOwnedDomains)
                    ? ('owned' as const)
                    : ('non-owned' as const),
              shared_exact_prompt_groups: promptPairs.length,
              source_detail_comparable_prompt_groups: eligible.length,
              both_cited_prompt_groups: support,
              one_period_uncited_prompt_groups: oneSideUncited,
              both_uncited_prompt_groups: bothUncited,
              source_detail_unknown_prompt_groups: sourceUnknown,
              baseline_mean_prompt_share_percent:
                baselineMean === null ? null : round(baselineMean, 4),
              current_mean_prompt_share_percent:
                currentMean === null ? null : round(currentMean, 4),
              mean_prompt_share_change_percentage_points:
                baselineMean === null || currentMean === null
                  ? null
                  : round(currentMean - baselineMean, 4),
              mean_prompt_share_change_ci95_lower: null,
              mean_prompt_share_change_ci95_upper: null,
              bootstrap_resamples: 0,
              bootstrap_state: 'insufficient-support',
              mean_absolute_prompt_share_change_percentage_points:
                support > 0 ? round((values.absoluteChange / support) * 100, 4) : null,
              baseline_pooled_share_percent:
                baselinePooledShare === null ? null : round(baselinePooledShare, 4),
              current_pooled_share_percent:
                currentPooledShare === null ? null : round(currentPooledShare, 4),
              pooled_share_change_percentage_points:
                baselinePooledShare === null || currentPooledShare === null
                  ? null
                  : round(currentPooledShare - baselinePooledShare, 4),
              prompt_presence_gains: values.gains,
              prompt_presence_losses: values.losses,
              baseline_catalog_complete: baselinePanel?.catalogComplete ?? false,
              current_catalog_complete: currentPanel?.catalogComplete ?? false,
              source_detail_complete: sourceDetailComplete,
              comparison_state: comparisonState,
              comparison_complete: comparisonComplete,
            },
          };
        })
        .sort(
          (left, right) =>
            Math.abs(right.row.mean_prompt_share_change_percentage_points ?? 0) -
              Math.abs(left.row.mean_prompt_share_change_percentage_points ?? 0) ||
            Math.abs(right.row.pooled_share_change_percentage_points ?? 0) -
              Math.abs(left.row.pooled_share_change_percentage_points ?? 0) ||
            left.row.domain.localeCompare(right.row.domain)
        );

      const remainingRows = MAX_SOURCE_ATTRIBUTION_ROWS - domainProfiles.length;
      const emitted = Math.max(0, Math.min(rankedDomains.length, remainingRows));
      const truncated = emitted < rankedDomains.length;
      outputTruncated ||= truncated;
      providerRows.push({
        row_type: 'provider_summary',
        provider,
        weighting,
        baseline_provider_present: baselinePanel !== undefined,
        current_provider_present: currentPanel !== undefined,
        baseline_prompt_groups: baselinePanel?.promptGroups ?? 0,
        current_prompt_groups: currentPanel?.promptGroups ?? 0,
        shared_exact_prompt_groups: promptPairs.length,
        source_detail_comparable_prompt_groups: eligible.length,
        both_cited_prompt_groups: bothCited.length,
        one_period_uncited_prompt_groups: oneSideUncited,
        both_uncited_prompt_groups: bothUncited,
        source_detail_unknown_prompt_groups: sourceUnknown,
        domains_available: rankedDomains.length,
        domains_emitted: emitted,
        domain_rows_truncated: truncated,
        baseline_catalog_complete: baselinePanel?.catalogComplete ?? false,
        current_catalog_complete: currentPanel?.catalogComplete ?? false,
        source_detail_complete: sourceDetailComplete,
        comparison_state: comparisonState,
        comparison_complete: comparisonComplete,
      });
      domainProfiles.push(...rankedDomains.slice(0, emitted));
    }
  }

  let bootstrapDrawsUsed = 0;
  let domainsWithBootstrapIntervals = 0;
  const domainRows = domainProfiles.map((profile): SourceAttributionDomainRow => {
    const { row } = profile;
    if (row.comparison_state !== 'available') {
      row.bootstrap_state = 'comparison-incomplete';
    } else if (!computeDomainBootstrapIntervals) {
      row.bootstrap_state = 'not-computed';
    } else if (row.both_cited_prompt_groups < 2) {
      row.bootstrap_state = 'insufficient-support';
    } else if (!profile.bootstrapValuesComplete) {
      row.bootstrap_state = 'change-profile-capped';
    } else {
      const affordableIterations = Math.floor(
        (MAX_SOURCE_ATTRIBUTION_BOOTSTRAP_DRAWS - bootstrapDrawsUsed) / row.both_cited_prompt_groups
      );
      const iterations = Math.min(SOURCE_ATTRIBUTION_BOOTSTRAP_ITERATIONS, affordableIterations);
      if (iterations < MIN_SOURCE_ATTRIBUTION_BOOTSTRAP_ITERATIONS) {
        row.bootstrap_state = 'budget-limited';
      } else {
        const interval = bootstrapSparseMeanInterval(
          profile.observedChanges,
          row.both_cited_prompt_groups,
          `${normalizedLabel(row.provider)}\u0000${row.weighting}\u0000${row.domain}`,
          iterations
        );
        if (interval) {
          row.mean_prompt_share_change_ci95_lower = round(interval.lower * 100, 4);
          row.mean_prompt_share_change_ci95_upper = round(interval.upper * 100, 4);
          row.bootstrap_resamples = iterations;
          row.bootstrap_state = 'available';
          bootstrapDrawsUsed += iterations * row.both_cited_prompt_groups;
          domainsWithBootstrapIntervals += 1;
        } else {
          row.bootstrap_state = 'budget-limited';
        }
      }
    }
    return row;
  });

  const summary = {
    row_type: 'summary',
    weighting: 'citation-events + reciprocal-log-rank',
    baseline_providers_available: baselinePanels.size,
    current_providers_available: currentPanels.size,
    providers_available: providerKeys.length,
    providers_evaluated: providerRows.length / 2,
    providers_omitted_by_budget: providersOmittedByBudget,
    prompt_comparisons_evaluated: comparisonsEvaluated,
    domain_rows_available: providerRows.reduce((sum, row) => sum + row.domains_available, 0),
    domain_rows_emitted: domainRows.length,
    output_rows_truncated: outputTruncated,
    bootstrap_values_stored: bootstrapValuesStored,
    bootstrap_values_budget: MAX_SOURCE_ATTRIBUTION_BOOTSTRAP_VALUES,
    bootstrap_draws_used: bootstrapDrawsUsed,
    bootstrap_draws_budget: MAX_SOURCE_ATTRIBUTION_BOOTSTRAP_DRAWS,
    bootstrap_intervals_available: domainsWithBootstrapIntervals,
    bootstrap_iterations_per_interval: SOURCE_ATTRIBUTION_BOOTSTRAP_ITERATIONS,
    bootstrap_minimum_iterations: MIN_SOURCE_ATTRIBUTION_BOOTSTRAP_ITERATIONS,
    owned_domain_configuration_compatible: ownedDomainSetsMatch,
    owned_domain_scope_available: ownedDomainSetsMatch && configuredOwnedDomains.size > 0,
    comparison_complete:
      providersOmittedByBudget === 0 &&
      providerRows.every((row) => row.comparison_complete && !row.domain_rows_truncated),
    interpretation_note:
      'Domain attribution compares normalized citation shares on matched exact provider/prompt groups with complete source details where both periods cited at least one source. Prompt-balanced means give each eligible exact prompt equal weight; pooled shares weight by citation events or reciprocal-log-rank weight. The nominal 95% intervals resample matched exact prompts as clusters with a deterministic seed; sparse zero changes are implicit. Intervals are not multiplicity-adjusted and describe these observations, not causal effects or provider-wide uncertainty. A shared draw budget allocates up to 1,000 iterations per emitted domain row, requires 250, and exposes incomplete profiles or budget limits. One-sided uncited prompts are reported but excluded from share changes. Missing or capped source detail is unknown, never zero-filled. Share movement is descriptive and does not identify a cause or source quality.',
  };
  return { providerRows, domainRows, summary, ownedSourceShareDeclinesByProvider };
}

const SOURCE_ATTRIBUTION_HEADERS = [
  'row_type',
  'provider',
  'weighting',
  'domain',
  'owned_domain_scope',
  'baseline_provider_present',
  'current_provider_present',
  'baseline_prompt_groups',
  'current_prompt_groups',
  'shared_exact_prompt_groups',
  'source_detail_comparable_prompt_groups',
  'both_cited_prompt_groups',
  'one_period_uncited_prompt_groups',
  'both_uncited_prompt_groups',
  'source_detail_unknown_prompt_groups',
  'baseline_mean_prompt_share_percent',
  'current_mean_prompt_share_percent',
  'mean_prompt_share_change_percentage_points',
  'mean_prompt_share_change_ci95_lower',
  'mean_prompt_share_change_ci95_upper',
  'bootstrap_resamples',
  'bootstrap_state',
  'mean_absolute_prompt_share_change_percentage_points',
  'baseline_pooled_share_percent',
  'current_pooled_share_percent',
  'pooled_share_change_percentage_points',
  'prompt_presence_gains',
  'prompt_presence_losses',
  'domains_available',
  'domains_emitted',
  'domain_rows_truncated',
  'baseline_catalog_complete',
  'current_catalog_complete',
  'source_detail_complete',
  'comparison_complete',
  'comparison_state',
  'providers_available',
  'providers_evaluated',
  'providers_omitted_by_budget',
  'prompt_comparisons_evaluated',
  'domain_rows_available',
  'domain_rows_emitted',
  'output_rows_truncated',
  'bootstrap_values_stored',
  'bootstrap_values_budget',
  'bootstrap_draws_used',
  'bootstrap_draws_budget',
  'bootstrap_intervals_available',
  'bootstrap_iterations_per_interval',
  'bootstrap_minimum_iterations',
  'owned_domain_configuration_compatible',
  'owned_domain_scope_available',
  'interpretation_note',
];

function renderSourcePortfolioAttributionCsvFromAnalysis(
  analysis: SourceAttributionAnalysis
): string {
  const rows = [analysis.summary, ...analysis.providerRows, ...analysis.domainRows] as Array<
    Record<string, unknown>
  >;
  return `${rows.map((row) => SOURCE_ATTRIBUTION_HEADERS.map((header) => csvCell(row[header] ?? '')).join(',')).join('\r\n')}\r\n`;
}

function renderSourcePortfolioAttributionJsonFromAnalysis(
  analysis: SourceAttributionAnalysis
): string {
  return `${JSON.stringify(
    {
      formatVersion: 1,
      summary: analysis.summary,
      providerRows: analysis.providerRows,
      domainRows: analysis.domainRows,
    },
    null,
    2
  )}\n`;
}

/** Attribute matched-prompt source-share changes to individual domains. */
export function renderAiAnswerCitationSourcePortfolioAttributionCsv(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  return renderSourcePortfolioAttributionCsvFromAnalysis(
    analyzeAiAnswerCitationSourcePortfolioAttribution(current, baseline)
  );
}

/** Serialize the capped source attribution result without internal bootstrap profiles or raw prompts. */
export function renderAiAnswerCitationSourcePortfolioAttributionJson(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  return renderSourcePortfolioAttributionJsonFromAnalysis(
    analyzeAiAnswerCitationSourcePortfolioAttribution(current, baseline)
  );
}

function renderSourcePortfolioAttributionHtmlFromAnalysis(
  analysis: SourceAttributionAnalysis
): string {
  const safeJson = JSON.stringify({
    providerRows: analysis.providerRows,
    domainRows: analysis.domainRows,
    summary: analysis.summary,
  })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GEO source portfolio attribution</title><style>
:root{color-scheme:dark;--bg:#101513;--panel:#18211c;--ink:#edf5ee;--muted:#a8b8aa;--line:#34463a;--mint:#a6efc3;--red:#ff9586;--green:#74d6a0}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 12% 0%,#25372b,var(--bg) 45%);color:var(--ink);font:15px/1.5 ui-sans-serif,system-ui,sans-serif}main{max-width:1240px;margin:auto;padding:36px 22px 64px}h1{font-size:clamp(28px,5vw,48px);line-height:1.05;letter-spacing:-.04em;margin:12px 0}p{color:var(--muted);max-width:900px}.eyebrow{color:var(--mint);font:700 11px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}.controls,.cards,.panel{border:1px solid var(--line);background:#18211ce8;border-radius:18px}.controls{display:flex;gap:12px;align-items:end;flex-wrap:wrap;padding:16px;margin:24px 0}.controls label{display:grid;gap:6px;color:var(--muted);font:12px ui-monospace,monospace}select,input,button{background:#111814;color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:10px 12px;font:inherit}button{cursor:pointer;color:var(--mint)}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:1px;overflow:hidden;margin-bottom:20px}.card{background:#18211c;padding:17px}.card b{display:block;font-size:26px;letter-spacing:-.03em}.card span{color:var(--muted);font:11px ui-monospace,monospace}.panel{padding:20px;margin:18px 0}.panel h2{font-size:18px;margin:0 0 14px}.chart{display:grid;gap:9px}.barrow{display:grid;grid-template-columns:minmax(130px,220px) 1fr 92px;gap:12px;align-items:center}.domain{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px ui-monospace,monospace}.track{height:13px;background:#29352d;border-radius:99px;position:relative}.track:after{content:'';position:absolute;left:50%;top:-2px;height:17px;width:1px;background:#7e9083;z-index:2;pointer-events:none}.bar{height:100%;position:absolute;border-radius:99px;top:0}.interval{height:2px;position:absolute;top:5px;background:var(--ink);z-index:1}.interval:before,.interval:after{content:'';position:absolute;width:2px;height:8px;top:-3px;background:var(--ink)}.interval:before{left:0}.interval:after{right:0}.bar.positive{left:50%;background:var(--green)}.bar.negative{right:50%;background:var(--red)}.value{text-align:right;font:12px ui-monospace,monospace}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:10px 9px;border-bottom:1px solid var(--line);white-space:nowrap}th{color:var(--mint);font:11px ui-monospace,monospace;position:sticky;top:0;background:#18211c}td.num{text-align:right;font-variant-numeric:tabular-nums}.note{font-size:12px}.state{color:var(--mint);font:11px ui-monospace,monospace}.empty{color:var(--muted);padding:18px 0}@media(max-width:680px){.barrow{grid-template-columns:120px 1fr 72px}.panel{padding:14px}main{padding:26px 14px}}
</style></head><body><main><div class="eyebrow">Aviary · Generative Engine Optimization</div><h1>Source portfolio attribution</h1><p>See which domains account for citation-share movement on matched provider and exact-prompt groups. Prompt-balanced movement gives each eligible prompt equal weight; pooled movement preserves citation volume. The 95% intervals resample prompt clusters and describe these samples.</p><section class="controls"><label>Provider<select id="provider"></select></label><label>Weighting<select id="weighting"><option value="citation-events">Citation events</option><option value="reciprocal-log-rank">Reciprocal log rank</option></select></label><label>Owned domain scope<select id="ownership"><option value="all">All domains</option><option value="owned">Owned</option><option value="non-owned">Non-owned</option><option value="not-configured">Not configured</option><option value="configuration-mismatch">Configuration mismatch</option></select></label><label>95% interval<select id="interval"><option value="all">All</option><option value="excludes-zero">Excludes zero</option><option value="crosses-zero">Includes zero</option><option value="unavailable">Unavailable</option></select></label><label>Find domain<input id="search" type="search" placeholder="Filter domain names"></label><button id="download" type="button">Download filtered CSV</button></section><section class="cards" id="cards"></section><section class="panel"><h2>Largest prompt-balanced share changes</h2><p>Bars show the point change; white whiskers show the nominal 95% prompt-cluster interval when available.</p><div id="chart" class="chart"></div></section><section class="panel"><h2>Domain detail</h2><div class="table-wrap"><table><thead><tr><th>Domain</th><th>Ownership</th><th>Mean share Δ</th><th>95% prompt-cluster interval</th><th>Bootstrap state</th><th>Mean |Δ|</th><th>Pooled share Δ</th><th>Gains</th><th>Losses</th><th>Matched prompts</th><th>State</th></tr></thead><tbody id="rows"></tbody></table></div></section><p id="note" class="note"></p></main><script>
const data=${safeJson};const providers=[...new Set(data.providerRows.map(row=>row.provider))];const providerSelect=document.querySelector('#provider');for(const provider of providers){const option=document.createElement('option');option.value=provider;option.textContent=provider;providerSelect.append(option)}const weightingSelect=document.querySelector('#weighting');const ownershipSelect=document.querySelector('#ownership');const intervalSelect=document.querySelector('#interval');const search=document.querySelector('#search');const cards=document.querySelector('#cards');const chart=document.querySelector('#chart');const rows=document.querySelector('#rows');const note=document.querySelector('#note');const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));const matchesInterval=row=>{const lower=row.mean_prompt_share_change_ci95_lower;const upper=row.mean_prompt_share_change_ci95_upper;if(intervalSelect.value==='all')return true;if(lower===null||upper===null)return intervalSelect.value==='unavailable';const excludesZero=lower>0||upper<0;return intervalSelect.value==='excludes-zero'?excludesZero:!excludesZero};function update(){const provider=providerSelect.value;const weighting=weightingSelect.value;const summary=data.providerRows.find(row=>row.provider===provider&&row.weighting===weighting);const query=search.value.trim().toLowerCase();const scope=ownershipSelect.value;const visible=data.domainRows.filter(row=>row.provider===provider&&row.weighting===weighting&&(scope==='all'||row.owned_domain_scope===scope)&&matchesInterval(row)&&row.domain.toLowerCase().includes(query));const sorted=[...visible].sort((a,b)=>Math.abs(b.mean_prompt_share_change_percentage_points??0)-Math.abs(a.mean_prompt_share_change_percentage_points??0));const metrics=[['Both cited prompts',summary?.both_cited_prompt_groups??0],['Share-comparable prompts',summary?.source_detail_comparable_prompt_groups??0],['Source detail unknown',summary?.source_detail_unknown_prompt_groups??0],['Bootstrap intervals',visible.filter(row=>row.bootstrap_state==='available').length],['Domains shown',visible.length]];cards.innerHTML=metrics.map(([label,value])=>'<div class="card"><b>'+esc(value)+'</b><span>'+esc(label)+'</span></div>').join('');const top=sorted.slice(0,30);const max=Math.max(0.01,...top.flatMap(row=>[Math.abs(row.mean_prompt_share_change_percentage_points??0),Math.abs(row.mean_prompt_share_change_ci95_lower??0),Math.abs(row.mean_prompt_share_change_ci95_upper??0)]));chart.innerHTML=top.length?top.map(row=>{const delta=row.mean_prompt_share_change_percentage_points??0;const width=Math.max(1,Math.abs(delta)/max*49);const lower=row.mean_prompt_share_change_ci95_lower;const upper=row.mean_prompt_share_change_ci95_upper;const interval=lower===null||upper===null?'':'<i class="interval" style="left:'+((lower+max)/(2*max)*100)+'%;width:'+((upper-lower)/(2*max)*100)+'%"></i>';return '<div class="barrow"><span class="domain" title="'+esc(row.domain)+'">'+esc(row.domain)+'</span><span class="track">'+interval+'<i class="bar '+(delta>=0?'positive':'negative')+'" style="width:'+width+'%"></i></span><span class="value">'+esc(delta.toFixed(2))+' pp</span></div>'}).join(''):'<div class="empty">No matched, complete, both-cited domain profiles.</div>';rows.innerHTML=sorted.slice(0,500).map(row=>'<tr><td>'+esc(row.domain)+'</td><td>'+esc(row.owned_domain_scope)+'</td><td class="num">'+esc(row.mean_prompt_share_change_percentage_points??'')+'</td><td class="num">'+(row.mean_prompt_share_change_ci95_lower===null||row.mean_prompt_share_change_ci95_upper===null?'—':esc(row.mean_prompt_share_change_ci95_lower.toFixed(2)+' to '+row.mean_prompt_share_change_ci95_upper.toFixed(2)+' pp'))+'</td><td class="state">'+esc(row.bootstrap_state)+' · '+esc(row.bootstrap_resamples)+'</td><td class="num">'+esc(row.mean_absolute_prompt_share_change_percentage_points??'')+'</td><td class="num">'+esc(row.pooled_share_change_percentage_points??'')+'</td><td class="num">'+esc(row.prompt_presence_gains)+'</td><td class="num">'+esc(row.prompt_presence_losses)+'</td><td class="num">'+esc(row.both_cited_prompt_groups)+'</td><td class="state">'+esc(row.comparison_state)+'</td></tr>').join('');note.textContent='Comparison state: '+(summary?.comparison_state??'provider-not-sampled')+'. '+data.summary.interpretation_note}function csvValue(value){let text=String(value??'');const firstNonWhitespace=text.trimStart().charAt(0);if(typeof value!=='number'&&firstNonWhitespace&&'=+-@'.includes(firstNonWhitespace))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'}providerSelect.addEventListener('change',update);weightingSelect.addEventListener('change',update);ownershipSelect.addEventListener('change',update);intervalSelect.addEventListener('change',update);search.addEventListener('input',update);document.querySelector('#download').addEventListener('click',()=>{const selected=data.domainRows.filter(row=>row.provider===providerSelect.value&&row.weighting===weightingSelect.value&&(ownershipSelect.value==='all'||row.owned_domain_scope===ownershipSelect.value)&&matchesInterval(row)&&row.domain.toLowerCase().includes(search.value.trim().toLowerCase()));const csv=[${JSON.stringify(SOURCE_ATTRIBUTION_HEADERS)},...selected.map(row=>${JSON.stringify(SOURCE_ATTRIBUTION_HEADERS)}.map(header=>row[header]??''))].map(row=>row.map(csvValue).join(',')).join('\r\n')+'\r\n';const link=document.createElement('a');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.href=url;link.download='source-portfolio-attribution-filtered.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),0)});update();
</script></body></html>`;
}

/** Render a standalone offline review page for source-share movers. */
export function renderAiAnswerCitationSourcePortfolioAttributionHtml(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  return renderSourcePortfolioAttributionHtmlFromAnalysis(
    analyzeAiAnswerCitationSourcePortfolioAttribution(current, baseline)
  );
}

export interface AiAnswerCitationSourcePortfolioAttributionFormats {
  csv?: boolean;
  json?: boolean;
  html?: boolean;
}

export interface AiAnswerCitationSourcePortfolioAttributionArtifacts {
  csv?: string;
  json?: string;
  html?: string;
}

/** Render selected attribution formats from one shared bounded analysis pass. */
export function renderAiAnswerCitationSourcePortfolioAttributionArtifacts(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport,
  formats: AiAnswerCitationSourcePortfolioAttributionFormats
): AiAnswerCitationSourcePortfolioAttributionArtifacts {
  if (!formats.csv && !formats.json && !formats.html) return {};
  const analysis = analyzeAiAnswerCitationSourcePortfolioAttribution(current, baseline);
  return {
    ...(formats.csv ? { csv: renderSourcePortfolioAttributionCsvFromAnalysis(analysis) } : {}),
    ...(formats.json ? { json: renderSourcePortfolioAttributionJsonFromAnalysis(analysis) } : {}),
    ...(formats.html ? { html: renderSourcePortfolioAttributionHtmlFromAnalysis(analysis) } : {}),
  };
}

export interface AiAnswerCitationOwnedSourceShareGateProviderRow {
  provider: string;
  matchedBothCitedPromptGroups: number;
  baselinePromptBalancedOwnedSharePercent: number | null;
  currentPromptBalancedOwnedSharePercent: number | null;
  declinePercentagePoints: number | null;
  declineCi95LowerPercentagePoints: number | null;
  declineCi95UpperPercentagePoints: number | null;
  bootstrapResamples: number;
  bootstrapState:
    | 'available'
    | 'not-requested'
    | 'incomplete-comparison'
    | 'insufficient-support'
    | 'budget-limited';
  signTestEligiblePromptGroups: number;
  signTestDeclinePromptGroups: number;
  signTestPValue: number | null;
  signTestHolmAdjustedPValue: number | null;
  signTestState:
    | 'available'
    | 'not-requested'
    | 'incomplete-comparison'
    | 'insufficient-support'
    | 'incomplete-family';
  pointThresholdExceeded: boolean | null;
  lowerCiThresholdExceeded: boolean | null;
  signTestThresholdExceeded: boolean | null;
  state: 'available' | 'insufficient-support' | 'incomplete-comparison';
}

export interface AiAnswerCitationOwnedSourceShareGateAssessment {
  status: 'passed' | 'regression' | 'incomplete';
  thresholdPercentagePoints: number | null;
  lowerCiThresholdPercentagePoints: number | null;
  signTestAlpha: number | null;
  signTestDeclineThresholdPercentagePoints: number | null;
  minimumMatchedPromptGroups: number;
  bootstrapDrawsUsed: number;
  providersEvaluated: number;
  providersOmittedByBudget: number;
  rows: AiAnswerCitationOwnedSourceShareGateProviderRow[];
  reasons: string[];
}

const OWNED_SOURCE_SHARE_GATE_CSV_HEADERS = [
  'row_type',
  'status',
  'point_threshold_percentage_points',
  'lower_ci_threshold_percentage_points',
  'sign_test_alpha',
  'sign_test_decline_threshold_percentage_points',
  'minimum_matched_prompt_groups',
  'providers_evaluated',
  'providers_omitted_by_budget',
  'bootstrap_draws_used',
  'reasons',
  'provider',
  'provider_state',
  'matched_both_cited_prompt_groups',
  'baseline_prompt_balanced_owned_share_percent',
  'current_prompt_balanced_owned_share_percent',
  'decline_percentage_points',
  'decline_ci95_lower_percentage_points',
  'decline_ci95_upper_percentage_points',
  'bootstrap_resamples',
  'bootstrap_state',
  'sign_test_eligible_prompt_groups',
  'sign_test_decline_prompt_groups',
  'sign_test_p_value',
  'sign_test_holm_adjusted_p_value',
  'sign_test_state',
  'point_threshold_exceeded',
  'lower_ci_threshold_exceeded',
  'sign_test_threshold_exceeded',
];

/** Export a typed owned-source-share gate assessment for CI artifacts and downstream review. */
export function renderAiAnswerCitationOwnedSourceShareGateCsv(
  assessment: AiAnswerCitationOwnedSourceShareGateAssessment
): string {
  const summary: Record<string, unknown> = {
    row_type: 'summary',
    status: assessment.status,
    point_threshold_percentage_points: assessment.thresholdPercentagePoints,
    lower_ci_threshold_percentage_points: assessment.lowerCiThresholdPercentagePoints,
    sign_test_alpha: assessment.signTestAlpha,
    sign_test_decline_threshold_percentage_points:
      assessment.signTestDeclineThresholdPercentagePoints,
    minimum_matched_prompt_groups: assessment.minimumMatchedPromptGroups,
    providers_evaluated: assessment.providersEvaluated,
    providers_omitted_by_budget: assessment.providersOmittedByBudget,
    bootstrap_draws_used: assessment.bootstrapDrawsUsed,
    reasons: assessment.reasons.join(' | '),
  };
  const providers = assessment.rows.map((row): Record<string, unknown> => ({
    row_type: 'provider',
    provider: row.provider,
    provider_state: row.state,
    matched_both_cited_prompt_groups: row.matchedBothCitedPromptGroups,
    baseline_prompt_balanced_owned_share_percent: row.baselinePromptBalancedOwnedSharePercent,
    current_prompt_balanced_owned_share_percent: row.currentPromptBalancedOwnedSharePercent,
    decline_percentage_points: row.declinePercentagePoints,
    decline_ci95_lower_percentage_points: row.declineCi95LowerPercentagePoints,
    decline_ci95_upper_percentage_points: row.declineCi95UpperPercentagePoints,
    bootstrap_resamples: row.bootstrapResamples,
    bootstrap_state: row.bootstrapState,
    sign_test_eligible_prompt_groups: row.signTestEligiblePromptGroups,
    sign_test_decline_prompt_groups: row.signTestDeclinePromptGroups,
    sign_test_p_value: row.signTestPValue,
    sign_test_holm_adjusted_p_value: row.signTestHolmAdjustedPValue,
    sign_test_state: row.signTestState,
    point_threshold_exceeded: row.pointThresholdExceeded,
    lower_ci_threshold_exceeded: row.lowerCiThresholdExceeded,
    sign_test_threshold_exceeded: row.signTestThresholdExceeded,
  }));
  const rows = [summary, ...providers];
  const header = OWNED_SOURCE_SHARE_GATE_CSV_HEADERS.map((column) => csvCell(column)).join(',');
  return `${header}\r\n${rows
    .map((row) =>
      OWNED_SOURCE_SHARE_GATE_CSV_HEADERS.map((column) => csvCell(row[column] ?? '')).join(',')
    )
    .join('\r\n')}\r\n`;
}

/** Serialize the bounded owned-source-share gate assessment for CI clients without raw prompts. */
export function renderAiAnswerCitationOwnedSourceShareGateJson(
  assessment: AiAnswerCitationOwnedSourceShareGateAssessment
): string {
  return `${JSON.stringify({ formatVersion: 1, assessment }, null, 2)}\n`;
}

/** Fail closed when owned-source share cannot be compared on complete, sufficiently sampled exact prompts. */
export function assessAiAnswerCitationOwnedSourceShareDrop(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport,
  maximumDropPercentagePoints: number | null,
  minimumMatchedPromptGroups = 10,
  minimumDeclineLowerCiPercentagePoints?: number,
  declineSignTestAlpha?: number
): AiAnswerCitationOwnedSourceShareGateAssessment {
  if (
    maximumDropPercentagePoints !== null &&
    (!Number.isFinite(maximumDropPercentagePoints) ||
      maximumDropPercentagePoints < 0 ||
      maximumDropPercentagePoints > 100)
  ) {
    throw new RangeError(
      'Owned source-share drop threshold must be between 0 and 100 percentage points.'
    );
  }
  if (
    !Number.isSafeInteger(minimumMatchedPromptGroups) ||
    minimumMatchedPromptGroups < 2 ||
    minimumMatchedPromptGroups > 10_000
  ) {
    throw new RangeError(
      'Owned source-share minimum support must be an integer from 2 to 10000 matched prompts.'
    );
  }
  if (
    minimumDeclineLowerCiPercentagePoints !== undefined &&
    (!Number.isFinite(minimumDeclineLowerCiPercentagePoints) ||
      minimumDeclineLowerCiPercentagePoints < 0 ||
      minimumDeclineLowerCiPercentagePoints > 100)
  ) {
    throw new RangeError(
      'Owned source-share 95% lower-CI threshold must be between 0 and 100 percentage points.'
    );
  }
  if (
    declineSignTestAlpha !== undefined &&
    (!Number.isFinite(declineSignTestAlpha) || declineSignTestAlpha < 0 || declineSignTestAlpha > 1)
  ) {
    throw new RangeError('Owned source-share sign-test alpha must be between 0 and 1.');
  }

  const analysis = analyzeAiAnswerCitationSourcePortfolioAttribution(current, baseline, {
    computeDomainBootstrapIntervals: false,
    retainOwnedSourceSharePromptProfiles:
      minimumDeclineLowerCiPercentagePoints !== undefined || declineSignTestAlpha !== undefined,
  });
  const reasons: string[] = [];
  if (!analysis.summary.owned_domain_scope_available)
    reasons.push('the same non-empty owned-domain set must be configured in both reports');
  if (analysis.summary.providers_omitted_by_budget !== 0)
    reasons.push('one or more provider comparisons were omitted by the work budget');
  if (analysis.summary.output_rows_truncated)
    reasons.push('the domain-attribution output row cap was reached');
  const eventRows = analysis.providerRows.filter((row) => row.weighting === 'citation-events');
  if (eventRows.length === 0) reasons.push('no provider comparison rows were available');

  const rows = eventRows.map((providerRow): AiAnswerCitationOwnedSourceShareGateProviderRow => {
    if (providerRow.comparison_state !== 'available') {
      reasons.push(`${providerRow.provider} has ${providerRow.comparison_state} support`);
      return {
        provider: providerRow.provider,
        matchedBothCitedPromptGroups: providerRow.both_cited_prompt_groups,
        baselinePromptBalancedOwnedSharePercent: null,
        currentPromptBalancedOwnedSharePercent: null,
        declinePercentagePoints: null,
        declineCi95LowerPercentagePoints: null,
        declineCi95UpperPercentagePoints: null,
        bootstrapResamples: 0,
        bootstrapState:
          minimumDeclineLowerCiPercentagePoints === undefined
            ? 'not-requested'
            : 'incomplete-comparison',
        signTestEligiblePromptGroups: 0,
        signTestDeclinePromptGroups: 0,
        signTestPValue: null,
        signTestHolmAdjustedPValue: null,
        signTestState:
          declineSignTestAlpha === undefined ? 'not-requested' : 'incomplete-comparison',
        pointThresholdExceeded: null,
        lowerCiThresholdExceeded: null,
        signTestThresholdExceeded: null,
        state: 'incomplete-comparison',
      };
    }
    if (providerRow.both_cited_prompt_groups < minimumMatchedPromptGroups) {
      reasons.push(
        `${providerRow.provider} has only ${providerRow.both_cited_prompt_groups} both-cited matched prompts`
      );
      return {
        provider: providerRow.provider,
        matchedBothCitedPromptGroups: providerRow.both_cited_prompt_groups,
        baselinePromptBalancedOwnedSharePercent: null,
        currentPromptBalancedOwnedSharePercent: null,
        declinePercentagePoints: null,
        declineCi95LowerPercentagePoints: null,
        declineCi95UpperPercentagePoints: null,
        bootstrapResamples: 0,
        bootstrapState:
          minimumDeclineLowerCiPercentagePoints === undefined
            ? 'not-requested'
            : 'insufficient-support',
        signTestEligiblePromptGroups: 0,
        signTestDeclinePromptGroups: 0,
        signTestPValue: null,
        signTestHolmAdjustedPValue: null,
        signTestState:
          declineSignTestAlpha === undefined ? 'not-requested' : 'insufficient-support',
        pointThresholdExceeded: null,
        lowerCiThresholdExceeded: null,
        signTestThresholdExceeded: null,
        state: 'insufficient-support',
      };
    }
    if (providerRow.domain_rows_truncated) {
      reasons.push(`${providerRow.provider} domain detail was truncated`);
      return {
        provider: providerRow.provider,
        matchedBothCitedPromptGroups: providerRow.both_cited_prompt_groups,
        baselinePromptBalancedOwnedSharePercent: null,
        currentPromptBalancedOwnedSharePercent: null,
        declinePercentagePoints: null,
        declineCi95LowerPercentagePoints: null,
        declineCi95UpperPercentagePoints: null,
        bootstrapResamples: 0,
        bootstrapState:
          minimumDeclineLowerCiPercentagePoints === undefined
            ? 'not-requested'
            : 'incomplete-comparison',
        signTestEligiblePromptGroups: 0,
        signTestDeclinePromptGroups: 0,
        signTestPValue: null,
        signTestHolmAdjustedPValue: null,
        signTestState:
          declineSignTestAlpha === undefined ? 'not-requested' : 'incomplete-comparison',
        pointThresholdExceeded: null,
        lowerCiThresholdExceeded: null,
        signTestThresholdExceeded: null,
        state: 'incomplete-comparison',
      };
    }
    const ownedRows = analysis.domainRows.filter(
      (row) =>
        row.provider === providerRow.provider &&
        row.weighting === 'citation-events' &&
        row.owned_domain_scope === 'owned'
    );
    const baselineShare = ownedRows.reduce(
      (sum, row) => sum + (row.baseline_mean_prompt_share_percent ?? 0),
      0
    );
    const currentShare = ownedRows.reduce(
      (sum, row) => sum + (row.current_mean_prompt_share_percent ?? 0),
      0
    );
    const baselinePercent = round(baselineShare, 4);
    const currentPercent = round(currentShare, 4);
    const decline = round(baselinePercent - currentPercent, 4);
    return {
      provider: providerRow.provider,
      matchedBothCitedPromptGroups: providerRow.both_cited_prompt_groups,
      baselinePromptBalancedOwnedSharePercent: baselinePercent,
      currentPromptBalancedOwnedSharePercent: currentPercent,
      declinePercentagePoints: decline,
      declineCi95LowerPercentagePoints: null,
      declineCi95UpperPercentagePoints: null,
      bootstrapResamples: 0,
      bootstrapState:
        minimumDeclineLowerCiPercentagePoints === undefined ? 'not-requested' : 'budget-limited',
      signTestEligiblePromptGroups: 0,
      signTestDeclinePromptGroups: 0,
      signTestPValue: null,
      signTestHolmAdjustedPValue: null,
      signTestState: declineSignTestAlpha === undefined ? 'not-requested' : 'incomplete-comparison',
      pointThresholdExceeded: null,
      lowerCiThresholdExceeded: null,
      signTestThresholdExceeded: null,
      state: 'available',
    };
  });
  let bootstrapDrawsUsed = 0;
  if (minimumDeclineLowerCiPercentagePoints !== undefined) {
    for (const row of rows) {
      if (row.state !== 'available') continue;
      const declines = analysis.ownedSourceShareDeclinesByProvider.get(
        `${normalizedLabel(row.provider)}\u0000citation-events`
      );
      if (!declines || declines.length !== row.matchedBothCitedPromptGroups) {
        row.bootstrapState = 'incomplete-comparison';
        reasons.push(
          `${row.provider} has incomplete owned-share prompt changes for the confidence interval`
        );
        continue;
      }
      const affordableIterations = Math.floor(
        (MAX_OWNED_SOURCE_SHARE_GATE_BOOTSTRAP_DRAWS - bootstrapDrawsUsed) / declines.length
      );
      const iterations = Math.min(SOURCE_ATTRIBUTION_BOOTSTRAP_ITERATIONS, affordableIterations);
      if (iterations < MIN_SOURCE_ATTRIBUTION_BOOTSTRAP_ITERATIONS) {
        row.bootstrapState = 'budget-limited';
        reasons.push(
          `${row.provider} cannot receive the minimum 250 prompt-cluster bootstrap iterations under the shared draw budget`
        );
        continue;
      }
      const interval = bootstrapInterval(
        declines,
        `${normalizedLabel(row.provider)}\u0000owned-source-share-decline`,
        iterations
      );
      if (!interval) {
        row.bootstrapState = 'budget-limited';
        reasons.push(`${row.provider} could not receive a prompt-cluster bootstrap interval`);
        continue;
      }
      row.declineCi95LowerPercentagePoints = round(interval.lower, 4);
      row.declineCi95UpperPercentagePoints = round(interval.upper, 4);
      row.bootstrapResamples = iterations;
      row.bootstrapState = 'available';
      bootstrapDrawsUsed += iterations * declines.length;
    }
  }
  const signTestDeclineThreshold =
    declineSignTestAlpha === undefined
      ? null
      : (maximumDropPercentagePoints ?? minimumDeclineLowerCiPercentagePoints ?? 0);
  if (declineSignTestAlpha !== undefined && signTestDeclineThreshold !== null) {
    for (const row of rows) {
      if (row.state !== 'available') continue;
      const declines = analysis.ownedSourceShareDeclinesByProvider.get(
        `${normalizedLabel(row.provider)}\u0000citation-events`
      );
      if (!declines || declines.length !== row.matchedBothCitedPromptGroups) {
        row.signTestState = 'incomplete-comparison';
        reasons.push(
          `${row.provider} has incomplete owned-share prompt changes for the exact sign test`
        );
        continue;
      }
      const nonTiedDeclines = declines.filter(
        (decline) => Math.abs(decline - signTestDeclineThreshold) > 1e-9
      );
      const exceedances = nonTiedDeclines.filter(
        (decline) => decline > signTestDeclineThreshold
      ).length;
      row.signTestEligiblePromptGroups = nonTiedDeclines.length;
      row.signTestDeclinePromptGroups = exceedances;
      if (nonTiedDeclines.length < minimumMatchedPromptGroups) {
        row.signTestState = 'insufficient-support';
        reasons.push(
          `${row.provider} has only ${nonTiedDeclines.length} non-tied prompts for the exact sign test`
        );
        continue;
      }
      row.signTestPValue = exactBinomialUpperTail(exceedances, nonTiedDeclines.length);
      row.signTestState = 'available';
    }
    const signTestFamilyComplete =
      analysis.summary.owned_domain_scope_available &&
      Number(analysis.summary.providers_omitted_by_budget ?? 0) === 0 &&
      !analysis.summary.output_rows_truncated &&
      rows.length > 0 &&
      rows.every((row) => row.state === 'available' && row.signTestState === 'available');
    if (signTestFamilyComplete) {
      const adjusted = holmAdjustedPValues(rows.map((row) => row.signTestPValue!));
      rows.forEach((row, index) => {
        row.signTestHolmAdjustedPValue = adjusted[index]!;
      });
    } else {
      for (const row of rows) {
        if (row.signTestState === 'available') row.signTestState = 'incomplete-family';
      }
      reasons.push(
        'owned-share sign tests could not be Holm-adjusted over a complete provider family'
      );
    }
  }
  for (const row of rows) {
    if (row.state !== 'available') continue;
    row.pointThresholdExceeded =
      maximumDropPercentagePoints === null
        ? null
        : (row.declinePercentagePoints ?? 0) > maximumDropPercentagePoints;
    row.lowerCiThresholdExceeded =
      minimumDeclineLowerCiPercentagePoints === undefined || row.bootstrapState !== 'available'
        ? null
        : (row.declineCi95LowerPercentagePoints ?? Number.NEGATIVE_INFINITY) >
          minimumDeclineLowerCiPercentagePoints;
    row.signTestThresholdExceeded =
      declineSignTestAlpha === undefined || row.signTestHolmAdjustedPValue === null
        ? null
        : row.signTestHolmAdjustedPValue <= declineSignTestAlpha;
  }
  const status =
    reasons.length > 0
      ? 'incomplete'
      : rows.some(
            (row) =>
              row.pointThresholdExceeded === true ||
              row.lowerCiThresholdExceeded === true ||
              row.signTestThresholdExceeded === true
          )
        ? 'regression'
        : 'passed';
  return {
    status,
    thresholdPercentagePoints: maximumDropPercentagePoints,
    lowerCiThresholdPercentagePoints: minimumDeclineLowerCiPercentagePoints ?? null,
    signTestAlpha: declineSignTestAlpha ?? null,
    signTestDeclineThresholdPercentagePoints: signTestDeclineThreshold,
    minimumMatchedPromptGroups,
    bootstrapDrawsUsed,
    providersEvaluated: eventRows.length,
    providersOmittedByBudget: Number(analysis.summary.providers_omitted_by_budget ?? 0),
    rows,
    reasons,
  };
}
