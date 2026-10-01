import { describe, expect, it } from 'vitest';
import { analyzeAiAnswerCitationObservations } from '../../src/geo/answerCitationObservations';
import {
  renderAiAnswerCitationRankWeightedSourceNetworkComparisonCsv,
  renderAiAnswerCitationRankWeightedSourceNetworkCsv,
} from '../../src/geo/answerCitationRankWeightedSourceNetwork';
import { renderAiAnswerCitationSourceNetworkHtml } from '../../src/geo/answerCitationSourceNetworkReporter';
import {
  renderAiAnswerCitationSourceNetworkComparisonCsv,
  renderAiAnswerCitationSourceNetworkCsv,
} from '../../src/geo/answerCitationSourceNetwork';
import {
  detectSourceNetworkCommunities,
  sourceCommunityAdjustedRandIndex,
} from '../../src/geo/sourceNetworkCommunityDetection';

describe('AI answer citation source communities', () => {
  it('builds provider co-citation networks and escapes provider labels in the offline dashboard', () => {
    const report = analyzeAiAnswerCitationObservations(
      {
        schemaVersion: 1,
        observations: [
          {
            observedAt: '2026-09-30T10:00:00Z',
            provider: '<Publisher & AI>',
            prompt: 'best indoor cat food',
            citedUrls: ['https://owned.example/food', 'https://review.example/best'],
            citationListComplete: true,
          },
          {
            observedAt: '2026-09-30T10:05:00Z',
            provider: '<Publisher & AI>',
            prompt: 'healthy food for indoor cats',
            citedUrls: ['https://owned.example/guide', 'https://review.example/cats'],
            citationListComplete: true,
          },
        ],
      },
      ['owned.example'],
      '2026-10-01T00:00:00Z'
    );

    const csv = renderAiAnswerCitationSourceNetworkCsv(report);
    expect(csv).toMatch(/^"row_type","provider","domain"/u);
    expect(csv).toContain('source-network-provider-summary');
    expect(csv).toContain('source-node');
    expect(csv).toContain('community-0001');
    expect(csv).toContain('owned.example');

    const html = renderAiAnswerCitationSourceNetworkHtml(report);
    expect(html).toContain('Aviary · Citation source network');
    const embeddedData = html.match(
      /<script type="application\/json" id="network-data">([^<]+)<\/script>/u
    )?.[1];
    expect(embeddedData).toBeDefined();
    expect(html).not.toContain('<Publisher & AI>');
    const dashboard = JSON.parse(embeddedData!);
    expect(dashboard.eventGraphs[0]).toMatchObject({
      provider: '<Publisher & AI>',
      nodes: [{ domain: 'owned.example' }, { domain: 'review.example' }],
    });
    expect(dashboard.rankGraphs[0].provider).toBe('<Publisher & AI>');

    for (const output of [
      renderAiAnswerCitationRankWeightedSourceNetworkCsv(report),
      renderAiAnswerCitationSourceNetworkComparisonCsv(report, report),
      renderAiAnswerCitationRankWeightedSourceNetworkComparisonCsv(report, report),
    ]) {
      expect(output).toMatch(/^"row_type","provider"/u);
    }
  });

  it('compares partitions independent of label spelling and returns null for incomparable input', () => {
    expect(sourceCommunityAdjustedRandIndex(['a', 'a', 'b', 'b'], ['x', 'x', 'y', 'y'])).toBe(1);
    expect(
      sourceCommunityAdjustedRandIndex(['a', 'a', 'b', 'b'], ['x', 'y', 'x', 'y'])
    ).toBeCloseTo(-0.5);
    expect(sourceCommunityAdjustedRandIndex(['a', 'a', 'a'], ['x', 'y', 'z'])).toBe(0);
    expect(sourceCommunityAdjustedRandIndex(['a'], ['x'])).toBeNull();
    expect(sourceCommunityAdjustedRandIndex(['a', 'b'], ['x'])).toBeNull();
  });

  it('groups disconnected co-citation pairs deterministically and reports weighted metrics', () => {
    const result = detectSourceNetworkCommunities(
      ['b.example', 'd.example', 'a.example', 'c.example', 'isolated.example'],
      [
        { left: 'a.example', right: 'b.example', weight: 3 },
        { left: 'c.example', right: 'd.example', weight: 2 },
        { left: 'a.example', right: 'missing.example', weight: 100 },
        { left: 'a.example', right: 'a.example', weight: 100 },
        { left: 'a.example', right: 'c.example', weight: -1 },
        { left: 'b.example', right: 'd.example', weight: Number.POSITIVE_INFINITY },
      ]
    );

    expect(result.algorithm).toBe('deterministic-weighted-label-propagation');
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.byDomain.get('a.example')?.communityId).toBe(
      result.byDomain.get('b.example')?.communityId
    );
    expect(result.byDomain.get('c.example')?.communityId).toBe(
      result.byDomain.get('d.example')?.communityId
    );
    expect(result.byDomain.get('a.example')?.communityId).not.toBe(
      result.byDomain.get('c.example')?.communityId
    );
    expect(result.byDomain.get('a.example')).toMatchObject({
      communitySize: 2,
      communityInternalEdgeCount: 1,
      communityInternalCooccurrenceWeight: 3,
      communityExternalCooccurrenceWeight: 0,
      communityInternalCooccurrenceShare: 1,
      networkWeightedModularity: 0.48,
    });
    expect(result.byDomain.get('isolated.example')).toMatchObject({
      communitySize: 1,
      communityInternalEdgeCount: 0,
      communityInternalCooccurrenceShare: null,
    });
    expect(result.weightedModularity).toBeCloseTo(0.48);
    expect(result.neighborVisits).toBeGreaterThan(0);

    const reordered = detectSourceNetworkCommunities(
      ['isolated.example', 'c.example', 'a.example', 'd.example', 'b.example'],
      [
        { left: 'b.example', right: 'a.example', weight: 3 },
        { left: 'd.example', right: 'c.example', weight: 2 },
      ]
    );
    expect(result.byDomain.get('a.example')?.communityId).toBe(
      reordered.byDomain.get('a.example')?.communityId
    );
    expect(result.byDomain.get('c.example')?.communityId).toBe(
      reordered.byDomain.get('c.example')?.communityId
    );
  });

  it('returns defined singleton communities when no valid co-citation edge exists', () => {
    const result = detectSourceNetworkCommunities(
      ['a.example', 'b.example'],
      [{ left: 'a.example', right: 'b.example', weight: 0 }]
    );

    expect(result).toMatchObject({
      converged: true,
      iterations: 1,
      neighborVisits: 0,
      weightedModularity: null,
    });
    expect(result.byDomain.get('a.example')).toMatchObject({
      communitySize: 1,
      communityInternalCooccurrenceShare: null,
      communityModularityContribution: null,
      networkWeightedModularity: null,
    });
  });
});
