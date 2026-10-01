import type {
  AiAnswerCitationObservationInput,
  AiAnswerCitationRateDifferenceConfidenceInterval95,
} from './answerCitationObservations';

const MAX_OUTPUT_ROWS = 50_000;
const MAX_PROMPT_PAGE_EVALUATIONS = 5_000_000;
const BOOTSTRAP_ITERATIONS = 1_000;
const MAX_BOOTSTRAP_SAMPLE_DRAWS = 50_000_000;
const MIN_BOOTSTRAP_ITERATIONS_FOR_INTERVAL = 250;
const MAX_CITATIONS_PER_OBSERVATION = 50;

interface PromptPageState {
  observations: number;
  pageUrls: Set<string>;
  topThreePageUrls: Set<string>;
  firstPositionPageUrls: Set<string>;
  detailComplete: boolean;
}

interface ProviderPagePrompts {
  provider: string;
  prompts: Map<string, PromptPageState>;
}

export interface AiAnswerCitationPagePairedReachRow {
  provider: string;
  pageUrl: string;
  baselineProviderPromptGroups: number;
  currentProviderPromptGroups: number;
  sharedPromptGroups: number;
  comparablePromptGroups: number;
  unknownPagePromptGroups: number;
  baselinePresent: number;
  currentPresent: number;
  gained: number;
  lost: number;
  both: number;
  neither: number;
  baselineTopThreePresent: number;
  currentTopThreePresent: number;
  gainedTopThree: number;
  lostTopThree: number;
  topThreeReachChangePercentagePoints: number | null;
  topThreeBootstrapInterval: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  exactTopThreeMcNemarPValue: number | null;
  holmAdjustedTopThreePValue: number | null;
  topThreeComparablePromptGroups: number;
  topThreeUnknownPromptGroups: number;
  baselineFirstPositionPresent: number;
  currentFirstPositionPresent: number;
  gainedFirstPosition: number;
  lostFirstPosition: number;
  firstPositionReachChangePercentagePoints: number | null;
  firstPositionBootstrapInterval: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  exactFirstPositionMcNemarPValue: number | null;
  holmAdjustedFirstPositionPValue: number | null;
  firstPositionComparablePromptGroups: number;
  firstPositionUnknownPromptGroups: number;
  baselineReachPercent: number | null;
  currentReachPercent: number | null;
  reachChangePercentagePoints: number | null;
  bootstrapInterval: AiAnswerCitationRateDifferenceConfidenceInterval95 | null;
  leaveOneOutMinimumPercentagePoints: number | null;
  leaveOneOutMaximumPercentagePoints: number | null;
  exactMcNemarPValue: number | null;
  holmAdjustedPValue: number | null;
  comparisonComplete: boolean;
}

export interface AiAnswerCitationPagePairedReachComparison {
  pageScope: 'all-cited-pages' | 'owned-pages';
  rows: AiAnswerCitationPagePairedReachRow[];
  projectedRows: number;
  projectedPromptPageEvaluations: number;
  familySize: number | null;
  topThreeFamilySize: number | null;
  firstPositionFamilySize: number | null;
  bootstrapResamplesPerTest: number;
  outputRowsTruncated: boolean;
  promptPageEvaluationsTruncated: boolean;
  familyComplete: boolean;
  topThreeFamilyComplete: boolean;
  firstPositionFamilyComplete: boolean;
  note: string;
}

export interface AiAnswerCitationPagePairedReachDropGateFailure {
  provider: string;
  pageUrl: string;
  comparablePromptGroups: number;
  gainedPrompts: number;
  lostPrompts: number;
  reachChangePercentagePoints: number;
  holmAdjustedPValue: number;
}

export interface AiAnswerCitationPagePairedReachDropGateAssessment {
  pageScope: 'all-cited-pages' | 'owned-pages';
  metric: 'citation-reach' | 'top-three-reach' | 'first-position-reach';
  thresholdPercentagePoints: number;
  alpha: number;
  minimumComparablePromptGroups: number;
  holmFamilySize: number | null;
  bootstrapResamplesPerTest: number;
  evaluatedComparisons: number;
  eligibleComparisons: number;
  complete: boolean;
  incompleteReasons: string[];
  exceeded: boolean;
  failures: AiAnswerCitationPagePairedReachDropGateFailure[];
}

export interface AiAnswerCitationPageOpportunityMonthlyRiseGateFailure {
  provider: string;
  previousMonthUtc: string;
  monthUtc: string;
  pageUrl: string;
  comparablePromptGroups: number;
  gainedPrompts: number;
  lostPrompts: number;
  reachChangePercentagePoints: number;
  holmAdjustedPValue: number;
}

export interface AiAnswerCitationPageOpportunityMonthlyRiseGateAssessment {
  metric: 'confirmed-no-owned-exact-page-reach';
  thresholdPercentagePoints: number;
  alpha: number;
  minimumComparablePromptGroups: number;
  evaluatedComparisons: number;
  eligibleComparisons: number;
  holmFamilySize: number | null;
  pairedMonthPromptPageEvaluations: number | null;
  bootstrapResamplesPerTest: number | null;
  complete: boolean;
  incompleteReasons: string[];
  exceeded: boolean;
  failures: AiAnswerCitationPageOpportunityMonthlyRiseGateFailure[];
}

export interface AiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateFailure {
  provider: string;
  previousMonthUtc: string;
  monthUtc: string;
  pathFamily: string;
  comparablePromptGroups: number;
  gainedPrompts: number;
  lostPrompts: number;
  reachChangePercentagePoints: number;
  holmAdjustedPValue: number;
}

export interface AiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateAssessment {
  metric: 'confirmed-no-owned-path-family-reach';
  thresholdPercentagePoints: number;
  alpha: number;
  minimumComparablePromptGroups: number;
  evaluatedComparisons: number;
  eligibleComparisons: number;
  holmFamilySize: number | null;
  pairedPromptFamilyEvaluations: number | null;
  bootstrapResamplesPerTest: number | null;
  complete: boolean;
  incompleteReasons: string[];
  exceeded: boolean;
  failures: AiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateFailure[];
}

function normalizedLabel(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
}

function normalizePageUrl(value: string): string {
  if (value.length > 2_048) throw new Error('Cited page URLs must be at most 2,048 characters.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Cited page URLs must be absolute HTTP(S) URLs.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname
  ) {
    throw new Error('Cited page URLs must be credential-free HTTP(S) URLs.');
  }
  url.hostname = url.hostname.toLowerCase().replace(/\.$/u, '');
  url.search = '';
  url.hash = '';
  return url.href;
}

