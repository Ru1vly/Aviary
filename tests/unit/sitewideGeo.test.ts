import { describe, expect, it } from 'vitest';
import { analyzeSiteWideGeo, renderSiteWideGeoCsv } from '../../src/sitewide';
import type { SEOAuditBatchReport, SEOReport } from '../../src/types';

function batchWithGeoChecks(url: string, geo: SEOReport['checks']['geo']): SEOAuditBatchReport {
  const checks = {
    metaTags: [],
    headings: [],
    images: [],
    performance: [],
    robotsTxt: [],
    sitemap: [],
    security: [],
    structuredData: [],
    socialMedia: [],
    content: [],
    links: [],
    uiElements: [],
    technical: [],
    accessibility: [],
    urlFactors: [],
    spamDetection: [],
    pageQuality: [],
    advancedImages: [],
    multimedia: [],
    coreWebVitals: [],
    analytics: [],
    mobileUX: [],
    schemaValidation: [],
    resourceOptimization: [],
    legalCompliance: [],
    ecommerce: [],
    internationalization: [],
    heatmap: [],
    geo,
  } satisfies SEOReport['checks'];
  const report: SEOReport = {
    url,
    timestamp: '2026-10-01T00:00:00.000Z',
    checks,
    score: 100,
    summary: { total: geo.length, passed: geo.length, failed: 0 },
  };
  return {
    timestamp: '2026-10-01T00:00:00.000Z',
    summary: {
      requestedUrls: 1,
      completedUrls: 1,
      failedUrls: 0,
      passedChecks: geo.length,
      failedChecks: 0,
      averageScore: 100,
    },
    results: [{ status: 'complete', url, report }],
  };
}

