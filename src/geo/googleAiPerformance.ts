import type { SEOAuditBatchReport, SEOReport } from '../types';
import type { SiteWideGeoAnalysis } from '../sitewide';

export type GoogleAiPerformanceDatasetKind =
  'page' | 'country' | 'device' | 'date' | 'multi-dimension' | 'overview';
export type GoogleAiPerformanceSurface = 'search' | 'discover';

export interface GoogleAiPerformanceRow {
  url?: string;
  country?: string;
  device?: string;
  date?: string;
  impressions: number;
}

export interface GoogleAiPerformanceExport {
  sourceFile?: string;
  surface: GoogleAiPerformanceSurface;
  datasetKind: GoogleAiPerformanceDatasetKind;
  dimensions: Array<'url' | 'country' | 'device' | 'date'>;
  headerRow: number;
  rowCount: number;
  skippedRows: number;
  uniquePageCount: number;
  columns: Partial<Record<keyof GoogleAiPerformanceRow, string>>;
  rows: GoogleAiPerformanceRow[];
}

export interface GoogleAiPerformanceDimensionSummary {
  value: string;
  rows: number;
  impressions: number;
}

export interface GoogleAiPerformanceSummary {
  sourceFile?: string;
  surface: GoogleAiPerformanceSurface;
  datasetKind: GoogleAiPerformanceDatasetKind;
  dimensions: Array<'url' | 'country' | 'device' | 'date'>;
  rowCount: number;
  uniquePageCount: number;
  rowSummedImpressions: number;
  topPages: GoogleAiPerformanceDimensionSummary[];
  topCountries: GoogleAiPerformanceDimensionSummary[];
  topDevices: GoogleAiPerformanceDimensionSummary[];
  timeSeries: GoogleAiPerformanceDimensionSummary[];
  note: string;
}

export interface GoogleAiVisibilityPageChange {
  url: string;
  baselineImpressions?: number;
  currentImpressions?: number;
  impressionsChange?: number;
  percentChange?: number;
  state: 'current-only' | 'baseline-only' | 'increased' | 'decreased' | 'unchanged';
}

export interface GoogleAiVisibilityComparison {
  baselineSourceFile?: string;
  currentSourceFile?: string;
  pagesCompared: number;
  pagesOnlyInCurrentExport: number;
  pagesOnlyInBaselineExport: number;
  baselinePagesInExport: number;
  currentPagesInExport: number;
  baselinePageImpressionsInExport: number;
  currentPageImpressionsInExport: number;
  matchedBaselinePageImpressions: number;
  matchedCurrentPageImpressions: number;
  matchedPageImpressionChange: number;
  matchedPagePercentChange?: number;
  pagesWithIncreasedImpressions: number;
  pagesWithDecreasedImpressions: number;
  unchangedPages: number;
  topGains: GoogleAiVisibilityPageChange[];
  topLosses: GoogleAiVisibilityPageChange[];
  changes: GoogleAiVisibilityPageChange[];
  changesTruncated: boolean;
  note: string;
}

export type GoogleAiPerformanceDimension = 'url' | 'country' | 'device' | 'date';

export interface GoogleAiDimensionChange {
  values: Partial<Record<GoogleAiPerformanceDimension, string>>;
  state: 'current-only' | 'baseline-only' | 'increased' | 'decreased' | 'unchanged';
  baselineImpressions?: number;
  currentImpressions?: number;
  impressionsChange?: number;
  percentChange?: number;
  baselineImpressionSharePercent?: number;
  currentImpressionSharePercent?: number;
  impressionShareChangePercentagePoints?: number;
}

export interface GoogleAiDimensionComparison {
  baselineSourceFile?: string;
  currentSourceFile?: string;
  surface: GoogleAiPerformanceSurface;
  dimensions: GoogleAiPerformanceDimension[];
  baselineCohortsInExport: number;
  currentCohortsInExport: number;
  cohortsCompared: number;
  cohortsOnlyInCurrentExport: number;
  cohortsOnlyInBaselineExport: number;
  baselineImpressionsInExport: number;
  currentImpressionsInExport: number;
  matchedBaselineImpressions: number;
  matchedCurrentImpressions: number;
  matchedImpressionChange: number;
  matchedImpressionPercentChange?: number;
  cohortsWithIncreasedImpressions: number;
  cohortsWithDecreasedImpressions: number;
  unchangedCohorts: number;
  cohortsWithComparableShareMovement: number;
  cohortsWithIncreasingShare: number;
  cohortsWithDecreasingShare: number;
  meanCohortShareChangePercentagePoints?: number;
  changes: GoogleAiDimensionChange[];
  changesTruncated: boolean;
  note: string;
}

