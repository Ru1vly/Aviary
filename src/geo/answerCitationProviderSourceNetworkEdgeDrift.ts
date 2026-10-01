import type {
  AiAnswerCitationObservationReport,
  AiAnswerCitationPromptProviderProfile,
} from './answerCitationObservations';

const MAX_PROVIDER_PAIRS = 50_000;
const MAX_PAIR_PROMPT_CHECKS = 25_000_000;
const MAX_PAIR_EDGE_OPERATIONS = 25_000_000;
const MAX_PROVIDER_EDGE_CANDIDATES = 100_000;
const MAX_OUTPUT_ROWS = 20_000;
const MIN_EDGE_SUPPORT = 2;
const MIN_NORMAL_INTERVAL_PROMPTS = 30;

interface ProviderPanel {
  provider: string;
  promptCount: number;
  profiles: Map<string, AiAnswerCitationPromptProviderProfile>;
  catalogComplete: boolean;
}

interface EdgeDrift {
  domainA: string;
  domainB: string;
  baselineA: number;
  baselineB: number;
  currentA: number;
  currentB: number;
  support: number;
  interactionSum: number;
  interactionSquares: number;
  minimumPromptInteraction: number;
  maximumPromptInteraction: number;
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

function completeDomains(profile: AiAnswerCitationPromptProviderProfile): Set<string> | null {
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
    const domain = item.domain.trim().toLocaleLowerCase('en-US');
    if (!domain) return null;
    events.set(domain, (events.get(domain) ?? 0) + item.citationEvents);
  }
  if ([...events.values()].reduce((sum, value) => sum + value, 0) !== profile.citationEvents)
    return null;
  return new Set([...events].filter(([, count]) => count > 0).map(([domain]) => domain));
}

