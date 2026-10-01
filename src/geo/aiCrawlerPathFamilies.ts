import type {
  AiCrawlerAccessLogAnalysis,
  AiCrawlerLogGeoCorrelation,
  AiCrawlerLogSummary,
} from './aiCrawlerLogs';

type PathFamily = {
  path: string;
  requests: number;
  successfulResponses: number;
  redirects: number;
  clientErrors: number;
  serverErrors: number;
  otherResponses: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  daysBeforeCrawlerLatestRequest?: number;
  samplePaths: Map<string, number>;
  statusCodes: Map<number, number>;
  responseContentTypes: Map<string, number>;
  statusCodesTruncated: boolean;
  responseContentTypesTruncated: boolean;
};

function csvCell(value: unknown): string {
  const raw = value === undefined || value === null ? '' : String(value);
  const safe = typeof value === 'string' && /^[\s]*[=+\-@]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csvEncodedText(value: string): string {
  return /^[\s]*[=+\-@]/u.test(value) ? `'${value}` : value;
}

function restoreCsvTextField(
  row: Record<string, unknown>,
  field: string,
  candidates: Array<string | undefined>
): void {
  const current = row[field];
  if (typeof current !== 'string') return;
  const original = candidates.find(
    (candidate) => candidate !== undefined && csvEncodedText(candidate) === current
  );
  if (original !== undefined) row[field] = original;
}

function parseCsvObjects(csv: string): Array<Record<string, string>> {
  const parsedRows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (!quoted && character === ',') {
      row.push(field);
      field = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      row.push(field);
      parsedRows.push(row);
      row = [];
      field = '';
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
    } else field += character;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    parsedRows.push(row);
  }
  const headers = parsedRows[0] ?? [];
  return parsedRows
    .slice(1)
    .filter((values) => values.length > 1)
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
    );
}

function normalizePathSegment(segment: string): string {
  if (/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu.test(segment)) return ':uuid';
  if (/^\d{5,}$/u.test(segment) || /^[0-9a-f]{16,}$/iu.test(segment)) return ':id';
  return segment;
}

