import type { SEOAuditBatchReport, SEOReport } from '../types';
import type { SiteWideGeoAnalysis } from '../sitewide';

export type BingAiPerformanceDatasetKind =
  | 'page-citations'
  | 'grounding-queries'
  | 'query-page-mapping'
  | 'time-series'
  | 'topic-summary'
  | 'intent-summary'
  | 'topic-intent-summary'
  | 'overview';

export interface BingAiPerformanceRow {
  url?: string;
  query?: string;
  date?: string;
  citations?: number;
  citedPages?: number;
  citationShare?: number;
  intent?: string;
  topic?: string;
}

export interface BingAiPerformanceExport {
  sourceFile?: string;
  datasetKind: BingAiPerformanceDatasetKind;
  headerRow: number;
  rowCount: number;
  skippedRows: number;
  uniquePageCount: number;
  uniqueQueryCount: number;
  columns: Partial<Record<keyof BingAiPerformanceRow, string>>;
  rows: BingAiPerformanceRow[];
}

export interface BingAiPerformanceCsvOptions {
  /** Override a detected column with its exact source header, useful for localized exports. */
  columns?: Partial<Record<keyof BingAiPerformanceRow, string>>;
  sourceFile?: string;
  maxBytes?: number;
  maxRows?: number;
}

export interface BingAiPerformanceDimensionSummary {
  value: string;
  rows: number;
  citations?: number;
  citedPages?: number;
  averageCitationShare?: number;
}

export interface BingAiPerformanceTimeSeriesPoint {
  period: string;
  rows: number;
  citations?: number;
  citedPages?: number;
  averageCitationShare?: number;
}

export interface BingAiPerformanceSummary {
  sourceFile?: string;
  datasetKind: BingAiPerformanceDatasetKind;
  rowCount: number;
  uniquePageCount: number;
  uniqueQueryCount: number;
  totalCitations?: number;
  totalCitedPages?: number;
  averageCitationShare?: number;
  topPages: BingAiPerformanceDimensionSummary[];
  topQueries: BingAiPerformanceDimensionSummary[];
  topTopics: BingAiPerformanceDimensionSummary[];
  topIntents: BingAiPerformanceDimensionSummary[];
  timeSeries: BingAiPerformanceTimeSeriesPoint[];
  firstToLastCitationChange?: {
    firstPeriod: string;
    lastPeriod: string;
    absoluteChange: number;
    percentChange?: number;
  };
  note: string;
}

export interface BingAiPageCitationChange {
  url: string;
  baselineCitations?: number;
  currentCitations?: number;
  citationChange?: number;
  percentChange?: number;
  baselineAverageCitationShare?: number;
  currentAverageCitationShare?: number;
  citationShareChangePercentagePoints?: number;
  state:
    | 'current-only'
    | 'baseline-only'
    | 'increased'
    | 'decreased'
    | 'unchanged'
    | 'metric-unavailable';
}

export interface BingAiPageCitationComparison {
  baselineSourceFile?: string;
  currentSourceFile?: string;
  baselinePagesInExport: number;
  currentPagesInExport: number;
  pagesCompared: number;
  pagesOnlyInCurrentExport: number;
  pagesOnlyInBaselineExport: number;
  pagesWithUnavailableCitationMetric: number;
  pagesWithCitationShareComparison: number;
  baselineCitationsInExport: number;
  currentCitationsInExport: number;
  matchedBaselineCitations: number;
  matchedCurrentCitations: number;
  matchedPageCitationChange: number;
  matchedPagePercentChange?: number;
  meanBaselinePageCitationShare?: number;
  meanCurrentPageCitationShare?: number;
  meanPageCitationShareChangePercentagePoints?: number;
  pagesWithIncreasedCitations: number;
  pagesWithDecreasedCitations: number;
  unchangedPages: number;
  topGains: BingAiPageCitationChange[];
  topLosses: BingAiPageCitationChange[];
  topCitationShareIncreases: BingAiPageCitationChange[];
  topCitationShareDecreases: BingAiPageCitationChange[];
  changes: BingAiPageCitationChange[];
  changesTruncated: boolean;
  note: string;
}

/** Citation distribution across the exact mapped URLs for one exported query phrase. */
export interface BingAiQueryCitationDistribution {
  pagesWithCitationMetric: number;
  pagesWithoutCitationMetric: number;
  citationsAcrossMeasuredPages: number;
  largestPageCitationSharePercent?: number;
  herfindahlIndex?: number;
  effectiveCitationPages?: number;
  note: string;
}

export interface BingAiQueryCitationDistributionSummary {
  queriesWithMeasuredDistribution: number;
  queriesWithPartialPageMetricCoverage: number;
  medianLargestPageCitationSharePercent?: number;
  medianEffectiveCitationPages?: number;
  note: string;
}

export interface BingAiQueryPageGroup {
  query: string;
  rows: number;
  pageCount: number;
  citations?: number;
  citedPages?: number;
  topics: string[];
  topicsTruncated: boolean;
  intents: string[];
  intentsTruncated: boolean;
  citationDistribution?: BingAiQueryCitationDistribution;
  pages: Array<{
    url: string;
    rows: number;
    citations?: number;
    citedPages?: number;
    currentAudit?: BingAiQueryPageAuditSignals;
  }>;
  pagesTruncated: boolean;
  auditReview?: BingAiQueryAuditReview;
}

export interface BingAiQueryPageAuditSignals {
  auditMatchType: BingAiCitedPageAuditRow['auditMatchType'];
  auditMatched: boolean;
  matchedAuditUrl?: string;
  bingbotAccess: 'allowed' | 'blocked' | 'not-assessed';
  globalNoindex?: boolean;
  globalNoSnippet?: boolean;
  bingbotNoindex?: boolean;
  bingbotNoSnippet?: boolean;
  bingbotMaxSnippetZero?: boolean;
  questionHeadings?: number;
  conciseAnswerBlocks?: number;
  externalSourceLinks?: number;
  documentLanguage?: string;
  documentLanguageValid?: boolean;
}

export interface BingAiQueryAuditLanguageGroup {
  language: string;
  pages: number;
}

export interface BingAiQueryAuditReview {
  mappedPages: number;
  pagesMatchedToAudit: number;
  pagesNotMatchedToAudit: number;
  pagesWithoutAuditCorrelation: number;
  pagesWithAmbiguousAuditUrlMatch: number;
  pagesWithAmbiguousCanonicalMatch: number;
  bingbotAccessAssessedPages: number;
  currentBingbotBlockedPages: number;
  pagesWithGlobalNoindex: number;
  pagesWithGlobalNoSnippet: number;
  pagesWithBingbotNoindex: number;
  pagesWithBingbotSnippetRestriction: number;
  pagesWithQuestionHeadings: number;
  pagesWithConciseAnswerBlocks: number;
  pagesWithExternalSourceLinks: number;
  languageProfilesAssessedPages: number;
  assessedPagesWithoutLanguageTag: number;
  pagesWithValidDeclaredLanguageTag: number;
  pagesWithInvalidDeclaredLanguageTag: number;
  pagesWithDeclaredLanguageTagNotValidated: number;
  declaredLanguages: BingAiQueryAuditLanguageGroup[];
  languagesTruncated: boolean;
}

export interface BingAiQueryPagePage {
  url: string;
  rows: number;
  queryCount: number;
  citations?: number;
  citedPages?: number;
  queries: string[];
  queriesTruncated: boolean;
}

export interface BingAiQueryPageMappingAnalysis {
  sourceFile?: string;
  mappingRows: number;
  queryCount: number;
  pageCount: number;
  queriesMappedToMultiplePages: number;
  queriesWithoutMappedPages: number;
  pagesMappedFromMultipleQueries: number;
  queryRowsWithoutUsableUrl: number;
  citationDistributionSummary?: BingAiQueryCitationDistributionSummary;
  queryGroups: BingAiQueryPageGroup[];
  queryGroupsTruncated: boolean;
  pages: BingAiQueryPagePage[];
  pagesTruncated: boolean;
  note: string;
}

export interface BingAiQueryPageMappingChange {
  url: string;
  state: 'current-only' | 'baseline-only' | 'present-both' | 'metric-unavailable';
  baselineCitations?: number;
  currentCitations?: number;
  citationChange?: number;
}

export interface BingAiQueryMappingChangeGroup {
  query: string;
  state: 'current-only' | 'baseline-only' | 'present-both';
  baselinePageCount: number;
  currentPageCount: number;
  pagesOnlyInCurrentExport: number;
  pagesOnlyInBaselineExport: number;
  mappedPagePairCount: number;
  pagesCompared: number;
  pagesWithUnavailableCitationMetric: number;
  matchedBaselineCitations: number;
  matchedCurrentCitations: number;
  matchedCitationChange?: number;
  pages: BingAiQueryPageMappingChange[];
  pagesTruncated: boolean;
}

export interface BingAiQueryPageMappingComparison {
  baselineSourceFile?: string;
  currentSourceFile?: string;
  baselineQueryCount: number;
  currentQueryCount: number;
  queriesPresentInBoth: number;
  queriesOnlyInCurrentExport: number;
  queriesOnlyInBaselineExport: number;
  pageMappingsCompared: number;
  pageMappingsOnlyInCurrentExport: number;
  pageMappingsOnlyInBaselineExport: number;
  pageMappingsWithUnavailableCitationMetric: number;
  matchedBaselineCitations: number;
  matchedCurrentCitations: number;
  matchedCitationChange: number;
  queryGroups: BingAiQueryMappingChangeGroup[];
  queryGroupsTruncated: boolean;
  note: string;
}

export interface BingAiTopicIntentCohortChange {
  topic: string;
  intent: string;
  baselineRows: number;
  currentRows: number;
  baselineRowsWithCitationMetric: number;
  currentRowsWithCitationMetric: number;
  baselineQueries: number;
  currentQueries: number;
  queriesPresentInBoth: number;
  queriesOnlyInCurrentExport: number;
  queriesOnlyInBaselineExport: number;
  baselineRowSummedCitations?: number;
  currentRowSummedCitations?: number;
  rowSummedCitationChange?: number;
  baselineCitationSharePercent?: number;
  currentCitationSharePercent?: number;
  citationShareChangePercentagePoints?: number;
  currentOnlyQuerySamples: string[];
  baselineOnlyQuerySamples: string[];
}

export interface BingAiTopicIntentComparison {
  baselineSourceFile?: string;
  currentSourceFile?: string;
  baselineRows: number;
  currentRows: number;
  baselineRowsWithBothDimensions: number;
  currentRowsWithBothDimensions: number;
  baselineRowsWithCitationMetric: number;
  currentRowsWithCitationMetric: number;
  baselineCohortCount: number;
  currentCohortCount: number;
  cohortsPresentInBoth: number;
  cohortsOnlyInCurrentExport: number;
  cohortsOnlyInBaselineExport: number;
  cohortsComparedWithCitationMetrics: number;
  baselineTopicIntentCitationTotal?: number;
  currentTopicIntentCitationTotal?: number;
  rowSummedCitationChange?: number;
  cohorts: BingAiTopicIntentCohortChange[];
  cohortsTruncated: boolean;
  note: string;
}

export interface BingAiTopicIntentCell {
  topic: string;
  intent: string;
  rows: number;
  citations?: number;
  citedPages?: number;
  averageCitationShare?: number;
}

export interface BingAiTopicIntentAnalysis {
  sourceFile?: string;
  mappedRows: number;
  topicCount: number;
  intentCount: number;
  cellCount: number;
  rowSummedCitations?: number;
  averageCitationShare?: number;
  cells: BingAiTopicIntentCell[];
  cellsTruncated: boolean;
  note: string;
}

export interface BingAiCitedPageAuditRow {
  url: string;
  query?: string;
  citations?: number;
  citationShare?: number;
  intent?: string;
  topic?: string;
  auditMatchType:
    'exact-url' | 'canonical-url' | 'ambiguous-audit-url' | 'ambiguous-canonical' | 'unmatched';
  auditMatched: boolean;
  matchedAuditUrl?: string;
  geoAssessed: boolean;
  searchCrawlersAssessed: boolean;
  blockedSearchCrawlers: string[];
  blockedSearchCrawlerRules: Array<{
    token: string;
    matchedRule?: { directive: 'allow' | 'disallow'; pattern: string; line: number };
  }>;
  currentNoindex?: boolean;
  currentNoSnippet?: boolean;
  currentDataNoSnippetElements?: number;
  currentDataNoSnippetWords?: number;
  currentDataNoSnippetWordSharePercent?: number;
  currentBingbotNoindex?: boolean;
  currentBingbotAccessAssessed?: boolean;
  currentBingbotBlocked?: boolean;
  currentBingbotNoSnippet?: boolean;
  currentBingbotMaxSnippetZero?: boolean;
  currentQuestionHeadings?: number;
  currentConciseAnswerBlocks?: number;
  currentExternalContentLinks?: number;
  currentExternalSourceLinks?: number;
  currentReferenceSectionLinks?: number;
  currentVisibleAuthor?: boolean;
  currentVisibleDate?: boolean;
  currentDocumentLanguage?: string;
  currentDocumentLanguageValid?: boolean;
  currentDocumentLanguageAssessed?: boolean;
}

function boundedDocumentLanguage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim().slice(0, 80) || undefined;
}