function buildPanels(report: AiAnswerCitationObservationReport): Map<string, ProviderPanel> {
  const panels = new Map<string, ProviderPanel>();
  for (const provider of report.providers) {
    const key = normalizedLabel(provider.provider);
    if (panels.has(key)) panels.get(key)!.catalogComplete = false;
    else
      panels.set(key, {
        provider: provider.provider,
        promptCount: provider.uniquePrompts,
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
        promptCount: 0,
        profiles: new Map<string, AiAnswerCitationPromptProviderProfile>(),
        catalogComplete: !report.promptsTruncated,
      };
      if (panel.profiles.has(promptKey)) panel.catalogComplete = false;
      else panel.profiles.set(promptKey, profile);
      panels.set(key, panel);
    }
  }
  for (const panel of panels.values())
    if (panel.profiles.size !== panel.promptCount) panel.catalogComplete = false;
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

function normalTwoSidedPValue(zScore: number): number {
  const z = Math.abs(zScore);
  const t = 1 / (1 + (0.3275911 * z) / Math.sqrt(2));
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp((-z * z) / 2);
  return Math.max(0, Math.min(1, 1 - erf));
}

function holmAdjusted(pValues: number[]): number[] {
  const ranked = pValues
    .map((pValue, index) => ({ pValue, index }))
    .sort((left, right) => left.pValue - right.pValue || left.index - right.index);
  const adjusted = new Array<number>(pValues.length);
  let maximum = 0;
  ranked.forEach(({ pValue, index }, rank) => {
    maximum = Math.max(maximum, Math.min(1, pValue * (ranked.length - rank)));
    adjusted[index] = Number(maximum.toPrecision(15));
  });
  return adjusted;
}

/** Compare provider source-edge gaps across periods on the same complete exact prompts. */
export function renderAiAnswerCitationProviderSourceNetworkEdgeDriftCsv(
  current: AiAnswerCitationObservationReport,
  baseline: AiAnswerCitationObservationReport
): string {
  const currentPanels = buildPanels(current);
  const baselinePanels = buildPanels(baseline);
  const baselineProviderKeys = new Set(baselinePanels.keys());
  const currentProviderKeys = new Set(currentPanels.keys());
  const providerKeys = [...baselinePanels.keys()]
    .filter((key) => currentPanels.has(key))
    .sort((left, right) =>
      baselinePanels.get(left)!.provider.localeCompare(baselinePanels.get(right)!.provider)
    );
  const providerPairsAvailable = (providerKeys.length * (providerKeys.length - 1)) / 2;
  const providerPairs: Array<[string, string]> = [];
  for (
    let left = 0;
    left < providerKeys.length && providerPairs.length < MAX_PROVIDER_PAIRS;
    left += 1
  ) {
    for (
      let right = left + 1;
      right < providerKeys.length && providerPairs.length < MAX_PROVIDER_PAIRS;
      right += 1
    ) {
      providerPairs.push([providerKeys[left]!, providerKeys[right]!]);
    }
  }

  const headers = [
    'row_type',
    'provider_a',
    'provider_b',
    'baseline_analyzed_at',
    'current_analyzed_at',
    'provider_a_baseline_prompt_groups',
    'provider_b_baseline_prompt_groups',
    'provider_a_current_prompt_groups',
    'provider_b_current_prompt_groups',
    'shared_exact_prompt_groups',
    'unmatched_exact_prompt_groups',
    'comparable_complete_source_prompt_groups',
    'unknown_source_detail_prompt_groups',
    'baseline_provider_a_edge_prompt_share',
    'baseline_provider_b_edge_prompt_share',
    'baseline_provider_b_minus_a_edge_prompt_share',
    'current_provider_a_edge_prompt_share',
    'current_provider_b_edge_prompt_share',
    'current_provider_b_minus_a_edge_prompt_share',
    'provider_gap_difference_in_differences',
    'difference_in_differences_lower_95',
    'difference_in_differences_upper_95',
    'difference_in_differences_leave_one_prompt_out_min',
    'difference_in_differences_leave_one_prompt_out_max',
    'leave_one_prompt_out_max_absolute_shift_percentage_points',
    'difference_in_differences_p_value',
    'difference_in_differences_test_method',
    'holm_adjusted_p_value',
    'holm_adjustment_status',
    'domain_a',
    'domain_b',
    'edge_union_support_prompts',
    'minimum_union_edge_support',
    'provider_catalogs_complete',
    'source_detail_complete',
    'comparison_complete',
    'baseline_unique_providers',
    'current_unique_providers',
    'providers_present_in_both_periods',
    'baseline_only_providers',
    'current_only_providers',
    'provider_catalogs_match',
    'provider_pairs_available',
    'provider_pairs_evaluated',
    'provider_pairs_omitted_by_work_budget',
    'provider_pairs_omitted_by_cap',
    'pair_prompt_checks_evaluated',
    'pair_prompt_check_budget',
    'pair_edge_operations_evaluated',
    'pair_edge_operation_budget',
    'provider_edge_candidates_evaluated',
    'provider_edge_candidate_cap',
    'edge_catalog_complete',
    'edge_candidate_cap_exceeded',
    'provider_pairs_omitted_by_candidate_cap',
    'edge_comparisons_below_minimum_support',
    'holm_family_size',
    'output_rows_available',
    'output_rows_emitted',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const summary: Record<string, unknown> = Object.fromEntries(
    headers.map((header) => [header, ''])
  );
  summary.row_type = 'summary';
  summary.baseline_analyzed_at = baseline.analyzedAt;
  summary.current_analyzed_at = current.analyzedAt;
  summary.baseline_unique_providers = baselineProviderKeys.size;
  summary.current_unique_providers = currentProviderKeys.size;
  summary.providers_present_in_both_periods = providerKeys.length;
  summary.baseline_only_providers = [...baselineProviderKeys].filter(
    (key) => !currentProviderKeys.has(key)
  ).length;
  summary.current_only_providers = [...currentProviderKeys].filter(
    (key) => !baselineProviderKeys.has(key)
  ).length;
  summary.provider_catalogs_match =
    baselineProviderKeys.size === currentProviderKeys.size &&
    [...baselineProviderKeys].every((key) => currentProviderKeys.has(key));
  summary.provider_pairs_available = providerPairsAvailable;
  summary.provider_pairs_omitted_by_cap = providerPairsAvailable - providerPairs.length;
  summary.minimum_union_edge_support = MIN_EDGE_SUPPORT;
  summary.pair_prompt_check_budget = MAX_PAIR_PROMPT_CHECKS;
  summary.pair_edge_operation_budget = MAX_PAIR_EDGE_OPERATIONS;
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
    const [keyA, keyB] = providerPairs[pairIndex]!;
    const baselineA = baselinePanels.get(keyA)!;
    const baselineB = baselinePanels.get(keyB)!;
    const currentA = currentPanels.get(keyA)!;
    const currentB = currentPanels.get(keyB)!;
    const promptSets = [
      baselineA.profiles,
      baselineB.profiles,
      currentA.profiles,
      currentB.profiles,
    ];
    const smallest = promptSets.reduce((left, right) => (left.size <= right.size ? left : right));
    const sharedPromptKeys = [...smallest.keys()]
      .filter((promptKey) => promptSets.every((profiles) => profiles.has(promptKey)))
      .sort((left, right) => left.localeCompare(right));
    const unmatchedPrompts =
      new Set(promptSets.flatMap((profiles) => [...profiles.keys()])).size -
      sharedPromptKeys.length;
    if (promptChecks + sharedPromptKeys.length > MAX_PAIR_PROMPT_CHECKS) {
      pairsOmittedByWorkBudget = providerPairs.length - pairIndex;
      workBudgetExceeded = true;
      break;
    }

    const edgeDrifts = new Map<string, EdgeDrift>();
    let comparablePrompts = 0;
    let unknownForPair = 0;
    let pairPromptChecks = 0;
    let pairEdgeOperations = 0;
    let pairInterrupted = false;

    for (const promptKey of sharedPromptKeys) {
      pairPromptChecks += 1;
      const profiles = promptSets.map((set) => set.get(promptKey)!);
      const domains = profiles.map(completeDomains);
      if (domains.some((value) => value === null)) {
        unknownForPair += 1;
        continue;
      }
      const edges = domains.map((value) => edgeKeys(value!));
      const edgeSets = edges.map((list) => new Set(list));
      const unionEdges = new Set(edges.flat());
      const operationCost = edges.reduce((sum, list) => sum + list.length, 0) + unionEdges.size * 4;
      const additionalCandidates = [...unionEdges].filter((edge) => !edgeDrifts.has(edge)).length;
      if (
        edgeOperations + pairEdgeOperations + operationCost > MAX_PAIR_EDGE_OPERATIONS ||
        edgeCandidates + edgeDrifts.size + additionalCandidates > MAX_PROVIDER_EDGE_CANDIDATES
      ) {
        pairInterrupted = true;
        workBudgetExceeded =
          edgeOperations + pairEdgeOperations + operationCost > MAX_PAIR_EDGE_OPERATIONS;
        edgeCandidateCapExceeded =
          edgeCandidates + edgeDrifts.size + additionalCandidates > MAX_PROVIDER_EDGE_CANDIDATES;
        if (workBudgetExceeded) pairsOmittedByWorkBudget = providerPairs.length - pairIndex;
        if (edgeCandidateCapExceeded) pairsOmittedByCandidateCap = providerPairs.length - pairIndex;
        break;
      }
      pairEdgeOperations += operationCost;
      comparablePrompts += 1;
      for (const edge of unionEdges) {
        let stats = edgeDrifts.get(edge);
        if (!stats) {
          const [domainA, domainB] = edge.split('\u0000');
          stats = {
            domainA: domainA!,
            domainB: domainB!,
            baselineA: 0,
            baselineB: 0,
            currentA: 0,
            currentB: 0,
            support: 0,
            interactionSum: 0,
            interactionSquares: 0,
            minimumPromptInteraction: Number.POSITIVE_INFINITY,
            maximumPromptInteraction: Number.NEGATIVE_INFINITY,
          };
          edgeDrifts.set(edge, stats);
        }
        const b0 = edgeSets[1]!.has(edge) ? 1 : 0;
        const a0 = edgeSets[0]!.has(edge) ? 1 : 0;
        const b1 = edgeSets[3]!.has(edge) ? 1 : 0;
        const a1 = edgeSets[2]!.has(edge) ? 1 : 0;
        const interaction = b1 - a1 - (b0 - a0);
        stats.baselineA += a0;
        stats.baselineB += b0;
        stats.currentA += a1;
        stats.currentB += b1;
        if (a0 || b0 || a1 || b1) stats.support += 1;
        stats.interactionSum += interaction;
        stats.interactionSquares += interaction * interaction;
        stats.minimumPromptInteraction = Math.min(stats.minimumPromptInteraction, interaction);
        stats.maximumPromptInteraction = Math.max(stats.maximumPromptInteraction, interaction);
      }
    }

    promptChecks += pairPromptChecks;
    edgeOperations += pairEdgeOperations;
    edgeCandidates += edgeDrifts.size;
    unknownSourcePromptGroups += unknownForPair;
    if (pairInterrupted) break;
    pairsEvaluated += 1;
    const catalogsComplete =
      baselineA.catalogComplete &&
      baselineB.catalogComplete &&
      currentA.catalogComplete &&
      currentB.catalogComplete;
    const sourceDetailComplete = unknownForPair === 0;
    if (!catalogsComplete || !sourceDetailComplete) anyCatalogIncomplete = true;

    for (const stats of edgeDrifts.values()) {
      if (stats.support < MIN_EDGE_SUPPORT) {
        edgesBelowMinimumSupport += 1;
        continue;
      }
      const baselineShareA = comparablePrompts > 0 ? stats.baselineA / comparablePrompts : null;
      const baselineShareB = comparablePrompts > 0 ? stats.baselineB / comparablePrompts : null;
      const currentShareA = comparablePrompts > 0 ? stats.currentA / comparablePrompts : null;
      const currentShareB = comparablePrompts > 0 ? stats.currentB / comparablePrompts : null;
      const baselineGap =
        baselineShareA !== null && baselineShareB !== null ? baselineShareB - baselineShareA : null;
      const currentGap =
        currentShareA !== null && currentShareB !== null ? currentShareB - currentShareA : null;
      const differenceInDifferences =
        comparablePrompts > 0 ? stats.interactionSum / comparablePrompts : null;
      const minimumInteraction =
        stats.support < comparablePrompts
          ? Math.min(0, stats.minimumPromptInteraction)
          : stats.minimumPromptInteraction;
      const maximumInteraction =
        stats.support < comparablePrompts
          ? Math.max(0, stats.maximumPromptInteraction)
          : stats.maximumPromptInteraction;
      const leaveOnePromptOutMinimum =
        comparablePrompts >= 2
          ? (stats.interactionSum - maximumInteraction) / (comparablePrompts - 1)
          : null;
      const leaveOnePromptOutMaximum =
        comparablePrompts >= 2
          ? (stats.interactionSum - minimumInteraction) / (comparablePrompts - 1)
          : null;
      let lower: number | null = null;
      let upper: number | null = null;
      let pValue: number | null = null;
      let testMethod = `withheld-fewer-than-${MIN_NORMAL_INTERVAL_PROMPTS}-matched-prompts`;
      if (comparablePrompts >= MIN_NORMAL_INTERVAL_PROMPTS && differenceInDifferences !== null) {
        const varianceNumerator = Math.max(
          0,
          stats.interactionSquares -
            (stats.interactionSum * stats.interactionSum) / comparablePrompts
        );
        const standardError = Math.sqrt(
          varianceNumerator / (comparablePrompts - 1) / comparablePrompts
        );
        if (standardError > 0) {
          lower = differenceInDifferences - 1.959963984540054 * standardError;
          upper = differenceInDifferences + 1.959963984540054 * standardError;
          pValue = normalTwoSidedPValue(differenceInDifferences / standardError);
          testMethod = 'prompt-cluster-normal-approximation';
        } else testMethod = 'withheld-zero-prompt-interaction-variance';
      }
      rows.push({
        row_type: 'provider-edge-drift',
        provider_a: baselineA.provider,
        provider_b: baselineB.provider,
        baseline_analyzed_at: baseline.analyzedAt,
        current_analyzed_at: current.analyzedAt,
        provider_a_baseline_prompt_groups: baselineA.promptCount,
        provider_b_baseline_prompt_groups: baselineB.promptCount,
        provider_a_current_prompt_groups: currentA.promptCount,
        provider_b_current_prompt_groups: currentB.promptCount,
        shared_exact_prompt_groups: sharedPromptKeys.length,
        unmatched_exact_prompt_groups: unmatchedPrompts,
        comparable_complete_source_prompt_groups: comparablePrompts,
        unknown_source_detail_prompt_groups: unknownForPair,
        baseline_provider_a_edge_prompt_share:
          baselineShareA === null ? null : round(baselineShareA),
        baseline_provider_b_edge_prompt_share:
          baselineShareB === null ? null : round(baselineShareB),
        baseline_provider_b_minus_a_edge_prompt_share:
          baselineGap === null ? null : round(baselineGap),
        current_provider_a_edge_prompt_share: currentShareA === null ? null : round(currentShareA),
        current_provider_b_edge_prompt_share: currentShareB === null ? null : round(currentShareB),
        current_provider_b_minus_a_edge_prompt_share:
          currentGap === null ? null : round(currentGap),
        provider_gap_difference_in_differences:
          differenceInDifferences === null ? null : round(differenceInDifferences),
        difference_in_differences_lower_95: lower === null ? null : round(lower),
        difference_in_differences_upper_95: upper === null ? null : round(upper),
        difference_in_differences_leave_one_prompt_out_min:
          leaveOnePromptOutMinimum === null ? null : round(leaveOnePromptOutMinimum),
        difference_in_differences_leave_one_prompt_out_max:
          leaveOnePromptOutMaximum === null ? null : round(leaveOnePromptOutMaximum),
        leave_one_prompt_out_max_absolute_shift_percentage_points:
          differenceInDifferences !== null &&
          leaveOnePromptOutMinimum !== null &&
          leaveOnePromptOutMaximum !== null
            ? round(
                Math.max(
                  Math.abs(leaveOnePromptOutMinimum - differenceInDifferences),
                  Math.abs(leaveOnePromptOutMaximum - differenceInDifferences)
                ) * 100
              )
            : null,
        difference_in_differences_p_value: pValue === null ? null : Number(pValue.toPrecision(15)),
        difference_in_differences_test_method: testMethod,
        holm_adjusted_p_value: null,
        holm_adjustment_status: '',
        domain_a: stats.domainA,
        domain_b: stats.domainB,
        edge_union_support_prompts: stats.support,
        minimum_union_edge_support: MIN_EDGE_SUPPORT,
        provider_catalogs_complete: catalogsComplete,
        source_detail_complete: sourceDetailComplete,
        comparison_complete: catalogsComplete && sourceDetailComplete && unmatchedPrompts === 0,
      });
    }
  }

  const edgeCatalogComplete =
    !anyCatalogIncomplete &&
    pairsOmittedByWorkBudget === 0 &&
    !workBudgetExceeded &&
    !edgeCandidateCapExceeded;
  const tested = rows.filter((row) => typeof row.difference_in_differences_p_value === 'number');
  const holmStatus = !edgeCatalogComplete
    ? 'suppressed-incomplete-edge-catalog'
    : tested.length === 0
      ? 'no-eligible-tests'
      : 'complete';
  const adjusted = edgeCatalogComplete
    ? holmAdjusted(tested.map((row) => Number(row.difference_in_differences_p_value)))
    : [];
  tested.forEach((row, index) => {
    row.holm_adjusted_p_value = edgeCatalogComplete ? adjusted[index]! : null;
    row.holm_adjustment_status = holmStatus;
  });
  rows.sort(
    (left, right) =>
      Math.abs(Number(right.provider_gap_difference_in_differences ?? 0)) -
        Math.abs(Number(left.provider_gap_difference_in_differences ?? 0)) ||
      Number(left.difference_in_differences_p_value ?? 1) -
        Number(right.difference_in_differences_p_value ?? 1) ||
      String(left.provider_a).localeCompare(String(right.provider_a)) ||
      String(left.provider_b).localeCompare(String(right.provider_b)) ||
      String(left.domain_a).localeCompare(String(right.domain_a)) ||
      String(left.domain_b).localeCompare(String(right.domain_b))
  );
  const outputRowsTruncated = rows.length > MAX_OUTPUT_ROWS;
  Object.assign(summary, {
    provider_pairs_evaluated: pairsEvaluated,
    provider_pairs_omitted_by_work_budget: pairsOmittedByWorkBudget,
    provider_pairs_omitted_by_candidate_cap: pairsOmittedByCandidateCap,
    pair_prompt_checks_evaluated: promptChecks,
    pair_edge_operations_evaluated: edgeOperations,
    provider_edge_candidates_evaluated: edgeCandidates,
    edge_catalog_complete: edgeCatalogComplete,
    edge_candidate_cap_exceeded: edgeCandidateCapExceeded,
    edge_comparisons_below_minimum_support: edgesBelowMinimumSupport,
    unknown_source_detail_prompt_groups: unknownSourcePromptGroups,
    holm_family_size: edgeCatalogComplete ? tested.length : 0,
    holm_adjustment_status: holmStatus,
    output_rows_available: rows.length,
    output_rows_emitted: Math.min(rows.length, MAX_OUTPUT_ROWS),
    output_rows_truncated: outputRowsTruncated,
    interpretation_note: `Difference-in-differences is the change from baseline to current in provider B minus provider A edge reach, on shared exact prompts with complete source lists. Normal-approximation intervals and p-values are withheld below ${MIN_NORMAL_INTERVAL_PROMPTS} matched prompts. Intervals are nominal and not adjusted; Holm correction applies only to the complete eligible-test family. Model, surface, locale, or capture context may still shift within exact prompts. These observational data do not establish causal provider effects.`,
  });
  const output = [summary, ...rows.slice(0, MAX_OUTPUT_ROWS)];
  return `${output.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(',')).join('\r\n')}\r\n`;
}
