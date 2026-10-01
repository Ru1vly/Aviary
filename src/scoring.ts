import type { SEOAuditBatchReport, SEOCheckResult, SEOReport } from './types';
import { escapeSpreadsheetCsvCell } from './utils/csv';

/** Names the controls required for the GEO comparability flag and page counts. */
export const GEO_COMPARABILITY_BASIS = 'search-crawler-access-and-preview-controls' as const;
export const GEO_COMPARISON_SCHEMA_VERSION = 1 as const;

export interface SEOReportFinding {
  category: string;
  name: string;
  message: string;
  severity?: string;
}

export interface SEOAuditGeoSignalChange {
  url: string;
  signal: string;
  before: string;
  after: string;
}

export interface SEOAuditGeoSignalFilters {
  /** Exact, case-sensitive signal labels. Multiple labels are alternatives. */
  signals?: readonly string[];
  /** Exact, case-sensitive page URLs. Multiple URLs are alternatives. */
  urls?: readonly string[];
  /** Exact before/after values. Multiple transitions are alternatives. */
  transitions?: ReadonlyArray<{ before: string; after: string }>;
}

export type SEOAuditGeoGateFailureCode =
  | 'no-comparable-data'
  | 'unassessed-pages'
  | 'selected-changes'
  | 'current-audit-errors'
  | 'baseline-audit-errors';

export interface SEOAuditGeoGateFailureReason {
  code: SEOAuditGeoGateFailureCode;
  message: string;
}

export interface SEOAuditGeoGateEvaluation {
  passed: boolean;
  failureReasons: SEOAuditGeoGateFailureReason[];
  matchedPages: number;
  comparablePages: number;
  unassessedPages: number;
  totalChanges: number;
  matchingChanges: SEOAuditGeoSignalChange[];
  currentFailedUrls: number;
  baselineFailedUrls: number;
}

/** Apply the same exact signal/URL selection semantics used by the CLI GEO baseline gate. */
export function filterSEOAuditGeoSignalChanges(
  changes: readonly SEOAuditGeoSignalChange[],
  filters: SEOAuditGeoSignalFilters = {}
): SEOAuditGeoSignalChange[] {
  const exactSet = (
    values: readonly string[] | undefined,
    name: string
  ): Set<string> | undefined => {
    if (values === undefined) return undefined;
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      values.some((value) => typeof value !== 'string' || !value.trim())
    ) {
      throw new Error(`GEO comparison ${name} filters must contain non-empty strings.`);
    }
    return new Set(values.map((value) => value.trim()));
  };
  const signals = exactSet(filters.signals, 'signal');
  const urls = exactSet(filters.urls, 'URL');
  if (
    filters.transitions !== undefined &&
    (!Array.isArray(filters.transitions) ||
      filters.transitions.length === 0 ||
      filters.transitions.some(
        (transition) =>
          !transition ||
          typeof transition !== 'object' ||
          typeof transition.before !== 'string' ||
          !transition.before.trim() ||
          typeof transition.after !== 'string' ||
          !transition.after.trim()
      ))
  ) {
    throw new Error(
      'GEO comparison transition filters must contain non-empty before and after values.'
    );
  }
  const transitions =
    filters.transitions === undefined
      ? undefined
      : new Set(
          filters.transitions.map(({ before, after }) =>
            JSON.stringify([before.trim(), after.trim()])
          )
        );
  return changes.filter(
    (change) =>
      (!signals?.size || signals.has(change.signal)) &&
      (!urls?.size || urls.has(change.url)) &&
      (!transitions?.size || transitions.has(JSON.stringify([change.before, change.after])))
  );
}

/** Evaluate a fail-closed GEO baseline gate for either single-page or batch comparisons. */
export function evaluateSEOAuditGeoChangeGate(
  comparison: SEOReportComparison | SEOAuditBatchComparison,
  options: {
    filters?: SEOAuditGeoSignalFilters;
    currentFailedUrls?: number;
    baselineFailedUrls?: number;
  } = {}
): SEOAuditGeoGateEvaluation {
  const currentFailedUrls = options.currentFailedUrls ?? 0;
  const baselineFailedUrls = options.baselineFailedUrls ?? 0;
  for (const [name, value] of [
    ['currentFailedUrls', currentFailedUrls],
    ['baselineFailedUrls', baselineFailedUrls],
  ] as const) {
    if (!Number.isInteger(value) || value < 0)
      throw new Error(`${name} must be a non-negative integer.`);
  }
  const isBatch = 'geoComparedPages' in comparison;
  const matchedPages = isBatch ? comparison.geoComparedPages + comparison.geoUnassessedPages : 1;
  const comparablePages = isBatch ? comparison.geoComparedPages : Number(comparison.geoCompared);
  const unassessedPages = isBatch ? comparison.geoUnassessedPages : Number(!comparison.geoCompared);
  const matchingChanges = filterSEOAuditGeoSignalChanges(comparison.geoChanges, options.filters);
  const failureReasons: SEOAuditGeoGateFailureReason[] = [];
  if (comparablePages === 0)
    failureReasons.push({
      code: 'no-comparable-data',
      message: isBatch
        ? 'no matched pages had comparable GEO data'
        : 'GEO data unavailable in one or both saved reports',
    });
  if (isBatch && unassessedPages > 0)
    failureReasons.push({
      code: 'unassessed-pages',
      message: `GEO data unavailable on ${unassessedPages} matched page(s)`,
    });
  if (matchingChanges.length > 0)
    failureReasons.push({
      code: 'selected-changes',
      message: `${matchingChanges.length} matching GEO signal change(s)`,
    });
  if (currentFailedUrls > 0)
    failureReasons.push({
      code: 'current-audit-errors',
      message: `GEO audit data unavailable for ${currentFailedUrls} current page(s)`,
    });
  if (baselineFailedUrls > 0)
    failureReasons.push({
      code: 'baseline-audit-errors',
      message: `GEO baseline data unavailable for ${baselineFailedUrls} page(s)`,
    });
  return {
    passed: failureReasons.length === 0,
    failureReasons,
    matchedPages,
    comparablePages,
    unassessedPages,
    totalChanges: comparison.geoChanges.length,
    matchingChanges,
    currentFailedUrls,
    baselineFailedUrls,
  };
}