export interface BingAiAuditCorrelation {
  sourceFile?: string;
  auditPagesCompared: number;
  citationRows: number;
  uniqueCitedPages: number;
  citedPagesMatchedToAudit: number;
  citedPagesMatchedByCanonical: number;
  citedPagesWithAmbiguousAuditUrlMatch: number;
  citedPagesWithAmbiguousCanonicalMatch: number;
  citedPagesNotInAudit: number;
  matchedPagesWithGeoResults: number;
  matchedPagesWithCurrentCrawlerBlocks: number;
  matchedPagesWithCurrentNoindex: number;
  matchedPagesWithCurrentNoSnippet: number;
  matchedPagesWithCurrentDataNoSnippet: number;
  matchedPagesWithCurrentBingbotNoindex: number;
  matchedPagesWithCurrentBingbotNoSnippet: number;
  matchedPagesWithCurrentBingbotMaxSnippetZero: number;
  currentControlObservations: BingAiAuditControlObservation[];
  currentContentObservations: BingAiAuditContentObservation[];
  note: string;
  rows: BingAiCitedPageAuditRow[];
}

export interface BingAiAuditControlObservation {
  control:
    'bingbot-robots-access' | 'bingbot-noindex' | 'bingbot-snippet-restriction' | 'data-nosnippet';
  state: 'present' | 'absent' | 'not-assessed';
  matchedPages: number;
  exportRows: number;
  rowsWithCitationMetric: number;
  rowSummedCitations?: number;
}

export interface BingAiAuditContentObservation {
  signal:
    | 'question-headings'
    | 'concise-answer-blocks'
    | 'external-content-links'
    | 'external-source-links'
    | 'reference-section-links'
    | 'visible-author'
    | 'visible-date';
  state: 'present' | 'absent' | 'not-assessed';
  matchedPages: number;
  exportRows: number;
  rowsWithCitationMetric: number;
  rowSummedCitations?: number;
}

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_ROWS = 100_000;

const HEADER_ALIASES: Record<keyof BingAiPerformanceRow, string[]> = {
  url: [
    'url',
    'page url',
    'cited page',
    'cited url',
    'page',
    'page address',
    'seite url',
    'pagina url',
    'url de la page',
    'sayfa',
    'sayfa url',
    'sayfa adresi',
  ],
  query: [
    'grounding query',
    'grounding queries',
    'query',
    'queries',
    'search query',
    'abfrage',
    'consulta',
    'requete d ancrage',
    'sorgu',
    'grounding sorgusu',
    'temellendirme sorgusu',
  ],
  date: ['date', 'day', 'period', 'date range', 'datum', 'fecha', 'tarih'],
  citations: [
    'citations',
    'citation',
    'citation count',
    'citation counts',
    'total citations',
    'zitate',
    'citas',
    'zitierungen',
    'alintilar',
    'atif',
    'atif sayisi',
    'alinti sayisi',
  ],
  citedPages: [
    'cited pages',
    'unique cited pages',
    'average cited pages',
    'pages cited',
    'zitierte seiten',
    'paginas citadas',
    'alintilanan sayfalar',
  ],
  citationShare: ['citation share', 'share of citations', 'citations share', 'atif payi'],
  intent: ['intent', 'query intent', 'search intent', 'arama niyeti'],
  topic: ['topic', 'query topic', 'konu'],
};

function normalizeHeader(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ı/g, 'i')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectDelimiter(source: string): string {
  const totals = new Map([
    ['\t', 0],
    [',', 0],
    [';', 0],
  ]);
  let quoted = false;
  let lines = 0;
  for (let index = 0; index < source.length && lines < 10; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') index += 1;
      else quoted = !quoted;
      continue;
    }
    if (!quoted && (character === '\n' || character === '\r')) {
      lines += 1;
      continue;
    }
    if (!quoted && totals.has(character ?? ''))
      totals.set(character ?? '', (totals.get(character ?? '') ?? 0) + 1);
  }
  return [...totals.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? ',';
}

function parseDelimitedRows(source: string, delimiter: string, maxRows: number): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? '';
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (quoted || field.length === 0) {
        quoted = !quoted;
      } else {
        field += character;
      }
      continue;
    }
    if (!quoted && character === delimiter) {
      record.push(field);
      field = '';
      continue;
    }
    if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      record.push(field);
      if (record.some((cell) => cell.trim())) records.push(record);
      if (records.length > maxRows + 21)
        throw new Error(`CSV contains more than ${maxRows.toLocaleString()} data rows.`);
      record = [];
      field = '';
      continue;
    }
    field += character;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  record.push(field);
  if (record.some((cell) => cell.trim())) records.push(record);
  if (records.length > maxRows + 21)
    throw new Error(`CSV contains more than ${maxRows.toLocaleString()} data rows.`);
  return records;
}

function detectColumns(
  headers: string[],
  overrides: BingAiPerformanceCsvOptions['columns']
): Partial<Record<keyof BingAiPerformanceRow, number>> {
  const columns: Partial<Record<keyof BingAiPerformanceRow, number>> = {};
  for (const key of Object.keys(HEADER_ALIASES) as Array<keyof BingAiPerformanceRow>) {
    const override = overrides?.[key];
    const overrideIndex = override
      ? headers.findIndex((header) => header.trim() === override.trim())
      : -1;
    const aliases = HEADER_ALIASES[key].map(normalizeHeader);
    const index =
      overrideIndex >= 0
        ? overrideIndex
        : headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
    if (index >= 0) columns[key] = index;
  }
  return columns;
}

