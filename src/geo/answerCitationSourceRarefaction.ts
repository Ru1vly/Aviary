import type { AiAnswerCitationObservationReport } from './answerCitationObservations';

const MAX_OUTPUT_ROWS = 20_000;

interface ProviderPanel {
  provider: string;
  promptGroups: number;
  domainPromptCounts: Map<string, number>;
  sourceCategoryPromptCounts: Map<string, { label: string; promptGroups: number }>;
  incompleteSourceListPromptGroups: number;
  incompleteSourceListObservations: number;
  sourceListCompletenessUnknownPromptGroups: number;
  promptGroupsWithoutDomainDetail: number;
  domainDetailComplete: boolean;
}

interface SourceRarefactionTable {
  headers: string[];
  rows: unknown[][];
  rowsTruncated: boolean;
}

export interface AiAnswerCitationSourceRarefactionSamplingMetadata {
  samplingUnit: 'exact-prompt' | 'lexical-prompt-family';
  familySimilarityThreshold?: number;
  familyCandidatePairsConsidered?: number;
  familyHighFrequencyPostingCutoff?: number;
  familyCandidatePairsCapped?: boolean;
}

export interface AiAnswerCitationSourceRarefactionScenario {
  report: AiAnswerCitationObservationReport;
  samplingMetadata: AiAnswerCitationSourceRarefactionSamplingMetadata;
}

function normalizeKey(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  const firstNonWhitespace = text.trimStart().charAt(0);
  if (typeof value !== 'number' && firstNonWhitespace && '=+-@'.includes(firstNonWhitespace))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function sampleSizes(promptGroups: number): number[] {
  if (promptGroups <= 0) return [0];
  return [
    ...new Set([
      0,
      1,
      2,
      5,
      10,
      20,
      50,
      100,
      250,
      500,
      1_000,
      Math.ceil(promptGroups * 0.25),
      Math.ceil(promptGroups * 0.5),
      Math.ceil(promptGroups * 0.75),
      promptGroups,
    ]),
  ]
    .filter((size) => size <= promptGroups)
    .sort((left, right) => left - right);
}

function logFactorials(maximum: number): number[] {
  const values = new Array<number>(maximum + 1).fill(0);
  for (let value = 2; value <= maximum; value += 1)
    values[value] = values[value - 1]! + Math.log(value);
  return values;
}

function probabilityAtLeastOneAffectedPrompt(
  promptGroups: number,
  samplePromptCount: number,
  affectedPromptGroups: number,
  factorials: number[]
): number {
  if (samplePromptCount <= 0 || affectedPromptGroups <= 0 || promptGroups <= 0) return 0;
  const unaffectedPromptGroups = promptGroups - affectedPromptGroups;
  if (samplePromptCount > unaffectedPromptGroups) return 1;
  const logUnaffectedSubsets =
    factorials[unaffectedPromptGroups]! -
    factorials[samplePromptCount]! -
    factorials[unaffectedPromptGroups - samplePromptCount]!;
  const logAllSubsets =
    factorials[promptGroups]! -
    factorials[samplePromptCount]! -
    factorials[promptGroups - samplePromptCount]!;
  const probabilityNone = Math.max(0, Math.min(1, Math.exp(logUnaffectedSubsets - logAllSubsets)));
  return 1 - probabilityNone;
}

function expectedDomainDiscovery(
  promptGroups: number,
  samplePromptCount: number,
  domainPromptCounts: Map<string, number>,
  factorials: number[],
  includeDomain: (domain: string) => boolean
): number {
  if (promptGroups <= 0 || samplePromptCount <= 0) return 0;
  let expected = 0;
  for (const [domain, promptsWithDomain] of domainPromptCounts) {
    if (!includeDomain(domain) || promptsWithDomain <= 0) continue;
    const promptsWithoutDomain = promptGroups - promptsWithDomain;
    let probabilityAbsent = 0;
    if (samplePromptCount <= promptsWithoutDomain) {
      const logNumerator =
        factorials[promptsWithoutDomain]! -
        factorials[samplePromptCount]! -
        factorials[promptsWithoutDomain - samplePromptCount]!;
      const logDenominator =
        factorials[promptGroups]! -
        factorials[samplePromptCount]! -
        factorials[promptGroups - samplePromptCount]!;
      probabilityAbsent = Math.max(0, Math.min(1, Math.exp(logNumerator - logDenominator)));
    }
    expected += 1 - probabilityAbsent;
  }
  return expected;
}

function minimumSampleSizeForExpectedCatalogShare(
  promptGroups: number,
  catalogSize: number,
  itemPromptCounts: Map<string, number>,
  factorials: number[],
  targetPercent: number
): number | null {
  if (promptGroups <= 0 || catalogSize <= 0) return null;
  const targetCount = (catalogSize * targetPercent) / 100;
  let lower = 0;
  let upper = promptGroups;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    const expected = expectedDomainDiscovery(
      promptGroups,
      middle,
      itemPromptCounts,
      factorials,
      () => true
    );
    if (expected >= targetCount) upper = middle;
    else lower = middle + 1;
  }
  return lower;
}