export function renderGeoSignalChangesCsv(
  comparison:
    | Pick<
        SEOAuditBatchComparison,
        | 'baselineTimestamp'
        | 'currentTimestamp'
        | 'geoChanges'
        | 'geoComparedPages'
        | 'geoUnassessedPages'
        | 'geoComparedBasis'
        | 'schemaVersion'
      >
    | (Pick<
        SEOReportComparison,
        'baselineTimestamp' | 'geoChanges' | 'geoCompared' | 'geoComparedBasis' | 'schemaVersion'
      > & { currentTimestamp: string })
): string {
  const headers = [
    'row_type',
    'schema_version',
    'baseline_timestamp',
    'current_timestamp',
    'geo_compared_pages',
    'geo_unassessed_pages',
    'geo_compared',
    'geo_comparability_basis',
    'url',
    'signal',
    'before',
    'after',
    'change_count',
  ];
  const cell = escapeSpreadsheetCsvCell;
  const isBatch = 'geoComparedPages' in comparison;
  const rows = [
    [
      'summary',
      comparison.schemaVersion,
      comparison.baselineTimestamp,
      comparison.currentTimestamp,
      isBatch ? comparison.geoComparedPages : Number(comparison.geoCompared),
      isBatch ? comparison.geoUnassessedPages : undefined,
      isBatch ? undefined : comparison.geoCompared,
      comparison.geoComparedBasis,
      undefined,
      undefined,
      undefined,
      undefined,
      comparison.geoChanges.length,
    ],
    ...comparison.geoChanges.map((change) => [
      'change',
      comparison.schemaVersion,
      comparison.baselineTimestamp,
      comparison.currentTimestamp,
      undefined,
      undefined,
      undefined,
      comparison.geoComparedBasis,
      change.url,
      change.signal,
      change.before,
      change.after,
      undefined,
    ]),
  ];
  return (
    [headers.map(cell).join(','), ...rows.map((row) => row.map(cell).join(','))].join('\n') + '\n'
  );
}

export interface SEOReportComparison {
  schemaVersion: typeof GEO_COMPARISON_SCHEMA_VERSION;
  baselineUrl: string;
  baselineTimestamp: string;
  baselineScore: number | null;
  currentScore: number | null;
  scoreDelta: number | null;
  newFailures: SEOReportFinding[];
  resolvedFailures: SEOReportFinding[];
  geoChanges: SEOAuditGeoSignalChange[];
  /** True only when both reports have comparable inputs for `geoComparedBasis`. */
  geoCompared: boolean;
  /** The coverage basis for `geoCompared`; other measured GEO signals may also appear in `geoChanges`. */
  geoComparedBasis: typeof GEO_COMPARABILITY_BASIS;
}

export interface SEOAuditBatchComparison {
  schemaVersion: typeof GEO_COMPARISON_SCHEMA_VERSION;
  baselineTimestamp: string;
  currentTimestamp: string;
  baselineAverageScore: number | null;
  currentAverageScore: number | null;
  scoreDelta: number | null;
  newUrls: string[];
  removedUrls: string[];
  newFailures: Array<SEOReportFinding & { url: string }>;
  resolvedFailures: Array<SEOReportFinding & { url: string }>;
  geoChanges: SEOAuditGeoSignalChange[];
  /** Number of matched pages with comparable inputs for `geoComparedBasis`. */
  geoComparedPages: number;
  /** Number of matched pages without comparable inputs for `geoComparedBasis`. */
  geoUnassessedPages: number;
  /** The coverage basis used by the page counts; not a claim that every GEO signal was measured. */
  geoComparedBasis: typeof GEO_COMPARABILITY_BASIS;
}

function geoCheckDetails(report: SEOReport, name: string): Record<string, unknown> | undefined {
  const check = report.checks.geo?.find((item) => item.name === name);
  const details = check?.details;
  return details && typeof details === 'object' ? details : undefined;
}

function crawlerStates(details: Record<string, unknown> | undefined): Map<
  string,
  {
    token: string;
    allowed: boolean;
    matchedAgents?: string[];
    matchedRule?: { directive: 'allow' | 'disallow'; pattern: string };
  }
> {
  const crawlers = details?.crawlers;
  if (!Array.isArray(crawlers)) return new Map();
  const states = new Map<
    string,
    {
      token: string;
      allowed: boolean;
      matchedAgents?: string[];
      matchedRule?: { directive: 'allow' | 'disallow'; pattern: string };
    }
  >();
  for (const item of crawlers) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.token !== 'string' || typeof record.allowed !== 'boolean') continue;
    const rawRule = record.matchedRule;
    const matchedRule =
      rawRule && typeof rawRule === 'object' && !Array.isArray(rawRule)
        ? (rawRule as Record<string, unknown>)
        : undefined;
    states.set(record.token.toLowerCase(), {
      token: record.token,
      allowed: record.allowed,
      ...(Array.isArray(record.matchedAgents)
        ? {
            matchedAgents: record.matchedAgents
              .filter((agent): agent is string => typeof agent === 'string')
              .sort(),
          }
        : {}),
      ...(matchedRule &&
      (matchedRule.directive === 'allow' || matchedRule.directive === 'disallow') &&
      typeof matchedRule.pattern === 'string'
        ? { matchedRule: { directive: matchedRule.directive, pattern: matchedRule.pattern } }
        : {}),
    });
  }
  return states;
}