function pathFamily(pathValue: string, depth: number): string {
  const pathname = pathValue.split(/[?#]/u, 1)[0] || '/';
  const segments = pathname.split('/').filter(Boolean);
  const prefix = segments.slice(0, depth).map(normalizePathSegment);
  if (prefix.length === 0) return '/';
  return `/${prefix.join('/')}${segments.length > depth ? '/*' : ''}`;
}

function earlier(left: string | undefined, right: string | undefined): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

function later(left: string | undefined, right: string | undefined): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

/** Group retained AI-crawler log paths into route families for template-level crawl review. */
export function renderAiCrawlerPathFamiliesCsv(
  analyses: AiCrawlerAccessLogAnalysis[],
  pathDepth = 2
): string {
  if (!Number.isInteger(pathDepth) || pathDepth < 1 || pathDepth > 5) {
    throw new Error('Crawler path-family depth must be an integer from 1 to 5.');
  }
  const familyRows: Array<{
    analysisIndex: number;
    sourceFile: string;
    crawler: AiCrawlerLogSummary;
    family: PathFamily;
    familyCount: number;
  }> = [];
  for (const [analysisIndex, analysis] of analyses.entries()) {
    for (const crawler of analysis.crawlers) {
      const families = new Map<string, PathFamily>();
      for (const item of crawler.paths) {
        const key = pathFamily(item.path, pathDepth);
        const family = families.get(key) ?? {
          path: key,
          requests: 0,
          successfulResponses: 0,
          redirects: 0,
          clientErrors: 0,
          serverErrors: 0,
          otherResponses: 0,
          samplePaths: new Map<string, number>(),
          statusCodes: new Map<number, number>(),
          responseContentTypes: new Map<string, number>(),
          statusCodesTruncated: false,
          responseContentTypesTruncated: false,
        };
        family.requests += item.requests;
        family.successfulResponses += item.successfulResponses;
        family.redirects += item.redirects;
        family.clientErrors += item.clientErrors;
        family.serverErrors += item.serverErrors;
        family.otherResponses += item.otherResponses;
        family.samplePaths.set(item.path, (family.samplePaths.get(item.path) ?? 0) + item.requests);
        family.statusCodesTruncated ||= item.statusCodesTruncated;
        family.responseContentTypesTruncated ||= item.responseContentTypesTruncated;
        for (const status of item.statusCodes)
          family.statusCodes.set(
            status.status,
            (family.statusCodes.get(status.status) ?? 0) + status.requests
          );
        for (const contentType of item.responseContentTypes) {
          family.responseContentTypes.set(
            contentType.contentType,
            (family.responseContentTypes.get(contentType.contentType) ?? 0) + contentType.requests
          );
        }
        family.firstSeenAt = earlier(family.firstSeenAt, item.firstSeenAt);
        family.lastSeenAt = later(family.lastSeenAt, item.lastSeenAt);
        if (item.daysBeforeLatestRequest !== undefined) {
          family.daysBeforeCrawlerLatestRequest =
            family.daysBeforeCrawlerLatestRequest === undefined
              ? item.daysBeforeLatestRequest
              : Math.min(family.daysBeforeCrawlerLatestRequest, item.daysBeforeLatestRequest);
        }
        families.set(key, family);
      }
      for (const family of families.values())
        familyRows.push({
          analysisIndex: analysisIndex + 1,
          sourceFile: analysis.sourceFile ?? '',
          crawler,
          family,
          familyCount: families.size,
        });
    }
  }
  familyRows.sort(
    (left, right) =>
      right.family.requests - left.family.requests ||
      left.analysisIndex - right.analysisIndex ||
      left.crawler.token.localeCompare(right.crawler.token) ||
      left.family.path.localeCompare(right.family.path)
  );
  const rowLimit = 50_000;
  const outputRows = familyRows.slice(0, rowLimit);
  const outputRowsTruncated = familyRows.length > rowLimit;
  const headers = [
    'analysis_index',
    'source_file',
    'crawler_token',
    'provider',
    'activity',
    'path_depth',
    'path_family',
    'family_requests',
    'distinct_retained_paths',
    'successful_2xx_responses',
    'redirects_3xx',
    'client_errors_4xx',
    'server_errors_5xx',
    'other_responses',
    'failure_rate_percent',
    'first_seen_at',
    'last_seen_at',
    'family_latest_request_days_before_crawler_latest',
    'status_codes_json',
    'status_codes_truncated',
    'response_content_types_json',
    'response_content_types_truncated',
    'sample_paths_json',
    'retained_path_families_for_crawler',
    'crawler_unique_paths',
    'crawler_retained_paths',
    'crawler_paths_truncated',
    'output_rows_available',
    'output_rows_emitted',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note =
    'Path families use the first configured path segments; UUID, long numeric, and long hexadecimal segments become :uuid or :id. Rows aggregate only retained per-crawler path detail. A crawler path cap can hide families and requests. Log user-agent labels are not authenticated identities, and request evidence does not establish citation causation or page quality.';
  const rows = outputRows.map(({ analysisIndex, sourceFile, crawler, family, familyCount }) => {
    const failures = family.clientErrors + family.serverErrors;
    const statusCodes = [...family.statusCodes.entries()].sort(
      (left, right) => right[1] - left[1] || left[0] - right[0]
    );
    const contentTypes = [...family.responseContentTypes.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    );
    const samplePaths = [...family.samplePaths.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 10);
    return [
      analysisIndex,
      sourceFile,
      crawler.token,
      crawler.provider,
      crawler.activity,
      pathDepth,
      family.path,
      family.requests,
      family.samplePaths.size,
      family.successfulResponses,
      family.redirects,
      family.clientErrors,
      family.serverErrors,
      family.otherResponses,
      family.requests > 0 ? Number(((failures / family.requests) * 100).toFixed(2)) : undefined,
      family.firstSeenAt,
      family.lastSeenAt,
      family.daysBeforeCrawlerLatestRequest,
      JSON.stringify(
        statusCodes
          .slice(0, 20)
          .map(([status, requests]) => ({ status: status === 0 ? '000' : status, requests }))
      ),
      family.statusCodesTruncated || statusCodes.length > 20,
      JSON.stringify(
        contentTypes
          .slice(0, 20)
          .map(([contentType, requests]) => ({ content_type: contentType, requests }))
      ),
      family.responseContentTypesTruncated || contentTypes.length > 20,
      JSON.stringify(samplePaths.map(([path, requests]) => ({ path, requests }))),
      familyCount,
      crawler.uniquePaths,
      crawler.paths.length,
      crawler.pathsTruncated,
      familyRows.length,
      outputRows.length,
      outputRowsTruncated,
      note,
    ];
  });
  return `${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** Serialize the bounded crawler route-family inventory as typed, versioned JSON. */
export function renderAiCrawlerPathFamiliesJsonFromCsv(
  csv: string,
  analyses?: AiCrawlerAccessLogAnalysis[]
): string {
  const rows = parseCsvObjects(csv).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, raw]) => {
        if (raw === '') return [key, null];
        if (raw === 'true' || raw === 'false') return [key, raw === 'true'];
        if (key.endsWith('_json')) {
          try {
            return [key.slice(0, -5), JSON.parse(raw) as unknown];
          } catch {
            return [key, raw];
          }
        }
        if (
          /(_requests|_paths|_responses|_errors|_depth|_days|_percent|_families|_rows)$/u.test(
            key
          ) ||
          /^(analysis_index|output_rows_available|output_rows_emitted|retained_path_families_for_crawler)$/u.test(
            key
          ) ||
          key.includes('_days_before_')
        ) {
          const number = Number(raw);
          if (Number.isFinite(number)) return [key, number];
        }
        return [key, raw];
      })
    )
  );
  if (analyses) {
    for (const row of rows) {
      const analysis = analyses[Number(row.analysis_index) - 1];
      if (!analysis) continue;
      restoreCsvTextField(row, 'source_file', [analysis.sourceFile ?? '']);
      const crawler = analysis.crawlers.find(
        (candidate) => csvEncodedText(candidate.token) === row.crawler_token
      );
      if (crawler) {
        row.crawler_token = crawler.token;
        restoreCsvTextField(row, 'provider', [crawler.provider]);
        restoreCsvTextField(row, 'activity', [crawler.activity]);
      }
    }
  }
  return `${JSON.stringify({ source: 'Aviary AI crawler route-family inventory', schemaVersion: 1, rows }, null, 2)}\n`;
}

/** Compare retained crawler route families from position-paired baseline and current log samples. */
export function renderAiCrawlerPathFamilyPeriodComparisonCsv(
  baseline: AiCrawlerAccessLogAnalysis[],
  current: AiCrawlerAccessLogAnalysis[],
  pathDepth = 2
): string {
  if (!Number.isInteger(pathDepth) || pathDepth < 1 || pathDepth > 5) {
    throw new Error('Crawler path-family depth must be an integer from 1 to 5.');
  }
  if (baseline.length !== current.length) {
    throw new Error(
      'Crawler route-family comparisons require one baseline analysis paired with each current log input.'
    );
  }
  const baselineRows = parseCsvObjects(renderAiCrawlerPathFamiliesCsv(baseline, pathDepth));
  const currentRows = parseCsvObjects(renderAiCrawlerPathFamiliesCsv(current, pathDepth));
  const keyOf = (row: Record<string, string>): string =>
    `${row.analysis_index}\u0000${row.crawler_token.toLowerCase()}\u0000${row.path_family}`;
  const baselineByKey = new Map(baselineRows.map((row) => [keyOf(row), row]));
  const currentByKey = new Map(currentRows.map((row) => [keyOf(row), row]));
  const baselineOutputTruncated = baselineRows.some((row) => row.output_rows_truncated === 'true');
  const currentOutputTruncated = currentRows.some((row) => row.output_rows_truncated === 'true');
  const requestTotals = (
    rows: Record<string, string>[],
    truncated: boolean
  ): Map<string, number> => {
    const totals = new Map<string, number>();
    if (truncated) return totals;
    for (const row of rows) {
      const key = `${row.analysis_index}\u0000${row.crawler_token.toLowerCase()}`;
      totals.set(key, (totals.get(key) ?? 0) + (Number(row.family_requests) || 0));
    }
    return totals;
  };
  const baselineTotals = requestTotals(baselineRows, baselineOutputTruncated);
  const currentTotals = requestTotals(currentRows, currentOutputTruncated);
  const keys = new Set([...baselineByKey.keys(), ...currentByKey.keys()]);
  const orderedKeys = [...keys].sort((leftKey, rightKey) => {
    const left = currentByKey.get(leftKey) ?? baselineByKey.get(leftKey)!;
    const right = currentByKey.get(rightKey) ?? baselineByKey.get(rightKey)!;
    return (
      (Number(right.family_requests) || 0) - (Number(left.family_requests) || 0) ||
      Number(left.analysis_index) - Number(right.analysis_index) ||
      left.crawler_token.localeCompare(right.crawler_token) ||
      left.path_family.localeCompare(right.path_family)
    );
  });
  const rowLimit = 50_000;
  const emittedKeys = orderedKeys.slice(0, rowLimit);
  const outputTruncated = orderedKeys.length > rowLimit;
  const percent = (
    value: string | undefined,
    denominator: number | undefined
  ): number | undefined => {
    const numeric = Number(value);
    return value !== undefined && value !== '' && denominator !== undefined && denominator > 0
      ? Number(((numeric / denominator) * 100).toFixed(2))
      : undefined;
  };
  const headers = [
    'analysis_index',
    'baseline_source_file',
    'current_source_file',
    'crawler_token',
    'provider',
    'activity',
    'path_depth',
    'path_family',
    'change_state',
    'baseline_requests',
    'current_requests',
    'request_delta_on_matched_family',
    'baseline_retained_family_request_share_percent',
    'current_retained_family_request_share_percent',
    'retained_family_request_share_delta_percentage_points',
    'baseline_failure_rate_percent',
    'current_failure_rate_percent',
    'failure_rate_delta_percentage_points',
    'baseline_distinct_retained_paths',
    'current_distinct_retained_paths',
    'baseline_client_errors_4xx',
    'current_client_errors_4xx',
    'baseline_server_errors_5xx',
    'current_server_errors_5xx',
    'baseline_first_seen_at',
    'baseline_last_seen_at',
    'current_first_seen_at',
    'current_last_seen_at',
    'baseline_path_catalog_truncated',
    'current_path_catalog_truncated',
    'baseline_output_rows_truncated',
    'current_output_rows_truncated',
    'comparison_rows_available',
    'comparison_rows_emitted',
    'comparison_rows_truncated',
    'interpretation_note',
  ];
  const note =
    'Families are paired by input position, crawler token, and normalized route family at the configured path depth. One-period-only rows indicate retained-sample presence and are not zero-filled deltas; path caps can hide families. Request-share denominators use retained route-family rows and are blank when the family CSV output cap truncates either period. This is a log-sample comparison, not a crawl schedule, identity check, or citation-causation measure.';
  const outputRows = emittedKeys.map((key) => {
    const old = baselineByKey.get(key);
    const now = currentByKey.get(key);
    const representative = now ?? old!;
    const matched = Boolean(old && now);
    const baseRequests = old ? Number(old.family_requests) || 0 : undefined;
    const currentRequests = now ? Number(now.family_requests) || 0 : undefined;
    const baseShare = old
      ? percent(
          old.family_requests,
          baselineTotals.get(`${old.analysis_index}\u0000${old.crawler_token.toLowerCase()}`)
        )
      : undefined;
    const currentShare = now
      ? percent(
          now.family_requests,
          currentTotals.get(`${now.analysis_index}\u0000${now.crawler_token.toLowerCase()}`)
        )
      : undefined;
    const baseFailure =
      old && old.failure_rate_percent !== '' ? Number(old.failure_rate_percent) : undefined;
    const currentFailure =
      now && now.failure_rate_percent !== '' ? Number(now.failure_rate_percent) : undefined;
    return [
      representative.analysis_index,
      old?.source_file,
      now?.source_file,
      representative.crawler_token,
      representative.provider,
      representative.activity,
      pathDepth,
      representative.path_family,
      matched ? 'matched-retained' : old ? 'baseline-only-retained' : 'current-only-retained',
      old?.family_requests,
      now?.family_requests,
      matched ? currentRequests! - baseRequests! : undefined,
      baseShare,
      currentShare,
      matched && baseShare !== undefined && currentShare !== undefined
        ? Number((currentShare - baseShare).toFixed(2))
        : undefined,
      baseFailure,
      currentFailure,
      matched && baseFailure !== undefined && currentFailure !== undefined
        ? Number((currentFailure - baseFailure).toFixed(2))
        : undefined,
      old?.distinct_retained_paths,
      now?.distinct_retained_paths,
      old?.client_errors_4xx,
      now?.client_errors_4xx,
      old?.server_errors_5xx,
      now?.server_errors_5xx,
      old?.first_seen_at,
      old?.last_seen_at,
      now?.first_seen_at,
      now?.last_seen_at,
      old?.crawler_paths_truncated,
      now?.crawler_paths_truncated,
      baselineOutputTruncated,
      currentOutputTruncated,
      orderedKeys.length,
      emittedKeys.length,
      outputTruncated,
      note,
    ];
  });
  return `${[headers, ...outputRows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** Serialize an existing route-family period comparison as typed, versioned JSON. */
export function renderAiCrawlerPathFamilyPeriodComparisonJsonFromCsv(
  csv: string,
  baseline?: AiCrawlerAccessLogAnalysis[],
  current?: AiCrawlerAccessLogAnalysis[]
): string {
  const rows = parseCsvObjects(csv).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, raw]) => {
        if (raw === '') return [key, null];
        if (raw === 'true' || raw === 'false') return [key, raw === 'true'];
        if (key.endsWith('_json')) {
          try {
            return [key.slice(0, -5), JSON.parse(raw) as unknown];
          } catch {
            return [key, raw];
          }
        }
        if (
          /(_requests|_paths|_families|_responses|_errors|_count|_depth|_percent|_percentage_points|_retained_paths|_4xx|_5xx)$/u.test(
            key
          ) ||
          /^(analysis_index|comparison_rows_available|comparison_rows_emitted|request_delta_on_matched_family)$/u.test(
            key
          )
        ) {
          const number = Number(raw);
          if (Number.isFinite(number)) return [key, number];
        }
        return [key, raw];
      })
    )
  );
  if (baseline && current) {
    for (const row of rows) {
      const index = Number(row.analysis_index) - 1;
      const before = baseline[index];
      const after = current[index];
      if (!before || !after) continue;
      restoreCsvTextField(row, 'baseline_source_file', [before.sourceFile ?? '']);
      restoreCsvTextField(row, 'current_source_file', [after.sourceFile ?? '']);
      const crawler = after.crawlers.find(
        (candidate) => csvEncodedText(candidate.token) === row.crawler_token
      );
      if (crawler) {
        row.crawler_token = crawler.token;
        restoreCsvTextField(row, 'provider', [crawler.provider]);
        restoreCsvTextField(row, 'activity', [crawler.activity]);
      }
    }
  }
  return `${JSON.stringify(
    {
      source: 'Aviary AI crawler route-family period comparison',
      schemaVersion: 1,
      rows,
    },
    null,
    2
  )}\n`;
}

export interface AiCrawlerPathFamilyFailureRise {
  analysisIndex: number;
  crawlerToken: string;
  pathFamily: string;
  baselineRequests: number;
  currentRequests: number;
  baselineFailureRatePercent: number;
  currentFailureRatePercent: number;
  increasePercentagePoints: number;
}

export interface AiCrawlerPathFamilyFailureGateResult {
  thresholdPercentagePoints: number;
  minimumRequestsPerPeriod: number;
  matchedFamilies: number;
  matchedFamiliesBelowSupport: number;
  matchedFamiliesCompared: number;
  supportInsufficient: boolean;
  familiesAboveThreshold: AiCrawlerPathFamilyFailureRise[];
  baselinePathCatalogTruncated: boolean;
  currentPathCatalogTruncated: boolean;
  baselineOutputRowsTruncated: boolean;
  currentOutputRowsTruncated: boolean;
  incomplete: boolean;
}

/** Render a versioned JSON artifact for CI and review clients. */
export function renderAiCrawlerPathFamilyFailureGateJson(
  assessment: AiCrawlerPathFamilyFailureGateResult
): string {
  return `${JSON.stringify(
    {
      source: 'Aviary AI crawler route-family failure gate',
      schemaVersion: 1,
      ...assessment,
    },
    null,
    2
  )}\n`;
}

/** Assess matched route-family failure-rate increases with explicit support and truncation state. */
export function assessAiCrawlerPathFamilyFailureRise(
  baseline: AiCrawlerAccessLogAnalysis[],
  current: AiCrawlerAccessLogAnalysis[],
  thresholdPercentagePoints: number,
  pathDepth = 2,
  minimumRequestsPerPeriod = 10
): AiCrawlerPathFamilyFailureGateResult {
  if (
    !Number.isFinite(thresholdPercentagePoints) ||
    thresholdPercentagePoints < 0 ||
    thresholdPercentagePoints > 100
  ) {
    throw new Error(
      'Crawler route-family failure-rise threshold must be from 0 to 100 percentage points.'
    );
  }
  if (!Number.isInteger(minimumRequestsPerPeriod) || minimumRequestsPerPeriod < 1) {
    throw new Error(
      'Crawler route-family failure-rise minimum request support must be a positive integer.'
    );
  }
  if (baseline.length !== current.length) {
    throw new Error(
      'Crawler route-family failure checks require one baseline analysis paired with each current log input.'
    );
  }
  const baselineRows = parseCsvObjects(renderAiCrawlerPathFamiliesCsv(baseline, pathDepth));
  const currentRows = parseCsvObjects(renderAiCrawlerPathFamiliesCsv(current, pathDepth));
  const keyOf = (row: Record<string, string>): string =>
    `${row.analysis_index}\u0000${row.crawler_token.toLowerCase()}\u0000${row.path_family}`;
  const baselineByKey = new Map(baselineRows.map((row) => [keyOf(row), row]));
  const currentByKey = new Map(currentRows.map((row) => [keyOf(row), row]));
  const baselinePathCatalogTruncated = baseline.some((analysis) =>
    analysis.crawlers.some((crawler) => crawler.pathsTruncated)
  );
  const currentPathCatalogTruncated = current.some((analysis) =>
    analysis.crawlers.some((crawler) => crawler.pathsTruncated)
  );
  const baselineOutputRowsTruncated = baselineRows.some(
    (row) => row.output_rows_truncated === 'true'
  );
  const currentOutputRowsTruncated = currentRows.some(
    (row) => row.output_rows_truncated === 'true'
  );
  const rises: AiCrawlerPathFamilyFailureRise[] = [];
  let matchedFamilies = 0;
  let matchedFamiliesBelowSupport = 0;
  let matchedFamiliesCompared = 0;
  for (const [key, old] of baselineByKey) {
    const now = currentByKey.get(key);
    if (!now) continue;
    matchedFamilies += 1;
    const baselineRequests = Number(old.family_requests) || 0;
    const currentRequests = Number(now.family_requests) || 0;
    if (baselineRequests < minimumRequestsPerPeriod || currentRequests < minimumRequestsPerPeriod) {
      matchedFamiliesBelowSupport += 1;
      continue;
    }
    if (old.failure_rate_percent === '' || now.failure_rate_percent === '') continue;
    matchedFamiliesCompared += 1;
    const baselineFailures =
      (Number(old.client_errors_4xx) || 0) + (Number(old.server_errors_5xx) || 0);
    const currentFailures =
      (Number(now.client_errors_4xx) || 0) + (Number(now.server_errors_5xx) || 0);
    const baselineFailureRatePercent = Number(
      ((baselineFailures / baselineRequests) * 100).toFixed(4)
    );
    const currentFailureRatePercent = Number(
      ((currentFailures / currentRequests) * 100).toFixed(4)
    );
    const increasePercentagePoints = Number(
      (currentFailureRatePercent - baselineFailureRatePercent).toFixed(4)
    );
    if (increasePercentagePoints > thresholdPercentagePoints) {
      rises.push({
        analysisIndex: Number(old.analysis_index),
        crawlerToken: old.crawler_token,
        pathFamily: old.path_family,
        baselineRequests,
        currentRequests,
        baselineFailureRatePercent,
        currentFailureRatePercent,
        increasePercentagePoints,
      });
    }
  }
  return {
    thresholdPercentagePoints,
    minimumRequestsPerPeriod,
    matchedFamilies,
    matchedFamiliesBelowSupport,
    matchedFamiliesCompared,
    supportInsufficient: matchedFamiliesCompared === 0,
    familiesAboveThreshold: rises.sort(
      (left, right) =>
        right.increasePercentagePoints - left.increasePercentagePoints ||
        right.currentRequests - left.currentRequests ||
        left.crawlerToken.localeCompare(right.crawlerToken) ||
        left.pathFamily.localeCompare(right.pathFamily)
    ),
    baselinePathCatalogTruncated,
    currentPathCatalogTruncated,
    baselineOutputRowsTruncated,
    currentOutputRowsTruncated,
    incomplete:
      baselinePathCatalogTruncated ||
      currentPathCatalogTruncated ||
      baselineOutputRowsTruncated ||
      currentOutputRowsTruncated,
  };
}

/** Render a bounded, offline review page for matched and one-period-only route-family changes. */
export function renderAiCrawlerPathFamilyPeriodComparisonHtml(
  baseline: AiCrawlerAccessLogAnalysis[],
  current: AiCrawlerAccessLogAnalysis[],
  pathDepth = 2
): string {
  const rows = parseCsvObjects(
    renderAiCrawlerPathFamilyPeriodComparisonCsv(baseline, current, pathDepth)
  );
  const htmlLimit = 10_000;
  const viewRows = rows.slice(0, htmlLimit).map((row) => ({
    crawler_token: row.crawler_token,
    provider: row.provider,
    activity: row.activity,
    path_family: row.path_family,
    change_state: row.change_state,
    baseline_requests: row.baseline_requests,
    current_requests: row.current_requests,
    request_delta_on_matched_family: row.request_delta_on_matched_family,
    baseline_retained_family_request_share_percent:
      row.baseline_retained_family_request_share_percent,
    current_retained_family_request_share_percent:
      row.current_retained_family_request_share_percent,
    retained_family_request_share_delta_percentage_points:
      row.retained_family_request_share_delta_percentage_points,
    baseline_failure_rate_percent: row.baseline_failure_rate_percent,
    current_failure_rate_percent: row.current_failure_rate_percent,
    failure_rate_delta_percentage_points: row.failure_rate_delta_percentage_points,
    baseline_path_catalog_truncated: row.baseline_path_catalog_truncated,
    current_path_catalog_truncated: row.current_path_catalog_truncated,
    baseline_output_rows_truncated: row.baseline_output_rows_truncated,
    current_output_rows_truncated: row.current_output_rows_truncated,
  }));
  const safeJson = JSON.stringify(viewRows)
    .replace(/</g, '\\u003c')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const countState = (state: string): number =>
    rows.filter((row) => row.change_state === state).length;
  const matchedRows = rows.filter((row) => row.change_state === 'matched-retained');
  const failureIncreases = matchedRows.filter(
    (row) => Number(row.failure_rate_delta_percentage_points) > 0
  ).length;
  const truncated = rows.some(
    (row) =>
      row.comparison_rows_truncated === 'true' ||
      row.baseline_output_rows_truncated === 'true' ||
      row.current_output_rows_truncated === 'true'
  );
  const style = `:root{font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#18232d;background:#f3f6f8;--line:#dbe2e8;--muted:#61717e;--blue:#187b9c;--orange:#c56e28}*{box-sizing:border-box}body{margin:0}main{max-width:1280px;margin:auto;padding:32px 24px 56px}h1{font-size:28px;letter-spacing:-.02em;margin:0}h2{font-size:17px;margin:0 0 14px}.lede,.note{color:var(--muted);max-width:95ch}.lede{margin:8px 0 22px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0}.metric,.panel{background:#fff;border:1px solid var(--line);border-radius:12px}.metric{padding:14px 16px}.metric strong{display:block;font-size:21px}.metric span{color:var(--muted);font-size:12px}.panel{padding:18px;margin:14px 0}.controls{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}.controls label{font-size:12px;color:var(--muted);display:grid;gap:5px}.controls select{min-width:190px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:8px;color:#18232d}.chart-scroll{overflow:auto}.chart-scroll svg{min-width:850px;width:100%;height:auto}.chart-scroll text{font:11px system-ui,sans-serif;fill:#5e6e7b}.track{fill:#edf1f4}.bar.up{fill:#187b9c}.bar.down{fill:#c56e28}.zero{stroke:#9caab4;stroke-width:1}.table-scroll{overflow:auto;max-height:590px;border:1px solid var(--line);border-radius:9px}table{width:100%;border-collapse:collapse;background:#fff;font-size:12px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}th{position:sticky;top:0;background:#edf2f5;color:#33434f}.state{font-weight:600}.note{font-size:12px}@media(max-width:760px){main{padding:22px 14px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI crawler route-family comparison</title><style>${style}</style></head><body><main><header><h1>AI crawler route-family comparison</h1><p class="lede">Matched route families compare request volume and failure share across paired crawler-log samples. One-period-only families remain presence observations, and path or output caps stay visible.</p></header><section class="metrics"><div class="metric"><strong>${matchedRows.length.toLocaleString('en')}</strong><span>matched route families</span></div><div class="metric"><strong>${countState('baseline-only-retained').toLocaleString('en')}</strong><span>baseline-only retained families</span></div><div class="metric"><strong>${countState('current-only-retained').toLocaleString('en')}</strong><span>current-only retained families</span></div><div class="metric"><strong>${failureIncreases.toLocaleString('en')}</strong><span>matched families with higher 4xx/5xx share</span></div></section><section class="panel"><h2>Largest request-volume changes</h2><div class="controls"><label>Crawler<select id="crawler-filter"></select></label><label>Presence state<select id="state-filter"></select></label></div><div class="chart-scroll"><svg id="change-chart" viewBox="0 0 1000 620" role="img" aria-label="Largest matched route-family request changes"></svg></div></section><section class="panel"><h2>Family detail</h2><div class="table-scroll"><table><thead><tr><th>Crawler</th><th>Route family</th><th>State</th><th>Baseline requests</th><th>Current requests</th><th>Request delta</th><th>Retained share delta</th><th>Failure rate baseline</th><th>Failure rate current</th><th>Failure rate delta</th><th>Path cap baseline/current</th></tr></thead><tbody id="comparison-rows"></tbody></table></div></section><p class="note">Request and failure deltas appear only for matched retained families. Share is within the retained family catalog and is blank when the CSV output cap prevents a complete denominator; crawler path caps can hide families. Counts describe the supplied log samples, not provider crawl schedules or citation effects.</p>${truncated ? '<p class="note">The CSV comparison hit its row cap; catalog shares are suppressed and unmatched rows may be omitted.</p>' : ''}${rows.length > htmlLimit ? `<p class="note">The dashboard keeps the first ${htmlLimit.toLocaleString('en')} request-ranked rows of ${rows.length.toLocaleString('en')}; use the CSV for the full retained comparison.</p>` : ''}<script type="application/json" id="comparison-data">${safeJson}</script><script>
    const rows=JSON.parse(document.getElementById('comparison-data').textContent),crawler=document.getElementById('crawler-filter'),state=document.getElementById('state-filter');
    function fill(select,values){const all=document.createElement('option');all.value='';all.textContent='All';select.append(all);for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option)}}
    fill(crawler,[...new Set(rows.map(r=>r.crawler_token))].sort((a,b)=>a.localeCompare(b)));fill(state,[...new Set(rows.map(r=>r.change_state))].sort());
    function selected(){return rows.filter(r=>(!crawler.value||r.crawler_token===crawler.value)&&(!state.value||r.change_state===state.value))}
    function svg(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;return el}
    function draw(){const chosen=selected(),chart=document.getElementById('change-chart'),body=document.getElementById('comparison-rows');chart.replaceChildren();body.replaceChildren();const top=chosen.filter(r=>r.change_state==='matched-retained'&&r.request_delta_on_matched_family!=='').sort((a,b)=>Math.abs(Number(b.request_delta_on_matched_family))-Math.abs(Number(a.request_delta_on_matched_family))).slice(0,20),max=Math.max(1,...top.map(r=>Math.abs(Number(r.request_delta_on_matched_family)||0))),height=Math.max(180,44+top.length*28);chart.setAttribute('viewBox','0 0 1000 '+height);chart.append(svg('line',{x1:610,y1:8,x2:610,y2:height-8,class:'zero'}));if(!top.length)chart.append(svg('text',{x:500,y:90,'text-anchor':'middle'},'No matched request deltas for this filter.'));top.forEach((r,i)=>{const delta=Number(r.request_delta_on_matched_family)||0,y=22+i*28,width=270*Math.abs(delta)/max;chart.append(svg('text',{x:10,y:y+12},r.crawler_token+' · '+r.path_family));chart.append(svg('rect',{x:340,y,width:540,height:13,rx:6,class:'track'}));chart.append(svg('rect',{x:delta<0?610-width:610,y,width:width.toFixed(1),height:13,rx:6,class:delta<0?'bar down':'bar up'}));chart.append(svg('text',{x:890,y:y+11},(delta>0?'+':'')+delta.toLocaleString('en')+' requests'))});for(const r of chosen.slice(0,1000)){const tr=document.createElement('tr'),cells=[r.crawler_token,r.path_family,r.change_state,r.baseline_requests,r.current_requests,r.request_delta_on_matched_family,r.retained_family_request_share_delta_percentage_points===''?'':r.retained_family_request_share_delta_percentage_points+' pp',r.baseline_failure_rate_percent===''?'':r.baseline_failure_rate_percent+'%',r.current_failure_rate_percent===''?'':r.current_failure_rate_percent+'%',r.failure_rate_delta_percentage_points===''?'':r.failure_rate_delta_percentage_points+' pp',[r.baseline_path_catalog_truncated,r.current_path_catalog_truncated].join(' / ')];for(let i=0;i<cells.length;i++){const td=document.createElement('td');td.textContent=cells[i]===undefined||cells[i]===''?'—':String(cells[i]);if(i===2)td.className='state';tr.append(td)}body.append(tr)}if(chosen.length>1000){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=11;td.textContent='Showing the first 1,000 filtered rows.';tr.append(td);body.append(tr)}}
    crawler.addEventListener('change',draw);state.addEventListener('change',draw);draw();
    </script></main></body></html>`;
}

/** Render an offline, filterable route-family dashboard from retained AI-crawler paths. */
export function renderAiCrawlerPathFamiliesHtml(
  analyses: AiCrawlerAccessLogAnalysis[],
  pathDepth = 2
): string {
  const csv = renderAiCrawlerPathFamiliesCsv(analyses, pathDepth);
  const allRows = parseCsvObjects(csv);
  const htmlRowLimit = 10_000;
  const viewRows = allRows.slice(0, htmlRowLimit).map((item) => ({
    source_file: item.source_file,
    crawler_token: item.crawler_token,
    provider: item.provider,
    activity: item.activity,
    path_family: item.path_family,
    family_requests: item.family_requests,
    distinct_retained_paths: item.distinct_retained_paths,
    successful_2xx_responses: item.successful_2xx_responses,
    redirects_3xx: item.redirects_3xx,
    client_errors_4xx: item.client_errors_4xx,
    server_errors_5xx: item.server_errors_5xx,
    failure_rate_percent: item.failure_rate_percent,
    first_seen_at: item.first_seen_at,
    last_seen_at: item.last_seen_at,
    crawler_paths_truncated: item.crawler_paths_truncated,
  }));
  const safeJson = JSON.stringify(viewRows)
    .replace(/</g, '\\u003c')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const sum = (key: string): number =>
    allRows.reduce((total, item) => total + (Number(item[key]) || 0), 0);
  const totalRequests = sum('family_requests');
  const failedRequests = sum('client_errors_4xx') + sum('server_errors_5xx');
  const cappedCrawlers = new Set(
    allRows
      .filter((item) => item.crawler_paths_truncated === 'true')
      .map((item) => `${item.analysis_index}:${item.crawler_token}`)
  ).size;
  const style = `:root{font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#17212b;background:#f3f6f8;--line:#dbe2e8;--muted:#62707c;--blue:#187b9c;--orange:#c56e28}*{box-sizing:border-box}body{margin:0}main{max-width:1280px;margin:0 auto;padding:32px 24px 56px}h1{font-size:28px;letter-spacing:-.02em;margin:0}h2{font-size:17px;margin:0 0 14px}p{color:var(--muted);max-width:90ch}.lede{margin:8px 0 22px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0}.metric,.panel{background:#fff;border:1px solid var(--line);border-radius:12px}.metric{padding:14px 16px}.metric strong{display:block;font-size:21px}.metric span{color:var(--muted);font-size:12px}.panel{padding:18px;margin:14px 0}.controls{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}.controls label{font-size:12px;color:var(--muted);display:grid;gap:5px}.controls select{min-width:190px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:8px;color:#17212b}.chart-scroll{overflow:auto}.chart-scroll svg{min-width:850px;width:100%;height:auto}.chart-scroll text{font:11px system-ui,sans-serif;fill:#5e6e7b}.track{fill:#edf1f4}.bar{fill:#187b9c}.bar.high-error{fill:#c56e28}.table-scroll{overflow:auto;max-height:590px;border:1px solid var(--line);border-radius:9px}table{width:100%;border-collapse:collapse;background:#fff;font-size:12px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}th{position:sticky;top:0;background:#edf2f5;color:#33434f}.status{white-space:normal;min-width:190px}.note{font-size:12px}.empty{padding:24px;text-align:center;color:var(--muted)}@media(max-width:760px){main{padding:22px 14px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI crawler route families</title><style>${style}</style></head><body><main><header><h1>AI crawler route families</h1><p class="lede">Observed request activity grouped by leading path segments and crawler token. Long numeric IDs, UUIDs, and long hexadecimal IDs have been normalized for route-shape review.</p></header><section class="metrics"><div class="metric"><strong>${allRows.length.toLocaleString('en')}</strong><span>retained route-family rows</span></div><div class="metric"><strong>${totalRequests.toLocaleString('en')}</strong><span>requests represented in retained rows</span></div><div class="metric"><strong>${totalRequests > 0 ? `${((failedRequests / totalRequests) * 100).toFixed(1)}%` : '—'}</strong><span>observed 4xx/5xx share in retained rows</span></div><div class="metric"><strong>${cappedCrawlers.toLocaleString('en')}</strong><span>crawler samples with a capped path catalog</span></div></section><section class="panel"><h2>Most requested route families</h2><div class="controls"><label>Crawler<select id="crawler-filter"></select></label><label>Log file<select id="file-filter"></select></label></div><div class="chart-scroll"><svg id="family-chart" viewBox="0 0 1000 620" role="img" aria-label="Most requested AI-crawler route families"></svg></div></section><section class="panel"><h2>Route-family detail</h2><div class="table-scroll"><table><thead><tr><th>Log file</th><th>Crawler</th><th>Provider / activity</th><th>Path family</th><th>Requests</th><th>Paths</th><th>2xx / 3xx / 4xx / 5xx</th><th>Failure share</th><th>First seen</th><th>Last seen</th><th>Path cap</th></tr></thead><tbody id="family-rows"></tbody></table></div></section><p class="note">The dashboard summarizes only retained per-crawler paths; capped catalogs may omit families and requests. User-agent tokens are log claims, not authenticated identities. Request counts do not establish that a model indexed, selected, or cited a page.</p>${allRows.length > htmlRowLimit ? `<p class="note">The dashboard keeps the first ${htmlRowLimit.toLocaleString('en')} request-ranked family rows of ${allRows.length.toLocaleString('en')}; the CSV carries its output-cap state.</p>` : ''}<script type="application/json" id="family-data">${safeJson}</script><script>
    const rows=JSON.parse(document.getElementById('family-data').textContent),crawler=document.getElementById('crawler-filter'),file=document.getElementById('file-filter');
    function fill(select,values){const all=document.createElement('option');all.value='';all.textContent='All';select.append(all);for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option)}}
    fill(crawler,[...new Set(rows.map(r=>r.crawler_token))].sort((a,b)=>a.localeCompare(b)));fill(file,[...new Set(rows.map(r=>r.source_file))].sort((a,b)=>a.localeCompare(b)));
    function selected(){return rows.filter(r=>(!crawler.value||r.crawler_token===crawler.value)&&(!file.value||r.source_file===file.value))}
    function svg(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;return el}
    function draw(){const chosen=selected(),chart=document.getElementById('family-chart'),body=document.getElementById('family-rows');chart.replaceChildren();body.replaceChildren();const top=[...chosen].sort((a,b)=>(Number(b.family_requests)||0)-(Number(a.family_requests)||0)).slice(0,20),max=Math.max(1,...top.map(r=>Number(r.family_requests)||0)),height=Math.max(180,44+top.length*27);chart.setAttribute('viewBox','0 0 1000 '+height);if(!top.length)chart.append(svg('text',{x:500,y:90,'text-anchor':'middle'},'No retained route-family rows match this filter.'));top.forEach((r,i)=>{const y=24+i*27,requests=Number(r.family_requests)||0,rate=Number(r.failure_rate_percent)||0,width=560*requests/max;chart.append(svg('text',{x:12,y:y+12},r.path_family));chart.append(svg('rect',{x:330,y,width:560,height:13,rx:6,class:'track'}));chart.append(svg('rect',{x:330,y,width:width.toFixed(1),height:13,rx:6,class:rate>1?'bar high-error':'bar'}));chart.append(svg('text',{x:900,y:y+11},requests.toLocaleString('en')+' requests · '+rate.toFixed(1)+'% 4xx/5xx'))});for(const r of chosen.slice(0,1000)){const tr=document.createElement('tr'),cells=[r.source_file,r.crawler_token,r.provider+' · '+r.activity,r.path_family,r.family_requests,r.distinct_retained_paths,[r.successful_2xx_responses,r.redirects_3xx,r.client_errors_4xx,r.server_errors_5xx].join(' / '),r.failure_rate_percent===''?'':r.failure_rate_percent+'%',r.first_seen_at,r.last_seen_at,r.crawler_paths_truncated];for(let i=0;i<cells.length;i++){const td=document.createElement('td');td.textContent=cells[i]===undefined||cells[i]===''?'—':String(cells[i]);if(i===2)td.className='status';tr.append(td)}body.append(tr)}if(chosen.length>1000){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=11;td.textContent='Showing the first 1,000 filtered rows.';tr.append(td);body.append(tr)}}
    crawler.addEventListener('change',draw);file.addEventListener('change',draw);draw();
    </script></main></body></html>`;
}

/** Aggregate exact-path crawler/audit joins into template families without filling unobserved audit states. */
export function renderAiCrawlerPathFamilyAuditCorrelationCsv(
  correlations: AiCrawlerLogGeoCorrelation[],
  pathDepth = 2
): string {
  if (!Number.isInteger(pathDepth) || pathDepth < 1 || pathDepth > 5) {
    throw new Error('Crawler path-family depth must be an integer from 1 to 5.');
  }
  type FamilyAuditStats = {
    analysisIndex: number;
    sourceFile: string;
    origin: string;
    auditTimestamp: string;
    crawlerToken: string;
    provider: string;
    activity: string;
    family: string;
    pathCount: number;
    requests: number;
    firstSeenAt?: string;
    lastSeenAt?: string;
    matchedRequests: number;
    ambiguousRequests: number;
    notInAuditRequests: number;
    notApplicableRequests: number;
    clientErrorRequests: number;
    serverErrorRequests: number;
    robotsBlockedRequests: number;
    noindexRequests: number;
    snippetRestrictedRequests: number;
    answerMeasuredRequests: number;
    questionHeadingObservedRequests: number;
    requestsWithQuestionHeadings: number;
    questionHeadingCount: number;
    conciseAnswerObservedRequests: number;
    requestsWithConciseAnswerBlocks: number;
    conciseAnswerBlockCount: number;
    visibleAuthorObservedRequests: number;
    requestsWithVisibleAuthor: number;
    visibleDateObservedRequests: number;
    requestsWithVisibleDate: number;
    citationEvidenceMeasuredRequests: number;
    externalSourceObservedRequests: number;
    requestsWithExternalSourceLinks: number;
    externalSourceLinkCount: number;
    inlineCitationObservedRequests: number;
    requestsWithInlineCitationMarkers: number;
    inlineCitationMarkerCount: number;
    unresolvedTargetObservedRequests: number;
    requestsWithUnresolvedCitationTargets: number;
    unresolvedCitationTargetCount: number;
    reviewSignalRequests: Map<string, number>;
    auditPagesSkipped: number;
    inputPathsTruncated: boolean;
    pathObservationsTruncated: boolean;
  };
  const grouped = new Map<string, FamilyAuditStats>();
  for (const [correlationIndex, correlation] of correlations.entries()) {
    for (const observation of correlation.pathObservations) {
      const family = pathFamily(observation.path, pathDepth);
      const key = `${correlationIndex + 1}\u0000${observation.crawlerToken.toLowerCase()}\u0000${family}`;
      let stats = grouped.get(key);
      if (!stats) {
        stats = {
          analysisIndex: correlationIndex + 1,
          sourceFile: correlation.sourceFile ?? '',
          origin: correlation.origin,
          auditTimestamp: correlation.auditTimestamp,
          crawlerToken: observation.crawlerToken,
          provider: observation.provider,
          activity: observation.activity,
          family,
          pathCount: 0,
          requests: 0,
          matchedRequests: 0,
          ambiguousRequests: 0,
          notInAuditRequests: 0,
          notApplicableRequests: 0,
          clientErrorRequests: 0,
          serverErrorRequests: 0,
          robotsBlockedRequests: 0,
          noindexRequests: 0,
          snippetRestrictedRequests: 0,
          answerMeasuredRequests: 0,
          questionHeadingObservedRequests: 0,
          requestsWithQuestionHeadings: 0,
          questionHeadingCount: 0,
          conciseAnswerObservedRequests: 0,
          requestsWithConciseAnswerBlocks: 0,
          conciseAnswerBlockCount: 0,
          visibleAuthorObservedRequests: 0,
          requestsWithVisibleAuthor: 0,
          visibleDateObservedRequests: 0,
          requestsWithVisibleDate: 0,
          citationEvidenceMeasuredRequests: 0,
          externalSourceObservedRequests: 0,
          requestsWithExternalSourceLinks: 0,
          externalSourceLinkCount: 0,
          inlineCitationObservedRequests: 0,
          requestsWithInlineCitationMarkers: 0,
          inlineCitationMarkerCount: 0,
          unresolvedTargetObservedRequests: 0,
          requestsWithUnresolvedCitationTargets: 0,
          unresolvedCitationTargetCount: 0,
          reviewSignalRequests: new Map<string, number>(),
          auditPagesSkipped: correlation.auditPathCoverage.auditPagesSkipped,
          inputPathsTruncated: correlation.inputPathsTruncated,
          pathObservationsTruncated: correlation.pathObservationsTruncated,
        };
        grouped.set(key, stats);
      }
      const requests = observation.requests;
      stats.pathCount += 1;
      stats.requests += requests;
      stats.firstSeenAt = earlier(stats.firstSeenAt, observation.firstSeenAt);
      stats.lastSeenAt = later(stats.lastSeenAt, observation.lastSeenAt);
      stats.inputPathsTruncated ||= correlation.inputPathsTruncated;
      stats.pathObservationsTruncated ||= correlation.pathObservationsTruncated;
      if (observation.auditMatchType === 'matched') stats.matchedRequests += requests;
      else if (observation.auditMatchType === 'ambiguous') stats.ambiguousRequests += requests;
      else if (observation.auditMatchType === 'not-in-audit') stats.notInAuditRequests += requests;
      else stats.notApplicableRequests += requests;
      stats.clientErrorRequests += observation.clientErrors;
      stats.serverErrorRequests += observation.serverErrors;
      if (observation.currentRobotsAccess === 'blocked') stats.robotsBlockedRequests += requests;
      if (observation.currentNoindex) stats.noindexRequests += requests;
      if (observation.currentNoSnippet || observation.currentMaxSnippetZero)
        stats.snippetRestrictedRequests += requests;
      if (observation.answerContentCoverage === 'measured')
        stats.answerMeasuredRequests += requests;
      if (typeof observation.currentQuestionHeadings === 'number') {
        stats.questionHeadingObservedRequests += requests;
        stats.questionHeadingCount += requests * observation.currentQuestionHeadings;
        if (observation.currentQuestionHeadings > 0) stats.requestsWithQuestionHeadings += requests;
      }
      if (typeof observation.currentConciseAnswerBlocks === 'number') {
        stats.conciseAnswerObservedRequests += requests;
        stats.conciseAnswerBlockCount += requests * observation.currentConciseAnswerBlocks;
        if (observation.currentConciseAnswerBlocks > 0)
          stats.requestsWithConciseAnswerBlocks += requests;
      }
      if (typeof observation.currentVisibleAuthor === 'boolean') {
        stats.visibleAuthorObservedRequests += requests;
        if (observation.currentVisibleAuthor) stats.requestsWithVisibleAuthor += requests;
      }
      if (typeof observation.currentVisibleDate === 'boolean') {
        stats.visibleDateObservedRequests += requests;
        if (observation.currentVisibleDate) stats.requestsWithVisibleDate += requests;
      }
      if (observation.citationEvidenceCoverage === 'measured')
        stats.citationEvidenceMeasuredRequests += requests;
      if (typeof observation.currentExternalSourceLinkCount === 'number') {
        stats.externalSourceObservedRequests += requests;
        stats.externalSourceLinkCount += requests * observation.currentExternalSourceLinkCount;
        if (observation.currentExternalSourceLinkCount > 0)
          stats.requestsWithExternalSourceLinks += requests;
      }
      if (typeof observation.currentInlineCitationMarkerCount === 'number') {
        stats.inlineCitationObservedRequests += requests;
        stats.inlineCitationMarkerCount += requests * observation.currentInlineCitationMarkerCount;
        if (observation.currentInlineCitationMarkerCount > 0)
          stats.requestsWithInlineCitationMarkers += requests;
      }
      if (typeof observation.currentUnresolvedCitationTargetCount === 'number') {
        stats.unresolvedTargetObservedRequests += requests;
        stats.unresolvedCitationTargetCount +=
          requests * observation.currentUnresolvedCitationTargetCount;
        if (observation.currentUnresolvedCitationTargetCount > 0)
          stats.requestsWithUnresolvedCitationTargets += requests;
      }
      for (const signal of observation.reviewSignals ?? []) {
        stats.reviewSignalRequests.set(
          signal,
          (stats.reviewSignalRequests.get(signal) ?? 0) + requests
        );
      }
    }
  }
  const sorted = [...grouped.values()].sort(
    (left, right) =>
      right.requests - left.requests ||
      left.analysisIndex - right.analysisIndex ||
      left.crawlerToken.localeCompare(right.crawlerToken) ||
      left.family.localeCompare(right.family)
  );
  const rowLimit = 50_000;
  const rows = sorted.slice(0, rowLimit);
  const csvShare = (value: number, denominator: number): number | undefined =>
    denominator > 0 ? Number(((value / denominator) * 100).toFixed(2)) : undefined;
  const csvMean = (weightedSum: number, denominator: number): number | undefined =>
    denominator > 0 ? Number((weightedSum / denominator).toFixed(3)) : undefined;
  const headers = [
    'analysis_index',
    'source_file',
    'origin',
    'audit_timestamp',
    'crawler_token',
    'provider',
    'activity',
    'path_depth',
    'path_family',
    'retained_paths',
    'retained_requests',
    'matched_audit_requests',
    'ambiguous_audit_requests',
    'not_in_audit_requests',
    'not_applicable_requests',
    'client_error_requests',
    'server_error_requests',
    'current_robots_blocked_requests',
    'current_noindex_requests',
    'current_snippet_restricted_requests',
    'answer_content_measured_requests',
    'question_heading_observed_requests',
    'requests_on_pages_with_question_headings',
    'question_heading_request_share_percent',
    'weighted_mean_question_headings_per_observed_request',
    'concise_answer_observed_requests',
    'requests_on_pages_with_concise_answer_blocks',
    'concise_answer_request_share_percent',
    'weighted_mean_concise_answer_blocks_per_observed_request',
    'visible_author_observed_requests',
    'requests_on_pages_with_visible_author',
    'visible_date_observed_requests',
    'requests_on_pages_with_visible_date',
    'citation_evidence_measured_requests',
    'external_source_observed_requests',
    'requests_on_pages_with_external_source_links',
    'external_source_request_share_percent',
    'weighted_mean_external_source_links_per_observed_request',
    'inline_citation_observed_requests',
    'requests_on_pages_with_inline_citation_markers',
    'inline_citation_request_share_percent',
    'weighted_mean_inline_citation_markers_per_observed_request',
    'unresolved_target_observed_requests',
    'requests_on_pages_with_unresolved_citation_targets',
    'weighted_mean_unresolved_citation_targets_per_observed_request',
    'review_signal_request_counts_json',
    'first_seen_at',
    'last_seen_at',
    'audit_pages_skipped',
    'crawler_path_catalog_truncated',
    'audit_path_observations_truncated',
    'output_rows_available',
    'output_rows_emitted',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const note =
    'Rows aggregate retained exact-path request observations into leading path-segment families. Audit signals are request-weighted, current audit-snapshot properties, not measurements captured at request time or evidence of citation causation. Shares use only requests with a value observed for that specific signal; unmatched, ambiguous, unassessed, and truncated coverage is kept distinct. Review-signal request counts overlap because one request may carry multiple cues. User-agent labels are claims, and path/audit caps may omit activity.';
  const outputTruncated = sorted.length > rowLimit;
  const outputRows = rows.map((item) => [
    item.analysisIndex,
    item.sourceFile,
    item.origin,
    item.auditTimestamp,
    item.crawlerToken,
    item.provider,
    item.activity,
    pathDepth,
    item.family,
    item.pathCount,
    item.requests,
    item.matchedRequests,
    item.ambiguousRequests,
    item.notInAuditRequests,
    item.notApplicableRequests,
    item.clientErrorRequests,
    item.serverErrorRequests,
    item.robotsBlockedRequests,
    item.noindexRequests,
    item.snippetRestrictedRequests,
    item.answerMeasuredRequests,
    item.questionHeadingObservedRequests,
    item.requestsWithQuestionHeadings,
    csvShare(item.requestsWithQuestionHeadings, item.questionHeadingObservedRequests),
    csvMean(item.questionHeadingCount, item.questionHeadingObservedRequests),
    item.conciseAnswerObservedRequests,
    item.requestsWithConciseAnswerBlocks,
    csvShare(item.requestsWithConciseAnswerBlocks, item.conciseAnswerObservedRequests),
    csvMean(item.conciseAnswerBlockCount, item.conciseAnswerObservedRequests),
    item.visibleAuthorObservedRequests,
    item.requestsWithVisibleAuthor,
    item.visibleDateObservedRequests,
    item.requestsWithVisibleDate,
    item.citationEvidenceMeasuredRequests,
    item.externalSourceObservedRequests,
    item.requestsWithExternalSourceLinks,
    csvShare(item.requestsWithExternalSourceLinks, item.externalSourceObservedRequests),
    csvMean(item.externalSourceLinkCount, item.externalSourceObservedRequests),
    item.inlineCitationObservedRequests,
    item.requestsWithInlineCitationMarkers,
    csvShare(item.requestsWithInlineCitationMarkers, item.inlineCitationObservedRequests),
    csvMean(item.inlineCitationMarkerCount, item.inlineCitationObservedRequests),
    item.unresolvedTargetObservedRequests,
    item.requestsWithUnresolvedCitationTargets,
    csvMean(item.unresolvedCitationTargetCount, item.unresolvedTargetObservedRequests),
    JSON.stringify(
      Object.fromEntries(
        [...item.reviewSignalRequests.entries()].sort(([left], [right]) =>
          left.localeCompare(right)
        )
      )
    ),
    item.firstSeenAt,
    item.lastSeenAt,
    item.auditPagesSkipped,
    item.inputPathsTruncated,
    item.pathObservationsTruncated,
    sorted.length,
    rows.length,
    outputTruncated,
    note,
  ]);
  return `${[headers, ...outputRows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** Serialize current route-family crawl/audit coverage as typed, versioned JSON. */
export function renderAiCrawlerPathFamilyAuditCorrelationJsonFromCsv(
  csv: string,
  correlations?: AiCrawlerLogGeoCorrelation[]
): string {
  const rows = parseCsvObjects(csv).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, raw]) => {
        if (raw === '') return [key, null];
        if (raw === 'true' || raw === 'false') return [key, raw === 'true'];
        if (key.endsWith('_json')) {
          try {
            return [key.slice(0, -5), JSON.parse(raw) as unknown];
          } catch {
            return [key, raw];
          }
        }
        if (
          /(_requests|_request|_paths|_depth|_mean|_percent|_skipped|_rows)$/u.test(key) ||
          /^requests_on_pages_/u.test(key) ||
          /^(analysis_index|output_rows_available|output_rows_emitted)$/u.test(key)
        ) {
          const number = Number(raw);
          if (Number.isFinite(number)) return [key, number];
        }
        return [key, raw];
      })
    )
  );
  if (correlations) {
    for (const row of rows) {
      const correlation = correlations[Number(row.analysis_index) - 1];
      if (!correlation) continue;
      restoreCsvTextField(row, 'source_file', [correlation.sourceFile ?? '']);
      const profile = correlation.pathObservations.find(
        (observation) => csvEncodedText(observation.crawlerToken) === row.crawler_token
      );
      if (profile) {
        row.crawler_token = profile.crawlerToken;
        restoreCsvTextField(row, 'provider', [profile.provider]);
        restoreCsvTextField(row, 'activity', [profile.activity]);
      }
    }
  }
  return `${JSON.stringify({ source: 'Aviary AI crawler route-family audit correlation', schemaVersion: 1, rows }, null, 2)}\n`;
}

/** Compare current audit profiles on the same exact crawler paths, grouped by route family. */
export function renderAiCrawlerPathFamilyAuditComparisonCsv(
  baseline: AiCrawlerLogGeoCorrelation[],
  current: AiCrawlerLogGeoCorrelation[],
  pathDepth = 2
): string {
  if (!Number.isInteger(pathDepth) || pathDepth < 1 || pathDepth > 5) {
    throw new Error('Crawler path-family depth must be an integer from 1 to 5.');
  }
  if (baseline.length !== current.length) {
    throw new Error(
      'Crawler path-family audit comparisons require one baseline correlation paired with each current log input.'
    );
  }
  type MetricSamples = { baseline: number[]; current: number[] };
  type AuditPairGroup = {
    analysisIndex: number;
    baselineSourceFile: string;
    currentSourceFile: string;
    origin: string;
    baselineAuditTimestamp: string;
    currentAuditTimestamp: string;
    crawlerToken: string;
    provider: string;
    activity: string;
    family: string;
    sharedExactPaths: number;
    pairedAuditMatchedPaths: number;
    baselineRequestsOnSharedPaths: number;
    currentRequestsOnSharedPaths: number;
    firstSeenAt?: string;
    lastSeenAt?: string;
    metrics: Map<string, MetricSamples>;
    baselineInputPathsTruncated: boolean;
    currentInputPathsTruncated: boolean;
    baselineAuditPathsTruncated: boolean;
    currentAuditPathsTruncated: boolean;
  };
  const grouped = new Map<string, AuditPairGroup>();
  const addPair = (
    group: AuditPairGroup,
    key: string,
    baselineValue: number | undefined,
    currentValue: number | undefined
  ): void => {
    if (baselineValue === undefined || currentValue === undefined) return;
    const samples = group.metrics.get(key) ?? { baseline: [], current: [] };
    samples.baseline.push(baselineValue);
    samples.current.push(currentValue);
    group.metrics.set(key, samples);
  };
  for (const [correlationIndex, oldCorrelation] of baseline.entries()) {
    const nowCorrelation = current[correlationIndex]!;
    if (oldCorrelation.origin !== nowCorrelation.origin) {
      throw new Error(
        `Crawler audit comparison origin differs for paired analysis ${correlationIndex + 1}.`
      );
    }
    const currentByPath = new Map(
      nowCorrelation.pathObservations.map((item) => [
        `${item.crawlerToken.toLowerCase()}\u0000${item.path}`,
        item,
      ])
    );
    for (const oldObservation of oldCorrelation.pathObservations) {
      const nowObservation = currentByPath.get(
        `${oldObservation.crawlerToken.toLowerCase()}\u0000${oldObservation.path}`
      );
      if (!nowObservation) continue;
      const family = pathFamily(oldObservation.path, pathDepth);
      const key = `${correlationIndex + 1}\u0000${oldObservation.crawlerToken.toLowerCase()}\u0000${family}`;
      let group = grouped.get(key);
      if (!group) {
        group = {
          analysisIndex: correlationIndex + 1,
          baselineSourceFile: oldCorrelation.sourceFile ?? '',
          currentSourceFile: nowCorrelation.sourceFile ?? '',
          origin: oldCorrelation.origin,
          baselineAuditTimestamp: oldCorrelation.auditTimestamp,
          currentAuditTimestamp: nowCorrelation.auditTimestamp,
          crawlerToken: oldObservation.crawlerToken,
          provider: nowObservation.provider,
          activity: nowObservation.activity,
          family,
          sharedExactPaths: 0,
          pairedAuditMatchedPaths: 0,
          baselineRequestsOnSharedPaths: 0,
          currentRequestsOnSharedPaths: 0,
          metrics: new Map<string, MetricSamples>(),
          baselineInputPathsTruncated: oldCorrelation.inputPathsTruncated,
          currentInputPathsTruncated: nowCorrelation.inputPathsTruncated,
          baselineAuditPathsTruncated: oldCorrelation.pathObservationsTruncated,
          currentAuditPathsTruncated: nowCorrelation.pathObservationsTruncated,
        };
        grouped.set(key, group);
      }
      group.sharedExactPaths += 1;
      group.baselineRequestsOnSharedPaths += oldObservation.requests;
      group.currentRequestsOnSharedPaths += nowObservation.requests;
      group.firstSeenAt = earlier(group.firstSeenAt, nowObservation.firstSeenAt);
      group.lastSeenAt = later(group.lastSeenAt, nowObservation.lastSeenAt);
      group.baselineInputPathsTruncated ||= oldCorrelation.inputPathsTruncated;
      group.currentInputPathsTruncated ||= nowCorrelation.inputPathsTruncated;
      group.baselineAuditPathsTruncated ||= oldCorrelation.pathObservationsTruncated;
      group.currentAuditPathsTruncated ||= nowCorrelation.pathObservationsTruncated;
      if (
        oldObservation.auditMatchType !== 'matched' ||
        nowObservation.auditMatchType !== 'matched'
      )
        continue;
      group.pairedAuditMatchedPaths += 1;
      addPair(
        group,
        'question_headings',
        oldObservation.currentQuestionHeadings,
        nowObservation.currentQuestionHeadings
      );
      addPair(
        group,
        'concise_answer_blocks',
        oldObservation.currentConciseAnswerBlocks,
        nowObservation.currentConciseAnswerBlocks
      );
      addPair(
        group,
        'visible_author',
        typeof oldObservation.currentVisibleAuthor === 'boolean'
          ? Number(oldObservation.currentVisibleAuthor)
          : undefined,
        typeof nowObservation.currentVisibleAuthor === 'boolean'
          ? Number(nowObservation.currentVisibleAuthor)
          : undefined
      );
      addPair(
        group,
        'visible_date',
        typeof oldObservation.currentVisibleDate === 'boolean'
          ? Number(oldObservation.currentVisibleDate)
          : undefined,
        typeof nowObservation.currentVisibleDate === 'boolean'
          ? Number(nowObservation.currentVisibleDate)
          : undefined
      );
      addPair(
        group,
        'external_source_links',
        oldObservation.currentExternalSourceLinkCount,
        nowObservation.currentExternalSourceLinkCount
      );
      addPair(
        group,
        'external_source_present',
        typeof oldObservation.currentExternalSourceLinkCount === 'number'
          ? Number(oldObservation.currentExternalSourceLinkCount > 0)
          : undefined,
        typeof nowObservation.currentExternalSourceLinkCount === 'number'
          ? Number(nowObservation.currentExternalSourceLinkCount > 0)
          : undefined
      );
      addPair(
        group,
        'inline_citation_markers',
        oldObservation.currentInlineCitationMarkerCount,
        nowObservation.currentInlineCitationMarkerCount
      );
      addPair(
        group,
        'inline_citation_present',
        typeof oldObservation.currentInlineCitationMarkerCount === 'number'
          ? Number(oldObservation.currentInlineCitationMarkerCount > 0)
          : undefined,
        typeof nowObservation.currentInlineCitationMarkerCount === 'number'
          ? Number(nowObservation.currentInlineCitationMarkerCount > 0)
          : undefined
      );
      addPair(
        group,
        'unresolved_citation_targets',
        oldObservation.currentUnresolvedCitationTargetCount,
        nowObservation.currentUnresolvedCitationTargetCount
      );
      addPair(
        group,
        'unresolved_citation_targets_present',
        typeof oldObservation.currentUnresolvedCitationTargetCount === 'number'
          ? Number(oldObservation.currentUnresolvedCitationTargetCount > 0)
          : undefined,
        typeof nowObservation.currentUnresolvedCitationTargetCount === 'number'
          ? Number(nowObservation.currentUnresolvedCitationTargetCount > 0)
          : undefined
      );
      const oldRobotsBlocked =
        oldObservation.currentRobotsAccess === 'allowed' ||
        oldObservation.currentRobotsAccess === 'blocked'
          ? Number(oldObservation.currentRobotsAccess === 'blocked')
          : undefined;
      const nowRobotsBlocked =
        nowObservation.currentRobotsAccess === 'allowed' ||
        nowObservation.currentRobotsAccess === 'blocked'
          ? Number(nowObservation.currentRobotsAccess === 'blocked')
          : undefined;
      addPair(group, 'robots_blocked', oldRobotsBlocked, nowRobotsBlocked);
      addPair(
        group,
        'noindex',
        typeof oldObservation.currentNoindex === 'boolean'
          ? Number(oldObservation.currentNoindex)
          : undefined,
        typeof nowObservation.currentNoindex === 'boolean'
          ? Number(nowObservation.currentNoindex)
          : undefined
      );
      const oldSnippetRestricted =
        typeof oldObservation.currentNoSnippet === 'boolean'
          ? Number(oldObservation.currentNoSnippet || oldObservation.currentMaxSnippetZero === true)
          : undefined;
      const nowSnippetRestricted =
        typeof nowObservation.currentNoSnippet === 'boolean'
          ? Number(nowObservation.currentNoSnippet || nowObservation.currentMaxSnippetZero === true)
          : undefined;
      addPair(group, 'snippet_restricted', oldSnippetRestricted, nowSnippetRestricted);
    }
  }
  const metricKeys = [
    ['question_headings', 'question_heading_count_mean'],
    ['concise_answer_blocks', 'concise_answer_block_count_mean'],
    ['visible_author', 'visible_author_path_share_percent'],
    ['visible_date', 'visible_date_path_share_percent'],
    ['external_source_links', 'external_source_link_count_mean'],
    ['external_source_present', 'paths_with_external_sources_percent'],
    ['inline_citation_markers', 'inline_citation_marker_count_mean'],
    ['inline_citation_present', 'paths_with_inline_citations_percent'],
    ['unresolved_citation_targets', 'unresolved_citation_target_count_mean'],
    ['unresolved_citation_targets_present', 'paths_with_unresolved_targets_percent'],
    ['robots_blocked', 'currently_robots_blocked_path_share_percent'],
    ['noindex', 'currently_noindex_path_share_percent'],
    ['snippet_restricted', 'currently_snippet_restricted_path_share_percent'],
  ] as const;
  const sorted = [...grouped.values()].sort(
    (left, right) =>
      right.pairedAuditMatchedPaths - left.pairedAuditMatchedPaths ||
      right.currentRequestsOnSharedPaths - left.currentRequestsOnSharedPaths ||
      left.analysisIndex - right.analysisIndex ||
      left.crawlerToken.localeCompare(right.crawlerToken) ||
      left.family.localeCompare(right.family)
  );
  const rowLimit = 50_000;
  const outputRows = sorted.slice(0, rowLimit);
  const resultHeaders = [
    'analysis_index',
    'baseline_source_file',
    'current_source_file',
    'origin',
    'baseline_audit_timestamp',
    'current_audit_timestamp',
    'crawler_token',
    'provider',
    'activity',
    'path_depth',
    'path_family',
    'shared_exact_paths',
    'paired_exact_audit_matched_paths',
    'baseline_requests_on_shared_paths',
    'current_requests_on_shared_paths',
    'first_seen_at_current',
    'last_seen_at_current',
    ...metricKeys.flatMap(([, label]) => [
      `${label}_paired_paths`,
      `baseline_${label}`,
      `current_${label}`,
      `${label}_delta`,
    ]),
    'baseline_crawler_path_catalog_truncated',
    'current_crawler_path_catalog_truncated',
    'baseline_audit_path_observations_truncated',
    'current_audit_path_observations_truncated',
    'output_rows_available',
    'output_rows_emitted',
    'output_rows_truncated',
    'interpretation_note',
  ];
  const outputTruncated = sorted.length > rowLimit;
  const note =
    'Paired exact paths are included only when the same crawler token and path were retained and exactly matched an audited page in both reports. Each path receives equal weight within a family; request counts describe the paired-path samples separately and do not weight signal deltas. Signal changes compare current audit snapshots, which may not coincide with request timestamps. Missing signal values are not zero-filled, and path/audit/output caps can remove support.';
  const mean = (values: number[] | undefined, asPercent: boolean): number | undefined =>
    values && values.length > 0
      ? Number(
          (
            (values.reduce((sum, value) => sum + value, 0) / values.length) *
            (asPercent ? 100 : 1)
          ).toFixed(3)
        )
      : undefined;
  const rows = outputRows.map((group) => [
    group.analysisIndex,
    group.baselineSourceFile,
    group.currentSourceFile,
    group.origin,
    group.baselineAuditTimestamp,
    group.currentAuditTimestamp,
    group.crawlerToken,
    group.provider,
    group.activity,
    pathDepth,
    group.family,
    group.sharedExactPaths,
    group.pairedAuditMatchedPaths,
    group.baselineRequestsOnSharedPaths,
    group.currentRequestsOnSharedPaths,
    group.firstSeenAt,
    group.lastSeenAt,
    ...metricKeys.flatMap(([key, label]) => {
      const samples = group.metrics.get(key);
      const asPercent = label.endsWith('_percent');
      const baselineValue = mean(samples?.baseline, asPercent);
      const currentValue = mean(samples?.current, asPercent);
      return [
        samples?.baseline.length,
        baselineValue,
        currentValue,
        baselineValue !== undefined && currentValue !== undefined
          ? Number((currentValue - baselineValue).toFixed(3))
          : undefined,
      ];
    }),
    group.baselineInputPathsTruncated,
    group.currentInputPathsTruncated,
    group.baselineAuditPathsTruncated,
    group.currentAuditPathsTruncated,
    sorted.length,
    outputRows.length,
    outputTruncated,
    note,
  ]);
  return `${[resultHeaders, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** Serialize paired exact-path audit signals as typed, versioned JSON. */
export function renderAiCrawlerPathFamilyAuditComparisonJsonFromCsv(
  csv: string,
  baseline?: AiCrawlerLogGeoCorrelation[],
  current?: AiCrawlerLogGeoCorrelation[]
): string {
  const rows = parseCsvObjects(csv).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, raw]) => {
        if (raw === '') return [key, null];
        if (raw === 'true' || raw === 'false') return [key, raw === 'true'];
        if (
          /(_paths|_requests|_depth|_paired_paths|_rows_available|_rows_emitted|_delta|_percent)$/u.test(
            key
          ) ||
          /^(analysis_index|baseline_|current_)/u.test(key)
        ) {
          const number = Number(raw);
          if (Number.isFinite(number)) return [key, number];
        }
        return [key, raw];
      })
    )
  );
  if (baseline && current) {
    for (const row of rows) {
      const index = Number(row.analysis_index) - 1;
      const before = baseline[index];
      const after = current[index];
      if (!before || !after) continue;
      restoreCsvTextField(row, 'baseline_source_file', [before.sourceFile ?? '']);
      restoreCsvTextField(row, 'current_source_file', [after.sourceFile ?? '']);
      const profile = after.pathObservations.find(
        (observation) => csvEncodedText(observation.crawlerToken) === row.crawler_token
      );
      if (profile) {
        row.crawler_token = profile.crawlerToken;
        restoreCsvTextField(row, 'provider', [profile.provider]);
        restoreCsvTextField(row, 'activity', [profile.activity]);
      }
    }
  }
  return `${JSON.stringify(
    {
      source: 'Aviary AI crawler route-family paired audit comparison',
      schemaVersion: 1,
      rows,
    },
    null,
    2
  )}\n`;
}