function parseMetric(value: string | undefined): number | undefined {
  if (value === undefined || !value.trim()) return undefined;
  let normalized = value
    .trim()
    .replace(/[\s\u00a0]/g, '')
    .replace(/%$/, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (normalized.includes(',')) {
    normalized = /^\d{1,3}(?:,\d{3})+$/.test(normalized)
      ? normalized.replace(/,/g, '')
      : normalized.replace(',', '.');
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseCitationShare(value: string | undefined): number | undefined {
  if (value === undefined || !value.trim()) return undefined;
  const trimmed = value
    .trim()
    .replace(/[\s\u00a0]/g, '')
    .replace(/%$/, '');
  if (trimmed.includes(',') && !trimmed.includes('.')) {
    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  return parseMetric(trimmed);
}

/** Parse an English or localized CSV export from Bing Webmaster Tools AI Performance. */
export function parseBingAiPerformanceCsvExport(
  source: string,
  options: BingAiPerformanceCsvOptions = {}
): BingAiPerformanceExport {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
    throw new Error('maxBytes must be a positive safe integer.');
  if (Buffer.byteLength(source, 'utf8') > maxBytes)
    throw new Error(`CSV exceeds the ${maxBytes.toLocaleString()} byte limit.`);
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 1_000_000)
    throw new Error('maxRows must be an integer from 1 to 1,000,000.');

  const content = source.replace(/^\uFEFF/, '');
  const records = parseDelimitedRows(content, detectDelimiter(content), maxRows);
  if (records.length < 2)
    throw new Error('CSV must contain a header row and at least one data row.');

  let headerIndex = -1;
  let indexes: Partial<Record<keyof BingAiPerformanceRow, number>> = {};
  const searchLimit = Math.min(20, records.length - 1);
  for (let candidate = 0; candidate < searchLimit; candidate += 1) {
    const candidateIndexes = detectColumns(records[candidate] ?? [], options.columns);
    const hasDimension =
      candidateIndexes.url !== undefined ||
      candidateIndexes.query !== undefined ||
      candidateIndexes.date !== undefined ||
      candidateIndexes.topic !== undefined ||
      candidateIndexes.intent !== undefined;
    const hasMetric =
      candidateIndexes.citations !== undefined ||
      candidateIndexes.citedPages !== undefined ||
      candidateIndexes.citationShare !== undefined;
    if (hasDimension && hasMetric) {
      headerIndex = candidate;
      indexes = candidateIndexes;
      break;
    }
  }
  if (headerIndex < 0) {
    throw new Error(
      'Could not identify a Bing AI Performance CSV header. Expected a page URL, query, topic, intent, or date column plus a citation metric.'
    );
  }

  const headers = records[headerIndex] ?? [];
  const detectedColumns: Partial<Record<keyof BingAiPerformanceRow, string>> = {};
  for (const key of Object.keys(indexes) as Array<keyof BingAiPerformanceRow>) {
    const index = indexes[key];
    const name = index === undefined ? undefined : headers[index];
    if (name) detectedColumns[key] = name.trim();
  }
  const hasUrl = indexes.url !== undefined;
  const hasQuery = indexes.query !== undefined;
  const hasDate = indexes.date !== undefined;
  const hasTopic = indexes.topic !== undefined;
  const hasIntent = indexes.intent !== undefined;
  const datasetKind: BingAiPerformanceDatasetKind =
    hasUrl && hasQuery
      ? 'query-page-mapping'
      : hasUrl
        ? 'page-citations'
        : hasQuery
          ? 'grounding-queries'
          : hasDate
            ? 'time-series'
            : hasTopic && hasIntent
              ? 'topic-intent-summary'
              : hasTopic
                ? 'topic-summary'
                : hasIntent
                  ? 'intent-summary'
                  : 'overview';
  const rows: BingAiPerformanceRow[] = [];
  let skippedRows = 0;
  const cell = (record: string[], key: keyof BingAiPerformanceRow): string | undefined => {
    const index = indexes[key];
    return index === undefined ? undefined : record[index]?.trim();
  };
  for (const record of records.slice(headerIndex + 1)) {
    const row: BingAiPerformanceRow = {};
    const url = cell(record, 'url');
    const query = cell(record, 'query');
    const date = cell(record, 'date');
    const citations = parseMetric(cell(record, 'citations'));
    const citedPages = parseMetric(cell(record, 'citedPages'));
    const citationShare = parseCitationShare(cell(record, 'citationShare'));
    const intent = cell(record, 'intent');
    const topic = cell(record, 'topic');
    if (url) row.url = url;
    if (query) row.query = query;
    if (date) row.date = date;
    if (citations !== undefined) row.citations = citations;
    if (citedPages !== undefined) row.citedPages = citedPages;
    if (citationShare !== undefined) row.citationShare = citationShare;
    if (intent) row.intent = intent;
    if (topic) row.topic = topic;

    const hasDimension = Boolean(row.url || row.query || row.date || row.topic || row.intent);
    const hasMetric =
      row.citations !== undefined ||
      row.citedPages !== undefined ||
      row.citationShare !== undefined;
    if (hasDimension && hasMetric) rows.push(row);
    else skippedRows += 1;
    if (rows.length > maxRows)
      throw new Error(`CSV contains more than ${maxRows.toLocaleString()} valid data rows.`);
  }
  if (rows.length === 0)
    throw new Error(
      'CSV header was recognized, but no rows contained a page, query, or date and a valid citation metric.'
    );

  return {
    ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
    datasetKind,
    headerRow: headerIndex + 1,
    rowCount: rows.length,
    skippedRows,
    uniquePageCount: new Set(
      rows.flatMap(({ url }) => (url ? [normalizePageUrl(url) ?? url.trim()] : []))
    ).size,
    uniqueQueryCount: new Set(
      rows.flatMap(({ query }) => (query ? [query.replace(/\s+/g, ' ').trim().toLowerCase()] : []))
    ).size,
    columns: detectedColumns,
    rows,
  };
}

/** Summarize one export without merging it with potentially overlapping export views. */
export function summarizeBingAiPerformanceExport(
  exportData: BingAiPerformanceExport
): BingAiPerformanceSummary {
  const sumMetric = (
    rows: BingAiPerformanceRow[],
    key: 'citations' | 'citedPages'
  ): number | undefined => {
    const values = rows.flatMap((row) =>
      typeof row[key] === 'number' ? [row[key] as number] : []
    );
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : undefined;
  };
  const averageShare = (rows: BingAiPerformanceRow[]): number | undefined => {
    const values = rows.flatMap(({ citationShare }) =>
      typeof citationShare === 'number' ? [citationShare] : []
    );
    return values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : undefined;
  };
  const groupDimension = (
    dimension: 'url' | 'query' | 'topic' | 'intent'
  ): BingAiPerformanceDimensionSummary[] => {
    const groups = new Map<string, { label: string; rows: BingAiPerformanceRow[] }>();
    for (const row of exportData.rows) {
      const raw = row[dimension]?.trim();
      if (!raw) continue;
      const label = dimension === 'url' ? (normalizePageUrl(raw) ?? raw) : raw.replace(/\s+/g, ' ');
      const key = dimension === 'url' ? label : label.toLowerCase();
      const group = groups.get(key) ?? { label, rows: [] };
      group.rows.push(row);
      groups.set(key, group);
    }
    return [...groups.values()]
      .map(({ label, rows }) => {
        const citations = sumMetric(rows, 'citations');
        const citedPages = sumMetric(rows, 'citedPages');
        const citationShare = averageShare(rows);
        return {
          value: label,
          rows: rows.length,
          ...(citations !== undefined ? { citations } : {}),
          ...(citedPages !== undefined ? { citedPages } : {}),
          ...(citationShare !== undefined ? { averageCitationShare: citationShare } : {}),
        };
      })
      .sort((left, right) => {
        const leftRank = left.citations ?? left.citedPages ?? left.averageCitationShare ?? 0;
        const rightRank = right.citations ?? right.citedPages ?? right.averageCitationShare ?? 0;
        return rightRank - leftRank || left.value.localeCompare(right.value);
      })
      .slice(0, 20);
  };

  const datedRows = new Map<string, BingAiPerformanceRow[]>();
  for (const row of exportData.rows) {
    if (!row.date) continue;
    const group = datedRows.get(row.date) ?? [];
    group.push(row);
    datedRows.set(row.date, group);
  }
  const timeSeries = [...datedRows.entries()].map(([period, rows]) => {
    const citations = sumMetric(rows, 'citations');
    const citedPages = sumMetric(rows, 'citedPages');
    const citationShare = averageShare(rows);
    return {
      period,
      rows: rows.length,
      ...(citations !== undefined ? { citations } : {}),
      ...(citedPages !== undefined ? { citedPages } : {}),
      ...(citationShare !== undefined ? { averageCitationShare: citationShare } : {}),
    };
  });
  const timestamps = timeSeries.map(({ period }) => Date.parse(period));
  const timestampsAreParseable = timestamps.length > 0 && timestamps.every(Number.isFinite);
  timeSeries.sort((left, right) => {
    const leftDate = Date.parse(left.period);
    const rightDate = Date.parse(right.period);
    return timestampsAreParseable ? leftDate - rightDate : left.period.localeCompare(right.period);
  });
  const first = timeSeries[0];
  const last = timeSeries[timeSeries.length - 1];
  const absoluteChange =
    first?.citations !== undefined && last?.citations !== undefined
      ? last.citations - first.citations
      : undefined;
  const citationValues = exportData.rows.flatMap(({ citations }) =>
    typeof citations === 'number' ? [citations] : []
  );
  const citedPageValues = exportData.rows.flatMap(({ citedPages }) =>
    typeof citedPages === 'number' ? [citedPages] : []
  );
  const shareValues = exportData.rows.flatMap(({ citationShare }) =>
    typeof citationShare === 'number' ? [citationShare] : []
  );

  return {
    ...(exportData.sourceFile ? { sourceFile: exportData.sourceFile } : {}),
    datasetKind: exportData.datasetKind,
    rowCount: exportData.rowCount,
    uniquePageCount: exportData.uniquePageCount,
    uniqueQueryCount: exportData.uniqueQueryCount,
    ...(citationValues.length > 0
      ? { totalCitations: citationValues.reduce((sum, value) => sum + value, 0) }
      : {}),
    ...(citedPageValues.length > 0
      ? { totalCitedPages: citedPageValues.reduce((sum, value) => sum + value, 0) }
      : {}),
    ...(shareValues.length > 0
      ? {
          averageCitationShare:
            shareValues.reduce((sum, value) => sum + value, 0) / shareValues.length,
        }
      : {}),
    topPages: groupDimension('url'),
    topQueries: groupDimension('query'),
    topTopics: groupDimension('topic'),
    topIntents: groupDimension('intent'),
    timeSeries,
    ...(timestampsAreParseable && first && last && absoluteChange !== undefined
      ? {
          firstToLastCitationChange: {
            firstPeriod: first.period,
            lastPeriod: last.period,
            absoluteChange,
            ...(first.citations !== undefined && first.citations !== 0
              ? { percentChange: (absoluteChange / first.citations) * 100 }
              : {}),
          },
        }
      : {}),
    note: 'Bing reports sampled, aggregated observations. Totals sum rows in this one export view; they are not complete counts of AI answers or citations, and separate export views may overlap.',
  };
}

function normalizeBingQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function queryPageAuditKey(query: string, url: string): string | undefined {
  const normalizedUrl = normalizePageUrl(url);
  return normalizedUrl ? JSON.stringify([normalizeBingQuery(query), normalizedUrl]) : undefined;
}

function queryPageAuditSignals(row: BingAiCitedPageAuditRow): BingAiQueryPageAuditSignals {
  const blockedByRobots = row.blockedSearchCrawlers.some(
    (token) => token.toLowerCase() === 'bingbot'
  );
  const bingbotBlocked = row.currentBingbotBlocked ?? blockedByRobots;
  const bingbotAccessAssessed = row.currentBingbotAccessAssessed === true || blockedByRobots;
  return {
    auditMatchType: row.auditMatchType,
    auditMatched: row.auditMatched,
    ...(row.matchedAuditUrl ? { matchedAuditUrl: row.matchedAuditUrl } : {}),
    bingbotAccess: !bingbotAccessAssessed ? 'not-assessed' : bingbotBlocked ? 'blocked' : 'allowed',
    ...(row.currentNoindex !== undefined ? { globalNoindex: row.currentNoindex } : {}),
    ...(row.currentNoSnippet !== undefined ? { globalNoSnippet: row.currentNoSnippet } : {}),
    ...(row.currentBingbotNoindex !== undefined
      ? { bingbotNoindex: row.currentBingbotNoindex }
      : {}),
    ...(row.currentBingbotNoSnippet !== undefined
      ? { bingbotNoSnippet: row.currentBingbotNoSnippet }
      : {}),
    ...(row.currentBingbotMaxSnippetZero !== undefined
      ? { bingbotMaxSnippetZero: row.currentBingbotMaxSnippetZero }
      : {}),
    ...(row.currentQuestionHeadings !== undefined
      ? { questionHeadings: row.currentQuestionHeadings }
      : {}),
    ...(row.currentConciseAnswerBlocks !== undefined
      ? { conciseAnswerBlocks: row.currentConciseAnswerBlocks }
      : {}),
    ...(row.currentExternalSourceLinks !== undefined
      ? { externalSourceLinks: row.currentExternalSourceLinks }
      : {}),
    ...(row.currentDocumentLanguage ? { documentLanguage: row.currentDocumentLanguage } : {}),
    ...(row.currentDocumentLanguageValid !== undefined
      ? { documentLanguageValid: row.currentDocumentLanguageValid }
      : {}),
  };
}

function summarizeQueryPageAuditReview(
  rows: BingAiCitedPageAuditRow[],
  mappedPages: number
): BingAiQueryAuditReview {
  const matched = rows.filter(({ auditMatched }) => auditMatched);
  const languageGroups = new Map<string, BingAiQueryAuditLanguageGroup>();
  let languageProfilesAssessedPages = 0;
  let assessedPagesWithoutLanguageTag = 0;
  let pagesWithValidDeclaredLanguageTag = 0;
  let pagesWithInvalidDeclaredLanguageTag = 0;
  let pagesWithDeclaredLanguageTagNotValidated = 0;
  for (const row of matched) {
    const language = row.currentDocumentLanguage?.trim().slice(0, 80);
    if (
      row.currentDocumentLanguageAssessed ||
      row.currentDocumentLanguageValid !== undefined ||
      language
    )
      languageProfilesAssessedPages += 1;
    if (row.currentDocumentLanguageAssessed && !language) assessedPagesWithoutLanguageTag += 1;
    if (row.currentDocumentLanguageValid === true) pagesWithValidDeclaredLanguageTag += 1;
    else if (row.currentDocumentLanguageValid === false) pagesWithInvalidDeclaredLanguageTag += 1;
    else if (language) pagesWithDeclaredLanguageTagNotValidated += 1;
    if (language) {
      const key = language.toLowerCase();
      const group = languageGroups.get(key) ?? { language, pages: 0 };
      group.pages += 1;
      languageGroups.set(key, group);
    }
  }
  const declaredLanguages = [...languageGroups.values()].sort(
    (left, right) => right.pages - left.pages || left.language.localeCompare(right.language)
  );
  const bingbotAccessAssessed = matched.filter(
    ({ currentBingbotAccessAssessed, currentBingbotBlocked, blockedSearchCrawlers }) =>
      currentBingbotAccessAssessed === true ||
      currentBingbotBlocked === true ||
      blockedSearchCrawlers.some((token) => token.toLowerCase() === 'bingbot')
  );
  return {
    mappedPages,
    pagesMatchedToAudit: matched.length,
    pagesNotMatchedToAudit: rows.filter(({ auditMatched }) => !auditMatched).length,
    pagesWithoutAuditCorrelation: Math.max(0, mappedPages - rows.length),
    pagesWithAmbiguousAuditUrlMatch: rows.filter(
      ({ auditMatchType }) => auditMatchType === 'ambiguous-audit-url'
    ).length,
    pagesWithAmbiguousCanonicalMatch: rows.filter(
      ({ auditMatchType }) => auditMatchType === 'ambiguous-canonical'
    ).length,
    bingbotAccessAssessedPages: bingbotAccessAssessed.length,
    currentBingbotBlockedPages: bingbotAccessAssessed.filter(
      ({ currentBingbotBlocked }) => currentBingbotBlocked === true
    ).length,
    pagesWithGlobalNoindex: matched.filter(({ currentNoindex }) => currentNoindex === true).length,
    pagesWithGlobalNoSnippet: matched.filter(({ currentNoSnippet }) => currentNoSnippet === true)
      .length,
    pagesWithBingbotNoindex: matched.filter(
      ({ currentBingbotNoindex }) => currentBingbotNoindex === true
    ).length,
    pagesWithBingbotSnippetRestriction: matched.filter(
      ({ currentBingbotNoSnippet, currentBingbotMaxSnippetZero }) =>
        currentBingbotNoSnippet === true || currentBingbotMaxSnippetZero === true
    ).length,
    pagesWithQuestionHeadings: matched.filter(
      ({ currentQuestionHeadings }) =>
        currentQuestionHeadings !== undefined && currentQuestionHeadings > 0
    ).length,
    pagesWithConciseAnswerBlocks: matched.filter(
      ({ currentConciseAnswerBlocks }) =>
        currentConciseAnswerBlocks !== undefined && currentConciseAnswerBlocks > 0
    ).length,
    pagesWithExternalSourceLinks: matched.filter(
      ({ currentExternalSourceLinks }) =>
        currentExternalSourceLinks !== undefined && currentExternalSourceLinks > 0
    ).length,
    languageProfilesAssessedPages,
    assessedPagesWithoutLanguageTag,
    pagesWithValidDeclaredLanguageTag,
    pagesWithInvalidDeclaredLanguageTag,
    pagesWithDeclaredLanguageTagNotValidated,
    declaredLanguages: declaredLanguages.slice(0, 10),
    languagesTruncated: declaredLanguages.length > 10,
  };
}

function medianOf(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return values.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Analyze exact Bing query-to-page mappings; optional row correlations add a current-audit review. */
export function analyzeBingAiQueryPageMapping(
  exportData: BingAiPerformanceExport,
  auditCorrelation?: Pick<BingAiAuditCorrelation, 'rows'>
): BingAiQueryPageMappingAnalysis {
  if (exportData.datasetKind !== 'query-page-mapping') {
    throw new Error('Bing query-page analysis requires a query-page-mapping export.');
  }
  type MetricBucket = { rows: number; citations?: number; citedPages?: number };
  type QueryBucket = MetricBucket & {
    query: string;
    pages: Map<string, MetricBucket>;
    topics: Set<string>;
    intents: Set<string>;
  };
  type PageBucket = MetricBucket & {
    queries: Map<string, { query: string; citations?: number }>;
  };
  const queries = new Map<string, QueryBucket>();
  const pages = new Map<string, PageBucket>();
  const auditByQueryPage = new Map<string, BingAiCitedPageAuditRow>();
  for (const row of auditCorrelation?.rows ?? []) {
    if (!row.query) continue;
    const key = queryPageAuditKey(row.query, row.url);
    if (key && !auditByQueryPage.has(key)) auditByQueryPage.set(key, row);
  }
  let mappingRows = 0;
  let queryRowsWithoutUsableUrl = 0;

  for (const row of exportData.rows) {
    const query = row.query?.replace(/\s+/g, ' ').trim();
    if (!query) continue;
    const queryKey = normalizeBingQuery(query);
    const queryBucket = queries.get(queryKey) ?? {
      query,
      rows: 0,
      pages: new Map<string, MetricBucket>(),
      topics: new Set<string>(),
      intents: new Set<string>(),
    };
    queryBucket.rows += 1;
    if (row.topic?.trim()) queryBucket.topics.add(row.topic.trim());
    if (row.intent?.trim()) queryBucket.intents.add(row.intent.trim());
    queries.set(queryKey, queryBucket);

    const url = row.url ? normalizePageUrl(row.url) : undefined;
    if (!url) {
      queryRowsWithoutUsableUrl += 1;
      continue;
    }
    mappingRows += 1;
    const queryPage = queryBucket.pages.get(url) ?? { rows: 0 };
    queryPage.rows += 1;
    if (row.citations !== undefined)
      queryPage.citations = (queryPage.citations ?? 0) + row.citations;
    if (row.citedPages !== undefined)
      queryPage.citedPages = (queryPage.citedPages ?? 0) + row.citedPages;
    queryBucket.pages.set(url, queryPage);

    const pageBucket: PageBucket = pages.get(url) ?? {
      rows: 0,
      queries: new Map<string, { query: string; citations?: number }>(),
    };
    pageBucket.rows += 1;
    if (row.citations !== undefined)
      pageBucket.citations = (pageBucket.citations ?? 0) + row.citations;
    if (row.citedPages !== undefined)
      pageBucket.citedPages = (pageBucket.citedPages ?? 0) + row.citedPages;
    const pageQuery = pageBucket.queries.get(queryKey) ?? { query };
    if (row.citations !== undefined)
      pageQuery.citations = (pageQuery.citations ?? 0) + row.citations;
    pageBucket.queries.set(queryKey, pageQuery);
    pages.set(url, pageBucket);
  }

  const queryGroups = [...queries.values()]
    .map((bucket): BingAiQueryPageGroup => {
      const queryAuditRows = [...bucket.pages.keys()].flatMap((url) => {
        const row = auditByQueryPage.get(queryPageAuditKey(bucket.query, url) ?? '');
        return row ? [row] : [];
      });
      const queryPages = [...bucket.pages.entries()]
        .map(([url, metrics]) => {
          const currentAudit = auditByQueryPage.get(queryPageAuditKey(bucket.query, url) ?? '');
          return {
            url,
            rows: metrics.rows,
            ...(metrics.citations !== undefined ? { citations: metrics.citations } : {}),
            ...(metrics.citedPages !== undefined ? { citedPages: metrics.citedPages } : {}),
            ...(currentAudit ? { currentAudit: queryPageAuditSignals(currentAudit) } : {}),
          };
        })
        .sort(
          (left, right) =>
            (right.citations ?? 0) - (left.citations ?? 0) || left.url.localeCompare(right.url)
        );
      const topics = [...bucket.topics].sort((left, right) => left.localeCompare(right));
      const intents = [...bucket.intents].sort((left, right) => left.localeCompare(right));
      const citations = [...bucket.pages.values()].flatMap(({ citations }) =>
        citations === undefined ? [] : [citations]
      );
      const citedPages = [...bucket.pages.values()].flatMap(({ citedPages }) =>
        citedPages === undefined ? [] : [citedPages]
      );
      const measuredCitationPages = [...bucket.pages.values()].flatMap(({ citations }) =>
        citations === undefined ? [] : [citations]
      );
      const measuredCitationTotal = measuredCitationPages.reduce((sum, value) => sum + value, 0);
      const citationSquares =
        measuredCitationTotal > 0
          ? measuredCitationPages.reduce(
              (sum, value) => sum + (value / measuredCitationTotal) ** 2,
              0
            )
          : undefined;
      const citationDistribution =
        measuredCitationPages.length > 0
          ? ({
              pagesWithCitationMetric: measuredCitationPages.length,
              pagesWithoutCitationMetric: Math.max(
                0,
                bucket.pages.size - measuredCitationPages.length
              ),
              citationsAcrossMeasuredPages: measuredCitationTotal,
              ...(measuredCitationTotal > 0
                ? {
                    largestPageCitationSharePercent: Number(
                      (
                        (measuredCitationPages.reduce(
                          (largest, value) => Math.max(largest, value),
                          0
                        ) /
                          measuredCitationTotal) *
                        100
                      ).toFixed(2)
                    ),
                    herfindahlIndex: Number(citationSquares!.toFixed(6)),
                    effectiveCitationPages: Number((1 / citationSquares!).toFixed(2)),
                  }
                : {}),
              note: 'Page shares, Herfindahl concentration, and effective-page count use only mapped URLs with a citations value in this exact phrase group. Zero-total or partially measured groups have no comparable concentration score; cited-page and citation rows can be sampled or overlap across phrases.',
            } satisfies BingAiQueryCitationDistribution)
          : undefined;
      return {
        query: bucket.query,
        rows: bucket.rows,
        pageCount: bucket.pages.size,
        ...(citations.length
          ? { citations: citations.reduce((sum, value) => sum + value, 0) }
          : {}),
        ...(citedPages.length
          ? { citedPages: citedPages.reduce((sum, value) => sum + value, 0) }
          : {}),
        topics: topics.slice(0, 10),
        topicsTruncated: topics.length > 10,
        intents: intents.slice(0, 10),
        intentsTruncated: intents.length > 10,
        ...(citationDistribution ? { citationDistribution } : {}),
        pages: queryPages.slice(0, 10),
        pagesTruncated: queryPages.length > 10,
        ...(auditCorrelation
          ? { auditReview: summarizeQueryPageAuditReview(queryAuditRows, bucket.pages.size) }
          : {}),
      };
    })
    .sort(
      (left, right) =>
        right.pageCount - left.pageCount ||
        (right.citations ?? 0) - (left.citations ?? 0) ||
        left.query.localeCompare(right.query)
    );
  const pageSummaries = [...pages.entries()]
    .map(([url, bucket]): BingAiQueryPagePage => {
      const relatedQueries = [...bucket.queries.values()].sort(
        (left, right) =>
          (right.citations ?? 0) - (left.citations ?? 0) || left.query.localeCompare(right.query)
      );
      return {
        url,
        rows: bucket.rows,
        queryCount: bucket.queries.size,
        ...(bucket.citations !== undefined ? { citations: bucket.citations } : {}),
        ...(bucket.citedPages !== undefined ? { citedPages: bucket.citedPages } : {}),
        queries: relatedQueries.slice(0, 10).map(({ query }) => query),
        queriesTruncated: relatedQueries.length > 10,
      };
    })
    .sort(
      (left, right) =>
        right.queryCount - left.queryCount ||
        (right.citations ?? 0) - (left.citations ?? 0) ||
        left.url.localeCompare(right.url)
    );

  const groupsWithCitationMetrics = queryGroups.flatMap(({ citationDistribution }) =>
    citationDistribution ? [citationDistribution] : []
  );
  const groupsWithMeasuredConcentration = groupsWithCitationMetrics.filter(
    ({ herfindahlIndex }) => herfindahlIndex !== undefined
  );
  const largestShareMedian = medianOf(
    groupsWithMeasuredConcentration.flatMap(({ largestPageCitationSharePercent }) =>
      largestPageCitationSharePercent === undefined ? [] : [largestPageCitationSharePercent]
    )
  );
  const effectivePagesMedian = medianOf(
    groupsWithMeasuredConcentration.flatMap(({ effectiveCitationPages }) =>
      effectiveCitationPages === undefined ? [] : [effectiveCitationPages]
    )
  );
  const citationDistributionSummary =
    groupsWithCitationMetrics.length > 0
      ? ({
          queriesWithMeasuredDistribution: groupsWithMeasuredConcentration.length,
          queriesWithPartialPageMetricCoverage: groupsWithCitationMetrics.filter(
            ({ pagesWithCitationMetric, pagesWithoutCitationMetric }) =>
              pagesWithCitationMetric > 0 && pagesWithoutCitationMetric > 0
          ).length,
          ...(largestShareMedian !== undefined
            ? { medianLargestPageCitationSharePercent: Number(largestShareMedian.toFixed(2)) }
            : {}),
          ...(effectivePagesMedian !== undefined
            ? { medianEffectiveCitationPages: Number(effectivePagesMedian.toFixed(2)) }
            : {}),
          note: 'Medians summarize exact phrase groups with a positive citation total and use each group’s mapped URLs with citation metrics. Query groups without metrics or with a zero citation total are omitted; partial page-metric coverage is counted separately. These are distributions of this export, not coverage of all generated answers or a ranking signal.',
        } satisfies BingAiQueryCitationDistributionSummary)
      : undefined;

  return {
    ...(exportData.sourceFile ? { sourceFile: exportData.sourceFile } : {}),
    mappingRows,
    queryCount: queries.size,
    pageCount: pages.size,
    queriesMappedToMultiplePages: queryGroups.filter(({ pageCount }) => pageCount > 1).length,
    queriesWithoutMappedPages: queryGroups.filter(({ pageCount }) => pageCount === 0).length,
    pagesMappedFromMultipleQueries: pageSummaries.filter(({ queryCount }) => queryCount > 1).length,
    queryRowsWithoutUsableUrl,
    ...(citationDistributionSummary ? { citationDistributionSummary } : {}),
    queryGroups: queryGroups.slice(0, 500),
    queryGroupsTruncated: queryGroups.length > 500,
    pages: pageSummaries.slice(0, 500),
    pagesTruncated: pageSummaries.length > 500,
    note: `Bing query-page mappings are sampled, aggregated observations. Query matching groups exact phrases after whitespace and case normalization only; multi-page mappings do not establish search cannibalization, answer overlap, or a reason for citation behavior. Citation and cited-page fields are row sums that may overlap across mappings, not complete answer or property totals. Per-phrase concentration uses only mapped URLs with citations present; its effective-page value is the reciprocal of the Herfindahl index and is descriptive, not a quality or ranking score. Detailed query and page lists are capped at 500 groups, and each query lists at most 10 pages.${auditCorrelation ? ' Current audit controls and content are present-day snapshots that may postdate the export; absent signals can be unassessed and do not explain why Bing mapped a page to a phrase.' : ''}`,
  };
}

/** Compare exact Bing query-to-page mappings between two sampled query-page exports. */
export function compareBingAiQueryPageMappings(
  current: BingAiPerformanceExport,
  baseline: BingAiPerformanceExport
): BingAiQueryPageMappingComparison {
  if (
    current.datasetKind !== 'query-page-mapping' ||
    baseline.datasetKind !== 'query-page-mapping'
  ) {
    throw new Error('Bing query mapping comparisons require two query-page-mapping exports.');
  }
  type QueryPageMetric = { citations?: number };
  type QueryBucket = { query: string; pages: Map<string, QueryPageMetric> };
  const buildQueryMap = (input: BingAiPerformanceExport): Map<string, QueryBucket> => {
    const groups = new Map<string, QueryBucket>();
    for (const row of input.rows) {
      const query = row.query?.replace(/\s+/g, ' ').trim();
      if (!query) continue;
      const queryKey = normalizeBingQuery(query);
      const group = groups.get(queryKey) ?? { query, pages: new Map<string, QueryPageMetric>() };
      const url = row.url ? normalizePageUrl(row.url) : undefined;
      if (url) {
        const page = group.pages.get(url) ?? {};
        if (row.citations !== undefined) page.citations = (page.citations ?? 0) + row.citations;
        group.pages.set(url, page);
      }
      groups.set(queryKey, group);
    }
    return groups;
  };
  const currentQueries = buildQueryMap(current);
  const baselineQueries = buildQueryMap(baseline);
  const queryKeys = [...new Set([...currentQueries.keys(), ...baselineQueries.keys()])];
  let pageMappingsCompared = 0;
  let pageMappingsOnlyInCurrentExport = 0;
  let pageMappingsOnlyInBaselineExport = 0;
  let pageMappingsWithUnavailableCitationMetric = 0;
  let matchedBaselineCitations = 0;
  let matchedCurrentCitations = 0;
  const queryGroups = queryKeys
    .map((key): BingAiQueryMappingChangeGroup => {
      const currentGroup = currentQueries.get(key);
      const baselineGroup = baselineQueries.get(key);
      const currentPages = currentGroup?.pages ?? new Map<string, QueryPageMetric>();
      const baselinePages = baselineGroup?.pages ?? new Map<string, QueryPageMetric>();
      const urls = [...new Set([...currentPages.keys(), ...baselinePages.keys()])].sort(
        (left, right) => left.localeCompare(right)
      );
      let groupPagesCompared = 0;
      let groupPagesWithoutMetric = 0;
      let groupMatchedBaselineCitations = 0;
      let groupMatchedCurrentCitations = 0;
      const pages = urls.map((url): BingAiQueryPageMappingChange => {
        const currentPage = currentPages.get(url);
        const baselinePage = baselinePages.get(url);
        if (!currentPage) {
          pageMappingsOnlyInBaselineExport += 1;
          return {
            url,
            state: 'baseline-only',
            ...(baselinePage?.citations !== undefined
              ? { baselineCitations: baselinePage.citations }
              : {}),
          };
        }
        if (!baselinePage) {
          pageMappingsOnlyInCurrentExport += 1;
          return {
            url,
            state: 'current-only',
            ...(currentPage.citations !== undefined
              ? { currentCitations: currentPage.citations }
              : {}),
          };
        }
        pageMappingsCompared += 1;
        groupPagesCompared += 1;
        if (currentPage.citations === undefined || baselinePage.citations === undefined) {
          pageMappingsWithUnavailableCitationMetric += 1;
          groupPagesWithoutMetric += 1;
          return {
            url,
            state: 'metric-unavailable',
            ...(baselinePage.citations !== undefined
              ? { baselineCitations: baselinePage.citations }
              : {}),
            ...(currentPage.citations !== undefined
              ? { currentCitations: currentPage.citations }
              : {}),
          };
        }
        groupMatchedBaselineCitations += baselinePage.citations;
        groupMatchedCurrentCitations += currentPage.citations;
        return {
          url,
          state: 'present-both',
          baselineCitations: baselinePage.citations,
          currentCitations: currentPage.citations,
          citationChange: currentPage.citations - baselinePage.citations,
        };
      });
      matchedBaselineCitations += groupMatchedBaselineCitations;
      matchedCurrentCitations += groupMatchedCurrentCitations;
      const state =
        currentGroup && baselineGroup
          ? 'present-both'
          : currentGroup
            ? 'current-only'
            : 'baseline-only';
      const sortedPages = pages.sort((left, right) => {
        const stateOrder = (value: BingAiQueryPageMappingChange['state']): number =>
          value === 'present-both'
            ? 0
            : value === 'metric-unavailable'
              ? 1
              : value === 'current-only'
                ? 2
                : 3;
        return (
          stateOrder(left.state) - stateOrder(right.state) ||
          Math.abs(right.citationChange ?? 0) - Math.abs(left.citationChange ?? 0) ||
          left.url.localeCompare(right.url)
        );
      });
      return {
        query: currentGroup?.query ?? baselineGroup?.query ?? key,
        state,
        baselinePageCount: baselinePages.size,
        currentPageCount: currentPages.size,
        pagesOnlyInCurrentExport: urls.filter(
          (url) => currentPages.has(url) && !baselinePages.has(url)
        ).length,
        pagesOnlyInBaselineExport: urls.filter(
          (url) => baselinePages.has(url) && !currentPages.has(url)
        ).length,
        mappedPagePairCount: urls.length,
        pagesCompared: groupPagesCompared,
        pagesWithUnavailableCitationMetric: groupPagesWithoutMetric,
        matchedBaselineCitations: groupMatchedBaselineCitations,
        matchedCurrentCitations: groupMatchedCurrentCitations,
        ...(groupPagesCompared > groupPagesWithoutMetric
          ? { matchedCitationChange: groupMatchedCurrentCitations - groupMatchedBaselineCitations }
          : {}),
        pages: sortedPages.slice(0, 10),
        pagesTruncated: sortedPages.length > 10,
      };
    })
    .sort(
      (left, right) =>
        right.pagesCompared - left.pagesCompared ||
        (right.matchedCurrentCitations ?? 0) - (left.matchedCurrentCitations ?? 0) ||
        left.query.localeCompare(right.query)
    );
  const queriesPresentInBoth = queryGroups.filter(({ state }) => state === 'present-both').length;
  return {
    ...(baseline.sourceFile ? { baselineSourceFile: baseline.sourceFile } : {}),
    ...(current.sourceFile ? { currentSourceFile: current.sourceFile } : {}),
    baselineQueryCount: baselineQueries.size,
    currentQueryCount: currentQueries.size,
    queriesPresentInBoth,
    queriesOnlyInCurrentExport: currentQueries.size - queriesPresentInBoth,
    queriesOnlyInBaselineExport: baselineQueries.size - queriesPresentInBoth,
    pageMappingsCompared,
    pageMappingsOnlyInCurrentExport,
    pageMappingsOnlyInBaselineExport,
    pageMappingsWithUnavailableCitationMetric,
    matchedBaselineCitations,
    matchedCurrentCitations,
    matchedCitationChange: matchedCurrentCitations - matchedBaselineCitations,
    queryGroups: queryGroups.slice(0, 500),
    queryGroupsTruncated: queryGroups.length > 500,
    note: 'Query mapping comparisons require like-for-like Bing properties, report settings, and date ranges except for the intended period change. Bing query-page exports are sampled and aggregated; query groups and URL mappings absent from one export are export-only observations, not proof of new/lost prompts, citations, or pages. Citation deltas are computed only for exact normalized query/URL pairs with citation metrics in both exports; metrics can overlap across query groups and are not complete answer or property totals. Query matching is case/whitespace normalized only, URL matching uses Aviary normalization, and detailed output is capped at 500 phrases with 10 URL pairs each.',
  };
}

/** Compare observed topic/intent cohorts and query turnover across two sampled exports. */
export function compareBingAiTopicIntentExports(
  current: BingAiPerformanceExport,
  baseline: BingAiPerformanceExport
): BingAiTopicIntentComparison {
  type CohortBucket = {
    topic: string;
    intent: string;
    rows: number;
    rowsWithCitationMetric: number;
    citations: number;
    queries: Map<string, string>;
  };
  const buildCohorts = (
    input: BingAiPerformanceExport
  ): {
    cohorts: Map<string, CohortBucket>;
    rowsWithBothDimensions: number;
    rowsWithCitationMetric: number;
  } => {
    const cohorts = new Map<string, CohortBucket>();
    let rowsWithBothDimensions = 0;
    let rowsWithCitationMetric = 0;
    for (const row of input.rows) {
      const topic = row.topic?.replace(/\s+/g, ' ').trim();
      const intent = row.intent?.replace(/\s+/g, ' ').trim();
      if (!topic || !intent) continue;
      rowsWithBothDimensions += 1;
      const topicKey = topic.toLocaleLowerCase('en-US');
      const intentKey = intent.toLocaleLowerCase('en-US');
      const key = JSON.stringify([topicKey, intentKey]);
      const bucket = cohorts.get(key) ?? {
        topic,
        intent,
        rows: 0,
        rowsWithCitationMetric: 0,
        citations: 0,
        queries: new Map<string, string>(),
      };
      bucket.rows += 1;
      if (row.citations !== undefined) {
        bucket.rowsWithCitationMetric += 1;
        bucket.citations += row.citations;
        rowsWithCitationMetric += 1;
      }
      const query = row.query?.replace(/\s+/g, ' ').trim();
      if (query) {
        const queryKey = normalizeBingQuery(query);
        if (!bucket.queries.has(queryKey)) bucket.queries.set(queryKey, query);
      }
      cohorts.set(key, bucket);
    }
    return { cohorts, rowsWithBothDimensions, rowsWithCitationMetric };
  };
  const currentData = buildCohorts(current);
  const baselineData = buildCohorts(baseline);
  if (currentData.rowsWithBothDimensions === 0 || baselineData.rowsWithBothDimensions === 0) {
    throw new Error(
      'Bing topic-intent comparison requires rows with both topic and intent in each export.'
    );
  }
  const currentCitationTotal = [...currentData.cohorts.values()].reduce(
    (sum, bucket) => sum + bucket.citations,
    0
  );
  const baselineCitationTotal = [...baselineData.cohorts.values()].reduce(
    (sum, bucket) => sum + bucket.citations,
    0
  );
  const keys = [...new Set([...currentData.cohorts.keys(), ...baselineData.cohorts.keys()])];
  const cohorts = keys
    .map((key): BingAiTopicIntentCohortChange => {
      const currentBucket = currentData.cohorts.get(key);
      const baselineBucket = baselineData.cohorts.get(key);
      const template = currentBucket ?? baselineBucket!;
      const currentQueries = currentBucket?.queries ?? new Map<string, string>();
      const baselineQueries = baselineBucket?.queries ?? new Map<string, string>();
      const currentOnlyQueryKeys = [...currentQueries.keys()].filter(
        (query) => !baselineQueries.has(query)
      );
      const baselineOnlyQueryKeys = [...baselineQueries.keys()].filter(
        (query) => !currentQueries.has(query)
      );
      const queriesPresentInBoth = [...currentQueries.keys()].filter((query) =>
        baselineQueries.has(query)
      ).length;
      const hasBothCitationTotals = Boolean(
        currentBucket &&
        baselineBucket &&
        currentBucket.rowsWithCitationMetric > 0 &&
        baselineBucket.rowsWithCitationMetric > 0
      );
      const baselineCitationSharePercent =
        baselineCitationTotal > 0 && baselineBucket?.rowsWithCitationMetric
          ? (baselineBucket.citations / baselineCitationTotal) * 100
          : undefined;
      const currentCitationSharePercent =
        currentCitationTotal > 0 && currentBucket?.rowsWithCitationMetric
          ? (currentBucket.citations / currentCitationTotal) * 100
          : undefined;
      return {
        topic: template.topic,
        intent: template.intent,
        baselineRows: baselineBucket?.rows ?? 0,
        currentRows: currentBucket?.rows ?? 0,
        baselineRowsWithCitationMetric: baselineBucket?.rowsWithCitationMetric ?? 0,
        currentRowsWithCitationMetric: currentBucket?.rowsWithCitationMetric ?? 0,
        baselineQueries: baselineQueries.size,
        currentQueries: currentQueries.size,
        queriesPresentInBoth,
        queriesOnlyInCurrentExport: currentOnlyQueryKeys.length,
        queriesOnlyInBaselineExport: baselineOnlyQueryKeys.length,
        ...(baselineBucket?.rowsWithCitationMetric
          ? { baselineRowSummedCitations: baselineBucket.citations }
          : {}),
        ...(currentBucket?.rowsWithCitationMetric
          ? { currentRowSummedCitations: currentBucket.citations }
          : {}),
        ...(hasBothCitationTotals
          ? { rowSummedCitationChange: currentBucket!.citations - baselineBucket!.citations }
          : {}),
        ...(baselineCitationSharePercent !== undefined
          ? { baselineCitationSharePercent: Number(baselineCitationSharePercent.toFixed(2)) }
          : {}),
        ...(currentCitationSharePercent !== undefined
          ? { currentCitationSharePercent: Number(currentCitationSharePercent.toFixed(2)) }
          : {}),
        ...(baselineCitationSharePercent !== undefined && currentCitationSharePercent !== undefined
          ? {
              citationShareChangePercentagePoints: Number(
                (currentCitationSharePercent - baselineCitationSharePercent).toFixed(2)
              ),
            }
          : {}),
        currentOnlyQuerySamples: currentOnlyQueryKeys
          .slice(0, 5)
          .map((query) => currentQueries.get(query)!),
        baselineOnlyQuerySamples: baselineOnlyQueryKeys
          .slice(0, 5)
          .map((query) => baselineQueries.get(query)!),
      };
    })
    .sort(
      (left, right) =>
        Math.abs(right.citationShareChangePercentagePoints ?? 0) -
          Math.abs(left.citationShareChangePercentagePoints ?? 0) ||
        Math.abs(right.rowSummedCitationChange ?? 0) -
          Math.abs(left.rowSummedCitationChange ?? 0) ||
        right.currentRows + right.baselineRows - (left.currentRows + left.baselineRows) ||
        left.topic.localeCompare(right.topic) ||
        left.intent.localeCompare(right.intent)
    );
  const cohortKeysPresentInBoth = keys.filter(
    (key) => currentData.cohorts.has(key) && baselineData.cohorts.has(key)
  );
  const cohortsComparedWithCitationMetrics = cohortKeysPresentInBoth.filter(
    (key) =>
      (currentData.cohorts.get(key)?.rowsWithCitationMetric ?? 0) > 0 &&
      (baselineData.cohorts.get(key)?.rowsWithCitationMetric ?? 0) > 0
  ).length;
  return {
    ...(baseline.sourceFile ? { baselineSourceFile: baseline.sourceFile } : {}),
    ...(current.sourceFile ? { currentSourceFile: current.sourceFile } : {}),
    baselineRows: baseline.rowCount,
    currentRows: current.rowCount,
    baselineRowsWithBothDimensions: baselineData.rowsWithBothDimensions,
    currentRowsWithBothDimensions: currentData.rowsWithBothDimensions,
    baselineRowsWithCitationMetric: baselineData.rowsWithCitationMetric,
    currentRowsWithCitationMetric: currentData.rowsWithCitationMetric,
    baselineCohortCount: baselineData.cohorts.size,
    currentCohortCount: currentData.cohorts.size,
    cohortsPresentInBoth: cohortKeysPresentInBoth.length,
    cohortsOnlyInCurrentExport: currentData.cohorts.size - cohortKeysPresentInBoth.length,
    cohortsOnlyInBaselineExport: baselineData.cohorts.size - cohortKeysPresentInBoth.length,
    cohortsComparedWithCitationMetrics,
    ...(baselineData.rowsWithCitationMetric > 0
      ? { baselineTopicIntentCitationTotal: baselineCitationTotal }
      : {}),
    ...(currentData.rowsWithCitationMetric > 0
      ? { currentTopicIntentCitationTotal: currentCitationTotal }
      : {}),
    ...(baselineData.rowsWithCitationMetric > 0 && currentData.rowsWithCitationMetric > 0
      ? { rowSummedCitationChange: currentCitationTotal - baselineCitationTotal }
      : {}),
    cohorts: cohorts.slice(0, 500),
    cohortsTruncated: cohorts.length > 500,
    note: 'Topic and intent comparisons normalize labels by case and whitespace only; they do not merge taxonomy synonyms. Query turnover counts distinct normalized phrases only when a row includes a phrase and both cohort labels. Citation changes are row sums from sampled exports and can overlap across export views; they are not complete answer or property totals. Citation shares use only citation metrics on rows with both labels in each period, and are shown only when each export has a positive measured total. Missing cohort or query rows are export-only observations, not proof that user intent or citation activity appeared or disappeared. Cohort details are capped at 500; each phrase sample is capped at five.',
  };
}

/** Summarize observed Bing topic/intent intersections from exports that contain both dimensions. */
export function analyzeBingAiTopicIntentIntersections(
  exportData: BingAiPerformanceExport
): BingAiTopicIntentAnalysis {
  type CellBucket = {
    topic: string;
    intent: string;
    rows: number;
    citations?: number;
    citedPages?: number;
    citationShares: number[];
  };
  const cells = new Map<string, CellBucket>();
  const topics = new Set<string>();
  const intents = new Set<string>();
  let mappedRows = 0;
  let rowSummedCitations = 0;
  let rowsWithCitationMetric = 0;
  const citationShares: number[] = [];

  for (const row of exportData.rows) {
    const topic = row.topic?.replace(/\s+/g, ' ').trim();
    const intent = row.intent?.replace(/\s+/g, ' ').trim();
    if (!topic || !intent) continue;
    mappedRows += 1;
    topics.add(topic.toLowerCase());
    intents.add(intent.toLowerCase());
    const key = `${topic.toLowerCase()}\u0000${intent.toLowerCase()}`;
    const cell = cells.get(key) ?? { topic, intent, rows: 0, citationShares: [] };
    cell.rows += 1;
    if (row.citations !== undefined) {
      cell.citations = (cell.citations ?? 0) + row.citations;
      rowSummedCitations += row.citations;
      rowsWithCitationMetric += 1;
    }
    if (row.citedPages !== undefined) cell.citedPages = (cell.citedPages ?? 0) + row.citedPages;
    if (row.citationShare !== undefined) {
      cell.citationShares.push(row.citationShare);
      citationShares.push(row.citationShare);
    }
    cells.set(key, cell);
  }

  if (mappedRows === 0)
    throw new Error('Bing topic-intent analysis requires rows with both a topic and an intent.');
  const orderedCells = [...cells.values()]
    .map(({ citationShares: shares, ...cell }) => ({
      ...cell,
      ...(shares.length
        ? { averageCitationShare: shares.reduce((sum, value) => sum + value, 0) / shares.length }
        : {}),
    }))
    .sort(
      (left, right) =>
        (right.citations ?? 0) - (left.citations ?? 0) ||
        right.rows - left.rows ||
        left.topic.localeCompare(right.topic) ||
        left.intent.localeCompare(right.intent)
    );

  return {
    ...(exportData.sourceFile ? { sourceFile: exportData.sourceFile } : {}),
    mappedRows,
    topicCount: topics.size,
    intentCount: intents.size,
    cellCount: orderedCells.length,
    ...(rowsWithCitationMetric > 0 ? { rowSummedCitations } : {}),
    ...(citationShares.length
      ? {
          averageCitationShare:
            citationShares.reduce((sum, value) => sum + value, 0) / citationShares.length,
        }
      : {}),
    cells: orderedCells.slice(0, 500),
    cellsTruncated: orderedCells.length > 500,
    note: 'This cross-tab groups topic and intent labels after case and whitespace normalization. It summarizes only rows in this export; citation and cited-page values can overlap across report views and are not property totals. These associations do not measure topic quality, query demand, answer relevance, or causation.',
  };
}

function normalizePageUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      return undefined;
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
}

/** Compare citation counts and row-averaged citation share for URLs in two sampled Bing page exports. */
export function compareBingAiPageCitationExports(
  current: BingAiPerformanceExport,
  baseline: BingAiPerformanceExport
): BingAiPageCitationComparison {
  const isPageCitationExport = (value: BingAiPerformanceExport): boolean =>
    value.datasetKind === 'page-citations' &&
    !value.columns.query &&
    !value.columns.date &&
    value.rows.every((row) => !row.query && !row.date);
  if (!isPageCitationExport(current) || !isPageCitationExport(baseline)) {
    throw new Error(
      'Bing AI citation comparisons require page-citations exports without query or date dimensions.'
    );
  }

  type PageMetrics = { citations?: number; citationShares: number[] };
  const groupPages = (value: BingAiPerformanceExport): Map<string, PageMetrics> => {
    const pages = new Map<string, PageMetrics>();
    for (const row of value.rows) {
      if (!row.url) continue;
      const url = normalizePageUrl(row.url);
      if (!url) continue;
      const metrics = pages.get(url) ?? { citationShares: [] };
      if (row.citations !== undefined) metrics.citations = (metrics.citations ?? 0) + row.citations;
      if (row.citationShare !== undefined) metrics.citationShares.push(row.citationShare);
      pages.set(url, metrics);
    }
    return pages;
  };

  const currentPages = groupPages(current);
  const baselinePages = groupPages(baseline);
  const averageShare = (metrics: PageMetrics | undefined): number | undefined => {
    if (!metrics?.citationShares.length) return undefined;
    return (
      metrics.citationShares.reduce((sum, share) => sum + share, 0) / metrics.citationShares.length
    );
  };
  const changes = [...new Set([...currentPages.keys(), ...baselinePages.keys()])]
    .map((url): BingAiPageCitationChange => {
      const inCurrent = currentPages.has(url);
      const inBaseline = baselinePages.has(url);
      const baselineMetrics = baselinePages.get(url);
      const currentMetrics = currentPages.get(url);
      const before = baselineMetrics?.citations;
      const after = currentMetrics?.citations;
      const beforeShare = averageShare(baselineMetrics);
      const afterShare = averageShare(currentMetrics);
      const shareChange =
        beforeShare !== undefined && afterShare !== undefined
          ? afterShare - beforeShare
          : undefined;
      const sharedShareFields = {
        ...(beforeShare !== undefined ? { baselineAverageCitationShare: beforeShare } : {}),
        ...(afterShare !== undefined ? { currentAverageCitationShare: afterShare } : {}),
        ...(shareChange !== undefined ? { citationShareChangePercentagePoints: shareChange } : {}),
      };
      if (!inBaseline)
        return {
          url,
          ...sharedShareFields,
          ...(after !== undefined ? { currentCitations: after } : {}),
          state: 'current-only',
        };
      if (!inCurrent)
        return {
          url,
          ...sharedShareFields,
          ...(before !== undefined ? { baselineCitations: before } : {}),
          state: 'baseline-only',
        };
      if (before === undefined || after === undefined)
        return {
          url,
          ...sharedShareFields,
          ...(before !== undefined ? { baselineCitations: before } : {}),
          ...(after !== undefined ? { currentCitations: after } : {}),
          state: 'metric-unavailable',
        };
      const citationChange = after - before;
      return {
        url,
        baselineCitations: before,
        currentCitations: after,
        citationChange,
        ...sharedShareFields,
        ...(before > 0 ? { percentChange: (citationChange / before) * 100 } : {}),
        state: citationChange > 0 ? 'increased' : citationChange < 0 ? 'decreased' : 'unchanged',
      };
    })
    .sort((left, right) => {
      const leftHasDelta = left.citationChange !== undefined;
      const rightHasDelta = right.citationChange !== undefined;
      if (leftHasDelta !== rightHasDelta) return leftHasDelta ? -1 : 1;
      return (
        Math.abs(right.citationChange ?? 0) - Math.abs(left.citationChange ?? 0) ||
        left.url.localeCompare(right.url)
      );
    });
  const comparable = changes.filter(({ citationChange }) => citationChange !== undefined);
  const matchedBaselineCitations = comparable.reduce(
    (sum, change) => sum + (change.baselineCitations ?? 0),
    0
  );
  const matchedCurrentCitations = comparable.reduce(
    (sum, change) => sum + (change.currentCitations ?? 0),
    0
  );
  const matchedPageCitationChange = matchedCurrentCitations - matchedBaselineCitations;
  const citationValues = (value: BingAiPerformanceExport): number[] =>
    value.rows.flatMap(({ citations }) => (citations === undefined ? [] : [citations]));
  const baselineCitationValues = citationValues(baseline);
  const currentCitationValues = citationValues(current);
  const pagesWithUnavailableCitationMetric = changes.filter(
    ({ state }) => state === 'metric-unavailable'
  ).length;
  const shareComparable = changes.filter(
    ({ citationShareChangePercentagePoints }) => citationShareChangePercentagePoints !== undefined
  );
  const mean = (values: number[]): number | undefined =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
  const shareIncreaseOrder = (
    left: BingAiPageCitationChange,
    right: BingAiPageCitationChange
  ): number =>
    (right.citationShareChangePercentagePoints ?? 0) -
      (left.citationShareChangePercentagePoints ?? 0) || left.url.localeCompare(right.url);
  const shareDecreaseOrder = (
    left: BingAiPageCitationChange,
    right: BingAiPageCitationChange
  ): number =>
    (left.citationShareChangePercentagePoints ?? 0) -
      (right.citationShareChangePercentagePoints ?? 0) || left.url.localeCompare(right.url);
  const meanBaselinePageCitationShare = mean(
    shareComparable.map(({ baselineAverageCitationShare }) => baselineAverageCitationShare!)
  );
  const meanCurrentPageCitationShare = mean(
    shareComparable.map(({ currentAverageCitationShare }) => currentAverageCitationShare!)
  );
  const meanPageCitationShareChangePercentagePoints = mean(
    shareComparable.map(
      ({ citationShareChangePercentagePoints }) => citationShareChangePercentagePoints!
    )
  );

  return {
    ...(baseline.sourceFile ? { baselineSourceFile: baseline.sourceFile } : {}),
    ...(current.sourceFile ? { currentSourceFile: current.sourceFile } : {}),
    baselinePagesInExport: baselinePages.size,
    currentPagesInExport: currentPages.size,
    pagesCompared: comparable.length,
    pagesOnlyInCurrentExport: changes.filter(({ state }) => state === 'current-only').length,
    pagesOnlyInBaselineExport: changes.filter(({ state }) => state === 'baseline-only').length,
    pagesWithUnavailableCitationMetric,
    pagesWithCitationShareComparison: shareComparable.length,
    baselineCitationsInExport: baselineCitationValues.reduce((sum, value) => sum + value, 0),
    currentCitationsInExport: currentCitationValues.reduce((sum, value) => sum + value, 0),
    matchedBaselineCitations,
    matchedCurrentCitations,
    matchedPageCitationChange,
    ...(matchedBaselineCitations > 0
      ? { matchedPagePercentChange: (matchedPageCitationChange / matchedBaselineCitations) * 100 }
      : {}),
    ...(meanBaselinePageCitationShare !== undefined ? { meanBaselinePageCitationShare } : {}),
    ...(meanCurrentPageCitationShare !== undefined ? { meanCurrentPageCitationShare } : {}),
    ...(meanPageCitationShareChangePercentagePoints !== undefined
      ? { meanPageCitationShareChangePercentagePoints }
      : {}),
    pagesWithIncreasedCitations: comparable.filter(({ state }) => state === 'increased').length,
    pagesWithDecreasedCitations: comparable.filter(({ state }) => state === 'decreased').length,
    unchangedPages: comparable.filter(({ state }) => state === 'unchanged').length,
    topGains: comparable.filter(({ citationChange }) => (citationChange ?? 0) > 0).slice(0, 20),
    topLosses: comparable.filter(({ citationChange }) => (citationChange ?? 0) < 0).slice(0, 20),
    topCitationShareIncreases: shareComparable
      .filter(
        ({ citationShareChangePercentagePoints }) => (citationShareChangePercentagePoints ?? 0) > 0
      )
      .sort(shareIncreaseOrder)
      .slice(0, 20),
    topCitationShareDecreases: shareComparable
      .filter(
        ({ citationShareChangePercentagePoints }) => (citationShareChangePercentagePoints ?? 0) < 0
      )
      .sort(shareDecreaseOrder)
      .slice(0, 20),
    changes: changes.slice(0, 1_000),
    changesTruncated: changes.length > 1_000,
    note: 'Compare exports from the same Bing Webmaster Tools property, page-citations view, filters, and otherwise matching settings, with the intended date range as the only change. Bing reports sampled, aggregated observations. URLs absent from one export are export-only and have unknown missing-period metrics, not zero or proof of new/lost citations. Matched-page and export-row citation sums are observations, not complete citation or answer totals. Citation shares are averaged across rows for each URL; per-page share differences and their unweighted mean are percentage-point comparisons, not additive totals.',
  };
}

/** Match Bing's observed cited-page export rows against a single or batch Aviary audit. */
export function correlateBingAiCitationsWithAudit(
  exportData: BingAiPerformanceExport,
  audit: SEOReport | SEOAuditBatchReport | SiteWideGeoAnalysis
): BingAiAuditCorrelation {
  const geoSummary =
    'schemaVersion' in audit && audit.schemaVersion === 1 && 'pageSummaries' in audit
      ? (audit as SiteWideGeoAnalysis)
      : undefined;
  const standardAudit = geoSummary ? undefined : (audit as SEOReport | SEOAuditBatchReport);
  const auditPages = standardAudit
    ? 'results' in standardAudit
      ? standardAudit.results.flatMap((result) =>
          result.status === 'complete' ? [{ url: result.url, report: result.report }] : []
        )
      : [{ url: standardAudit.url, report: standardAudit }]
    : [];
  const auditPageMap = new Map<
    string,
    {
      geoAssessed: boolean;
      searchCrawlersAssessed: boolean;
      blocked: Array<{
        token: string;
        matchedRule?: { directive: 'allow' | 'disallow'; pattern: string; line: number };
      }>;
      noindex?: boolean;
      noSnippet?: boolean;
      dataNoSnippetElements?: number;
      dataNoSnippetWords?: number;
      dataNoSnippetWordSharePercent?: number;
      bingbotAccessAssessed?: boolean;
      bingbotBlocked?: boolean;
      bingbotNoindex?: boolean;
      bingbotNoSnippet?: boolean;
      bingbotMaxSnippetZero?: boolean;
      questionHeadings?: number;
      conciseAnswerBlocks?: number;
      externalContentLinks?: number;
      externalSourceLinks?: number;
      referenceSectionLinks?: number;
      visibleAuthor?: boolean;
      visibleDate?: boolean;
      documentLanguage?: string;
      documentLanguageValid?: boolean;
      documentLanguageAssessed?: boolean;
    }
  >();
  const ambiguousAuditUrls = new Set<string>();
  const addAuditPage = (
    url: string,
    signal: NonNullable<ReturnType<typeof auditPageMap.get>>
  ): void => {
    if (ambiguousAuditUrls.has(url)) return;
    if (auditPageMap.has(url)) {
      auditPageMap.delete(url);
      ambiguousAuditUrls.add(url);
      return;
    }
    auditPageMap.set(url, signal);
  };
  const canonicalPages = new Map<string, Set<string>>();
  const addCanonicalAlias = (canonicalUrl: string | undefined, normalizedUrl: string): void => {
    if (!canonicalUrl) return;
    const aliases = canonicalPages.get(canonicalUrl) ?? new Set<string>();
    aliases.add(normalizedUrl);
    canonicalPages.set(canonicalUrl, aliases);
  };
  for (const page of auditPages) {
    const normalizedUrl = normalizePageUrl(page.url);
    if (!normalizedUrl) continue;
    const canonicalDetails = page.report.checks.metaTags?.find(
      ({ name }) => name === 'canonical-url-exists'
    )?.details;
    const canonicalUrl =
      typeof canonicalDetails?.canonicalUrl === 'string'
        ? normalizePageUrl(canonicalDetails.canonicalUrl)
        : undefined;
    const geoChecks = page.report.checks.geo ?? [];
    const crawlerDetails = geoChecks.find(
      ({ name }) => name === 'ai-search-crawler-access'
    )?.details;
    const rawCrawlers =
      crawlerDetails && Array.isArray(crawlerDetails.crawlers)
        ? crawlerDetails.crawlers
        : undefined;
    const bingbotAccess = (rawCrawlers ?? []).find(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).token === 'string' &&
        ((item as Record<string, unknown>).token as string).toLowerCase() === 'bingbot' &&
        typeof (item as Record<string, unknown>).allowed === 'boolean'
    ) as Record<string, unknown> | undefined;
    const blocked = (rawCrawlers ?? []).flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      if (typeof record.token !== 'string' || record.allowed !== false) return [];
      const candidateRule = record.matchedRule;
      if (!candidateRule || typeof candidateRule !== 'object') return [{ token: record.token }];
      const rule = candidateRule as Record<string, unknown>;
      if (
        (rule.directive !== 'allow' && rule.directive !== 'disallow') ||
        typeof rule.pattern !== 'string' ||
        typeof rule.line !== 'number'
      ) {
        return [{ token: record.token }];
      }
      return [
        {
          token: record.token,
          matchedRule: { directive: rule.directive, pattern: rule.pattern, line: rule.line },
        },
      ];
    });
    const preview = geoChecks.find(({ name }) => name === 'ai-search-preview-controls')?.details;
    const answerContent = geoChecks.find(({ name }) => name === 'answer-content-profile')?.details;
    const citationEvidence = geoChecks.find(
      ({ name }) => name === 'citation-evidence-profile'
    )?.details;
    const documentLanguage = boundedDocumentLanguage(answerContent?.documentLanguage);
    const crawlerControls = Array.isArray(preview?.crawlerControls) ? preview.crawlerControls : [];
    const bingbotControls = crawlerControls.find(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).token === 'string' &&
        ((item as Record<string, unknown>).token as string).toLowerCase() === 'bingbot'
    );
    const bingbot =
      bingbotControls && typeof bingbotControls === 'object'
        ? (bingbotControls as Record<string, unknown>)
        : undefined;
    addAuditPage(normalizedUrl, {
      geoAssessed: geoChecks.length > 0,
      searchCrawlersAssessed: rawCrawlers !== undefined,
      blocked,
      ...(typeof preview?.noindex === 'boolean' ? { noindex: preview.noindex } : {}),
      ...(typeof preview?.noSnippet === 'boolean' ? { noSnippet: preview.noSnippet } : {}),
      ...(typeof preview?.dataNoSnippetElements === 'number'
        ? { dataNoSnippetElements: preview.dataNoSnippetElements }
        : {}),
      ...(typeof preview?.dataNoSnippetWords === 'number'
        ? { dataNoSnippetWords: preview.dataNoSnippetWords }
        : {}),
      ...(typeof preview?.dataNoSnippetWordSharePercent === 'number'
        ? { dataNoSnippetWordSharePercent: preview.dataNoSnippetWordSharePercent }
        : {}),
      ...(bingbotAccess
        ? { bingbotAccessAssessed: true, bingbotBlocked: bingbotAccess.allowed === false }
        : {}),
      ...(typeof bingbot?.noindex === 'boolean' ? { bingbotNoindex: bingbot.noindex } : {}),
      ...(typeof bingbot?.noSnippet === 'boolean' ? { bingbotNoSnippet: bingbot.noSnippet } : {}),
      ...(typeof bingbot?.maxSnippetZero === 'boolean'
        ? { bingbotMaxSnippetZero: bingbot.maxSnippetZero }
        : {}),
      ...(typeof answerContent?.questionHeadings === 'number'
        ? { questionHeadings: answerContent.questionHeadings }
        : {}),
      ...(typeof answerContent?.conciseAnswerBlocks === 'number'
        ? { conciseAnswerBlocks: answerContent.conciseAnswerBlocks }
        : {}),
      ...(typeof answerContent?.externalContentLinks === 'number'
        ? { externalContentLinks: answerContent.externalContentLinks }
        : {}),
      ...(typeof citationEvidence?.externalSourceLinkCount === 'number'
        ? { externalSourceLinks: citationEvidence.externalSourceLinkCount }
        : {}),
      ...(typeof citationEvidence?.referenceSectionLinkCount === 'number'
        ? { referenceSectionLinks: citationEvidence.referenceSectionLinkCount }
        : {}),
      ...(typeof answerContent?.visibleAuthor === 'boolean'
        ? { visibleAuthor: answerContent.visibleAuthor }
        : {}),
      ...(typeof answerContent?.visibleDate === 'boolean'
        ? { visibleDate: answerContent.visibleDate }
        : {}),
      ...(answerContent ? { documentLanguageAssessed: true } : {}),
      ...(documentLanguage !== undefined ? { documentLanguage } : {}),
      ...(typeof answerContent?.documentLanguageValid === 'boolean'
        ? { documentLanguageValid: answerContent.documentLanguageValid }
        : {}),
    });
    addCanonicalAlias(canonicalUrl, normalizedUrl);
  }
  for (const page of geoSummary?.pageSummaries ?? []) {
    const normalizedUrl = normalizePageUrl(page.url);
    if (!normalizedUrl) continue;
    const crawlerRows = page.searchCrawlerAccess ?? [];
    const blocked = crawlerRows.flatMap(({ token, allowed, matchedRule }) =>
      allowed ? [] : [{ token, ...(matchedRule ? { matchedRule } : {}) }]
    );
    const preview = page.previewControls;
    const bingbot = preview?.crawlerControls?.find(
      ({ token }) => token.toLowerCase() === 'bingbot'
    );
    const bingbotAccess = crawlerRows.find(({ token }) => token.toLowerCase() === 'bingbot');
    const documentLanguage = boundedDocumentLanguage(page.answerContent?.documentLanguage);
    addAuditPage(normalizedUrl, {
      geoAssessed: page.geoAssessed,
      searchCrawlersAssessed: page.signalCoverage.searchCrawlerAccess === 'measured',
      blocked,
      ...(typeof preview?.noindex === 'boolean' ? { noindex: preview.noindex } : {}),
      ...(typeof preview?.noSnippet === 'boolean' ? { noSnippet: preview.noSnippet } : {}),
      ...(typeof preview?.dataNoSnippetElements === 'number'
        ? { dataNoSnippetElements: preview.dataNoSnippetElements }
        : {}),
      ...(typeof preview?.dataNoSnippetWords === 'number'
        ? { dataNoSnippetWords: preview.dataNoSnippetWords }
        : {}),
      ...(typeof preview?.dataNoSnippetWordSharePercent === 'number'
        ? { dataNoSnippetWordSharePercent: preview.dataNoSnippetWordSharePercent }
        : {}),
      ...(page.signalCoverage.searchCrawlerAccess === 'measured' && bingbotAccess
        ? { bingbotAccessAssessed: true, bingbotBlocked: !bingbotAccess.allowed }
        : {}),
      ...(typeof bingbot?.noindex === 'boolean' ? { bingbotNoindex: bingbot.noindex } : {}),
      ...(typeof bingbot?.noSnippet === 'boolean' ? { bingbotNoSnippet: bingbot.noSnippet } : {}),
      ...(typeof bingbot?.maxSnippetZero === 'boolean'
        ? { bingbotMaxSnippetZero: bingbot.maxSnippetZero }
        : {}),
      ...(typeof page.answerContent?.questionHeadings === 'number'
        ? { questionHeadings: page.answerContent.questionHeadings }
        : {}),
      ...(typeof page.answerContent?.conciseAnswerBlocks === 'number'
        ? { conciseAnswerBlocks: page.answerContent.conciseAnswerBlocks }
        : {}),
      ...(typeof page.answerContent?.externalContentLinks === 'number'
        ? { externalContentLinks: page.answerContent.externalContentLinks }
        : {}),
      ...(typeof page.citationEvidence?.externalSourceLinkCount === 'number'
        ? { externalSourceLinks: page.citationEvidence.externalSourceLinkCount }
        : {}),
      ...(typeof page.citationEvidence?.referenceSectionLinkCount === 'number'
        ? { referenceSectionLinks: page.citationEvidence.referenceSectionLinkCount }
        : {}),
      ...(typeof page.answerContent?.visibleAuthor === 'boolean'
        ? { visibleAuthor: page.answerContent.visibleAuthor }
        : {}),
      ...(typeof page.answerContent?.visibleDate === 'boolean'
        ? { visibleDate: page.answerContent.visibleDate }
        : {}),
      ...(page.signalCoverage.answerContent === 'measured'
        ? { documentLanguageAssessed: true }
        : {}),
      ...(documentLanguage !== undefined ? { documentLanguage } : {}),
      ...(typeof page.answerContent?.documentLanguageValid === 'boolean'
        ? { documentLanguageValid: page.answerContent.documentLanguageValid }
        : {}),
    });
    const canonicalUrl = page.canonicalUrl ? normalizePageUrl(page.canonicalUrl) : undefined;
    addCanonicalAlias(canonicalUrl, normalizedUrl);
  }

  const rows: BingAiCitedPageAuditRow[] = [];
  const canonicalMatchedUrls = new Set<string>();
  for (const row of exportData.rows) {
    if (!row.url) continue;
    const normalizedUrl = normalizePageUrl(row.url);
    const exactIsAmbiguous = Boolean(normalizedUrl && ambiguousAuditUrls.has(normalizedUrl));
    const exactAudit =
      normalizedUrl && !exactIsAmbiguous ? auditPageMap.get(normalizedUrl) : undefined;
    const canonicalCandidates = normalizedUrl ? canonicalPages.get(normalizedUrl) : undefined;
    const canonicalCandidateUrl =
      canonicalCandidates?.size === 1 ? [...canonicalCandidates][0] : undefined;
    const candidateIsAmbiguous = Boolean(
      canonicalCandidateUrl && ambiguousAuditUrls.has(canonicalCandidateUrl)
    );
    const canonicalCandidate =
      canonicalCandidateUrl && !candidateIsAmbiguous
        ? auditPageMap.get(canonicalCandidateUrl)
        : undefined;
    const ambiguousAuditUrlMatch = !exactAudit && (exactIsAmbiguous || candidateIsAmbiguous);
    const ambiguousCanonicalMatch =
      !exactAudit && !ambiguousAuditUrlMatch && (canonicalCandidates?.size ?? 0) > 1;
    const currentAudit = exactAudit ?? canonicalCandidate;
    const auditMatchType = exactAudit
      ? 'exact-url'
      : canonicalCandidate
        ? 'canonical-url'
        : ambiguousAuditUrlMatch
          ? 'ambiguous-audit-url'
          : ambiguousCanonicalMatch
            ? 'ambiguous-canonical'
            : 'unmatched';
    if (auditMatchType === 'canonical-url' && normalizedUrl)
      canonicalMatchedUrls.add(normalizedUrl);
    rows.push({
      url: row.url,
      ...(row.query ? { query: row.query } : {}),
      ...(row.citations !== undefined ? { citations: row.citations } : {}),
      ...(row.citationShare !== undefined ? { citationShare: row.citationShare } : {}),
      ...(row.intent ? { intent: row.intent } : {}),
      ...(row.topic ? { topic: row.topic } : {}),
      auditMatchType,
      auditMatched: currentAudit !== undefined,
      ...(currentAudit
        ? { matchedAuditUrl: exactAudit ? normalizedUrl : canonicalCandidateUrl }
        : {}),
      geoAssessed: currentAudit?.geoAssessed ?? false,
      searchCrawlersAssessed: currentAudit?.searchCrawlersAssessed ?? false,
      blockedSearchCrawlers: currentAudit?.blocked.map(({ token }) => token) ?? [],
      blockedSearchCrawlerRules: currentAudit?.blocked ?? [],
      ...(currentAudit?.noindex !== undefined ? { currentNoindex: currentAudit.noindex } : {}),
      ...(currentAudit?.noSnippet !== undefined
        ? { currentNoSnippet: currentAudit.noSnippet }
        : {}),
      ...(currentAudit?.dataNoSnippetElements !== undefined
        ? { currentDataNoSnippetElements: currentAudit.dataNoSnippetElements }
        : {}),
      ...(currentAudit?.dataNoSnippetWords !== undefined
        ? { currentDataNoSnippetWords: currentAudit.dataNoSnippetWords }
        : {}),
      ...(currentAudit?.dataNoSnippetWordSharePercent !== undefined
        ? { currentDataNoSnippetWordSharePercent: currentAudit.dataNoSnippetWordSharePercent }
        : {}),
      ...(currentAudit?.bingbotNoindex !== undefined
        ? { currentBingbotNoindex: currentAudit.bingbotNoindex }
        : {}),
      ...(currentAudit?.bingbotAccessAssessed !== undefined
        ? { currentBingbotAccessAssessed: currentAudit.bingbotAccessAssessed }
        : {}),
      ...(currentAudit?.bingbotBlocked !== undefined
        ? { currentBingbotBlocked: currentAudit.bingbotBlocked }
        : {}),
      ...(currentAudit?.bingbotNoSnippet !== undefined
        ? { currentBingbotNoSnippet: currentAudit.bingbotNoSnippet }
        : {}),
      ...(currentAudit?.bingbotMaxSnippetZero !== undefined
        ? { currentBingbotMaxSnippetZero: currentAudit.bingbotMaxSnippetZero }
        : {}),
      ...(currentAudit?.questionHeadings !== undefined
        ? { currentQuestionHeadings: currentAudit.questionHeadings }
        : {}),
      ...(currentAudit?.conciseAnswerBlocks !== undefined
        ? { currentConciseAnswerBlocks: currentAudit.conciseAnswerBlocks }
        : {}),
      ...(currentAudit?.externalContentLinks !== undefined
        ? { currentExternalContentLinks: currentAudit.externalContentLinks }
        : {}),
      ...(currentAudit?.externalSourceLinks !== undefined
        ? { currentExternalSourceLinks: currentAudit.externalSourceLinks }
        : {}),
      ...(currentAudit?.referenceSectionLinks !== undefined
        ? { currentReferenceSectionLinks: currentAudit.referenceSectionLinks }
        : {}),
      ...(currentAudit?.visibleAuthor !== undefined
        ? { currentVisibleAuthor: currentAudit.visibleAuthor }
        : {}),
      ...(currentAudit?.visibleDate !== undefined
        ? { currentVisibleDate: currentAudit.visibleDate }
        : {}),
      ...(currentAudit?.documentLanguage !== undefined
        ? { currentDocumentLanguage: currentAudit.documentLanguage }
        : {}),
      ...(currentAudit?.documentLanguageValid !== undefined
        ? { currentDocumentLanguageValid: currentAudit.documentLanguageValid }
        : {}),
      ...(currentAudit?.documentLanguageAssessed !== undefined
        ? { currentDocumentLanguageAssessed: currentAudit.documentLanguageAssessed }
        : {}),
    });
  }
  const uniqueCitedUrls = new Set(
    rows.map(({ url }) => normalizePageUrl(url)).filter((url): url is string => Boolean(url))
  );
  const matchedUrls = new Set(
    rows.flatMap((row) =>
      row.auditMatched
        ? [normalizePageUrl(row.url)].filter((url): url is string => Boolean(url))
        : []
    )
  );
  const ambiguousUrls = new Set(
    rows.flatMap((row) =>
      row.auditMatchType === 'ambiguous-canonical'
        ? [normalizePageUrl(row.url)].filter((url): url is string => Boolean(url))
        : []
    )
  );
  const ambiguousAuditUrlReport = new Set(
    rows.flatMap((row) =>
      row.auditMatchType === 'ambiguous-audit-url'
        ? [normalizePageUrl(row.url)].filter((url): url is string => Boolean(url))
        : []
    )
  );
  const auditUrlByCitedUrl = new Map(
    rows.flatMap((row) => {
      const citedUrl = normalizePageUrl(row.url);
      const auditUrl = row.matchedAuditUrl ? normalizePageUrl(row.matchedAuditUrl) : undefined;
      return citedUrl && auditUrl ? [[citedUrl, auditUrl] as const] : [];
    })
  );
  const uniqueMatchedRows = [...matchedUrls]
    .map((url) => ({ url, audit: auditPageMap.get(auditUrlByCitedUrl.get(url) ?? url) }))
    .filter(({ audit }) => Boolean(audit));
  const controlClassifiers: Array<{
    control: BingAiAuditControlObservation['control'];
    state: (row: BingAiCitedPageAuditRow) => BingAiAuditControlObservation['state'];
  }> = [
    {
      control: 'bingbot-robots-access',
      state: (row) =>
        row.currentBingbotBlocked === true ||
        row.blockedSearchCrawlers.some((token) => token.toLowerCase() === 'bingbot')
          ? 'present'
          : row.currentBingbotAccessAssessed === true
            ? 'absent'
            : 'not-assessed',
    },
    {
      control: 'bingbot-noindex',
      state: (row) =>
        row.currentBingbotNoindex === undefined
          ? 'not-assessed'
          : row.currentBingbotNoindex
            ? 'present'
            : 'absent',
    },
    {
      control: 'bingbot-snippet-restriction',
      state: (row) =>
        row.currentBingbotNoSnippet === true || row.currentBingbotMaxSnippetZero === true
          ? 'present'
          : row.currentBingbotNoSnippet === false && row.currentBingbotMaxSnippetZero === false
            ? 'absent'
            : 'not-assessed',
    },
    {
      control: 'data-nosnippet',
      state: (row) =>
        row.currentDataNoSnippetElements === undefined
          ? 'not-assessed'
          : row.currentDataNoSnippetElements > 0
            ? 'present'
            : 'absent',
    },
  ];
  const controlObservations = new Map<
    string,
    { pages: Set<string>; exportRows: number; rowsWithCitationMetric: number; citations: number }
  >();
  for (const row of rows) {
    if (!row.auditMatched) continue;
    const pageKey = normalizePageUrl(row.matchedAuditUrl ?? row.url) ?? row.url.trim();
    for (const classifier of controlClassifiers) {
      const state = classifier.state(row);
      const key = `${classifier.control}:${state}`;
      const bucket = controlObservations.get(key) ?? {
        pages: new Set<string>(),
        exportRows: 0,
        rowsWithCitationMetric: 0,
        citations: 0,
      };
      bucket.pages.add(pageKey);
      bucket.exportRows += 1;
      if (row.citations !== undefined) {
        bucket.rowsWithCitationMetric += 1;
        bucket.citations += row.citations;
      }
      controlObservations.set(key, bucket);
    }
  }
  const currentControlObservations = controlClassifiers.flatMap(({ control }) =>
    (['present', 'absent', 'not-assessed'] as const).map((state): BingAiAuditControlObservation => {
      const bucket = controlObservations.get(`${control}:${state}`);
      return {
        control,
        state,
        matchedPages: bucket?.pages.size ?? 0,
        exportRows: bucket?.exportRows ?? 0,
        rowsWithCitationMetric: bucket?.rowsWithCitationMetric ?? 0,
        ...(bucket && bucket.rowsWithCitationMetric > 0
          ? { rowSummedCitations: bucket.citations }
          : {}),
      };
    })
  );
  const contentClassifiers: Array<{
    signal: BingAiAuditContentObservation['signal'];
    state: (row: BingAiCitedPageAuditRow) => BingAiAuditContentObservation['state'];
  }> = [
    {
      signal: 'question-headings',
      state: (row) =>
        row.currentQuestionHeadings === undefined
          ? 'not-assessed'
          : row.currentQuestionHeadings > 0
            ? 'present'
            : 'absent',
    },
    {
      signal: 'concise-answer-blocks',
      state: (row) =>
        row.currentConciseAnswerBlocks === undefined
          ? 'not-assessed'
          : row.currentConciseAnswerBlocks > 0
            ? 'present'
            : 'absent',
    },
    {
      signal: 'external-content-links',
      state: (row) =>
        row.currentExternalContentLinks === undefined
          ? 'not-assessed'
          : row.currentExternalContentLinks > 0
            ? 'present'
            : 'absent',
    },
    {
      signal: 'external-source-links',
      state: (row) =>
        row.currentExternalSourceLinks === undefined
          ? 'not-assessed'
          : row.currentExternalSourceLinks > 0
            ? 'present'
            : 'absent',
    },
    {
      signal: 'reference-section-links',
      state: (row) =>
        row.currentReferenceSectionLinks === undefined
          ? 'not-assessed'
          : row.currentReferenceSectionLinks > 0
            ? 'present'
            : 'absent',
    },
    {
      signal: 'visible-author',
      state: (row) =>
        row.currentVisibleAuthor === undefined
          ? 'not-assessed'
          : row.currentVisibleAuthor
            ? 'present'
            : 'absent',
    },
    {
      signal: 'visible-date',
      state: (row) =>
        row.currentVisibleDate === undefined
          ? 'not-assessed'
          : row.currentVisibleDate
            ? 'present'
            : 'absent',
    },
  ];
  const contentObservations = new Map<
    string,
    { pages: Set<string>; exportRows: number; rowsWithCitationMetric: number; citations: number }
  >();
  for (const row of rows) {
    if (!row.auditMatched) continue;
    const pageKey = normalizePageUrl(row.matchedAuditUrl ?? row.url) ?? row.url.trim();
    for (const classifier of contentClassifiers) {
      const state = classifier.state(row);
      const key = `${classifier.signal}:${state}`;
      const bucket = contentObservations.get(key) ?? {
        pages: new Set<string>(),
        exportRows: 0,
        rowsWithCitationMetric: 0,
        citations: 0,
      };
      bucket.pages.add(pageKey);
      bucket.exportRows += 1;
      if (row.citations !== undefined) {
        bucket.rowsWithCitationMetric += 1;
        bucket.citations += row.citations;
      }
      contentObservations.set(key, bucket);
    }
  }
  const currentContentObservations = contentClassifiers.flatMap(({ signal }) =>
    (['present', 'absent', 'not-assessed'] as const).map((state): BingAiAuditContentObservation => {
      const bucket = contentObservations.get(`${signal}:${state}`);
      return {
        signal,
        state,
        matchedPages: bucket?.pages.size ?? 0,
        exportRows: bucket?.exportRows ?? 0,
        rowsWithCitationMetric: bucket?.rowsWithCitationMetric ?? 0,
        ...(bucket && bucket.rowsWithCitationMetric > 0
          ? { rowSummedCitations: bucket.citations }
          : {}),
      };
    })
  );

  return {
    ...(exportData.sourceFile ? { sourceFile: exportData.sourceFile } : {}),
    auditPagesCompared: auditPageMap.size + ambiguousAuditUrls.size,
    citationRows: rows.length,
    uniqueCitedPages: uniqueCitedUrls.size,
    citedPagesMatchedToAudit: matchedUrls.size,
    citedPagesMatchedByCanonical: canonicalMatchedUrls.size,
    citedPagesWithAmbiguousAuditUrlMatch: ambiguousAuditUrlReport.size,
    citedPagesWithAmbiguousCanonicalMatch: ambiguousUrls.size,
    citedPagesNotInAudit:
      uniqueCitedUrls.size - matchedUrls.size - ambiguousUrls.size - ambiguousAuditUrlReport.size,
    matchedPagesWithGeoResults: uniqueMatchedRows.filter(({ audit }) => audit?.geoAssessed).length,
    matchedPagesWithCurrentCrawlerBlocks: uniqueMatchedRows.filter(
      ({ audit }) => (audit?.blocked.length ?? 0) > 0
    ).length,
    matchedPagesWithCurrentNoindex: uniqueMatchedRows.filter(({ audit }) => audit?.noindex === true)
      .length,
    matchedPagesWithCurrentNoSnippet: uniqueMatchedRows.filter(
      ({ audit }) => audit?.noSnippet === true
    ).length,
    matchedPagesWithCurrentDataNoSnippet: uniqueMatchedRows.filter(
      ({ audit }) => (audit?.dataNoSnippetElements ?? 0) > 0
    ).length,
    matchedPagesWithCurrentBingbotNoindex: uniqueMatchedRows.filter(
      ({ audit }) => audit?.bingbotNoindex === true
    ).length,
    matchedPagesWithCurrentBingbotNoSnippet: uniqueMatchedRows.filter(
      ({ audit }) => audit?.bingbotNoSnippet === true
    ).length,
    matchedPagesWithCurrentBingbotMaxSnippetZero: uniqueMatchedRows.filter(
      ({ audit }) => audit?.bingbotMaxSnippetZero === true
    ).length,
    currentControlObservations,
    currentContentObservations,
    note: 'Bing rows summarize sampled citation activity for the export date range. Exact URLs are matched first; a unique audited canonical URL can match as an alias. Ambiguous canonical targets and duplicate normalized audit URLs are left unmatched. currentControlObservations and currentContentObservations group matched export rows by present-day audit signals; groups overlap, and the audit may postdate the report period. Content structures are descriptive counts and do not establish citation eligibility or causation. Citation row sums include only rows with a numeric citation metric and are not property totals.',
    rows,
  };
}