function crawlerPreviewStates(details: Record<string, unknown> | undefined): Map<
  string,
  {
    token: string;
    noindex?: boolean;
    noSnippet?: boolean;
    maxSnippetZero?: boolean;
  }
> {
  const controls = details?.crawlerControls;
  if (!Array.isArray(controls)) return new Map();
  const states = new Map<
    string,
    {
      token: string;
      noindex?: boolean;
      noSnippet?: boolean;
      maxSnippetZero?: boolean;
    }
  >();
  for (const item of controls) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.token !== 'string') continue;
    states.set(record.token.toLowerCase(), {
      token: record.token,
      ...(typeof record.noindex === 'boolean' ? { noindex: record.noindex } : {}),
      ...(typeof record.noSnippet === 'boolean' ? { noSnippet: record.noSnippet } : {}),
      ...(typeof record.maxSnippetZero === 'boolean'
        ? { maxSnippetZero: record.maxSnippetZero }
        : {}),
    });
  }
  return states;
}

function dataUseCrawlerPreviewStates(
  details: Record<string, unknown> | undefined
): Map<string, { token: string; noArchive: boolean; noindex?: boolean }> {
  const controls = details?.dataUseCrawlerControls;
  if (!Array.isArray(controls)) return new Map();
  const states = new Map<string, { token: string; noArchive: boolean; noindex?: boolean }>();
  for (const item of controls) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.token !== 'string' || typeof record.noArchive !== 'boolean') continue;
    states.set(record.token.toLowerCase(), {
      token: record.token,
      noArchive: record.noArchive,
      ...(typeof record.noindex === 'boolean' ? { noindex: record.noindex } : {}),
    });
  }
  return states;
}

function optionalLlmsFileState(
  details: Record<string, unknown> | undefined,
  filePath: string
): string {
  const resources = details?.resources;
  if (!Array.isArray(resources)) return 'not assessed';
  const resource = resources.find(
    (item) =>
      item && typeof item === 'object' && (item as Record<string, unknown>).path === filePath
  );
  if (!resource || typeof resource !== 'object') return 'not assessed';
  const record = resource as Record<string, unknown>;
  if (record.found === true) return 'available';
  if (record.status === 404 || record.status === 410) return 'confirmed absent';
  if (record.robotsAllowed === false) return 'not assessed';
  return typeof record.status === 'number' || typeof record.reason === 'string'
    ? 'unconfirmed'
    : 'not assessed';
}

function hasComparableGeoControls(report: SEOReport): boolean {
  const crawlerAccess = geoCheckDetails(report, 'ai-search-crawler-access');
  const preview = geoCheckDetails(report, 'ai-search-preview-controls');
  return (
    Array.isArray(crawlerAccess?.crawlers) &&
    crawlerAccess.crawlers.length > 0 &&
    typeof preview?.noindex === 'boolean' &&
    typeof preview?.noSnippet === 'boolean'
  );
}

