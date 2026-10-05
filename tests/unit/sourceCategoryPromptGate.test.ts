import { describe, expect, it } from 'vitest';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import {
  assessAiAnswerCitationSourceCategoryPromptBalancedJsdGate as assess,
  renderAiAnswerCitationSourceCategoryPromptBalancedJsdGateJson as renderJson,
  renderAiAnswerCitationSourceCategoryMixDecompositionCsv as renderCsv,
  renderAiAnswerCitationSourceCategoryMixDecompositionHtml as renderHtml,
} from '../../src/geo/answerCitationObservationsReporter';

const mappings = ['news.example=News', 'reference.example=Reference'];
function panel(domain: string, provider = 'Search', count = 12) {
  return analyzeAiAnswerCitationObservations(
    {
      schemaVersion: 1,
      observations: Array.from({ length: count }, (_, index) => ({
        provider,
        prompt: `Question ${index}`,
        observedAt: '2026-10-01T00:00:00Z',
        citedUrls: [`https://${domain}/article`],
        citationListComplete: true,
      })),
    },
    [],
    '2026-10-05T00:00:00Z'
  );
}
const before = panel('reference.example'),
  after = panel('news.example');
describe('prompt-paired source-category JSD gate', () => {
  it('requires bootstrap evidence and measures full-category replacement as one bit', () => {
    const result = assess(after, before, mappings, 0.5);
    expect(result).toMatchObject({
      complete: true,
      exceeded: true,
      comparablePromptGroups: 12,
      promptBalancedJsdBits: 1,
      promptBalancedJsdCi95LowerBits: 1,
      promptBalancedJsdCi95UpperBits: 1,
      bootstrapState: 'available',
    });
    expect(JSON.parse(renderJson(result))).toMatchObject({ ...result, schemaVersion: 1 });
    expect(assess(after, before, mappings, 1).exceeded).toBe(false);
    expect(assess(before, before, mappings, 0)).toMatchObject({
      complete: true,
      exceeded: false,
      promptBalancedJsdBits: 0,
    });
    expect(renderCsv(after, before, mappings)).toContain('"category"');
    expect(renderHtml(after, before, mappings)).not.toMatch(/NaN|Infinity/);
  });
  it.each([
    'domain cap',
    'prompt cap',
    'no shared provider',
    'insufficient prompts',
    'no mapped sources',
  ])('%s withholds a passing evidence claim', (state) => {
    const current =
      state === 'no shared provider'
        ? panel('news.example', 'Other')
        : state === 'insufficient prompts'
          ? panel('news.example', 'Search', 1)
          : structuredClone(after);
    if (state === 'domain cap')
      for (const prompt of current.prompts)
        for (const profile of prompt.providerProfiles ?? []) profile.citedDomainsTruncated = true;
    if (state === 'prompt cap') current.promptsTruncated = true;
    const categories = state === 'no mapped sources' ? ['unseen.example=Unseen'] : mappings;
    expect(assess(current, before, categories, 0.1)).toMatchObject({
      complete: false,
      exceeded: false,
    });
    expect(renderHtml(current, before, categories)).not.toMatch(/NaN|Infinity/);
  });
  it.each([-1, 1.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid threshold %s',
    (value) => expect(() => assess(after, before, mappings, value)).toThrow(RangeError)
  );
  it.each([0, 1, 1.5, 10_001, Number.NaN])('rejects invalid prompt minimum %s', (minimum) =>
    expect(() => assess(after, before, mappings, 0.1, minimum)).toThrow(RangeError)
  );
});
