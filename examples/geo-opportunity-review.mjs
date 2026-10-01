#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
  console.error(message);
  process.exit(2);
}

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const inputPath = args.shift();
let outputPath;
let auditPath;
while (args.length) {
  const arg = args.shift();
  if (arg === '--audit' && args.length) auditPath = args.shift();
  else if (!arg.startsWith('--') && !outputPath) outputPath = arg;
  else fail(`Unknown or incomplete argument: ${arg}`);
}
if (!inputPath) {
  fail(
    'Usage: node examples/geo-opportunity-review.mjs <geo-summary.json> [output.md] [--audit <batch-report.json>]'
  );
}

let summary;
try {
  summary = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (error) {
  fail(`Cannot read GEO summary JSON: ${error.message}`);
}

let audit;
if (auditPath) {
  try {
    audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  } catch (error) {
    fail(`Cannot read optional batch report JSON: ${error.message}`);
  }
  if (!Array.isArray(audit.results)) fail('Optional batch report must contain a results array.');
}

if (
  summary?.schemaVersion !== 1 ||
  !Number.isInteger(summary.pagesAnalyzed) ||
  summary.pagesAnalyzed < 1
) {
  fail('Input must be a version 1 sitewide GEO summary with at least one analyzed page.');
}

const profiles = summary.contentProfile;
if (
  !profiles ||
  !Number.isInteger(profiles.pagesAssessed) ||
  profiles.pagesAssessed < 0 ||
  profiles.pagesAssessed > summary.pagesAnalyzed
) {
  fail('Input GEO summary is missing valid contentProfile coverage counts.');
}
if (
  !Number.isInteger(profiles.authorSignalCrossTab?.sampledPages) ||
  profiles.authorSignalCrossTab.sampledPages < 0 ||
  profiles.authorSignalCrossTab.sampledPages > summary.pagesAnalyzed ||
  !Number.isInteger(profiles.dateSignalCrossTab?.sampledPages) ||
  profiles.dateSignalCrossTab.sampledPages < 0 ||
  profiles.dateSignalCrossTab.sampledPages > summary.pagesAnalyzed
) {
  fail('Input GEO summary is missing valid authorship/date coverage counts.');
}

const hostname = summary.pageSummaries?.[0]?.url
  ? new URL(summary.pageSummaries[0].url).hostname
  : 'audited site';
const coverage = profiles.sourceRenderedPhraseCoverageMeanPercent;
const coverageSamples =
  profiles.sourceRenderedPhraseCoverageSamples ?? profiles.sourceRenderedProfilesAssessed ?? 0;
const lowCoveragePages = (profiles.sourceRenderedPhraseCoverageBands ?? [])
  .filter((band) => band.band === '0-19.9%' || band.band === '20-39.9%' || band.band === '40-59.9%')
  .reduce((total, band) => total + band.pages, 0);
const author = profiles.authorSignalCrossTab;
const date = profiles.dateSignalCrossTab;
const pagesWithCompleteAuthorSignals = author?.visibleAndSchema ?? 0;
const pagesWithCompleteDateSignals = date?.visibleAndSchema ?? 0;
const optionalLlmsAbsent =
  (summary.optionalLlmsFiles ?? []).length > 0 &&
  summary.optionalLlmsFiles.every(
    (file) => file.pagesFound === 0 && file.pagesAbsent === summary.pagesAnalyzed
  );
const noAnswerStructure =
  profiles.pagesAssessed > 0 &&
  profiles.pagesWithQuestionHeadings === 0 &&
  profiles.totalConciseAnswerBlocks === 0;

const opportunities = [];
const pageReports = (audit?.results ?? []).flatMap(({ url, report }) => {
  const checks = report?.checks?.geo;
  if (!Array.isArray(checks)) return [];
  const detail = (name) => checks.find((item) => item.name === name)?.details;
  return [
    {
      url,
      answer: detail('answer-content-profile'),
      sourceRendered: detail('source-rendered-content-profile'),
    },
  ];
});
const formatPages = (pages) =>
  pages.length
    ? pages
        .slice(0, 10)
        .map((item) => `<${item.url}>`)
        .join(', ') + (pages.length > 10 ? `, and ${pages.length - 10} more` : '')
    : '';
if (Number.isFinite(coverage) && lowCoveragePages > 0) {
  const lowCoverageUrls = pageReports.flatMap(({ url, sourceRendered }) => {
    return Number.isFinite(sourceRendered?.renderedPhraseCoveragePercent) &&
      sourceRendered.renderedPhraseCoveragePercent < 60
      ? [
          {
            url,
            coverage: sourceRendered.renderedPhraseCoveragePercent,
            sourceWords: sourceRendered.sourceWordCount,
            renderedWords: sourceRendered.renderedWordCount,
          },
        ]
      : [];
  });
  opportunities.push({
    title: 'Review source and rendered content agreement',
    evidence: `Mean phrase coverage was ${coverage.toFixed(1)}%; ${lowCoveragePages} of ${coverageSamples} measured pages were below 60%.`,
    action: lowCoverageUrls.length
      ? `The optional batch report identified ${lowCoverageUrls.map((item) => `<${item.url}> (${item.coverage.toFixed(1)}%; ${item.sourceWords ?? 'n/a'} initial-HTML words, ${item.renderedWords ?? 'n/a'} rendered words)`).join(', ')}. Inspect these pages. If substantive text is inserted client-side, consider server rendering or prerendering it.`
      : 'Inspect the per-page audit reports to identify affected URLs. If substantive text is inserted client-side, consider server rendering or prerendering it.',
    caveat: 'A discrepancy does not prove that a particular crawler misses the content.',
  });
}
if (
  (author.sampledPages > 0 && pagesWithCompleteAuthorSignals < author.sampledPages) ||
  (date.sampledPages > 0 && pagesWithCompleteDateSignals < date.sampledPages)
) {
  const authorEvidence =
    author.sampledPages > 0
      ? `Visible and structured author signals were both present on ${pagesWithCompleteAuthorSignals}/${author.sampledPages} assessed pages`
      : 'No authorship profiles were assessed';
  const dateEvidence =
    date.sampledPages > 0
      ? `visible and structured date signals were both present on ${pagesWithCompleteDateSignals}/${date.sampledPages} assessed pages`
      : 'no date profiles were assessed';
  const missingEditorialSignals = pageReports.filter(
    ({ answer }) =>
      answer &&
      (!answer.visibleAuthor || !answer.schemaAuthor || !answer.visibleDate || !answer.schemaDate)
  );
  opportunities.push({
    title: 'Review authorship and freshness signals on maintained docs',
    evidence: `${authorEvidence}; ${dateEvidence}.`,
    action: `For pages with maintained technical guidance, identify a responsible author/team and meaningful review date, and reflect those signals in suitable structured data.${missingEditorialSignals.length ? ` The optional batch report flags ${formatPages(missingEditorialSignals)} for review.` : ''}`,
    caveat: 'Skip pages where authorship or a date would be artificial.',
  });
}
if (optionalLlmsAbsent) {
  opportunities.push({
    title: 'Decide whether to publish optional LLM documentation indexes',
    evidence:
      (summary.optionalLlmsFiles ?? [])
        .map((file) => `${file.path}: absent on ${file.pagesAbsent} pages`)
        .join('; ') + '.',
    action: 'If useful, publish a concise, maintained index with canonical documentation links.',
    caveat:
      'Treat these files as an additional discovery aid, not a replacement for accessible HTML or crawler-policy review.',
  });
}
const missingAnswerStructure = pageReports.filter(
  ({ answer }) => answer && answer.questionHeadings === 0 && answer.conciseAnswerBlocks === 0
);
if (noAnswerStructure || missingAnswerStructure.length > 0) {
  opportunities.push({
    title: 'Review direct-answer structure on explanatory pages',
    evidence: 'No sampled page had question headings or concise answer blocks.',
    action: `Consider short, self-contained answers for genuine user questions in quickstart and troubleshooting content.${missingAnswerStructure.length ? ` The optional batch report flags ${formatPages(missingAnswerStructure)} for review.` : ''}`,
    caveat: 'Do not reshape policy or overview pages just to add question headings.',
  });
}

const dateLabel = summary.auditTimestamp
  ? new Date(summary.auditTimestamp).toISOString().slice(0, 10)
  : 'date unavailable';
const auditedPages = (audit?.results ?? [])
  .map((item) => item.report)
  .filter((report) => report && typeof report === 'object');
const navigationWaits = new Set(
  auditedPages
    .map((report) => report.navigationWaitUntil)
    .filter((value) => typeof value === 'string')
);
const navigationWaitRecords = auditedPages.filter(
  (report) => typeof report.navigationWaitUntil === 'string'
).length;
const settleDelays = new Set(
  auditedPages
    .map((report) => report.settleAfterNavigationMs)
    .filter((value) => Number.isInteger(value))
);
const settleDelayRecords = auditedPages.filter((report) =>
  Number.isInteger(report.settleAfterNavigationMs)
).length;
const describeCaptureValue = (values, recordedPages, unit = '') =>
  values.size === 0
    ? 'not recorded'
    : [...values]
        .sort((a, b) =>
          typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a).localeCompare(String(b))
        )
        .map((value) => `${value}${unit}`)
        .join(', ') + ` (${recordedPages}/${auditedPages.length} page reports)`;