/** Compare explicit, informational GEO controls and observations across saved page reports. */
function compareGeoSignals(current: SEOReport, baseline: SEOReport): SEOAuditGeoSignalChange[] {
  const changes: SEOAuditGeoSignalChange[] = [];
  const addChange = (signal: string, before: string, after: string): void => {
    if (before !== after) changes.push({ url: current.url, signal, before, after });
  };

  const oldCrawlers = crawlerStates(geoCheckDetails(baseline, 'ai-search-crawler-access'));
  const newCrawlers = crawlerStates(geoCheckDetails(current, 'ai-search-crawler-access'));
  for (const key of new Set([...oldCrawlers.keys(), ...newCrawlers.keys()])) {
    const before = oldCrawlers.get(key);
    const after = newCrawlers.get(key);
    const token = after?.token ?? before?.token ?? key;
    const describe = (allowed: boolean | undefined): string =>
      allowed === undefined ? 'not assessed' : allowed ? 'allowed' : 'blocked';
    addChange(`${token} search access`, describe(before?.allowed), describe(after?.allowed));
    const describeRule = (state: typeof before): string => {
      if (!state) return 'not assessed';
      const rule = state.matchedRule
        ? `${state.matchedRule.directive} ${state.matchedRule.pattern}`
        : 'no matching allow/disallow rule';
      const agents = state.matchedAgents?.length
        ? `; selected group ${state.matchedAgents.join(', ')}`
        : '';
      return `${rule}${agents}`;
    };
    addChange(`${token} robots.txt rule selection`, describeRule(before), describeRule(after));
  }

  const oldUserFetchers = crawlerStates(
    geoCheckDetails(baseline, 'ai-user-initiated-fetch-access')
  );
  const newUserFetchers = crawlerStates(geoCheckDetails(current, 'ai-user-initiated-fetch-access'));
  for (const key of new Set([...oldUserFetchers.keys(), ...newUserFetchers.keys()])) {
    const before = oldUserFetchers.get(key);
    const after = newUserFetchers.get(key);
    const token = after?.token ?? before?.token ?? key;
    const describeAccess = (allowed: boolean | undefined): string =>
      allowed === undefined ? 'not assessed' : allowed ? 'allowed' : 'blocked';
    addChange(
      `${token} user-triggered fetch access`,
      describeAccess(before?.allowed),
      describeAccess(after?.allowed)
    );
  }

  const oldPreview = geoCheckDetails(baseline, 'ai-search-preview-controls');
  const newPreview = geoCheckDetails(current, 'ai-search-preview-controls');
  const oldDataUseControls = dataUseCrawlerPreviewStates(oldPreview);
  const newDataUseControls = dataUseCrawlerPreviewStates(newPreview);
  for (const key of new Set([...oldDataUseControls.keys(), ...newDataUseControls.keys()])) {
    const before = oldDataUseControls.get(key);
    const after = newDataUseControls.get(key);
    const token = after?.token ?? before?.token ?? key;
    const describe = (value: boolean | undefined): string =>
      value === undefined ? 'not assessed' : value ? 'present' : 'absent';
    if (typeof before?.noindex === 'boolean' || typeof after?.noindex === 'boolean') {
      addChange(
        `${token} data-use noindex directive`,
        describe(before?.noindex),
        describe(after?.noindex)
      );
    }
    addChange(
      `${token} noarchive directive`,
      describe(before?.noArchive),
      describe(after?.noArchive)
    );
  }
  for (const [key, label] of [
    ['noindex', 'Page indexing'],
    ['noSnippet', 'Search snippets'],
  ] as const) {
    const before = oldPreview?.[key];
    const after = newPreview?.[key];
    if (typeof before === 'boolean' || typeof after === 'boolean') {
      const describe = (value: unknown): string =>
        value === true ? 'restricted' : value === false ? 'not restricted' : 'not assessed';
      addChange(label, describe(before), describe(after));
    }
  }
  for (const [key, label, unit] of [
    ['dataNoSnippetElements', 'Visible data-nosnippet regions', 'region(s)'],
    ['dataNoSnippetWords', 'Visible words in data-nosnippet regions', 'word(s)'],
    ['dataNoSnippetWordSharePercent', 'Visible content marked data-nosnippet', '%'],
  ] as const) {
    const before = oldPreview?.[key];
    const after = newPreview?.[key];
    if (typeof before === 'number' || typeof after === 'number') {
      const describe = (value: unknown): string =>
        typeof value === 'number'
          ? unit === '%'
            ? `${value}%`
            : `${value} ${unit}`
          : 'not assessed';
      addChange(label, describe(before), describe(after));
    }
  }
  const compareObservedNumbers = (
    beforeDetails: Record<string, unknown> | undefined,
    afterDetails: Record<string, unknown> | undefined,
    signals: Array<[key: string, label: string, unit: string]>
  ): void => {
    for (const [key, label, unit] of signals) {
      const before = beforeDetails?.[key];
      const after = afterDetails?.[key];
      if (typeof before !== 'number' && typeof after !== 'number') continue;
      const describe = (value: unknown): string =>
        typeof value === 'number'
          ? unit === '%'
            ? `${value}%`
            : `${value} ${unit}`
          : 'not assessed';
      addChange(label, describe(before), describe(after));
    }
  };
  const oldContentProfile = geoCheckDetails(baseline, 'answer-content-profile');
  const newContentProfile = geoCheckDetails(current, 'answer-content-profile');
  compareObservedNumbers(oldContentProfile, newContentProfile, [
    ['contentWords', 'Visible answer-content words', 'word(s)'],
    ['questionHeadings', 'Question-shaped headings', 'heading(s)'],
    ['conciseAnswerBlocks', 'Question headings with concise answers', 'block(s)'],
    ['externalContentLinks', 'External links in answer content', 'link(s)'],
  ]);
  const presenceSignals = [
    ['mainOrArticleRegion', 'Semantic main/article region'],
    ['visibleAuthor', 'Visible author marker'],
    ['visibleDate', 'Visible publication date marker'],
    ['schemaAuthor', 'Structured author property'],
    ['schemaDate', 'Structured publication date property'],
  ] as const;
  for (const [key, label] of presenceSignals) {
    const before = oldContentProfile?.[key];
    const after = newContentProfile?.[key];
    if (typeof before !== 'boolean' && typeof after !== 'boolean') continue;
    const describe = (value: unknown): string =>
      value === true ? 'present' : value === false ? 'absent' : 'not assessed';
    addChange(label, describe(before), describe(after));
  }
  const oldSchemaModifiedDays = oldContentProfile?.schemaDateModifiedDays;
  const newSchemaModifiedDays = newContentProfile?.schemaDateModifiedDays;
  if (Array.isArray(oldSchemaModifiedDays) || Array.isArray(newSchemaModifiedDays)) {
    const describeModifiedDays = (
      value: unknown,
      truncatedValue: unknown,
      nonDateValue: unknown
    ): string => {
      if (!Array.isArray(value)) return 'not assessed';
      const days = [
        ...new Set(value.filter((day): day is string => typeof day === 'string')),
      ].sort();
      const summary = days.join(', ') || 'no valid dateModified value';
      return `${summary}${truncatedValue === true ? ' (capped)' : ''}${nonDateValue === true ? ' · also found a non-date value' : ''}`;
    };
    addChange(
      'JSON-LD dateModified UTC day(s)',
      describeModifiedDays(
        oldSchemaModifiedDays,
        oldContentProfile?.schemaDateModifiedDaysTruncated,
        oldContentProfile?.schemaDateModifiedHasNonDateValue
      ),
      describeModifiedDays(
        newSchemaModifiedDays,
        newContentProfile?.schemaDateModifiedDaysTruncated,
        newContentProfile?.schemaDateModifiedHasNonDateValue
      )
    );
  }
  const accessSchemaStates: Array<[unknown, string]> = [
    [true, 'declared free access'],
    [false, 'declared paywalled'],
    ['mixed', 'conflicting boolean declarations'],
    ['not-declared', 'no boolean declaration'],
  ];
  const describeFreeAccessSchema = (value: unknown): string =>
    accessSchemaStates.find(([state]) => state === value)?.[1] ?? 'not assessed';
  if (
    oldContentProfile?.schemaIsAccessibleForFree !== undefined ||
    newContentProfile?.schemaIsAccessibleForFree !== undefined
  ) {
    addChange(
      'JSON-LD isAccessibleForFree signal',
      describeFreeAccessSchema(oldContentProfile?.schemaIsAccessibleForFree),
      describeFreeAccessSchema(newContentProfile?.schemaIsAccessibleForFree)
    );
  }
  const oldNonBooleanFreeAccess = oldContentProfile?.schemaHasNonBooleanAccessibleForFreeValue;
  const newNonBooleanFreeAccess = newContentProfile?.schemaHasNonBooleanAccessibleForFreeValue;
  if (
    typeof oldNonBooleanFreeAccess === 'boolean' ||
    typeof newNonBooleanFreeAccess === 'boolean'
  ) {
    const describe = (value: unknown): string =>
      value === true ? 'present' : value === false ? 'absent' : 'not assessed';
    addChange(
      'Non-boolean isAccessibleForFree JSON-LD value',
      describe(oldNonBooleanFreeAccess),
      describe(newNonBooleanFreeAccess)
    );
  }
  const oldTypes = oldContentProfile?.jsonLdTypes;
  const newTypes = newContentProfile?.jsonLdTypes;
  if (Array.isArray(oldTypes) || Array.isArray(newTypes)) {
    const describeTypes = (value: unknown): string =>
      Array.isArray(value)
        ? [...new Set(value.filter((type): type is string => typeof type === 'string'))]
            .sort()
            .join(', ') || 'none observed'
        : 'not assessed';
    addChange('Observed JSON-LD types', describeTypes(oldTypes), describeTypes(newTypes));
  }
  const oldTypeListTruncated = oldContentProfile?.jsonLdTypeListTruncated;
  const newTypeListTruncated = newContentProfile?.jsonLdTypeListTruncated;
  if (typeof oldTypeListTruncated === 'boolean' || typeof newTypeListTruncated === 'boolean') {
    const describeTypeList = (value: unknown): string =>
      value === true ? 'capped at 20 types' : value === false ? 'not capped' : 'not assessed';
    addChange(
      'JSON-LD type inventory completeness',
      describeTypeList(oldTypeListTruncated),
      describeTypeList(newTypeListTruncated)
    );
  }
  const identityMap = (
    details: Record<string, unknown> | undefined
  ):
    | Map<
        string,
        {
          names: Set<string>;
          types: Set<string>;
          sameAs: Set<string>;
          sameAsTruncated: boolean;
        }
      >
    | undefined => {
    if (!Array.isArray(details?.identityEntities)) return undefined;
    const entities = new Map<
      string,
      { names: Set<string>; types: Set<string>; sameAs: Set<string>; sameAsTruncated: boolean }
    >();
    for (const value of details.identityEntities) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const entity = value as Record<string, unknown>;
      if (typeof entity.id !== 'string' || !entity.id.trim()) continue;
      const id = entity.id.trim();
      const state = entities.get(id) ?? {
        names: new Set<string>(),
        types: new Set<string>(),
        sameAs: new Set<string>(),
        sameAsTruncated: false,
      };
      if (typeof entity.name === 'string' && entity.name.trim())
        state.names.add(entity.name.trim());
      if (Array.isArray(entity.types)) {
        for (const type of entity.types)
          if (typeof type === 'string' && type.trim()) state.types.add(type.trim());
      }
      if (Array.isArray(entity.sameAs)) {
        for (const url of entity.sameAs)
          if (typeof url === 'string' && url.trim()) state.sameAs.add(url.trim());
      }
      if (entity.sameAsTruncated === true) state.sameAsTruncated = true;
      entities.set(id, state);
    }
    return entities;
  };
  const oldIdentities = identityMap(oldContentProfile);
  const newIdentities = identityMap(newContentProfile);
  const oldEntityListTruncated = oldContentProfile?.identityEntityListTruncated === true;
  const newEntityListTruncated = newContentProfile?.identityEntityListTruncated === true;
  if (
    typeof oldContentProfile?.identityEntityListTruncated === 'boolean' ||
    typeof newContentProfile?.identityEntityListTruncated === 'boolean'
  ) {
    const describe = (truncated: boolean | undefined): string =>
      truncated === undefined
        ? 'not assessed'
        : truncated
          ? 'truncated at the per-page limit'
          : 'not truncated';
    addChange(
      'Structured identity entity inventory',
      describe(oldContentProfile?.identityEntityListTruncated as boolean | undefined),
      describe(newContentProfile?.identityEntityListTruncated as boolean | undefined)
    );
  }
  if (oldIdentities && newIdentities) {
    const describeValues = (values: Set<string>): string =>
      [...values]
        .sort()
        .map((value) => (value.length > 160 ? `${value.slice(0, 157)}…` : value))
        .join(' / ') || 'not declared';
    for (const id of new Set([...oldIdentities.keys(), ...newIdentities.keys()])) {
      const before = oldIdentities.get(id);
      const after = newIdentities.get(id);
      const label = `Structured entity ${id}`;
      if (!before || !after) {
        if (!oldEntityListTruncated && !newEntityListTruncated) {
          addChange(
            `${label} presence`,
            before ? 'present' : 'not declared',
            after ? 'present' : 'not declared'
          );
        }
        continue;
      }
      addChange(`${label} name`, describeValues(before.names), describeValues(after.names));
      addChange(`${label} types`, describeValues(before.types), describeValues(after.types));
      if (before.sameAsTruncated !== after.sameAsTruncated) {
        addChange(
          `${label} sameAs inventory`,
          before.sameAsTruncated ? 'truncated at the per-entity limit' : 'not truncated',
          after.sameAsTruncated ? 'truncated at the per-entity limit' : 'not truncated'
        );
      }
      if (!before.sameAsTruncated && !after.sameAsTruncated) {
        addChange(
          `${label} sameAs links`,
          describeValues(before.sameAs),
          describeValues(after.sameAs)
        );
      }
    }
  }
  const oldSourceProfile = geoCheckDetails(baseline, 'source-rendered-content-profile');
  const newSourceProfile = geoCheckDetails(current, 'source-rendered-content-profile');
  compareObservedNumbers(oldSourceProfile, newSourceProfile, [
    ['renderedPhraseCoveragePercent', 'Rendered phrase coverage in initial HTML', '%'],
    ['sourceWordCount', 'Initial HTML content words', 'word(s)'],
    ['renderedWordCount', 'Rendered content words', 'word(s)'],
  ]);
  const oldEvidenceProfile = geoCheckDetails(baseline, 'citation-evidence-profile');
  const newEvidenceProfile = geoCheckDetails(current, 'citation-evidence-profile');
  compareObservedNumbers(oldEvidenceProfile, newEvidenceProfile, [
    ['externalSourceLinkCount', 'External source links', 'link(s)'],
    ['uniqueSourceHosts', 'Distinct external source hosts', 'host(s)'],
    ['topSourceHostLinkSharePercent', 'Leading external source host share', '%'],
    ['inlineCitationMarkerCount', 'Inline citation markers', 'marker(s)'],
    [
      'resolvedInlineCitationTargetsWithExternalLinks',
      'Resolved citation targets with external links',
      'target(s)',
    ],
    [
      'resolvedInlineCitationTargetsWithoutExternalLinks',
      'Resolved citation targets without external links',
      'target(s)',
    ],
    ['unresolvedInlineCitationTargetCount', 'Unresolved inline citation targets', 'target(s)'],
    ['referenceSectionLinkCount', 'Links in references sections', 'link(s)'],
    ['jsonLdBlocksWithCitationField', 'JSON-LD blocks with citation fields', 'block(s)'],
  ]);
  const describeSourceHostCounts = (details: Record<string, unknown> | undefined): string => {
    if (!Array.isArray(details?.sourceHostLinkCounts)) return 'not assessed';
    const rows = details.sourceHostLinkCounts
      .flatMap((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
        const row = value as Record<string, unknown>;
        return typeof row.host === 'string' &&
          typeof row.links === 'number' &&
          Number.isFinite(row.links)
          ? [{ host: row.host, links: row.links }]
          : [];
      })
      .sort((left, right) => left.host.localeCompare(right.host));
    const distribution =
      rows.map(({ host, links }) => `${host}: ${links}`).join(', ') || 'none observed';
    const completeness =
      details.sourceHostLinkCountsTruncated === true
        ? 'additional domains omitted'
        : details.sourceHostLinkCountsTruncated === false
          ? 'complete'
          : 'completeness unknown';
    return `${distribution}; ${completeness}`;
  };
  if (
    Array.isArray(oldEvidenceProfile?.sourceHostLinkCounts) ||
    Array.isArray(newEvidenceProfile?.sourceHostLinkCounts)
  ) {
    addChange(
      'Citation source hosts and link counts',
      describeSourceHostCounts(oldEvidenceProfile),
      describeSourceHostCounts(newEvidenceProfile)
    );
  }
  const oldCrawlerPreviews = crawlerPreviewStates(oldPreview);
  const newCrawlerPreviews = crawlerPreviewStates(newPreview);
  const previewSignals = [
    ['noindex', 'page indexing restriction'],
    ['noSnippet', 'snippet restriction'],
    ['maxSnippetZero', 'max-snippet:0'],
  ] as const;
  for (const key of new Set([...oldCrawlerPreviews.keys(), ...newCrawlerPreviews.keys()])) {
    const before = oldCrawlerPreviews.get(key);
    const after = newCrawlerPreviews.get(key);
    const token = after?.token ?? before?.token ?? key;
    for (const [property, label] of previewSignals) {
      const oldValue = before?.[property];
      const newValue = after?.[property];
      if (typeof oldValue !== 'boolean' && typeof newValue !== 'boolean') continue;
      const describe = (value: boolean | undefined): string =>
        value === undefined ? 'not assessed' : value ? 'restricted' : 'not restricted';
      addChange(`${token} ${label}`, describe(oldValue), describe(newValue));
    }
  }

  const oldLlms = geoCheckDetails(baseline, 'llms-txt-convention-inventory');
  const newLlms = geoCheckDetails(current, 'llms-txt-convention-inventory');
  for (const filePath of ['/llms.txt', '/llms-full.txt']) {
    const before = optionalLlmsFileState(oldLlms, filePath);
    const after = optionalLlmsFileState(newLlms, filePath);
    addChange(filePath, before, after);
  }

  return changes.sort((left, right) => left.signal.localeCompare(right.signal));
}