/** Render matched audit-snapshot shifts by route family as a bounded offline dashboard. */
export function renderAiCrawlerPathFamilyAuditComparisonHtml(
  baseline: AiCrawlerLogGeoCorrelation[],
  current: AiCrawlerLogGeoCorrelation[],
  pathDepth = 2
): string {
  const rows = parseCsvObjects(
    renderAiCrawlerPathFamilyAuditComparisonCsv(baseline, current, pathDepth)
  );
  const htmlLimit = 10_000;
  const viewRows = rows.slice(0, htmlLimit).map((row) => ({
    crawler_token: row.crawler_token,
    path_family: row.path_family,
    shared_exact_paths: row.shared_exact_paths,
    paired_exact_audit_matched_paths: row.paired_exact_audit_matched_paths,
    baseline_requests_on_shared_paths: row.baseline_requests_on_shared_paths,
    current_requests_on_shared_paths: row.current_requests_on_shared_paths,
    question_heading_count_mean_delta: row.question_heading_count_mean_delta,
    concise_answer_block_count_mean_delta: row.concise_answer_block_count_mean_delta,
    visible_author_path_share_percent_delta: row.visible_author_path_share_percent_delta,
    visible_date_path_share_percent_delta: row.visible_date_path_share_percent_delta,
    external_source_link_count_mean_delta: row.external_source_link_count_mean_delta,
    paths_with_external_sources_percent_delta: row.paths_with_external_sources_percent_delta,
    inline_citation_marker_count_mean_delta: row.inline_citation_marker_count_mean_delta,
    paths_with_inline_citations_percent_delta: row.paths_with_inline_citations_percent_delta,
    unresolved_citation_target_count_mean_delta: row.unresolved_citation_target_count_mean_delta,
    paths_with_unresolved_targets_percent_delta: row.paths_with_unresolved_targets_percent_delta,
    currently_robots_blocked_path_share_percent_delta:
      row.currently_robots_blocked_path_share_percent_delta,
    currently_noindex_path_share_percent_delta: row.currently_noindex_path_share_percent_delta,
    currently_snippet_restricted_path_share_percent_delta:
      row.currently_snippet_restricted_path_share_percent_delta,
    baseline_crawler_path_catalog_truncated: row.baseline_crawler_path_catalog_truncated,
    current_crawler_path_catalog_truncated: row.current_crawler_path_catalog_truncated,
    baseline_audit_path_observations_truncated: row.baseline_audit_path_observations_truncated,
    current_audit_path_observations_truncated: row.current_audit_path_observations_truncated,
  }));
  const safeJson = JSON.stringify(viewRows)
    .replace(/</g, '\\u003c')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const pairedPaths = rows.reduce(
    (sum, row) => sum + (Number(row.paired_exact_audit_matched_paths) || 0),
    0
  );
  const structureImproved = rows.filter(
    (row) =>
      Number(row.question_heading_count_mean_delta) > 0 ||
      Number(row.concise_answer_block_count_mean_delta) > 0
  ).length;
  const unresolvedReduced = rows.filter(
    (row) => Number(row.unresolved_citation_target_count_mean_delta) < 0
  ).length;
  const truncated = rows.some(
    (row) =>
      row.output_rows_truncated === 'true' ||
      row.baseline_crawler_path_catalog_truncated === 'true' ||
      row.current_crawler_path_catalog_truncated === 'true' ||
      row.baseline_audit_path_observations_truncated === 'true' ||
      row.current_audit_path_observations_truncated === 'true'
  );
  const style = `:root{font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#18232d;background:#f3f6f8;--line:#dbe2e8;--muted:#61717e;--blue:#187b9c;--orange:#c56e28}*{box-sizing:border-box}body{margin:0}main{max-width:1360px;margin:auto;padding:32px 24px 56px}h1{font-size:28px;letter-spacing:-.02em;margin:0}h2{font-size:17px;margin:0 0 14px}.lede,.note{color:var(--muted);max-width:105ch}.lede{margin:8px 0 22px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0}.metric,.panel{background:#fff;border:1px solid var(--line);border-radius:12px}.metric{padding:14px 16px}.metric strong{display:block;font-size:21px}.metric span{color:var(--muted);font-size:12px}.panel{padding:18px;margin:14px 0}.controls{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}.controls label{font-size:12px;color:var(--muted);display:grid;gap:5px}.controls select{min-width:250px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:8px;color:#18232d}.chart-scroll{overflow:auto}.chart-scroll svg{min-width:850px;width:100%;height:auto}.chart-scroll text{font:11px system-ui,sans-serif;fill:#5e6e7b}.track{fill:#edf1f4}.bar.up{fill:#187b9c}.bar.down{fill:#c56e28}.zero{stroke:#9caab4;stroke-width:1}.table-scroll{overflow:auto;max-height:620px;border:1px solid var(--line);border-radius:9px}table{width:100%;border-collapse:collapse;background:#fff;font-size:12px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}th{position:sticky;top:0;background:#edf2f5;color:#33434f}.note{font-size:12px}@media(max-width:760px){main{padding:22px 14px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI crawler route-family audit changes</title><style>${style}</style></head><body><main><header><h1>AI crawler route-family audit changes</h1><p class="lede">Current audit signals are compared only on exact crawler paths that were retained and matched to an audited page in both snapshots. Each shared path has equal weight; request-volume changes do not weight the audit-profile deltas.</p></header><section class="metrics"><div class="metric"><strong>${rows.length.toLocaleString('en')}</strong><span>route-family/crawler rows</span></div><div class="metric"><strong>${pairedPaths.toLocaleString('en')}</strong><span>paired exact-path audit profiles</span></div><div class="metric"><strong>${structureImproved.toLocaleString('en')}</strong><span>families with higher heading or answer-block means</span></div><div class="metric"><strong>${unresolvedReduced.toLocaleString('en')}</strong><span>families with fewer unresolved-target means</span></div></section><section class="panel"><h2>Paired profile shifts</h2><div class="controls"><label>Crawler<select id="crawler-filter"></select></label><label>Signal<select id="signal-filter"><option value="question_heading_count_mean_delta">Question headings per shared path</option><option value="concise_answer_block_count_mean_delta">Concise answer blocks per shared path</option><option value="external_source_link_count_mean_delta">External source links per shared path</option><option value="inline_citation_marker_count_mean_delta">Inline citation markers per shared path</option><option value="unresolved_citation_target_count_mean_delta">Unresolved citation targets per shared path</option><option value="visible_author_path_share_percent_delta">Visible author paths, pp</option><option value="visible_date_path_share_percent_delta">Visible date paths, pp</option><option value="paths_with_external_sources_percent_delta">Paths with external sources, pp</option><option value="paths_with_inline_citations_percent_delta">Paths with inline citations, pp</option><option value="paths_with_unresolved_targets_percent_delta">Paths with unresolved targets, pp</option><option value="currently_robots_blocked_path_share_percent_delta">Currently robots-blocked paths, pp</option><option value="currently_noindex_path_share_percent_delta">Currently noindex paths, pp</option><option value="currently_snippet_restricted_path_share_percent_delta">Currently snippet-restricted paths, pp</option></select></label></div><div class="chart-scroll"><svg id="signal-chart" viewBox="0 0 1000 620" role="img" aria-label="Audit signal changes on shared exact crawler paths"></svg></div></section><section class="panel"><h2>Route-family detail</h2><div class="table-scroll"><table><thead><tr><th>Crawler</th><th>Route family</th><th>Exact paths shared</th><th>Paths audited both periods</th><th>Baseline/current requests on shared paths</th><th>Question-heading mean Δ</th><th>Answer-block mean Δ</th><th>Visible author Δ pp</th><th>Visible date Δ pp</th><th>External-link mean Δ</th><th>Inline-citation mean Δ</th><th>Unresolved-target mean Δ</th><th>Robots-blocked share Δ pp</th><th>Noindex share Δ pp</th><th>Snippet-restricted share Δ pp</th><th>Baseline/current caps</th></tr></thead><tbody id="family-rows"></tbody></table></div></section><p class="note">A signal delta requires that signal to be measured on the same exact path in both audit snapshots; absent values are not zero-filled. Snapshots can postdate their crawler requests. Caps or changed URL matching can remove paths from paired support. These differences do not establish that an answer engine consumed or cited the page.</p>${truncated ? '<p class="note">At least one path catalog, audit-observation list, or output was truncated; the paired path set may be incomplete.</p>' : ''}${rows.length > htmlLimit ? `<p class="note">The dashboard keeps the first ${htmlLimit.toLocaleString('en')} support-ranked rows of ${rows.length.toLocaleString('en')}; use the CSV for the full retained output.</p>` : ''}<script type="application/json" id="comparison-data">${safeJson}</script><script>
    const rows=JSON.parse(document.getElementById('comparison-data').textContent),crawler=document.getElementById('crawler-filter'),signal=document.getElementById('signal-filter');
    function fill(select,values){const all=document.createElement('option');all.value='';all.textContent='All';select.append(all);for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option)}}
    fill(crawler,[...new Set(rows.map(r=>r.crawler_token))].sort((a,b)=>a.localeCompare(b)));
    function selected(){return rows.filter(r=>!crawler.value||r.crawler_token===crawler.value)}
    function svg(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;return el}
    function draw(){const chosen=selected(),chart=document.getElementById('signal-chart'),body=document.getElementById('family-rows'),field=signal.value;chart.replaceChildren();body.replaceChildren();const top=chosen.filter(r=>Number(r.paired_exact_audit_matched_paths)>0&&r[field]!=='').sort((a,b)=>Math.abs(Number(b[field]))-Math.abs(Number(a[field]))).slice(0,20),max=Math.max(1,...top.map(r=>Math.abs(Number(r[field])||0))),height=Math.max(180,44+top.length*28);chart.setAttribute('viewBox','0 0 1000 '+height);chart.append(svg('line',{x1:610,y1:8,x2:610,y2:height-8,class:'zero'}));if(!top.length)chart.append(svg('text',{x:500,y:90,'text-anchor':'middle'},'No paired values for this signal and filter.'));top.forEach((r,i)=>{const delta=Number(r[field])||0,y=22+i*28,width=270*Math.abs(delta)/max;chart.append(svg('text',{x:10,y:y+12},r.crawler_token+' · '+r.path_family));chart.append(svg('rect',{x:340,y,width:540,height:13,rx:6,class:'track'}));chart.append(svg('rect',{x:delta<0?610-width:610,y,width:width.toFixed(1),height:13,rx:6,class:delta<0?'bar down':'bar up'}));chart.append(svg('text',{x:890,y:y+11},(delta>0?'+':'')+delta.toLocaleString('en')+(field.includes('percent')?' pp':'')))});for(const r of chosen.slice(0,1000)){const cells=[r.crawler_token,r.path_family,r.shared_exact_paths,r.paired_exact_audit_matched_paths,[r.baseline_requests_on_shared_paths,r.current_requests_on_shared_paths].join(' / '),r.question_heading_count_mean_delta,r.concise_answer_block_count_mean_delta,r.visible_author_path_share_percent_delta,r.visible_date_path_share_percent_delta,r.external_source_link_count_mean_delta,r.inline_citation_marker_count_mean_delta,r.unresolved_citation_target_count_mean_delta,r.currently_robots_blocked_path_share_percent_delta,r.currently_noindex_path_share_percent_delta,r.currently_snippet_restricted_path_share_percent_delta,[r.baseline_crawler_path_catalog_truncated,r.current_crawler_path_catalog_truncated,r.baseline_audit_path_observations_truncated,r.current_audit_path_observations_truncated].join(' / ')],tr=document.createElement('tr');for(const value of cells){const td=document.createElement('td');td.textContent=value===undefined||value===''?'—':String(value);tr.append(td)}body.append(tr)}if(chosen.length>1000){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=16;td.textContent='Showing the first 1,000 filtered rows.';tr.append(td);body.append(tr)}}
    crawler.addEventListener('change',draw);signal.addEventListener('change',draw);draw();
    </script></main></body></html>`;
}

