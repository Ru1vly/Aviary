import type {
  AiAnswerCitationObservationReport,
  AiAnswerCitationPromptProviderProfile,
} from './answerCitationObservations';

const MAX_PROVIDERS = 500;
const MAX_EDGE_PROMPT_UPDATES = 25_000_000;
const MAX_EDGE_CATALOG = 250_000;
const MAX_OUTPUT_ROWS = 20_000;
const MIN_OWNED_GAP_EDGE_PROMPTS = 2;

interface ProviderPanel {
  provider: string;
  promptGroups: number;
  profiles: Map<string, AiAnswerCitationPromptProviderProfile>;
  catalogComplete: boolean;
}

interface EdgeSupport {
  domainA: string;
  domainB: string;
  ownedGapPromptGroups: number;
  ownedCitedPromptGroups: number;
}

function normalizedLabel(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
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
  const domains = new Set<string>();
  let eventTotal = 0;
  for (const item of profile.citedDomainCitationEvents) {
    if (!Number.isFinite(item.citationEvents) || item.citationEvents < 0) return null;
    eventTotal += item.citationEvents;
    if (item.citationEvents > 0) domains.add(item.domain.toLowerCase());
  }
  return eventTotal === profile.citationEvents ? domains : null;
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

function isOwnedDomain(domain: string, ownedDomains: string[]): boolean {
  return ownedDomains.some((owned) => domain === owned || domain.endsWith(`.${owned}`));
}

function edgeKeys(
  domains: Set<string>,
  ownedDomains: string[]
): Array<{ key: string; domainA: string; domainB: string }> {
  const externalDomains = [...domains]
    .filter((domain) => !isOwnedDomain(domain, ownedDomains))
    .sort((left, right) => left.localeCompare(right));
  const edges: Array<{ key: string; domainA: string; domainB: string }> = [];
  for (let left = 0; left < externalDomains.length; left += 1) {
    for (let right = left + 1; right < externalDomains.length; right += 1) {
      const domainA = externalDomains[left]!;
      const domainB = externalDomains[right]!;
      edges.push({ key: `${domainA}\u0000${domainB}`, domainA, domainB });
    }
  }
  return edges;
}

function wilson(successes: number, total: number): { lower: number; upper: number } | null {
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

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Find external co-citation pairs associated with owned-citation gaps, by provider. */
export function renderAiAnswerCitationOwnedSourceNetworkGapsCsv(
  report: AiAnswerCitationObservationReport
): string {
  const headers = [
    'row_type',
    'provider',
    'domain_a',
    'domain_b',
    'provider_prompt_groups',
    'owned_gap_prompt_groups',
    'owned_cited_prompt_groups',
    'unknown_owned_status_prompt_groups',
    'unknown_source_detail_prompt_groups',
    'owned_gap_edge_prompt_support',
    'owned_cited_edge_prompt_support',
    'owned_gap_edge_prompt_share',
    'owned_cited_edge_prompt_share',
    'owned_gap_minus_owned_cited_share',
    'owned_gap_minus_owned_cited_lower_95',
    'owned_gap_minus_owned_cited_upper_95',
    'owned_gap_edge_lift',
    'minimum_gap_edge_support',
    'provider_prompt_catalog_complete',
    'provider_scan_complete',
    'source_detail_complete',
    'comparison_complete',
    'provider_prompt_groups_omitted_by_scan',
    'interpretation_note',
    'owned_domains_configured',
    'providers_available',
    'providers_evaluated',
    'providers_omitted_by_cap',
    'providers_omitted_after_scan_interruption',
    'prompt_groups_omitted_after_scan_interruption',
    'edge_prompt_updates_evaluated',
    'edge_work_budget_exceeded',
    'complete_provider_scans',
    'edge_prompt_update_budget',
    'edge_catalog_available',
    'edge_catalog_emitted',
    'edge_catalog_truncated',
    'edge_rows_below_minimum_support',
    'output_rows_available',
    'output_rows_emitted',
    'output_rows_truncated',
    'owned_domains',
  ];
  const summary: Record<string, unknown> = Object.fromEntries(
    headers.map((header) => [header, ''])
  );
  summary.row_type = 'summary';
  summary.minimum_gap_edge_support = MIN_OWNED_GAP_EDGE_PROMPTS;
  summary.edge_prompt_update_budget = MAX_EDGE_PROMPT_UPDATES;
  summary.owned_domains_configured =
    Array.isArray(report.ownedDomains) && report.ownedDomains.length > 0;
  summary.owned_domains = Array.isArray(report.ownedDomains)
    ? JSON.stringify(report.ownedDomains)
    : '[]';

  if (!Array.isArray(report.ownedDomains) || report.ownedDomains.length === 0) {
    summary.interpretation_note =
      'Configure at least one owned domain to classify exact prompts by owned-citation presence.';
    return `${headers.map((header) => csvCell(summary[header] ?? '')).join(',')}\r\n`;
  }

  const ownedDomains = [
    ...new Set(
      report.ownedDomains.map((domain) => domain.toLowerCase().replace(/^\.+|\.+$/gu, ''))
    ),
  ].filter(Boolean);
  const panels = buildPanels(report);
  const selectedPanels = [...panels.entries()]
    .sort((left, right) => left[1].provider.localeCompare(right[1].provider))
    .slice(0, MAX_PROVIDERS);
  const providerRows: Array<Record<string, unknown>> = [];
  let edgePromptUpdates = 0;
  let providersEvaluated = 0;
  let edgeCatalogTruncated = false;
  let workBudgetExceeded = false;
  let candidateEdges = 0;
  let edgeRowsBelowMinimumSupport = 0;
  let providerScanInterruptedAt: number | null = null;
  let promptGroupsOmittedAfterScanInterruption = 0;

  for (let providerIndex = 0; providerIndex < selectedPanels.length; providerIndex += 1) {
    const [, panel] = selectedPanels[providerIndex]!;
    const orderedProfiles = [...panel.profiles.entries()].sort((left, right) =>
      left[0].localeCompare(right[0])
    );
    const ownedGapProfiles: Array<{
      profile: AiAnswerCitationPromptProviderProfile;
      domains: Set<string>;
    }> = [];
    const ownedCitedProfiles: Array<{
      profile: AiAnswerCitationPromptProviderProfile;
      domains: Set<string>;
    }> = [];
    let unknownOwnedStatus = 0;
    let unknownSourceDetail = 0;
    const edgeSupport = new Map<string, EdgeSupport>();
    let ownedGapPromptGroups = 0;
    let ownedCitedPromptGroups = 0;
    let providerScanComplete = true;
    let promptGroupsOmittedByScan = 0;

    for (const [, profile] of orderedProfiles) {
      if (!Number.isFinite(profile.ownedCitationEvents) || profile.ownedCitationEvents! < 0) {
        unknownOwnedStatus += 1;
        continue;
      }
      const domains = completeDomains(profile);
      if (!domains) {
        unknownSourceDetail += 1;
        continue;
      }
      if (profile.ownedCitationEvents! > 0) ownedCitedProfiles.push({ profile, domains });
      else ownedGapProfiles.push({ profile, domains });
    }

    for (let promptIndex = 0; promptIndex < ownedGapProfiles.length; promptIndex += 1) {
      const prompt = ownedGapProfiles[promptIndex]!;
      const edges = edgeKeys(prompt.domains, ownedDomains);
      const additionalEdges = edges.filter((edge) => !edgeSupport.has(edge.key)).length;
      if (
        edgePromptUpdates + edges.length > MAX_EDGE_PROMPT_UPDATES ||
        candidateEdges + additionalEdges > MAX_EDGE_CATALOG
      ) {
        providerScanComplete = false;
        providerScanInterruptedAt = providerIndex;
        workBudgetExceeded = edgePromptUpdates + edges.length > MAX_EDGE_PROMPT_UPDATES;
        edgeCatalogTruncated = candidateEdges + additionalEdges > MAX_EDGE_CATALOG;
        promptGroupsOmittedByScan +=
          ownedGapProfiles.length - promptIndex + ownedCitedProfiles.length;
        break;
      }
      edgePromptUpdates += edges.length;
      ownedGapPromptGroups += 1;
      for (const edge of edges) {
        let support = edgeSupport.get(edge.key);
        if (!support) {
          support = {
            domainA: edge.domainA,
            domainB: edge.domainB,
            ownedGapPromptGroups: 0,
            ownedCitedPromptGroups: 0,
          };
          edgeSupport.set(edge.key, support);
          candidateEdges += 1;
        }
        support.ownedGapPromptGroups += 1;
      }
    }

    if (providerScanComplete) {
      for (let promptIndex = 0; promptIndex < ownedCitedProfiles.length; promptIndex += 1) {
        const prompt = ownedCitedProfiles[promptIndex]!;
        const edges = edgeKeys(prompt.domains, ownedDomains);
        if (edgePromptUpdates + edges.length > MAX_EDGE_PROMPT_UPDATES) {
          providerScanComplete = false;
          providerScanInterruptedAt = providerIndex;
          workBudgetExceeded = true;
          promptGroupsOmittedByScan += ownedCitedProfiles.length - promptIndex;
          break;
        }
        edgePromptUpdates += edges.length;
        ownedCitedPromptGroups += 1;
        for (const edge of edges) {
          const support = edgeSupport.get(edge.key);
          if (support) support.ownedCitedPromptGroups += 1;
        }
      }
    }

    const sourceDetailComplete = unknownSourceDetail === 0;
    const catalogComplete = panel.catalogComplete && providerScanComplete;
    const providerComparisonComplete =
      catalogComplete && sourceDetailComplete && unknownOwnedStatus === 0;
    for (const support of edgeSupport.values()) {
      if (support.ownedGapPromptGroups < MIN_OWNED_GAP_EDGE_PROMPTS) {
        edgeRowsBelowMinimumSupport += 1;
        continue;
      }
      const gapInterval = wilson(support.ownedGapPromptGroups, ownedGapPromptGroups);
      const citedInterval = wilson(support.ownedCitedPromptGroups, ownedCitedPromptGroups);
      const gapShare =
        ownedGapPromptGroups > 0 ? support.ownedGapPromptGroups / ownedGapPromptGroups : null;
      const citedShare =
        ownedCitedPromptGroups > 0 ? support.ownedCitedPromptGroups / ownedCitedPromptGroups : null;
      const difference = gapShare !== null && citedShare !== null ? gapShare - citedShare : null;
      const differenceLower =
        difference !== null && gapInterval && citedInterval
          ? difference -
            Math.sqrt(
              (gapShare! - gapInterval.lower) ** 2 + (citedInterval.upper - citedShare!) ** 2
            )
          : null;
      const differenceUpper =
        difference !== null && gapInterval && citedInterval
          ? difference +
            Math.sqrt(
              (gapInterval.upper - gapShare!) ** 2 + (citedShare! - citedInterval.lower) ** 2
            )
          : null;
      providerRows.push({
        row_type: 'provider-source-pair',
        provider: panel.provider,
        domain_a: support.domainA,
        domain_b: support.domainB,
        provider_prompt_groups: panel.promptGroups,
        owned_gap_prompt_groups: ownedGapPromptGroups,
        owned_cited_prompt_groups: ownedCitedPromptGroups,
        unknown_owned_status_prompt_groups: unknownOwnedStatus,
        unknown_source_detail_prompt_groups: unknownSourceDetail,
        owned_gap_edge_prompt_support: support.ownedGapPromptGroups,
        owned_cited_edge_prompt_support: support.ownedCitedPromptGroups,
        owned_gap_edge_prompt_share: gapShare === null ? null : round(gapShare),
        owned_cited_edge_prompt_share: citedShare === null ? null : round(citedShare),
        owned_gap_minus_owned_cited_share: difference === null ? null : round(difference),
        owned_gap_minus_owned_cited_lower_95:
          differenceLower === null ? null : round(differenceLower),
        owned_gap_minus_owned_cited_upper_95:
          differenceUpper === null ? null : round(differenceUpper),
        owned_gap_edge_lift:
          gapShare !== null && citedShare !== null && citedShare > 0
            ? round(gapShare / citedShare)
            : null,
        minimum_gap_edge_support: MIN_OWNED_GAP_EDGE_PROMPTS,
        provider_prompt_catalog_complete: panel.catalogComplete,
        provider_scan_complete: providerScanComplete,
        source_detail_complete: sourceDetailComplete,
        comparison_complete: providerComparisonComplete,
        provider_prompt_groups_omitted_by_scan: promptGroupsOmittedByScan,
        interpretation_note:
          'Prompt-level association only: external source pairs more/less often co-occur in complete prompts without an owned citation than in complete prompts with one. Wilson/Newcombe intervals are nominal and unadjusted across the screened edge catalog; related prompts can remain correlated. This is a review lead, not a source-quality or causal effect estimate.',
      });
    }
    providersEvaluated += 1;
    if (!providerScanComplete) {
      promptGroupsOmittedAfterScanInterruption =
        promptGroupsOmittedByScan +
        selectedPanels
          .slice(providerIndex + 1)
          .reduce((total, [, laterPanel]) => total + laterPanel.profiles.size, 0);
      break;
    }
  }

  const providersOmittedByCap = Math.max(0, panels.size - selectedPanels.length);
  const providersOmittedByWork =
    providerScanInterruptedAt === null
      ? 0
      : Math.max(0, selectedPanels.length - providerScanInterruptedAt - 1);
  providerRows.sort(
    (left, right) =>
      Number(right.owned_gap_minus_owned_cited_share ?? -2) -
        Number(left.owned_gap_minus_owned_cited_share ?? -2) ||
      String(left.provider).localeCompare(String(right.provider)) ||
      String(left.domain_a).localeCompare(String(right.domain_a)) ||
      String(left.domain_b).localeCompare(String(right.domain_b))
  );
  const outputRowsTruncated = providerRows.length > MAX_OUTPUT_ROWS;
  const summaryFields: Record<string, unknown> = {
    output_rows_available: providerRows.length,
    output_rows_emitted: Math.min(providerRows.length, MAX_OUTPUT_ROWS),
    output_rows_truncated: outputRowsTruncated,
  };
  summary.providers_available = panels.size;
  summary.providers_evaluated = providersEvaluated;
  summary.providers_omitted_by_cap = providersOmittedByCap;
  summary.providers_omitted_after_scan_interruption = providersOmittedByWork;
  summary.prompt_groups_omitted_after_scan_interruption = promptGroupsOmittedAfterScanInterruption;
  summary.edge_prompt_updates_evaluated = edgePromptUpdates;
  summary.edge_work_budget_exceeded = workBudgetExceeded;
  summary.complete_provider_scans =
    providersEvaluated - (providerScanInterruptedAt === null ? 0 : 1);
  summary.edge_catalog_available = candidateEdges;
  summary.edge_catalog_emitted = providerRows.length;
  summary.edge_catalog_truncated = edgeCatalogTruncated;
  summary.edge_rows_below_minimum_support = edgeRowsBelowMinimumSupport;
  Object.assign(summary, summaryFields);
  summary.interpretation_note = `Providers omitted after scan interruption: ${providersOmittedByWork}; edge work budget exceeded: ${workBudgetExceeded}; edge catalog truncated: ${edgeCatalogTruncated}.`;
  const output: Array<Record<string, unknown>> = [
    summary,
    ...providerRows.slice(0, MAX_OUTPUT_ROWS),
  ];
  return `${output.map((row) => headers.map((header) => csvCell(row[header] ?? '')).join(',')).join('\r\n')}\r\n`;
}