export interface SEOCompetitorFinding extends SEOReportFinding {
  competitorCount: number;
  totalCompetitors: number;
}

export interface SEOCompetitorScore {
  url: string;
  score: number | null;
}

export interface SEOCompetitorComparison {
  targetUrl: string;
  competitors: SEOCompetitorScore[];
  targetScore: number | null;
  competitorAverageScore: number | null;
  scoreGap: number | null;
  targetOnlyFindings: SEOCompetitorFinding[];
  competitorOnlyFindings: SEOCompetitorFinding[];
}

/**
 * Per-severity weight applied when computing the overall score.
 * - error failures penalise 3x
 * - warning failures penalise 1x (default, also applied when severity is unset)
 * - info failures penalise 0.5x
 * This prevents low-priority category checks from unfairly dragging the
 * score down as much as a real error would.
 */
function severityWeight(severity?: string): number {
  switch (severity) {
    case 'error':
      return 3;
    case 'info':
      return 0.5;
    default:
      return 1; // 'warning' or unset
  }
}

/**
 * Calculate a severity-weighted score (0-100) across a set of check results.
 *
 * Extracted from SEOChecker as a standalone, exported, pure function so it
 * can be unit-tested directly and reused as the single source of truth for
 * the score TS reports — including reconciling it against the Rust engine's
 * separate scoring formula (see compute_score in engine/src/lib.rs, which
 * mirrors this function's weights and null-on-empty behavior exactly).
 *
 * Returns `null`, not a magic 0 or 100, when `checks` has nothing to weigh
 * (e.g. every checker disabled, or an MCP `categories` filter matching
 * nothing) — a passed/failed rate is undefined when nothing was checked,
 * and picking either constant would misreport "everything passed" or
 * "everything failed".
 */