function buildAiAnswerCitationSourceRarefactionTable(
  report: AiAnswerCitationObservationReport,
  nextPromptBatchSize = 10,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = [],
  samplingMetadata: AiAnswerCitationSourceRarefactionSamplingMetadata = {
    samplingUnit: 'exact-prompt',
  },
  maximumOutputRows = MAX_OUTPUT_ROWS
): SourceRarefactionTable {
  if (
    !Number.isSafeInteger(nextPromptBatchSize) ||
    nextPromptBatchSize < 1 ||
    nextPromptBatchSize > 1_000
  ) {
    throw new Error(
      'Source rarefaction next-prompt batch size must be a whole number from 1 to 1,000.'
    );
  }
  if (categoryMappings.length > 500)
    throw new Error('Source-category rarefaction accepts at most 500 normalized mappings.');
  const orderedCategoryMappings = [...categoryMappings].sort(
    (left, right) => right.domain.length - left.domain.length
  );
  const providerPanels = new Map<string, ProviderPanel>();
  for (const prompt of report.prompts) {
    const providerProfiles = new Map(
      (prompt.providerProfiles ?? []).map((profile) => [normalizeKey(profile.provider), profile])
    );
    for (const provider of prompt.providers) {
      const providerKey = normalizeKey(provider);
      const panel = providerPanels.get(providerKey) ?? {
        provider,
        promptGroups: 0,
        domainPromptCounts: new Map<string, number>(),
        sourceCategoryPromptCounts: new Map<string, { label: string; promptGroups: number }>(),
        incompleteSourceListPromptGroups: 0,
        incompleteSourceListObservations: 0,
        sourceListCompletenessUnknownPromptGroups: 0,
        promptGroupsWithoutDomainDetail: 0,
        domainDetailComplete: true,
      };
      const profile = providerProfiles.get(providerKey);
      const domains = new Set<string>();
      let detailComplete = false;
      if (profile) {
        for (const domain of profile.citedDomains ?? []) {
          const normalized = domain
            .trim()
            .toLocaleLowerCase('en-US')
            .replace(/^\.+|\.+$/gu, '');
          if (normalized) domains.add(normalized);
        }
        detailComplete =
          Array.isArray(profile.citedDomains) &&
          profile.citedDomainsTruncated === false &&
          (profile.citationEvents === 0 || domains.size > 0);
        const incompleteCount = profile.incompleteCitationListObservations;
        if (
          Number.isSafeInteger(incompleteCount) &&
          incompleteCount! >= 0 &&
          incompleteCount! <= profile.observations
        ) {
          if (incompleteCount! > 0) panel.incompleteSourceListPromptGroups += 1;
          panel.incompleteSourceListObservations += incompleteCount!;
        } else {
          panel.sourceListCompletenessUnknownPromptGroups += 1;
        }
      } else {
        panel.sourceListCompletenessUnknownPromptGroups += 1;
      }
      if (!detailComplete) {
        panel.domainDetailComplete = false;
        panel.promptGroupsWithoutDomainDetail += 1;
      }
      for (const domain of domains)
        panel.domainPromptCounts.set(domain, (panel.domainPromptCounts.get(domain) ?? 0) + 1);
      const sourceCategories = new Map<string, string>();
      for (const domain of domains) {
        const mapping = orderedCategoryMappings.find(
          (candidate) => domain === candidate.domain || domain.endsWith(`.${candidate.domain}`)
        );
        if (mapping) sourceCategories.set(mapping.labelKey, mapping.label);
      }
      for (const [labelKey, label] of sourceCategories) {
        const current = panel.sourceCategoryPromptCounts.get(labelKey) ?? {
          label,
          promptGroups: 0,
        };
        current.promptGroups += 1;
        panel.sourceCategoryPromptCounts.set(labelKey, current);
      }
      panel.promptGroups += 1;
      providerPanels.set(providerKey, panel);
    }
  }

  const orderedPanels = [...providerPanels.values()].sort(
    (left, right) =>
      right.promptGroups - left.promptGroups || left.provider.localeCompare(right.provider)
  );
  const prepared = orderedPanels.map((panel) => ({
    panel,
    sizes: sampleSizes(panel.promptGroups),
  }));
  let availableRows = 0;
  for (const { sizes } of prepared) availableRows += sizes.length;
  let remainingRows = maximumOutputRows;
  const headers = [
    'provider',
    'sampling_unit',
    'family_similarity_threshold',
    'family_candidate_pairs_considered',
    'family_high_frequency_posting_cutoff',
    'family_similarity_candidate_pairs_capped',
    'sampled_prompt_groups',
    'sample_prompts_without_replacement',
    'expected_distinct_domains_observed_from_retained_citations',
    'observed_domain_catalog_size',
    'expected_domain_catalog_discovery_percent',
    'owned_domains_configured',
    'prompts_for_expected_50_percent_of_observed_domain_catalog',
    'prompts_for_expected_80_percent_of_observed_domain_catalog',
    'prompts_for_expected_90_percent_of_observed_domain_catalog',
    'prompts_for_expected_95_percent_of_observed_domain_catalog',
    'expected_non_owned_domains_observed',
    'observed_non_owned_domain_catalog_size',
    'expected_non_owned_domain_discovery_percent',
    'prompts_for_expected_50_percent_of_observed_non_owned_domain_catalog',
    'prompts_for_expected_80_percent_of_observed_non_owned_domain_catalog',
    'prompts_for_expected_90_percent_of_observed_non_owned_domain_catalog',
    'prompts_for_expected_95_percent_of_observed_non_owned_domain_catalog',
    'expected_owned_domains_observed',
    'observed_owned_domain_catalog_size',
    'expected_owned_domain_discovery_percent',
    'prompts_for_expected_50_percent_of_observed_owned_domain_catalog',
    'prompts_for_expected_80_percent_of_observed_owned_domain_catalog',
    'prompts_for_expected_90_percent_of_observed_owned_domain_catalog',
    'prompts_for_expected_95_percent_of_observed_owned_domain_catalog',
    'source_category_mappings_configured',
    'configured_source_category_label_count',
    'configured_source_category_labels',
    'configured_source_category_labels_without_retained_domain_matches',
    'observed_source_category_catalog_size',
    'configured_source_category_labels_with_retained_domain_match_percent',
    'observed_source_category_labels',
    'expected_source_categories_observed',
    'expected_source_category_catalog_discovery_percent',
    'prompts_for_expected_50_percent_of_observed_source_category_catalog',
    'prompts_for_expected_80_percent_of_observed_source_category_catalog',
    'prompts_for_expected_90_percent_of_observed_source_category_catalog',
    'prompts_for_expected_95_percent_of_observed_source_category_catalog',
    'expected_new_source_categories_in_next_prompt_batch',
    'prompt_groups_with_incomplete_source_lists',
    'next_unique_prompts_in_batch',
    'expected_additional_distinct_domains_in_next_prompt_batch',
    'expected_additional_owned_domains_in_next_prompt_batch',
    'expected_additional_non_owned_domains_in_next_prompt_batch',
    'expected_incomplete_source_list_prompt_groups_in_sample',
    'probability_sample_includes_incomplete_source_list_prompt_group_percent',
    'incomplete_source_list_observations',
    'prompt_groups_with_unknown_source_list_completeness',
    'expected_unknown_source_list_completeness_prompt_groups_in_sample',
    'probability_sample_includes_unknown_source_list_completeness_prompt_group_percent',
    'prompt_groups_without_domain_detail',
    'expected_prompt_groups_without_domain_detail_in_sample',
    'probability_sample_includes_prompt_without_domain_detail_percent',
    'domain_detail_complete',
    'source_list_complete_for_all_known_prompts',
    'prompt_catalog_truncated',
    'provider_rows_available',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const rows: unknown[][] = [];
  const ownedDomains = report.ownedDomains
    .map((domain) => domain.toLowerCase().replace(/^\.+|\.+$/gu, ''))
    .filter(Boolean);
  const isOwnedDomain = (domain: string): boolean =>
    ownedDomains.some((owned) => domain === owned || domain.endsWith(`.${owned}`));
  const configuredCategoryLabels = new Map(
    categoryMappings.map(({ labelKey, label }) => [labelKey, label])
  );
  const samplingUnitDescription =
    samplingMetadata.samplingUnit === 'lexical-prompt-family'
      ? `Each lexical prompt family contributes once, using the union of its member prompts' retained citation domains; repeat snapshots do not add sampling units. Families are transitive connected components under TF-IDF cosine similarity at ${samplingMetadata.familySimilarityThreshold ?? 'an unspecified'}; this is a sensitivity view, not semantic equivalence. High-frequency token postings above ${samplingMetadata.familyHighFrequencyPostingCutoff ?? 'an unspecified'} prompts are skipped to bound candidate generation. A capped family-candidate graph can leave related prompts in separate units${samplingMetadata.familyCandidatePairsCapped ? ' (the candidate cap was reached)' : ''}.`
      : 'Each exact normalized prompt contributes once, regardless of repeat snapshots.';
  const unitLabel =
    samplingMetadata.samplingUnit === 'lexical-prompt-family'
      ? 'lexical-prompt-family'
      : 'exact-prompt';
  const note = `${samplingUnitDescription} Values are expected distinct domain counts under a uniformly chosen subset without replacement from this retained sampling-unit panel, computed by exact hypergeometric rarefaction. Prompt-count targets are the smallest sample sizes whose expected discovery reaches the stated share of the domain/category catalog already observed in the retained panel; they are retrospective finite-panel sizing cues, not forecasts of unseen sources. The marginal next-batch fields compare the current sample size with up to ${nextPromptBatchSize} additional sampling units drawn from the remaining retained panel; they do not extrapolate beyond it. When source-category mappings are supplied, category discovery uses the most-specific matching hostname and counts each category at most once per sampling unit. Configured labels without a retained-domain match are listed, but incomplete citation lists or capped domain detail may hide matching sources. The configured-category match percentage may be a lower bound whenever source-list or domain-detail completeness is incomplete. Expected affected-unit counts and inclusion probabilities use the same without-replacement design. They describe domains/categories observed in supplied citation lists, not unobserved prompts or future provider behavior. Incomplete source lists can hide additional domains; prompt and per-prompt domain-detail caps are shown separately.`;
  for (const { panel, sizes } of prepared) {
    const promptGroups = panel.promptGroups;
    const factorials = logFactorials(promptGroups);
    const observedDomainCatalogSize = panel.domainPromptCounts.size;
    const observedNonOwnedDomainCatalogSize =
      ownedDomains.length > 0
        ? [...panel.domainPromptCounts.keys()].filter((domain) => !isOwnedDomain(domain)).length
        : null;
    const observedOwnedDomainCatalogSize =
      ownedDomains.length > 0
        ? [...panel.domainPromptCounts.keys()].filter((domain) => isOwnedDomain(domain)).length
        : null;
    const ownedDomainPromptCounts =
      ownedDomains.length > 0
        ? new Map([...panel.domainPromptCounts].filter(([domain]) => isOwnedDomain(domain)))
        : new Map<string, number>();
    const nonOwnedDomainPromptCounts =
      ownedDomains.length > 0
        ? new Map([...panel.domainPromptCounts].filter(([domain]) => !isOwnedDomain(domain)))
        : new Map<string, number>();
    const observedSourceCategoryCatalogSize =
      orderedCategoryMappings.length > 0 ? panel.sourceCategoryPromptCounts.size : null;
    const categoryPromptCounts = new Map(
      [...panel.sourceCategoryPromptCounts].map(([key, value]) => [key, value.promptGroups])
    );
    const domainCatalogSampleTargets = [50, 80, 90, 95].map((targetPercent) =>
      minimumSampleSizeForExpectedCatalogShare(
        promptGroups,
        observedDomainCatalogSize,
        panel.domainPromptCounts,
        factorials,
        targetPercent
      )
    );
    const nonOwnedDomainCatalogSampleTargets = [50, 80, 90, 95].map((targetPercent) =>
      observedNonOwnedDomainCatalogSize === null
        ? null
        : minimumSampleSizeForExpectedCatalogShare(
            promptGroups,
            observedNonOwnedDomainCatalogSize,
            nonOwnedDomainPromptCounts,
            factorials,
            targetPercent
          )
    );
    const ownedDomainCatalogSampleTargets = [50, 80, 90, 95].map((targetPercent) =>
      observedOwnedDomainCatalogSize === null
        ? null
        : minimumSampleSizeForExpectedCatalogShare(
            promptGroups,
            observedOwnedDomainCatalogSize,
            ownedDomainPromptCounts,
            factorials,
            targetPercent
          )
    );
    const categoryCatalogSampleTargets = [50, 80, 90, 95].map((targetPercent) =>
      observedSourceCategoryCatalogSize === null
        ? null
        : minimumSampleSizeForExpectedCatalogShare(
            promptGroups,
            observedSourceCategoryCatalogSize,
            categoryPromptCounts,
            factorials,
            targetPercent
          )
    );
    for (const samplePromptCount of sizes) {
      if (remainingRows <= 0) break;
      remainingRows -= 1;
      const expectedDomains = expectedDomainDiscovery(
        promptGroups,
        samplePromptCount,
        panel.domainPromptCounts,
        factorials,
        () => true
      );
      const expectedNonOwnedDomains =
        ownedDomains.length > 0
          ? expectedDomainDiscovery(
              promptGroups,
              samplePromptCount,
              panel.domainPromptCounts,
              factorials,
              (domain) => !isOwnedDomain(domain)
            )
          : null;
      const expectedOwnedDomains =
        ownedDomains.length > 0
          ? expectedDomainDiscovery(
              promptGroups,
              samplePromptCount,
              panel.domainPromptCounts,
              factorials,
              isOwnedDomain
            )
          : null;
      const expectedSourceCategories =
        orderedCategoryMappings.length > 0
          ? expectedDomainDiscovery(
              promptGroups,
              samplePromptCount,
              categoryPromptCounts,
              factorials,
              () => true
            )
          : null;
      const nextBatchPromptCount = Math.min(nextPromptBatchSize, promptGroups - samplePromptCount);
      const expectedDomainsAfterBatch = expectedDomainDiscovery(
        promptGroups,
        samplePromptCount + nextBatchPromptCount,
        panel.domainPromptCounts,
        factorials,
        () => true
      );
      const expectedNonOwnedDomainsAfterBatch =
        ownedDomains.length > 0
          ? expectedDomainDiscovery(
              promptGroups,
              samplePromptCount + nextBatchPromptCount,
              panel.domainPromptCounts,
              factorials,
              (domain) => !isOwnedDomain(domain)
            )
          : null;
      const expectedAdditionalDomains = Math.max(0, expectedDomainsAfterBatch - expectedDomains);
      const expectedAdditionalNonOwnedDomains =
        expectedNonOwnedDomainsAfterBatch === null || expectedNonOwnedDomains === null
          ? null
          : Math.max(0, expectedNonOwnedDomainsAfterBatch - expectedNonOwnedDomains);
      const expectedSourceCategoriesAfterBatch =
        orderedCategoryMappings.length > 0
          ? expectedDomainDiscovery(
              promptGroups,
              samplePromptCount + nextBatchPromptCount,
              categoryPromptCounts,
              factorials,
              () => true
            )
          : null;
      const expectedAdditionalSourceCategories =
        expectedSourceCategoriesAfterBatch === null || expectedSourceCategories === null
          ? null
          : Math.max(0, expectedSourceCategoriesAfterBatch - expectedSourceCategories);
      rows.push([
        panel.provider,
        unitLabel,
        samplingMetadata.familySimilarityThreshold,
        samplingMetadata.familyCandidatePairsConsidered,
        samplingMetadata.familyHighFrequencyPostingCutoff,
        samplingMetadata.familyCandidatePairsCapped,
        promptGroups,
        samplePromptCount,
        Number(expectedDomains.toFixed(4)),
        observedDomainCatalogSize,
        observedDomainCatalogSize > 0
          ? Number(((expectedDomains / observedDomainCatalogSize) * 100).toFixed(4))
          : null,
        ownedDomains.length > 0,
        ...domainCatalogSampleTargets,
        expectedNonOwnedDomains === null ? null : Number(expectedNonOwnedDomains.toFixed(4)),
        observedNonOwnedDomainCatalogSize,
        expectedNonOwnedDomains === null ||
        observedNonOwnedDomainCatalogSize === null ||
        observedNonOwnedDomainCatalogSize === 0
          ? null
          : Number(
              ((expectedNonOwnedDomains / observedNonOwnedDomainCatalogSize) * 100).toFixed(4)
            ),
        ...nonOwnedDomainCatalogSampleTargets,
        expectedOwnedDomains === null ? null : Number(expectedOwnedDomains.toFixed(4)),
        observedOwnedDomainCatalogSize,
        expectedOwnedDomains === null ||
        observedOwnedDomainCatalogSize === null ||
        observedOwnedDomainCatalogSize === 0
          ? null
          : Number(((expectedOwnedDomains / observedOwnedDomainCatalogSize) * 100).toFixed(4)),
        ...ownedDomainCatalogSampleTargets,
        orderedCategoryMappings.length > 0,
        orderedCategoryMappings.length > 0 ? configuredCategoryLabels.size : null,
        orderedCategoryMappings.length > 0
          ? [...configuredCategoryLabels.values()]
              .sort((left, right) => left.localeCompare(right))
              .join(' | ')
          : null,
        orderedCategoryMappings.length > 0
          ? [...configuredCategoryLabels.entries()]
              .filter(([labelKey]) => !panel.sourceCategoryPromptCounts.has(labelKey))
              .map(([, label]) => label)
              .sort((left, right) => left.localeCompare(right))
              .join(' | ')
          : null,
        observedSourceCategoryCatalogSize,
        orderedCategoryMappings.length > 0 && configuredCategoryLabels.size > 0
          ? Number(
              ((observedSourceCategoryCatalogSize! / configuredCategoryLabels.size) * 100).toFixed(
                4
              )
            )
          : null,
        orderedCategoryMappings.length > 0
          ? [...new Set([...panel.sourceCategoryPromptCounts.values()].map(({ label }) => label))]
              .sort((left, right) => left.localeCompare(right))
              .join(' | ')
          : null,
        expectedSourceCategories === null ? null : Number(expectedSourceCategories.toFixed(4)),
        expectedSourceCategories === null ||
        observedSourceCategoryCatalogSize === null ||
        observedSourceCategoryCatalogSize === 0
          ? null
          : Number(
              ((expectedSourceCategories / observedSourceCategoryCatalogSize) * 100).toFixed(4)
            ),
        ...categoryCatalogSampleTargets,
        expectedAdditionalSourceCategories === null
          ? null
          : Number(expectedAdditionalSourceCategories.toFixed(4)),
        panel.incompleteSourceListPromptGroups,
        nextBatchPromptCount,
        Number(expectedAdditionalDomains.toFixed(4)),
        expectedAdditionalNonOwnedDomains === null
          ? null
          : Number(
              Math.max(0, expectedAdditionalDomains - expectedAdditionalNonOwnedDomains).toFixed(4)
            ),
        expectedAdditionalNonOwnedDomains === null
          ? null
          : Number(expectedAdditionalNonOwnedDomains.toFixed(4)),
        Number(
          ((samplePromptCount / promptGroups) * panel.incompleteSourceListPromptGroups).toFixed(4)
        ),
        Number(
          (
            probabilityAtLeastOneAffectedPrompt(
              promptGroups,
              samplePromptCount,
              panel.incompleteSourceListPromptGroups,
              factorials
            ) * 100
          ).toFixed(4)
        ),
        panel.incompleteSourceListObservations,
        panel.sourceListCompletenessUnknownPromptGroups,
        Number(
          (
            (samplePromptCount / promptGroups) *
            panel.sourceListCompletenessUnknownPromptGroups
          ).toFixed(4)
        ),
        Number(
          (
            probabilityAtLeastOneAffectedPrompt(
              promptGroups,
              samplePromptCount,
              panel.sourceListCompletenessUnknownPromptGroups,
              factorials
            ) * 100
          ).toFixed(4)
        ),
        panel.promptGroupsWithoutDomainDetail,
        Number(
          ((samplePromptCount / promptGroups) * panel.promptGroupsWithoutDomainDetail).toFixed(4)
        ),
        Number(
          (
            probabilityAtLeastOneAffectedPrompt(
              promptGroups,
              samplePromptCount,
              panel.promptGroupsWithoutDomainDetail,
              factorials
            ) * 100
          ).toFixed(4)
        ),
        panel.domainDetailComplete,
        panel.sourceListCompletenessUnknownPromptGroups === 0 &&
          panel.incompleteSourceListPromptGroups === 0,
        report.promptsTruncated,
        availableRows,
        availableRows > maximumOutputRows,
        note,
      ]);
    }
  }
  return { headers, rows, rowsTruncated: availableRows > maximumOutputRows };
}

/** Export an exact prompt-cluster rarefaction curve for observed citation-domain discovery. */
export function renderAiAnswerCitationSourceRarefactionCsv(
  report: AiAnswerCitationObservationReport,
  nextPromptBatchSize = 10,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = [],
  samplingMetadata: AiAnswerCitationSourceRarefactionSamplingMetadata = {
    samplingUnit: 'exact-prompt',
  }
): string {
  const { headers, rows } = buildAiAnswerCitationSourceRarefactionTable(
    report,
    nextPromptBatchSize,
    categoryMappings,
    samplingMetadata
  );
  const outputHeaders = sourceRarefactionOutputHeaders(headers, samplingMetadata);
  return `${[outputHeaders, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function sourceRarefactionOutputHeaders(
  headers: string[],
  samplingMetadata: AiAnswerCitationSourceRarefactionSamplingMetadata
): string[] {
  const familyHeaderNames: Record<string, string> =
    samplingMetadata.samplingUnit === 'lexical-prompt-family'
      ? {
          sampled_prompt_groups: 'sampled_prompt_families',
          sample_prompts_without_replacement: 'sample_prompt_families_without_replacement',
          prompt_groups_with_incomplete_source_lists:
            'prompt_families_with_incomplete_source_lists',
          next_unique_prompts_in_batch: 'next_unique_prompt_families_in_batch',
          expected_incomplete_source_list_prompt_groups_in_sample:
            'expected_incomplete_source_list_prompt_families_in_sample',
          probability_sample_includes_incomplete_source_list_prompt_group_percent:
            'probability_sample_includes_incomplete_source_list_prompt_family_percent',
          prompt_groups_with_unknown_source_list_completeness:
            'prompt_families_with_unknown_source_list_completeness',
          expected_unknown_source_list_completeness_prompt_groups_in_sample:
            'expected_unknown_source_list_completeness_prompt_families_in_sample',
          probability_sample_includes_unknown_source_list_completeness_prompt_group_percent:
            'probability_sample_includes_unknown_source_list_completeness_prompt_family_percent',
          prompt_groups_without_domain_detail: 'prompt_families_without_domain_detail',
          expected_prompt_groups_without_domain_detail_in_sample:
            'expected_prompt_families_without_domain_detail_in_sample',
          probability_sample_includes_prompt_without_domain_detail_percent:
            'probability_sample_includes_prompt_family_without_domain_detail_percent',
          source_list_complete_for_all_known_prompts: 'source_list_complete_for_all_known_families',
        }
      : {};
  const outputHeaders = headers.map((header) => {
    const familyHeader = familyHeaderNames[header] ?? header;
    return samplingMetadata.samplingUnit === 'lexical-prompt-family'
      ? familyHeader
          .replace(/^prompts_for_expected_/u, 'prompt_families_for_expected_')
          .replace(/_next_prompt_batch/gu, '_next_prompt_family_batch')
      : familyHeader;
  });
  return outputHeaders;
}

/** Combine retained-panel rarefaction scenarios while enforcing one shared output-row cap. */
export function renderAiAnswerCitationSourceRarefactionScenariosCsv(
  scenarios: AiAnswerCitationSourceRarefactionScenario[],
  nextPromptBatchSize = 10,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = []
): string {
  if (scenarios.length === 0)
    throw new Error('At least one source-rarefaction scenario is required.');
  if (scenarios.length > MAX_OUTPUT_ROWS)
    throw new Error('Source-rarefaction scenario sweeps accept at most 20,000 scenarios.');
  if (
    scenarios.some(
      ({ samplingMetadata }) => samplingMetadata.samplingUnit !== 'lexical-prompt-family'
    )
  ) {
    throw new Error(
      'Source-rarefaction scenario sweeps require lexical prompt-family sampling units.'
    );
  }
  const maximumRowsPerScenario = Math.floor(MAX_OUTPUT_ROWS / scenarios.length);
  const tables = scenarios.map(({ report, samplingMetadata }) => ({
    table: buildAiAnswerCitationSourceRarefactionTable(
      report,
      nextPromptBatchSize,
      categoryMappings,
      samplingMetadata,
      maximumRowsPerScenario
    ),
    samplingMetadata,
  }));
  const headers = tables[0]!.table.headers;
  const outputHeaders = sourceRarefactionOutputHeaders(headers, tables[0]!.samplingMetadata);
  const outputTruncatedColumn = headers.indexOf('output_rows_truncated');
  const availableOutputRows = tables.reduce((sum, { table }) => sum + table.rows.length, 0);
  const outputTruncated =
    availableOutputRows > MAX_OUTPUT_ROWS || tables.some(({ table }) => table.rowsTruncated);
  const outputRows: unknown[][] = [];
  for (const { table } of tables) {
    const remaining = MAX_OUTPUT_ROWS - outputRows.length;
    if (remaining <= 0) break;
    for (const row of table.rows.slice(0, remaining)) {
      const outputRow = [...row];
      if (outputTruncated && outputTruncatedColumn >= 0) outputRow[outputTruncatedColumn] = true;
      outputRows.push(outputRow);
    }
  }
  return `${[outputHeaders, ...outputRows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  );
}

function chartNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function tableValue(row: unknown[], column: Map<string, number>, key: string): unknown {
  const index = column.get(key);
  return index === undefined ? undefined : row[index];
}

function chartCell(value: unknown, percentage = false): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${percentage ? '%' : ''}`;
}

function chartText(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : '—';
}

/** Render a compact, accessible SVG rarefaction chart panel for the answer-citation HTML dashboard. */
export function renderAiAnswerCitationSourceRarefactionPanelHtml(
  report: AiAnswerCitationObservationReport,
  nextPromptBatchSize = 10,
  categoryMappings: Array<{ domain: string; label: string; labelKey: string }> = [],
  samplingMetadata: AiAnswerCitationSourceRarefactionSamplingMetadata = {
    samplingUnit: 'exact-prompt',
  },
  maximumOutputRows = MAX_OUTPUT_ROWS
): string {
  const familySampling = samplingMetadata.samplingUnit === 'lexical-prompt-family';
  const sampleUnitLabel = familySampling ? 'prompt families' : 'prompts';
  const sampleUnitDescription = familySampling
    ? 'connected lexical prompt families'
    : 'unique exact prompts';
  const familyGraphNote = familySampling
    ? ` Family membership uses TF-IDF cosine similarity at ${samplingMetadata.familySimilarityThreshold ?? 0.85}; the bounded graph considered ${samplingMetadata.familyCandidatePairsConsidered ?? 0} candidate pairs with high-frequency posting cutoff ${samplingMetadata.familyHighFrequencyPostingCutoff ?? 0},${samplingMetadata.familyCandidatePairsCapped ? ' and the candidate-pair cap was reached' : ' and the candidate-pair cap was not reached'}`
    : '';
  const table = buildAiAnswerCitationSourceRarefactionTable(
    report,
    nextPromptBatchSize,
    categoryMappings,
    samplingMetadata,
    maximumOutputRows
  );
  const column = new Map(table.headers.map((header, index) => [header, index]));
  const providerRows = new Map<string, unknown[][]>();
  for (const row of table.rows) {
    const provider = String(tableValue(row, column, 'provider') ?? '');
    const retained = providerRows.get(provider) ?? [];
    retained.push(row);
    providerRows.set(provider, retained);
  }
  if (providerRows.size === 0) return '';
  const chartProviders = [...providerRows.entries()].slice(0, 8);
  const width = 660;
  const height = 300;
  const left = 48;
  const right = 18;
  const top = 22;
  const bottom = 38;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const charts = chartProviders
    .map(([provider, rows], chartIndex) => {
      const first = rows[0]!;
      const promptGroups = chartNumber(tableValue(first, column, 'sampled_prompt_groups'));
      const domainCatalogSize = chartNumber(
        tableValue(first, column, 'observed_domain_catalog_size')
      );
      const ownedCatalogSize = chartNumber(
        tableValue(first, column, 'observed_owned_domain_catalog_size')
      );
      const nonOwnedCatalogSize = chartNumber(
        tableValue(first, column, 'observed_non_owned_domain_catalog_size')
      );
      const sourceCategoryCatalogSize = chartNumber(
        tableValue(first, column, 'observed_source_category_catalog_size')
      );
      const ownedConfigured = tableValue(first, column, 'owned_domains_configured') === true;
      const sourceCategoriesConfigured =
        tableValue(first, column, 'source_category_mappings_configured') === true;
      const detailComplete = rows.every(
        (row) => tableValue(row, column, 'domain_detail_complete') === true
      );
      const pointRows = rows.map((row) => ({
        sampleSize: chartNumber(tableValue(row, column, 'sample_prompts_without_replacement')),
        domains: chartNumber(
          tableValue(row, column, 'expected_distinct_domains_observed_from_retained_citations')
        ),
        owned: chartNumber(tableValue(row, column, 'expected_owned_domains_observed')),
        nonOwned: chartNumber(tableValue(row, column, 'expected_non_owned_domains_observed')),
        categories: chartNumber(tableValue(row, column, 'expected_source_categories_observed')),
      }));
      const maximumY = Math.max(1, domainCatalogSize, ownedCatalogSize, nonOwnedCatalogSize);
      const x = (sampleSize: number): number =>
        left + (promptGroups > 0 ? sampleSize / promptGroups : 0) * chartWidth;
      const y = (value: number): number => top + chartHeight - (value / maximumY) * chartHeight;
      const series = [
        { key: 'domains' as const, label: 'All observed domains', color: '#245fe5', include: true },
        {
          key: 'owned' as const,
          label: 'Owned domains',
          color: '#16815c',
          include: ownedConfigured,
        },
        {
          key: 'nonOwned' as const,
          label: 'Non-owned domains',
          color: '#cc6b18',
          include: ownedConfigured,
        },
      ].filter((item) => item.include);
      const polylines = series
        .map((item) => {
          const points = pointRows
            .map((point) => `${x(point.sampleSize).toFixed(2)},${y(point[item.key]).toFixed(2)}`)
            .join(' ');
          const markers = pointRows
            .map(
              (point) =>
                `<circle cx="${x(point.sampleSize).toFixed(2)}" cy="${y(point[item.key]).toFixed(2)}" r="2.5" fill="${item.color}"/>`
            )
            .join('');
          return `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" aria-label="${item.label}"/>${markers}`;
        })
        .join('');
      const categoryMaximumY = Math.max(1, sourceCategoryCatalogSize);
      const categoryY = (value: number): number =>
        top + chartHeight - (value / categoryMaximumY) * chartHeight;
      const categoryPolylinePoints = pointRows
        .map(
          (point) => `${x(point.sampleSize).toFixed(2)},${categoryY(point.categories).toFixed(2)}`
        )
        .join(' ');
      const categoryMarkers = pointRows
        .map(
          (point) =>
            `<circle cx="${x(point.sampleSize).toFixed(2)}" cy="${categoryY(point.categories).toFixed(2)}" r="2.5" fill="#7c3aed"/>`
        )
        .join('');
      const familyIdPart = familySampling
        ? `-${String(samplingMetadata.familySimilarityThreshold ?? 0.85).replace('.', '-')}`
        : '';
      const id = `source-rarefaction${familyIdPart}-${chartIndex}`;
      const categoryChart = sourceCategoriesConfigured
        ? `<h4>Mapped category discovery</h4><svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-categories-title ${id}-categories-desc"><title id="${id}-categories-title">Mapped source-category discovery for ${escapeHtml(provider)}</title><desc id="${id}-categories-desc">Expected distinct operator-defined citation source categories observed while uniformly sampling ${sampleUnitDescription} without replacement.</desc><line x1="${left}" y1="${top + chartHeight}" x2="${width - right}" y2="${top + chartHeight}" stroke="currentColor" opacity=".55"/><line x1="${left}" y1="${top}" x2="${left}" y2="${top + chartHeight}" stroke="currentColor" opacity=".55"/><line x1="${left}" y1="${categoryY(categoryMaximumY)}" x2="${width - right}" y2="${categoryY(categoryMaximumY)}" stroke="currentColor" opacity=".14"/><text x="${left - 8}" y="${categoryY(categoryMaximumY) + 4}" text-anchor="end">${categoryMaximumY}</text><text x="${left - 8}" y="${categoryY(0) + 4}" text-anchor="end">0</text><text x="${left}" y="${height - 10}" text-anchor="middle">0 ${sampleUnitLabel}</text><text x="${width - right}" y="${height - 10}" text-anchor="end">${promptGroups.toLocaleString('en-US')} ${sampleUnitLabel}</text><polyline points="${categoryPolylinePoints}" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${categoryMarkers}</svg>`
        : '';
      const legend = series
        .map(
          (item) =>
            `<span class="source-rarefaction-legend"><i style="background:${item.color}"></i>${item.label}</span>`
        )
        .join('');
      const details = rows
        .map(
          (row) =>
            `<tr><td>${escapeHtml(chartCell(tableValue(row, column, 'sample_prompts_without_replacement')))}</td><td>${escapeHtml(chartCell(tableValue(row, column, 'expected_distinct_domains_observed_from_retained_citations')))}</td>${ownedConfigured ? `<td>${escapeHtml(chartCell(tableValue(row, column, 'expected_owned_domains_observed')))}</td><td>${escapeHtml(chartCell(tableValue(row, column, 'expected_non_owned_domains_observed')))}</td>` : ''}${sourceCategoriesConfigured ? `<td>${escapeHtml(chartCell(tableValue(row, column, 'expected_source_categories_observed')))}</td><td>${escapeHtml(chartCell(tableValue(row, column, 'configured_source_category_label_count')))}</td><td>${escapeHtml(chartText(tableValue(row, column, 'configured_source_category_labels')))}</td><td>${escapeHtml(chartText(tableValue(row, column, 'configured_source_category_labels_without_retained_domain_matches')))}</td><td>${escapeHtml(chartCell(tableValue(row, column, 'observed_source_category_catalog_size')))}</td><td>${escapeHtml(chartCell(tableValue(row, column, 'configured_source_category_labels_with_retained_domain_match_percent'), true))}</td><td>${escapeHtml(chartText(tableValue(row, column, 'observed_source_category_labels')))}</td><td>${escapeHtml(chartCell(tableValue(row, column, 'expected_source_category_catalog_discovery_percent'), true))}</td><td>${escapeHtml(chartCell(tableValue(row, column, 'expected_new_source_categories_in_next_prompt_batch')))}</td>` : ''}<td>${escapeHtml(chartCell(tableValue(row, column, 'next_unique_prompts_in_batch')))}</td><td>${escapeHtml(chartCell(tableValue(row, column, 'expected_additional_distinct_domains_in_next_prompt_batch')))}</td>${ownedConfigured ? `<td>${escapeHtml(chartCell(tableValue(row, column, 'expected_additional_owned_domains_in_next_prompt_batch')))}</td><td>${escapeHtml(chartCell(tableValue(row, column, 'expected_additional_non_owned_domains_in_next_prompt_batch')))}</td>` : ''}<td>${escapeHtml(chartCell(tableValue(row, column, 'probability_sample_includes_incomplete_source_list_prompt_group_percent'), true))}</td><td>${escapeHtml(chartCell(tableValue(row, column, 'probability_sample_includes_unknown_source_list_completeness_prompt_group_percent'), true))}</td><td>${escapeHtml(chartCell(tableValue(row, column, 'probability_sample_includes_prompt_without_domain_detail_percent'), true))}</td></tr>`
        )
        .join('');
      const completeness = detailComplete
        ? 'Retained domain detail complete'
        : 'Some per-prompt domain lists are capped or unavailable';
      const domainColumns = ownedConfigured
        ? '<th>Expected owned domains</th><th>Expected non-owned domains</th>'
        : '';
      const categoryColumns = sourceCategoriesConfigured
        ? '<th>Expected categories</th><th>Configured category count</th><th>Configured category labels</th><th>Configured labels without retained matches</th><th>Observed category catalog</th><th>Configured labels with retained match (%)</th><th>Observed category labels</th><th>Catalog discovery</th><th>Expected new categories</th>'
        : '';
      const batchDomainColumns = ownedConfigured
        ? '<th>Expected new owned domains</th><th>Expected new non-owned domains</th>'
        : '';
      const catalogTargetValue = (columnKey: string, catalogKey: string): string => {
        if (chartNumber(tableValue(first, column, catalogKey)) === 0)
          return 'no observed catalog items';
        const value = tableValue(first, column, columnKey);
        return typeof value === 'number'
          ? `${chartCell(value)} of ${chartCell(promptGroups)} ${sampleUnitLabel}`
          : 'unavailable';
      };
      const targetPercents = [50, 80, 90, 95];
      const catalogTargetList = (label: string, prefix: string, catalogKey: string): string =>
        `<p>${escapeHtml(label)}</p><ul>${targetPercents.map((targetPercent) => `<li>${targetPercent}%: ${escapeHtml(catalogTargetValue(`prompts_for_expected_${targetPercent}_percent_of_observed_${prefix}_catalog`, catalogKey))}</li>`).join('')}</ul>`;
      const categoryTargetList = sourceCategoriesConfigured
        ? catalogTargetList(
            'Mapped category catalog',
            'source_category',
            'observed_source_category_catalog_size'
          )
        : '';
      const ownedDomainTargetList = ownedConfigured
        ? catalogTargetList(
            'Owned domain catalog',
            'owned_domain',
            'observed_owned_domain_catalog_size'
          )
        : '';
      const nonOwnedDomainTargetList = ownedConfigured
        ? catalogTargetList(
            'Non-owned domain catalog',
            'non_owned_domain',
            'observed_non_owned_domain_catalog_size'
          )
        : '';
      const categoryMatchNote = sourceCategoriesConfigured
        ? '<p>Configured labels without retained matches are not confirmed absences: incomplete lists or capped detail can hide cited sources, so the configured-label match share may be a lower bound.</p>'
        : '';
      const catalogSizingDetails = `<details class="source-rarefaction-sizing"><summary>Expected prompts for retained catalog targets</summary><p>Smallest sample size whose expected discovery reaches each share of the catalog already observed in this retained panel:</p>${catalogTargetList('All observed domains', 'domain', 'observed_domain_catalog_size')}${ownedDomainTargetList}${nonOwnedDomainTargetList}${categoryTargetList}<p>These are finite-panel sizing cues; they do not predict unseen prompts or sources.</p></details>`;
      return `<article class="source-rarefaction-chart"><h3>${escapeHtml(provider)}</h3><p>${promptGroups.toLocaleString('en-US')} retained ${sampleUnitDescription} · ${escapeHtml(completeness)}</p><div class="source-rarefaction-legend-row">${legend}</div><svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">Citation-domain discovery for ${escapeHtml(provider)}</title><desc id="${id}-desc">Expected distinct domains observed in a uniformly sampled set of ${sampleUnitDescription}, up to ${promptGroups.toLocaleString('en-US')} ${sampleUnitLabel} in the retained panel. Incomplete source lists and capped domain details may hide sources.</desc><line x1="${left}" y1="${top + chartHeight}" x2="${width - right}" y2="${top + chartHeight}" stroke="currentColor" opacity=".55"/><line x1="${left}" y1="${top}" x2="${left}" y2="${top + chartHeight}" stroke="currentColor" opacity=".55"/><line x1="${left}" y1="${y(maximumY)}" x2="${width - right}" y2="${y(maximumY)}" stroke="currentColor" opacity=".14"/><text x="${left - 8}" y="${y(maximumY) + 4}" text-anchor="end">${maximumY}</text><text x="${left - 8}" y="${y(0) + 4}" text-anchor="end">0</text><text x="${left}" y="${height - 10}" text-anchor="middle">0 ${sampleUnitLabel}</text><text x="${width - right}" y="${height - 10}" text-anchor="end">${promptGroups.toLocaleString('en-US')} ${sampleUnitLabel}</text><g font-size="11" fill="currentColor">${polylines}</g></svg>${categoryChart}${catalogSizingDetails}${categoryMatchNote}<p class="source-rarefaction-chart-note">Expected values over subsets drawn without replacement from the retained prompt panel; not a forecast beyond it.</p><details><summary>Show curve values and completeness exposure</summary><div class="table-wrap"><table><thead><tr><th>Sample ${sampleUnitLabel}</th><th>Expected all domains</th>${domainColumns}${categoryColumns}<th>Next batch ${sampleUnitLabel}</th><th>Expected new domains</th>${batchDomainColumns}<th>Chance sample includes incomplete-list prompt</th><th>Chance sample includes unknown-completeness prompt</th><th>Chance sample includes capped-detail prompt</th></tr></thead><tbody>${details}</tbody></table></div></details></article>`;
    })
    .join('');
  const providerCapNote =
    providerRows.size > chartProviders.length
      ? `<p class="muted">Showing the ${chartProviders.length} largest retained provider panels. The CSV contains the full capped output.</p>`
      : '';
  const promptCapNote = report.promptsTruncated
    ? `<p class="muted">The retained ${familySampling ? 'prompt-family' : 'prompt'} catalog is capped; these curves describe only its retained groups.</p>`
    : '';
  const rowCapNote = table.rowsTruncated
    ? '<p class="muted">The source-rarefaction row cap is reached; charts and value tables use only retained rows.</p>'
    : '';
  return `<section class="panel source-rarefaction-panel"><h2>Observed source discovery by ${familySampling ? 'family' : 'prompt'} sample size</h2><p>Expected distinct citation domains as ${sampleUnitDescription} are sampled without replacement. Marginal yield uses a batch of up to ${nextPromptBatchSize} remaining ${sampleUnitLabel}. Incomplete source lists and capped domain detail can hide sources, so treat these curves as descriptive of the retained citation evidence.${familyGraphNote}.${categoryMappings.length > 0 ? ' Configured source categories are summarized in the expandable value tables.' : ''}</p><style>.source-rarefaction-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,560px),1fr));gap:1rem}.source-rarefaction-chart{border:1px solid #d5dce6;border-radius:12px;padding:1rem;min-width:0}.source-rarefaction-chart h3{margin:0 0 .25rem}.source-rarefaction-chart>p{margin:.25rem 0 .65rem}.source-rarefaction-chart svg{display:block;width:100%;height:auto;overflow:visible;color:#526174}.source-rarefaction-chart svg text{font:12px system-ui,sans-serif;fill:currentColor}.source-rarefaction-legend-row{display:flex;flex-wrap:wrap;gap:.75rem;font-size:.85rem}.source-rarefaction-legend{display:inline-flex;align-items:center;gap:.35rem}.source-rarefaction-legend i{display:inline-block;width:10px;height:10px;border-radius:50%}.source-rarefaction-chart-note{color:#617085;font-size:.86rem}.source-rarefaction-sizing ul{margin:.2rem 0 .7rem;padding-left:1.4rem}.source-rarefaction-sizing>p{margin:.35rem 0}.source-rarefaction-panel .muted{color:#617085}</style><div class="source-rarefaction-grid">${charts}</div>${providerCapNote}${promptCapNote}${rowCapNote}</section>`;
}
