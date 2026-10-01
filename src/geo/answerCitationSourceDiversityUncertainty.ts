import type {
  AiAnswerCitationDomainConcentration,
  AiAnswerCitationObservationReport,
} from './answerCitationObservations';

const MAX_OUTPUT_ROWS = 50_000;
const DEFAULT_BOOTSTRAP_ITERATIONS = 1_000;
const MAX_BOOTSTRAP_DOMAIN_UPDATES = 50_000_000;
const MIN_BOOTSTRAP_ITERATIONS = 250;
const MAX_SOURCE_DIVERSITY_HTML_ROWS = 500;
const MAX_SOURCE_DIVERSITY_CHART_PROVIDERS = 24;

interface PromptSourceProfile {
  domainEvents: Map<string, number>;
  citationEvents: number;
  detailComplete: boolean;
  rankWeightedDomainEvents: Map<string, number>;
  rankWeightedCitationWeightTotal: number;
  rankDetailComplete: boolean;
}

interface ProviderSourcePanel {
  provider: string;
  allPromptGroups: number;
  allCitationEvents: number;
  promptGroups: PromptSourceProfile[];
  promptGroupMap: Map<string, PromptSourceProfile>;
  summary?: AiAnswerCitationDomainConcentration;
  catalogComplete: boolean;
  sourceDetailsComplete: boolean;
  rankSourceDetailsComplete: boolean;
  detailIssues: Set<string>;
}

interface DiversityMetrics {
  hhi: number | null;
  effectiveDomainCount: number | null;
  largestDomainSharePercent: number | null;
  meanDomainsPerPrompt: number | null;
}

interface RankWeightedMetrics {
  hhi: number | null;
  effectiveDomainCount: number | null;
  largestDomainSharePercent: number | null;
}

interface NumericInterval {
  lower: number;
  upper: number;
}

interface DiversityIntervals {
  hhi: NumericInterval | null;
  effectiveDomainCount: NumericInterval | null;
  largestDomainSharePercent: NumericInterval | null;
  meanDomainsPerPrompt: NumericInterval | null;
  rankWeightedHhi: NumericInterval | null;
  rankWeightedEffectiveDomainCount: NumericInterval | null;
  rankWeightedLargestDomainSharePercent: NumericInterval | null;
}

interface PairedDiversityIntervals {
  hhiChange: NumericInterval | null;
  effectiveDomainCountChange: NumericInterval | null;
  largestDomainShareChange: NumericInterval | null;
  meanDomainsPerPromptChange: NumericInterval | null;
}

interface PairedRankWeightedIntervals {
  hhiChange: NumericInterval | null;
  effectiveDomainCountChange: NumericInterval | null;
  largestDomainShareChange: NumericInterval | null;
}

function normalizedLabel(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function percentileInterval(values: number[]): NumericInterval | null {
  if (values.length < MIN_BOOTSTRAP_ITERATIONS) return null;
  values.sort((left, right) => left - right);
  return {
    lower: round(values[Math.floor((values.length - 1) * 0.025)]!),
    upper: round(values[Math.ceil((values.length - 1) * 0.975)]!),
  };
}

function metricsFromCounts(
  domainEvents: Map<string, number>,
  citationEvents: number,
  promptDomainTotal: number,
  promptCount: number
): DiversityMetrics {
  if (citationEvents <= 0) {
    return {
      hhi: null,
      effectiveDomainCount: null,
      largestDomainSharePercent: null,
      meanDomainsPerPrompt: promptCount > 0 ? round(promptDomainTotal / promptCount, 4) : null,
    };
  }
  let squaredShareTotal = 0;
  let largestShare = 0;
  for (const count of domainEvents.values()) {
    const share = count / citationEvents;
    squaredShareTotal += share * share;
    largestShare = Math.max(largestShare, share);
  }
  return {
    hhi: round(squaredShareTotal, 6),
    effectiveDomainCount: round(1 / squaredShareTotal, 4),
    largestDomainSharePercent: round(largestShare * 100, 2),
    meanDomainsPerPrompt: promptCount > 0 ? round(promptDomainTotal / promptCount, 4) : null,
  };
}

function rankWeightedMetricsFromCounts(
  domainWeights: Map<string, number>,
  totalWeight: number
): RankWeightedMetrics {
  if (totalWeight <= 0)
    return { hhi: null, effectiveDomainCount: null, largestDomainSharePercent: null };
  let squaredShareTotal = 0;
  let largestShare = 0;
  for (const weight of domainWeights.values()) {
    const share = weight / totalWeight;
    squaredShareTotal += share * share;
    largestShare = Math.max(largestShare, share);
  }
  return {
    hhi: round(squaredShareTotal, 6),
    effectiveDomainCount: round(1 / squaredShareTotal, 4),
    largestDomainSharePercent: round(largestShare * 100, 2),
  };
}

function leaveOnePromptOutHhiRange(
  profiles: PromptSourceProfile[],
  metric: 'events' | 'rank-weighted',
  complete: boolean
): { minimum: number | null; maximum: number | null; validPromptGroups: number } {
  if (!complete || profiles.length < 2)
    return { minimum: null, maximum: null, validPromptGroups: 0 };
  const domainTotals = new Map<string, number>();
  let totalWeight = 0;
  let squaredTotals = 0;
  for (const profile of profiles) {
    const weights = metric === 'events' ? profile.domainEvents : profile.rankWeightedDomainEvents;
    totalWeight +=
      metric === 'events' ? profile.citationEvents : profile.rankWeightedCitationWeightTotal;
    for (const [domain, weight] of weights)
      domainTotals.set(domain, (domainTotals.get(domain) ?? 0) + weight);
  }
  for (const total of domainTotals.values()) squaredTotals += total * total;
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let validPromptGroups = 0;
  for (const profile of profiles) {
    const groupTotal =
      metric === 'events' ? profile.citationEvents : profile.rankWeightedCitationWeightTotal;
    const remainingTotal = totalWeight - groupTotal;
    if (remainingTotal <= 0) continue;
    const weights = metric === 'events' ? profile.domainEvents : profile.rankWeightedDomainEvents;
    let remainingSquaredTotals = squaredTotals;
    for (const [domain, weight] of weights) {
      const total = domainTotals.get(domain)!;
      remainingSquaredTotals += weight * weight - 2 * total * weight;
    }
    const hhi = Math.max(0, remainingSquaredTotals) / (remainingTotal * remainingTotal);
    minimum = Math.min(minimum, hhi);
    maximum = Math.max(maximum, hhi);
    validPromptGroups += 1;
  }
  return validPromptGroups > 0
    ? { minimum: round(minimum, 6), maximum: round(maximum, 6), validPromptGroups }
    : { minimum: null, maximum: null, validPromptGroups: 0 };
}

function deterministicSeed(text: string): number {
  let seed = 2166136261;
  for (const character of text) seed = Math.imul(seed ^ character.codePointAt(0)!, 16777619) >>> 0;
  return seed === 0 ? 0x6d2b79f5 : seed;
}

function bootstrapIntervals(
  profiles: PromptSourceProfile[],
  seedText: string,
  iterations: number,
  includeEventMetrics: boolean,
  includeRankWeightedMetrics: boolean
): DiversityIntervals {
  const empty = {
    hhi: null,
    effectiveDomainCount: null,
    largestDomainSharePercent: null,
    meanDomainsPerPrompt: null,
    rankWeightedHhi: null,
    rankWeightedEffectiveDomainCount: null,
    rankWeightedLargestDomainSharePercent: null,
  };
  if (profiles.length < 2 || iterations < MIN_BOOTSTRAP_ITERATIONS) return empty;
  const hhiValues: number[] = [];
  const effectiveValues: number[] = [];
  const largestShareValues: number[] = [];
  const meanDomainsValues: number[] = [];
  const rankHhiValues: number[] = [];
  const rankEffectiveValues: number[] = [];
  const rankLargestShareValues: number[] = [];
  let randomState = deterministicSeed(seedText);
  let allDrawsHadCitations = true;
  let allDrawsHadRankWeights = true;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const domainEvents = new Map<string, number>();
    const rankWeightedDomainEvents = new Map<string, number>();
    let citationEvents = 0;
    let rankWeightedCitationWeight = 0;
    let promptDomainTotal = 0;
    for (let draw = 0; draw < profiles.length; draw += 1) {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      const profile = profiles[Math.floor((randomState / 0x1_0000_0000) * profiles.length)]!;
      if (includeEventMetrics) {
        promptDomainTotal += profile.domainEvents.size;
        citationEvents += profile.citationEvents;
        for (const [domain, count] of profile.domainEvents)
          domainEvents.set(domain, (domainEvents.get(domain) ?? 0) + count);
      }
      if (includeRankWeightedMetrics) {
        rankWeightedCitationWeight += profile.rankWeightedCitationWeightTotal;
        for (const [domain, weight] of profile.rankWeightedDomainEvents)
          rankWeightedDomainEvents.set(
            domain,
            (rankWeightedDomainEvents.get(domain) ?? 0) + weight
          );
      }
    }
    if (includeEventMetrics) {
      const metrics = metricsFromCounts(
        domainEvents,
        citationEvents,
        promptDomainTotal,
        profiles.length
      );
      if (metrics.hhi !== null) {
        hhiValues.push(metrics.hhi);
        effectiveValues.push(metrics.effectiveDomainCount!);
        largestShareValues.push(metrics.largestDomainSharePercent!);
      } else allDrawsHadCitations = false;
      meanDomainsValues.push(metrics.meanDomainsPerPrompt!);
    }
    if (includeRankWeightedMetrics) {
      const metrics = rankWeightedMetricsFromCounts(
        rankWeightedDomainEvents,
        rankWeightedCitationWeight
      );
      if (metrics.hhi !== null) {
        rankHhiValues.push(metrics.hhi);
        rankEffectiveValues.push(metrics.effectiveDomainCount!);
        rankLargestShareValues.push(metrics.largestDomainSharePercent!);
      } else allDrawsHadRankWeights = false;
    }
  }
  return {
    hhi: includeEventMetrics && allDrawsHadCitations ? percentileInterval(hhiValues) : null,
    effectiveDomainCount:
      includeEventMetrics && allDrawsHadCitations ? percentileInterval(effectiveValues) : null,
    largestDomainSharePercent:
      includeEventMetrics && allDrawsHadCitations ? percentileInterval(largestShareValues) : null,
    meanDomainsPerPrompt: includeEventMetrics ? percentileInterval(meanDomainsValues) : null,
    rankWeightedHhi:
      includeRankWeightedMetrics && allDrawsHadRankWeights
        ? percentileInterval(rankHhiValues)
        : null,
    rankWeightedEffectiveDomainCount:
      includeRankWeightedMetrics && allDrawsHadRankWeights
        ? percentileInterval(rankEffectiveValues)
        : null,
    rankWeightedLargestDomainSharePercent:
      includeRankWeightedMetrics && allDrawsHadRankWeights
        ? percentileInterval(rankLargestShareValues)
        : null,
  };
}

