import type {
  AiAnswerCitationObservationReport,
  AiAnswerCitationRateDifferenceConfidenceInterval95,
} from './answerCitationObservations';

const MAX_OUTPUT_ROWS = 50_000;
const BOOTSTRAP_ITERATIONS = 1_000;
const MAX_BOOTSTRAP_SAMPLE_DRAWS = 50_000_000;
const MIN_BOOTSTRAP_ITERATIONS_FOR_INTERVAL = 250;

interface PromptProviderDomainState {
  provider: string;
  providerKey: string;
  promptKey: string;
  observations: number;
  domains: Set<string>;
  domainDetailComplete: boolean;
}

interface DomainPairedReachRow {
  provider: string;
  domain: string;
  baselineProviderPromptGroups: number;
  currentProviderPromptGroups: number;
  sharedPromptGroups: number;
  comparablePromptGroups: number;
  unknownDomainPromptGroups: number;
  baselinePresent: number;
  currentPresent: number;
  gained: number;
  lost: number;
  both: number;
  neither: number;
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

function normalizedLabel(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
}

function stateForDomain(profile: PromptProviderDomainState, domain: string): boolean | null {
  if (profile.domains.has(domain)) return true;
  return profile.domainDetailComplete ? false : null;
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

function promptProviderProfiles(report: AiAnswerCitationObservationReport): {
  profiles: Map<string, Map<string, PromptProviderDomainState>>;
  complete: boolean;
  sourceDetailComplete: boolean;
} {
  const profiles = new Map<string, Map<string, PromptProviderDomainState>>();
  let complete = !report.promptsTruncated;
  let sourceDetailComplete = true;
  for (const prompt of report.prompts) {
    if (!Array.isArray(prompt.providerProfiles)) {
      complete = false;
      sourceDetailComplete = false;
      continue;
    }
    const promptKey = normalizedLabel(prompt.prompt);
    for (const profile of prompt.providerProfiles) {
      const providerKey = normalizedLabel(profile.provider);
      const providerPrompts =
        profiles.get(providerKey) ?? new Map<string, PromptProviderDomainState>();
      const hasDomainList = Array.isArray(profile.citedDomains);
      const hasCapState = typeof profile.citedDomainsTruncated === 'boolean';
      const domainDetailComplete = hasDomainList && hasCapState && !profile.citedDomainsTruncated;
      if (!hasDomainList || !hasCapState) sourceDetailComplete = false;
      providerPrompts.set(promptKey, {
        provider: profile.provider,
        providerKey,
        promptKey,
        observations: profile.observations,
        domains: new Set((profile.citedDomains ?? []).map((domain) => domain.toLowerCase())),
        domainDetailComplete,
      });
      profiles.set(providerKey, providerPrompts);
    }
  }
  return { profiles, complete, sourceDetailComplete };
}

/** Compare each domain's citation presence on matched exact prompt/provider groups across samples. */
export function renderAiAnswerCitationDomainPairedReachComparisonCsv(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  const currentIndex = promptProviderProfiles(current);
  const baselineIndex = promptProviderProfiles(baseline);
  const providers = new Map<string, string>();
  for (const provider of [...current.providers, ...baseline.providers])
    providers.set(normalizedLabel(provider.provider), provider.provider);
  for (const [providerKey, prompts] of [...currentIndex.profiles, ...baselineIndex.profiles]) {
    for (const profile of prompts.values()) providers.set(providerKey, profile.provider);
  }
  const domains = new Map<string, string>();
  for (const domain of [...current.domains, ...baseline.domains])
    domains.set(domain.domain.toLowerCase(), domain.domain);
  const providerRows = [...providers.entries()].sort((left, right) =>
    left[1].localeCompare(right[1])
  );
  const domainRows = [...domains.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  const outputTruncated = providerRows.length * domainRows.length > MAX_OUTPUT_ROWS;
  const providerContexts = providerRows.map(([providerKey, provider]) => {
    const beforePrompts =
      baselineIndex.profiles.get(providerKey) ?? new Map<string, PromptProviderDomainState>();
    const afterPrompts =
      currentIndex.profiles.get(providerKey) ?? new Map<string, PromptProviderDomainState>();
    return {
      providerKey,
      provider,
      beforePrompts,
      afterPrompts,
      sharedPromptKeys: [...beforePrompts.keys()]
        .filter((prompt) => afterPrompts.has(prompt))
        .sort(),
    };
  });
  const projectedPromptComparisons = providerContexts.reduce(
    (sum, context) => sum + context.sharedPromptKeys.length * domainRows.length,
    0
  );
  const estimatedBootstrapResamples =
    projectedPromptComparisons > 0
      ? Math.min(
          BOOTSTRAP_ITERATIONS,
          Math.floor(MAX_BOOTSTRAP_SAMPLE_DRAWS / projectedPromptComparisons)
        )
      : 0;
  const bootstrapResamplesPerTest =
    estimatedBootstrapResamples >= MIN_BOOTSTRAP_ITERATIONS_FOR_INTERVAL
      ? estimatedBootstrapResamples
      : 0;
  const rows: DomainPairedReachRow[] = [];

  for (const { provider, beforePrompts, afterPrompts, sharedPromptKeys } of providerContexts) {
    for (const [domainKey, domain] of domainRows) {
      let comparablePromptGroups = 0;
      let unknownDomainPromptGroups = 0;
      let baselinePresent = 0;
      let currentPresent = 0;
      let gained = 0;
      let lost = 0;
      let both = 0;
      let neither = 0;
      const deltas: number[] = [];
      for (const promptKey of sharedPromptKeys) {
        const beforeState = stateForDomain(beforePrompts.get(promptKey)!, domainKey);
        const afterState = stateForDomain(afterPrompts.get(promptKey)!, domainKey);
        if (beforeState === null || afterState === null) {
          unknownDomainPromptGroups += 1;
          continue;
        }
        comparablePromptGroups += 1;
        if (beforeState) baselinePresent += 1;
        if (afterState) currentPresent += 1;
        if (!beforeState && afterState) gained += 1;
        else if (beforeState && !afterState) lost += 1;
        else if (beforeState) both += 1;
        else neither += 1;
        deltas.push(Number(afterState) - Number(beforeState));
      }
      const comparisonComplete =
        baselineIndex.complete &&
        currentIndex.complete &&
        baselineIndex.sourceDetailComplete &&
        currentIndex.sourceDetailComplete &&
        !baseline.domainsTruncated &&
        !current.domainsTruncated &&
        unknownDomainPromptGroups === 0;
      const baselineReachPercent =
        comparablePromptGroups > 0 ? round((baselinePresent / comparablePromptGroups) * 100) : null;
      const currentReachPercent =
        comparablePromptGroups > 0 ? round((currentPresent / comparablePromptGroups) * 100) : null;
      const reachChangePercentagePoints =
        comparablePromptGroups > 0 ? round(((gained - lost) / comparablePromptGroups) * 100) : null;
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
        domain,
        baselineProviderPromptGroups: beforePrompts.size,
        currentProviderPromptGroups: afterPrompts.size,
        sharedPromptGroups: sharedPromptKeys.length,
        comparablePromptGroups,
        unknownDomainPromptGroups,
        baselinePresent,
        currentPresent,
        gained,
        lost,
        both,
        neither,
        baselineReachPercent,
        currentReachPercent,
        reachChangePercentagePoints,
        bootstrapInterval: pairedPromptBootstrapInterval(
          deltas,
          `${normalizedLabel(provider)}\u0000${domainKey}\u0000paired-domain-reach`,
          bootstrapResamplesPerTest
        ),
        leaveOneOutMinimumPercentagePoints,
        leaveOneOutMaximumPercentagePoints,
        exactMcNemarPValue: comparablePromptGroups > 0 ? exactMcNemarPValue(gained, lost) : null,
        holmAdjustedPValue: null,
        comparisonComplete,
      });
    }
  }

  const familyComplete =
    baselineIndex.complete &&
    currentIndex.complete &&
    baselineIndex.sourceDetailComplete &&
    currentIndex.sourceDetailComplete &&
    !baseline.domainsTruncated &&
    !current.domainsTruncated &&
    rows.every((row) => row.unknownDomainPromptGroups === 0);
  const testableRows = rows.filter((row) => row.exactMcNemarPValue !== null);
  if (familyComplete && testableRows.length > 0) {
    const adjusted = holmAdjustedPValues(testableRows.map((row) => row.exactMcNemarPValue!));
    testableRows.forEach((row, index) => {
      row.holmAdjustedPValue = adjusted[index]!;
    });
  }

  const headers = [
    'row_type',
    'provider',
    'domain',
    'baseline_provider_prompt_groups',
    'current_provider_prompt_groups',
    'shared_exact_prompt_groups',
    'comparable_prompt_groups',
    'unknown_domain_prompt_groups',
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
    'paired_prompt_bootstrap_resamples',
    'comparison_complete',
    'prompt_catalog_complete',
    'domain_catalog_complete',
    'source_detail_complete',
    'holm_family_complete',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note =
    'Each exact normalized prompt counts once within a provider after pooling repeated captures. Rows compare only provider/prompt groups present in both samples; capped per-prompt domain lists create unknown states rather than false absences. Reach deltas use only prompt pairs with known presence in both periods. Model, surface, locale, topic, intent, and repeated-capture context are pooled within each provider/prompt group and should be held stable for a controlled comparison. Exact McNemar and paired-prompt bootstrap values are descriptive for this manually sampled panel; Holm adjustment spans testable provider/domain rows only when the retained prompt and domain detail is complete. This describes captured answers, not engine visibility or causation.';
  const familySize = familyComplete ? testableRows.length : null;
  const summaryRow = [
    'summary',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    familySize,
    bootstrapResamplesPerTest,
    false,
    baselineIndex.complete && currentIndex.complete,
    !baseline.domainsTruncated && !current.domainsTruncated,
    baselineIndex.sourceDetailComplete && currentIndex.sourceDetailComplete,
    familyComplete,
    outputTruncated,
    note,
  ];
  const dataRows = rows
    .slice(0, MAX_OUTPUT_ROWS)
    .map((row) => [
      'domain-provider',
      row.provider,
      row.domain,
      row.baselineProviderPromptGroups,
      row.currentProviderPromptGroups,
      row.sharedPromptGroups,
      row.comparablePromptGroups,
      row.unknownDomainPromptGroups,
      row.baselinePresent,
      row.currentPresent,
      row.gained,
      row.lost,
      row.both,
      row.neither,
      row.baselineReachPercent,
      row.currentReachPercent,
      row.reachChangePercentagePoints,
      row.bootstrapInterval?.lowerPercentagePoints ?? null,
      row.bootstrapInterval?.upperPercentagePoints ?? null,
      row.leaveOneOutMinimumPercentagePoints,
      row.leaveOneOutMaximumPercentagePoints,
      row.exactMcNemarPValue,
      row.holmAdjustedPValue,
      familySize,
      bootstrapResamplesPerTest,
      row.comparisonComplete,
      baselineIndex.complete && currentIndex.complete,
      !baseline.domainsTruncated && !current.domainsTruncated,
      baselineIndex.sourceDetailComplete && currentIndex.sourceDetailComplete,
      familyComplete,
      outputTruncated,
      note,
    ]);
  return `${[headers, summaryRow, ...dataRows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

const DOMAIN_REACH_NUMERIC_COLUMNS = new Set([
  'baseline_provider_prompt_groups',
  'current_provider_prompt_groups',
  'shared_exact_prompt_groups',
  'comparable_prompt_groups',
  'unknown_domain_prompt_groups',
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
  'paired_prompt_bootstrap_resamples',
]);
const DOMAIN_REACH_BOOLEAN_COLUMNS = new Set([
  'comparison_complete',
  'prompt_catalog_complete',
  'domain_catalog_complete',
  'source_detail_complete',
  'holm_family_complete',
  'output_rows_truncated',
]);

/** Render a machine-readable version of the paired domain reach analysis. */
export function renderAiAnswerCitationDomainPairedReachComparisonJson(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  return renderAiAnswerCitationDomainPairedReachComparisonJsonFromCsv(
    renderAiAnswerCitationDomainPairedReachComparisonCsv(current, baseline),
    current,
    baseline
  );
}

/** Serialize an existing domain reach analysis CSV without recalculating it. */
export function renderAiAnswerCitationDomainPairedReachComparisonJsonFromCsv(
  csv: string,
  current?: AiAnswerCitationObservationReport,
  baseline?: AiAnswerCitationObservationReport
): string {
  const rows = parseCsvRows(csv);
  const headers = rows[0] ?? [];
  const records = rows
    .slice(1)
    .filter((row) => row.length > 1)
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => {
          const raw = row[index] ?? '';
          if (raw === '') return [header, null];
          if (DOMAIN_REACH_NUMERIC_COLUMNS.has(header)) {
            const numeric = Number(raw);
            return [header, Number.isFinite(numeric) ? numeric : null];
          }
          if (DOMAIN_REACH_BOOLEAN_COLUMNS.has(header)) return [header, raw === 'true'];
          return [header, raw];
        })
      )
    );
  if (current && baseline) {
    const providerLabels = new Map<string, string>();
    const domainLabels = new Map<string, string>();
    for (const report of [current, baseline]) {
      for (const provider of report.providers)
        providerLabels.set(normalizedLabel(provider.provider), provider.provider);
      for (const prompt of report.prompts) {
        for (const profile of prompt.providerProfiles ?? [])
          providerLabels.set(normalizedLabel(profile.provider), profile.provider);
        for (const domain of prompt.providerProfiles?.flatMap(
          (profile) => profile.citedDomains ?? []
        ) ?? []) {
          domainLabels.set(domain.toLowerCase(), domain);
        }
      }
      for (const domain of report.domains)
        domainLabels.set(domain.domain.toLowerCase(), domain.domain);
    }
    const restoreLabel = (
      value: unknown,
      labels: Map<string, string>,
      normalize: (label: string) => string
    ): unknown => {
      if (typeof value !== 'string') return value;
      const unescaped = value.replace(/^'(?=[\s=+@-])/u, '');
      return labels.get(normalize(unescaped)) ?? value;
    };
    for (const row of records) {
      row.provider = restoreLabel(row.provider, providerLabels, normalizedLabel);
      row.domain = restoreLabel(row.domain, domainLabels, (label) => label.toLowerCase());
    }
  }
  return `${JSON.stringify(
    {
      source: 'Aviary paired answer citation domain reach comparison',
      schemaVersion: 1,
      summary: records.find((record) => record.row_type === 'summary') ?? null,
      rows: records.filter((record) => record.row_type === 'domain-provider'),
    },
    null,
    2
  )}\n`;
}

export interface AiAnswerCitationDomainPairedReachDropGateFailure {
  provider: string;
  domain: string;
  comparablePromptGroups: number;
  gainedPrompts: number;
  lostPrompts: number;
  reachChangePercentagePoints: number;
  holmAdjustedPValue: number;
}

export interface AiAnswerCitationDomainPairedReachDropGateAssessment {
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
  failures: AiAnswerCitationDomainPairedReachDropGateFailure[];
}

function parseCsvRows(csv: string): string[][] {
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
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/u, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/u, ''));
    rows.push(row);
  }
  return rows;
}

/** Assess an already-rendered comparison so callers can share its bounded analysis work. */
export function assessAiAnswerCitationDomainPairedReachDropGateFromCsv(
  comparisonCsv: string,
  thresholdPercentagePoints: number,
  alpha = 0.05,
  minimumComparablePromptGroups = 10
): AiAnswerCitationDomainPairedReachDropGateAssessment {
  const csvRows = parseCsvRows(comparisonCsv);
  const header = csvRows[0] ?? [];
  const column = new Map(header.map((name, index) => [name, index]));
  const value = (row: string[], key: string): string => row[column.get(key) ?? -1] ?? '';
  const summary = csvRows.find((row) => value(row, 'row_type') === 'summary') ?? [];
  const summaryTrue = (key: string): boolean => value(summary, key) === 'true';
  const incompleteReasons: string[] = [];
  if (!summaryTrue('prompt_catalog_complete'))
    incompleteReasons.push('prompt catalog is incomplete or capped');
  if (!summaryTrue('domain_catalog_complete'))
    incompleteReasons.push('domain catalog is incomplete or capped');
  if (!summaryTrue('source_detail_complete'))
    incompleteReasons.push('per-prompt source detail is incomplete');
  if (!summaryTrue('holm_family_complete'))
    incompleteReasons.push('Holm correction family is incomplete');
  if (summaryTrue('output_rows_truncated'))
    incompleteReasons.push('comparison rows were truncated');

  const dataRows = csvRows.filter((row) => value(row, 'row_type') === 'domain-provider');
  const eligibleRows = dataRows.filter((row) => {
    const support = Number(value(row, 'comparable_prompt_groups'));
    return (
      Number.isInteger(support) &&
      support >= minimumComparablePromptGroups &&
      value(row, 'comparison_complete') === 'true' &&
      Number.isFinite(Number(value(row, 'holm_adjusted_mcnemar_p_value')))
    );
  });
  if (eligibleRows.length === 0)
    incompleteReasons.push(
      `no complete domain/provider comparison meets the ${minimumComparablePromptGroups}-prompt support floor`
    );

  const failures = eligibleRows.flatMap(
    (row): AiAnswerCitationDomainPairedReachDropGateFailure[] => {
      const comparablePromptGroups = Number(value(row, 'comparable_prompt_groups'));
      const gainedPrompts = Number(value(row, 'gained_prompts'));
      const lostPrompts = Number(value(row, 'lost_prompts'));
      const reachChangePercentagePoints =
        ((gainedPrompts - lostPrompts) / comparablePromptGroups) * 100;
      const holmAdjustedPValue = Number(value(row, 'holm_adjusted_mcnemar_p_value'));
      if (
        reachChangePercentagePoints >= 0 ||
        reachChangePercentagePoints > -thresholdPercentagePoints ||
        holmAdjustedPValue > alpha
      )
        return [];
      return [
        {
          provider: value(row, 'provider'),
          domain: value(row, 'domain'),
          comparablePromptGroups,
          gainedPrompts,
          lostPrompts,
          reachChangePercentagePoints: round(reachChangePercentagePoints),
          holmAdjustedPValue,
        },
      ];
    }
  );
  const holmFamilySize = Number(value(summary, 'holm_family_size'));
  const bootstrapResamplesPerTest = Number(value(summary, 'paired_prompt_bootstrap_resamples'));
  return {
    thresholdPercentagePoints,
    alpha,
    minimumComparablePromptGroups,
    holmFamilySize: Number.isInteger(holmFamilySize) && holmFamilySize >= 0 ? holmFamilySize : null,
    bootstrapResamplesPerTest: Number.isInteger(bootstrapResamplesPerTest)
      ? bootstrapResamplesPerTest
      : 0,
    evaluatedComparisons: dataRows.length,
    eligibleComparisons: eligibleRows.length,
    complete: incompleteReasons.length === 0,
    incompleteReasons,
    exceeded: failures.length > 0,
    failures,
  };
}

/** Gate on paired exact-prompt citation losses with a Holm-adjusted exact McNemar test. */
export function assessAiAnswerCitationDomainPairedReachDropGate(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport,
  thresholdPercentagePoints: number,
  alpha = 0.05,
  minimumComparablePromptGroups = 10
): AiAnswerCitationDomainPairedReachDropGateAssessment {
  return assessAiAnswerCitationDomainPairedReachDropGateFromCsv(
    renderAiAnswerCitationDomainPairedReachComparisonCsv(current, baseline),
    thresholdPercentagePoints,
    alpha,
    minimumComparablePromptGroups
  );
}

export function renderAiAnswerCitationDomainPairedReachDropGateJson(
  assessment: AiAnswerCitationDomainPairedReachDropGateAssessment
): string {
  return `${JSON.stringify(
    {
      source: 'Aviary domain paired-reach drop gate assessment',
      schemaVersion: 1,
      ...assessment,
    },
    null,
    2
  )}\n`;
}
