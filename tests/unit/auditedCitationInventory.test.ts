import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import type { SiteWideGeoAnalysis } from '../../src/sitewide';
import {
  analyzeAiAnswerCitationObservations,
  correlateAiAnswerCitationObservationsWithAudit,
  compareAiAnswerCitationObservationPeriods,
  type AiAnswerCitationObservationReport,
} from '../../src/geo/answerCitationObservations';
import * as renderer from '../../src/geo/answerCitationObservationsReporter';

function fixture(name: string) {
  return JSON.parse(readFileSync(new URL(`../../examples/${name}`, import.meta.url), 'utf8'));
}
const audit: SiteWideGeoAnalysis = fixture(
  'geo-audited-page-provider-inventory.sitewide.synthetic.example.json'
);
const previousAudit: SiteWideGeoAnalysis = fixture(
  'geo-audited-page-provider-inventory.baseline-sitewide.synthetic.example.json'
);
function capture(before: boolean, site: SiteWideGeoAnalysis) {
  return correlateAiAnswerCitationObservationsWithAudit(
    analyzeAiAnswerCitationObservations(
      fixture(
        `geo-audited-page-provider-inventory.${before ? 'baseline' : 'answers'}.synthetic.example.json`
      ),
      ['example.com'],
      '2026-10-05T00:00:00Z'
    ),
    site
  );
}
function records(csv: string) {
  const rows = csv
    .trimEnd()
    .split('\r\n')
    .map((line) =>
      [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((m) => m[1].replace(/""/g, '"'))
    );
  expect(new Set(rows[0]).size).toBe(rows[0].length);
  expect(rows[0].every(Boolean)).toBe(true);
  for (const row of rows.slice(1)) expect(row.length).toBe(rows[0].length);
  expect(csv).not.toMatch(/NaN|Infinity/);
  return rows.slice(1).map((row) => Object.fromEntries(rows[0].map((key, i) => [key, row[i]])));
}
function dashboard(html: string) {
  const window = new Window();
  window.document.write(html);
  expect(window.document.title).toBeTruthy();
  for (const table of window.document.querySelectorAll('table')) {
    const columns = table.querySelectorAll(':scope > thead > tr:last-child > th').length;
    for (const row of table.querySelectorAll(':scope > tbody > tr'))
      expect(
        [...row.children].reduce((n, c) => n + (Number(c.getAttribute('colspan')) || 1), 0)
      ).toBe(columns);
  }
  expect(html).not.toContain('<img src=x onerror=alert(1)>');
  expect(html).not.toMatch(/NaN%|Infinity%/);
}
const current = capture(false, audit);
const baseline = capture(true, previousAudit);
const sharedBaseline = capture(true, audit);

describe('audited citation inventory contracts', () => {
  it('keeps page/provider denominators and typed comparison rows consistent', () => {
    const csv = renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonCsv(
      current,
      baseline,
      audit,
      previousAudit
    );
    const rows = records(csv);
    expect(rows.length).toBeGreaterThan(0);
    const json =
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonJsonFromCsv(csv);
    expect(json.summary.rows).toBe(rows.length);
    expect(json.rows.length).toBe(rows.length);
    expect(
      JSON.parse(
        renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonJson(
          current,
          baseline,
          audit,
          previousAudit
        )
      )
    ).toEqual(json);
    dashboard(
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonHtmlFromCsv(csv)
    );
    const inventory = records(
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryCsv(current, audit)
    );
    expect(inventory.length).toBe(
      audit.pageSummaries.filter((p) => {
        const host = new URL(p.url).hostname;
        return host === 'example.com' || host.endsWith('.example.com');
      }).length * current.providers.length
    );
    dashboard(
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryHtmlFromCsv(
        renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryCsv(current, audit)
      )
    );
  });
  it.each([
    renderer.renderAiAnswerCitationDateModifiedAlignmentCsv,
    renderer.renderAiAnswerCitationAuditSignalsCsv,
    (report: AiAnswerCitationObservationReport) =>
      renderer.renderAiAnswerCitationAuditedOwnedPagesCsv(report, audit),
    (report: AiAnswerCitationObservationReport) =>
      renderer.renderAiAnswerCitationAuditedOwnedPageProvidersCsv(report, audit),
    (report: AiAnswerCitationObservationReport) =>
      renderer.renderAiAnswerCitationAuditedOwnedPageComparisonCsv(report, sharedBaseline, audit),
    (report: AiAnswerCitationObservationReport) =>
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderComparisonCsv(
        report,
        sharedBaseline,
        audit
      ),
  ])('%s preserves aligned independently joined outputs', (render) => {
    expect(records(render(current)).length).toBeGreaterThan(0);
  });
  it.each([
    'previewControls',
    'answerContent',
    'sourceRenderedContent',
    'dataUseCrawlerPolicy',
    'userInitiatedFetchAccess',
    'optionalLlmsFiles',
    'canonicalUrl',
  ] as const)('keeps absent saved %s evidence distinguishable from a measured change', (field) => {
    const legacy = structuredClone(audit);
    for (const page of legacy.pageSummaries) delete page[field];
    const report = capture(false, legacy);
    const csv = renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonCsv(
      report,
      baseline,
      legacy,
      previousAudit
    );
    const data = records(csv);
    expect(data.length).toBeGreaterThan(0);
    dashboard(
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonHtmlFromCsv(csv)
    );
    const json =
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonJsonFromCsv(csv);
    expect(json.summary.rows).toBe(data.length);
    const absentEvidence = {
      previewControls: ['http_response_status_transition', 'unknown'],
      answerContent: ['visible_author_transition', 'unknown'],
      sourceRenderedContent: ['rendered_phrase_coverage_change', ''],
      dataUseCrawlerPolicy: ['data_use_crawler_policy_transition', 'no-common-tokens'],
      userInitiatedFetchAccess: ['user_initiated_fetch_transition', 'no-common-tokens'],
      optionalLlmsFiles: ['optional_llms_files_transition', 'no-common-paths'],
      canonicalUrl: ['canonical_url_transition', 'unknown'],
    };
    const [column, expected] = absentEvidence[field];
    expect(data.every((row) => row[column] === expected)).toBe(true);
  });
  it('rejects changed audit page sets instead of fabricating matched evidence', () => {
    const site = structuredClone(audit);
    site.pageSummaries = site.pageSummaries.slice(1);
    const report = capture(false, site);
    expect(() =>
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonCsv(
        report,
        baseline,
        site,
        previousAudit
      )
    ).toThrow(/same normalized owned-page URL set/);
  });
  it('keeps one-sided providers explicit instead of fabricating matched evidence', () => {
    const report = capture(false, audit);
    report.providers = report.providers.slice(0, 1);
    const csv = renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonCsv(
      report,
      baseline,
      audit,
      previousAudit
    );
    const rows = records(csv);
    expect(rows.some((row) => row.comparison_state !== 'comparable')).toBe(true);
    const json =
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonJsonFromCsv(csv);
    expect(json.summary.unknownOrOneSidedRows).toBeGreaterThan(0);
    dashboard(
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonHtmlFromCsv(csv)
    );
  });
  it('reports bounded cited-page evidence without treating hidden citations as confirmed absence', () => {
    const capped = structuredClone(current);
    capped.citedPagesTruncated = true;
    const csv = renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonCsv(
      capped,
      baseline,
      audit,
      previousAudit
    );
    const rows = records(csv);
    expect(rows.every((row) => row.current_cited_page_detail_truncated === 'true')).toBe(true);
    dashboard(
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonHtmlFromCsv(csv)
    );
  });
  it('rejects duplicate normalized owned audit URLs and mismatched timestamps', () => {
    const duplicated = structuredClone(audit);
    duplicated.pageSummaries.push({
      ...duplicated.pageSummaries[0],
      url: `${duplicated.pageSummaries[0].url}#duplicate`,
    });
    expect(() =>
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryCsv(current, duplicated)
    ).toThrow(/duplicate normalized/);
    expect(() =>
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryCsv(current, {
        ...audit,
        auditTimestamp: 'other',
      })
    ).toThrow(/correlated/);
    expect(() =>
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonCsv(
        current,
        baseline,
        audit
      )
    ).toThrow(/corresponding audit timestamp/);
  });
  it('rejects missing correlation and incompatible owned scope', () => {
    const legacy = structuredClone(current);
    delete legacy.auditCorrelation;
    expect(() =>
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryCsv(legacy, audit)
    ).toThrow(/correlated/);
    expect(() =>
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonCsv(
        legacy,
        baseline,
        audit,
        previousAudit
      )
    ).toThrow(/corresponding audit/);
    const unowned = { ...current, ownedDomains: [] };
    expect(() =>
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryCsv(unowned, audit)
    ).toThrow(/owned-domain/);
    expect(() =>
      renderer.renderAiAnswerCitationAuditedOwnedPageProviderInventoryComparisonCsv(
        unowned,
        baseline,
        audit,
        previousAudit
      )
    ).toThrow(/same non-empty/);
  });
  it('renders correlated citations in the general dashboard', () => {
    const report = capture(false, audit);
    report.periodComparison = compareAiAnswerCitationObservationPeriods(sharedBaseline, report);
    dashboard(renderer.renderAiAnswerCitationObservationHtml(report));
  });
});
