import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  appendSEOAuditBatchHistory,
  appendSEOReportHistory,
  generateSEOAuditHistoryHtmlReport,
  generateSEOAuditHistoryReportFromFile,
  readSEOAuditHistory,
  renderSEOAuditHistoryHtml,
} from '../../src/history';
import type { SEOAuditBatchReport, SEOAuditHistoryRecord, SEOReport } from '../../src/types';

let directory: string;

function createDirectory(): string {
  directory = mkdtempSync(join(tmpdir(), 'aviary-history-test-'));
  return directory;
}

function record(overrides: Partial<SEOAuditHistoryRecord> = {}): SEOAuditHistoryRecord {
  return {
    timestamp: '2026-10-01T10:00:00.000Z',
    url: 'https://example.com/',
    status: 'complete',
    score: 90,
    summary: { total: 1, passed: 1, failed: 0 },
    failedChecks: [],
    ...overrides,
  };
}

function writeHistory(records: SEOAuditHistoryRecord[], suffix = '.jsonl'): string {
  const filePath = join(createDirectory(), `history${suffix}`);
  writeFileSync(filePath, records.map((item) => JSON.stringify(item)).join('\n'), 'utf8');
  return filePath;
}

afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

describe('SEO audit history', () => {
  it('appends compact single and batch records, retaining individual errors and audit settings', () => {
    const filePath = join(createDirectory(), 'nested', 'history.jsonl');
    const report = {
      timestamp: '2026-10-01T10:00:00.000Z',
      url: 'https://example.com/',
      score: 80,
      summary: { total: 2, passed: 1, failed: 1 },
      categories: ['geo'],
      navigationWaitUntil: 'domcontentloaded',
      settleAfterNavigationMs: 500,
      checks: { geo: [{ passed: false, name: 'Answer-ready text', message: 'Missing summary.' }] },
    } as unknown as SEOReport;
    appendSEOReportHistory(report, filePath);
    const batch = {
      timestamp: '2026-10-01T11:00:00.000Z',
      results: [
        { status: 'complete', url: report.url, report },
        { status: 'error', url: 'https://example.com/broken', error: 'Navigation timed out.' },
      ],
    } as unknown as SEOAuditBatchReport;
    appendSEOAuditBatchHistory(batch, filePath);

    const lines = readFileSync(filePath, 'utf8').trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      status: 'complete',
      categories: ['geo'],
      navigationWaitUntil: 'domcontentloaded',
      settleAfterNavigationMs: 500,
      failedChecks: [{ category: 'geo', name: 'Answer-ready text', message: 'Missing summary.' }],
    });
    expect(readSEOAuditHistory(filePath)).toEqual([
      expect.objectContaining({ status: 'complete', score: 80 }),
      expect.objectContaining({ status: 'complete', score: 80 }),
      expect.objectContaining({
        timestamp: batch.timestamp,
        url: 'https://example.com/broken',
        status: 'error',
        score: null,
        error: 'Navigation timed out.',
      }),
    ]);
  });

  it('reads blank lines, CRLF, and a final unterminated record while rejecting malformed data', () => {
    const valid = JSON.stringify(record());
    const filePath = join(createDirectory(), 'valid.jsonl');
    writeFileSync(filePath, `\r\n${valid}\r\n\n${valid}`, 'utf8');
    expect(readSEOAuditHistory(filePath)).toHaveLength(2);

    const invalidInputs = [
      ['{bad json}\n', /Invalid JSON.*line 1/],
      [`${JSON.stringify({ ...record(), score: 101 })}\n`, /Invalid audit history record.*line 1/],
      [
        `${JSON.stringify({ ...record(), summary: { total: 2, passed: 1, failed: 0 } })}`,
        /Invalid audit history record/,
      ],
    ] as const;
    for (const [contents, expectedError] of invalidInputs) {
      writeFileSync(filePath, contents, 'utf8');
      expect(() => readSEOAuditHistory(filePath)).toThrow(expectedError);
    }

    writeFileSync(filePath, Buffer.from([0xff, 0x0a]));
    expect(() => readSEOAuditHistory(filePath)).toThrow(/Invalid UTF-8.*line 1/);
  });

  it('enforces the per-record size cap and closes files after parse failures', () => {
    const filePath = join(createDirectory(), 'oversized.jsonl');
    writeFileSync(filePath, `${'x'.repeat(10 * 1024 * 1024 + 1)}\n`, 'utf8');
    expect(() => readSEOAuditHistory(filePath)).toThrow(/exceeds the 10 MiB record limit/);

    writeFileSync(filePath, `${JSON.stringify(record())}\n`);
    expect(readSEOAuditHistory(filePath)).toHaveLength(1);
  });

  it('renders escaped latest findings, score trends, errors, and an empty state', () => {
    const records = [
      record({
        timestamp: '2026-10-01T10:00:00.000Z',
        score: 72,
        failedChecks: [
          { category: '<script>', name: '"quoted"', message: '<img onerror=alert(1)>' },
        ],
      }),
      record({
        timestamp: '2026-10-01T11:00:00.000Z',
        score: 84,
        failedChecks: [
          { category: '<script>', name: '"quoted"', message: '<img onerror=alert(1)>' },
        ],
      }),
      record({
        timestamp: '2026-10-01T12:00:00.000Z',
        url: 'https://example.com/broken?token=<secret>',
        status: 'error',
        score: null,
        summary: { total: 0, passed: 0, failed: 0 },
        failedChecks: [],
        error: '<network error>',
      }),
    ];
    const html = renderSEOAuditHistoryHtml(records);
    expect(html).toContain('Audit history');
    expect(html).toContain('Δ +12');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img onerror=alert(1)&gt;');
    expect(html).not.toContain('<img onerror=alert(1)>');
    expect(html).toContain('https://example.com/broken?token=&lt;secret&gt;');
    expect(html).toContain('&lt;network error&gt;');
    expect(renderSEOAuditHistoryHtml([])).toContain('No history records yet.');
    expect(renderSEOAuditHistoryHtml([record({ score: null })])).toContain('No scored audits yet.');
  });

  it('downsamples long score series and writes reports without overwriting history', () => {
    const records = Array.from({ length: 400 }, (_, index) =>
      record({
        timestamp: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
        score: index % 2 === 0 ? 20 : 95,
      })
    );
    const html = renderSEOAuditHistoryHtml(records);
    expect((html.match(/<circle /g) ?? []).length).toBeLessThanOrEqual(180);
    expect(html).toContain('2026-01-01');

    const historyPath = writeHistory(records);
    const outputPath = join(directory, 'reports', 'history.html');
    expect(() => generateSEOAuditHistoryReportFromFile(historyPath, historyPath)).toThrow(
      /must differ/
    );
    generateSEOAuditHistoryReportFromFile(historyPath, outputPath);
    expect(readFileSync(outputPath, 'utf8')).toContain('Audit history');

    const directPath = join(directory, 'direct', 'history.html');
    generateSEOAuditHistoryHtmlReport([record()], directPath);
    expect(readFileSync(directPath, 'utf8')).toContain('https://example.com/');
  });
});