function normalizeOwnedDomain(value: string): string {
  const candidate = value.trim().replace(/^\.+|\.+$/gu, '');
  if (!candidate || /[\s/@?#]/u.test(candidate))
    throw new Error(`Invalid owned domain "${value}"; use a hostname without a URL path.`);
  let url: URL;
  try {
    url = new URL(`https://${candidate}`);
  } catch {
    throw new Error(`Invalid owned domain "${value}"; use a hostname such as example.com.`);
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.hostname.includes('%')
  ) {
    throw new Error(`Invalid owned domain "${value}"; use a hostname such as example.com.`);
  }
  return url.hostname.toLowerCase().replace(/\.$/u, '');
}

function isOwnedPage(pageUrl: string, ownedDomains: string[]): boolean {
  const hostname = new URL(pageUrl).hostname.toLowerCase().replace(/\.$/u, '');
  return ownedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function buildProviderPromptPages(
  observations: AiAnswerCitationObservationInput[]
): Map<string, ProviderPagePrompts> {
  const providers = new Map<string, ProviderPagePrompts>();
  observations.forEach((observation, index) => {
    if (
      !observation ||
      typeof observation.provider !== 'string' ||
      !observation.provider.trim() ||
      typeof observation.prompt !== 'string' ||
      !observation.prompt.trim() ||
      !Array.isArray(observation.citedUrls) ||
      observation.citedUrls.length > MAX_CITATIONS_PER_OBSERVATION
    ) {
      throw new Error(`Observation ${index + 1} is invalid for page paired-reach analysis.`);
    }
    const providerKey = normalizedLabel(observation.provider);
    const promptKey = normalizedLabel(observation.prompt);
    if (!providerKey || !promptKey)
      throw new Error(`Observation ${index + 1} requires a non-empty provider and prompt.`);
    if (
      observation.citationListComplete !== undefined &&
      typeof observation.citationListComplete !== 'boolean'
    ) {
      throw new Error(`Observation ${index + 1} citationListComplete must be a boolean.`);
    }
    const citationListComplete =
      observation.citationListComplete ??
      observation.citedUrls.length < MAX_CITATIONS_PER_OBSERVATION;
    const provider = providers.get(providerKey) ?? {
      provider: observation.provider,
      prompts: new Map<string, PromptPageState>(),
    };
    const prompt = provider.prompts.get(promptKey) ?? {
      observations: 0,
      pageUrls: new Set<string>(),
      topThreePageUrls: new Set<string>(),
      firstPositionPageUrls: new Set<string>(),
      detailComplete: true,
    };
    prompt.observations += 1;
    prompt.detailComplete = prompt.detailComplete && citationListComplete;
    observation.citedUrls.forEach((rawUrl, position) => {
      const pageUrl = normalizePageUrl(rawUrl);
      prompt.pageUrls.add(pageUrl);
      if (position < 3) prompt.topThreePageUrls.add(pageUrl);
      if (position === 0) prompt.firstPositionPageUrls.add(pageUrl);
    });
    provider.prompts.set(promptKey, prompt);
    providers.set(providerKey, provider);
  });
  return providers;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function exactMcNemarPValue(gained: number, lost: number): number | null {
  const discordant = gained + lost;
  if (discordant === 0) return 1;
  const lowerTail = Math.min(gained, lost);
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

function holmAdjustedPValues(pValues: number[]): number[] {
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

function pairedPromptBootstrapInterval(
  deltas: number[],
  seedText: string,
  iterations: number
): AiAnswerCitationRateDifferenceConfidenceInterval95 | null {
  if (deltas.length < 2 || iterations < MIN_BOOTSTRAP_ITERATIONS_FOR_INTERVAL) return null;
  let seed = 2166136261;
  for (const character of seedText)
    seed = Math.imul(seed ^ character.codePointAt(0)!, 16777619) >>> 0;
  if (seed === 0) seed = 0x6d2b79f5;
  let state = seed;
  const means = new Array<number>(iterations);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let total = 0;
    for (let sample = 0; sample < deltas.length; sample += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      total += deltas[Math.floor((state / 0x1_0000_0000) * deltas.length)]!;
    }
    means[iteration] = (total / deltas.length) * 100;
  }
  means.sort((left, right) => left - right);
  return {
    lowerPercentagePoints: round(means[Math.floor((iterations - 1) * 0.025)]!),
    upperPercentagePoints: round(means[Math.ceil((iterations - 1) * 0.975)]!),
  };
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  const firstNonWhitespace = text.trimStart().charAt(0);
  if (typeof value !== 'number' && firstNonWhitespace && '=+-@'.includes(firstNonWhitespace))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function snakeCaseCsvRecord(value: object): Record<string, unknown> {
  const columnAliases: Record<string, string> = {
    pageShareOfCompleteNoOwnedPromptsPercent: 'share_of_complete_no_owned_prompts_percent',
    providerMonthOpportunityComplete: 'provider_month_opportunity_complete',
    providerOpportunityComplete: 'provider_opportunity_complete',
    providerCountWithPage: 'providers_with_page_count',
    providersWithCompleteSample: 'providers_with_complete_no_owned_sample',
    pageAnswerCaptures: 'answer_captures_with_page',
    pageCitationEvents: 'citation_events',
    pageCount: 'distinct_pages',
    promptSharePercent: 'share_of_complete_no_owned_prompts_percent',
    capturesWithFamily: 'answer_captures_with_family',
    complete: 'provider_opportunity_complete',
    exactMcNemarPValue: 'exact_mcnemar_p_value',
    holmAdjustedMcNemarPValue: 'holm_adjusted_mcnemar_p_value',
  };
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      columnAliases[key] ?? key.replace(/[A-Z]/gu, (character) => `_${character.toLowerCase()}`),
      entry,
    ])
  );
}

/** Compare page citation presence on matched exact provider/prompt groups, keeping truncated lists unknown. */
export function compareAiAnswerCitationPagePairedReach(
  currentObservations: AiAnswerCitationObservationInput[],
  baselineObservations: AiAnswerCitationObservationInput[],
  ownedDomains: string[] = []
): AiAnswerCitationPagePairedReachComparison {
  const currentIndex = buildProviderPromptPages(currentObservations);
  const baselineIndex = buildProviderPromptPages(baselineObservations);
  const providers = new Map<string, string>();
  for (const [key, value] of [...currentIndex, ...baselineIndex])
    providers.set(key, value.provider);
  const pages = new Set<string>();
  for (const source of [currentObservations, baselineObservations]) {
    for (const observation of source)
      for (const rawUrl of observation.citedUrls) pages.add(normalizePageUrl(rawUrl));
  }
  const normalizedOwnedDomains = [...new Set(ownedDomains.map(normalizeOwnedDomain))];
  const pageScope = normalizedOwnedDomains.length > 0 ? 'owned-pages' : 'all-cited-pages';
  const providerRows = [...providers.entries()].sort((left, right) =>
    left[1].localeCompare(right[1])
  );
  const pageRows = [...pages]
    .filter(
      (pageUrl) =>
        normalizedOwnedDomains.length === 0 || isOwnedPage(pageUrl, normalizedOwnedDomains)
    )
    .sort((left, right) => left.localeCompare(right));
  const projectedRows = providerRows.length * pageRows.length;
  const projectedPromptPageEvaluations = providerRows.reduce((sum, [key]) => {
    const before = baselineIndex.get(key)?.prompts ?? new Map<string, PromptPageState>();
    const after = currentIndex.get(key)?.prompts ?? new Map<string, PromptPageState>();
    return (
      sum + [...before.keys()].filter((promptKey) => after.has(promptKey)).length * pageRows.length
    );
  }, 0);
  const outputRowsTruncated = projectedRows > MAX_OUTPUT_ROWS;
  const promptPageEvaluationsTruncated =
    projectedPromptPageEvaluations > MAX_PROMPT_PAGE_EVALUATIONS;
  const note = `${pageScope === 'owned-pages' ? 'Only URLs on the configured owned domains and subdomains are included. ' : 'All exact cited URLs from either sample are included. '}Each normalized exact prompt counts once within a provider after pooling repeated captures. URLs are normalized by dropping query strings and fragments. A cited page is present when any capture in the provider/prompt group listed it; absence is known only when every capture for that group reports a complete citation list. Reach, top-three reach, and first-position reach each use endpoint-specific comparable prompt denominators and separate Holm families. Rows compare only exact prompts present in both samples. Model, surface, locale, topic, intent, and repeated-capture context are pooled and should be held stable for controlled comparisons. Holm correction for an endpoint is available only when every retained page/provider state for that endpoint is known. These manually sampled page citations do not establish engine visibility or causation.`;
  if (outputRowsTruncated || promptPageEvaluationsTruncated) {
    return {
      pageScope,
      rows: [],
      projectedRows,
      projectedPromptPageEvaluations,
      familySize: null,
      topThreeFamilySize: null,
      firstPositionFamilySize: null,
      bootstrapResamplesPerTest: 0,
      outputRowsTruncated,
      promptPageEvaluationsTruncated,
      familyComplete: false,
      topThreeFamilyComplete: false,
      firstPositionFamilyComplete: false,
      note,
    };
  }

  const bootstrapEndpoints = 3;
  const estimatedBootstrapResamples =
    projectedPromptPageEvaluations > 0
      ? Math.min(
          BOOTSTRAP_ITERATIONS,
          Math.floor(
            MAX_BOOTSTRAP_SAMPLE_DRAWS / (projectedPromptPageEvaluations * bootstrapEndpoints)
          )
        )
      : 0;
  const bootstrapResamplesPerTest =
    estimatedBootstrapResamples >= MIN_BOOTSTRAP_ITERATIONS_FOR_INTERVAL
      ? estimatedBootstrapResamples
      : 0;
  const rows: AiAnswerCitationPagePairedReachRow[] = [];
  for (const [providerKey, provider] of providerRows) {
    const beforePrompts =
      baselineIndex.get(providerKey)?.prompts ?? new Map<string, PromptPageState>();
    const afterPrompts =
      currentIndex.get(providerKey)?.prompts ?? new Map<string, PromptPageState>();
    const sharedPromptKeys = [...beforePrompts.keys()]
      .filter((key) => afterPrompts.has(key))
      .sort();
    for (const pageUrl of pageRows) {
      let comparablePromptGroups = 0;
      let unknownPagePromptGroups = 0;
      let baselinePresent = 0;
      let currentPresent = 0;
      let gained = 0;
      let lost = 0;
      let both = 0;
      let neither = 0;
      const deltas: number[] = [];
      let topThreeComparablePromptGroups = 0;
      let topThreeUnknownPromptGroups = 0;
      let baselineTopThreePresent = 0;
      let currentTopThreePresent = 0;
      let gainedTopThree = 0;
      let lostTopThree = 0;
      const topThreeDeltas: number[] = [];
      let firstPositionComparablePromptGroups = 0;
      let firstPositionUnknownPromptGroups = 0;
      let baselineFirstPositionPresent = 0;
      let currentFirstPositionPresent = 0;
      let gainedFirstPosition = 0;
      let lostFirstPosition = 0;
      const firstPositionDeltas: number[] = [];
      for (const promptKey of sharedPromptKeys) {
        const before = beforePrompts.get(promptKey)!;
        const after = afterPrompts.get(promptKey)!;
        const beforeState = before.pageUrls.has(pageUrl)
          ? true
          : before.detailComplete
            ? false
            : null;
        const afterState = after.pageUrls.has(pageUrl) ? true : after.detailComplete ? false : null;
        const beforeTopThreeState = before.topThreePageUrls.has(pageUrl)
          ? true
          : before.detailComplete
            ? false
            : null;
        const afterTopThreeState = after.topThreePageUrls.has(pageUrl)
          ? true
          : after.detailComplete
            ? false
            : null;
        const beforeFirstPositionState = before.firstPositionPageUrls.has(pageUrl)
          ? true
          : before.detailComplete
            ? false
            : null;
        const afterFirstPositionState = after.firstPositionPageUrls.has(pageUrl)
          ? true
          : after.detailComplete
            ? false
            : null;
        if (beforeState === null || afterState === null) {
          unknownPagePromptGroups += 1;
        } else {
          comparablePromptGroups += 1;
          if (beforeState) baselinePresent += 1;
          if (afterState) currentPresent += 1;
          if (!beforeState && afterState) gained += 1;
          else if (beforeState && !afterState) lost += 1;
          else if (beforeState) both += 1;
          else neither += 1;
          deltas.push(Number(afterState) - Number(beforeState));
        }
        if (beforeTopThreeState === null || afterTopThreeState === null) {
          topThreeUnknownPromptGroups += 1;
        } else {
          topThreeComparablePromptGroups += 1;
          if (beforeTopThreeState) baselineTopThreePresent += 1;
          if (afterTopThreeState) currentTopThreePresent += 1;
          if (!beforeTopThreeState && afterTopThreeState) gainedTopThree += 1;
          else if (beforeTopThreeState && !afterTopThreeState) lostTopThree += 1;
          topThreeDeltas.push(Number(afterTopThreeState) - Number(beforeTopThreeState));
        }
        if (beforeFirstPositionState === null || afterFirstPositionState === null) {
          firstPositionUnknownPromptGroups += 1;
        } else {
          firstPositionComparablePromptGroups += 1;
          if (beforeFirstPositionState) baselineFirstPositionPresent += 1;
          if (afterFirstPositionState) currentFirstPositionPresent += 1;
          if (!beforeFirstPositionState && afterFirstPositionState) gainedFirstPosition += 1;
          else if (beforeFirstPositionState && !afterFirstPositionState) lostFirstPosition += 1;
          firstPositionDeltas.push(
            Number(afterFirstPositionState) - Number(beforeFirstPositionState)
          );
        }
      }
      const baselineReachPercent =
        comparablePromptGroups > 0 ? round((baselinePresent / comparablePromptGroups) * 100) : null;
      const currentReachPercent =
        comparablePromptGroups > 0 ? round((currentPresent / comparablePromptGroups) * 100) : null;
      const reachChangePercentagePoints =
        comparablePromptGroups > 0 ? round(((gained - lost) / comparablePromptGroups) * 100) : null;
      const topThreeReachChangePercentagePoints =
        topThreeComparablePromptGroups > 0
          ? round(((gainedTopThree - lostTopThree) / topThreeComparablePromptGroups) * 100)
          : null;
      const firstPositionReachChangePercentagePoints =
        firstPositionComparablePromptGroups > 0
          ? round(
              ((gainedFirstPosition - lostFirstPosition) / firstPositionComparablePromptGroups) *
                100
            )
          : null;
      let leaveOneOutMinimumPercentagePoints: number | null = null;
      let leaveOneOutMaximumPercentagePoints: number | null = null;
      if (deltas.length >= 2) {
        const total = deltas.reduce((sum, delta) => sum + delta, 0);
        const leaveOneOut = deltas.map((delta) => ((total - delta) / (deltas.length - 1)) * 100);
        leaveOneOutMinimumPercentagePoints = round(Math.min(...leaveOneOut));
        leaveOneOutMaximumPercentagePoints = round(Math.max(...leaveOneOut));
      }
      rows.push({
        provider,
        pageUrl,
        baselineProviderPromptGroups: beforePrompts.size,
        currentProviderPromptGroups: afterPrompts.size,
        sharedPromptGroups: sharedPromptKeys.length,
        comparablePromptGroups,
        unknownPagePromptGroups,
        baselinePresent,
        currentPresent,
        gained,
        lost,
        both,
        neither,
        baselineTopThreePresent,
        currentTopThreePresent,
        gainedTopThree,
        lostTopThree,
        topThreeReachChangePercentagePoints,
        topThreeBootstrapInterval: pairedPromptBootstrapInterval(
          topThreeDeltas,
          `${providerKey}\u0000${pageUrl}\u0000paired-page-top-three`,
          bootstrapResamplesPerTest
        ),
        exactTopThreeMcNemarPValue:
          topThreeComparablePromptGroups > 0
            ? exactMcNemarPValue(gainedTopThree, lostTopThree)
            : null,
        holmAdjustedTopThreePValue: null,
        topThreeComparablePromptGroups,
        topThreeUnknownPromptGroups,
        baselineFirstPositionPresent,
        currentFirstPositionPresent,
        gainedFirstPosition,
        lostFirstPosition,
        firstPositionReachChangePercentagePoints,
        firstPositionBootstrapInterval: pairedPromptBootstrapInterval(
          firstPositionDeltas,
          `${providerKey}\u0000${pageUrl}\u0000paired-page-first-position`,
          bootstrapResamplesPerTest
        ),
        exactFirstPositionMcNemarPValue:
          firstPositionComparablePromptGroups > 0
            ? exactMcNemarPValue(gainedFirstPosition, lostFirstPosition)
            : null,
        holmAdjustedFirstPositionPValue: null,
        firstPositionComparablePromptGroups,
        firstPositionUnknownPromptGroups,
        baselineReachPercent,
        currentReachPercent,
        reachChangePercentagePoints,
        bootstrapInterval: pairedPromptBootstrapInterval(
          deltas,
          `${providerKey}\u0000${pageUrl}\u0000paired-page-reach`,
          bootstrapResamplesPerTest
        ),
        leaveOneOutMinimumPercentagePoints,
        leaveOneOutMaximumPercentagePoints,
        exactMcNemarPValue: comparablePromptGroups > 0 ? exactMcNemarPValue(gained, lost) : null,
        holmAdjustedPValue: null,
        comparisonComplete: unknownPagePromptGroups === 0,
      });
    }
  }
  const familyComplete = rows.every((row) => row.unknownPagePromptGroups === 0);
  const topThreeFamilyComplete = rows.every((row) => row.topThreeUnknownPromptGroups === 0);
  const firstPositionFamilyComplete = rows.every(
    (row) => row.firstPositionUnknownPromptGroups === 0
  );
  const testableRows = rows.filter((row) => row.exactMcNemarPValue !== null);
  const topThreeTestableRows = rows.filter((row) => row.exactTopThreeMcNemarPValue !== null);
  const firstPositionTestableRows = rows.filter(
    (row) => row.exactFirstPositionMcNemarPValue !== null
  );
  if (familyComplete && testableRows.length > 0) {
    const adjusted = holmAdjustedPValues(testableRows.map((row) => row.exactMcNemarPValue!));
    testableRows.forEach((row, index) => {
      row.holmAdjustedPValue = adjusted[index]!;
    });
  }
  if (topThreeFamilyComplete && topThreeTestableRows.length > 0) {
    const adjusted = holmAdjustedPValues(
      topThreeTestableRows.map((row) => row.exactTopThreeMcNemarPValue!)
    );
    topThreeTestableRows.forEach((row, index) => {
      row.holmAdjustedTopThreePValue = adjusted[index]!;
    });
  }
  if (firstPositionFamilyComplete && firstPositionTestableRows.length > 0) {
    const adjusted = holmAdjustedPValues(
      firstPositionTestableRows.map((row) => row.exactFirstPositionMcNemarPValue!)
    );
    firstPositionTestableRows.forEach((row, index) => {
      row.holmAdjustedFirstPositionPValue = adjusted[index]!;
    });
  }
  return {
    pageScope,
    rows,
    projectedRows,
    projectedPromptPageEvaluations,
    familySize: familyComplete ? testableRows.length : null,
    topThreeFamilySize: topThreeFamilyComplete ? topThreeTestableRows.length : null,
    firstPositionFamilySize: firstPositionFamilyComplete ? firstPositionTestableRows.length : null,
    bootstrapResamplesPerTest,
    outputRowsTruncated: false,
    promptPageEvaluationsTruncated: false,
    familyComplete,
    topThreeFamilyComplete,
    firstPositionFamilyComplete,
    note,
  };
}

export function renderAiAnswerCitationPagePairedReachComparisonCsv(
  comparison: AiAnswerCitationPagePairedReachComparison
): string {
  const headers = [
    'row_type',
    'page_scope',
    'provider',
    'page_url',
    'baseline_provider_prompt_groups',
    'current_provider_prompt_groups',
    'shared_exact_prompt_groups',
    'comparable_prompt_groups',
    'unknown_page_prompt_groups',
    'baseline_present_prompts',
    'current_present_prompts',
    'gained_prompts',
    'lost_prompts',
    'present_both_periods',
    'absent_both_periods',
    'baseline_reach_percent',
    'current_reach_percent',
    'reach_change_percentage_points',
    'paired_prompt_bootstrap_ci95_lower_pp',
    'paired_prompt_bootstrap_ci95_upper_pp',
    'leave_one_prompt_out_minimum_change_pp',
    'leave_one_prompt_out_maximum_change_pp',
    'exact_two_sided_mcnemar_p_value',
    'holm_adjusted_mcnemar_p_value',
    'holm_family_size',
    'top_three_comparable_prompt_groups',
    'top_three_unknown_prompt_groups',
    'baseline_top_three_prompts',
    'current_top_three_prompts',
    'gained_top_three_prompts',
    'lost_top_three_prompts',
    'top_three_reach_change_percentage_points',
    'top_three_bootstrap_ci95_lower_pp',
    'top_three_bootstrap_ci95_upper_pp',
    'exact_top_three_mcnemar_p_value',
    'holm_adjusted_top_three_mcnemar_p_value',
    'top_three_holm_family_size',
    'first_position_comparable_prompt_groups',
    'first_position_unknown_prompt_groups',
    'baseline_first_position_prompts',
    'current_first_position_prompts',
    'gained_first_position_prompts',
    'lost_first_position_prompts',
    'first_position_reach_change_percentage_points',
    'first_position_bootstrap_ci95_lower_pp',
    'first_position_bootstrap_ci95_upper_pp',
    'exact_first_position_mcnemar_p_value',
    'holm_adjusted_first_position_mcnemar_p_value',
    'first_position_holm_family_size',
    'paired_prompt_bootstrap_resamples',
    'comparison_complete',
    'holm_family_complete',
    'top_three_holm_family_complete',
    'first_position_holm_family_complete',
    'projected_rows',
    'projected_prompt_page_evaluations',
    'output_rows_truncated',
    'prompt_page_evaluations_truncated',
    'interpretation_note',
  ];
  const summaryRow: Record<string, unknown> = {
    row_type: 'summary',
    page_scope: comparison.pageScope,
    holm_family_size: comparison.familySize,
    top_three_holm_family_size: comparison.topThreeFamilySize,
    first_position_holm_family_size: comparison.firstPositionFamilySize,
    paired_prompt_bootstrap_resamples: comparison.bootstrapResamplesPerTest,
    comparison_complete: false,
    holm_family_complete: comparison.familyComplete,
    top_three_holm_family_complete: comparison.topThreeFamilyComplete,
    first_position_holm_family_complete: comparison.firstPositionFamilyComplete,
    projected_rows: comparison.projectedRows,
    projected_prompt_page_evaluations: comparison.projectedPromptPageEvaluations,
    output_rows_truncated: comparison.outputRowsTruncated,
    prompt_page_evaluations_truncated: comparison.promptPageEvaluationsTruncated,
    interpretation_note: comparison.note,
  };
  const dataRows = comparison.rows.map((row): Record<string, unknown> => ({
    row_type: 'page-provider',
    page_scope: comparison.pageScope,
    provider: row.provider,
    page_url: row.pageUrl,
    baseline_provider_prompt_groups: row.baselineProviderPromptGroups,
    current_provider_prompt_groups: row.currentProviderPromptGroups,
    shared_exact_prompt_groups: row.sharedPromptGroups,
    comparable_prompt_groups: row.comparablePromptGroups,
    unknown_page_prompt_groups: row.unknownPagePromptGroups,
    baseline_present_prompts: row.baselinePresent,
    current_present_prompts: row.currentPresent,
    gained_prompts: row.gained,
    lost_prompts: row.lost,
    present_both_periods: row.both,
    absent_both_periods: row.neither,
    baseline_reach_percent: row.baselineReachPercent,
    current_reach_percent: row.currentReachPercent,
    reach_change_percentage_points: row.reachChangePercentagePoints,
    paired_prompt_bootstrap_ci95_lower_pp: row.bootstrapInterval?.lowerPercentagePoints ?? null,
    paired_prompt_bootstrap_ci95_upper_pp: row.bootstrapInterval?.upperPercentagePoints ?? null,
    leave_one_prompt_out_minimum_change_pp: row.leaveOneOutMinimumPercentagePoints,
    leave_one_prompt_out_maximum_change_pp: row.leaveOneOutMaximumPercentagePoints,
    exact_two_sided_mcnemar_p_value: row.exactMcNemarPValue,
    holm_adjusted_mcnemar_p_value: row.holmAdjustedPValue,
    holm_family_size: comparison.familySize,
    top_three_comparable_prompt_groups: row.topThreeComparablePromptGroups,
    top_three_unknown_prompt_groups: row.topThreeUnknownPromptGroups,
    baseline_top_three_prompts: row.baselineTopThreePresent,
    current_top_three_prompts: row.currentTopThreePresent,
    gained_top_three_prompts: row.gainedTopThree,
    lost_top_three_prompts: row.lostTopThree,
    top_three_reach_change_percentage_points: row.topThreeReachChangePercentagePoints,
    top_three_bootstrap_ci95_lower_pp: row.topThreeBootstrapInterval?.lowerPercentagePoints ?? null,
    top_three_bootstrap_ci95_upper_pp: row.topThreeBootstrapInterval?.upperPercentagePoints ?? null,
    exact_top_three_mcnemar_p_value: row.exactTopThreeMcNemarPValue,
    holm_adjusted_top_three_mcnemar_p_value: row.holmAdjustedTopThreePValue,
    top_three_holm_family_size: comparison.topThreeFamilySize,
    first_position_comparable_prompt_groups: row.firstPositionComparablePromptGroups,
    first_position_unknown_prompt_groups: row.firstPositionUnknownPromptGroups,
    baseline_first_position_prompts: row.baselineFirstPositionPresent,
    current_first_position_prompts: row.currentFirstPositionPresent,
    gained_first_position_prompts: row.gainedFirstPosition,
    lost_first_position_prompts: row.lostFirstPosition,
    first_position_reach_change_percentage_points: row.firstPositionReachChangePercentagePoints,
    first_position_bootstrap_ci95_lower_pp:
      row.firstPositionBootstrapInterval?.lowerPercentagePoints ?? null,
    first_position_bootstrap_ci95_upper_pp:
      row.firstPositionBootstrapInterval?.upperPercentagePoints ?? null,
    exact_first_position_mcnemar_p_value: row.exactFirstPositionMcNemarPValue,
    holm_adjusted_first_position_mcnemar_p_value: row.holmAdjustedFirstPositionPValue,
    first_position_holm_family_size: comparison.firstPositionFamilySize,
    paired_prompt_bootstrap_resamples: comparison.bootstrapResamplesPerTest,
    comparison_complete: row.comparisonComplete,
    holm_family_complete: comparison.familyComplete,
    top_three_holm_family_complete: comparison.topThreeFamilyComplete,
    first_position_holm_family_complete: comparison.firstPositionFamilyComplete,
    projected_rows: comparison.projectedRows,
    projected_prompt_page_evaluations: comparison.projectedPromptPageEvaluations,
    output_rows_truncated: comparison.outputRowsTruncated,
    prompt_page_evaluations_truncated: comparison.promptPageEvaluationsTruncated,
    interpretation_note: comparison.note,
  }));
  return `${[summaryRow, ...dataRows].map((row) => headers.map((header) => csvCell(row[header])).join(',')).join('\r\n')}\r\n`;
}

/** Render the bounded paired page reach comparison as typed, versioned JSON. */
export function renderAiAnswerCitationPagePairedReachComparisonJson(
  comparison: AiAnswerCitationPagePairedReachComparison
): string {
  const csv = renderAiAnswerCitationPagePairedReachComparisonCsv(comparison);
  const records: string[][] = [];
  let record: string[] = [];
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
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n') {
      record.push(field.replace(/\r$/u, ''));
      records.push(record);
      record = [];
      field = '';
    } else field += character;
  }
  const headers = [
    'row_type',
    'page_scope',
    'provider',
    'page_url',
    'baseline_provider_prompt_groups',
    'current_provider_prompt_groups',
    'shared_exact_prompt_groups',
    'comparable_prompt_groups',
    'unknown_page_prompt_groups',
    'baseline_present_prompts',
    'current_present_prompts',
    'gained_prompts',
    'lost_prompts',
    'present_both_periods',
    'absent_both_periods',
    'baseline_reach_percent',
    'current_reach_percent',
    'reach_change_percentage_points',
    'paired_prompt_bootstrap_ci95_lower_pp',
    'paired_prompt_bootstrap_ci95_upper_pp',
    'leave_one_prompt_out_minimum_change_pp',
    'leave_one_prompt_out_maximum_change_pp',
    'exact_two_sided_mcnemar_p_value',
    'holm_adjusted_mcnemar_p_value',
    'holm_family_size',
    'top_three_comparable_prompt_groups',
    'top_three_unknown_prompt_groups',
    'baseline_top_three_prompts',
    'current_top_three_prompts',
    'gained_top_three_prompts',
    'lost_top_three_prompts',
    'top_three_reach_change_percentage_points',
    'top_three_bootstrap_ci95_lower_pp',
    'top_three_bootstrap_ci95_upper_pp',
    'exact_top_three_mcnemar_p_value',
    'holm_adjusted_top_three_mcnemar_p_value',
    'top_three_holm_family_size',
    'first_position_comparable_prompt_groups',
    'first_position_unknown_prompt_groups',
    'baseline_first_position_prompts',
    'current_first_position_prompts',
    'gained_first_position_prompts',
    'lost_first_position_prompts',
    'first_position_reach_change_percentage_points',
    'first_position_bootstrap_ci95_lower_pp',
    'first_position_bootstrap_ci95_upper_pp',
    'exact_first_position_mcnemar_p_value',
    'holm_adjusted_first_position_mcnemar_p_value',
    'first_position_holm_family_size',
    'paired_prompt_bootstrap_resamples',
    'comparison_complete',
    'holm_family_complete',
    'top_three_holm_family_complete',
    'first_position_holm_family_complete',
    'projected_rows',
    'projected_prompt_page_evaluations',
    'output_rows_truncated',
    'prompt_page_evaluations_truncated',
    'interpretation_note',
  ];
  const rows = records
    .filter((row) => row.length > 1)
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => {
          const raw = row[index] ?? '';
          if (raw === '') return [header, null];
          if (raw === 'true' || raw === 'false') return [header, raw === 'true'];
          if (
            /(_groups|_prompts|_pp|_percent|_p_value|_family_size)$|^projected_|^paired_prompt_bootstrap_resamples$/u.test(
              header
            )
          ) {
            const number = Number(raw);
            if (Number.isFinite(number)) return [header, number];
          }
          return [header, raw];
        })
      )
    );
  const pageRows = rows.filter((row) => row.row_type === 'page-provider');
  comparison.rows.forEach((row, index) => {
    const record = pageRows[index];
    if (record) {
      record.provider = row.provider;
      record.page_url = row.pageUrl;
    }
  });
  return `${JSON.stringify(
    {
      source: 'Aviary paired answer citation page reach comparison',
      schemaVersion: 1,
      pageScope: comparison.pageScope,
      summary: rows.find((row) => row.row_type === 'summary') ?? null,
      rows: rows.filter((row) => row.row_type === 'page-provider'),
    },
    null,
    2
  )}\n`;
}

/** Assess one exact-page reach endpoint with CLI-aligned threshold and support bounds. */
export function assessAiAnswerCitationPagePairedReachDropGate(
  comparison: AiAnswerCitationPagePairedReachComparison,
  thresholdPercentagePoints: number,
  alpha = 0.05,
  minimumComparablePromptGroups = 10,
  metric: AiAnswerCitationPagePairedReachDropGateAssessment['metric'] = 'citation-reach'
): AiAnswerCitationPagePairedReachDropGateAssessment {
  if (
    !Number.isFinite(thresholdPercentagePoints) ||
    thresholdPercentagePoints < 0 ||
    thresholdPercentagePoints > 100
  ) {
    throw new Error(
      'Page paired-reach drop threshold must be between 0 and 100 percentage points.'
    );
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
    throw new Error('Page paired-reach alpha must be greater than 0 and at most 1.');
  }
  if (
    !Number.isInteger(minimumComparablePromptGroups) ||
    minimumComparablePromptGroups < 2 ||
    minimumComparablePromptGroups > 100_000
  ) {
    throw new Error(
      'Page paired-reach minimum comparable prompts must be an integer from 2 to 100000.'
    );
  }
  if (!['citation-reach', 'top-three-reach', 'first-position-reach'].includes(metric)) {
    throw new Error(
      'Page paired-reach metric must be citation-reach, top-three-reach, or first-position-reach.'
    );
  }
  const endpoint = (
    row: AiAnswerCitationPagePairedReachRow
  ): {
    comparablePromptGroups: number;
    unknownPromptGroups: number;
    gainedPrompts: number;
    lostPrompts: number;
    adjustedPValue: number | null;
  } => {
    if (metric === 'top-three-reach')
      return {
        comparablePromptGroups: row.topThreeComparablePromptGroups,
        unknownPromptGroups: row.topThreeUnknownPromptGroups,
        gainedPrompts: row.gainedTopThree,
        lostPrompts: row.lostTopThree,
        adjustedPValue: row.holmAdjustedTopThreePValue,
      };
    if (metric === 'first-position-reach')
      return {
        comparablePromptGroups: row.firstPositionComparablePromptGroups,
        unknownPromptGroups: row.firstPositionUnknownPromptGroups,
        gainedPrompts: row.gainedFirstPosition,
        lostPrompts: row.lostFirstPosition,
        adjustedPValue: row.holmAdjustedFirstPositionPValue,
      };
    return {
      comparablePromptGroups: row.comparablePromptGroups,
      unknownPromptGroups: row.unknownPagePromptGroups,
      gainedPrompts: row.gained,
      lostPrompts: row.lost,
      adjustedPValue: row.holmAdjustedPValue,
    };
  };
  const familyComplete =
    metric === 'top-three-reach'
      ? comparison.topThreeFamilyComplete
      : metric === 'first-position-reach'
        ? comparison.firstPositionFamilyComplete
        : comparison.familyComplete;
  const familySize =
    metric === 'top-three-reach'
      ? comparison.topThreeFamilySize
      : metric === 'first-position-reach'
        ? comparison.firstPositionFamilySize
        : comparison.familySize;
  const incompleteReasons: string[] = [];
  if (!familyComplete)
    incompleteReasons.push(
      `one or more ${metric} page/provider states are unknown or the Holm family was capped`
    );
  if (comparison.outputRowsTruncated) incompleteReasons.push('comparison row cap was exceeded');
  if (comparison.promptPageEvaluationsTruncated)
    incompleteReasons.push('prompt/page evaluation cap was exceeded');
  const eligibleRows = comparison.rows.filter((row) => {
    const selected = endpoint(row);
    return (
      selected.unknownPromptGroups === 0 &&
      selected.comparablePromptGroups >= minimumComparablePromptGroups &&
      selected.adjustedPValue !== null
    );
  });
  if (eligibleRows.length === 0)
    incompleteReasons.push(
      `no complete page/provider comparison meets the ${minimumComparablePromptGroups}-prompt support floor`
    );
  const failures = eligibleRows.flatMap((row): AiAnswerCitationPagePairedReachDropGateFailure[] => {
    const selected = endpoint(row);
    const change =
      selected.comparablePromptGroups > 0
        ? ((selected.gainedPrompts - selected.lostPrompts) / selected.comparablePromptGroups) * 100
        : null;
    const adjusted = selected.adjustedPValue;
    if (
      change === null ||
      adjusted === null ||
      change >= 0 ||
      -change < thresholdPercentagePoints ||
      adjusted > alpha
    )
      return [];
    return [
      {
        provider: row.provider,
        pageUrl: row.pageUrl,
        comparablePromptGroups: selected.comparablePromptGroups,
        gainedPrompts: selected.gainedPrompts,
        lostPrompts: selected.lostPrompts,
        reachChangePercentagePoints: round(change),
        holmAdjustedPValue: adjusted,
      },
    ];
  });
  return {
    pageScope: comparison.pageScope,
    metric,
    thresholdPercentagePoints,
    alpha,
    minimumComparablePromptGroups,
    holmFamilySize: familySize,
    bootstrapResamplesPerTest: comparison.bootstrapResamplesPerTest,
    evaluatedComparisons: comparison.rows.length,
    eligibleComparisons: eligibleRows.length,
    complete: incompleteReasons.length === 0,
    incompleteReasons,
    exceeded: failures.length > 0,
    failures,
  };
}