export interface GoogleAiCitedPageAuditRow extends GoogleAiPerformanceRow {
  auditMatchType:
    | 'exact-url'
    | 'canonical-url'
    | 'ambiguous-audit-url'
    | 'ambiguous-canonical'
    | 'unmatched'
    | 'not-applicable';
  auditMatched: boolean;
  matchedAuditUrl?: string;
  geoAssessed: boolean;
  googlebotAccessAssessed: boolean;
  currentGooglebotBlocked?: boolean;
  currentGooglebotRule?: { directive: 'allow' | 'disallow'; pattern: string; line: number };
  currentGooglebotNoindex?: boolean;
  currentGooglebotNoSnippet?: boolean;
  currentGooglebotMaxSnippetZero?: boolean;
  currentDataNoSnippetElements?: number;
  currentDataNoSnippetWords?: number;
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

export interface GoogleAiAuditControlObservation {
  control:
    | 'googlebot-robots-access'
    | 'googlebot-noindex'
    | 'googlebot-snippet-restriction'
    | 'data-nosnippet';
  state: 'present' | 'absent' | 'not-assessed';
  matchedPages: number;
  exportRows: number;
  rowSummedImpressions: number;
}

export interface GoogleAiAuditContentObservation {
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
  rowSummedImpressions: number;
}

export interface GoogleAiAuditCorrelation {
  sourceFile?: string;
  auditPagesCompared: number;
  uniqueReportPages: number;
  pagesMatchedToAudit: number;
  pagesMatchedByCanonical: number;
  pagesWithAmbiguousAuditUrlMatch: number;
  pagesWithAmbiguousCanonicalMatch: number;
  pagesNotInAudit: number;
  matchedPagesWithCurrentGooglebotBlocks: number;
  matchedPagesWithCurrentGooglebotNoindex: number;
  matchedPagesWithCurrentGooglebotSnippetRestrictions: number;
  matchedPagesWithCurrentDataNoSnippet: number;
  currentControlObservations: GoogleAiAuditControlObservation[];
  currentContentObservations: GoogleAiAuditContentObservation[];
  note: string;
  rows: GoogleAiCitedPageAuditRow[];
}

export interface GoogleAiPerformanceCsvOptions {
  /** Override a detected column with its exact source header, useful for localized exports. */
  columns?: Partial<Record<keyof GoogleAiPerformanceRow, string>>;
  sourceFile?: string;
  surface?: GoogleAiPerformanceSurface;
  maxBytes?: number;
  maxRows?: number;
}

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_ROWS = 100_000;

const HEADER_ALIASES: Record<keyof GoogleAiPerformanceRow, string[]> = {
  url: [
    'page',
    'pages',
    'page url',
    'url',
    'seite',
    'seiten',
    'página',
    'páginas',
    'pagina',
    'pagine',
    'sayfa',
    'sayfalar',
  ],
  country: [
    'country',
    'countries',
    'land',
    'länder',
    'lander',
    'país',
    'países',
    'pais',
    'paesi',
    'paese',
    'pays',
    'ülke',
    'ulke',
  ],
  device: [
    'device',
    'devices',
    'gerät',
    'geraet',
    'geräte',
    'geraete',
    'appareil',
    'appareils',
    'dispositivo',
    'dispositivos',
    'dispositivi',
    'cihaz',
    'cihaz türü',
    'cihaz turu',
  ],
  date: ['date', 'dates', 'day', 'week', 'month', 'datum', 'fecha', 'data', 'period', 'tarih'],
  impressions: [
    'impression',
    'impressions',
    'impression count',
    'visibilités',
    'impressionen',
    'impresiones',
    'impressioni',
    'impressões',
    'gösterimler',
    'gosterimler',
    'visningar',
  ],
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
  overrides: GoogleAiPerformanceCsvOptions['columns']
): Partial<Record<keyof GoogleAiPerformanceRow, number>> {
  const columns: Partial<Record<keyof GoogleAiPerformanceRow, number>> = {};
  for (const key of Object.keys(HEADER_ALIASES) as Array<keyof GoogleAiPerformanceRow>) {
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

function parseImpressions(value: string | undefined): number | undefined {
  if (value === undefined || !value.trim()) return undefined;
  const trimmed = value.trim();
  // Search Console exports use a dash or tilde for zero / unavailable display cells.
  if (/^(?:~|[-–—])$/.test(trimmed)) return 0;
  let normalized = trimmed.replace(/[\s\u00a0]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized =
      normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
        ? normalized.replace(/\./g, '').replace(',', '.')
        : normalized.replace(/,/g, '');
  } else if (normalized.includes(',')) {
    normalized = /^\d{1,3}(?:,\d{3})+$/.test(normalized)
      ? normalized.replace(/,/g, '')
      : normalized.replace(',', '.');
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '');
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
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

/** Parse a local CSV export from Search Console's Search Generative AI performance report. */
export function parseGoogleAiPerformanceCsvExport(
  source: string,
  options: GoogleAiPerformanceCsvOptions = {}
): GoogleAiPerformanceExport {
  const surface = options.surface ?? 'search';
  if (surface !== 'search' && surface !== 'discover')
    throw new Error('surface must be search or discover.');
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
  let indexes: Partial<Record<keyof GoogleAiPerformanceRow, number>> = {};
  for (let candidate = 0; candidate < Math.min(20, records.length - 1); candidate += 1) {
    const candidateIndexes = detectColumns(records[candidate] ?? [], options.columns);
    const hasDimension =
      candidateIndexes.url !== undefined ||
      candidateIndexes.country !== undefined ||
      candidateIndexes.device !== undefined ||
      candidateIndexes.date !== undefined;
    if (
      candidateIndexes.impressions !== undefined &&
      (hasDimension || (records[candidate]?.length ?? 0) === 1)
    ) {
      headerIndex = candidate;
      indexes = candidateIndexes;
      break;
    }
  }
  if (headerIndex < 0) {
    throw new Error(
      'Could not identify a Search Console generative AI report header. Expected an Impressions column and a Page, Country, Device, or Date dimension.'
    );
  }

  const headers = records[headerIndex] ?? [];
  const detectedColumns: Partial<Record<keyof GoogleAiPerformanceRow, string>> = {};
  for (const key of Object.keys(indexes) as Array<keyof GoogleAiPerformanceRow>) {
    const name = headers[indexes[key] ?? -1];
    if (name) detectedColumns[key] = name.trim();
  }
  const dimensions = (['url', 'country', 'device', 'date'] as const).filter(
    (key) => indexes[key] !== undefined
  );
  if (surface === 'discover' && dimensions.includes('device')) {
    throw new Error(
      'The Search Console generative AI Discover report does not provide a device dimension.'
    );
  }
  const datasetKind: GoogleAiPerformanceDatasetKind =
    dimensions.length > 1
      ? 'multi-dimension'
      : dimensions[0] === 'url'
        ? 'page'
        : dimensions[0] === 'country'
          ? 'country'
          : dimensions[0] === 'device'
            ? 'device'
            : dimensions[0] === 'date'
              ? 'date'
              : 'overview';
  const cell = (record: string[], key: keyof GoogleAiPerformanceRow): string | undefined => {
    const index = indexes[key];
    const value = index === undefined ? undefined : record[index]?.trim();
    return value || undefined;
  };
  const rows: GoogleAiPerformanceRow[] = [];
  let skippedRows = 0;
  for (const record of records.slice(headerIndex + 1)) {
    const impressions = parseImpressions(cell(record, 'impressions'));
    if (impressions === undefined) {
      skippedRows += 1;
      continue;
    }
    const row: GoogleAiPerformanceRow = { impressions };
    const url = cell(record, 'url');
    const country = cell(record, 'country');
    const device = cell(record, 'device');
    const date = cell(record, 'date');
    if (url) row.url = url;
    if (country) row.country = country;
    if (device) row.device = device;
    if (date) row.date = date;
    rows.push(row);
    if (rows.length > maxRows)
      throw new Error(`CSV contains more than ${maxRows.toLocaleString()} valid data rows.`);
  }
  if (rows.length === 0)
    throw new Error('CSV header was recognized, but no rows contained a valid impression value.');
  return {
    ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
    surface,
    datasetKind,
    dimensions,
    headerRow: headerIndex + 1,
    rowCount: rows.length,
    skippedRows,
    uniquePageCount: new Set(
      rows.flatMap(({ url }) => (url ? [normalizePageUrl(url) ?? url.trim()] : []))
    ).size,
    columns: detectedColumns,
    rows,
  };
}

/** Summarize one Search Console export view without combining potentially overlapping dimensions. */
export function summarizeGoogleAiPerformanceExport(
  exportData: GoogleAiPerformanceExport
): GoogleAiPerformanceSummary {
  const groupDimension = (
    dimension: 'url' | 'country' | 'device' | 'date'
  ): GoogleAiPerformanceDimensionSummary[] => {
    const groups = new Map<string, GoogleAiPerformanceDimensionSummary>();
    for (const row of exportData.rows) {
      const raw = row[dimension]?.trim();
      if (!raw) continue;
      const label = dimension === 'url' ? (normalizePageUrl(raw) ?? raw) : raw.replace(/\s+/g, ' ');
      const key = dimension === 'url' ? label : label.toLowerCase();
      const summary = groups.get(key) ?? { value: label, rows: 0, impressions: 0 };
      summary.rows += 1;
      summary.impressions += row.impressions;
      groups.set(key, summary);
    }
    return [...groups.values()]
      .sort(
        (left, right) =>
          right.impressions - left.impressions || left.value.localeCompare(right.value)
      )
      .slice(0, 100);
  };
  const timeSeries = groupDimension('date').sort((left, right) => {
    const leftTime = Date.parse(left.value);
    const rightTime = Date.parse(right.value);
    return Number.isFinite(leftTime) && Number.isFinite(rightTime)
      ? leftTime - rightTime
      : left.value.localeCompare(right.value);
  });
  return {
    ...(exportData.sourceFile ? { sourceFile: exportData.sourceFile } : {}),
    surface: exportData.surface,
    datasetKind: exportData.datasetKind,
    dimensions: exportData.dimensions,
    rowCount: exportData.rowCount,
    uniquePageCount: exportData.uniquePageCount,
    rowSummedImpressions: exportData.rows.reduce((sum, row) => sum + row.impressions, 0),
    topPages: groupDimension('url'),
    topCountries: groupDimension('country'),
    topDevices: groupDimension('device'),
    timeSeries,
    note:
      exportData.surface === 'search'
        ? 'Impressions are reported observations from Search Console’s Search generative AI report (AI Overviews and AI Mode). rowSummedImpressions sums only rows in this export; page, country, device, and date views use different aggregation scopes and must not be added together. Search Console table exports are limited to 1,000 rows. The report does not expose grounding queries or clicks.'
        : 'Impressions are reported observations from Search Console’s generative AI report for Discover. rowSummedImpressions sums only rows in this export; use the report’s canonical page dimension and do not add this data to Google Search report views. Search Console table exports are limited to 1,000 rows. The report does not expose grounding queries or clicks.',
  };
}

/** Compare page impressions only where both capped Search Console page exports contain a URL. */
export function compareGoogleAiPerformanceExports(
  current: GoogleAiPerformanceExport,
  baseline: GoogleAiPerformanceExport
): GoogleAiVisibilityComparison {
  const isPageExport = (value: GoogleAiPerformanceExport): boolean =>
    value.dimensions.length === 1 && value.dimensions[0] === 'url';
  if (!isPageExport(current) || !isPageExport(baseline)) {
    throw new Error(
      'Google AI visibility comparisons require page-dimension exports for both periods.'
    );
  }
  if (current.surface !== baseline.surface)
    throw new Error('Google AI visibility comparisons cannot mix Search and Discover exports.');
  const groupedImpressions = (value: GoogleAiPerformanceExport): Map<string, number> => {
    const pages = new Map<string, number>();
    for (const row of value.rows) {
      if (!row.url) continue;
      const url = normalizePageUrl(row.url) ?? row.url.trim();
      pages.set(url, (pages.get(url) ?? 0) + row.impressions);
    }
    return pages;
  };
  const currentPages = groupedImpressions(current);
  const baselinePages = groupedImpressions(baseline);
  const changes = [...new Set([...currentPages.keys(), ...baselinePages.keys()])]
    .map((url): GoogleAiVisibilityPageChange => {
      const before = baselinePages.get(url);
      const after = currentPages.get(url);
      if (before === undefined) return { url, currentImpressions: after, state: 'current-only' };
      if (after === undefined) return { url, baselineImpressions: before, state: 'baseline-only' };
      const impressionsChange = after - before;
      return {
        url,
        baselineImpressions: before,
        currentImpressions: after,
        impressionsChange,
        ...(before > 0 ? { percentChange: (impressionsChange / before) * 100 } : {}),
        state:
          impressionsChange > 0 ? 'increased' : impressionsChange < 0 ? 'decreased' : 'unchanged',
      };
    })
    .sort((left, right) => {
      const leftHasDelta = left.impressionsChange !== undefined;
      const rightHasDelta = right.impressionsChange !== undefined;
      if (leftHasDelta !== rightHasDelta) return leftHasDelta ? -1 : 1;
      return (
        Math.abs(right.impressionsChange ?? 0) - Math.abs(left.impressionsChange ?? 0) ||
        left.url.localeCompare(right.url)
      );
    });
  const sharedChanges = changes.filter(({ impressionsChange }) => impressionsChange !== undefined);
  const matchedBaselinePageImpressions = sharedChanges.reduce(
    (sum, change) => sum + (change.baselineImpressions ?? 0),
    0
  );
  const matchedCurrentPageImpressions = sharedChanges.reduce(
    (sum, change) => sum + (change.currentImpressions ?? 0),
    0
  );
  const matchedPageImpressionChange =
    matchedCurrentPageImpressions - matchedBaselinePageImpressions;
  return {
    ...(baseline.sourceFile ? { baselineSourceFile: baseline.sourceFile } : {}),
    ...(current.sourceFile ? { currentSourceFile: current.sourceFile } : {}),
    pagesCompared: sharedChanges.length,
    pagesOnlyInCurrentExport: changes.filter(({ state }) => state === 'current-only').length,
    pagesOnlyInBaselineExport: changes.filter(({ state }) => state === 'baseline-only').length,
    baselinePagesInExport: baselinePages.size,
    currentPagesInExport: currentPages.size,
    baselinePageImpressionsInExport: [...baselinePages.values()].reduce(
      (sum, value) => sum + value,
      0
    ),
    currentPageImpressionsInExport: [...currentPages.values()].reduce(
      (sum, value) => sum + value,
      0
    ),
    matchedBaselinePageImpressions,
    matchedCurrentPageImpressions,
    matchedPageImpressionChange,
    ...(matchedBaselinePageImpressions > 0
      ? {
          matchedPagePercentChange:
            (matchedPageImpressionChange / matchedBaselinePageImpressions) * 100,
        }
      : {}),
    pagesWithIncreasedImpressions: sharedChanges.filter(({ state }) => state === 'increased')
      .length,
    pagesWithDecreasedImpressions: sharedChanges.filter(({ state }) => state === 'decreased')
      .length,
    unchangedPages: sharedChanges.filter(({ state }) => state === 'unchanged').length,
    topGains: sharedChanges
      .filter(({ impressionsChange }) => impressionsChange !== undefined && impressionsChange > 0)
      .slice(0, 20),
    topLosses: sharedChanges
      .filter(({ impressionsChange }) => impressionsChange !== undefined && impressionsChange < 0)
      .slice(0, 20),
    changes: changes.slice(0, 1_000),
    changesTruncated: changes.length > 1_000,
    note: 'This comparison assumes both page exports use the same Search Console property, surface, filters, and other settings and differ only in the intended date range. Search Console page tables are limited to 1,000 rows, so a URL present in only one export is marked export-only and its missing-period impressions are unknown; the difference between row sums is not a property total. Matched-page impression changes are observations, not ranking causes or citation counts.',
  };
}

/** Compare same-surface Google AI export cohorts with exactly matching dimension sets. */
export function compareGoogleAiDimensionExports(
  current: GoogleAiPerformanceExport,
  baseline: GoogleAiPerformanceExport
): GoogleAiDimensionComparison {
  if (current.surface !== baseline.surface) {
    throw new Error('Google AI dimension comparisons cannot mix Search and Discover exports.');
  }
  const dimensions = (['url', 'country', 'device', 'date'] as const).filter((dimension) =>
    current.dimensions.includes(dimension)
  );
  const baselineDimensions = (['url', 'country', 'device', 'date'] as const).filter((dimension) =>
    baseline.dimensions.includes(dimension)
  );
  if (
    dimensions.length !== baselineDimensions.length ||
    dimensions.some((dimension, index) => dimension !== baselineDimensions[index])
  ) {
    throw new Error('Google AI dimension comparisons require the same dimensions in both exports.');
  }

  type Cohort = {
    values: Partial<Record<GoogleAiPerformanceDimension, string>>;
    impressions: number;
  };
  const groupCohorts = (value: GoogleAiPerformanceExport): Map<string, Cohort> => {
    const cohorts = new Map<string, Cohort>();
    for (const row of value.rows) {
      const values: Partial<Record<GoogleAiPerformanceDimension, string>> = {};
      const key = dimensions.map((dimension) => {
        const raw = row[dimension]?.trim() ?? '';
        values[dimension] = raw;
        if (dimension === 'url') return normalizePageUrl(raw) ?? raw;
        return raw.replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
      });
      const serializedKey = JSON.stringify(key);
      const cohort = cohorts.get(serializedKey) ?? { values, impressions: 0 };
      cohort.impressions += row.impressions;
      cohorts.set(serializedKey, cohort);
    }
    return cohorts;
  };
  const currentCohorts = groupCohorts(current);
  const baselineCohorts = groupCohorts(baseline);
  const currentExportImpressions = [...currentCohorts.values()].reduce(
    (sum, cohort) => sum + cohort.impressions,
    0
  );
  const baselineExportImpressions = [...baselineCohorts.values()].reduce(
    (sum, cohort) => sum + cohort.impressions,
    0
  );
  const changes = [...new Set([...currentCohorts.keys(), ...baselineCohorts.keys()])]
    .map((key): GoogleAiDimensionChange => {
      const before = baselineCohorts.get(key);
      const after = currentCohorts.get(key);
      const values = after?.values ?? before?.values ?? {};
      const baselineImpressionSharePercent =
        before && baselineExportImpressions > 0
          ? Number(((before.impressions / baselineExportImpressions) * 100).toFixed(2))
          : undefined;
      const currentImpressionSharePercent =
        after && currentExportImpressions > 0
          ? Number(((after.impressions / currentExportImpressions) * 100).toFixed(2))
          : undefined;
      const shareFields = {
        ...(baselineImpressionSharePercent !== undefined ? { baselineImpressionSharePercent } : {}),
        ...(currentImpressionSharePercent !== undefined ? { currentImpressionSharePercent } : {}),
        ...(baselineImpressionSharePercent !== undefined &&
        currentImpressionSharePercent !== undefined
          ? {
              impressionShareChangePercentagePoints: Number(
                (currentImpressionSharePercent - baselineImpressionSharePercent).toFixed(2)
              ),
            }
          : {}),
      };
      if (!before)
        return {
          values,
          currentImpressions: after?.impressions,
          ...shareFields,
          state: 'current-only',
        };
      if (!after)
        return {
          values,
          baselineImpressions: before.impressions,
          ...shareFields,
          state: 'baseline-only',
        };
      const impressionsChange = after.impressions - before.impressions;
      return {
        values,
        baselineImpressions: before.impressions,
        currentImpressions: after.impressions,
        impressionsChange,
        ...(before.impressions > 0
          ? { percentChange: (impressionsChange / before.impressions) * 100 }
          : {}),
        ...shareFields,
        state:
          impressionsChange > 0 ? 'increased' : impressionsChange < 0 ? 'decreased' : 'unchanged',
      };
    })
    .sort((left, right) => {
      const leftComparable = left.impressionsChange !== undefined;
      const rightComparable = right.impressionsChange !== undefined;
      if (leftComparable !== rightComparable) return leftComparable ? -1 : 1;
      const deltaOrder =
        Math.abs(right.impressionsChange ?? 0) - Math.abs(left.impressionsChange ?? 0);
      return deltaOrder || JSON.stringify(left.values).localeCompare(JSON.stringify(right.values));
    });
  const shared = changes.filter(({ impressionsChange }) => impressionsChange !== undefined);
  const matchedBaselineImpressions = shared.reduce(
    (sum, change) => sum + (change.baselineImpressions ?? 0),
    0
  );
  const matchedCurrentImpressions = shared.reduce(
    (sum, change) => sum + (change.currentImpressions ?? 0),
    0
  );
  const matchedImpressionChange = matchedCurrentImpressions - matchedBaselineImpressions;
  const sharedWithShareChange = shared.filter(
    ({ impressionShareChangePercentagePoints }) =>
      impressionShareChangePercentagePoints !== undefined
  );
  return {
    ...(baseline.sourceFile ? { baselineSourceFile: baseline.sourceFile } : {}),
    ...(current.sourceFile ? { currentSourceFile: current.sourceFile } : {}),
    surface: current.surface,
    dimensions,
    baselineCohortsInExport: baselineCohorts.size,
    currentCohortsInExport: currentCohorts.size,
    cohortsCompared: shared.length,
    cohortsOnlyInCurrentExport: changes.filter(({ state }) => state === 'current-only').length,
    cohortsOnlyInBaselineExport: changes.filter(({ state }) => state === 'baseline-only').length,
    baselineImpressionsInExport: baselineExportImpressions,
    currentImpressionsInExport: currentExportImpressions,
    matchedBaselineImpressions,
    matchedCurrentImpressions,
    matchedImpressionChange,
    ...(matchedBaselineImpressions > 0
      ? {
          matchedImpressionPercentChange:
            (matchedImpressionChange / matchedBaselineImpressions) * 100,
        }
      : {}),
    cohortsWithIncreasedImpressions: shared.filter(({ state }) => state === 'increased').length,
    cohortsWithDecreasedImpressions: shared.filter(({ state }) => state === 'decreased').length,
    unchangedCohorts: shared.filter(({ state }) => state === 'unchanged').length,
    cohortsWithComparableShareMovement: sharedWithShareChange.length,
    cohortsWithIncreasingShare: sharedWithShareChange.filter(
      ({ impressionShareChangePercentagePoints }) =>
        (impressionShareChangePercentagePoints ?? 0) > 0
    ).length,
    cohortsWithDecreasingShare: sharedWithShareChange.filter(
      ({ impressionShareChangePercentagePoints }) =>
        (impressionShareChangePercentagePoints ?? 0) < 0
    ).length,
    ...(sharedWithShareChange.length > 0
      ? {
          meanCohortShareChangePercentagePoints:
            sharedWithShareChange.reduce(
              (sum, change) => sum + (change.impressionShareChangePercentagePoints ?? 0),
              0
            ) / sharedWithShareChange.length,
        }
      : {}),
    changes: changes.slice(0, 1_000),
    changesTruncated: changes.length > 1_000,
    note: 'This exact-dimension comparison assumes the same Search Console property, surface, filters, and export settings apart from the intended period. It only compares identical country, device, date, and/or page cohorts; missing capped rows remain unknown, not zero. Each cohort share uses that period’s full export row sum; the mean percentage-point movement gives each shared cohort equal weight. Cohort row sums are sampled observations, not property totals, clicks, citations, or causal explanations.',
  };
}

/** Correlate Search Console page impressions with the current Googlebot and preview-control snapshot. */
export function correlateGoogleAiPerformanceWithAudit(
  exportData: GoogleAiPerformanceExport,
  audit: SEOReport | SEOAuditBatchReport | SiteWideGeoAnalysis
): GoogleAiAuditCorrelation {
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
  type AuditSignal = {
    url: string;
    geoAssessed: boolean;
    googlebotAccessAssessed: boolean;
    googlebotBlocked?: boolean;
    googlebotRule?: { directive: 'allow' | 'disallow'; pattern: string; line: number };
    googlebotNoindex?: boolean;
    googlebotNoSnippet?: boolean;
    googlebotMaxSnippetZero?: boolean;
    dataNoSnippetElements?: number;
    dataNoSnippetWords?: number;
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
  };
  const signalByUrl = new Map<string, AuditSignal>();
  const ambiguousAuditUrls = new Set<string>();
  const canonicalPages = new Map<string, Set<string>>();
  const addCanonicalAlias = (canonicalUrl: string | undefined, normalizedUrl: string): void => {
    if (!canonicalUrl) return;
    const aliases = canonicalPages.get(canonicalUrl) ?? new Set<string>();
    aliases.add(normalizedUrl);
    canonicalPages.set(canonicalUrl, aliases);
  };
  const addSignal = (signal: AuditSignal, canonicalUrl?: string): void => {
    const normalizedUrl = normalizePageUrl(signal.url);
    if (!normalizedUrl) return;
    if (ambiguousAuditUrls.has(normalizedUrl)) {
      // Keep the URL ambiguous after the first collision; never restore an arbitrary signal.
    } else if (signalByUrl.has(normalizedUrl)) {
      signalByUrl.delete(normalizedUrl);
      ambiguousAuditUrls.add(normalizedUrl);
    } else {
      signalByUrl.set(normalizedUrl, signal);
    }
    addCanonicalAlias(canonicalUrl ? normalizePageUrl(canonicalUrl) : undefined, normalizedUrl);
  };
  for (const page of auditPages) {
    const geoChecks = page.report.checks.geo ?? [];
    const crawlerDetails = geoChecks.find(
      ({ name }) => name === 'ai-search-crawler-access'
    )?.details;
    const crawlers =
      crawlerDetails && Array.isArray(crawlerDetails.crawlers)
        ? crawlerDetails.crawlers
        : undefined;
    const googlebot = crawlers?.find(
      (crawler) =>
        crawler &&
        typeof crawler === 'object' &&
        typeof (crawler as Record<string, unknown>).token === 'string' &&
        ((crawler as Record<string, unknown>).token as string).toLowerCase() === 'googlebot'
    ) as Record<string, unknown> | undefined;
    const rule =
      googlebot?.matchedRule && typeof googlebot.matchedRule === 'object'
        ? (googlebot.matchedRule as Record<string, unknown>)
        : undefined;
    const preview = geoChecks.find(({ name }) => name === 'ai-search-preview-controls')?.details;
    const answerContent = geoChecks.find(({ name }) => name === 'answer-content-profile')?.details;
    const citationEvidence = geoChecks.find(
      ({ name }) => name === 'citation-evidence-profile'
    )?.details;
    const documentLanguage = boundedDocumentLanguage(answerContent?.documentLanguage);
    const controls = Array.isArray(preview?.crawlerControls) ? preview.crawlerControls : [];
    const googlebotControl = controls.find(
      (control) =>
        control &&
        typeof control === 'object' &&
        typeof (control as Record<string, unknown>).token === 'string' &&
        ((control as Record<string, unknown>).token as string).toLowerCase() === 'googlebot'
    ) as Record<string, unknown> | undefined;
    const canonicalDetails = page.report.checks.metaTags?.find(
      ({ name }) => name === 'canonical-url-exists'
    )?.details;
    addSignal(
      {
        url: page.url,
        geoAssessed: geoChecks.length > 0,
        googlebotAccessAssessed: googlebot !== undefined,
        ...(typeof googlebot?.allowed === 'boolean'
          ? { googlebotBlocked: !googlebot.allowed }
          : {}),
        ...(rule &&
        (rule.directive === 'allow' || rule.directive === 'disallow') &&
        typeof rule.pattern === 'string' &&
        Number.isInteger(rule.line)
          ? {
              googlebotRule: {
                directive: rule.directive,
                pattern: rule.pattern,
                line: rule.line as number,
              },
            }
          : {}),
        ...(typeof googlebotControl?.noindex === 'boolean'
          ? { googlebotNoindex: googlebotControl.noindex }
          : {}),
        ...(typeof googlebotControl?.noSnippet === 'boolean'
          ? { googlebotNoSnippet: googlebotControl.noSnippet }
          : {}),
        ...(typeof googlebotControl?.maxSnippetZero === 'boolean'
          ? { googlebotMaxSnippetZero: googlebotControl.maxSnippetZero }
          : {}),
        ...(typeof preview?.dataNoSnippetElements === 'number'
          ? { dataNoSnippetElements: preview.dataNoSnippetElements }
          : {}),
        ...(typeof preview?.dataNoSnippetWords === 'number'
          ? { dataNoSnippetWords: preview.dataNoSnippetWords }
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
      },
      typeof canonicalDetails?.canonicalUrl === 'string' ? canonicalDetails.canonicalUrl : undefined
    );
  }
  for (const page of geoSummary?.pageSummaries ?? []) {
    const googlebot = page.searchCrawlerAccess?.find(
      ({ token }) => token.toLowerCase() === 'googlebot'
    );
    const control = page.previewControls?.crawlerControls?.find(
      ({ token }) => token.toLowerCase() === 'googlebot'
    );
    const documentLanguage = boundedDocumentLanguage(page.answerContent?.documentLanguage);
    addSignal(
      {
        url: page.url,
        geoAssessed: page.geoAssessed,
        googlebotAccessAssessed:
          page.signalCoverage.searchCrawlerAccess === 'measured' && googlebot !== undefined,
        ...(googlebot
          ? {
              googlebotBlocked: !googlebot.allowed,
              ...(googlebot.matchedRule ? { googlebotRule: googlebot.matchedRule } : {}),
            }
          : {}),
        ...(control
          ? {
              googlebotNoindex: control.noindex,
              googlebotNoSnippet: control.noSnippet,
              googlebotMaxSnippetZero: control.maxSnippetZero,
            }
          : {}),
        ...(typeof page.previewControls?.dataNoSnippetElements === 'number'
          ? { dataNoSnippetElements: page.previewControls.dataNoSnippetElements }
          : {}),
        ...(typeof page.previewControls?.dataNoSnippetWords === 'number'
          ? { dataNoSnippetWords: page.previewControls.dataNoSnippetWords }
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
      },
      page.canonicalUrl
    );
  }

  const rows: GoogleAiCitedPageAuditRow[] = exportData.rows.map((row) => {
    if (!row.url)
      return {
        ...row,
        auditMatchType: 'not-applicable',
        auditMatched: false,
        geoAssessed: false,
        googlebotAccessAssessed: false,
      };
    const normalizedUrl = normalizePageUrl(row.url);
    const exactIsAmbiguous = Boolean(normalizedUrl && ambiguousAuditUrls.has(normalizedUrl));
    const exact = normalizedUrl && !exactIsAmbiguous ? signalByUrl.get(normalizedUrl) : undefined;
    const canonicalCandidates = normalizedUrl ? canonicalPages.get(normalizedUrl) : undefined;
    const candidateUrl = canonicalCandidates?.size === 1 ? [...canonicalCandidates][0] : undefined;
    const candidateIsAmbiguous = Boolean(candidateUrl && ambiguousAuditUrls.has(candidateUrl));
    const canonical =
      candidateUrl && !candidateIsAmbiguous ? signalByUrl.get(candidateUrl) : undefined;
    const ambiguousAuditUrl = !exact && (exactIsAmbiguous || candidateIsAmbiguous);
    const ambiguous = !exact && !ambiguousAuditUrl && (canonicalCandidates?.size ?? 0) > 1;
    const signal = exact ?? canonical;
    const auditMatchType = exact
      ? 'exact-url'
      : canonical
        ? 'canonical-url'
        : ambiguousAuditUrl
          ? 'ambiguous-audit-url'
          : ambiguous
            ? 'ambiguous-canonical'
            : 'unmatched';
    return {
      ...row,
      auditMatchType,
      auditMatched: signal !== undefined,
      ...(signal ? { matchedAuditUrl: exact ? normalizedUrl : candidateUrl } : {}),
      geoAssessed: signal?.geoAssessed ?? false,
      googlebotAccessAssessed: signal?.googlebotAccessAssessed ?? false,
      ...(signal?.googlebotBlocked !== undefined
        ? { currentGooglebotBlocked: signal.googlebotBlocked }
        : {}),
      ...(signal?.googlebotRule ? { currentGooglebotRule: signal.googlebotRule } : {}),
      ...(signal?.googlebotNoindex !== undefined
        ? { currentGooglebotNoindex: signal.googlebotNoindex }
        : {}),
      ...(signal?.googlebotNoSnippet !== undefined
        ? { currentGooglebotNoSnippet: signal.googlebotNoSnippet }
        : {}),
      ...(signal?.googlebotMaxSnippetZero !== undefined
        ? { currentGooglebotMaxSnippetZero: signal.googlebotMaxSnippetZero }
        : {}),
      ...(signal?.dataNoSnippetElements !== undefined
        ? { currentDataNoSnippetElements: signal.dataNoSnippetElements }
        : {}),
      ...(signal?.dataNoSnippetWords !== undefined
        ? { currentDataNoSnippetWords: signal.dataNoSnippetWords }
        : {}),
      ...(signal?.questionHeadings !== undefined
        ? { currentQuestionHeadings: signal.questionHeadings }
        : {}),
      ...(signal?.conciseAnswerBlocks !== undefined
        ? { currentConciseAnswerBlocks: signal.conciseAnswerBlocks }
        : {}),
      ...(signal?.externalContentLinks !== undefined
        ? { currentExternalContentLinks: signal.externalContentLinks }
        : {}),
      ...(signal?.externalSourceLinks !== undefined
        ? { currentExternalSourceLinks: signal.externalSourceLinks }
        : {}),
      ...(signal?.referenceSectionLinks !== undefined
        ? { currentReferenceSectionLinks: signal.referenceSectionLinks }
        : {}),
      ...(signal?.visibleAuthor !== undefined
        ? { currentVisibleAuthor: signal.visibleAuthor }
        : {}),
      ...(signal?.visibleDate !== undefined ? { currentVisibleDate: signal.visibleDate } : {}),
      ...(signal?.documentLanguage !== undefined
        ? { currentDocumentLanguage: signal.documentLanguage }
        : {}),
      ...(signal?.documentLanguageValid !== undefined
        ? { currentDocumentLanguageValid: signal.documentLanguageValid }
        : {}),
      ...(signal?.documentLanguageAssessed !== undefined
        ? { currentDocumentLanguageAssessed: signal.documentLanguageAssessed }
        : {}),
    };
  });
  const uniqueReportPages = new Set(
    rows.flatMap(({ url }) => (url ? [normalizePageUrl(url) ?? url.trim()] : []))
  );
  const matchedUrls = new Set(
    rows.flatMap((row) =>
      row.auditMatched && row.url ? [normalizePageUrl(row.url) ?? row.url.trim()] : []
    )
  );
  const ambiguousUrls = new Set(
    rows.flatMap((row) =>
      row.auditMatchType === 'ambiguous-canonical' && row.url
        ? [normalizePageUrl(row.url) ?? row.url.trim()]
        : []
    )
  );
  const ambiguousAuditUrlsInReport = new Set(
    rows.flatMap((row) =>
      row.auditMatchType === 'ambiguous-audit-url' && row.url
        ? [normalizePageUrl(row.url) ?? row.url.trim()]
        : []
    )
  );
  const auditUrlByReportUrl = new Map(
    rows.flatMap((row) =>
      row.url && row.matchedAuditUrl
        ? [
            [
              normalizePageUrl(row.url) ?? row.url.trim(),
              normalizePageUrl(row.matchedAuditUrl) ?? row.matchedAuditUrl,
            ] as const,
          ]
        : []
    )
  );
  const uniqueMatchedSignals = [...matchedUrls]
    .map((url) => signalByUrl.get(auditUrlByReportUrl.get(url) ?? url))
    .filter((value): value is AuditSignal => Boolean(value));
  const hasGooglebotSnippetRestriction = (signal: AuditSignal): boolean =>
    signal.googlebotNoSnippet === true || signal.googlebotMaxSnippetZero === true;
  const controlClassifiers: Array<{
    control: GoogleAiAuditControlObservation['control'];
    state: (row: GoogleAiCitedPageAuditRow) => GoogleAiAuditControlObservation['state'];
  }> = [
    {
      control: 'googlebot-robots-access',
      state: (row) =>
        row.currentGooglebotBlocked === undefined
          ? 'not-assessed'
          : row.currentGooglebotBlocked
            ? 'present'
            : 'absent',
    },
    {
      control: 'googlebot-noindex',
      state: (row) =>
        row.currentGooglebotNoindex === undefined
          ? 'not-assessed'
          : row.currentGooglebotNoindex
            ? 'present'
            : 'absent',
    },
    {
      control: 'googlebot-snippet-restriction',
      state: (row) =>
        row.currentGooglebotNoSnippet === true || row.currentGooglebotMaxSnippetZero === true
          ? 'present'
          : row.currentGooglebotNoSnippet === false && row.currentGooglebotMaxSnippetZero === false
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
    { pages: Set<string>; exportRows: number; impressions: number }
  >();
  for (const row of rows) {
    if (!row.auditMatched || !row.url) continue;
    const pageKey = normalizePageUrl(row.matchedAuditUrl ?? row.url) ?? row.url.trim();
    for (const classifier of controlClassifiers) {
      const state = classifier.state(row);
      const key = `${classifier.control}:${state}`;
      const bucket = controlObservations.get(key) ?? {
        pages: new Set<string>(),
        exportRows: 0,
        impressions: 0,
      };
      bucket.pages.add(pageKey);
      bucket.exportRows += 1;
      bucket.impressions += row.impressions;
      controlObservations.set(key, bucket);
    }
  }
  const currentControlObservations = controlClassifiers.flatMap(({ control }) =>
    (['present', 'absent', 'not-assessed'] as const).map(
      (state): GoogleAiAuditControlObservation => {
        const bucket = controlObservations.get(`${control}:${state}`);
        return {
          control,
          state,
          matchedPages: bucket?.pages.size ?? 0,
          exportRows: bucket?.exportRows ?? 0,
          rowSummedImpressions: bucket?.impressions ?? 0,
        };
      }
    )
  );
  const contentClassifiers: Array<{
    signal: GoogleAiAuditContentObservation['signal'];
    state: (row: GoogleAiCitedPageAuditRow) => GoogleAiAuditContentObservation['state'];
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
    { pages: Set<string>; exportRows: number; impressions: number }
  >();
  for (const row of rows) {
    if (!row.auditMatched || !row.url) continue;
    const pageKey = normalizePageUrl(row.matchedAuditUrl ?? row.url) ?? row.url.trim();
    for (const classifier of contentClassifiers) {
      const state = classifier.state(row);
      const key = `${classifier.signal}:${state}`;
      const bucket = contentObservations.get(key) ?? {
        pages: new Set<string>(),
        exportRows: 0,
        impressions: 0,
      };
      bucket.pages.add(pageKey);
      bucket.exportRows += 1;
      bucket.impressions += row.impressions;
      contentObservations.set(key, bucket);
    }
  }
  const currentContentObservations = contentClassifiers.flatMap(({ signal }) =>
    (['present', 'absent', 'not-assessed'] as const).map(
      (state): GoogleAiAuditContentObservation => {
        const bucket = contentObservations.get(`${signal}:${state}`);
        return {
          signal,
          state,
          matchedPages: bucket?.pages.size ?? 0,
          exportRows: bucket?.exportRows ?? 0,
          rowSummedImpressions: bucket?.impressions ?? 0,
        };
      }
    )
  );

  return {
    ...(exportData.sourceFile ? { sourceFile: exportData.sourceFile } : {}),
    auditPagesCompared: signalByUrl.size + ambiguousAuditUrls.size,
    uniqueReportPages: uniqueReportPages.size,
    pagesMatchedToAudit: matchedUrls.size,
    pagesMatchedByCanonical: new Set(
      rows.flatMap((row) =>
        row.auditMatchType === 'canonical-url' && row.url
          ? [normalizePageUrl(row.url) ?? row.url.trim()]
          : []
      )
    ).size,
    pagesWithAmbiguousAuditUrlMatch: ambiguousAuditUrlsInReport.size,
    pagesWithAmbiguousCanonicalMatch: ambiguousUrls.size,
    pagesNotInAudit:
      uniqueReportPages.size -
      matchedUrls.size -
      ambiguousUrls.size -
      ambiguousAuditUrlsInReport.size,
    matchedPagesWithCurrentGooglebotBlocks: uniqueMatchedSignals.filter(
      ({ googlebotBlocked }) => googlebotBlocked === true
    ).length,
    matchedPagesWithCurrentGooglebotNoindex: uniqueMatchedSignals.filter(
      ({ googlebotNoindex }) => googlebotNoindex === true
    ).length,
    matchedPagesWithCurrentGooglebotSnippetRestrictions: uniqueMatchedSignals.filter(
      hasGooglebotSnippetRestriction
    ).length,
    matchedPagesWithCurrentDataNoSnippet: uniqueMatchedSignals.filter(
      ({ dataNoSnippetElements }) => (dataNoSnippetElements ?? 0) > 0
    ).length,
    currentControlObservations,
    currentContentObservations,
    note: 'Impressions come from the Search Console report date range; robots, preview controls, and content profiles come from the current Aviary audit and may have changed since then. currentControlObservations and currentContentObservations group matched export rows by those present-day signals; buckets overlap, row-summed impressions are not property totals, and the associations are not evidence of causation or visibility eligibility. Ambiguous canonical targets and duplicate normalized audit URLs are not assigned controls or content signals.',
    rows,
  };
}