export function calculateWeightedScore(checks: SEOCheckResult[]): number | null {
  let totalWeight = 0;
  let passedWeight = 0;

  for (const check of checks) {
    const weight = severityWeight(check.severity);
    totalWeight += weight;
    if (check.passed) passedWeight += weight;
  }

  if (totalWeight === 0) return null;
  return Math.round((passedWeight / totalWeight) * 100);
}

/** Calculate each failed check's individual counterfactual lift in linear time. */
export function calculateSEOCheckScoreLifts(
  checks: SEOCheckResult[]
): Map<SEOCheckResult, number | null> {
  const totalWeight = checks.reduce((total, check) => total + severityWeight(check.severity), 0);
  const passedWeight = checks.reduce(
    (total, check) => total + (check.passed ? severityWeight(check.severity) : 0),
    0
  );
  const currentScore = totalWeight === 0 ? null : Math.round((passedWeight / totalWeight) * 100);
  const lifts = new Map<SEOCheckResult, number | null>();

  for (const check of checks) {
    if (check.passed) continue;
    const recoveredScore =
      totalWeight === 0
        ? null
        : Math.round(((passedWeight + severityWeight(check.severity)) / totalWeight) * 100);
    lifts.set(
      check,
      currentScore === null || recoveredScore === null
        ? null
        : Math.max(0, recoveredScore - currentScore)
    );
  }
  return lifts;
}

