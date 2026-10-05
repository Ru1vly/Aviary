import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import {
  renderAiAnswerCitationObservationHtml,
  renderAiAnswerCitationSourcePersistenceCsv,
  renderAiAnswerCitationUrlPersistenceCsv,
  renderAiAnswerCitationTemporalStabilityCsv,
} from '../../src/geo/answerCitationObservationsReporter';

const dates = [
  '2026-01-01T00:00:00Z',
  '2026-01-01T01:00:00Z',
  '2026-01-04T00:00:00Z',
  '2026-01-20T00:00:00Z',
  '2026-03-10T00:00:00Z',
  '2026-09-20T00:00:00Z',
];
function captures(complete: boolean) {
  return ['Search', 'Assistant'].flatMap((provider) =>
    [0, 1, 2].flatMap((prompt) =>
      dates.map((observedAt, index) => ({
        observedAt,
        provider,
        prompt: `Question ${prompt}`,
        model: 'v1',
        surface: 'web',
        locale: 'en-US',
        ...(prompt ? { topic: 'guides', intent: 'research' } : {}),
        citationListComplete: complete,
        citedUrls:
          index === 2
            ? []
            : index === 3
              ? ['https://other.example/replacement']
              : [
                  ...Array.from(
                    { length: [0, 1, 0, 0, 5, 10][index] },
                    (_, rank) => `https://source${rank}.example/article`
                  ),
                  'https://owned.example/guide?private=PRIVATE_QUERY',
                ],
      }))
    )
  );
}
function analyze(complete: boolean) {
  return analyzeAiAnswerCitationObservations(
    { schemaVersion: 1, observations: captures(complete) },
    ['owned.example'],
    '2026-10-05T00:00:00Z',
    [],
    { includeCitationUrlPersistence: true }
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
  for (const row of rows.slice(1)) expect(row.length).toBe(rows[0].length);
  expect(csv).not.toMatch(/PRIVATE_QUERY|NaN|Infinity/);
  return rows.slice(1).map((row) => Object.fromEntries(rows[0].map((key, i) => [key, row[i]])));
}
describe('citation persistence and cadence evidence', () => {
  it.each([true, false])(
    'preserves observed and unknown transitions with complete=%s',
    (complete) => {
      const report = analyze(complete);
      expect(records(renderAiAnswerCitationSourcePersistenceCsv(report)).length).toBeGreaterThan(0);
      expect(records(renderAiAnswerCitationUrlPersistenceCsv(report)).length).toBeGreaterThan(0);
      expect(records(renderAiAnswerCitationTemporalStabilityCsv(report)).length).toBeGreaterThan(0);
      const owned = report.sourcePersistenceProfiles?.filter(
        (p) => p.sourceDomain === 'owned.example'
      );
      expect(owned?.length).toBeGreaterThan(0);
      const html = renderAiAnswerCitationObservationHtml(report);
      expect(html).toContain('Citation-source retention by follow-up interval');
      expect(html).toContain('Cited-page URL persistence');
      expect(html).not.toMatch(/PRIVATE_QUERY|NaN%|Infinity%/);
      const window = new Window();
      window.document.write(html);
      for (const table of window.document.querySelectorAll('table')) {
        const columns = table.querySelectorAll(':scope > thead > tr:last-child > th').length;
        for (const row of table.querySelectorAll(':scope > tbody > tr'))
          expect(
            [...row.children].reduce((n, c) => n + (Number(c.getAttribute('colspan')) || 1), 0)
          ).toBe(columns);
      }
    }
  );
  it('excludes unknown next-timestamp absences from source persistence denominators', () => {
    const complete = analyze(true),
      partial = analyze(false);
    const known = complete.sourcePersistenceProfiles?.find(
      (p) => p.sourceDomain === 'owned.example' && p.provider === 'Search'
    );
    const unknown = partial.sourcePersistenceProfiles?.find(
      (p) => p.sourceDomain === 'owned.example' && p.provider === 'Search'
    );
    expect(known).toBeTruthy();
    expect(unknown).toBeTruthy();
    expect(unknown!.sourceNextTimestampUnobservedDueToTruncation).toBeGreaterThan(0);
    expect(unknown!.sourceTransitionsObservedAtNextTimestamp).toBeLessThan(
      known!.sourceTransitionsObservedAtNextTimestamp
    );
    expect(known!.sourceAbsentAtNextTimestamp).toBeGreaterThan(0);
    expect(known!.sourcePresentAtBothTimestamps).toBeGreaterThan(0);
  });
  it('combines simultaneous captures without introducing zero-duration transitions', () => {
    const samples = captures(true);
    const duplicate = { ...samples[0], citedUrls: ['https://other.example/duplicate'] };
    const report = analyzeAiAnswerCitationObservations(
      { schemaVersion: 1, observations: [...samples, duplicate] },
      ['owned.example'],
      '2026-10-05T00:00:00Z',
      [],
      { includeCitationUrlPersistence: true }
    );
    const csv = renderAiAnswerCitationSourcePersistenceCsv(report);
    expect(records(csv).length).toBeGreaterThan(0);
    expect(report.sourcePersistenceProfiles?.some((p) => p.sourceDomain === 'other.example')).toBe(
      true
    );
  });
  it('keeps legacy optional retention intervals absent without inventing precision', () => {
    const legacy = analyze(true);
    for (const profile of legacy.sourcePersistenceProfiles ?? []) {
      delete profile.retentionByFollowUpInterval;
      delete profile.retentionByPreviousCitationRank;
      delete profile.equalPromptMeanNextTimestampRetentionConfidenceInterval95;
    }
    const html = renderAiAnswerCitationObservationHtml(legacy);
    expect(html).not.toMatch(/NaN%|Infinity%/);
    expect(records(renderAiAnswerCitationSourcePersistenceCsv(legacy)).length).toBeGreaterThan(0);
  });
});
