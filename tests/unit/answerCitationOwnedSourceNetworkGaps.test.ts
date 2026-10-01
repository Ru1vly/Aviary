import { describe, expect, it } from 'vitest';
import type {
  AiAnswerCitationObservationReport,
  AiAnswerCitationPromptProviderProfile,
} from '../../src/geo/answerCitationObservations';
import { renderAiAnswerCitationOwnedSourceNetworkGapsCsv } from '../../src/geo/answerCitationOwnedSourceNetworkGaps';

type DomainEvents = Array<{ domain: string; citationEvents: number }>;

function profile(
  provider: string,
  ownedCitationEvents: number | undefined,
  domains: DomainEvents | undefined,
  citationEvents = domains?.reduce((sum, item) => sum + item.citationEvents, 0) ?? 0,
  citedDomainsTruncated = false
): AiAnswerCitationPromptProviderProfile {
  return {
    provider,
    observations: 1,
    observationsWithCitations: citationEvents > 0 ? 1 : 0,
    observationsWithoutCitations: citationEvents > 0 ? 0 : 1,
    citationEvents,
    firstObservedAt: '2026-09-30T10:00:00Z',
    lastObservedAt: '2026-09-30T10:00:00Z',
    citedDomains: domains?.map((item) => item.domain) ?? [],
    ...(domains ? { citedDomainCitationEvents: domains } : {}),
    citedDomainsTruncated,
    ...(ownedCitationEvents === undefined ? {} : { ownedCitationEvents }),
  };
}

function report(
  ownedDomains: string[],
  prompts: Array<{ prompt: string; providerProfiles?: AiAnswerCitationPromptProviderProfile[] }>,
  providers: Array<{ provider: string; uniquePrompts: number }>,
  promptsTruncated = false
): AiAnswerCitationObservationReport {
  return {
    source: 'Aviary observed AI answer citation analysis',
    schemaVersion: 1,
    analyzedAt: '2026-10-01T00:00:00Z',
    ownedDomains,
    summary: {} as AiAnswerCitationObservationReport['summary'],
    providers: providers as AiAnswerCitationObservationReport['providers'],
    domains: [],
    domainsTruncated: false,
    citedPages: [],
    citedPagesTruncated: false,
    prompts: prompts as AiAnswerCitationObservationReport['prompts'],
    promptsTruncated,
    reviewQueue: [],
    reviewQueueTruncated: false,
    monthly: [],
    topicIntentCohorts: [],
    topicIntentCohortsTruncated: false,
  };
}

function parseCsv(csv: string): string[][] {
  return csv
    .trimEnd()
    .split('\r\n')
    .map((line) => {
      const cells: string[] = [];
      let value = '';
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const character = line[index]!;
        if (character === '"') {
          if (quoted && line[index + 1] === '"') {
            value += '"';
            index += 1;
          } else {
            quoted = !quoted;
          }
        } else if (character === ',' && !quoted) {
          cells.push(value);
          value = '';
        } else {
          value += character;
        }
      }
      cells.push(value);
      return cells;
    });
}

function rowObject(headers: string[], row: string[]): Record<string, string> {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
}

function pairDomains(domains = ['alpha.example', 'beta.example']): DomainEvents {
  return domains.map((domain) => ({ domain, citationEvents: 1 }));
}