/** Render a bounded, offline dashboard for route-family crawler/audit signal coverage. */
export function renderAiCrawlerPathFamilyAuditCorrelationHtml(
  correlations: AiCrawlerLogGeoCorrelation[],
  pathDepth = 2
): string {
  const rows = parseCsvObjects(
    renderAiCrawlerPathFamilyAuditCorrelationCsv(correlations, pathDepth)
  );
  const htmlLimit = 10_000;
  const viewRows = rows.slice(0, htmlLimit).map((row) => ({
    source_file: row.source_file,
    crawler_token: row.crawler_token,
    provider: row.provider,
    activity: row.activity,
    path_family: row.path_family,
    retained_paths: row.retained_paths,
    retained_requests: row.retained_requests,
    matched_audit_requests: row.matched_audit_requests,
    ambiguous_audit_requests: row.ambiguous_audit_requests,
    not_in_audit_requests: row.not_in_audit_requests,
    client_error_requests: row.client_error_requests,
    server_error_requests: row.server_error_requests,
    current_robots_blocked_requests: row.current_robots_blocked_requests,
    current_noindex_requests: row.current_noindex_requests,
    current_snippet_restricted_requests: row.current_snippet_restricted_requests,
    answer_content_measured_requests: row.answer_content_measured_requests,
    question_heading_observed_requests: row.question_heading_observed_requests,
    question_heading_request_share_percent: row.question_heading_request_share_percent,
    concise_answer_observed_requests: row.concise_answer_observed_requests,
    concise_answer_request_share_percent: row.concise_answer_request_share_percent,
    citation_evidence_measured_requests: row.citation_evidence_measured_requests,
    external_source_observed_requests: row.external_source_observed_requests,
    external_source_request_share_percent: row.external_source_request_share_percent,
    inline_citation_observed_requests: row.inline_citation_observed_requests,
    inline_citation_request_share_percent: row.inline_citation_request_share_percent,
    unresolved_target_observed_requests: row.unresolved_target_observed_requests,
    weighted_mean_unresolved_citation_targets_per_observed_request:
      row.weighted_mean_unresolved_citation_targets_per_observed_request,
    review_signal_request_counts_json: row.review_signal_request_counts_json,
    crawler_path_catalog_truncated: row.crawler_path_catalog_truncated,
    audit_path_observations_truncated: row.audit_path_observations_truncated,
  }));
  const safeJson = JSON.stringify(viewRows)
    .replace(/</g, '\\u003c')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const sum = (key: string): number =>
    rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const requests = sum('retained_requests');
  const matchedRequests = sum('matched_audit_requests');
  const capRows = rows.filter(
    (row) =>
      row.crawler_path_catalog_truncated === 'true' ||
      row.audit_path_observations_truncated === 'true'
  ).length;
  const truncated = rows.some((row) => row.output_rows_truncated === 'true');
  const style = `:root{font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#18232d;background:#f3f6f8;--line:#dbe2e8;--muted:#61717e;--blue:#187b9c;--orange:#c56e28}*{box-sizing:border-box}body{margin:0}main{max-width:1320px;margin:auto;padding:32px 24px 56px}h1{font-size:28px;letter-spacing:-.02em;margin:0}h2{font-size:17px;margin:0 0 14px}.lede,.note{color:var(--muted);max-width:100ch}.lede{margin:8px 0 22px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0}.metric,.panel{background:#fff;border:1px solid var(--line);border-radius:12px}.metric{padding:14px 16px}.metric strong{display:block;font-size:21px}.metric span{color:var(--muted);font-size:12px}.panel{padding:18px;margin:14px 0}.controls{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}.controls label{font-size:12px;color:var(--muted);display:grid;gap:5px}.controls select{min-width:190px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:8px;color:#18232d}.chart-scroll{overflow:auto}.chart-scroll svg{min-width:850px;width:100%;height:auto}.chart-scroll text{font:11px system-ui,sans-serif;fill:#5e6e7b}.track{fill:#edf1f4}.bar{fill:#187b9c}.bar.partial{fill:#c56e28}.table-scroll{overflow:auto;max-height:620px;border:1px solid var(--line);border-radius:9px}table{width:100%;border-collapse:collapse;background:#fff;font-size:12px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);white-space:nowrap}th{position:sticky;top:0;background:#edf2f5;color:#33434f}.note{font-size:12px}@media(max-width:760px){main{padding:22px 14px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI crawler route-family audit correlation</title><style>${style}</style></head><body><main><header><h1>AI crawler route-family audit correlation</h1><p class="lede">Exact-path crawler observations are grouped by normalized route family, then compared with signal coverage from the supplied current audit snapshot. Coverage and match support stay visible so a family with sparse audited paths is not mistaken for a complete template profile.</p></header><section class="metrics"><div class="metric"><strong>${rows.length.toLocaleString('en')}</strong><span>retained route-family rows</span></div><div class="metric"><strong>${requests.toLocaleString('en')}</strong><span>requests in retained path observations</span></div><div class="metric"><strong>${matchedRequests.toLocaleString('en')}</strong><span>requests on exact audit path matches (${requests > 0 ? ((matchedRequests / requests) * 100).toFixed(1) : '—'}%)</span></div><div class="metric"><strong>${capRows.toLocaleString('en')}</strong><span>family rows with a crawler or audit-path cap</span></div></section><section class="panel"><h2>Family traffic and exact audit support</h2><div class="controls"><label>Crawler<select id="crawler-filter"></select></label><label>Audit match<select id="match-filter"><option value="">All families</option><option value="matched">Has exact audit matches</option><option value="unmatched">No exact audit matches</option></select></label></div><div class="chart-scroll"><svg id="family-chart" viewBox="0 0 1000 620" role="img" aria-label="Route-family crawler requests and exact audit match support"></svg></div></section><section class="panel"><h2>Measured GEO signals by family</h2><div class="table-scroll"><table><thead><tr><th>Log file</th><th>Crawler</th><th>Route family</th><th>Requests</th><th>Matched / ambiguous / absent</th><th>4xx / 5xx</th><th>Current robots blocked</th><th>Noindex / snippet restricted</th><th>Question-heading coverage</th><th>Answer-block coverage</th><th>External-source coverage</th><th>Inline-citation coverage</th><th>Unresolved-target mean</th><th>Measured answer/citation requests</th><th>Review-signal requests</th><th>Caps</th></tr></thead><tbody id="family-rows"></tbody></table></div></section><p class="note">Signal coverage shares use only requests where that signal had an observed value. The audit snapshot may postdate the crawler requests; exact-path association does not prove the provider consumed the page or cited it. User-agent labels are log claims. Crawler path, audit path, and output caps can omit families or observations.</p>${truncated ? '<p class="note">The route-family audit CSV hit its output row cap; some family rows may be omitted.</p>' : ''}${rows.length > htmlLimit ? `<p class="note">The dashboard keeps the first ${htmlLimit.toLocaleString('en')} request-ranked families of ${rows.length.toLocaleString('en')}; use the CSV for the full retained output.</p>` : ''}<script type="application/json" id="family-data">${safeJson}</script><script>
    const rows=JSON.parse(document.getElementById('family-data').textContent),crawler=document.getElementById('crawler-filter'),match=document.getElementById('match-filter');
    function fill(select,values){const all=document.createElement('option');all.value='';all.textContent='All';select.append(all);for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option)}}
    fill(crawler,[...new Set(rows.map(r=>r.crawler_token))].sort((a,b)=>a.localeCompare(b)));
    function selected(){return rows.filter(r=>(!crawler.value||r.crawler_token===crawler.value)&&(!match.value||(match.value==='matched'?Number(r.matched_audit_requests)>0:Number(r.matched_audit_requests)===0)))}
    function svg(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;return el}
    function draw(){const chosen=selected(),chart=document.getElementById('family-chart'),body=document.getElementById('family-rows');chart.replaceChildren();body.replaceChildren();const top=[...chosen].sort((a,b)=>(Number(b.retained_requests)||0)-(Number(a.retained_requests)||0)).slice(0,20),max=Math.max(1,...top.map(r=>Number(r.retained_requests)||0)),height=Math.max(180,44+top.length*28);chart.setAttribute('viewBox','0 0 1000 '+height);if(!top.length)chart.append(svg('text',{x:500,y:90,'text-anchor':'middle'},'No retained route-family rows match this filter.'));top.forEach((r,i)=>{const y=22+i*28,total=Number(r.retained_requests)||0,matched=Number(r.matched_audit_requests)||0,width=540*total/max,matchedWidth=total?width*matched/total:0;chart.append(svg('text',{x:10,y:y+12},r.crawler_token+' · '+r.path_family));chart.append(svg('rect',{x:340,y,width:540,height:13,rx:6,class:'track'}));chart.append(svg('rect',{x:340,y,width:width.toFixed(1),height:13,rx:6,class:'bar'}));if(matched<total)chart.append(svg('rect',{x:340+matchedWidth,y,width:Math.max(0,width-matchedWidth).toFixed(1),height:13,rx:6,class:'bar partial'}));chart.append(svg('text',{x:890,y:y+11},matched.toLocaleString('en')+' / '+total.toLocaleString('en')+' matched'))});for(const r of chosen.slice(0,1000)){const cells=[r.source_file,r.crawler_token,r.path_family,r.retained_requests,[r.matched_audit_requests,r.ambiguous_audit_requests,r.not_in_audit_requests].join(' / '),[r.client_error_requests,r.server_error_requests].join(' / '),r.current_robots_blocked_requests,[r.current_noindex_requests,r.current_snippet_restricted_requests].join(' / '),r.question_heading_request_share_percent===''?'':r.question_heading_request_share_percent+'% of '+r.question_heading_observed_requests+' requests',r.concise_answer_request_share_percent===''?'':r.concise_answer_request_share_percent+'% of '+r.concise_answer_observed_requests+' requests',r.external_source_request_share_percent===''?'':r.external_source_request_share_percent+'% of '+r.external_source_observed_requests+' requests',r.inline_citation_request_share_percent===''?'':r.inline_citation_request_share_percent+'% of '+r.inline_citation_observed_requests+' requests',r.weighted_mean_unresolved_citation_targets_per_observed_request===''?'':r.weighted_mean_unresolved_citation_targets_per_observed_request,r.answer_content_measured_requests+' / '+r.citation_evidence_measured_requests,Object.entries(JSON.parse(r.review_signal_request_counts_json||'{}')).map(([name,count])=>name.replace(/-/g,' ')+': '+count).join('; '),[r.crawler_path_catalog_truncated,r.audit_path_observations_truncated].join(' / ')],tr=document.createElement('tr');for(const value of cells){const td=document.createElement('td');td.textContent=value===undefined||value===''?'—':String(value);if(i===14){td.style.whiteSpace='normal';td.style.maxWidth='480px'}tr.append(td)}body.append(tr)}if(chosen.length>1000){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=16;td.textContent='Showing the first 1,000 filtered rows.';tr.append(td);body.append(tr)}}
    crawler.addEventListener('change',draw);match.addEventListener('change',draw);draw();
    </script></main></body></html>`;
}