export function renderAiAnswerCitationPagePairedReachDropGateJson(
  assessment: AiAnswerCitationPagePairedReachDropGateAssessment
): string {
  return `${JSON.stringify(
    {
      source: 'Aviary page paired-reach drop gate assessment',
      schemaVersion: 1,
      ...assessment,
    },
    null,
    2
  )}\n`;
}

interface PageOpportunityCitationProfile {
  citationEvents: number;
  answerCaptures: number;
  topThreeCitationEvents: number;
  firstPositionCitationEvents: number;
  appearedInTopThree: boolean;
  appearedFirst: boolean;
  firstCitedAt: number;
  lastCitedAt: number;
}

interface PageOpportunityPromptGroup {
  provider: string;
  snapshots: number;
  detailComplete: boolean;
  ownedCitationPresent: boolean;
  pages: Map<string, PageOpportunityCitationProfile>;
}

interface ProviderPageOpportunityAggregate {
  provider: string;
  providerPromptGroups: number;
  completeNoOwnedPromptGroups: number;
  unknownNoOwnedPromptGroups: number;
  pages: Map<
    string,
    {
      promptGroups: number;
      citationEvents: number;
      answerCaptures: number;
      topThreePromptGroups: number;
      firstPositionPromptGroups: number;
      topThreeCitationEvents: number;
      firstPositionCitationEvents: number;
      firstCitedAt: number;
      lastCitedAt: number;
    }
  >;
}

