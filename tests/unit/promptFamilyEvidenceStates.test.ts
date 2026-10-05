import { describe, expect, it } from 'vitest';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import * as renderer from '../../src/geo/answerCitationPromptSimilarity';

function panel(complete: boolean, owned: boolean, provider = 'Search') {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: [
        {
          provider,
          prompt: 'blue apples sweet fruit guide',
          observedAt: '2026-10-01T00:00:00Z',
          citedUrls: ['https://owned.example/a'],
          citationListComplete: complete,
        },
        {
          provider,
          prompt: 'blue apples ripe fruit guide',
          observedAt: '2026-10-02T00:00:00Z',
          citedUrls: ['https://news.example/a'],
          citationListComplete: complete,
        },
        {
          provider: 'Assistant',
          prompt: 'blue apples sweet fruit guide',
          observedAt: '2026-10-03T00:00:00Z',
          citedUrls: [],
          citationListComplete: complete,
        },
        {
          provider: 'Assistant',
          prompt: 'quantum qubits computing guide',
          observedAt: '2026-10-04T00:00:00Z',
          citedUrls: [],
          citationListComplete: complete,
        },
      ],
    },
    owned ? ['owned.example'] : [],
    '2026-10-05T00:00:00Z'
  );
}
const current = panel(true, true);
const incomplete = panel(false, true);
const legacy = structuredClone(current);
for (const prompt of legacy.prompts) delete prompt.providerProfiles;
const capped = structuredClone(current);
capped.promptsTruncated = true;
capped.domainsTruncated = true;
for (const prompt of capped.prompts) {
  prompt.citedDomainsTruncated = true;
  for (const profile of prompt.providerProfiles ?? []) profile.citedDomainsTruncated = true;
}
const noRetainedPrompts = structuredClone(capped);
noRetainedPrompts.prompts = [];
const cases = [
  { name: 'incomplete citation lists', report: incomplete },
  { name: 'legacy provider profiles unavailable', report: legacy },
  { name: 'capped retained catalog', report: capped },
  { name: 'no retained prompts in capped catalog', report: noRetainedPrompts },
  { name: 'unconfigured owned domain', report: panel(true, false) },
];
const mappings = [
  { domain: 'owned.example', label: 'Owned', labelKey: 'owned' },
  { domain: 'news.example', label: 'News', labelKey: 'news' },
];

