import { describe, expect, it } from 'vitest';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import * as source from '../../src/geo/answerCitationSourcePortfolioDrift';
function report(owned: boolean, provider = 'Search', count = 12) {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: Array.from({ length: count }, (_, index) => ({
        observedAt: '2026-10-01T00:00:00Z',
        provider,
        prompt: `Prompt ${index}`,
        citedUrls: owned
          ? ['https://owned.example/guide', 'https://news.example/article']
          : ['https://news.example/article'],
        citationListComplete: true,
      })),
    },
    ['owned.example'],
    '2026-10-01T01:00:00Z'
  );
}
const baseline = report(true);
const current = report(false);
describe('owned source-share gate and attribution contracts', () => {
  it('reports a supported 50-point decline with bootstrap and sign-test evidence', () => {
    const assessment = source.assessAiAnswerCitationOwnedSourceShareDrop(
      current,
      baseline,
      10,
      10,
      10,
      0.05
    );
    expect(assessment.status).toBe('regression');
    expect(assessment.rows[0]).toMatchObject({
      declinePercentagePoints: 50,
      bootstrapState: 'available',
      signTestState: 'available',
      pointThresholdExceeded: true,
      lowerCiThresholdExceeded: true,
      signTestThresholdExceeded: true,
    });
    expect(
      JSON.parse(source.renderAiAnswerCitationOwnedSourceShareGateJson(assessment)).assessment
    ).toEqual(assessment);
    expect(source.renderAiAnswerCitationOwnedSourceShareGateCsv(assessment)).toContain(
      '"regression"'
    );
  });
  it('passes unchanged evidence and preserves tied sign-test insufficiency', () => {
    expect(source.assessAiAnswerCitationOwnedSourceShareDrop(baseline, baseline, 10).status).toBe(
      'passed'
    );
    const tied = source.assessAiAnswerCitationOwnedSourceShareDrop(
      baseline,
      baseline,
      0,
      10,
      undefined,
      0.05
    );
    expect(tied.status).toBe('incomplete');
    expect(tied.rows[0].signTestState).toBe('insufficient-support');
  });
  it('fails closed on absent providers and capped prompt catalogs', () => {
    const missing = source.assessAiAnswerCitationOwnedSourceShareDrop(
      report(false, 'Other'),
      baseline,
      10
    );
    expect(missing.status).toBe('incomplete');
    const capped = structuredClone(current);
    capped.promptsTruncated = true;
    expect(source.assessAiAnswerCitationOwnedSourceShareDrop(capped, baseline, 10).status).toBe(
      'incomplete'
    );
  });
  it('keeps incomplete per-domain detail out of the complete comparison', () => {
    const partial = structuredClone(current);
    partial.prompts[0].providerProfiles![0].citedDomainsTruncated = true;
    expect(source.assessAiAnswerCitationOwnedSourceShareDrop(partial, baseline, 10).status).toBe(
      'incomplete'
    );
  });
  it('requires sufficient support and the same nonempty owned domain set', () => {
    expect(
      source.assessAiAnswerCitationOwnedSourceShareDrop(
        report(false, 'Search', 2),
        report(true, 'Search', 2),
        10
      ).status
    ).toBe('incomplete');
    const mismatch = structuredClone(current);
    mismatch.ownedDomains = ['different.example'];
    expect(source.assessAiAnswerCitationOwnedSourceShareDrop(mismatch, baseline, 10).status).toBe(
      'incomplete'
    );
  });
  it.each([
    { csv: true, json: true, html: true },
    { csv: true },
    { json: true },
    { html: true },
    {},
  ])('selects requested attribution artifact formats %j', (formats) => {
    const outputs = source.renderAiAnswerCitationSourcePortfolioAttributionArtifacts(
      current,
      baseline,
      formats
    );
    expect(Boolean(outputs.csv)).toBe(Boolean(formats.csv));
    expect(Boolean(outputs.json)).toBe(Boolean(formats.json));
    expect(Boolean(outputs.html)).toBe(Boolean(formats.html));
    if (outputs.json) expect(JSON.parse(outputs.json).formatVersion).toBe(1);
    if (outputs.html) expect(outputs.html).toContain('<!doctype html>');
  });
  it.each([NaN, -1, 101])('rejects invalid drop threshold %s', (value) =>
    expect(() =>
      source.assessAiAnswerCitationOwnedSourceShareDrop(current, baseline, value)
    ).toThrow()
  );
  it.each([0, 1, 1.5, 10001])('rejects invalid support minimum %s', (value) =>
    expect(() =>
      source.assessAiAnswerCitationOwnedSourceShareDrop(current, baseline, 10, value)
    ).toThrow()
  );
});