/** Compare failed checks as a multiset so repeated rule names remain distinct. */
export function compareSEOReports(current: SEOReport, baseline: SEOReport): SEOReportComparison {
  const allCategories = Object.keys(current.checks).sort();
  const normalizeScope = (report: SEOReport): string[] => {
    const selected = report.categories ? [...new Set(report.categories)].sort() : allCategories;
    return selected.length === allCategories.length &&
      selected.every((key, index) => key === allCategories[index])
      ? allCategories
      : selected;
  };
  const currentScope = normalizeScope(current);
  const baselineScope = normalizeScope(baseline);
  if (
    currentScope.length !== baselineScope.length ||
    currentScope.some((key, index) => key !== baselineScope[index])
  ) {
    throw new Error('Cannot compare SEO reports that used different category selections.');
  }

  const baselineFailures = new Map<string, SEOReportFinding[]>();

  for (const [category, checks] of Object.entries(baseline.checks)) {
    for (const check of checks ?? []) {
      if (check.passed) continue;
      const finding = {
        category,
        name: check.name ?? check.message,
        message: check.message,
        severity: check.severity,
      };
      const key = `${category}\0${finding.name}`;
      const bucket = baselineFailures.get(key) ?? [];
      bucket.push(finding);
      baselineFailures.set(key, bucket);
    }
  }

  const newFailures: SEOReportFinding[] = [];
  for (const [category, checks] of Object.entries(current.checks)) {
    for (const check of checks ?? []) {
      if (check.passed) continue;
      const name = check.name ?? check.message;
      const key = `${category}\0${name}`;
      const baselineMatches = baselineFailures.get(key);
      if (baselineMatches?.length) {
        baselineMatches.shift();
      } else {
        newFailures.push({ category, name, message: check.message, severity: check.severity });
      }
    }
  }

  const resolvedFailures = [...baselineFailures.values()].flat();
  const scoreDelta =
    current.score === null || baseline.score === null ? null : current.score - baseline.score;

  return {
    schemaVersion: GEO_COMPARISON_SCHEMA_VERSION,
    baselineUrl: baseline.url,
    baselineTimestamp: baseline.timestamp,
    baselineScore: baseline.score,
    currentScore: current.score,
    scoreDelta,
    newFailures,
    resolvedFailures,
    geoChanges: compareGeoSignals(current, baseline),
    geoCompared: hasComparableGeoControls(current) && hasComparableGeoControls(baseline),
    geoComparedBasis: GEO_COMPARABILITY_BASIS,
  };
}