function bootstrapPairedIntervals(
  baselineProfiles: PromptSourceProfile[],
  currentProfiles: PromptSourceProfile[],
  seedText: string,
  iterations: number
): PairedDiversityIntervals {
  const empty = {
    hhiChange: null,
    effectiveDomainCountChange: null,
    largestDomainShareChange: null,
    meanDomainsPerPromptChange: null,
  };
  if (
    baselineProfiles.length < 2 ||
    baselineProfiles.length !== currentProfiles.length ||
    iterations < MIN_BOOTSTRAP_ITERATIONS
  )
    return empty;
  const hhiChanges: number[] = [];
  const effectiveChanges: number[] = [];
  const largestShareChanges: number[] = [];
  const meanDomainChanges: number[] = [];
  let randomState = deterministicSeed(seedText);
  let allDrawsHadCitations = true;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const baselineDomainEvents = new Map<string, number>();
    const currentDomainEvents = new Map<string, number>();
    let baselineCitationEvents = 0;
    let currentCitationEvents = 0;
    let baselinePromptDomainTotal = 0;
    let currentPromptDomainTotal = 0;
    for (let draw = 0; draw < baselineProfiles.length; draw += 1) {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      const index = Math.floor((randomState / 0x1_0000_0000) * baselineProfiles.length);
      const baselineProfile = baselineProfiles[index]!;
      const currentProfile = currentProfiles[index]!;
      baselinePromptDomainTotal += baselineProfile.domainEvents.size;
      currentPromptDomainTotal += currentProfile.domainEvents.size;
      baselineCitationEvents += baselineProfile.citationEvents;
      currentCitationEvents += currentProfile.citationEvents;
      for (const [domain, count] of baselineProfile.domainEvents) {
        baselineDomainEvents.set(domain, (baselineDomainEvents.get(domain) ?? 0) + count);
      }
      for (const [domain, count] of currentProfile.domainEvents) {
        currentDomainEvents.set(domain, (currentDomainEvents.get(domain) ?? 0) + count);
      }
    }
    const baselineMetrics = metricsFromCounts(
      baselineDomainEvents,
      baselineCitationEvents,
      baselinePromptDomainTotal,
      baselineProfiles.length
    );
    const currentMetrics = metricsFromCounts(
      currentDomainEvents,
      currentCitationEvents,
      currentPromptDomainTotal,
      currentProfiles.length
    );
    if (baselineMetrics.hhi !== null && currentMetrics.hhi !== null) {
      hhiChanges.push(currentMetrics.hhi - baselineMetrics.hhi);
      effectiveChanges.push(
        currentMetrics.effectiveDomainCount! - baselineMetrics.effectiveDomainCount!
      );
      largestShareChanges.push(
        currentMetrics.largestDomainSharePercent! - baselineMetrics.largestDomainSharePercent!
      );
    } else allDrawsHadCitations = false;
    meanDomainChanges.push(
      currentMetrics.meanDomainsPerPrompt! - baselineMetrics.meanDomainsPerPrompt!
    );
  }
  return {
    hhiChange: allDrawsHadCitations ? percentileInterval(hhiChanges) : null,
    effectiveDomainCountChange: allDrawsHadCitations ? percentileInterval(effectiveChanges) : null,
    largestDomainShareChange: allDrawsHadCitations ? percentileInterval(largestShareChanges) : null,
    meanDomainsPerPromptChange: percentileInterval(meanDomainChanges),
  };
}

function bootstrapPairedRankWeightedIntervals(
  baselineProfiles: PromptSourceProfile[],
  currentProfiles: PromptSourceProfile[],
  seedText: string,
  iterations: number
): PairedRankWeightedIntervals {
  const empty = {
    hhiChange: null,
    effectiveDomainCountChange: null,
    largestDomainShareChange: null,
  };
  if (
    baselineProfiles.length < 2 ||
    baselineProfiles.length !== currentProfiles.length ||
    iterations < MIN_BOOTSTRAP_ITERATIONS
  )
    return empty;
  const hhiChanges: number[] = [];
  const effectiveChanges: number[] = [];
  const largestShareChanges: number[] = [];
  let randomState = deterministicSeed(seedText);
  let allDrawsHadRankWeights = true;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const baselineDomainWeights = new Map<string, number>();
    const currentDomainWeights = new Map<string, number>();
    let baselineWeightTotal = 0;
    let currentWeightTotal = 0;
    for (let draw = 0; draw < baselineProfiles.length; draw += 1) {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      const index = Math.floor((randomState / 0x1_0000_0000) * baselineProfiles.length);
      const baselineProfile = baselineProfiles[index]!;
      const currentProfile = currentProfiles[index]!;
      baselineWeightTotal += baselineProfile.rankWeightedCitationWeightTotal;
      currentWeightTotal += currentProfile.rankWeightedCitationWeightTotal;
      for (const [domain, weight] of baselineProfile.rankWeightedDomainEvents) {
        baselineDomainWeights.set(domain, (baselineDomainWeights.get(domain) ?? 0) + weight);
      }
      for (const [domain, weight] of currentProfile.rankWeightedDomainEvents) {
        currentDomainWeights.set(domain, (currentDomainWeights.get(domain) ?? 0) + weight);
      }
    }
    const baselineMetrics = rankWeightedMetricsFromCounts(
      baselineDomainWeights,
      baselineWeightTotal
    );
    const currentMetrics = rankWeightedMetricsFromCounts(currentDomainWeights, currentWeightTotal);
    if (baselineMetrics.hhi !== null && currentMetrics.hhi !== null) {
      hhiChanges.push(currentMetrics.hhi - baselineMetrics.hhi);
      effectiveChanges.push(
        currentMetrics.effectiveDomainCount! - baselineMetrics.effectiveDomainCount!
      );
      largestShareChanges.push(
        currentMetrics.largestDomainSharePercent! - baselineMetrics.largestDomainSharePercent!
      );
    } else allDrawsHadRankWeights = false;
  }
  return {
    hhiChange: allDrawsHadRankWeights ? percentileInterval(hhiChanges) : null,
    effectiveDomainCountChange: allDrawsHadRankWeights
      ? percentileInterval(effectiveChanges)
      : null,
    largestDomainShareChange: allDrawsHadRankWeights
      ? percentileInterval(largestShareChanges)
      : null,
  };
}