const csvExporters = [
  {
    name: 'family rows',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamiliesCsv(r, 0.25, mappings),
  },
  {
    name: 'similarity rows',
    render: (r: typeof current) => renderer.renderAiAnswerCitationPromptSimilarityCsv(r, 0.25),
  },
  {
    name: 'family influence',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamilyInfluenceCsv(r, 0.25, mappings),
  },
  {
    name: 'threshold sensitivity',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamilyThresholdSweepCsv(r, 0.25, mappings),
  },
  {
    name: 'source discovery',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamilySourceRarefactionCsv(r, 0.25, 3, mappings),
  },
  {
    name: 'source discovery sensitivity',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamilySourceRarefactionThresholdSweepCsv(
        r,
        0.25,
        3,
        mappings
      ),
  },
  {
    name: 'provider overlap',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationProviderPromptFamilySourceOverlapCsv(r, 0.25, mappings),
  },
  {
    name: 'provider overlap sensitivity',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationProviderPromptFamilySourceOverlapThresholdSweepCsv(
        r,
        0.25,
        mappings
      ),
  },
  {
    name: 'period comparison',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamilyPeriodComparisonCsv(r, r, 0.25, mappings),
  },
  {
    name: 'period sensitivity',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepCsv(
        r,
        r,
        0.25,
        mappings
      ),
  },
  {
    name: 'period sensitivity summary',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepSummaryCsv(
        r,
        r,
        0.25,
        mappings
      ),
  },
];
const htmlExporters = [
  {
    name: 'family dashboard',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamiliesHtml(r, 0.25, mappings),
  },
  {
    name: 'influence dashboard',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamilyInfluenceHtml(r, 0.25, mappings),
  },
  {
    name: 'threshold dashboard',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamilyThresholdSweepHtml(r, 0.25, mappings),
  },
  {
    name: 'source discovery dashboard',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamilySourceRarefactionThresholdSweepHtml(
        r,
        0.25,
        3,
        mappings
      ),
  },
  {
    name: 'provider overlap dashboard',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationProviderPromptFamilySourceOverlapHtml(r, 0.25, mappings),
  },
  {
    name: 'provider sensitivity dashboard',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationProviderPromptFamilySourceOverlapThresholdSweepHtml(
        r,
        0.25,
        mappings
      ),
  },
  {
    name: 'period dashboard',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamilyPeriodComparisonHtml(r, r, 0.25, mappings),
  },
  {
    name: 'period sensitivity dashboard',
    render: (r: typeof current) =>
      renderer.renderAiAnswerCitationPromptFamilyPeriodComparisonThresholdSweepHtml(
        r,
        r,
        0.25,
        mappings
      ),
  },
];
describe('prompt-family sparse and legacy evidence contracts', () => {
  for (const scenario of cases) {
    it.each(csvExporters)(`${scenario.name} $name preserves CSV contracts`, ({ render }) => {
      const csv = render(scenario.report);
      const rows = csv
        .trimEnd()
        .split('\r\n')
        .map((line) =>
          [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((m) => m[1].replace(/""/g, '"'))
        );
      expect(rows[0].length).toBeGreaterThan(1);
      expect(new Set(rows[0]).size).toBe(rows[0].length);
      for (const row of rows.slice(1)) expect(row.length).toBe(rows[0].length);
      expect(csv).not.toMatch(/NaN|Infinity/);
    });
    it.each(htmlExporters)(`${scenario.name} $name remains self-contained`, ({ render }) => {
      const html = render(scenario.report);
      expect(html).toContain('<html');
      expect(html).not.toContain('<script src=');
      expect(html).not.toMatch(/NaN%|Infinity%/);
    });
  }
  it('keeps summary metadata under the same named columns as pair rows', () => {
    const csv = renderer.renderAiAnswerCitationPromptSimilarityCsv(current, 0.25);
    const rows = csv
      .trimEnd()
      .split('\r\n')
      .map((line) =>
        [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) => match[1].replace(/""/g, '"'))
      );
    const summary = Object.fromEntries(rows[0].map((key, index) => [key, rows[1][index]]));
    expect(summary).toMatchObject({
      row_type: 'summary',
      shared_providers: '',
      retained_prompt_groups: String(current.prompts.length),
      prompt_catalog_truncated: 'false',
      candidate_pairs_capped: 'false',
      output_rows_truncated: 'false',
    });
    expect(Number(summary.candidate_pairs_considered)).toBeGreaterThan(0);
    expect(Number(summary.high_frequency_posting_cutoff)).toBeGreaterThan(0);
    expect(summary.interpretation_note).toContain('Lexical TF-IDF');
  });
  it('exposes one family with two prompts and two isolated provider samples', () => {
    const result = renderer.analyzeAiAnswerCitationPromptFamilyPartition(current, 0.25);
    expect(result.families.map((f) => f.length).sort()).toEqual([1, 2]);
    expect(result.promptCatalogTruncated).toBe(false);
    expect(
      renderer.analyzeAiAnswerCitationPromptFamilyPartition(capped, 0.25).promptCatalogTruncated
    ).toBe(true);
  });
  it.each([-1, 1.01, Number.NaN])('rejects invalid cutoff %s across family exporters', (cutoff) => {
    expect(() => renderer.renderAiAnswerCitationPromptFamiliesCsv(current, cutoff)).toThrow(
      /threshold/
    );
    expect(() =>
      renderer.renderAiAnswerCitationPromptFamilyPeriodComparisonCsv(current, current, cutoff)
    ).toThrow(/threshold/);
    expect(() =>
      renderer.renderAiAnswerCitationPromptFamilyThresholdSweepCsv(current, cutoff)
    ).toThrow(/threshold/);
  });
});