describe('owned-source network-gap CSV', () => {
  it('emits a header and an actionable summary when no owned domains are configured', () => {
    const rows = parseCsv(renderAiAnswerCitationOwnedSourceNetworkGapsCsv(report([], [], [])));
    const summary = rowObject(rows[0]!, rows[1]!);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('interpretation_note');
    expect(summary).toMatchObject({
      row_type: 'summary',
      owned_domains_configured: 'false',
      owned_domains: '[]',
      interpretation_note:
        'Configure at least one owned domain to classify exact prompts by owned-citation presence.',
    });
  });

  it('compares repeated external edges across owned-citation gap and cited prompts', () => {
    const edge = pairDomains();
    const prompts = [
      { prompt: 'gap one', providerProfiles: [profile('Search', 0, edge)] },
      { prompt: 'gap two', providerProfiles: [profile('Search', 0, edge)] },
      {
        prompt: 'owned citation present',
        providerProfiles: [
          profile('Search', 1, [...edge, { domain: 'brand.example', citationEvents: 1 }]),
        ],
      },
    ];
    const rows = parseCsv(
      renderAiAnswerCitationOwnedSourceNetworkGapsCsv(
        report(['brand.example'], prompts, [{ provider: 'Search', uniquePrompts: 3 }])
      )
    );
    const headers = rows[0]!;
    const summary = rowObject(headers, rows[1]!);
    const pair = rowObject(headers, rows[2]!);

    expect(pair).toMatchObject({
      row_type: 'provider-source-pair',
      provider: 'Search',
      domain_a: 'alpha.example',
      domain_b: 'beta.example',
      owned_gap_prompt_groups: '2',
      owned_cited_prompt_groups: '1',
      owned_gap_edge_prompt_support: '2',
      owned_cited_edge_prompt_support: '1',
      owned_gap_edge_prompt_share: '1',
      owned_cited_edge_prompt_share: '1',
      owned_gap_minus_owned_cited_share: '0',
      owned_gap_edge_lift: '1',
      provider_prompt_catalog_complete: 'true',
      provider_scan_complete: 'true',
      source_detail_complete: 'true',
      comparison_complete: 'true',
    });
    expect(Number(pair.owned_gap_minus_owned_cited_lower_95)).toBeLessThanOrEqual(0);
    expect(Number(pair.owned_gap_minus_owned_cited_upper_95)).toBeGreaterThanOrEqual(0);
    expect(summary).toMatchObject({
      providers_available: '1',
      providers_evaluated: '1',
      edge_catalog_available: '1',
      edge_catalog_emitted: '1',
      output_rows_emitted: '1',
      complete_provider_scans: '1',
    });
  });

  it('keeps unknown ownership and incomplete source evidence visible in complete edge rows', () => {
    const edge = pairDomains();
    const prompts = [
      { prompt: 'gap one', providerProfiles: [profile('Search', 0, edge)] },
      { prompt: 'gap two', providerProfiles: [profile('Search', 0, edge)] },
      { prompt: 'unknown ownership', providerProfiles: [profile('Search', undefined, edge)] },
      {
        prompt: 'unknown source list',
        providerProfiles: [profile('Search', 0, edge, 2, true)],
      },
    ];
    const rows = parseCsv(
      renderAiAnswerCitationOwnedSourceNetworkGapsCsv(
        report(['brand.example'], prompts, [{ provider: 'Search', uniquePrompts: 4 }])
      )
    );
    const pair = rowObject(rows[0]!, rows[2]!);

    expect(pair).toMatchObject({
      unknown_owned_status_prompt_groups: '1',
      unknown_source_detail_prompt_groups: '1',
      source_detail_complete: 'false',
      comparison_complete: 'false',
      owned_gap_prompt_groups: '2',
      provider_prompt_groups_omitted_by_scan: '0',
    });
  });

  it('excludes owned subdomains and reports edge rows below the minimum support', () => {
    const prompt = {
      prompt: 'single gap',
      providerProfiles: [
        profile('Search', 0, [
          { domain: 'brand.example', citationEvents: 1 },
          { domain: 'docs.brand.example', citationEvents: 1 },
          { domain: 'outside.example', citationEvents: 1 },
          { domain: 'other.example', citationEvents: 1 },
        ]),
      ],
    };
    const rows = parseCsv(
      renderAiAnswerCitationOwnedSourceNetworkGapsCsv(
        report(['brand.example'], [prompt], [{ provider: 'Search', uniquePrompts: 1 }])
      )
    );
    const summary = rowObject(rows[0]!, rows[1]!);

    expect(rows).toHaveLength(2);
    expect(summary).toMatchObject({
      edge_catalog_available: '1',
      edge_catalog_emitted: '0',
      edge_rows_below_minimum_support: '1',
    });
  });

  it('marks missing and duplicate prompt catalogs incomplete', () => {
    const edge = pairDomains();
    const prompts = [
      { prompt: 'gap one', providerProfiles: [profile('Search', 0, edge)] },
      { prompt: 'gap two', providerProfiles: [profile('Search', 0, edge)] },
      { prompt: 'provider profiles unavailable' },
      { prompt: 'duplicate prompt', providerProfiles: [profile('Search', 0, edge)] },
      { prompt: 'DUPLICATE PROMPT', providerProfiles: [profile('Search', 0, edge)] },
    ];
    const rows = parseCsv(
      renderAiAnswerCitationOwnedSourceNetworkGapsCsv(
        report(['brand.example'], prompts, [{ provider: 'Search', uniquePrompts: 4 }], true)
      )
    );
    const pair = rowObject(rows[0]!, rows[2]!);

    expect(pair).toMatchObject({
      provider_prompt_catalog_complete: 'false',
      comparison_complete: 'false',
    });
  });

  it('caps providers and output rows while reporting both limits', () => {
    const providers = Array.from({ length: 501 }, (_, index) => ({
      provider: `Provider ${String(index).padStart(3, '0')}`,
      uniquePrompts: 0,
    }));
    const providerRows = parseCsv(
      renderAiAnswerCitationOwnedSourceNetworkGapsCsv(report(['brand.example'], [], providers))
    );
    const providerSummary = rowObject(providerRows[0]!, providerRows[1]!);
    expect(providerSummary).toMatchObject({
      providers_available: '501',
      providers_evaluated: '500',
      providers_omitted_by_cap: '1',
    });

    const domains = Array.from({ length: 202 }, (_, index) => `source-${index}.example`);
    const pairEvents = pairDomains(domains);
    const prompts = [
      { prompt: 'gap one', providerProfiles: [profile('Search', 0, pairEvents)] },
      { prompt: 'gap two', providerProfiles: [profile('Search', 0, pairEvents)] },
    ];
    const gapRows = parseCsv(
      renderAiAnswerCitationOwnedSourceNetworkGapsCsv(
        report(['brand.example'], prompts, [{ provider: 'Search', uniquePrompts: 2 }])
      )
    );
    const gapSummary = rowObject(gapRows[0]!, gapRows[1]!);
    expect(gapSummary).toMatchObject({
      edge_catalog_available: '20301',
      edge_catalog_emitted: '20301',
      output_rows_available: '20301',
      output_rows_emitted: '20000',
      output_rows_truncated: 'true',
    });
  });

  it('stops before emitting an edge catalog that exceeds its bounded capacity', () => {
    const domains = Array.from({ length: 708 }, (_, index) => `source-${index}.example`);
    const edge = pairDomains(domains);
    const prompts = [
      { prompt: 'gap one', providerProfiles: [profile('Search', 0, edge)] },
      { prompt: 'gap two', providerProfiles: [profile('Search', 0, edge)] },
    ];
    const rows = parseCsv(
      renderAiAnswerCitationOwnedSourceNetworkGapsCsv(
        report(['brand.example'], prompts, [{ provider: 'Search', uniquePrompts: 2 }])
      )
    );
    const summary = rowObject(rows[0]!, rows[1]!);

    expect(rows).toHaveLength(2);
    expect(summary).toMatchObject({
      providers_evaluated: '1',
      providers_omitted_after_scan_interruption: '0',
      prompt_groups_omitted_after_scan_interruption: '2',
      edge_work_budget_exceeded: 'false',
      edge_catalog_available: '0',
      edge_catalog_truncated: 'true',
      complete_provider_scans: '0',
    });
  });
});