const lines = [
  `# GEO opportunity review: ${hostname}`,
  '',
  `Generated from a version 1 sitewide GEO summary dated ${dateLabel}. The capture assessed ${summary.pagesAnalyzed} pages; ${summary.pagesSkipped ?? 0} pages were skipped.`,
  `Page-report timing: navigation readiness ${describeCaptureValue(navigationWaits, navigationWaitRecords)}; fixed settle delay ${describeCaptureValue(settleDelays, settleDelayRecords, ' ms')}.`,
  '',
  'This is a prioritized review queue based on measured signals. It does not predict rankings, citations, or crawler behavior.',
  '',
  '## Recommended review order',
  '',
];

if (opportunities.length === 0) {
  lines.push(
    'No follow-up from the supported signal groups was triggered by this summary. Review the underlying page reports and other GEO fields for site-specific work.'
  );
} else {
  opportunities.forEach((item, index) => {
    lines.push(`${index + 1}. **${item.title}.** ${item.evidence} ${item.action} ${item.caveat}`);
  });
}

lines.push('', '## Existing signal snapshot', '');
lines.push(
  `- Search preview restrictions: ${summary.pagesWithNoindex ?? 0} pages with \`noindex\`; ${summary.pagesWithNoSnippet ?? 0} with \`nosnippet\`.`
);
const crawlerChecks = summary.searchCrawlerCoverage ?? [];
if (crawlerChecks.length) {
  const allowed = crawlerChecks.reduce((total, item) => total + item.allowedPages, 0);
  const assessed = crawlerChecks.reduce((total, item) => total + item.assessedPages, 0);
  const blocked = crawlerChecks.reduce((total, item) => total + item.blockedPages, 0);
  lines.push(
    `- Search-crawler access: ${allowed}/${assessed} assessed page/token checks allowed; ${blocked} blocked.`
  );
}
lines.push(
  `- Citation-shaped evidence: ${summary.pagesWithCitationMarkersOrReferences ?? 0} pages with citation markers/references; ${summary.totalUnresolvedInlineCitationTargets ?? 0} unresolved inline targets.`
);
lines.push(
  `- External source links: ${summary.totalExternalSourceLinks ?? 0} across ${summary.pagesWithExternalSources ?? 0} pages.`
);
const keySchemaTypes = ['Organization', 'SoftwareApplication', 'WebSite'];
const schemaTypes = new Map(
  (profiles.schemaTypeCoverage ?? []).map((item) => [item.type, item.pages])
);
if (keySchemaTypes.some((type) => schemaTypes.has(type))) {
  lines.push(
    `- Structured-type coverage: ${keySchemaTypes
      .filter((type) => schemaTypes.has(type))
      .map((type) => `${type} ${schemaTypes.get(type)}/${summary.pagesAnalyzed}`)
      .join(', ')}.`
  );
}
if (summary.entityAnalysis?.pagesWithSameAsReferences !== undefined) {
  lines.push(
    `- Pages with entity \`sameAs\` references: ${summary.entityAnalysis.pagesWithSameAsReferences}/${summary.pagesAnalyzed}.`
  );
}
lines.push(
  '',
  '## Limits',
  '',
  'A sitewide summary describes only its captured URLs, time, browser state, and configured scope. Re-audit the same scope after changes and inspect the individual pages before drawing sitewide conclusions.',
  ''
);

const markdown = lines.join('\n');
if (outputPath) {
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, markdown);
} else {
  process.stdout.write(markdown);
}