describe('analyzeSiteWideGeo', () => {
  it('deduplicates normalized URLs and preserves measured versus not-run signal coverage', () => {
    const report = batchWithGeoChecks('https://example.com/page#section', []);
    const existing = report.results[0];
    if (existing?.status === 'complete') {
      report.results.push({ ...existing, url: 'https://example.com/page' });
    }
    report.results.push({
      status: 'error',
      url: 'https://example.com/failed',
      error: 'unavailable',
    });

    const summary = analyzeSiteWideGeo(report);

    expect(summary).toMatchObject({
      schemaVersion: 1,
      auditTimestamp: '2026-10-01T00:00:00.000Z',
      pagesAnalyzed: 1,
      pagesWithGeoData: 0,
      pagesSkipped: 1,
    });
    expect(summary.pageSummaries[0]).toMatchObject({
      url: 'https://example.com/page#section',
      geoAssessed: false,
      signalCoverage: {
        searchCrawlerAccess: 'not-run',
        dataUseCrawlerPolicy: 'not-run',
        previewControls: 'not-run',
        answerContent: 'not-run',
        sourceRenderedContent: 'not-run',
        citationEvidence: 'not-run',
        optionalLlmsFiles: 'not-run',
      },
    });
  });

  it('normalizes crawler access and measured content into bounded page profiles', () => {
    const report = batchWithGeoChecks('https://example.com/article', [
      {
        name: 'ai-search-crawler-access',
        passed: true,
        message: 'Search crawler access measured.',
        details: {
          crawlers: [
            {
              token: 'OAI-SearchBot',
              allowed: true,
              matchedAgents: ['*'],
              matchedRule: { directive: 'allow', pattern: '/', line: 2 },
            },
            { token: 'Invalid', allowed: 'yes' },
          ],
        },
      },
      {
        name: 'ai-search-preview-controls',
        passed: true,
        message: 'Preview controls measured.',
        details: { noindex: false, noSnippet: true, maxSnippetZero: false },
      },
      {
        name: 'answer-content-profile',
        passed: true,
        message: 'Answer content measured.',
        details: {
          contentWords: 140,
          questionHeadings: 2,
          conciseAnswerBlocks: 1,
          visibleAuthor: true,
          visibleDate: true,
          schemaDateModifiedDays: ['2026-09-30'],
          schemaIsAccessibleForFree: false,
          identityEntities: [
            { id: 'https://example.com/#org', name: 'Example', types: ['Organization'] },
          ],
          documentLanguage: ' en ',
          documentLanguageValid: true,
        },
      },
      {
        name: 'citation-evidence-profile',
        passed: true,
        message: 'Citation evidence measured.',
        details: {
          externalSourceLinkCount: 3,
          sourceHosts: ['docs.example.net'],
          inlineCitationMarkerCount: 1,
          unresolvedInlineCitationTargetCount: 0,
        },
      },
      {
        name: 'source-rendered-content-profile',
        passed: true,
        message: 'Rendered content measured.',
        details: {
          assessed: true,
          textExtraction: 'shared DOM boundaries',
          renderedPhraseCoveragePercent: 65,
          sourceWordCount: 200,
          renderedWordCount: 180,
          sourcePhraseCount: 10,
          renderedPhraseCount: 9,
          sharedRenderedPhraseCount: 7,
          renderedOnlyPhraseCount: 2,
        },
      },
      {
        name: 'llms-txt-convention-inventory',
        passed: true,
        message: 'Optional AI files inventoried.',
        details: {
          resources: [
            {
              path: '/llms.txt',
              found: true,
              status: 200,
              linkTargetProfile: {
                markdownLinks: 4,
                uniqueWebTargets: 3,
                duplicateWebTargets: 1,
                sameOriginWebLinks: 2,
                externalHttpsLinks: 1,
                externalHttpLinks: 0,
                relativeLinks: 1,
                unsupportedSchemeLinks: 0,
                invalidTargets: 0,
                emptyLabels: 0,
                malformedLinkCandidates: 0,
              },
            },
            { path: '/llms-full.txt', status: 404 },
          ],
        },
      },
    ]);

    const summary = analyzeSiteWideGeo(report);

    expect(summary.pageSummaries[0]).toMatchObject({
      geoAssessed: true,
      searchCrawlerAccess: [
        {
          token: 'OAI-SearchBot',
          allowed: true,
          matchedAgents: ['*'],
          matchedRule: { directive: 'allow', pattern: '/', line: 2 },
        },
      ],
      signalCoverage: {
        searchCrawlerAccess: 'measured',
        previewControls: 'measured',
        answerContent: 'measured',
        sourceRenderedContent: 'measured',
        citationEvidence: 'measured',
        dataUseCrawlerPolicy: 'not-run',
      },
      previewControls: { noindex: false, noSnippet: true, maxSnippetZero: false },
      answerContent: {
        contentWords: 140,
        questionHeadings: 2,
        conciseAnswerBlocks: 1,
        schemaIsAccessibleForFree: false,
        documentLanguage: 'en',
        documentLanguageValid: true,
      },
      citationEvidence: {
        externalSourceLinkCount: 3,
        sourceHosts: ['docs.example.net'],
        inlineCitationMarkerCount: 1,
      },
      sourceRenderedContent: {
        assessed: true,
        textExtraction: 'shared DOM boundaries',
        renderedPhraseCoveragePercent: 65,
        sourcePhraseCount: 10,
        sharedRenderedPhraseCount: 7,
      },
      optionalLlmsFiles: [
        { path: '/llms.txt', state: 'found', status: 200 },
        { path: '/llms-full.txt', state: 'absent', status: 404 },
      ],
    });
    expect(summary.searchCrawlerCoverage).toMatchObject([
      {
        token: 'OAI-SearchBot',
        assessedPages: 1,
        allowedPages: 1,
        blockedPages: 0,
      },
    ]);
    expect(summary.contentProfile).toMatchObject({
      pagesAssessed: 1,
      pagesWithVisibleAuthor: 1,
      pagesWithVisibleDate: 1,
      pagesWithQuestionHeadings: 1,
      totalQuestionHeadings: 2,
      pagesWithPaywalledSchemaDeclaration: 1,
      sourceRenderedProfilesAssessed: 1,
      sourceRenderedPhraseCoverageMeanPercent: 65,
      sourceRenderedPhraseCoverageBands: [
        { band: '0-19.9%', pages: 0 },
        { band: '20-39.9%', pages: 0 },
        { band: '40-59.9%', pages: 0 },
        { band: '60-79.9%', pages: 1 },
        { band: '80-100%', pages: 0 },
      ],
    });
    expect(summary.optionalLlmsFiles).toMatchObject([
      { path: '/llms-full.txt', pagesAbsent: 1 },
      {
        path: '/llms.txt',
        pagesFound: 1,
        linkTargetTotals: { profilesMeasured: 1, markdownLinks: 4, duplicateWebTargets: 1 },
      },
    ]);
  });

  it('reports shared structured entity IDs with name, type, and complete sameAs variants', () => {
    const pageOne = batchWithGeoChecks('https://example.com/about', [
      {
        name: 'answer-content-profile',
        passed: true,
        message: 'Entity observed.',
        details: {
          contentWords: 100,
          identityEntities: [
            {
              id: 'https://example.com/#organization',
              name: 'Example',
              types: ['Organization'],
              sameAs: ['https://social.example.net/example'],
              sameAsTruncated: false,
            },
          ],
        },
      },
    ]);
    const pageTwo = batchWithGeoChecks('https://example.com/contact', [
      {
        name: 'answer-content-profile',
        passed: true,
        message: 'Entity observed.',
        details: {
          contentWords: 100,
          identityEntities: [
            {
              id: 'https://example.com/#organization',
              name: 'Example Inc.',
              types: ['LocalBusiness'],
              sameAs: ['https://www.linkedin.com/company/example'],
              sameAsTruncated: false,
            },
          ],
        },
      },
    ]);
    const secondResult = pageTwo.results[0];
    if (secondResult?.status === 'complete') pageOne.results.push(secondResult);

    const summary = analyzeSiteWideGeo(pageOne);

    expect(summary.entityAnalysis).toMatchObject({
      pagesWithIdentityEntities: 2,
      pagesWithSameAsReferences: 2,
      totalSameAsReferences: 2,
      sameAsHostCoverage: [
        { host: 'social.example.net', pages: 1 },
        { host: 'www.linkedin.com', pages: 1 },
      ],
      uniqueIdentityIds: 1,
      identityIdsSharedAcrossPages: 1,
      entitiesWithNameVariants: 1,
      nameVariants: [
        {
          id: 'https://example.com/#organization',
          types: ['LocalBusiness', 'Organization'],
          names: ['Example', 'Example Inc.'],
          pages: ['https://example.com/about', 'https://example.com/contact'],
        },
      ],
      entitiesWithTypeVariants: 1,
      typeVariants: [
        {
          id: 'https://example.com/#organization',
          pages: [
            { url: 'https://example.com/about', types: ['organization'] },
            { url: 'https://example.com/contact', types: ['localbusiness'] },
          ],
          pagesTruncated: false,
        },
      ],
      entitiesWithSameAsVariants: 1,
      sameAsVariants: [
        {
          id: 'https://example.com/#organization',
          pagesTruncated: false,
          excludedIncompletePages: 0,
        },
      ],
    });
  });

  it('exports signal coverage and neutralizes spreadsheet formulas in GEO CSV cells', () => {
    const batch = batchWithGeoChecks('https://example.com/article', [
      {
        name: 'citation-evidence-profile',
        passed: true,
        message: 'Citation sources measured.',
        details: {
          externalSourceLinkCount: 1,
          sourceHosts: ['=2+3'],
          sourceHostLinkCounts: [{ host: '=2+3', links: 2 }],
        },
      },
    ]);

    const csv = renderSiteWideGeoCsv(analyzeSiteWideGeo(batch));
    const [header, row] = csv.trimEnd().split('\n');

    expect(header).toContain('citation_evidence_status');
    expect(header).toContain('citation_source_hosts');
    expect(row).toContain('measured');
    expect(row).toContain("'=2+3");
    expect(row).not.toContain(',=2+3,');
  });
});