/** Compare one target report with a set of same-scope competitor audits. */
export function compareSEOWithCompetitors(
  target: SEOReport,
  competitors: SEOReport[]
): SEOCompetitorComparison {
  if (competitors.length === 0) throw new Error('At least one competitor report is required.');

  const opportunityCounts = new Map<string, { finding: SEOReportFinding; count: number }>();
  const strengthCounts = new Map<string, { finding: SEOReportFinding; count: number }>();
  for (const competitor of competitors) {
    const comparison = compareSEOReports(target, competitor);
    const recordFindings = (
      findings: SEOReportFinding[],
      bucket: Map<string, { finding: SEOReportFinding; count: number }>
    ) => {
      const seen = new Set<string>();
      for (const finding of findings) {
        const key = `${finding.category}\0${finding.name}\0${finding.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const entry = bucket.get(key) ?? { finding, count: 0 };
        entry.count += 1;
        bucket.set(key, entry);
      }
    };
    recordFindings(comparison.newFailures, opportunityCounts);
    recordFindings(comparison.resolvedFailures, strengthCounts);
  }

  const ranked = (
    bucket: Map<string, { finding: SEOReportFinding; count: number }>
  ): SEOCompetitorFinding[] =>
    [...bucket.values()]
      .map(({ finding, count }) => ({
        ...finding,
        competitorCount: count,
        totalCompetitors: competitors.length,
      }))
      .sort(
        (a, b) =>
          severityWeight(b.severity) - severityWeight(a.severity) ||
          b.competitorCount - a.competitorCount ||
          a.category.localeCompare(b.category) ||
          a.name.localeCompare(b.name)
      );

  const competitorScores = competitors
    .map(({ score }) => score)
    .filter((score): score is number => score !== null);
  const competitorAverageScore =
    competitorScores.length > 0
      ? Math.round(
          competitorScores.reduce((sum, score) => sum + score, 0) / competitorScores.length
        )
      : null;

  return {
    targetUrl: target.url,
    competitors: competitors.map(({ url, score }) => ({ url, score })),
    targetScore: target.score,
    competitorAverageScore,
    scoreGap:
      target.score === null || competitorAverageScore === null
        ? null
        : target.score - competitorAverageScore,
    targetOnlyFindings: ranked(opportunityCounts),
    competitorOnlyFindings: ranked(strengthCounts),
  };
}

/** Compare per-URL outcomes in two batch reports, preserving duplicate URLs as separate audits. */
export function compareSEOAuditBatches(
  current: SEOAuditBatchReport,
  baseline: SEOAuditBatchReport
): SEOAuditBatchComparison {
  const normalizeUrl = (value: string): string => {
    try {
      return new URL(value).href;
    } catch {
      return value;
    }
  };
  const baselineByUrl = new Map<string, SEOReport[]>();
  for (const result of baseline.results) {
    if (result.status !== 'complete') continue;
    const key = normalizeUrl(result.url);
    const reports = baselineByUrl.get(key) ?? [];
    reports.push(result.report);
    baselineByUrl.set(key, reports);
  }

  const newUrls: string[] = [];
  const newFailures: Array<SEOReportFinding & { url: string }> = [];
  const resolvedFailures: Array<SEOReportFinding & { url: string }> = [];
  const geoChanges: SEOAuditGeoSignalChange[] = [];
  let matchedPageCount = 0;
  let geoComparedPages = 0;
  const currentRequestCounts = new Map<string, number>();
  const matchedCounts = new Map<string, number>();

  for (const result of current.results) {
    const key = normalizeUrl(result.url);
    currentRequestCounts.set(key, (currentRequestCounts.get(key) ?? 0) + 1);
    if (result.status !== 'complete') continue;
    const matchingReports = baselineByUrl.get(key);
    const priorReport = matchingReports?.shift();
    if (!priorReport) {
      newUrls.push(result.url);
      continue;
    }
    matchedCounts.set(key, (matchedCounts.get(key) ?? 0) + 1);
    matchedPageCount += 1;

    const comparison = compareSEOReports(result.report, priorReport);
    newFailures.push(...comparison.newFailures.map((finding) => ({ ...finding, url: result.url })));
    resolvedFailures.push(
      ...comparison.resolvedFailures.map((finding) => ({ ...finding, url: result.url }))
    );
    geoChanges.push(...comparison.geoChanges);
    if (comparison.geoCompared) geoComparedPages += 1;
  }

  const removedUrls: string[] = [];
  for (const [url, reports] of baselineByUrl) {
    let unmatchedRequests = (currentRequestCounts.get(url) ?? 0) - (matchedCounts.get(url) ?? 0);
    for (let index = 0; index < reports.length; index += 1) {
      if (unmatchedRequests > 0) unmatchedRequests -= 1;
      else removedUrls.push(url);
    }
  }
  const sameUrlSet =
    newUrls.length === 0 &&
    removedUrls.length === 0 &&
    current.summary.failedUrls === 0 &&
    baseline.summary.failedUrls === 0;
  const scoreDelta =
    !sameUrlSet || current.summary.averageScore === null || baseline.summary.averageScore === null
      ? null
      : current.summary.averageScore - baseline.summary.averageScore;

  return {
    schemaVersion: GEO_COMPARISON_SCHEMA_VERSION,
    baselineTimestamp: baseline.timestamp,
    currentTimestamp: current.timestamp,
    baselineAverageScore: baseline.summary.averageScore,
    currentAverageScore: current.summary.averageScore,
    scoreDelta,
    newUrls,
    removedUrls,
    newFailures,
    resolvedFailures,
    geoChanges,
    geoComparedPages,
    geoUnassessedPages: matchedPageCount - geoComparedPages,
    geoComparedBasis: GEO_COMPARABILITY_BASIS,
  };
}