function buildProviderPanels(
  report: AiAnswerCitationObservationReport
): Map<string, ProviderSourcePanel> {
  const panels = new Map<string, ProviderSourcePanel>();
  for (const provider of report.providers) {
    const key = normalizedLabel(provider.provider);
    panels.set(key, {
      provider: provider.provider,
      allPromptGroups: provider.uniquePrompts,
      allCitationEvents: provider.citationEvents,
      promptGroups: [],
      promptGroupMap: new Map(),
      summary: provider.domainConcentration,
      catalogComplete: !report.promptsTruncated,
      sourceDetailsComplete: true,
      rankSourceDetailsComplete: true,
      detailIssues: new Set(report.promptsTruncated ? ['prompt-catalog-truncated'] : []),
    });
  }

  for (const prompt of report.prompts) {
    const promptKey = normalizedLabel(prompt.prompt);
    if (!Array.isArray(prompt.providerProfiles)) {
      for (const panel of panels.values()) {
        panel.catalogComplete = false;
        panel.sourceDetailsComplete = false;
        panel.rankSourceDetailsComplete = false;
        panel.detailIssues.add('provider-prompt-detail-missing');
      }
      continue;
    }
    for (const profile of prompt.providerProfiles) {
      const key = normalizedLabel(profile.provider);
      const panel: ProviderSourcePanel = panels.get(key) ?? {
        provider: profile.provider,
        allPromptGroups: 0,
        allCitationEvents: 0,
        promptGroups: [],
        promptGroupMap: new Map(),
        catalogComplete: !report.promptsTruncated,
        sourceDetailsComplete: true,
        rankSourceDetailsComplete: true,
        detailIssues: new Set<string>(report.promptsTruncated ? ['prompt-catalog-truncated'] : []),
      };
      const hasDomainEvents = Array.isArray(profile.citedDomainCitationEvents);
      const hasCapState = typeof profile.citedDomainsTruncated === 'boolean';
      const detailComplete = hasDomainEvents && hasCapState && !profile.citedDomainsTruncated;
      const domainEvents = new Map<string, number>();
      for (const item of profile.citedDomainCitationEvents ?? []) {
        if (!Number.isFinite(item.citationEvents) || item.citationEvents < 0) {
          panel.detailIssues.add('invalid-domain-event-count');
          continue;
        }
        const domainKey = item.domain.toLowerCase();
        domainEvents.set(domainKey, (domainEvents.get(domainKey) ?? 0) + item.citationEvents);
      }
      const retainedCitationEvents = [...domainEvents.values()].reduce(
        (sum, count) => sum + count,
        0
      );
      if (!hasDomainEvents) panel.detailIssues.add('domain-event-detail-missing');
      if (!hasCapState) panel.detailIssues.add('domain-cap-state-missing');
      if (profile.citedDomainsTruncated)
        panel.detailIssues.add('per-prompt-domain-detail-truncated');
      if (retainedCitationEvents !== profile.citationEvents)
        panel.detailIssues.add('domain-event-total-mismatch');
      const hasRankWeightedEvents = Array.isArray(profile.rankWeightedDomainCitationEvents);
      const hasRankWeightTotal =
        typeof profile.rankWeightedCitationWeightTotal === 'number' &&
        Number.isFinite(profile.rankWeightedCitationWeightTotal) &&
        profile.rankWeightedCitationWeightTotal >= 0;
      const hasRankCapState = typeof profile.rankWeightedDomainsTruncated === 'boolean';
      const rankWeightedDomainEvents = new Map<string, number>();
      for (const item of profile.rankWeightedDomainCitationEvents ?? []) {
        if (!Number.isFinite(item.discountedCitationWeight) || item.discountedCitationWeight < 0) {
          panel.detailIssues.add('invalid-rank-weighted-domain-score');
          continue;
        }
        const domainKey = item.domain.toLowerCase();
        rankWeightedDomainEvents.set(
          domainKey,
          (rankWeightedDomainEvents.get(domainKey) ?? 0) + item.discountedCitationWeight
        );
      }
      const retainedRankWeight = [...rankWeightedDomainEvents.values()].reduce(
        (sum, weight) => sum + weight,
        0
      );
      const rankWeightTotal = hasRankWeightTotal ? profile.rankWeightedCitationWeightTotal! : 0;
      const rankWeightMatches =
        hasRankWeightTotal &&
        Math.abs(retainedRankWeight - rankWeightTotal) <= 1e-8 * Math.max(1, rankWeightTotal);
      const rankDetailComplete =
        hasRankWeightedEvents &&
        hasRankWeightTotal &&
        hasRankCapState &&
        !profile.rankWeightedDomainsTruncated &&
        rankWeightMatches;
      if (!hasRankWeightedEvents) panel.detailIssues.add('rank-weighted-domain-detail-missing');
      if (!hasRankWeightTotal) panel.detailIssues.add('rank-weight-total-missing');
      if (!hasRankCapState) panel.detailIssues.add('rank-domain-cap-state-missing');
      if (profile.rankWeightedDomainsTruncated)
        panel.detailIssues.add('rank-domain-detail-truncated');
      if (hasRankWeightTotal && !rankWeightMatches)
        panel.detailIssues.add('rank-weight-total-mismatch');
      const existing = panel.promptGroupMap.get(promptKey);
      // Merge normalized duplicate prompt/provider rows defensively for imported legacy reports.
      if (existing) {
        for (const [domain, count] of domainEvents)
          existing.domainEvents.set(domain, (existing.domainEvents.get(domain) ?? 0) + count);
        existing.citationEvents += profile.citationEvents;
        existing.detailComplete &&= detailComplete;
        for (const [domain, weight] of rankWeightedDomainEvents) {
          existing.rankWeightedDomainEvents.set(
            domain,
            (existing.rankWeightedDomainEvents.get(domain) ?? 0) + weight
          );
        }
        existing.rankWeightedCitationWeightTotal += rankWeightTotal;
        existing.rankDetailComplete &&= rankDetailComplete;
      } else {
        const promptGroup: PromptSourceProfile = {
          domainEvents,
          citationEvents: profile.citationEvents,
          detailComplete: detailComplete && retainedCitationEvents === profile.citationEvents,
          rankWeightedDomainEvents,
          rankWeightedCitationWeightTotal: rankWeightTotal,
          rankDetailComplete,
        };
        panel.promptGroups.push(promptGroup);
        panel.promptGroupMap.set(promptKey, promptGroup);
      }
      if (!detailComplete || retainedCitationEvents !== profile.citationEvents)
        panel.sourceDetailsComplete = false;
      if (!rankDetailComplete) panel.rankSourceDetailsComplete = false;
      panels.set(key, panel);
    }
  }

  for (const panel of panels.values()) {
    if (panel.promptGroups.length !== panel.allPromptGroups) {
      panel.catalogComplete = false;
      panel.detailIssues.add('provider-prompt-count-mismatch');
    }
    const retainedEvents = panel.promptGroups.reduce(
      (sum, profile) => sum + profile.citationEvents,
      0
    );
    if (retainedEvents !== panel.allCitationEvents) {
      panel.sourceDetailsComplete = false;
      panel.detailIssues.add('provider-citation-event-total-mismatch');
    }
  }
  return panels;
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  const firstNonWhitespace = text.trimStart().charAt(0);
  if (typeof value !== 'number' && firstNonWhitespace && '=+-@'.includes(firstNonWhitespace))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Export prompt-cluster bootstrap uncertainty for provider citation-source concentration and breadth. */
export function renderAiAnswerCitationSourceDiversityUncertaintyCsv(
  report: AiAnswerCitationObservationReport
): string {
  const panels = [...buildProviderPanels(report).values()].sort((left, right) =>
    left.provider.localeCompare(right.provider)
  );
  const projectedDomainUpdates = panels.reduce(
    (sum, panel) =>
      sum +
      (panel.catalogComplete
        ? panel.promptGroups.reduce(
            (subtotal, profile) =>
              subtotal +
              Math.max(
                1,
                (panel.sourceDetailsComplete && profile.detailComplete
                  ? profile.domainEvents.size
                  : 0) +
                  (panel.rankSourceDetailsComplete && profile.rankDetailComplete
                    ? profile.rankWeightedDomainEvents.size
                    : 0)
              ),
            0
          )
        : 0),
    0
  );
  const bootstrapIterations =
    projectedDomainUpdates > 0
      ? Math.min(
          DEFAULT_BOOTSTRAP_ITERATIONS,
          Math.floor(MAX_BOOTSTRAP_DOMAIN_UPDATES / projectedDomainUpdates)
        )
      : 0;
  const usableBootstrapIterations =
    bootstrapIterations >= MIN_BOOTSTRAP_ITERATIONS ? bootstrapIterations : 0;
  const outputTruncated = panels.length > MAX_OUTPUT_ROWS;
  const outputPanels = panels.slice(0, MAX_OUTPUT_ROWS);
  const headers = [
    'row_type',
    'provider',
    'all_provider_prompt_groups',
    'retained_provider_prompt_groups',
    'retained_prompt_groups_with_citations',
    'citation_events',
    'distinct_cited_domains',
    'prompt_catalog_complete',
    'source_detail_complete',
    'rank_weighted_detail_complete',
    'detail_issues',
    'event_weighted_domain_hhi',
    'event_weighted_domain_hhi_ci95_lower',
    'event_weighted_domain_hhi_ci95_upper',
    'effective_cited_domain_count',
    'effective_cited_domain_count_ci95_lower',
    'effective_cited_domain_count_ci95_upper',
    'largest_domain_event_share_percent',
    'largest_domain_event_share_ci95_lower',
    'largest_domain_event_share_ci95_upper',
    'equal_prompt_mean_domains_cited',
    'equal_prompt_mean_domains_cited_ci95_lower',
    'equal_prompt_mean_domains_cited_ci95_upper',
    'rank_weighted_domain_hhi',
    'rank_weighted_domain_hhi_ci95_lower',
    'rank_weighted_domain_hhi_ci95_upper',
    'rank_weighted_effective_domain_count',
    'rank_weighted_effective_domain_count_ci95_lower',
    'rank_weighted_effective_domain_count_ci95_upper',
    'largest_rank_weighted_domain_share_percent',
    'largest_rank_weighted_domain_share_ci95_lower',
    'largest_rank_weighted_domain_share_ci95_upper',
    'event_hhi_leave_one_prompt_out_valid_groups',
    'event_hhi_leave_one_prompt_out_minimum',
    'event_hhi_leave_one_prompt_out_maximum',
    'rank_weighted_hhi_leave_one_prompt_out_valid_groups',
    'rank_weighted_hhi_leave_one_prompt_out_minimum',
    'rank_weighted_hhi_leave_one_prompt_out_maximum',
    'bootstrap_resamples',
    'bootstrap_interval_state',
    'rank_weighted_bootstrap_interval_state',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note =
    'Prompt-cluster bootstrap resamples exact provider/prompt groups with replacement and keeps each group’s citation events intact. Event concentration treats each cited URL event equally; rank-weighted concentration discounts each position by 1/log2(rank+1), so higher listed sources carry more weight. Mean domains per prompt weights each prompt equally, including uncited prompts. Leave-one-prompt-out HHI ranges recompute the provider statistic after omitting each single prompt group; they are sensitivity ranges, not confidence intervals. Bootstrap intervals describe the supplied panel and are withheld when the corresponding retained detail is incomplete or the bounded resample budget is insufficient. These are descriptive sample measures, not source-quality, visibility, or causal estimates.';
  const summaryValues = new Map<string, unknown>([
    ['row_type', 'summary'],
    ['prompt_catalog_complete', panels.every((panel) => panel.catalogComplete)],
    [
      'source_detail_complete',
      panels.every(
        (panel) =>
          panel.sourceDetailsComplete &&
          panel.promptGroups.every((profile) => profile.detailComplete)
      ),
    ],
    [
      'rank_weighted_detail_complete',
      panels.every(
        (panel) =>
          panel.catalogComplete &&
          panel.rankSourceDetailsComplete &&
          panel.promptGroups.every((profile) => profile.rankDetailComplete)
      ),
    ],
    ['bootstrap_resamples', usableBootstrapIterations],
    [
      'bootstrap_interval_state',
      usableBootstrapIterations > 0 ? 'bounded-budget' : 'budget-or-data-limited',
    ],
    [
      'rank_weighted_bootstrap_interval_state',
      usableBootstrapIterations > 0 ? 'bounded-budget' : 'budget-or-data-limited',
    ],
    ['output_rows_truncated', outputTruncated],
    ['interpretation_note', note],
  ]);
  const summaryRow = headers.map((header) => summaryValues.get(header) ?? '');
  const rows = outputPanels.map((panel) => {
    const retainedPromptGroups = panel.promptGroups.length;
    const promptGroupsWithCitations = panel.promptGroups.filter(
      (profile) => profile.citationEvents > 0
    ).length;
    const retainedCitationEvents = panel.promptGroups.reduce(
      (sum, profile) => sum + profile.citationEvents,
      0
    );
    const retainedDomainEvents = new Map<string, number>();
    const rankWeightedDomainEvents = new Map<string, number>();
    let rankWeightedCitationWeightTotal = 0;
    let promptDomainTotal = 0;
    for (const profile of panel.promptGroups) {
      promptDomainTotal += profile.domainEvents.size;
      for (const [domain, count] of profile.domainEvents)
        retainedDomainEvents.set(domain, (retainedDomainEvents.get(domain) ?? 0) + count);
      rankWeightedCitationWeightTotal += profile.rankWeightedCitationWeightTotal;
      for (const [domain, weight] of profile.rankWeightedDomainEvents) {
        rankWeightedDomainEvents.set(domain, (rankWeightedDomainEvents.get(domain) ?? 0) + weight);
      }
    }
    const complete =
      panel.catalogComplete &&
      panel.sourceDetailsComplete &&
      panel.promptGroups.every((profile) => profile.detailComplete);
    const rankComplete =
      panel.catalogComplete &&
      panel.rankSourceDetailsComplete &&
      panel.promptGroups.every((profile) => profile.rankDetailComplete);
    const observedMetrics = metricsFromCounts(
      retainedDomainEvents,
      retainedCitationEvents,
      promptDomainTotal,
      retainedPromptGroups
    );
    const exactMetrics = complete
      ? observedMetrics
      : {
          hhi: panel.summary?.herfindahlIndex ?? null,
          effectiveDomainCount: panel.summary?.effectiveCitedDomainCount ?? null,
          largestDomainSharePercent: panel.summary?.largestDomainCitationSharePercent ?? null,
          meanDomainsPerPrompt: null,
        };
    const rankWeightedMetrics = rankComplete
      ? rankWeightedMetricsFromCounts(rankWeightedDomainEvents, rankWeightedCitationWeightTotal)
      : { hhi: null, effectiveDomainCount: null, largestDomainSharePercent: null };
    const eventLeaveOneOut = leaveOnePromptOutHhiRange(panel.promptGroups, 'events', complete);
    const rankLeaveOneOut = leaveOnePromptOutHhiRange(
      panel.promptGroups,
      'rank-weighted',
      rankComplete
    );
    const intervals = bootstrapIntervals(
      panel.promptGroups,
      `${normalizedLabel(panel.provider)}\u0000source-diversity`,
      usableBootstrapIterations,
      complete,
      rankComplete
    );
    const intervalState = !complete
      ? 'incomplete-retained-detail'
      : retainedPromptGroups < 2
        ? 'insufficient-prompt-groups'
        : usableBootstrapIterations < MIN_BOOTSTRAP_ITERATIONS
          ? 'budget-limited'
          : retainedCitationEvents === 0
            ? 'no-citation-events'
            : intervals.hhi === null
              ? 'citation-free-bootstrap-draws'
              : 'available';
    const rankIntervalState = !rankComplete
      ? 'incomplete-retained-rank-detail'
      : retainedPromptGroups < 2
        ? 'insufficient-prompt-groups'
        : usableBootstrapIterations < MIN_BOOTSTRAP_ITERATIONS
          ? 'budget-limited'
          : rankWeightedCitationWeightTotal === 0
            ? 'no-citation-events'
            : intervals.rankWeightedHhi === null
              ? 'citation-free-bootstrap-draws'
              : 'available';
    return [
      'provider',
      panel.provider,
      panel.allPromptGroups,
      retainedPromptGroups,
      promptGroupsWithCitations,
      panel.allCitationEvents,
      panel.summary?.distinctCitedDomains ?? retainedDomainEvents.size,
      panel.catalogComplete,
      panel.sourceDetailsComplete && panel.promptGroups.every((profile) => profile.detailComplete),
      rankComplete,
      [...panel.detailIssues].sort().join(';'),
      exactMetrics.hhi,
      intervals.hhi?.lower ?? null,
      intervals.hhi?.upper ?? null,
      exactMetrics.effectiveDomainCount,
      intervals.effectiveDomainCount?.lower ?? null,
      intervals.effectiveDomainCount?.upper ?? null,
      exactMetrics.largestDomainSharePercent,
      intervals.largestDomainSharePercent?.lower ?? null,
      intervals.largestDomainSharePercent?.upper ?? null,
      exactMetrics.meanDomainsPerPrompt,
      intervals.meanDomainsPerPrompt?.lower ?? null,
      intervals.meanDomainsPerPrompt?.upper ?? null,
      rankWeightedMetrics.hhi,
      intervals.rankWeightedHhi?.lower ?? null,
      intervals.rankWeightedHhi?.upper ?? null,
      rankWeightedMetrics.effectiveDomainCount,
      intervals.rankWeightedEffectiveDomainCount?.lower ?? null,
      intervals.rankWeightedEffectiveDomainCount?.upper ?? null,
      rankWeightedMetrics.largestDomainSharePercent,
      intervals.rankWeightedLargestDomainSharePercent?.lower ?? null,
      intervals.rankWeightedLargestDomainSharePercent?.upper ?? null,
      eventLeaveOneOut.validPromptGroups,
      eventLeaveOneOut.minimum,
      eventLeaveOneOut.maximum,
      rankLeaveOneOut.validPromptGroups,
      rankLeaveOneOut.minimum,
      rankLeaveOneOut.maximum,
      usableBootstrapIterations,
      intervalState,
      rankIntervalState,
      outputTruncated,
      note,
    ];
  });
  return `${[headers, summaryRow, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function parseSourceDiversityCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      row.push(field);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else {
      field += character;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((value) => value !== '')) rows.push(row);
  }
  return rows;
}

function escapeSourceDiversityHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/gu,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!
  );
}

/** Render a bounded offline dashboard for provider source-concentration uncertainty. */
export function renderAiAnswerCitationSourceDiversityUncertaintyHtml(
  report: AiAnswerCitationObservationReport
): string {
  const parsed = parseSourceDiversityCsv(
    renderAiAnswerCitationSourceDiversityUncertaintyCsv(report)
  );
  const headers = parsed[0] ?? [];
  const records = parsed
    .slice(1)
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
    );
  const summary = records.find((record) => record.row_type === 'summary') ?? {};
  const providerRows = records.filter((record) => record.row_type === 'provider');
  const value = (record: Record<string, string>, key: string): number | null => {
    const raw = record[key] ?? '';
    if (!raw) return null;
    const parsedValue = Number(raw);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  };
  const display = (record: Record<string, string>, key: string, digits = 4): string => {
    const number = value(record, key);
    return number === null
      ? '—'
      : number.toLocaleString('en-US', {
          maximumFractionDigits: digits,
          minimumFractionDigits: digits,
        });
  };
  const chart = (
    title: string,
    description: string,
    pointKey: string,
    lowerKey: string,
    upperKey: string,
    stateKey: string,
    color: string
  ): string => {
    const items = providerRows
      .filter((record) => value(record, pointKey) !== null)
      .sort(
        (left, right) =>
          (value(right, pointKey) ?? -1) - (value(left, pointKey) ?? -1) ||
          String(left.provider).localeCompare(String(right.provider))
      )
      .slice(0, MAX_SOURCE_DIVERSITY_CHART_PROVIDERS);
    const width = 1_080;
    const labelWidth = 275;
    const right = 54;
    const top = 44;
    const rowHeight = 34;
    const height = top + rowHeight * Math.max(1, items.length) + 54;
    const plotWidth = width - labelWidth - right;
    const x = (metric: number): number => labelWidth + Math.max(0, Math.min(1, metric)) * plotWidth;
    const tickValues = [0, 0.25, 0.5, 0.75, 1];
    const grid = tickValues
      .map(
        (tick) =>
          `<g><line x1="${x(tick)}" y1="${top - 14}" x2="${x(tick)}" y2="${height - 42}" stroke="currentColor" opacity=".13"/><text x="${x(tick)}" y="${height - 19}" text-anchor="middle">${tick.toFixed(2)}</text></g>`
      )
      .join('');
    const marks = items
      .map((record, index) => {
        const y = top + index * rowHeight;
        const point = value(record, pointKey)!;
        const lower = value(record, lowerKey);
        const upper = value(record, upperKey);
        const interval =
          lower !== null && upper !== null
            ? `<g stroke="${color}" stroke-width="2" opacity=".75"><line x1="${x(lower)}" y1="${y}" x2="${x(upper)}" y2="${y}"/><line x1="${x(lower)}" y1="${y - 5}" x2="${x(lower)}" y2="${y + 5}"/><line x1="${x(upper)}" y1="${y - 5}" x2="${x(upper)}" y2="${y + 5}"/></g>`
            : '';
        return `<text x="${labelWidth - 12}" y="${y + 4}" text-anchor="end">${escapeSourceDiversityHtml(record.provider)}</text>${interval}<circle cx="${x(point)}" cy="${y}" r="5" fill="${color}"><title>${escapeSourceDiversityHtml(record.provider)}: ${point.toFixed(4)}; 95% interval ${lower === null || upper === null ? `unavailable (${record[stateKey] ?? 'unknown'})` : `${lower.toFixed(4)}–${upper.toFixed(4)}`}</title></circle>`;
      })
      .join('');
    const omitted =
      providerRows.filter((record) => value(record, pointKey) !== null).length - items.length;
    return `<section class="panel"><h2>${escapeSourceDiversityHtml(title)}</h2><p class="muted">${escapeSourceDiversityHtml(description)}</p><div class="chart-wrap"><svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeSourceDiversityHtml(title)} by provider"><title>${escapeSourceDiversityHtml(title)}</title>${grid}${marks}<text x="${labelWidth + plotWidth / 2}" y="${height - 2}" text-anchor="middle">Herfindahl–Hirschman Index · 0 to 1</text></svg></div>${omitted > 0 ? `<p class="muted">Showing the ${items.length} highest observed values; ${omitted.toLocaleString('en-US')} additional retained provider rows remain in the CSV.</p>` : ''}</section>`;
  };
  const tableRows = providerRows
    .slice(0, MAX_SOURCE_DIVERSITY_HTML_ROWS)
    .map((record) => {
      const eventInterval = `${display(record, 'event_weighted_domain_hhi_ci95_lower')}–${display(record, 'event_weighted_domain_hhi_ci95_upper')}`;
      const rankInterval = `${display(record, 'rank_weighted_domain_hhi_ci95_lower')}–${display(record, 'rank_weighted_domain_hhi_ci95_upper')}`;
      return `<tr><td>${escapeSourceDiversityHtml(record.provider)}</td><td>${escapeSourceDiversityHtml(record.retained_provider_prompt_groups)} / ${escapeSourceDiversityHtml(record.all_provider_prompt_groups)}</td><td>${display(record, 'event_weighted_domain_hhi')}<br><span class="muted">95% ${eventInterval} · ${escapeSourceDiversityHtml(record.bootstrap_interval_state)}</span></td><td>${display(record, 'rank_weighted_domain_hhi')}<br><span class="muted">95% ${rankInterval} · ${escapeSourceDiversityHtml(record.rank_weighted_bootstrap_interval_state)}</span></td><td>${display(record, 'effective_cited_domain_count', 2)}</td><td>${display(record, 'largest_domain_event_share_percent', 2)}%</td><td>${display(record, 'rank_weighted_effective_domain_count', 2)}</td><td>${display(record, 'largest_rank_weighted_domain_share_percent', 2)}%</td><td>${display(record, 'event_hhi_leave_one_prompt_out_minimum')}–${display(record, 'event_hhi_leave_one_prompt_out_maximum')}</td><td>${escapeSourceDiversityHtml(record.source_detail_complete)} · ${escapeSourceDiversityHtml(record.rank_weighted_detail_complete)}</td></tr>`;
    })
    .join('');
  const rowCapNote =
    providerRows.length > MAX_SOURCE_DIVERSITY_HTML_ROWS
      ? `<p class="notice">Showing ${MAX_SOURCE_DIVERSITY_HTML_ROWS.toLocaleString('en-US')} of ${providerRows.length.toLocaleString('en-US')} provider rows. The CSV retains up to ${MAX_OUTPUT_ROWS.toLocaleString('en-US')} rows.</p>`
      : '';
  const summaryItems = [
    ['Providers', providerRows.length.toLocaleString('en-US')],
    ['Bootstrap resamples', escapeSourceDiversityHtml(summary.bootstrap_resamples || 0)],
    ['Event detail complete', escapeSourceDiversityHtml(summary.source_detail_complete ?? '—')],
    [
      'Rank detail complete',
      escapeSourceDiversityHtml(summary.rank_weighted_detail_complete ?? '—'),
    ],
    ['CSV rows capped', escapeSourceDiversityHtml(summary.output_rows_truncated ?? '—')],
  ]
    .map(
      ([label, metric]) =>
        `<div class="metric"><span>${label}</span><strong>${metric}</strong></div>`
    )
    .join('');
  const empty =
    providerRows.length === 0
      ? '<p class="empty">No provider prompt groups are available for a source-diversity profile.</p>'
      : '';
  const eventChart = chart(
    'Event-weighted source concentration',
    'Each cited URL event contributes equally. Higher HHI means a more concentrated observed source mix; whiskers show percentile intervals from exact-prompt-cluster bootstrap resamples.',
    'event_weighted_domain_hhi',
    'event_weighted_domain_hhi_ci95_lower',
    'event_weighted_domain_hhi_ci95_upper',
    'bootstrap_interval_state',
    '#20574c'
  );
  const rankChart = chart(
    'Rank-weighted source concentration',
    'Higher citation-list positions receive greater weight. The interval state reflects retained rank-detail completeness and the shared bootstrap budget.',
    'rank_weighted_domain_hhi',
    'rank_weighted_domain_hhi_ci95_lower',
    'rank_weighted_domain_hhi_ci95_upper',
    'rank_weighted_bootstrap_interval_state',
    '#bd4b32'
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI answer source-diversity uncertainty</title><style>:root{color-scheme:light;--paper:#f2eee4;--ink:#202722;--muted:#5c665f;--rule:#c8cfc7;--card:#fbfaf6;--pine:#20574c;--rust:#bd4b32}*{box-sizing:border-box}body{margin:0 auto;padding:1.2rem;max-width:1500px;background:linear-gradient(90deg,rgba(32,87,76,.035) 1px,transparent 1px),linear-gradient(rgba(32,87,76,.035) 1px,transparent 1px),var(--paper);background-size:28px 28px;color:var(--ink);font:15px/1.58 "Avenir Next",Avenir,"Trebuchet MS",sans-serif}header,.panel{background:var(--card);border:1px solid var(--rule);border-radius:3px;padding:1rem 1.2rem;margin:0 0 1rem;box-shadow:0 8px 24px rgba(32,39,34,.05)}header{border-top:4px solid var(--pine)}h1,h2{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.025em}h1{margin:.1rem 0 .35rem;font-size:1.8rem}h2{margin:.1rem 0 .5rem;font-size:1.2rem}.muted{color:var(--muted);font-size:.88em}.metrics{display:flex;flex-wrap:wrap;gap:.6rem;margin:.9rem 0}.metric{border:1px solid var(--rule);border-radius:3px;padding:.55rem .75rem;min-width:150px;background:#f5f2e9}.metric strong{display:block;font:600 1.05rem ui-monospace,monospace;color:var(--pine)}.chart-wrap{overflow:auto}.chart{display:block;width:100%;min-width:780px;height:auto;color:#526174;background:#f8f6ee;border:1px solid var(--rule);padding:.55rem}.chart text{font:12px ui-monospace,monospace;fill:currentColor}.table-wrap{overflow:auto;max-height:70vh;border:1px solid var(--rule);border-radius:3px}table{border-collapse:collapse;width:100%;min-width:1250px;font-size:.9rem}th,td{padding:.55rem .65rem;border-bottom:1px solid #e1e3d9;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#e9ece3;z-index:1;color:#273d34;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase}tbody tr:hover{background:#f0f3ea}.notice{padding:.7rem .9rem;border-left:4px solid #b77924;background:#f7efd9}.empty{padding:1rem;background:#f5f2e9;border-radius:3px}footer{color:var(--muted);font-size:.9rem}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--rust);outline-offset:3px}</style></head><body><main><header><h1>AI answer source-diversity uncertainty</h1><p>Compare how concentrated providers’ observed citation domains are under event counts and citation-list position weights. Bootstrap intervals resample exact provider/prompt clusters and keep each cluster’s citation events together. Wider intervals show greater panel sensitivity; leave-one-prompt ranges identify influential prompt groups without presenting them as confidence intervals.</p><div class="metrics">${summaryItems}</div></header>${empty}${providerRows.length ? `${eventChart}${rankChart}<section class="panel"><h2>Provider detail</h2><p class="muted">Effective domain counts are the inverse HHI. The top-source shares use the corresponding event or rank weights. Leave-one-prompt-out HHI ranges show the minimum and maximum after removing one exact prompt group; these are influence ranges, not confidence intervals.</p><div class="table-wrap"><table><thead><tr><th>Provider</th><th>Prompt groups retained / known</th><th>Event HHI · 95% interval and state</th><th>Rank HHI · 95% interval and state</th><th>Effective event domains</th><th>Top event-source share</th><th>Effective rank domains</th><th>Top rank-source share</th><th>Event HHI leave-one-prompt range</th><th>Event / rank detail complete</th></tr></thead><tbody>${tableRows}</tbody></table></div>${rowCapNote}</section>` : ''}<footer class="muted">The report describes the supplied answer observations. It does not score source quality, provider visibility, or causal impact. See the companion CSV for every retained row and machine-readable interval states.</footer></main></body></html>\n`;
}

/** Render a bounded offline view of matched-prompt source-diversity changes. */
export function renderAiAnswerCitationSourceDiversityComparisonHtml(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  const parsed = parseSourceDiversityCsv(
    renderAiAnswerCitationSourceDiversityComparisonCsv(current, baseline)
  );
  const headers = parsed[0] ?? [];
  const records = parsed
    .slice(1)
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
    );
  const summary = records.find((record) => record.row_type === 'summary') ?? {};
  const providerRows = records.filter((record) => record.row_type === 'provider');
  const value = (record: Record<string, string>, key: string): number | null => {
    const raw = record[key] ?? '';
    if (!raw) return null;
    const parsedValue = Number(raw);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  };
  const display = (record: Record<string, string>, key: string, digits = 4): string => {
    const number = value(record, key);
    return number === null
      ? '—'
      : number.toLocaleString('en-US', {
          maximumFractionDigits: digits,
          minimumFractionDigits: digits,
        });
  };
  const chart = (
    title: string,
    pointKey: string,
    lowerKey: string,
    upperKey: string,
    stateKey: string,
    color: string
  ): string => {
    const items = providerRows
      .filter((record) => value(record, pointKey) !== null)
      .sort(
        (left, right) =>
          Math.abs(value(right, pointKey) ?? 0) - Math.abs(value(left, pointKey) ?? 0) ||
          String(left.provider).localeCompare(String(right.provider))
      )
      .slice(0, MAX_SOURCE_DIVERSITY_CHART_PROVIDERS);
    const width = 1_080;
    const labelWidth = 275;
    const right = 54;
    const top = 44;
    const rowHeight = 34;
    const height = top + rowHeight * Math.max(1, items.length) + 54;
    const plotWidth = width - labelWidth - right;
    const x = (metric: number): number =>
      labelWidth + ((Math.max(-1, Math.min(1, metric)) + 1) / 2) * plotWidth;
    const ticks = [-1, -0.5, 0, 0.5, 1];
    const grid = ticks
      .map(
        (tick) =>
          `<g><line x1="${x(tick)}" y1="${top - 14}" x2="${x(tick)}" y2="${height - 42}" stroke="currentColor" opacity="${tick === 0 ? '.28' : '.12'}"/><text x="${x(tick)}" y="${height - 19}" text-anchor="middle">${tick.toFixed(1)}</text></g>`
      )
      .join('');
    const marks = items
      .map((record, index) => {
        const y = top + index * rowHeight;
        const point = value(record, pointKey)!;
        const lower = value(record, lowerKey);
        const upper = value(record, upperKey);
        const interval =
          lower !== null && upper !== null
            ? `<g stroke="${color}" stroke-width="2" opacity=".76"><line x1="${x(lower)}" y1="${y}" x2="${x(upper)}" y2="${y}"/><line x1="${x(lower)}" y1="${y - 5}" x2="${x(lower)}" y2="${y + 5}"/><line x1="${x(upper)}" y1="${y - 5}" x2="${x(upper)}" y2="${y + 5}"/></g>`
            : '';
        return `<text x="${labelWidth - 12}" y="${y + 4}" text-anchor="end">${escapeSourceDiversityHtml(record.provider)}</text>${interval}<circle cx="${x(point)}" cy="${y}" r="5" fill="${color}"><title>${escapeSourceDiversityHtml(record.provider)}: current minus baseline ${point.toFixed(4)}; paired 95% interval ${lower === null || upper === null ? `unavailable (${record[stateKey] ?? 'unknown'})` : `${lower.toFixed(4)}–${upper.toFixed(4)}`}</title></circle>`;
      })
      .join('');
    const omitted =
      providerRows.filter((record) => value(record, pointKey) !== null).length - items.length;
    return `<section class="panel"><h2>${escapeSourceDiversityHtml(title)}</h2><p class="muted">Positive values indicate greater concentration in the current sample; negative values indicate a less concentrated observed source mix. Whiskers are paired exact-prompt bootstrap intervals.</p><div class="chart-wrap"><svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeSourceDiversityHtml(title)} by provider"><title>${escapeSourceDiversityHtml(title)}</title>${grid}${marks}<text x="${labelWidth + plotWidth / 2}" y="${height - 2}" text-anchor="middle">Current minus baseline HHI change · zero is no observed change</text></svg></div>${omitted > 0 ? `<p class="muted">Showing ${items.length} changes with the largest absolute HHI movement; ${omitted.toLocaleString('en-US')} more providers remain in the detail table and CSV.</p>` : ''}</section>`;
  };
  const tableRows = providerRows
    .slice(0, MAX_SOURCE_DIVERSITY_HTML_ROWS)
    .map(
      (record) =>
        `<tr><td>${escapeSourceDiversityHtml(record.provider)}</td><td>${escapeSourceDiversityHtml(record.shared_exact_prompt_groups)} / ${escapeSourceDiversityHtml(record.comparable_shared_prompt_groups)} comparable</td><td>${display(record, 'baseline_event_weighted_domain_hhi')} → ${display(record, 'current_event_weighted_domain_hhi')}<br><strong>Δ ${display(record, 'hhi_change')}</strong><br><span class="muted">95% ${display(record, 'hhi_change_ci95_lower')}–${display(record, 'hhi_change_ci95_upper')} · ${escapeSourceDiversityHtml(record.bootstrap_interval_state)}</span></td><td>${display(record, 'effective_domain_count_change', 2)}</td><td>${display(record, 'largest_domain_share_change_percentage_points', 2)} pp</td><td>${display(record, 'rank_weighted_hhi_change')}<br><span class="muted">95% ${display(record, 'rank_weighted_hhi_change_ci95_lower')}–${display(record, 'rank_weighted_hhi_change_ci95_upper')} · ${escapeSourceDiversityHtml(record.rank_weighted_bootstrap_interval_state)}</span></td><td>${escapeSourceDiversityHtml(record.matched_source_detail_complete)} · ${escapeSourceDiversityHtml(record.matched_rank_weighted_source_detail_complete)}</td></tr>`
    )
    .join('');
  const summaryItems = [
    ['Providers compared', providerRows.length.toLocaleString('en-US')],
    ['Bootstrap resamples', escapeSourceDiversityHtml(summary.bootstrap_resamples || 0)],
    [
      'Matched event detail complete',
      escapeSourceDiversityHtml(summary.matched_source_detail_complete ?? '—'),
    ],
    [
      'Matched rank detail complete',
      escapeSourceDiversityHtml(summary.matched_rank_weighted_source_detail_complete ?? '—'),
    ],
    ['Comparison complete', escapeSourceDiversityHtml(summary.comparison_complete ?? '—')],
    ['CSV rows capped', escapeSourceDiversityHtml(summary.output_rows_truncated ?? '—')],
  ]
    .map(
      ([label, metric]) =>
        `<div class="metric"><span>${label}</span><strong>${metric}</strong></div>`
    )
    .join('');
  const rowCapNote =
    providerRows.length > MAX_SOURCE_DIVERSITY_HTML_ROWS
      ? `<p class="notice">Showing ${MAX_SOURCE_DIVERSITY_HTML_ROWS.toLocaleString('en-US')} of ${providerRows.length.toLocaleString('en-US')} provider rows. The CSV retains up to ${MAX_OUTPUT_ROWS.toLocaleString('en-US')} rows.</p>`
      : '';
  const empty =
    providerRows.length === 0
      ? '<p class="empty">No provider comparison rows are available.</p>'
      : '';
  const eventChart = chart(
    'Event-weighted HHI change',
    'hhi_change',
    'hhi_change_ci95_lower',
    'hhi_change_ci95_upper',
    'bootstrap_interval_state',
    '#20574c'
  );
  const rankChart = chart(
    'Rank-weighted HHI change',
    'rank_weighted_hhi_change',
    'rank_weighted_hhi_change_ci95_lower',
    'rank_weighted_hhi_change_ci95_upper',
    'rank_weighted_bootstrap_interval_state',
    '#bd4b32'
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI answer source-diversity change</title><style>:root{color-scheme:light;--paper:#f2eee4;--ink:#202722;--muted:#5c665f;--rule:#c8cfc7;--card:#fbfaf6;--pine:#20574c;--rust:#bd4b32}*{box-sizing:border-box}body{margin:0 auto;padding:1.2rem;max-width:1500px;background:linear-gradient(90deg,rgba(32,87,76,.035) 1px,transparent 1px),linear-gradient(rgba(32,87,76,.035) 1px,transparent 1px),var(--paper);background-size:28px 28px;color:var(--ink);font:15px/1.58 "Avenir Next",Avenir,"Trebuchet MS",sans-serif}header,.panel{background:var(--card);border:1px solid var(--rule);border-radius:3px;padding:1rem 1.2rem;margin:0 0 1rem;box-shadow:0 8px 24px rgba(32,39,34,.05)}header{border-top:4px solid var(--pine)}h1,h2{font-family:Georgia,"Times New Roman",serif;letter-spacing:-.025em}h1{margin:.1rem 0 .35rem;font-size:1.8rem}h2{margin:.1rem 0 .5rem;font-size:1.2rem}.muted{color:var(--muted);font-size:.88em}.metrics{display:flex;flex-wrap:wrap;gap:.6rem;margin:.9rem 0}.metric{border:1px solid var(--rule);border-radius:3px;padding:.55rem .75rem;min-width:150px;background:#f5f2e9}.metric strong{display:block;font:600 1.05rem ui-monospace,monospace;color:var(--pine)}.chart-wrap{overflow:auto}.chart{display:block;width:100%;min-width:780px;height:auto;color:#526174;background:#f8f6ee;border:1px solid var(--rule);padding:.55rem}.chart text{font:12px ui-monospace,monospace;fill:currentColor}.table-wrap{overflow:auto;max-height:70vh;border:1px solid var(--rule);border-radius:3px}table{border-collapse:collapse;width:100%;min-width:1150px;font-size:.9rem}th,td{padding:.55rem .65rem;border-bottom:1px solid #e1e3d9;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#e9ece3;z-index:1;color:#273d34;font-size:.78rem;letter-spacing:.04em;text-transform:uppercase}tbody tr:hover{background:#f0f3ea}.notice{padding:.7rem .9rem;border-left:4px solid #b77924;background:#f7efd9}.empty{padding:1rem;background:#f5f2e9;border-radius:3px}footer{color:var(--muted);font-size:.9rem}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--rust);outline-offset:3px}</style></head><body><main><header><h1>AI answer source-diversity change</h1><p>Compare source concentration on the same exact provider/prompt groups in baseline and current answer panels. Repeated captures stay inside their prompt cluster. The paired bootstrap resamples those shared prompts in both periods and preserves each side’s observed citation events; missing detail and prompt caps can withhold intervals.</p><div class="metrics">${summaryItems}</div></header>${empty}${providerRows.length ? `${eventChart}${rankChart}<section class="panel"><h2>Matched-provider detail</h2><p class="muted">HHI change is current minus baseline. Positive values indicate more concentrated observed citations, negative values less. Effective-domain and source-share changes use the same exact matched prompt groups. Intervals describe the retained paired panel, not population guarantees.</p><div class="table-wrap"><table><thead><tr><th>Provider</th><th>Shared / comparable prompt groups</th><th>Event HHI and paired interval</th><th>Effective domains Δ</th><th>Top-source share Δ</th><th>Rank HHI change and interval</th><th>Event / rank detail complete</th></tr></thead><tbody>${tableRows}</tbody></table></div>${rowCapNote}</section>` : ''}<footer class="muted">Changes describe the supplied answer samples, not source quality, ranking visibility, or causal impact. See the paired-comparison CSV for machine-readable estimates and completeness flags.</footer></main></body></html>\n`;
}

/** Compare provider source diversity across periods on the same exact prompt clusters. */
export function renderAiAnswerCitationSourceDiversityComparisonCsv(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  const currentPanels = buildProviderPanels(current);
  const baselinePanels = buildProviderPanels(baseline);
  const providerKeys = [...new Set([...currentPanels.keys(), ...baselinePanels.keys()])].sort(
    (left, right) => {
      const leftLabel =
        currentPanels.get(left)?.provider ?? baselinePanels.get(left)?.provider ?? left;
      const rightLabel =
        currentPanels.get(right)?.provider ?? baselinePanels.get(right)?.provider ?? right;
      return leftLabel.localeCompare(rightLabel);
    }
  );
  const contexts = providerKeys.map((providerKey) => {
    const before = baselinePanels.get(providerKey);
    const after = currentPanels.get(providerKey);
    const beforeMap = before?.promptGroupMap ?? new Map<string, PromptSourceProfile>();
    const afterMap = after?.promptGroupMap ?? new Map<string, PromptSourceProfile>();
    const sharedPromptKeys = [...beforeMap.keys()]
      .filter((promptKey) => afterMap.has(promptKey))
      .sort();
    const comparablePromptKeys = sharedPromptKeys.filter(
      (promptKey) =>
        beforeMap.get(promptKey)!.detailComplete && afterMap.get(promptKey)!.detailComplete
    );
    const rankComparablePromptKeys = sharedPromptKeys.filter(
      (promptKey) =>
        beforeMap.get(promptKey)!.rankDetailComplete && afterMap.get(promptKey)!.rankDetailComplete
    );
    return {
      providerKey,
      before,
      after,
      beforeMap,
      afterMap,
      sharedPromptKeys,
      comparablePromptKeys,
      rankComparablePromptKeys,
    };
  });
  const projectedDomainUpdates = contexts.reduce((sum, context) => {
    const eventUpdates = context.comparablePromptKeys.reduce((subtotal, promptKey) => {
      const before = context.beforeMap.get(promptKey)!;
      const after = context.afterMap.get(promptKey)!;
      return subtotal + Math.max(1, before.domainEvents.size + after.domainEvents.size);
    }, 0);
    const rankUpdates = context.rankComparablePromptKeys.reduce((subtotal, promptKey) => {
      const before = context.beforeMap.get(promptKey)!;
      const after = context.afterMap.get(promptKey)!;
      return (
        subtotal +
        Math.max(1, before.rankWeightedDomainEvents.size + after.rankWeightedDomainEvents.size)
      );
    }, 0);
    return sum + eventUpdates + rankUpdates;
  }, 0);
  const bootstrapIterations =
    projectedDomainUpdates > 0
      ? Math.min(
          DEFAULT_BOOTSTRAP_ITERATIONS,
          Math.floor(MAX_BOOTSTRAP_DOMAIN_UPDATES / projectedDomainUpdates)
        )
      : 0;
  const usableBootstrapIterations =
    bootstrapIterations >= MIN_BOOTSTRAP_ITERATIONS ? bootstrapIterations : 0;
  const outputTruncated = contexts.length > MAX_OUTPUT_ROWS;
  const outputContexts = contexts.slice(0, MAX_OUTPUT_ROWS);
  const headers = [
    'row_type',
    'provider',
    'baseline_provider_present',
    'current_provider_present',
    'baseline_provider_prompt_groups',
    'current_provider_prompt_groups',
    'shared_exact_prompt_groups',
    'comparable_shared_prompt_groups',
    'unknown_shared_prompt_groups',
    'rank_weighted_comparable_shared_prompt_groups',
    'unknown_rank_weighted_shared_prompt_groups',
    'baseline_matched_prompt_citation_events',
    'current_matched_prompt_citation_events',
    'baseline_event_weighted_domain_hhi',
    'current_event_weighted_domain_hhi',
    'hhi_change',
    'hhi_change_ci95_lower',
    'hhi_change_ci95_upper',
    'baseline_effective_cited_domain_count',
    'current_effective_cited_domain_count',
    'effective_domain_count_change',
    'effective_domain_count_change_ci95_lower',
    'effective_domain_count_change_ci95_upper',
    'baseline_largest_domain_event_share_percent',
    'current_largest_domain_event_share_percent',
    'largest_domain_share_change_percentage_points',
    'largest_domain_share_change_ci95_lower',
    'largest_domain_share_change_ci95_upper',
    'baseline_rank_weighted_domain_hhi',
    'current_rank_weighted_domain_hhi',
    'rank_weighted_hhi_change',
    'rank_weighted_hhi_change_ci95_lower',
    'rank_weighted_hhi_change_ci95_upper',
    'baseline_rank_weighted_effective_domain_count',
    'current_rank_weighted_effective_domain_count',
    'rank_weighted_effective_domain_count_change',
    'rank_weighted_effective_domain_count_change_ci95_lower',
    'rank_weighted_effective_domain_count_change_ci95_upper',
    'baseline_largest_rank_weighted_domain_share_percent',
    'current_largest_rank_weighted_domain_share_percent',
    'largest_rank_weighted_domain_share_change_percentage_points',
    'largest_rank_weighted_domain_share_change_ci95_lower',
    'largest_rank_weighted_domain_share_change_ci95_upper',
    'baseline_equal_prompt_mean_domains_cited',
    'current_equal_prompt_mean_domains_cited',
    'equal_prompt_mean_domains_cited_change',
    'equal_prompt_mean_domains_cited_change_ci95_lower',
    'equal_prompt_mean_domains_cited_change_ci95_upper',
    'baseline_prompt_catalog_complete',
    'current_prompt_catalog_complete',
    'matched_source_detail_complete',
    'matched_rank_weighted_source_detail_complete',
    'rank_weighted_comparison_complete',
    'comparison_complete',
    'bootstrap_resamples',
    'bootstrap_interval_state',
    'rank_weighted_bootstrap_interval_state',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note =
    'Event-weighted and rank-weighted metrics are recomputed on exact provider/prompt groups shared by baseline and current samples; repeated captures remain pooled inside each prompt cluster. Rank weights discount each supplied citation-list position by 1/log2(rank+1). Bootstrap draws resample the same matched prompts in both periods and preserve each side’s observed event counts and rank weights. Capped catalogs or unknown matched detail withhold intervals. This describes supplied samples, not engine visibility or causation.';
  const summary: Record<string, unknown> = Object.fromEntries(
    headers.map((header) => [header, ''])
  );
  summary.row_type = 'summary';
  summary.baseline_prompt_catalog_complete = baseline.promptsTruncated === false;
  summary.current_prompt_catalog_complete = current.promptsTruncated === false;
  summary.matched_source_detail_complete = contexts.every((context) =>
    context.sharedPromptKeys.every(
      (promptKey) =>
        context.beforeMap.get(promptKey)!.detailComplete &&
        context.afterMap.get(promptKey)!.detailComplete
    )
  );
  summary.matched_rank_weighted_source_detail_complete = contexts.every((context) =>
    context.sharedPromptKeys.every(
      (promptKey) =>
        context.beforeMap.get(promptKey)!.rankDetailComplete &&
        context.afterMap.get(promptKey)!.rankDetailComplete
    )
  );
  summary.comparison_complete = contexts.every(
    (context) =>
      context.before !== undefined &&
      context.after !== undefined &&
      context.before.catalogComplete &&
      context.after.catalogComplete &&
      context.sharedPromptKeys.length > 0 &&
      context.sharedPromptKeys.every(
        (promptKey) =>
          context.beforeMap.get(promptKey)!.detailComplete &&
          context.afterMap.get(promptKey)!.detailComplete
      )
  );
  summary.rank_weighted_comparison_complete =
    contexts.length > 0 &&
    contexts.every(
      (context) =>
        context.before !== undefined &&
        context.after !== undefined &&
        context.before.catalogComplete &&
        context.after.catalogComplete &&
        context.sharedPromptKeys.length > 0 &&
        context.sharedPromptKeys.every(
          (promptKey) =>
            context.beforeMap.get(promptKey)!.rankDetailComplete &&
            context.afterMap.get(promptKey)!.rankDetailComplete
        )
    );
  summary.bootstrap_resamples = usableBootstrapIterations;
  summary.bootstrap_interval_state =
    usableBootstrapIterations > 0 ? 'bounded-budget' : 'budget-or-data-limited';
  summary.rank_weighted_bootstrap_interval_state =
    usableBootstrapIterations > 0 ? 'bounded-budget' : 'budget-or-data-limited';
  summary.output_rows_truncated = outputTruncated;
  summary.interpretation_note = note;

  const rows: Array<Record<string, unknown>> = outputContexts.map((context) => {
    const before = context.before;
    const after = context.after;
    const baselineProfiles = context.comparablePromptKeys.map((promptKey) =>
      context.beforeMap.get(promptKey)!
    );
    const currentProfiles = context.comparablePromptKeys.map((promptKey) =>
      context.afterMap.get(promptKey)!
    );
    const baselineRankProfiles = context.rankComparablePromptKeys.map((promptKey) =>
      context.beforeMap.get(promptKey)!
    );
    const currentRankProfiles = context.rankComparablePromptKeys.map((promptKey) =>
      context.afterMap.get(promptKey)!
    );
    const baselineDomainEvents = new Map<string, number>();
    const currentDomainEvents = new Map<string, number>();
    const baselineRankWeights = new Map<string, number>();
    const currentRankWeights = new Map<string, number>();
    let baselineCitationEvents = 0;
    let currentCitationEvents = 0;
    let baselinePromptDomainTotal = 0;
    let currentPromptDomainTotal = 0;
    let baselineRankWeightTotal = 0;
    let currentRankWeightTotal = 0;
    for (const profile of baselineProfiles) {
      baselineCitationEvents += profile.citationEvents;
      baselinePromptDomainTotal += profile.domainEvents.size;
      for (const [domain, count] of profile.domainEvents)
        baselineDomainEvents.set(domain, (baselineDomainEvents.get(domain) ?? 0) + count);
    }
    for (const profile of currentProfiles) {
      currentCitationEvents += profile.citationEvents;
      currentPromptDomainTotal += profile.domainEvents.size;
      for (const [domain, count] of profile.domainEvents)
        currentDomainEvents.set(domain, (currentDomainEvents.get(domain) ?? 0) + count);
    }
    for (const profile of baselineRankProfiles) {
      baselineRankWeightTotal += profile.rankWeightedCitationWeightTotal;
      for (const [domain, weight] of profile.rankWeightedDomainEvents)
        baselineRankWeights.set(domain, (baselineRankWeights.get(domain) ?? 0) + weight);
    }
    for (const profile of currentRankProfiles) {
      currentRankWeightTotal += profile.rankWeightedCitationWeightTotal;
      for (const [domain, weight] of profile.rankWeightedDomainEvents)
        currentRankWeights.set(domain, (currentRankWeights.get(domain) ?? 0) + weight);
    }
    const baselineMetrics = metricsFromCounts(
      baselineDomainEvents,
      baselineCitationEvents,
      baselinePromptDomainTotal,
      baselineProfiles.length
    );
    const currentMetrics = metricsFromCounts(
      currentDomainEvents,
      currentCitationEvents,
      currentPromptDomainTotal,
      currentProfiles.length
    );
    const baselineRankMetrics = rankWeightedMetricsFromCounts(
      baselineRankWeights,
      baselineRankWeightTotal
    );
    const currentRankMetrics = rankWeightedMetricsFromCounts(
      currentRankWeights,
      currentRankWeightTotal
    );
    const unknownSharedPromptGroups =
      context.sharedPromptKeys.length - context.comparablePromptKeys.length;
    const unknownRankWeightedSharedPromptGroups =
      context.sharedPromptKeys.length - context.rankComparablePromptKeys.length;
    const matchedSourceDetailComplete = context.sharedPromptKeys.every(
      (promptKey) =>
        context.beforeMap.get(promptKey)!.detailComplete &&
        context.afterMap.get(promptKey)!.detailComplete
    );
    const comparisonComplete =
      before !== undefined &&
      after !== undefined &&
      before.catalogComplete &&
      after.catalogComplete &&
      context.sharedPromptKeys.length > 0 &&
      matchedSourceDetailComplete;
    const matchedRankWeightedSourceDetailComplete = context.sharedPromptKeys.every(
      (promptKey) =>
        context.beforeMap.get(promptKey)!.rankDetailComplete &&
        context.afterMap.get(promptKey)!.rankDetailComplete
    );
    const rankWeightedComparisonComplete =
      before !== undefined &&
      after !== undefined &&
      before.catalogComplete &&
      after.catalogComplete &&
      context.sharedPromptKeys.length > 0 &&
      matchedRankWeightedSourceDetailComplete;
    const bootstrapComplete = comparisonComplete && context.comparablePromptKeys.length >= 2;
    const intervals = bootstrapComplete
      ? bootstrapPairedIntervals(
          baselineProfiles,
          currentProfiles,
          `${context.providerKey}\\u0000paired-source-diversity`,
          usableBootstrapIterations
        )
      : {
          hhiChange: null,
          effectiveDomainCountChange: null,
          largestDomainShareChange: null,
          meanDomainsPerPromptChange: null,
        };
    const rankWeightedBootstrapComplete =
      rankWeightedComparisonComplete && context.rankComparablePromptKeys.length >= 2;
    const rankWeightedIntervals = rankWeightedBootstrapComplete
      ? bootstrapPairedRankWeightedIntervals(
          baselineRankProfiles,
          currentRankProfiles,
          `${context.providerKey}\\u0000paired-rank-source-diversity`,
          usableBootstrapIterations
        )
      : { hhiChange: null, effectiveDomainCountChange: null, largestDomainShareChange: null };
    const intervalState =
      before === undefined || after === undefined
        ? 'provider-absent-in-period'
        : !before.catalogComplete || !after.catalogComplete
          ? 'prompt-catalog-incomplete'
          : unknownSharedPromptGroups > 0
            ? 'matched-source-detail-incomplete'
            : context.comparablePromptKeys.length < 2
              ? 'insufficient-matched-prompts'
              : usableBootstrapIterations < MIN_BOOTSTRAP_ITERATIONS
                ? 'budget-limited'
                : baselineCitationEvents === 0 || currentCitationEvents === 0
                  ? 'no-citation-events-on-period'
                  : intervals.hhiChange === null
                    ? 'citation-free-bootstrap-draws'
                    : 'available';
    const rankWeightedIntervalState =
      before === undefined || after === undefined
        ? 'provider-absent-in-period'
        : !before.catalogComplete || !after.catalogComplete
          ? 'prompt-catalog-incomplete'
          : unknownRankWeightedSharedPromptGroups > 0
            ? 'matched-rank-weighted-detail-incomplete'
            : context.rankComparablePromptKeys.length < 2
              ? 'insufficient-matched-prompts'
              : usableBootstrapIterations < MIN_BOOTSTRAP_ITERATIONS
                ? 'budget-limited'
                : baselineRankWeightTotal === 0 || currentRankWeightTotal === 0
                  ? 'no-rank-weight-on-period'
                  : rankWeightedIntervals.hhiChange === null
                    ? 'rank-weight-free-bootstrap-draws'
                    : 'available';
    const metricDelta = (
      currentValue: number | null,
      baselineValue: number | null,
      digits: number
    ): number | null =>
      currentValue === null || baselineValue === null
        ? null
        : round(currentValue - baselineValue, digits);
    return {
      row_type: 'provider',
      provider: after?.provider ?? before?.provider ?? context.providerKey,
      baseline_provider_present: before !== undefined,
      current_provider_present: after !== undefined,
      baseline_provider_prompt_groups: before?.allPromptGroups ?? '',
      current_provider_prompt_groups: after?.allPromptGroups ?? '',
      shared_exact_prompt_groups: context.sharedPromptKeys.length,
      comparable_shared_prompt_groups: context.comparablePromptKeys.length,
      unknown_shared_prompt_groups: unknownSharedPromptGroups,
      rank_weighted_comparable_shared_prompt_groups: context.rankComparablePromptKeys.length,
      unknown_rank_weighted_shared_prompt_groups: unknownRankWeightedSharedPromptGroups,
      baseline_matched_prompt_citation_events: baselineCitationEvents,
      current_matched_prompt_citation_events: currentCitationEvents,
      baseline_event_weighted_domain_hhi: baselineMetrics.hhi,
      current_event_weighted_domain_hhi: currentMetrics.hhi,
      hhi_change: metricDelta(currentMetrics.hhi, baselineMetrics.hhi, 6),
      hhi_change_ci95_lower: intervals.hhiChange?.lower ?? null,
      hhi_change_ci95_upper: intervals.hhiChange?.upper ?? null,
      baseline_effective_cited_domain_count: baselineMetrics.effectiveDomainCount,
      current_effective_cited_domain_count: currentMetrics.effectiveDomainCount,
      effective_domain_count_change: metricDelta(
        currentMetrics.effectiveDomainCount,
        baselineMetrics.effectiveDomainCount,
        4
      ),
      effective_domain_count_change_ci95_lower: intervals.effectiveDomainCountChange?.lower ?? null,
      effective_domain_count_change_ci95_upper: intervals.effectiveDomainCountChange?.upper ?? null,
      baseline_largest_domain_event_share_percent: baselineMetrics.largestDomainSharePercent,
      current_largest_domain_event_share_percent: currentMetrics.largestDomainSharePercent,
      largest_domain_share_change_percentage_points: metricDelta(
        currentMetrics.largestDomainSharePercent,
        baselineMetrics.largestDomainSharePercent,
        2
      ),
      largest_domain_share_change_ci95_lower: intervals.largestDomainShareChange?.lower ?? null,
      largest_domain_share_change_ci95_upper: intervals.largestDomainShareChange?.upper ?? null,
      baseline_rank_weighted_domain_hhi: baselineRankMetrics.hhi,
      current_rank_weighted_domain_hhi: currentRankMetrics.hhi,
      rank_weighted_hhi_change: metricDelta(currentRankMetrics.hhi, baselineRankMetrics.hhi, 6),
      rank_weighted_hhi_change_ci95_lower: rankWeightedIntervals.hhiChange?.lower ?? null,
      rank_weighted_hhi_change_ci95_upper: rankWeightedIntervals.hhiChange?.upper ?? null,
      baseline_rank_weighted_effective_domain_count: baselineRankMetrics.effectiveDomainCount,
      current_rank_weighted_effective_domain_count: currentRankMetrics.effectiveDomainCount,
      rank_weighted_effective_domain_count_change: metricDelta(
        currentRankMetrics.effectiveDomainCount,
        baselineRankMetrics.effectiveDomainCount,
        4
      ),
      rank_weighted_effective_domain_count_change_ci95_lower:
        rankWeightedIntervals.effectiveDomainCountChange?.lower ?? null,
      rank_weighted_effective_domain_count_change_ci95_upper:
        rankWeightedIntervals.effectiveDomainCountChange?.upper ?? null,
      baseline_largest_rank_weighted_domain_share_percent:
        baselineRankMetrics.largestDomainSharePercent,
      current_largest_rank_weighted_domain_share_percent:
        currentRankMetrics.largestDomainSharePercent,
      largest_rank_weighted_domain_share_change_percentage_points: metricDelta(
        currentRankMetrics.largestDomainSharePercent,
        baselineRankMetrics.largestDomainSharePercent,
        2
      ),
      largest_rank_weighted_domain_share_change_ci95_lower:
        rankWeightedIntervals.largestDomainShareChange?.lower ?? null,
      largest_rank_weighted_domain_share_change_ci95_upper:
        rankWeightedIntervals.largestDomainShareChange?.upper ?? null,
      baseline_equal_prompt_mean_domains_cited: baselineMetrics.meanDomainsPerPrompt,
      current_equal_prompt_mean_domains_cited: currentMetrics.meanDomainsPerPrompt,
      equal_prompt_mean_domains_cited_change: metricDelta(
        currentMetrics.meanDomainsPerPrompt,
        baselineMetrics.meanDomainsPerPrompt,
        4
      ),
      equal_prompt_mean_domains_cited_change_ci95_lower:
        intervals.meanDomainsPerPromptChange?.lower ?? null,
      equal_prompt_mean_domains_cited_change_ci95_upper:
        intervals.meanDomainsPerPromptChange?.upper ?? null,
      baseline_prompt_catalog_complete: before?.catalogComplete ?? false,
      current_prompt_catalog_complete: after?.catalogComplete ?? false,
      matched_source_detail_complete: matchedSourceDetailComplete,
      matched_rank_weighted_source_detail_complete: matchedRankWeightedSourceDetailComplete,
      rank_weighted_comparison_complete: rankWeightedComparisonComplete,
      comparison_complete: comparisonComplete,
      bootstrap_resamples: usableBootstrapIterations,
      bootstrap_interval_state: intervalState,
      rank_weighted_bootstrap_interval_state: rankWeightedIntervalState,
      output_rows_truncated: outputTruncated,
      interpretation_note: note,
    };
  });
  return `${[summary, ...rows].map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(',')).join('\r\n')}\r\n`;
}