/** List exact third-party pages cited when owned citation absence is known on the provider/prompt group. */
export function renderAiAnswerCitationPageOpportunitiesCsv(
  observations: AiAnswerCitationObservationInput[],
  ownedDomains: string[]
): string {
  if (ownedDomains.length === 0)
    throw new Error('Page citation opportunities require at least one owned domain.');
  const normalizedOwnedDomains = [...new Set(ownedDomains.map(normalizeOwnedDomain))];
  const groups = new Map<string, PageOpportunityPromptGroup>();
  for (const [index, observation] of observations.entries()) {
    if (
      !observation ||
      typeof observation.provider !== 'string' ||
      !observation.provider.trim() ||
      typeof observation.prompt !== 'string' ||
      !observation.prompt.trim() ||
      !Array.isArray(observation.citedUrls) ||
      observation.citedUrls.length > MAX_CITATIONS_PER_OBSERVATION
    ) {
      throw new Error(`Observation ${index + 1} is invalid for page-opportunity analysis.`);
    }
    if (
      observation.citationListComplete !== undefined &&
      typeof observation.citationListComplete !== 'boolean'
    ) {
      throw new Error(`Observation ${index + 1} citationListComplete must be a boolean.`);
    }
    const providerKey = normalizedLabel(observation.provider);
    const promptKey = normalizedLabel(observation.prompt);
    if (!providerKey || !promptKey)
      throw new Error(`Observation ${index + 1} requires a non-empty provider and prompt.`);
    const key = JSON.stringify([providerKey, promptKey]);
    const group = groups.get(key) ?? {
      provider: observation.provider,
      snapshots: 0,
      detailComplete: true,
      ownedCitationPresent: false,
      pages: new Map<string, PageOpportunityCitationProfile>(),
    };
    const citationListComplete =
      observation.citationListComplete ??
      observation.citedUrls.length < MAX_CITATIONS_PER_OBSERVATION;
    group.snapshots += 1;
    group.detailComplete = group.detailComplete && citationListComplete;
    const observedTime = Date.parse(observation.observedAt);
    if (!Number.isFinite(observedTime))
      throw new Error(`Observation ${index + 1} has an invalid observedAt value.`);
    const seen = new Set<string>();
    observation.citedUrls.forEach((rawUrl, position) => {
      const pageUrl = normalizePageUrl(rawUrl);
      if (seen.has(pageUrl)) return;
      seen.add(pageUrl);
      const hostname = new URL(pageUrl).hostname.toLowerCase().replace(/\.$/u, '');
      if (
        normalizedOwnedDomains.some(
          (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
        )
      ) {
        group.ownedCitationPresent = true;
      }
      const page = group.pages.get(pageUrl) ?? {
        citationEvents: 0,
        answerCaptures: 0,
        topThreeCitationEvents: 0,
        firstPositionCitationEvents: 0,
        appearedInTopThree: false,
        appearedFirst: false,
        firstCitedAt: observedTime,
        lastCitedAt: observedTime,
      };
      page.citationEvents += 1;
      page.answerCaptures += 1;
      if (position < 3) {
        page.topThreeCitationEvents += 1;
        page.appearedInTopThree = true;
      }
      if (position === 0) {
        page.firstPositionCitationEvents += 1;
        page.appearedFirst = true;
      }
      page.firstCitedAt = Math.min(page.firstCitedAt, observedTime);
      page.lastCitedAt = Math.max(page.lastCitedAt, observedTime);
      group.pages.set(pageUrl, page);
    });
    groups.set(key, group);
  }

  const providers = new Map<string, ProviderPageOpportunityAggregate>();
  for (const group of groups.values()) {
    const providerKey = normalizedLabel(group.provider);
    const provider = providers.get(providerKey) ?? {
      provider: group.provider,
      providerPromptGroups: 0,
      completeNoOwnedPromptGroups: 0,
      unknownNoOwnedPromptGroups: 0,
      pages: new Map(),
    };
    provider.providerPromptGroups += 1;
    if (group.ownedCitationPresent) {
      providers.set(providerKey, provider);
      continue;
    }
    if (!group.detailComplete) {
      provider.unknownNoOwnedPromptGroups += 1;
      providers.set(providerKey, provider);
      continue;
    }
    provider.completeNoOwnedPromptGroups += 1;
    for (const [pageUrl, page] of group.pages) {
      if (isOwnedPage(pageUrl, normalizedOwnedDomains)) continue;
      const aggregate = provider.pages.get(pageUrl) ?? {
        promptGroups: 0,
        citationEvents: 0,
        answerCaptures: 0,
        topThreePromptGroups: 0,
        firstPositionPromptGroups: 0,
        topThreeCitationEvents: 0,
        firstPositionCitationEvents: 0,
        firstCitedAt: page.firstCitedAt,
        lastCitedAt: page.lastCitedAt,
      };
      aggregate.promptGroups += 1;
      aggregate.citationEvents += page.citationEvents;
      aggregate.answerCaptures += page.answerCaptures;
      if (page.appearedInTopThree) aggregate.topThreePromptGroups += 1;
      if (page.appearedFirst) aggregate.firstPositionPromptGroups += 1;
      aggregate.topThreeCitationEvents += page.topThreeCitationEvents;
      aggregate.firstPositionCitationEvents += page.firstPositionCitationEvents;
      aggregate.firstCitedAt = Math.min(aggregate.firstCitedAt, page.firstCitedAt);
      aggregate.lastCitedAt = Math.max(aggregate.lastCitedAt, page.lastCitedAt);
      provider.pages.set(pageUrl, aggregate);
    }
    providers.set(providerKey, provider);
  }

  const rows: Array<{
    provider: string;
    providerPromptGroups: number;
    completeNoOwnedPromptGroups: number;
    unknownNoOwnedPromptGroups: number;
    pageUrl: string;
    pagePromptGroups: number;
    pageShareOfCompleteNoOwnedPromptsPercent: number | null;
    pageAnswerCaptures: number;
    pageCitationEvents: number;
    topThreePromptGroups: number;
    firstPositionPromptGroups: number;
    topThreeCitationEvents: number;
    firstPositionCitationEvents: number;
    firstCitedAt: string;
    lastCitedAt: string;
    complete: boolean;
  }> = [];
  for (const provider of providers.values()) {
    for (const [pageUrl, page] of provider.pages) {
      rows.push({
        provider: provider.provider,
        providerPromptGroups: provider.providerPromptGroups,
        completeNoOwnedPromptGroups: provider.completeNoOwnedPromptGroups,
        unknownNoOwnedPromptGroups: provider.unknownNoOwnedPromptGroups,
        pageUrl,
        pagePromptGroups: page.promptGroups,
        pageShareOfCompleteNoOwnedPromptsPercent:
          provider.completeNoOwnedPromptGroups > 0
            ? round((page.promptGroups / provider.completeNoOwnedPromptGroups) * 100)
            : null,
        pageAnswerCaptures: page.answerCaptures,
        pageCitationEvents: page.citationEvents,
        topThreePromptGroups: page.topThreePromptGroups,
        firstPositionPromptGroups: page.firstPositionPromptGroups,
        topThreeCitationEvents: page.topThreeCitationEvents,
        firstPositionCitationEvents: page.firstPositionCitationEvents,
        firstCitedAt: new Date(page.firstCitedAt).toISOString(),
        lastCitedAt: new Date(page.lastCitedAt).toISOString(),
        complete: provider.unknownNoOwnedPromptGroups === 0,
      });
    }
  }
  rows.sort(
    (left, right) =>
      right.pagePromptGroups - left.pagePromptGroups ||
      left.provider.localeCompare(right.provider) ||
      left.pageUrl.localeCompare(right.pageUrl)
  );

  const providersWithCompleteSamples = [...providers.values()].filter(
    (provider) => provider.completeNoOwnedPromptGroups > 0
  );
  const opportunityComplete = [...providers.values()].every(
    (provider) => provider.unknownNoOwnedPromptGroups === 0
  );
  const portfolioPages = new Map<
    string,
    {
      providerCountWithPage: number;
      providersWithPage: string[];
      providerPromptGroupsWithPageTotal: number;
      topThreePromptGroupsTotal: number;
      firstPositionPromptGroupsTotal: number;
      answerCapturesWithPageTotal: number;
      citationEventsTotal: number;
      firstCitedAt: number;
      lastCitedAt: number;
    }
  >();
  for (const provider of providersWithCompleteSamples) {
    for (const [pageUrl, page] of provider.pages) {
      const aggregate = portfolioPages.get(pageUrl) ?? {
        providerCountWithPage: 0,
        providersWithPage: [],
        providerPromptGroupsWithPageTotal: 0,
        topThreePromptGroupsTotal: 0,
        firstPositionPromptGroupsTotal: 0,
        answerCapturesWithPageTotal: 0,
        citationEventsTotal: 0,
        firstCitedAt: page.firstCitedAt,
        lastCitedAt: page.lastCitedAt,
      };
      aggregate.providerCountWithPage += 1;
      aggregate.providersWithPage.push(provider.provider);
      aggregate.providerPromptGroupsWithPageTotal += page.promptGroups;
      aggregate.topThreePromptGroupsTotal += page.topThreePromptGroups;
      aggregate.firstPositionPromptGroupsTotal += page.firstPositionPromptGroups;
      aggregate.answerCapturesWithPageTotal += page.answerCaptures;
      aggregate.citationEventsTotal += page.citationEvents;
      aggregate.firstCitedAt = Math.min(aggregate.firstCitedAt, page.firstCitedAt);
      aggregate.lastCitedAt = Math.max(aggregate.lastCitedAt, page.lastCitedAt);
      portfolioPages.set(pageUrl, aggregate);
    }
  }
  const totalCompleteNoOwnedProviderPromptGroups = providersWithCompleteSamples.reduce(
    (sum, provider) => sum + provider.completeNoOwnedPromptGroups,
    0
  );
  const portfolioRows = [...portfolioPages.entries()]
    .map(([pageUrl, page]) => {
      const providerShares = providersWithCompleteSamples.map(
        (provider) =>
          ((provider.pages.get(pageUrl)?.promptGroups ?? 0) /
            provider.completeNoOwnedPromptGroups) *
          100
      );
      return {
        pageUrl,
        providerCountWithPage: page.providerCountWithPage,
        providersWithPage: [...page.providersWithPage]
          .sort((left, right) => left.localeCompare(right))
          .join('; '),
        providersWithCompleteSample: providersWithCompleteSamples.length,
        providerOpportunityComplete: opportunityComplete,
        providerPromptGroupsWithPageTotal: page.providerPromptGroupsWithPageTotal,
        providerEqualMeanPromptSharePercent:
          providerShares.length > 0
            ? round(providerShares.reduce((sum, share) => sum + share, 0) / providerShares.length)
            : null,
        providerMinimumPromptSharePercent:
          providerShares.length > 0
            ? round(
                providerShares.reduce(
                  (minimum, share) => Math.min(minimum, share),
                  Number.POSITIVE_INFINITY
                )
              )
            : null,
        providerMaximumPromptSharePercent:
          providerShares.length > 0
            ? round(
                providerShares.reduce(
                  (maximum, share) => Math.max(maximum, share),
                  Number.NEGATIVE_INFINITY
                )
              )
            : null,
        pooledProviderPromptSharePercent:
          totalCompleteNoOwnedProviderPromptGroups > 0
            ? round(
                (page.providerPromptGroupsWithPageTotal /
                  totalCompleteNoOwnedProviderPromptGroups) *
                  100
              )
            : null,
        topThreePromptGroupsTotal: page.topThreePromptGroupsTotal,
        firstPositionPromptGroupsTotal: page.firstPositionPromptGroupsTotal,
        answerCapturesWithPageTotal: page.answerCapturesWithPageTotal,
        citationEventsTotal: page.citationEventsTotal,
        firstCitedAt: new Date(page.firstCitedAt).toISOString(),
        lastCitedAt: new Date(page.lastCitedAt).toISOString(),
      };
    })
    .sort(
      (left, right) =>
        right.providerCountWithPage - left.providerCountWithPage ||
        (right.providerEqualMeanPromptSharePercent ?? -1) -
          (left.providerEqualMeanPromptSharePercent ?? -1) ||
        (right.pooledProviderPromptSharePercent ?? -1) -
          (left.pooledProviderPromptSharePercent ?? -1) ||
        left.pageUrl.localeCompare(right.pageUrl)
    );
  const truncated = rows.length + portfolioRows.length > MAX_OUTPUT_ROWS;
  const headers = [
    'row_type',
    'provider',
    'page_url',
    'provider_prompt_groups',
    'provider_count',
    'providers_with_complete_no_owned_sample',
    'complete_no_owned_prompt_groups',
    'unknown_no_owned_prompt_groups',
    'page_provider_rows',
    'page_prompt_groups',
    'share_of_complete_no_owned_prompts_percent',
    'answer_captures_with_page',
    'citation_events',
    'top_three_prompt_groups',
    'first_position_prompt_groups',
    'top_three_citation_events',
    'first_position_citation_events',
    'first_cited_at',
    'last_cited_at',
    'providers_with_page_count',
    'providers_with_page',
    'providers_with_complete_no_owned_sample',
    'provider_prompt_groups_with_page_total',
    'provider_equal_mean_prompt_share_percent',
    'provider_minimum_prompt_share_percent',
    'provider_maximum_prompt_share_percent',
    'pooled_provider_prompt_share_percent',
    'top_three_prompt_groups_total',
    'first_position_prompt_groups_total',
    'answer_captures_with_page_total',
    'citation_events_total',
    'cross_provider_page_rows',
    'provider_opportunity_complete',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note =
    'Provider page-opportunity rows include a third-party exact URL only on normalized provider/prompt groups with no configured owned-domain citation and complete citation lists across all repeated captures. Cross-provider portfolio rows summarize those provider rows: provider-equal mean share weights each provider with a complete no-owned sample equally (including zero-citation providers), while pooled share weights each provider/prompt group equally. Unknown no-owned groups are excluded and shown separately. Query strings and fragments are removed. Counts describe the supplied manual sample, not a causal explanation, engine visibility estimate, or recommendation to copy another page.';
  const summary: Record<string, unknown> = {
    row_type: 'summary',
    provider_prompt_groups: groups.size,
    provider_count: providers.size,
    providers_with_complete_no_owned_sample: providersWithCompleteSamples.length,
    complete_no_owned_prompt_groups: [...providers.values()].reduce(
      (sum, provider) => sum + provider.completeNoOwnedPromptGroups,
      0
    ),
    unknown_no_owned_prompt_groups: [...providers.values()].reduce(
      (sum, provider) => sum + provider.unknownNoOwnedPromptGroups,
      0
    ),
    page_provider_rows: truncated ? null : rows.length,
    cross_provider_page_rows: truncated ? null : portfolioRows.length,
    provider_opportunity_complete: !truncated && opportunityComplete,
    output_rows_truncated: truncated,
    interpretation_note: note,
  };
  const outputRows: Record<string, unknown>[] = [
    Object.fromEntries(headers.map((header) => [header, header])),
    summary,
    ...(truncated
      ? []
      : rows.map((row) => ({ row_type: 'page-opportunity', ...snakeCaseCsvRecord(row) }))),
    ...(truncated
      ? []
      : portfolioRows.map((row) => ({
          row_type: 'cross-provider-portfolio-opportunity',
          ...snakeCaseCsvRecord(row),
        }))),
  ];
  return `${outputRows.map((row) => headers.map((header) => csvCell(row[header])).join(',')).join('\r\n')}\r\n`;
}

interface MonthlyPageOpportunityPromptGroup extends PageOpportunityPromptGroup {
  month: string;
  promptKey: string;
}

interface ProviderMonthPageOpportunityAggregate {
  provider: string;
  month: string;
  providerPromptGroups: number;
  completeNoOwnedPromptGroups: number;
  unknownNoOwnedPromptGroups: number;
  pages: ProviderPageOpportunityAggregate['pages'];
}

interface MonthlyPairedPageOpportunityPanel {
  provider: string;
  previousMonth: string;
  currentMonth: string;
  providerMonthOpportunityComplete: boolean;
  promptPairs: Array<{
    promptKey: string;
    previous: MonthlyPageOpportunityPromptGroup;
    current: MonthlyPageOpportunityPromptGroup;
  }>;
  pageUrls: string[];
}

interface MonthlyPairedPageOpportunityRow {
  provider: string;
  previousMonthUtc: string;
  monthUtc: string;
  skippedCalendarMonths: number;
  pageUrl: string;
  comparablePromptGroups: number;
  baselinePresent: number;
  currentPresent: number;
  gained: number;
  lost: number;
  both: number;
  neither: number;
  baselineReachPercent: number;
  currentReachPercent: number;
  reachChangePercentagePoints: number;
  bootstrapLowerPercentagePoints: number | null;
  bootstrapUpperPercentagePoints: number | null;
  bootstrapResamplesPerTest: number;
  exactMcNemarPValue: number | null;
  holmAdjustedMcNemarPValue: number | null;
  providerMonthOpportunityComplete: boolean;
}

/** Track confirmed-no-owned-citation exact-page opportunities independently in each UTC month. */
export function renderAiAnswerCitationPageOpportunityTrendsCsv(
  observations: AiAnswerCitationObservationInput[],
  ownedDomains: string[]
): string {
  if (ownedDomains.length === 0)
    throw new Error('Page citation opportunity trends require at least one owned domain.');
  const normalizedOwnedDomains = [...new Set(ownedDomains.map(normalizeOwnedDomain))];
  const groups = new Map<string, MonthlyPageOpportunityPromptGroup>();
  const observedMonths = new Set<string>();
  for (const [index, observation] of observations.entries()) {
    if (
      !observation ||
      typeof observation.provider !== 'string' ||
      !observation.provider.trim() ||
      typeof observation.prompt !== 'string' ||
      !observation.prompt.trim() ||
      !Array.isArray(observation.citedUrls) ||
      observation.citedUrls.length > MAX_CITATIONS_PER_OBSERVATION
    ) {
      throw new Error(`Observation ${index + 1} is invalid for page-opportunity trend analysis.`);
    }
    if (
      observation.citationListComplete !== undefined &&
      typeof observation.citationListComplete !== 'boolean'
    ) {
      throw new Error(`Observation ${index + 1} citationListComplete must be a boolean.`);
    }
    const providerKey = normalizedLabel(observation.provider);
    const promptKey = normalizedLabel(observation.prompt);
    if (!providerKey || !promptKey)
      throw new Error(`Observation ${index + 1} requires a non-empty provider and prompt.`);
    const observedTime = Date.parse(observation.observedAt);
    if (!Number.isFinite(observedTime))
      throw new Error(`Observation ${index + 1} has an invalid observedAt value.`);
    const month = new Date(observedTime).toISOString().slice(0, 7);
    observedMonths.add(month);
    const key = JSON.stringify([providerKey, month, promptKey]);
    const group = groups.get(key) ?? {
      provider: observation.provider,
      month,
      promptKey,
      snapshots: 0,
      detailComplete: true,
      ownedCitationPresent: false,
      pages: new Map<string, PageOpportunityCitationProfile>(),
    };
    const citationListComplete =
      observation.citationListComplete ??
      observation.citedUrls.length < MAX_CITATIONS_PER_OBSERVATION;
    group.snapshots += 1;
    group.detailComplete = group.detailComplete && citationListComplete;
    const seen = new Set<string>();
    observation.citedUrls.forEach((rawUrl, position) => {
      const pageUrl = normalizePageUrl(rawUrl);
      if (seen.has(pageUrl)) return;
      seen.add(pageUrl);
      if (isOwnedPage(pageUrl, normalizedOwnedDomains)) group.ownedCitationPresent = true;
      const page = group.pages.get(pageUrl) ?? {
        citationEvents: 0,
        answerCaptures: 0,
        topThreeCitationEvents: 0,
        firstPositionCitationEvents: 0,
        appearedInTopThree: false,
        appearedFirst: false,
        firstCitedAt: observedTime,
        lastCitedAt: observedTime,
      };
      page.citationEvents += 1;
      page.answerCaptures += 1;
      if (position < 3) {
        page.topThreeCitationEvents += 1;
        page.appearedInTopThree = true;
      }
      if (position === 0) {
        page.firstPositionCitationEvents += 1;
        page.appearedFirst = true;
      }
      page.firstCitedAt = Math.min(page.firstCitedAt, observedTime);
      page.lastCitedAt = Math.max(page.lastCitedAt, observedTime);
      group.pages.set(pageUrl, page);
    });
    groups.set(key, group);
  }

  const providerMonths = new Map<string, ProviderMonthPageOpportunityAggregate>();
  for (const group of groups.values()) {
    const providerKey = normalizedLabel(group.provider);
    const key = JSON.stringify([providerKey, group.month]);
    const providerMonth = providerMonths.get(key) ?? {
      provider: group.provider,
      month: group.month,
      providerPromptGroups: 0,
      completeNoOwnedPromptGroups: 0,
      unknownNoOwnedPromptGroups: 0,
      pages: new Map(),
    };
    providerMonth.providerPromptGroups += 1;
    if (group.ownedCitationPresent) {
      providerMonths.set(key, providerMonth);
      continue;
    }
    if (!group.detailComplete) {
      providerMonth.unknownNoOwnedPromptGroups += 1;
      providerMonths.set(key, providerMonth);
      continue;
    }
    providerMonth.completeNoOwnedPromptGroups += 1;
    for (const [pageUrl, page] of group.pages) {
      if (isOwnedPage(pageUrl, normalizedOwnedDomains)) continue;
      const aggregate = providerMonth.pages.get(pageUrl) ?? {
        promptGroups: 0,
        citationEvents: 0,
        answerCaptures: 0,
        topThreePromptGroups: 0,
        firstPositionPromptGroups: 0,
        topThreeCitationEvents: 0,
        firstPositionCitationEvents: 0,
        firstCitedAt: page.firstCitedAt,
        lastCitedAt: page.lastCitedAt,
      };
      aggregate.promptGroups += 1;
      aggregate.citationEvents += page.citationEvents;
      aggregate.answerCaptures += page.answerCaptures;
      if (page.appearedInTopThree) aggregate.topThreePromptGroups += 1;
      if (page.appearedFirst) aggregate.firstPositionPromptGroups += 1;
      aggregate.topThreeCitationEvents += page.topThreeCitationEvents;
      aggregate.firstPositionCitationEvents += page.firstPositionCitationEvents;
      aggregate.firstCitedAt = Math.min(aggregate.firstCitedAt, page.firstCitedAt);
      aggregate.lastCitedAt = Math.max(aggregate.lastCitedAt, page.lastCitedAt);
      providerMonth.pages.set(pageUrl, aggregate);
    }
    providerMonths.set(key, providerMonth);
  }

  const rows = [...providerMonths.values()].flatMap((providerMonth) =>
    [...providerMonth.pages.entries()].map(([pageUrl, page]) => ({
      month_utc: providerMonth.month,
      provider: providerMonth.provider,
      providerPromptGroups: providerMonth.providerPromptGroups,
      completeNoOwnedPromptGroups: providerMonth.completeNoOwnedPromptGroups,
      unknownNoOwnedPromptGroups: providerMonth.unknownNoOwnedPromptGroups,
      pageUrl,
      pagePromptGroups: page.promptGroups,
      pageShareOfCompleteNoOwnedPromptsPercent:
        providerMonth.completeNoOwnedPromptGroups > 0
          ? round((page.promptGroups / providerMonth.completeNoOwnedPromptGroups) * 100)
          : null,
      pageAnswerCaptures: page.answerCaptures,
      pageCitationEvents: page.citationEvents,
      topThreePromptGroups: page.topThreePromptGroups,
      firstPositionPromptGroups: page.firstPositionPromptGroups,
      topThreeCitationEvents: page.topThreeCitationEvents,
      firstPositionCitationEvents: page.firstPositionCitationEvents,
      firstCitedAt: new Date(page.firstCitedAt).toISOString(),
      lastCitedAt: new Date(page.lastCitedAt).toISOString(),
      providerMonthOpportunityComplete: providerMonth.unknownNoOwnedPromptGroups === 0,
    }))
  );
  rows.sort(
    (left, right) =>
      left.month_utc.localeCompare(right.month_utc) ||
      right.pagePromptGroups - left.pagePromptGroups ||
      left.provider.localeCompare(right.provider) ||
      left.pageUrl.localeCompare(right.pageUrl)
  );
  const completeProviderMonthsByMonth = new Map<string, ProviderMonthPageOpportunityAggregate[]>();
  for (const providerMonth of providerMonths.values()) {
    if (providerMonth.completeNoOwnedPromptGroups === 0) continue;
    const monthlySamples = completeProviderMonthsByMonth.get(providerMonth.month) ?? [];
    monthlySamples.push(providerMonth);
    completeProviderMonthsByMonth.set(providerMonth.month, monthlySamples);
  }
  const monthlyPortfolioPages = new Map<
    string,
    {
      month: string;
      pageUrl: string;
      providerCountWithPage: number;
      providersWithPage: string[];
      providerPromptGroupsWithPageTotal: number;
      topThreePromptGroupsTotal: number;
      firstPositionPromptGroupsTotal: number;
      answerCapturesWithPageTotal: number;
      citationEventsTotal: number;
      firstCitedAt: number;
      lastCitedAt: number;
    }
  >();
  const completeNoOwnedProviderPromptGroupsByMonth = new Map<string, number>();
  for (const [month, monthlySamples] of completeProviderMonthsByMonth) {
    completeNoOwnedProviderPromptGroupsByMonth.set(
      month,
      monthlySamples.reduce((sum, item) => sum + item.completeNoOwnedPromptGroups, 0)
    );
    for (const providerMonth of monthlySamples) {
      for (const [pageUrl, page] of providerMonth.pages) {
        const key = JSON.stringify([month, pageUrl]);
        const aggregate = monthlyPortfolioPages.get(key) ?? {
          month,
          pageUrl,
          providerCountWithPage: 0,
          providersWithPage: [],
          providerPromptGroupsWithPageTotal: 0,
          topThreePromptGroupsTotal: 0,
          firstPositionPromptGroupsTotal: 0,
          answerCapturesWithPageTotal: 0,
          citationEventsTotal: 0,
          firstCitedAt: page.firstCitedAt,
          lastCitedAt: page.lastCitedAt,
        };
        aggregate.providerCountWithPage += 1;
        aggregate.providersWithPage.push(providerMonth.provider);
        aggregate.providerPromptGroupsWithPageTotal += page.promptGroups;
        aggregate.topThreePromptGroupsTotal += page.topThreePromptGroups;
        aggregate.firstPositionPromptGroupsTotal += page.firstPositionPromptGroups;
        aggregate.answerCapturesWithPageTotal += page.answerCaptures;
        aggregate.citationEventsTotal += page.citationEvents;
        aggregate.firstCitedAt = Math.min(aggregate.firstCitedAt, page.firstCitedAt);
        aggregate.lastCitedAt = Math.max(aggregate.lastCitedAt, page.lastCitedAt);
        monthlyPortfolioPages.set(key, aggregate);
      }
    }
  }
  const monthlyPortfolioRows = [...monthlyPortfolioPages.values()]
    .map((page) => {
      const providerSamples = completeProviderMonthsByMonth.get(page.month) ?? [];
      const providerShares = providerSamples.map(
        (providerMonth) =>
          ((providerMonth.pages.get(page.pageUrl)?.promptGroups ?? 0) /
            providerMonth.completeNoOwnedPromptGroups) *
          100
      );
      const completeNoOwnedPromptGroups =
        completeNoOwnedProviderPromptGroupsByMonth.get(page.month) ?? 0;
      return {
        month_utc: page.month,
        pageUrl: page.pageUrl,
        providerCountWithPage: page.providerCountWithPage,
        providersWithPage: [...page.providersWithPage]
          .sort((left, right) => left.localeCompare(right))
          .join('; '),
        providersWithCompleteSample: providerSamples.length,
        providerPromptGroupsWithPageTotal: page.providerPromptGroupsWithPageTotal,
        providerEqualMeanPromptSharePercent:
          providerShares.length > 0
            ? round(providerShares.reduce((sum, share) => sum + share, 0) / providerShares.length)
            : null,
        providerMinimumPromptSharePercent:
          providerShares.length > 0
            ? round(
                providerShares.reduce(
                  (minimum, share) => Math.min(minimum, share),
                  Number.POSITIVE_INFINITY
                )
              )
            : null,
        providerMaximumPromptSharePercent:
          providerShares.length > 0
            ? round(
                providerShares.reduce(
                  (maximum, share) => Math.max(maximum, share),
                  Number.NEGATIVE_INFINITY
                )
              )
            : null,
        pooledProviderPromptSharePercent:
          completeNoOwnedPromptGroups > 0
            ? round((page.providerPromptGroupsWithPageTotal / completeNoOwnedPromptGroups) * 100)
            : null,
        topThreePromptGroupsTotal: page.topThreePromptGroupsTotal,
        firstPositionPromptGroupsTotal: page.firstPositionPromptGroupsTotal,
        answerCapturesWithPageTotal: page.answerCapturesWithPageTotal,
        citationEventsTotal: page.citationEventsTotal,
        firstCitedAt: new Date(page.firstCitedAt).toISOString(),
        lastCitedAt: new Date(page.lastCitedAt).toISOString(),
      };
    })
    .sort(
      (left, right) =>
        left.month_utc.localeCompare(right.month_utc) ||
        right.providerCountWithPage - left.providerCountWithPage ||
        (right.providerEqualMeanPromptSharePercent ?? -1) -
          (left.providerEqualMeanPromptSharePercent ?? -1) ||
        left.pageUrl.localeCompare(right.pageUrl)
    );
  const promptGroupsByProvider = new Map<
    string,
    Map<string, Map<string, MonthlyPageOpportunityPromptGroup>>
  >();
  const providerLabels = new Map<string, string>();
  for (const group of groups.values()) {
    const providerKey = normalizedLabel(group.provider);
    const monthGroups =
      promptGroupsByProvider.get(providerKey) ??
      new Map<string, Map<string, MonthlyPageOpportunityPromptGroup>>();
    const promptGroups =
      monthGroups.get(group.month) ?? new Map<string, MonthlyPageOpportunityPromptGroup>();
    promptGroups.set(group.promptKey, group);
    monthGroups.set(group.month, promptGroups);
    promptGroupsByProvider.set(providerKey, monthGroups);
    providerLabels.set(providerKey, group.provider);
  }
  const pairedPanels: MonthlyPairedPageOpportunityPanel[] = [];
  let pairedMonthPromptPageEvaluations = 0;
  for (const [providerKey, monthGroups] of promptGroupsByProvider) {
    const months = [...monthGroups.keys()].sort();
    for (let monthIndex = 1; monthIndex < months.length; monthIndex += 1) {
      const previousMonth = months[monthIndex - 1]!;
      const currentMonth = months[monthIndex]!;
      const previousPromptGroups = monthGroups.get(previousMonth)!;
      const currentPromptGroups = monthGroups.get(currentMonth)!;
      const promptPairs: MonthlyPairedPageOpportunityPanel['promptPairs'] = [];
      const pageUrls = new Set<string>();
      for (const [promptKey, previous] of previousPromptGroups) {
        const current = currentPromptGroups.get(promptKey);
        if (
          !current ||
          previous.ownedCitationPresent ||
          current.ownedCitationPresent ||
          !previous.detailComplete ||
          !current.detailComplete
        )
          continue;
        promptPairs.push({ promptKey, previous, current });
        previous.pages.forEach((_, pageUrl) => pageUrls.add(pageUrl));
        current.pages.forEach((_, pageUrl) => pageUrls.add(pageUrl));
      }
      if (promptPairs.length === 0 || pageUrls.size === 0) continue;
      pairedMonthPromptPageEvaluations += promptPairs.length * pageUrls.size;
      const previousProviderMonth = providerMonths.get(
        JSON.stringify([providerKey, previousMonth])
      );
      const currentProviderMonth = providerMonths.get(JSON.stringify([providerKey, currentMonth]));
      pairedPanels.push({
        provider: providerLabels.get(providerKey) ?? providerKey,
        previousMonth,
        currentMonth,
        providerMonthOpportunityComplete: Boolean(
          previousProviderMonth &&
          currentProviderMonth &&
          previousProviderMonth.unknownNoOwnedPromptGroups === 0 &&
          currentProviderMonth.unknownNoOwnedPromptGroups === 0
        ),
        promptPairs,
        pageUrls: [...pageUrls].sort((left, right) => left.localeCompare(right)),
      });
    }
  }
  const projectedPairedMonthComparisonRows = pairedPanels.reduce(
    (sum, panel) => sum + panel.pageUrls.length,
    0
  );
  const pairedMonthWorkTruncated = pairedMonthPromptPageEvaluations > MAX_PROMPT_PAGE_EVALUATIONS;
  const opportunityComplete = [...providerMonths.values()].every(
    (item) => item.unknownNoOwnedPromptGroups === 0
  );
  const truncated =
    rows.length + monthlyPortfolioRows.length + projectedPairedMonthComparisonRows >
    MAX_OUTPUT_ROWS;
  const pairedMonthBootstrapResamplesPerTest =
    pairedMonthPromptPageEvaluations > 0
      ? Math.min(
          BOOTSTRAP_ITERATIONS,
          Math.floor(MAX_BOOTSTRAP_SAMPLE_DRAWS / pairedMonthPromptPageEvaluations)
        )
      : BOOTSTRAP_ITERATIONS;
  const pairedMonthRows: MonthlyPairedPageOpportunityRow[] = [];
  if (!truncated && !pairedMonthWorkTruncated) {
    for (const panel of pairedPanels) {
      const [previousYear = '0', previousMonthNumber = '1'] = panel.previousMonth.split('-');
      const [currentYear = '0', currentMonthNumber = '1'] = panel.currentMonth.split('-');
      const skippedCalendarMonths = Math.max(
        0,
        Number(currentYear) * 12 +
          Number(currentMonthNumber) -
          (Number(previousYear) * 12 + Number(previousMonthNumber)) -
          1
      );
      for (const pageUrl of panel.pageUrls) {
        let baselinePresent = 0;
        let currentPresent = 0;
        let gained = 0;
        let lost = 0;
        let both = 0;
        let neither = 0;
        const deltas: number[] = [];
        for (const promptPair of panel.promptPairs) {
          const presentBefore = promptPair.previous.pages.has(pageUrl);
          const presentAfter = promptPair.current.pages.has(pageUrl);
          if (presentBefore) baselinePresent += 1;
          if (presentAfter) currentPresent += 1;
          if (presentBefore && presentAfter) both += 1;
          else if (presentBefore) lost += 1;
          else if (presentAfter) gained += 1;
          else neither += 1;
          deltas.push(Number(presentAfter) - Number(presentBefore));
        }
        const comparablePromptGroups = panel.promptPairs.length;
        const bootstrapInterval = pairedPromptBootstrapInterval(
          deltas,
          `${panel.provider}|${panel.previousMonth}|${panel.currentMonth}|${pageUrl}`,
          pairedMonthBootstrapResamplesPerTest
        );
        pairedMonthRows.push({
          provider: panel.provider,
          previousMonthUtc: panel.previousMonth,
          monthUtc: panel.currentMonth,
          skippedCalendarMonths,
          pageUrl,
          comparablePromptGroups,
          baselinePresent,
          currentPresent,
          gained,
          lost,
          both,
          neither,
          baselineReachPercent: round((baselinePresent / comparablePromptGroups) * 100),
          currentReachPercent: round((currentPresent / comparablePromptGroups) * 100),
          reachChangePercentagePoints: round(
            ((currentPresent - baselinePresent) / comparablePromptGroups) * 100
          ),
          bootstrapLowerPercentagePoints: bootstrapInterval?.lowerPercentagePoints ?? null,
          bootstrapUpperPercentagePoints: bootstrapInterval?.upperPercentagePoints ?? null,
          bootstrapResamplesPerTest: pairedMonthBootstrapResamplesPerTest,
          exactMcNemarPValue: exactMcNemarPValue(gained, lost),
          holmAdjustedMcNemarPValue: null,
          providerMonthOpportunityComplete: panel.providerMonthOpportunityComplete,
        });
      }
    }
    const adjustedPValues = holmAdjustedPValues(
      pairedMonthRows.map((row) => row.exactMcNemarPValue ?? 1)
    );
    pairedMonthRows.forEach((row, index) => {
      row.holmAdjustedMcNemarPValue = adjustedPValues[index]!;
    });
  }
  const headers = [
    'row_type',
    'month_utc',
    'provider',
    'page_url',
    'provider_prompt_groups',
    'complete_no_owned_prompt_groups',
    'unknown_no_owned_prompt_groups',
    'page_prompt_groups',
    'share_of_complete_no_owned_prompts_percent',
    'answer_captures_with_page',
    'citation_events',
    'top_three_prompt_groups',
    'first_position_prompt_groups',
    'top_three_citation_events',
    'first_position_citation_events',
    'first_cited_at',
    'last_cited_at',
    'providers_with_page_count',
    'providers_with_page',
    'providers_with_complete_no_owned_sample',
    'provider_prompt_groups_with_page_total',
    'provider_equal_mean_prompt_share_percent',
    'provider_minimum_prompt_share_percent',
    'provider_maximum_prompt_share_percent',
    'pooled_provider_prompt_share_percent',
    'top_three_prompt_groups_total',
    'first_position_prompt_groups_total',
    'answer_captures_with_page_total',
    'citation_events_total',
    'previous_month_utc',
    'skipped_calendar_months',
    'comparable_prompt_groups',
    'baseline_present',
    'current_present',
    'gained',
    'lost',
    'both',
    'neither',
    'baseline_reach_percent',
    'current_reach_percent',
    'reach_change_percentage_points',
    'bootstrap_lower_percentage_points',
    'bootstrap_upper_percentage_points',
    'bootstrap_resamples_per_test',
    'exact_mcnemar_p_value',
    'holm_adjusted_mcnemar_p_value',
    'paired_month_comparison_complete',
    'provider_month_opportunity_complete',
    'observed_months',
    'observed_month_count',
    'provider_months',
    'page_provider_month_rows',
    'cross_provider_page_month_rows',
    'paired_month_comparison_rows',
    'paired_month_prompt_page_evaluations',
    'paired_month_bootstrap_resamples_per_test',
    'paired_month_comparison_work_truncated',
    'paired_month_comparisons_complete',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const pairedMonthComparisonsComplete = !truncated && !pairedMonthWorkTruncated;
  const note =
    'Provider-month rows are one exact third-party page within a normalized provider/exact-prompt/UTC-month panel. Cross-provider month rows show provider-equal mean share and pooled provider/prompt share, including zero-citation provider-months in the equal-weight mean. Paired month rows compare exact pages on shared prompts across consecutive sampled months for each provider, retaining only prompts with complete citation lists and confirmed absence of owned citations in both months; exact McNemar p-values receive Holm adjustment across all reported provider/page/month transitions, with a bounded prompt-cluster bootstrap interval when the common draw budget permits. Incomplete no-owned groups remain unknown. Calendar gaps and support are explicit. These are changes in the supplied manual sample, not continuous visibility, causation, or recommendations to copy a cited page.';
  const summary: Record<string, unknown> = {
    row_type: 'summary',
    observed_months: [...observedMonths].sort().join('; '),
    observed_month_count: observedMonths.size,
    provider_months: providerMonths.size,
    provider_prompt_groups: groups.size,
    complete_no_owned_prompt_groups: [...providerMonths.values()].reduce(
      (sum, item) => sum + item.completeNoOwnedPromptGroups,
      0
    ),
    unknown_no_owned_prompt_groups: [...providerMonths.values()].reduce(
      (sum, item) => sum + item.unknownNoOwnedPromptGroups,
      0
    ),
    page_provider_month_rows: truncated ? null : rows.length,
    cross_provider_page_month_rows: truncated ? null : monthlyPortfolioRows.length,
    paired_month_comparison_rows:
      truncated || pairedMonthWorkTruncated ? null : pairedMonthRows.length,
    paired_month_prompt_page_evaluations: pairedMonthPromptPageEvaluations,
    paired_month_bootstrap_resamples_per_test: pairedMonthBootstrapResamplesPerTest,
    paired_month_comparison_work_truncated: pairedMonthWorkTruncated,
    paired_month_comparisons_complete: pairedMonthComparisonsComplete,
    provider_month_opportunity_complete: !truncated && opportunityComplete,
    output_rows_truncated: truncated,
    interpretation_note: note,
  };
  const outputRows: Record<string, unknown>[] = [
    Object.fromEntries(headers.map((header) => [header, header])),
    summary,
    ...(truncated
      ? []
      : rows.map((row) => ({ row_type: 'monthly-page-opportunity', ...snakeCaseCsvRecord(row) }))),
    ...(truncated
      ? []
      : monthlyPortfolioRows.map((row) => ({
          row_type: 'cross-provider-monthly-page-opportunity',
          provider_month_opportunity_complete: opportunityComplete,
          ...snakeCaseCsvRecord(row),
        }))),
    ...(truncated || pairedMonthWorkTruncated
      ? []
      : pairedMonthRows.map((row) => ({
          row_type: 'paired-month-page-opportunity',
          paired_month_comparison_complete: true,
          ...snakeCaseCsvRecord(row),
        }))),
  ];
  return `${outputRows.map((row) => headers.map((header) => csvCell(row[header])).join(',')).join('\r\n')}\r\n`;
}

/** Track confirmed-no-owned opportunity reach for structural URL path families by UTC month. */
export function renderAiAnswerCitationPageOpportunityPathFamilyTrendsCsv(
  observations: AiAnswerCitationObservationInput[],
  ownedDomains: string[],
  pathDepth: number
): string {
  if (ownedDomains.length === 0)
    throw new Error('Page opportunity path-family trends require at least one owned domain.');
  if (!Number.isInteger(pathDepth) || pathDepth < 1 || pathDepth > 5) {
    throw new Error('Page opportunity path-family trend depth must be an integer from 1 to 5.');
  }
  const owned = [...new Set(ownedDomains.map(normalizeOwnedDomain))];
  type FamilyCapture = {
    pages: Set<string>;
    citationEvents: number;
    answerCaptures: number;
    topThree: boolean;
    firstPosition: boolean;
    topThreeEvents: number;
    firstPositionEvents: number;
    firstAt: number;
    lastAt: number;
  };
  type PromptMonth = {
    provider: string;
    month: string;
    promptKey: string;
    complete: boolean;
    ownedPresent: boolean;
    families: Map<string, FamilyCapture>;
  };
  type FamilyAggregate = {
    prompts: number;
    pages: Set<string>;
    citationEvents: number;
    answerCaptures: number;
    topThreePrompts: number;
    firstPositionPrompts: number;
    topThreeEvents: number;
    firstPositionEvents: number;
    firstAt: number;
    lastAt: number;
  };
  type ProviderMonth = {
    provider: string;
    month: string;
    prompts: number;
    completeNoOwned: number;
    unknownNoOwned: number;
    families: Map<string, FamilyAggregate>;
  };
  type PromptPair = { previous: PromptMonth; current: PromptMonth };
  type Transition = {
    provider: string;
    previousMonth: string;
    month: string;
    skippedMonths: number;
    family: string;
    comparablePrompts: number;
    baselinePresent: number;
    currentPresent: number;
    gained: number;
    lost: number;
    both: number;
    neither: number;
    reachChange: number;
    bootstrapLower: number | null;
    bootstrapUpper: number | null;
    bootstrapResamples: number;
    exactP: number | null;
    holmP: number | null;
    complete: boolean;
  };
  type Panel = {
    providerKey: string;
    previousMonth: string;
    month: string;
    skippedMonths: number;
    promptPairs: PromptPair[];
    families: string[];
    complete: boolean;
  };

  const promptMonths = new Map<string, PromptMonth>();
  const observedMonths = new Set<string>();
  for (const [index, observation] of observations.entries()) {
    if (
      !observation ||
      typeof observation.provider !== 'string' ||
      !observation.provider.trim() ||
      typeof observation.prompt !== 'string' ||
      !observation.prompt.trim() ||
      !Array.isArray(observation.citedUrls) ||
      observation.citedUrls.length > MAX_CITATIONS_PER_OBSERVATION
    ) {
      throw new Error(
        `Observation ${index + 1} is invalid for page opportunity path-family trends.`
      );
    }
    if (
      observation.citationListComplete !== undefined &&
      typeof observation.citationListComplete !== 'boolean'
    ) {
      throw new Error(`Observation ${index + 1} citationListComplete must be a boolean.`);
    }
    const providerKey = normalizedLabel(observation.provider);
    const promptKey = normalizedLabel(observation.prompt);
    const observedAt = Date.parse(observation.observedAt);
    if (!providerKey || !promptKey || !Number.isFinite(observedAt)) {
      throw new Error(
        `Observation ${index + 1} requires a valid provider, prompt, and observedAt value.`
      );
    }
    const month = new Date(observedAt).toISOString().slice(0, 7);
    observedMonths.add(month);
    const key = JSON.stringify([providerKey, month, promptKey]);
    const prompt = promptMonths.get(key) ?? {
      provider: observation.provider,
      month,
      promptKey,
      complete: true,
      ownedPresent: false,
      families: new Map<string, FamilyCapture>(),
    };
    prompt.complete =
      prompt.complete &&
      (observation.citationListComplete ??
        observation.citedUrls.length < MAX_CITATIONS_PER_OBSERVATION);
    const seenPages = new Set<string>();
    const seenFamilies = new Set<string>();
    observation.citedUrls.forEach((rawUrl, position) => {
      const pageUrl = normalizePageUrl(rawUrl);
      if (seenPages.has(pageUrl)) return;
      seenPages.add(pageUrl);
      if (isOwnedPage(pageUrl, owned)) prompt.ownedPresent = true;
      const url = new URL(pageUrl);
      const segments = url.pathname.split('/').filter(Boolean).slice(0, pathDepth);
      const family = `${url.origin}${segments.length ? `/${segments.join('/')}` : '/'}`;
      const capture = prompt.families.get(family) ?? {
        pages: new Set<string>(),
        citationEvents: 0,
        answerCaptures: 0,
        topThree: false,
        firstPosition: false,
        topThreeEvents: 0,
        firstPositionEvents: 0,
        firstAt: observedAt,
        lastAt: observedAt,
      };
      capture.pages.add(pageUrl);
      capture.citationEvents += 1;
      if (!seenFamilies.has(family)) {
        capture.answerCaptures += 1;
        seenFamilies.add(family);
      }
      if (position < 3) {
        capture.topThree = true;
        capture.topThreeEvents += 1;
      }
      if (position === 0) {
        capture.firstPosition = true;
        capture.firstPositionEvents += 1;
      }
      capture.firstAt = Math.min(capture.firstAt, observedAt);
      capture.lastAt = Math.max(capture.lastAt, observedAt);
      prompt.families.set(family, capture);
    });
    promptMonths.set(key, prompt);
  }

  const providerMonths = new Map<string, ProviderMonth>();
  for (const prompt of promptMonths.values()) {
    const providerKey = normalizedLabel(prompt.provider);
    const key = JSON.stringify([providerKey, prompt.month]);
    const providerMonth = providerMonths.get(key) ?? {
      provider: prompt.provider,
      month: prompt.month,
      prompts: 0,
      completeNoOwned: 0,
      unknownNoOwned: 0,
      families: new Map<string, FamilyAggregate>(),
    };
    providerMonth.prompts += 1;
    if (!prompt.ownedPresent && !prompt.complete) providerMonth.unknownNoOwned += 1;
    if (!prompt.ownedPresent && prompt.complete) {
      providerMonth.completeNoOwned += 1;
      for (const [family, capture] of prompt.families) {
        if (capture.pages.size > 0 && [...capture.pages].every((page) => isOwnedPage(page, owned)))
          continue;
        const aggregate = providerMonth.families.get(family) ?? {
          prompts: 0,
          pages: new Set<string>(),
          citationEvents: 0,
          answerCaptures: 0,
          topThreePrompts: 0,
          firstPositionPrompts: 0,
          topThreeEvents: 0,
          firstPositionEvents: 0,
          firstAt: capture.firstAt,
          lastAt: capture.lastAt,
        };
        aggregate.prompts += 1;
        capture.pages.forEach((page) => aggregate.pages.add(page));
        aggregate.citationEvents += capture.citationEvents;
        aggregate.answerCaptures += capture.answerCaptures;
        if (capture.topThree) aggregate.topThreePrompts += 1;
        if (capture.firstPosition) aggregate.firstPositionPrompts += 1;
        aggregate.topThreeEvents += capture.topThreeEvents;
        aggregate.firstPositionEvents += capture.firstPositionEvents;
        aggregate.firstAt = Math.min(aggregate.firstAt, capture.firstAt);
        aggregate.lastAt = Math.max(aggregate.lastAt, capture.lastAt);
        providerMonth.families.set(family, aggregate);
      }
    }
    providerMonths.set(key, providerMonth);
  }

  const promptRows: Array<{
    provider: string;
    providerKey: string;
    month: string;
    prompt: PromptMonth;
  }> = [...promptMonths.values()]
    .map((prompt) => ({
      provider: prompt.provider,
      providerKey: normalizedLabel(prompt.provider),
      month: prompt.month,
      prompt,
    }))
    .sort(
      (left, right) =>
        left.providerKey.localeCompare(right.providerKey) ||
        left.month.localeCompare(right.month) ||
        left.prompt.promptKey.localeCompare(right.prompt.promptKey)
    );
  const byProviderMonth = new Map<string, Map<string, Map<string, PromptMonth>>>();
  const providerLabels = new Map<string, string>();
  for (const prompt of promptRows) {
    const months =
      byProviderMonth.get(prompt.providerKey) ?? new Map<string, Map<string, PromptMonth>>();
    const prompts = months.get(prompt.month) ?? new Map<string, PromptMonth>();
    prompts.set(prompt.prompt.promptKey, prompt.prompt);
    months.set(prompt.month, prompts);
    byProviderMonth.set(prompt.providerKey, months);
    const providerLabel = providerLabels.get(prompt.providerKey);
    if (!providerLabel || prompt.provider.localeCompare(providerLabel) < 0)
      providerLabels.set(prompt.providerKey, prompt.provider);
  }
  const transitions: Transition[] = [];
  const panels: Panel[] = [];
  let pairedEvaluations = 0;
  for (const [providerKey, months] of byProviderMonth) {
    const orderedMonths = [...months.keys()].sort();
    for (let index = 1; index < orderedMonths.length; index += 1) {
      const previousMonth = orderedMonths[index - 1]!;
      const month = orderedMonths[index]!;
      const previous = months.get(previousMonth)!;
      const current = months.get(month)!;
      const promptPairs: PromptPair[] = [];
      const families = new Set<string>();
      for (const [promptKey, before] of previous) {
        const after = current.get(promptKey);
        if (
          !after ||
          before.ownedPresent ||
          after.ownedPresent ||
          !before.complete ||
          !after.complete
        )
          continue;
        promptPairs.push({ previous: before, current: after });
        before.families.forEach((_, family) => families.add(family));
        after.families.forEach((_, family) => families.add(family));
      }
      if (!promptPairs.length || !families.size) continue;
      pairedEvaluations += promptPairs.length * families.size;
      const [beforeYear = '0', beforeMonth = '1'] = previousMonth.split('-');
      const [year = '0', monthNumber = '1'] = month.split('-');
      const skippedMonths = Math.max(
        0,
        Number(year) * 12 + Number(monthNumber) - Number(beforeYear) * 12 - Number(beforeMonth) - 1
      );
      const beforeProviderMonth = providerMonths.get(JSON.stringify([providerKey, previousMonth]));
      const currentProviderMonth = providerMonths.get(JSON.stringify([providerKey, month]));
      panels.push({
        providerKey,
        previousMonth,
        month,
        skippedMonths,
        promptPairs,
        families: [...families].sort(),
        complete: Boolean(
          beforeProviderMonth &&
          currentProviderMonth &&
          beforeProviderMonth.unknownNoOwned === 0 &&
          currentProviderMonth.unknownNoOwned === 0
        ),
      });
    }
  }
  const workTruncated = pairedEvaluations > MAX_PROMPT_PAGE_EVALUATIONS;
  const bootstrapResamplesPerTest =
    pairedEvaluations > 0
      ? Math.min(BOOTSTRAP_ITERATIONS, Math.floor(MAX_BOOTSTRAP_SAMPLE_DRAWS / pairedEvaluations))
      : BOOTSTRAP_ITERATIONS;
  if (!workTruncated) {
    for (const panel of panels) {
      for (const family of panel.families) {
        let baselinePresent = 0;
        let currentPresent = 0;
        let gained = 0;
        let lost = 0;
        let both = 0;
        let neither = 0;
        const deltas: number[] = [];
        for (const pair of panel.promptPairs) {
          const before = pair.previous.families.has(family);
          const after = pair.current.families.has(family);
          if (before) baselinePresent += 1;
          if (after) currentPresent += 1;
          if (before && after) both += 1;
          else if (before) lost += 1;
          else if (after) gained += 1;
          else neither += 1;
          deltas.push(Number(after) - Number(before));
        }
        const bootstrap = pairedPromptBootstrapInterval(
          deltas,
          `${providerLabels.get(panel.providerKey) ?? panel.providerKey}|${panel.previousMonth}|${panel.month}|${family}`,
          bootstrapResamplesPerTest
        );
        const comparablePrompts = panel.promptPairs.length;
        transitions.push({
          provider: providerLabels.get(panel.providerKey) ?? panel.providerKey,
          previousMonth: panel.previousMonth,
          month: panel.month,
          skippedMonths: panel.skippedMonths,
          family,
          comparablePrompts,
          baselinePresent,
          currentPresent,
          gained,
          lost,
          both,
          neither,
          reachChange: round(((currentPresent - baselinePresent) / comparablePrompts) * 100),
          bootstrapLower: bootstrap?.lowerPercentagePoints ?? null,
          bootstrapUpper: bootstrap?.upperPercentagePoints ?? null,
          bootstrapResamples: bootstrap ? bootstrapResamplesPerTest : 0,
          exactP: exactMcNemarPValue(gained, lost),
          holmP: null,
          complete: panel.complete,
        });
      }
    }
    const adjusted = holmAdjustedPValues(transitions.map((row) => row.exactP ?? 1));
    transitions.forEach((row, index) => {
      row.holmP = adjusted[index]!;
    });
  }

  const familyRows: Record<string, unknown>[] = [];
  const providerMonthSummaries: Record<string, unknown>[] = [];
  const orderedProviderMonths = [...providerMonths.values()].sort(
    (left, right) =>
      left.month.localeCompare(right.month) ||
      normalizedLabel(left.provider).localeCompare(normalizedLabel(right.provider))
  );
  for (const providerMonth of orderedProviderMonths) {
    providerMonthSummaries.push({
      row_type: 'provider-month-opportunity-summary',
      month_utc: providerMonth.month,
      provider: providerMonth.provider,
      path_depth: pathDepth,
      provider_prompt_groups: providerMonth.prompts,
      complete_no_owned_prompt_groups: providerMonth.completeNoOwned,
      unknown_no_owned_prompt_groups: providerMonth.unknownNoOwned,
      path_families_with_opportunity: providerMonth.families.size,
      provider_month_opportunity_complete: providerMonth.unknownNoOwned === 0,
    });
    for (const [family, aggregate] of [...providerMonth.families.entries()].sort(
      ([left], [right]) => left.localeCompare(right)
    ))
      familyRows.push({
        row_type: 'monthly-path-family-opportunity',
        month_utc: providerMonth.month,
        provider: providerMonth.provider,
        path_family: family,
        path_depth: pathDepth,
        provider_prompt_groups: providerMonth.prompts,
        complete_no_owned_prompt_groups: providerMonth.completeNoOwned,
        unknown_no_owned_prompt_groups: providerMonth.unknownNoOwned,
        distinct_pages: aggregate.pages.size,
        prompt_groups_with_family: aggregate.prompts,
        share_of_complete_no_owned_prompts_percent:
          providerMonth.completeNoOwned > 0
            ? round((aggregate.prompts / providerMonth.completeNoOwned) * 100)
            : null,
        answer_captures_with_family: aggregate.answerCaptures,
        citation_events: aggregate.citationEvents,
        top_three_prompt_groups: aggregate.topThreePrompts,
        first_position_prompt_groups: aggregate.firstPositionPrompts,
        top_three_citation_events: aggregate.topThreeEvents,
        first_position_citation_events: aggregate.firstPositionEvents,
        first_cited_at: new Date(aggregate.firstAt).toISOString(),
        last_cited_at: new Date(aggregate.lastAt).toISOString(),
        provider_month_opportunity_complete: providerMonth.unknownNoOwned === 0,
      });
  }

  const byMonth = new Map<string, ProviderMonth[]>();
  for (const providerMonth of orderedProviderMonths) {
    if (providerMonth.completeNoOwned === 0) continue;
    const samples = byMonth.get(providerMonth.month) ?? [];
    samples.push(providerMonth);
    byMonth.set(providerMonth.month, samples);
  }
  const portfolioRows: Record<string, unknown>[] = [];
  for (const [month, samples] of byMonth) {
    const families = new Set<string>();
    samples.forEach((sample) => sample.families.forEach((_, family) => families.add(family)));
    for (const family of families) {
      const counts = samples.map((sample) => sample.families.get(family)?.prompts ?? 0);
      const denominators = samples.map((sample) => sample.completeNoOwned);
      const shares = counts.map((count, index) => (count / denominators[index]!) * 100);
      const countTotal = counts.reduce((sum, count) => sum + count, 0);
      const denominatorTotal = denominators.reduce((sum, count) => sum + count, 0);
      const presentSamples = samples.filter((sample) => sample.families.has(family));
      const pages = new Set<string>();
      presentSamples.forEach((sample) =>
        sample.families.get(family)!.pages.forEach((page) => pages.add(page))
      );
      const firstAt = presentSamples.reduce(
        (minimum, sample) => Math.min(minimum, sample.families.get(family)!.firstAt),
        Number.POSITIVE_INFINITY
      );
      const lastAt = presentSamples.reduce(
        (maximum, sample) => Math.max(maximum, sample.families.get(family)!.lastAt),
        0
      );
      portfolioRows.push({
        row_type: 'cross-provider-monthly-path-family-opportunity',
        month_utc: month,
        path_family: family,
        path_depth: pathDepth,
        providers_with_family_count: presentSamples.length,
        providers_with_family: presentSamples
          .map((sample) => sample.provider)
          .sort()
          .join('; '),
        providers_with_complete_sample: samples.length,
        prompt_groups_with_family_total: countTotal,
        provider_equal_mean_prompt_share_percent: round(
          shares.reduce((sum, share) => sum + share, 0) / shares.length
        ),
        provider_minimum_prompt_share_percent: round(Math.min(...shares)),
        provider_maximum_prompt_share_percent: round(Math.max(...shares)),
        pooled_provider_prompt_share_percent:
          denominatorTotal > 0 ? round((countTotal / denominatorTotal) * 100) : null,
        distinct_pages: pages.size,
        citation_events_total: presentSamples.reduce(
          (sum, sample) => sum + sample.families.get(family)!.citationEvents,
          0
        ),
        first_cited_at: Number.isFinite(firstAt) ? new Date(firstAt).toISOString() : '',
        last_cited_at: lastAt > 0 ? new Date(lastAt).toISOString() : '',
      });
    }
  }
  providerMonthSummaries.sort(
    (left, right) =>
      String(left.month_utc).localeCompare(String(right.month_utc)) ||
      String(left.provider).localeCompare(String(right.provider))
  );
  familyRows.sort(
    (left, right) =>
      String(left.month_utc).localeCompare(String(right.month_utc)) ||
      String(left.provider).localeCompare(String(right.provider)) ||
      Number(right.prompt_groups_with_family) - Number(left.prompt_groups_with_family) ||
      String(left.path_family).localeCompare(String(right.path_family))
  );
  portfolioRows.sort(
    (left, right) =>
      String(left.month_utc).localeCompare(String(right.month_utc)) ||
      Number(right.providers_with_family_count) - Number(left.providers_with_family_count) ||
      Number(right.provider_equal_mean_prompt_share_percent) -
        Number(left.provider_equal_mean_prompt_share_percent) ||
      String(left.path_family).localeCompare(String(right.path_family))
  );
  transitions.sort(
    (left, right) =>
      left.month.localeCompare(right.month) ||
      left.provider.localeCompare(right.provider) ||
      left.family.localeCompare(right.family)
  );
  const summaryComplete = [...providerMonths.values()].every((item) => item.unknownNoOwned === 0);
  const maxBootstrapResamples =
    pairedEvaluations > 0
      ? Math.min(BOOTSTRAP_ITERATIONS, Math.floor(MAX_BOOTSTRAP_SAMPLE_DRAWS / pairedEvaluations))
      : BOOTSTRAP_ITERATIONS;
  const projectedRows =
    providerMonthSummaries.length + familyRows.length + portfolioRows.length + transitions.length;
  const outputTruncated = projectedRows > MAX_OUTPUT_ROWS;
  const headers = [
    'row_type',
    'month_utc',
    'previous_month_utc',
    'skipped_calendar_months',
    'provider',
    'path_family',
    'path_depth',
    'provider_prompt_groups',
    'complete_no_owned_prompt_groups',
    'unknown_no_owned_prompt_groups',
    'path_families_with_opportunity',
    'distinct_pages',
    'prompt_groups_with_family',
    'share_of_complete_no_owned_prompts_percent',
    'answer_captures_with_family',
    'citation_events',
    'top_three_prompt_groups',
    'first_position_prompt_groups',
    'top_three_citation_events',
    'first_position_citation_events',
    'first_cited_at',
    'last_cited_at',
    'provider_month_opportunity_complete',
    'providers_with_family_count',
    'providers_with_family',
    'providers_with_complete_sample',
    'prompt_groups_with_family_total',
    'provider_equal_mean_prompt_share_percent',
    'provider_minimum_prompt_share_percent',
    'provider_maximum_prompt_share_percent',
    'pooled_provider_prompt_share_percent',
    'comparable_prompt_groups',
    'baseline_present',
    'current_present',
    'gained',
    'lost',
    'both',
    'neither',
    'baseline_reach_percent',
    'current_reach_percent',
    'reach_change_percentage_points',
    'bootstrap_lower_percentage_points',
    'bootstrap_upper_percentage_points',
    'bootstrap_resamples_per_test',
    'exact_mcnemar_p_value',
    'holm_adjusted_mcnemar_p_value',
    'paired_month_comparison_complete',
    'observed_months',
    'observed_month_count',
    'provider_months',
    'path_family_rows',
    'portfolio_path_family_rows',
    'paired_month_comparison_rows',
    'paired_prompt_family_evaluations',
    'paired_bootstrap_resamples_per_test',
    'paired_month_comparison_work_truncated',
    'paired_month_comparisons_complete',
    'provider_month_opportunity_complete',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note = `Families use citation origin plus the first ${pathDepth} non-empty URL path segments. Reach counts distinct normalized provider/prompt/month groups with a family citation and confirmed absence of owned citations in complete source lists. The paired rows compare shared prompts between consecutive sampled months; exact McNemar results receive one Holm adjustment over all provider/family transitions. Cross-provider rows show equal-provider and pooled prompt rates side by side. Citation-event counts can exceed prompt reach because a family can include multiple pages and repeated captures. URL prefixes are structural buckets, not inferred content types; changes describe the supplied manual sample, not causation.`;
  const summary: Record<string, unknown> = {
    row_type: 'summary',
    observed_months: [...observedMonths].sort().join('; '),
    observed_month_count: observedMonths.size,
    provider_months: providerMonths.size,
    provider_prompt_month_groups: promptMonths.size,
    complete_no_owned_prompt_month_groups: orderedProviderMonths.reduce(
      (sum, item) => sum + item.completeNoOwned,
      0
    ),
    unknown_no_owned_prompt_month_groups: orderedProviderMonths.reduce(
      (sum, item) => sum + item.unknownNoOwned,
      0
    ),
    path_family_rows: outputTruncated ? null : familyRows.length,
    portfolio_path_family_rows: outputTruncated ? null : portfolioRows.length,
    paired_month_comparison_rows: outputTruncated || workTruncated ? null : transitions.length,
    paired_prompt_family_evaluations: pairedEvaluations,
    paired_bootstrap_resamples_per_test: maxBootstrapResamples,
    paired_month_comparison_work_truncated: workTruncated,
    paired_month_comparisons_complete: !outputTruncated && !workTruncated,
    provider_month_opportunity_complete: !outputTruncated && summaryComplete,
    output_rows_truncated: outputTruncated,
    path_depth: pathDepth,
    interpretation_note: note,
  };
  const transitionRows = transitions.map((row) => ({
    row_type: 'paired-month-path-family-opportunity',
    previous_month_utc: row.previousMonth,
    month_utc: row.month,
    skipped_calendar_months: row.skippedMonths,
    provider: row.provider,
    path_family: row.family,
    path_depth: pathDepth,
    comparable_prompt_groups: row.comparablePrompts,
    baseline_present: row.baselinePresent,
    current_present: row.currentPresent,
    gained: row.gained,
    lost: row.lost,
    both: row.both,
    neither: row.neither,
    baseline_reach_percent: round((row.baselinePresent / row.comparablePrompts) * 100),
    current_reach_percent: round((row.currentPresent / row.comparablePrompts) * 100),
    reach_change_percentage_points: row.reachChange,
    bootstrap_lower_percentage_points: row.bootstrapLower,
    bootstrap_upper_percentage_points: row.bootstrapUpper,
    bootstrap_resamples_per_test: row.bootstrapResamples,
    exact_mcnemar_p_value: row.exactP,
    holm_adjusted_mcnemar_p_value: row.holmP,
    paired_month_comparison_complete: !workTruncated && row.complete,
  }));
  const outputRows: Record<string, unknown>[] = [
    Object.fromEntries(headers.map((header) => [header, header])),
    summary,
    ...(outputTruncated ? [] : providerMonthSummaries),
    ...(outputTruncated ? [] : familyRows),
    ...(outputTruncated ? [] : portfolioRows),
    ...(outputTruncated || workTruncated ? [] : transitionRows),
  ];
  return `${outputRows.map((row) => headers.map((header) => csvCell(row[header])).join(',')).join('\r\n')}\r\n`;
}

function parseOpportunityCsvRecords(csv: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
    } else {
      cell += character;
    }
  }
  if (quoted)
    throw new Error('Monthly page-opportunity CSV contains an unterminated quoted field.');
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift();
  if (!headers || headers.length === 0) throw new Error('Monthly page-opportunity CSV is empty.');
  return rows
    .filter((record) => record.length === headers.length)
    .map((record) =>
      Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']))
    );
}

/** Render monthly path-family opportunities as a self-contained, filterable dashboard. */
export function renderAiAnswerCitationPageOpportunityPathFamilyTrendsHtmlFromCsv(
  csv: string
): string {
  const records = parseOpportunityCsvRecords(csv);
  const summary = records.find((record) => record.row_type === 'summary');
  if (!summary)
    throw new Error('Monthly page-opportunity path-family CSV is missing its summary row.');
  const providerMonths = records.filter(
    (record) => record.row_type === 'provider-month-opportunity-summary'
  );
  const families = records.filter(
    (record) => record.row_type === 'monthly-path-family-opportunity'
  );
  const portfolio = records.filter(
    (record) => record.row_type === 'cross-provider-monthly-path-family-opportunity'
  );
  const transitions = records.filter(
    (record) => record.row_type === 'paired-month-path-family-opportunity'
  );
  const months = (summary.observed_months ?? '')
    .split(';')
    .map((month) => month.trim())
    .filter(Boolean);
  const monthStates = new Map<string, { hasEligibleSample: boolean }>();
  for (const row of providerMonths) {
    const month = row.month_utc ?? '';
    const state = monthStates.get(month) ?? { hasEligibleSample: false };
    state.hasEligibleSample =
      state.hasEligibleSample || Number(row.complete_no_owned_prompt_groups) > 0;
    monthStates.set(month, state);
  }
  const monthComplete = new Map(
    [...monthStates.entries()].map(([month, state]) => [month, state.hasEligibleSample])
  );

  const escapeHtml = (value: unknown): string =>
    String(value ?? '').replace(
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
  const number = (value: string | undefined, digits = 1): string => {
    if (!value || !Number.isFinite(Number(value))) return '—';
    return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
  };
  const percent = (value: string | undefined): string => (value ? `${number(value)}%` : '—');
  const rowsToTable = (
    id: string,
    title: string,
    description: string,
    rows: Array<Record<string, string>>,
    columns: Array<{
      key: string;
      label: string;
      render?: (row: Record<string, string>) => string;
    }>,
    maximumRows: number
  ): string => {
    const displayed = rows.slice(0, maximumRows);
    const body = displayed
      .map(
        (row) =>
          `<tr>${columns.map((column) => `<td>${escapeHtml(column.render ? column.render(row) : row[column.key])}</td>`).join('')}</tr>`
      )
      .join('');
    return `<section class="panel"><div class="panel-heading"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><label class="filter">Filter <input type="search" data-filter-target="${escapeHtml(id)}" placeholder="Provider, month, path…"></label></div><p class="muted">Showing <span data-row-count="${escapeHtml(id)}">${displayed.length}</span> of ${rows.length.toLocaleString('en-US')} rows${rows.length > displayed.length ? `; export the CSV for the full retained table` : ''}.</p><div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead><tbody id="${escapeHtml(id)}">${body || `<tr><td colspan="${columns.length}" class="empty">No rows retained.</td></tr>`}</tbody></table></div></section>`;
  };

  const familyScores = new Map<string, number>();
  for (const row of portfolio) {
    const family = row.path_family ?? '';
    const score = Number(row.provider_equal_mean_prompt_share_percent);
    if (family && Number.isFinite(score))
      familyScores.set(family, Math.max(familyScores.get(family) ?? 0, score));
  }
  const chartFamilies = [...familyScores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([family]) => family);
  const portfolioByFamilyMonth = new Map(
    portfolio.map((row) => [JSON.stringify([row.month_utc, row.path_family]), row])
  );
  const chartWidth = 980;
  const chartHeight = 390;
  const margin = { top: 24, right: 270, bottom: 62, left: 70 };
  const plotWidth = chartWidth - margin.left - margin.right;
  const plotHeight = chartHeight - margin.top - margin.bottom;
  const colors = ['#0b6e69', '#d87938', '#5a6dcb', '#b65070', '#6e8b3d', '#8c5ab8'];
  const y = (share: number): number => margin.top + ((100 - share) / 100) * plotHeight;
  const x = (index: number): number =>
    margin.left + (months.length <= 1 ? plotWidth / 2 : (index / (months.length - 1)) * plotWidth);
  const grid = [0, 25, 50, 75, 100]
    .map(
      (tick) =>
        `<g><line x1="${margin.left}" y1="${y(tick)}" x2="${chartWidth - margin.right}" y2="${y(tick)}" stroke="#dce4e2"/><text x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end" fill="#60726f" font-size="12">${tick}%</text></g>`
    )
    .join('');
  const monthLabels = months
    .map(
      (month, index) =>
        `<text x="${x(index)}" y="${chartHeight - 25}" text-anchor="middle" fill="#60726f" font-size="11">${escapeHtml(month)}</text>`
    )
    .join('');
  const series = chartFamilies
    .map((family, familyIndex) => {
      const color = colors[familyIndex % colors.length]!;
      const segments: string[] = [];
      let currentSegment: string[] = [];
      months.forEach((month, monthIndex) => {
        if (!monthComplete.get(month)) {
          if (currentSegment.length) segments.push(currentSegment.join(' '));
          currentSegment = [];
          return;
        }
        const row = portfolioByFamilyMonth.get(JSON.stringify([month, family]));
        const share = row ? Number(row.provider_equal_mean_prompt_share_percent) : 0;
        if (!Number.isFinite(share)) {
          if (currentSegment.length) segments.push(currentSegment.join(' '));
          currentSegment = [];
          return;
        }
        currentSegment.push(
          `${currentSegment.length === 0 ? 'M' : 'L'} ${x(monthIndex).toFixed(1)} ${y(share).toFixed(1)}`
        );
      });
      if (currentSegment.length) segments.push(currentSegment.join(' '));
      const paths = segments
        .map(
          (segment) =>
            `<path d="${segment}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
        )
        .join('');
      const points = months
        .flatMap((month, monthIndex) => {
          if (!monthComplete.get(month)) return [];
          const row = portfolioByFamilyMonth.get(JSON.stringify([month, family]));
          const share = row ? Number(row.provider_equal_mean_prompt_share_percent) : 0;
          if (!Number.isFinite(share)) return [];
          return [
            `<circle cx="${x(monthIndex).toFixed(1)}" cy="${y(share).toFixed(1)}" r="3.5" fill="${color}"><title>${escapeHtml(family)} · ${escapeHtml(month)}: ${share.toFixed(1)}%</title></circle>`,
          ];
        })
        .join('');
      const latest = [...months].reverse().find((month) => monthComplete.get(month));
      const latestRow = latest
        ? portfolioByFamilyMonth.get(JSON.stringify([latest, family]))
        : undefined;
      const latestShare = latestRow
        ? `${number(latestRow.provider_equal_mean_prompt_share_percent)}%`
        : '0%';
      const legendY = margin.top + familyIndex * 42 + 8;
      const legend = `<g><line x1="${chartWidth - margin.right + 20}" y1="${legendY}" x2="${chartWidth - margin.right + 42}" y2="${legendY}" stroke="${color}" stroke-width="3"/><text x="${chartWidth - margin.right + 50}" y="${legendY + 4}" fill="#243330" font-size="11">${escapeHtml(family.length > 34 ? `${family.slice(0, 31)}…` : family)}</text><text x="${chartWidth - margin.right + 50}" y="${legendY + 19}" fill="#60726f" font-size="10">Latest complete month: ${escapeHtml(latestShare)}</text></g>`;
      return `${paths}${points}${legend}`;
    })
    .join('');
  const chart =
    chartFamilies.length > 0
      ? `<section class="panel"><h2>Path-family reach over time</h2><p>Up to six families with the highest provider-equal reach in any month. A zero is shown only for months with at least one complete no-owned provider/month denominator; unknown citation lists remain outside the rate.</p><div class="chart-wrap"><svg viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Monthly provider-equal path-family prompt reach chart">${grid}${monthLabels}${series}</svg></div><p class="muted">The line is the mean of provider/month prompt reach among providers with complete no-owned samples. Unknown groups are excluded and flagged in the tables; the chart is not a provider-visibility estimate.</p></section>`
      : '<section class="panel"><h2>Path-family reach over time</h2><p class="empty">No cross-provider path-family rows were retained for the chart.</p></section>';
  const incomplete =
    summary.provider_month_opportunity_complete !== 'true' ||
    summary.output_rows_truncated === 'true' ||
    summary.paired_month_comparison_work_truncated === 'true';
  const status = incomplete
    ? '<span class="status warn">Incomplete or capped</span>'
    : '<span class="status good">Source opportunity coverage complete</span>';
  const familyTable = rowsToTable(
    'families',
    'Provider and family by month',
    'Reach counts each exact prompt once per provider/month/family. Citation events and answer captures are separate volume measures.',
    families.sort(
      (left, right) =>
        Number(right.share_of_complete_no_owned_prompts_percent) -
        Number(left.share_of_complete_no_owned_prompts_percent)
    ),
    [
      { key: 'month_utc', label: 'Month' },
      { key: 'provider', label: 'Provider' },
      { key: 'path_family', label: 'Path family' },
      {
        key: 'share_of_complete_no_owned_prompts_percent',
        label: 'Prompt reach',
        render: (row) => percent(row.share_of_complete_no_owned_prompts_percent),
      },
      { key: 'prompt_groups_with_family', label: 'Prompts' },
      { key: 'complete_no_owned_prompt_groups', label: 'Complete no-owned' },
      { key: 'unknown_no_owned_prompt_groups', label: 'Unknown' },
      { key: 'distinct_pages', label: 'Pages' },
      { key: 'citation_events', label: 'Citation events' },
      { key: 'top_three_prompt_groups', label: 'Top 3 prompts' },
      { key: 'first_cited_at', label: 'First cited' },
      { key: 'last_cited_at', label: 'Last cited' },
    ],
    1_000
  );
  const portfolioTable = rowsToTable(
    'portfolio',
    'Cross-provider path-family reach',
    'Equal-provider means weight each eligible provider/month once; pooled reach weights each complete provider/prompt group once.',
    portfolio.sort(
      (left, right) =>
        Number(right.provider_equal_mean_prompt_share_percent) -
        Number(left.provider_equal_mean_prompt_share_percent)
    ),
    [
      { key: 'month_utc', label: 'Month' },
      { key: 'path_family', label: 'Path family' },
      {
        key: 'provider_equal_mean_prompt_share_percent',
        label: 'Provider-equal mean',
        render: (row) => percent(row.provider_equal_mean_prompt_share_percent),
      },
      {
        key: 'pooled_provider_prompt_share_percent',
        label: 'Pooled reach',
        render: (row) => percent(row.pooled_provider_prompt_share_percent),
      },
      { key: 'providers_with_family_count', label: 'Providers with family' },
      { key: 'providers_with_complete_sample', label: 'Providers sampled' },
      { key: 'distinct_pages', label: 'Pages' },
      { key: 'citation_events_total', label: 'Citation events' },
    ],
    1_000
  );
  const transitionTable = rowsToTable(
    'transitions',
    'Matched prompt transitions',
    'Consecutive sampled months are compared on shared exact prompts with complete citation lists and confirmed no-owned status in both months.',
    transitions.sort(
      (left, right) =>
        Number(left.holm_adjusted_mcnemar_p_value) - Number(right.holm_adjusted_mcnemar_p_value)
    ),
    [
      { key: 'provider', label: 'Provider' },
      { key: 'previous_month_utc', label: 'From' },
      { key: 'month_utc', label: 'To' },
      { key: 'path_family', label: 'Path family' },
      { key: 'comparable_prompt_groups', label: 'Matched prompts' },
      {
        key: 'baseline_reach_percent',
        label: 'Before',
        render: (row) => percent(row.baseline_reach_percent),
      },
      {
        key: 'current_reach_percent',
        label: 'After',
        render: (row) => percent(row.current_reach_percent),
      },
      { key: 'reach_change_percentage_points', label: 'Change (pp)' },
      { key: 'gained', label: 'Gained' },
      { key: 'lost', label: 'Lost' },
      {
        key: 'holm_adjusted_mcnemar_p_value',
        label: 'Holm p',
        render: (row) => number(row.holm_adjusted_mcnemar_p_value, 4),
      },
      { key: 'bootstrap_lower_percentage_points', label: '95% CI lower' },
      { key: 'bootstrap_upper_percentage_points', label: '95% CI upper' },
    ],
    500
  );
  const sourceNote =
    summary.interpretation_note ??
    'Path families are structural URL prefixes and describe only the supplied sampled answers.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>GEO page-opportunity path-family trends</title><style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#243330;background:#f2f5f3;font-synthesis:none;text-rendering:optimizeLegibility}*{box-sizing:border-box}body{margin:0}.shell{max-width:1500px;margin:0 auto;padding:32px 24px 56px}header{padding:30px 32px;border-radius:18px;background:#153b35;color:#f6faf8;box-shadow:0 12px 32px #173d3520}h1{margin:0;font-size:clamp(1.7rem,3vw,2.7rem);letter-spacing:-.04em}header p{max-width:900px;color:#d1e1dc;line-height:1.55}.eyebrow{text-transform:uppercase;letter-spacing:.14em;font-weight:700;font-size:.72rem;color:#9dd8c9}.status{display:inline-flex;padding:6px 10px;border-radius:999px;font-weight:700;font-size:.8rem}.status.good{background:#d9f2e8;color:#17533d}.status.warn{background:#fff0d7;color:#784817}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:18px 0}.card,.panel{background:#fff;border:1px solid #dfe7e3;border-radius:14px;box-shadow:0 4px 18px #1c392b08}.card{padding:18px}.card small{display:block;color:#647571;font-size:.78rem;text-transform:uppercase;letter-spacing:.07em}.card strong{display:block;margin-top:8px;font-size:1.7rem;letter-spacing:-.03em}.panel{padding:22px;margin:14px 0}.panel h2{margin:0 0 6px;font-size:1.15rem}.panel p{color:#5b6d68;line-height:1.5;margin:4px 0 14px}.panel-heading{display:flex;justify-content:space-between;gap:18px;align-items:flex-end}.filter{font-size:.8rem;color:#586a65;white-space:nowrap}.filter input{display:block;margin-top:5px;min-width:240px;border:1px solid #cdd8d3;border-radius:8px;padding:9px 11px;font:inherit}.table-wrap{overflow:auto;border:1px solid #e1e8e4;border-radius:10px}table{border-collapse:collapse;width:100%;font-size:.83rem;white-space:nowrap}th{position:sticky;top:0;background:#edf3f0;color:#536660;text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em}th,td{padding:9px 11px;border-bottom:1px solid #e7ece9}tbody tr:hover{background:#f4f8f6}.muted{color:#778681!important;font-size:.78rem}.empty{color:#788680;text-align:center;padding:24px}.chart-wrap{width:100%;overflow:auto}.chart-wrap svg{display:block;min-width:760px;width:100%;height:auto}.footnote{font-size:.84rem;color:#5c6e68;line-height:1.6;padding:10px 4px}@media(max-width:700px){.shell{padding:16px 12px 36px}header,.panel{padding:20px}.panel-heading{display:block}.filter{display:block;margin-top:12px}.filter input{width:100%;min-width:0}}
  </style></head><body><main class="shell"><header><div class="eyebrow">Aviary · Generative Engine Optimization</div><h1>Page-opportunity path-family trends</h1><p>Track which competitor URL prefixes appear in provider answers when owned citations are confirmed absent. Reach is prompt-balanced within provider/month; it does not identify why a source was selected.</p>${status}</header><section class="cards"><div class="card"><small>Observed UTC months</small><strong>${months.length.toLocaleString('en-US')}</strong></div><div class="card"><small>Provider/month panels</small><strong>${number(summary.provider_months, 0)}</strong></div><div class="card"><small>Family reach rows</small><strong>${number(summary.path_family_rows, 0)}</strong></div><div class="card"><small>Paired family transitions</small><strong>${number(summary.paired_month_comparison_rows, 0)}</strong></div><div class="card"><small>Paired prompt/family checks</small><strong>${number(summary.paired_prompt_family_evaluations, 0)}</strong></div></section>${chart}${familyTable}${portfolioTable}${transitionTable}<p class="footnote">${escapeHtml(sourceNote)} Unknown citation lists are not treated as confirmed owned-page absence. Provider-equal and pooled views answer different weighting questions. Holm-adjusted p-values account for the reported provider/family/month comparison family; intervals can be absent when the bounded bootstrap budget or prompt support is too small.</p></main><script>
    document.querySelectorAll('input[data-filter-target]').forEach((input)=>{const body=document.getElementById(input.dataset.filterTarget);const count=document.querySelector('[data-row-count="'+input.dataset.filterTarget+'"]');if(!body||!count)return;const rows=[...body.querySelectorAll('tr')];const update=()=>{const q=input.value.trim().toLocaleLowerCase();let shown=0;for(const row of rows){const visible=row.textContent.toLocaleLowerCase().includes(q);row.hidden=!visible;if(visible)shown++;}count.textContent=String(shown);};input.addEventListener('input',update);});
  </script></body></html>`;
}

/** Gate significant monthly increases in confirmed-no-owned exact-page reach from the paired trend CSV. */
export function assessAiAnswerCitationPageOpportunityMonthlyRiseGateFromCsv(
  csv: string,
  thresholdPercentagePoints: number,
  alpha = 0.05,
  minimumComparablePromptGroups = 10
): AiAnswerCitationPageOpportunityMonthlyRiseGateAssessment {
  if (
    !Number.isFinite(thresholdPercentagePoints) ||
    thresholdPercentagePoints < 0 ||
    thresholdPercentagePoints > 100
  ) {
    throw new Error(
      'Monthly page-opportunity rise threshold must be from 0 to 100 percentage points.'
    );
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1)
    throw new Error('Monthly page-opportunity rise alpha must be greater than 0 and at most 1.');
  if (!Number.isInteger(minimumComparablePromptGroups) || minimumComparablePromptGroups < 1) {
    throw new Error('Monthly page-opportunity rise support must be a positive integer.');
  }
  const records = parseOpportunityCsvRecords(csv);
  const summary = records.find((record) => record.row_type === 'summary');
  const pairRows = records.filter((record) => record.row_type === 'paired-month-page-opportunity');
  const incompleteReasons: string[] = [];
  if (!summary) incompleteReasons.push('Monthly page-opportunity summary row is missing.');
  const numeric = (value: string | undefined): number =>
    value === undefined || value.trim() === '' ? Number.NaN : Number(value);
  const reportedRows = numeric(summary?.paired_month_comparison_rows);
  const promptPageEvaluations = numeric(summary?.paired_month_prompt_page_evaluations);
  const bootstrapResamples = numeric(summary?.paired_month_bootstrap_resamples_per_test);
  if (
    summary?.paired_month_comparisons_complete !== 'true' ||
    summary?.paired_month_comparison_work_truncated === 'true' ||
    summary?.output_rows_truncated === 'true'
  ) {
    incompleteReasons.push('Paired monthly page-comparison coverage or output was truncated.');
  }
  if (summary?.provider_month_opportunity_complete !== 'true') {
    incompleteReasons.push(
      'At least one provider/month has unknown no-owned citation-list support.'
    );
  }
  if (!Number.isInteger(reportedRows) || reportedRows !== pairRows.length) {
    incompleteReasons.push('Retained paired-page row count does not match the summary.');
  }
  if (pairRows.length === 0)
    incompleteReasons.push('No paired provider/page/month transitions were available.');
  const parsedRows = pairRows.map((record) => ({
    provider: record.provider ?? '',
    previousMonthUtc: record.previous_month_utc ?? '',
    monthUtc: record.month_utc ?? '',
    pageUrl: record.page_url ?? '',
    comparablePromptGroups: numeric(record.comparable_prompt_groups),
    gained: numeric(record.gained),
    lost: numeric(record.lost),
    reachChangePercentagePoints: numeric(record.reach_change_percentage_points),
    holmAdjustedPValue: numeric(record.holm_adjusted_mcnemar_p_value),
  }));
  if (
    parsedRows.some(
      (row) =>
        !Number.isInteger(row.comparablePromptGroups) ||
        row.comparablePromptGroups < 1 ||
        !Number.isInteger(row.gained) ||
        row.gained < 0 ||
        !Number.isInteger(row.lost) ||
        row.lost < 0 ||
        !Number.isFinite(row.reachChangePercentagePoints) ||
        !Number.isFinite(row.holmAdjustedPValue) ||
        row.holmAdjustedPValue < 0 ||
        row.holmAdjustedPValue > 1 ||
        !row.provider ||
        !row.previousMonthUtc ||
        !row.monthUtc ||
        !row.pageUrl
    )
  ) {
    incompleteReasons.push(
      'At least one paired page row has invalid support or statistical values.'
    );
  }
  const eligibleRows = parsedRows.filter(
    (row) => row.comparablePromptGroups >= minimumComparablePromptGroups
  );
  if (eligibleRows.length === 0)
    incompleteReasons.push('No paired page comparison meets the minimum prompt-support floor.');
  const failures = eligibleRows
    .filter(
      (row) =>
        row.reachChangePercentagePoints >= thresholdPercentagePoints &&
        row.holmAdjustedPValue <= alpha
    )
    .map((row) => ({
      provider: row.provider,
      previousMonthUtc: row.previousMonthUtc,
      monthUtc: row.monthUtc,
      pageUrl: row.pageUrl,
      comparablePromptGroups: row.comparablePromptGroups,
      gainedPrompts: row.gained,
      lostPrompts: row.lost,
      reachChangePercentagePoints: row.reachChangePercentagePoints,
      holmAdjustedPValue: row.holmAdjustedPValue,
    }))
    .sort(
      (left, right) =>
        right.reachChangePercentagePoints - left.reachChangePercentagePoints ||
        left.provider.localeCompare(right.provider) ||
        left.pageUrl.localeCompare(right.pageUrl)
    );
  return {
    metric: 'confirmed-no-owned-exact-page-reach',
    thresholdPercentagePoints,
    alpha,
    minimumComparablePromptGroups,
    evaluatedComparisons: pairRows.length,
    eligibleComparisons: eligibleRows.length,
    holmFamilySize:
      Number.isInteger(reportedRows) && reportedRows === pairRows.length ? reportedRows : null,
    pairedMonthPromptPageEvaluations: Number.isFinite(promptPageEvaluations)
      ? promptPageEvaluations
      : null,
    bootstrapResamplesPerTest: Number.isInteger(bootstrapResamples) ? bootstrapResamples : null,
    complete: incompleteReasons.length === 0,
    incompleteReasons: [...new Set(incompleteReasons)],
    exceeded: failures.length > 0,
    failures,
  };
}

/** Render the monthly page-opportunity rise-gate assessment as versioned JSON. */
export function renderAiAnswerCitationPageOpportunityMonthlyRiseGateJson(
  assessment: AiAnswerCitationPageOpportunityMonthlyRiseGateAssessment
): string {
  return `${JSON.stringify(
    {
      source: 'Aviary monthly page-opportunity rise gate assessment',
      schemaVersion: 1,
      ...assessment,
    },
    null,
    2
  )}\n`;
}

/** Gate significant monthly gains in confirmed-no-owned path-family reach from the paired trend CSV. */
export function assessAiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateFromCsv(
  csv: string,
  thresholdPercentagePoints: number,
  alpha = 0.05,
  minimumComparablePromptGroups = 10
): AiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateAssessment {
  if (
    !Number.isFinite(thresholdPercentagePoints) ||
    thresholdPercentagePoints < 0 ||
    thresholdPercentagePoints > 100
  ) {
    throw new Error(
      'Monthly page-opportunity path-family rise threshold must be from 0 to 100 percentage points.'
    );
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
    throw new Error(
      'Monthly page-opportunity path-family alpha must be greater than 0 and at most 1.'
    );
  }
  if (!Number.isInteger(minimumComparablePromptGroups) || minimumComparablePromptGroups < 1) {
    throw new Error('Monthly page-opportunity path-family support must be a positive integer.');
  }
  const records = parseOpportunityCsvRecords(csv);
  const summary = records.find((record) => record.row_type === 'summary');
  const pairRows = records.filter(
    (record) => record.row_type === 'paired-month-path-family-opportunity'
  );
  const incompleteReasons: string[] = [];
  if (!summary)
    incompleteReasons.push('Monthly page-opportunity path-family summary row is missing.');
  const numeric = (value: string | undefined): number =>
    value === undefined || value.trim() === '' ? Number.NaN : Number(value);
  const reportedRows = numeric(summary?.paired_month_comparison_rows);
  const evaluations = numeric(summary?.paired_prompt_family_evaluations);
  const bootstrapResamples = numeric(summary?.paired_bootstrap_resamples_per_test);
  if (
    summary?.paired_month_comparisons_complete !== 'true' ||
    summary?.paired_month_comparison_work_truncated === 'true' ||
    summary?.output_rows_truncated === 'true'
  ) {
    incompleteReasons.push(
      'Paired monthly path-family comparison coverage or output was truncated.'
    );
  }
  if (summary?.provider_month_opportunity_complete !== 'true') {
    incompleteReasons.push(
      'At least one provider/month has unknown no-owned citation-list support.'
    );
  }
  if (!Number.isInteger(reportedRows) || reportedRows !== pairRows.length) {
    incompleteReasons.push('Retained paired path-family row count does not match the summary.');
  }
  if (pairRows.length === 0)
    incompleteReasons.push('No paired provider/path-family/month transitions were available.');
  const parsedRows = pairRows.map((record) => ({
    provider: record.provider ?? '',
    previousMonthUtc: record.previous_month_utc ?? '',
    monthUtc: record.month_utc ?? '',
    pathFamily: record.path_family ?? '',
    comparablePromptGroups: numeric(record.comparable_prompt_groups),
    gained: numeric(record.gained),
    lost: numeric(record.lost),
    reachChangePercentagePoints: numeric(record.reach_change_percentage_points),
    holmAdjustedPValue: numeric(record.holm_adjusted_mcnemar_p_value),
    complete: record.paired_month_comparison_complete === 'true',
  }));
  if (
    parsedRows.some(
      (row) =>
        !Number.isInteger(row.comparablePromptGroups) ||
        row.comparablePromptGroups < 1 ||
        !Number.isInteger(row.gained) ||
        row.gained < 0 ||
        !Number.isInteger(row.lost) ||
        row.lost < 0 ||
        !Number.isFinite(row.reachChangePercentagePoints) ||
        !Number.isFinite(row.holmAdjustedPValue) ||
        row.holmAdjustedPValue < 0 ||
        row.holmAdjustedPValue > 1 ||
        !row.provider ||
        !row.previousMonthUtc ||
        !row.monthUtc ||
        !row.pathFamily
    )
  ) {
    incompleteReasons.push(
      'At least one paired path-family row has invalid support or statistical values.'
    );
  }
  if (parsedRows.some((row) => !row.complete))
    incompleteReasons.push(
      'At least one paired path-family row has incomplete provider/month support.'
    );
  const eligibleRows = parsedRows.filter(
    (row) => row.comparablePromptGroups >= minimumComparablePromptGroups
  );
  if (eligibleRows.length === 0)
    incompleteReasons.push(
      'No paired path-family comparison meets the minimum prompt-support floor.'
    );
  const failures = eligibleRows
    .filter(
      (row) =>
        row.reachChangePercentagePoints >= thresholdPercentagePoints &&
        row.holmAdjustedPValue <= alpha
    )
    .map((row) => ({
      provider: row.provider,
      previousMonthUtc: row.previousMonthUtc,
      monthUtc: row.monthUtc,
      pathFamily: row.pathFamily,
      comparablePromptGroups: row.comparablePromptGroups,
      gainedPrompts: row.gained,
      lostPrompts: row.lost,
      reachChangePercentagePoints: row.reachChangePercentagePoints,
      holmAdjustedPValue: row.holmAdjustedPValue,
    }))
    .sort(
      (left, right) =>
        right.reachChangePercentagePoints - left.reachChangePercentagePoints ||
        left.provider.localeCompare(right.provider) ||
        left.pathFamily.localeCompare(right.pathFamily)
    );
  return {
    metric: 'confirmed-no-owned-path-family-reach',
    thresholdPercentagePoints,
    alpha,
    minimumComparablePromptGroups,
    evaluatedComparisons: pairRows.length,
    eligibleComparisons: eligibleRows.length,
    holmFamilySize:
      Number.isInteger(reportedRows) && reportedRows === pairRows.length ? reportedRows : null,
    pairedPromptFamilyEvaluations: Number.isFinite(evaluations) ? evaluations : null,
    bootstrapResamplesPerTest: Number.isInteger(bootstrapResamples) ? bootstrapResamples : null,
    complete: incompleteReasons.length === 0,
    incompleteReasons: [...new Set(incompleteReasons)],
    exceeded: failures.length > 0,
    failures,
  };
}

/** Render the monthly path-family opportunity rise-gate assessment as versioned JSON. */
export function renderAiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateJson(
  assessment: AiAnswerCitationPageOpportunityPathFamilyMonthlyRiseGateAssessment
): string {
  return `${JSON.stringify(
    {
      source: 'Aviary monthly page-opportunity path-family rise gate assessment',
      schemaVersion: 1,
      ...assessment,
    },
    null,
    2
  )}\n`;
}

interface PromptPathFamilyOpportunity {
  provider: string;
  detailComplete: boolean;
  ownedCitationPresent: boolean;
  families: Map<
    string,
    {
      pages: Set<string>;
      citationEvents: number;
      answerCaptures: number;
      topThreeCitationEvents: number;
      firstPositionCitationEvents: number;
      appearedInTopThree: boolean;
      appearedFirst: boolean;
      firstCitedAt: number;
      lastCitedAt: number;
    }
  >;
}

interface ProviderPathFamilyOpportunity {
  provider: string;
  providerPromptGroups: number;
  completeNoOwnedPromptGroups: number;
  unknownNoOwnedPromptGroups: number;
  families: Map<
    string,
    {
      promptGroups: number;
      pages: Set<string>;
      citationEvents: number;
      answerCaptures: number;
      topThreePromptGroups: number;
      firstPositionPromptGroups: number;
      topThreeCitationEvents: number;
      firstPositionCitationEvents: number;
      firstCitedAt: number;
      lastCitedAt: number;
    }
  >;
}

/** Aggregate confirmed-no-owned exact-page opportunities into origin/path-prefix families. */
export function renderAiAnswerCitationPageOpportunityPathFamiliesCsv(
  observations: AiAnswerCitationObservationInput[],
  ownedDomains: string[],
  pathDepth: number
): string {
  if (ownedDomains.length === 0)
    throw new Error('Page opportunity path families require at least one owned domain.');
  if (!Number.isInteger(pathDepth) || pathDepth < 1 || pathDepth > 5) {
    throw new Error('Page opportunity path-family depth must be an integer from 1 to 5.');
  }
  const normalizedOwnedDomains = [...new Set(ownedDomains.map(normalizeOwnedDomain))];
  const groups = new Map<string, PromptPathFamilyOpportunity>();
  for (const [index, observation] of observations.entries()) {
    if (
      !observation ||
      typeof observation.provider !== 'string' ||
      !observation.provider.trim() ||
      typeof observation.prompt !== 'string' ||
      !observation.prompt.trim() ||
      !Array.isArray(observation.citedUrls) ||
      observation.citedUrls.length > MAX_CITATIONS_PER_OBSERVATION
    ) {
      throw new Error(
        `Observation ${index + 1} is invalid for page opportunity path-family analysis.`
      );
    }
    if (
      observation.citationListComplete !== undefined &&
      typeof observation.citationListComplete !== 'boolean'
    ) {
      throw new Error(`Observation ${index + 1} citationListComplete must be a boolean.`);
    }
    const providerKey = normalizedLabel(observation.provider);
    const promptKey = normalizedLabel(observation.prompt);
    if (!providerKey || !promptKey)
      throw new Error(`Observation ${index + 1} requires a non-empty provider and prompt.`);
    const observedTime = Date.parse(observation.observedAt);
    if (!Number.isFinite(observedTime))
      throw new Error(`Observation ${index + 1} has an invalid observedAt value.`);
    const key = JSON.stringify([providerKey, promptKey]);
    const group = groups.get(key) ?? {
      provider: observation.provider,
      detailComplete: true,
      ownedCitationPresent: false,
      families: new Map(),
    };
    group.detailComplete =
      group.detailComplete &&
      (observation.citationListComplete ??
        observation.citedUrls.length < MAX_CITATIONS_PER_OBSERVATION);
    const seenUrls = new Set<string>();
    const seenFamilies = new Set<string>();
    observation.citedUrls.forEach((rawUrl, position) => {
      const pageUrl = normalizePageUrl(rawUrl);
      if (seenUrls.has(pageUrl)) return;
      seenUrls.add(pageUrl);
      if (isOwnedPage(pageUrl, normalizedOwnedDomains)) group.ownedCitationPresent = true;
      const url = new URL(pageUrl);
      const segments = url.pathname.split('/').filter(Boolean).slice(0, pathDepth);
      const family = `${url.origin}${segments.length > 0 ? `/${segments.join('/')}` : '/'}`;
      const profile = group.families.get(family) ?? {
        pages: new Set<string>(),
        citationEvents: 0,
        answerCaptures: 0,
        topThreeCitationEvents: 0,
        firstPositionCitationEvents: 0,
        appearedInTopThree: false,
        appearedFirst: false,
        firstCitedAt: observedTime,
        lastCitedAt: observedTime,
      };
      profile.pages.add(pageUrl);
      profile.citationEvents += 1;
      if (!seenFamilies.has(family)) {
        profile.answerCaptures += 1;
        seenFamilies.add(family);
      }
      if (position < 3) {
        profile.topThreeCitationEvents += 1;
        profile.appearedInTopThree = true;
      }
      if (position === 0) {
        profile.firstPositionCitationEvents += 1;
        profile.appearedFirst = true;
      }
      profile.firstCitedAt = Math.min(profile.firstCitedAt, observedTime);
      profile.lastCitedAt = Math.max(profile.lastCitedAt, observedTime);
      group.families.set(family, profile);
    });
    groups.set(key, group);
  }

  const providers = new Map<string, ProviderPathFamilyOpportunity>();
  for (const group of groups.values()) {
    const providerKey = normalizedLabel(group.provider);
    const provider = providers.get(providerKey) ?? {
      provider: group.provider,
      providerPromptGroups: 0,
      completeNoOwnedPromptGroups: 0,
      unknownNoOwnedPromptGroups: 0,
      families: new Map(),
    };
    provider.providerPromptGroups += 1;
    if (group.ownedCitationPresent) {
      providers.set(providerKey, provider);
      continue;
    }
    if (!group.detailComplete) {
      provider.unknownNoOwnedPromptGroups += 1;
      providers.set(providerKey, provider);
      continue;
    }
    provider.completeNoOwnedPromptGroups += 1;
    for (const [family, profile] of group.families) {
      if (
        profile.pages.size > 0 &&
        [...profile.pages].every((pageUrl) => isOwnedPage(pageUrl, normalizedOwnedDomains))
      )
        continue;
      const aggregate = provider.families.get(family) ?? {
        promptGroups: 0,
        pages: new Set<string>(),
        citationEvents: 0,
        answerCaptures: 0,
        topThreePromptGroups: 0,
        firstPositionPromptGroups: 0,
        topThreeCitationEvents: 0,
        firstPositionCitationEvents: 0,
        firstCitedAt: profile.firstCitedAt,
        lastCitedAt: profile.lastCitedAt,
      };
      aggregate.promptGroups += 1;
      profile.pages.forEach((pageUrl) => aggregate.pages.add(pageUrl));
      aggregate.citationEvents += profile.citationEvents;
      aggregate.answerCaptures += profile.answerCaptures;
      if (profile.appearedInTopThree) aggregate.topThreePromptGroups += 1;
      if (profile.appearedFirst) aggregate.firstPositionPromptGroups += 1;
      aggregate.topThreeCitationEvents += profile.topThreeCitationEvents;
      aggregate.firstPositionCitationEvents += profile.firstPositionCitationEvents;
      aggregate.firstCitedAt = Math.min(aggregate.firstCitedAt, profile.firstCitedAt);
      aggregate.lastCitedAt = Math.max(aggregate.lastCitedAt, profile.lastCitedAt);
      provider.families.set(family, aggregate);
    }
    providers.set(providerKey, provider);
  }

  const rows = [...providers.values()].flatMap((provider) =>
    [...provider.families.entries()].map(([family, profile]) => ({
      provider: provider.provider,
      pathFamily: family,
      providerPromptGroups: provider.providerPromptGroups,
      completeNoOwnedPromptGroups: provider.completeNoOwnedPromptGroups,
      unknownNoOwnedPromptGroups: provider.unknownNoOwnedPromptGroups,
      pathDepth,
      pageCount: profile.pages.size,
      promptGroupsWithFamily: profile.promptGroups,
      promptSharePercent:
        provider.completeNoOwnedPromptGroups > 0
          ? round((profile.promptGroups / provider.completeNoOwnedPromptGroups) * 100)
          : null,
      capturesWithFamily: profile.answerCaptures,
      citationEvents: profile.citationEvents,
      topThreePromptGroups: profile.topThreePromptGroups,
      firstPositionPromptGroups: profile.firstPositionPromptGroups,
      topThreeCitationEvents: profile.topThreeCitationEvents,
      firstPositionCitationEvents: profile.firstPositionCitationEvents,
      firstCitedAt: new Date(profile.firstCitedAt).toISOString(),
      lastCitedAt: new Date(profile.lastCitedAt).toISOString(),
      providerOpportunityComplete: provider.unknownNoOwnedPromptGroups === 0,
    }))
  );
  rows.sort(
    (left, right) =>
      right.promptGroupsWithFamily - left.promptGroupsWithFamily ||
      right.pageCount - left.pageCount ||
      left.provider.localeCompare(right.provider) ||
      left.pathFamily.localeCompare(right.pathFamily)
  );
  const truncated = rows.length > MAX_OUTPUT_ROWS;
  const headers = [
    'row_type',
    'provider',
    'path_family',
    'path_depth',
    'provider_prompt_groups',
    'complete_no_owned_prompt_groups',
    'unknown_no_owned_prompt_groups',
    'distinct_pages',
    'prompt_groups_with_family',
    'share_of_complete_no_owned_prompts_percent',
    'answer_captures_with_family',
    'citation_events',
    'top_three_prompt_groups',
    'first_position_prompt_groups',
    'top_three_citation_events',
    'first_position_citation_events',
    'first_cited_at',
    'last_cited_at',
    'provider_opportunity_complete',
    'path_family_rows',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note = `Each path family is an exact citation origin plus its first ${pathDepth} non-empty URL path segment${pathDepth === 1 ? '' : 's'} after query and fragment removal. A family is counted only on normalized provider/exact-prompt groups where every repeated citation list is complete and no configured owned domain appears. These URL prefixes are structural buckets, not inferred content types. Incomplete no-owned groups remain unknown; contexts are pooled within provider/prompt; no prompt text is exported. Results describe this manual sample, not causation or provider preference.`;
  const summary: Record<string, unknown> = {
    row_type: 'summary',
    path_depth: pathDepth,
    provider_count: providers.size,
    provider_prompt_groups: groups.size,
    complete_no_owned_prompt_groups: [...providers.values()].reduce(
      (sum, provider) => sum + provider.completeNoOwnedPromptGroups,
      0
    ),
    unknown_no_owned_prompt_groups: [...providers.values()].reduce(
      (sum, provider) => sum + provider.unknownNoOwnedPromptGroups,
      0
    ),
    path_family_rows: truncated ? null : rows.length,
    provider_opportunity_complete:
      !truncated &&
      [...providers.values()].every((provider) => provider.unknownNoOwnedPromptGroups === 0),
    output_rows_truncated: truncated,
    interpretation_note: note,
  };
  const outputRows: Record<string, unknown>[] = [
    Object.fromEntries(headers.map((header) => [header, header])),
    summary,
    ...(truncated
      ? []
      : rows.map((row) => ({
          row_type: 'page-opportunity-path-family',
          ...snakeCaseCsvRecord(row),
        }))),
  ];
  return `${outputRows.map((row) => headers.map((header) => csvCell(row[header])).join(',')).join('\r\n')}\r\n`;
}

/** Compare how confirmed-no-owned page opportunities group at each supported URL path depth. */
export function renderAiAnswerCitationPageOpportunityPathFamilyDepthSweepCsv(
  observations: AiAnswerCitationObservationInput[],
  ownedDomains: string[]
): string {
  const depths = [1, 2, 3, 4, 5];
  const depthSummaries: Record<string, unknown>[] = [];
  const familyRows: Record<string, unknown>[] = [];
  let sourceCoverageComplete = true;
  let sourceRowsTruncated = false;
  let totalFamilyRows = 0;
  for (const pathDepth of depths) {
    const records = parseOpportunityCsvRecords(
      renderAiAnswerCitationPageOpportunityPathFamiliesCsv(observations, ownedDomains, pathDepth)
    );
    const summary = records.find((record) => record.row_type === 'summary');
    if (!summary)
      throw new Error(
        `Page-opportunity path-family depth ${pathDepth} is missing its summary row.`
      );
    const rows = records.filter((record) => record.row_type === 'page-opportunity-path-family');
    const reportedRows =
      summary.path_family_rows === undefined || summary.path_family_rows.trim() === ''
        ? Number.NaN
        : Number(summary.path_family_rows);
    const outputTruncated = summary.output_rows_truncated === 'true';
    const depthComplete =
      summary.provider_opportunity_complete === 'true' &&
      !outputTruncated &&
      Number.isInteger(reportedRows) &&
      reportedRows === rows.length;
    if (!depthComplete) sourceCoverageComplete = false;
    if (
      outputTruncated ||
      (!Number.isInteger(reportedRows) && summary.output_rows_truncated !== 'true')
    )
      sourceRowsTruncated = true;
    if (Number.isInteger(reportedRows) && reportedRows >= 0) totalFamilyRows += reportedRows;
    depthSummaries.push({
      row_type: 'path-depth-summary',
      path_depth: pathDepth,
      provider_count: summary.provider_count ?? '',
      provider_prompt_groups: summary.provider_prompt_groups ?? '',
      complete_no_owned_prompt_groups: summary.complete_no_owned_prompt_groups ?? '',
      unknown_no_owned_prompt_groups: summary.unknown_no_owned_prompt_groups ?? '',
      path_family_rows: Number.isInteger(reportedRows) ? reportedRows : '',
      provider_opportunity_complete: summary.provider_opportunity_complete ?? 'false',
      output_rows_truncated: summary.output_rows_truncated ?? 'false',
      interpretation_note: summary.interpretation_note ?? '',
    });
    for (const record of rows) {
      if (familyRows.length > MAX_OUTPUT_ROWS) break;
      familyRows.push({ row_type: 'page-opportunity-path-family-depth-sensitivity', ...record });
    }
  }
  const outputTruncated =
    sourceRowsTruncated || totalFamilyRows > MAX_OUTPUT_ROWS || familyRows.length > MAX_OUTPUT_ROWS;
  const headers = [
    'row_type',
    'path_depth',
    'provider',
    'path_family',
    'provider_prompt_groups',
    'complete_no_owned_prompt_groups',
    'unknown_no_owned_prompt_groups',
    'distinct_pages',
    'prompt_groups_with_family',
    'share_of_complete_no_owned_prompts_percent',
    'answer_captures_with_family',
    'citation_events',
    'top_three_prompt_groups',
    'first_position_prompt_groups',
    'top_three_citation_events',
    'first_position_citation_events',
    'first_cited_at',
    'last_cited_at',
    'provider_opportunity_complete',
    'path_family_rows',
    'provider_count',
    'depth_count',
    'path_depths',
    'depth_summaries_complete',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const summary: Record<string, unknown> = {
    row_type: 'summary',
    path_depth: '',
    depth_count: depths.length,
    path_depths: depths.join('; '),
    path_family_rows: outputTruncated ? null : totalFamilyRows,
    depth_summaries_complete: sourceCoverageComplete,
    output_rows_truncated: outputTruncated,
    interpretation_note:
      'This sensitivity report recomputes the same confirmed-no-owned page-family sample at URL path depths 1 through 5. A shallower family merges deeper prefixes; rows at different depths overlap and must not be treated as independent comparisons. Family reach counts exact prompts, not citation events; path structure is not page semantics.',
  };
  const outputRows: Record<string, unknown>[] = [
    Object.fromEntries(headers.map((header) => [header, header])),
    summary,
    ...depthSummaries,
    ...(outputTruncated ? [] : familyRows),
  ];
  return `${outputRows.map((row) => headers.map((header) => csvCell(row[header])).join(',')).join('\r\n')}\r\n`;
}

/** Render a standalone dashboard for the path-family depth sensitivity CSV. */
export function renderAiAnswerCitationPageOpportunityPathFamilyDepthSweepHtmlFromCsv(
  csv: string
): string {
  const records = parseOpportunityCsvRecords(csv);
  const summary = records.find((record) => record.row_type === 'summary');
  if (!summary)
    throw new Error('Page-opportunity path-family depth sweep is missing its summary row.');
  const depthRows = records
    .filter((record) => record.row_type === 'path-depth-summary')
    .sort((left, right) => Number(left.path_depth) - Number(right.path_depth));
  const familyRows = records.filter(
    (record) => record.row_type === 'page-opportunity-path-family-depth-sensitivity'
  );
  const escapeHtml = (value: unknown): string =>
    String(value ?? '').replace(
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
  const formatNumber = (value: string | undefined, digits = 1): string => {
    if (!value || !Number.isFinite(Number(value))) return '—';
    return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
  };
  const complete =
    summary.depth_summaries_complete === 'true' && summary.output_rows_truncated !== 'true';
  const depths = depthRows.map((row) => Number(row.path_depth));
  const counts = depthRows.map((row) =>
    row.path_family_rows?.trim() ? Number(row.path_family_rows) : Number.NaN
  );
  const maxCount = Math.max(1, ...counts.filter(Number.isFinite));
  const chartWidth = 900;
  const chartHeight = 280;
  const baseline = 218;
  const bars = depthRows
    .map((row, index) => {
      const count = row.path_family_rows?.trim() ? Number(row.path_family_rows) : Number.NaN;
      if (!Number.isFinite(count))
        return `<g><text x="${110 + index * 160}" y="245" text-anchor="middle">Depth ${escapeHtml(row.path_depth)}</text><text x="${110 + index * 160}" y="82" text-anchor="middle" fill="#9b5930">capped</text></g>`;
      const height = (count / maxCount) * 170;
      const x = 70 + index * 160;
      return `<g><rect x="${x}" y="${baseline - height}" width="80" height="${height}" rx="7" fill="#0b6e69"/><text x="${x + 40}" y="${baseline - height - 9}" text-anchor="middle" fill="#243330" font-weight="700">${formatNumber(String(count), 0)}</text><text x="${x + 40}" y="245" text-anchor="middle" fill="#536660">Depth ${escapeHtml(row.path_depth)}</text></g>`;
    })
    .join('');
  const depthTable = `<section class="panel"><h2>Depth-level completeness</h2><div class="table-wrap"><table><thead><tr><th>Depth</th><th>Providers</th><th>Prompt groups</th><th>Complete no-owned groups</th><th>Unknown groups</th><th>Families</th><th>Complete</th><th>Truncated</th></tr></thead><tbody>${depthRows.map((row) => `<tr><td>${escapeHtml(row.path_depth)}</td><td>${escapeHtml(row.provider_count)}</td><td>${escapeHtml(row.provider_prompt_groups)}</td><td>${escapeHtml(row.complete_no_owned_prompt_groups)}</td><td>${escapeHtml(row.unknown_no_owned_prompt_groups)}</td><td>${escapeHtml(row.path_family_rows?.trim() ? row.path_family_rows : '—')}</td><td>${escapeHtml(row.provider_opportunity_complete)}</td><td>${escapeHtml(row.output_rows_truncated)}</td></tr>`).join('')}</tbody></table></div></section>`;
  const visibleFamilies = familyRows
    .slice(0, 1_000)
    .sort(
      (left, right) =>
        Number(right.share_of_complete_no_owned_prompts_percent) -
        Number(left.share_of_complete_no_owned_prompts_percent)
    );
  const familyTable = `<section class="panel"><div class="heading"><div><h2>Retained provider/family rows</h2><p>Family rows at different depths overlap; use them to inspect grouping sensitivity, not as separate independent samples.</p></div><label>Filter <input type="search" id="family-filter" placeholder="Provider, path, or depth"></label></div><p class="muted">Showing ${visibleFamilies.length.toLocaleString('en-US')} of ${familyRows.length.toLocaleString('en-US')} retained rows${familyRows.length > visibleFamilies.length ? '; export the CSV for full detail' : ''}.</p><div class="table-wrap"><table><thead><tr><th>Depth</th><th>Provider</th><th>Path family</th><th>Prompt reach</th><th>Prompts</th><th>Pages</th><th>Citation events</th><th>Complete</th></tr></thead><tbody id="family-rows">${visibleFamilies.map((row) => `<tr><td>${escapeHtml(row.path_depth)}</td><td>${escapeHtml(row.provider)}</td><td>${escapeHtml(row.path_family)}</td><td>${escapeHtml(row.share_of_complete_no_owned_prompts_percent)}%</td><td>${escapeHtml(row.prompt_groups_with_family)}</td><td>${escapeHtml(row.distinct_pages)}</td><td>${escapeHtml(row.citation_events)}</td><td>${escapeHtml(row.provider_opportunity_complete)}</td></tr>`).join('') || `<tr><td colspan="8" class="empty">No family detail retained.</td></tr>`}</tbody></table></div></section>`;
  const status = complete
    ? '<span class="pill good">Source opportunity coverage complete</span>'
    : '<span class="pill warn">Incomplete source support or capped rows</span>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>GEO page-opportunity path-depth sensitivity</title><style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#233330;background:#f1f5f2}*{box-sizing:border-box}body{margin:0}.shell{max-width:1320px;margin:auto;padding:30px 22px 56px}header{background:#153b35;color:#f7faf8;padding:28px 32px;border-radius:17px}header p{color:#d1e1dc;max-width:900px;line-height:1.55}h1{font-size:clamp(1.7rem,3vw,2.6rem);letter-spacing:-.04em;margin:0}.eyebrow{text-transform:uppercase;color:#9dd8c9;font-size:.73rem;font-weight:700;letter-spacing:.13em}.pill{display:inline-block;margin-top:8px;border-radius:999px;padding:6px 10px;font-size:.78rem;font-weight:700}.good{background:#d9f2e8;color:#17533d}.warn{background:#fff0d7;color:#784817}.cards{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.card,.panel{background:#fff;border:1px solid #dfe7e3;border-radius:14px;box-shadow:0 4px 18px #1c392b08}.card{padding:16px 20px;min-width:180px}.card small{display:block;color:#62736f;text-transform:uppercase;font-size:.74rem;letter-spacing:.06em}.card strong{display:block;font-size:1.6rem;margin-top:5px}.panel{padding:22px;margin:14px 0}.panel h2{margin:0 0 6px;font-size:1.1rem}.panel p{color:#5d6e69;line-height:1.5}.chart{width:100%;height:auto;min-width:600px}.chart-wrap{overflow:auto}.table-wrap{overflow:auto;border:1px solid #e1e8e4;border-radius:9px}table{border-collapse:collapse;width:100%;font-size:.82rem;white-space:nowrap}th{background:#edf3f0;text-align:left;color:#536660;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}th,td{padding:9px 11px;border-bottom:1px solid #e7ece9}.heading{display:flex;justify-content:space-between;gap:16px;align-items:end}.heading p{margin-bottom:4px}.heading input{display:block;margin-top:5px;border:1px solid #cdd8d3;border-radius:8px;padding:9px 11px;font:inherit}.muted{font-size:.77rem;color:#788681}.empty{text-align:center;color:#788681;padding:24px}.note{font-size:.84rem;color:#5d6e69;line-height:1.6}@media(max-width:700px){.shell{padding:14px 10px 36px}header,.panel{padding:19px}.heading{display:block}.heading label{display:block;margin-top:14px}}
  </style></head><body><main class="shell"><header><div class="eyebrow">Aviary · Generative Engine Optimization</div><h1>Page-opportunity path-depth sensitivity</h1><p>Compare how the same confirmed-no-owned citation evidence groups when URL families use one through five leading path segments. The report helps reveal whether a conclusion depends on a broad or narrow prefix.</p>${status}</header><section class="cards"><div class="card"><small>Depths compared</small><strong>${depths.length.toLocaleString('en-US')}</strong></div><div class="card"><small>Depth summaries retained</small><strong>${depthRows.length.toLocaleString('en-US')}</strong></div><div class="card"><small>Family rows retained</small><strong>${formatNumber(summary.path_family_rows, 0)}</strong></div><div class="card"><small>Family detail capped</small><strong>${summary.output_rows_truncated === 'true' ? 'Yes' : 'No'}</strong></div></section><section class="panel"><h2>Number of families by path depth</h2><p>Deeper prefixes split broad groups into more specific URL buckets. The counts are descriptive and depend on the supplied sample.</p><div class="chart-wrap"><svg class="chart" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Number of page-opportunity families at URL path depths one through five"><line x1="42" y1="${baseline}" x2="860" y2="${baseline}" stroke="#b8c8c1"/>${bars}</svg></div></section>${depthTable}${familyTable}<p class="note">${escapeHtml(summary.interpretation_note)} Incomplete citation lists remain unknown. Rows at multiple depths share source pages and prompt groups, so differences are not independent effects.</p></main><script>const q=document.getElementById('family-filter');const body=document.getElementById('family-rows');if(q&&body){const rows=[...body.querySelectorAll('tr')];q.addEventListener('input',()=>{const value=q.value.trim().toLocaleLowerCase();rows.forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase().includes(value);});});}</script></body></html>`;
}
