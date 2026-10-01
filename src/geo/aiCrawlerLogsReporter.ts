import type {
  AiCrawlerAccessLogAnalysis,
  AiCrawlerLogDailyActivity,
  AiCrawlerGeoReviewSignal,
  AiCrawlerLogGeoCorrelation,
  AiCrawlerLogGeoPathObservation,
  AiCrawlerLogPath,
  AiCrawlerLogSummary,
  AiCrawlerCloudFrontResultProfile,
  AiCrawlerRobotsPolicyComparison,
  AiCrawlerRobotsPolicyAnalysis,
  AiCrawlerRobotsAuditReplay,
  AiCrawlerRobotsAuditReplayComparison,
  AiCrawlerSitemapFreshnessAnalysis,
  AiCrawlerResponseTiming,
  AiReferralGeoAuditCoverage,
  AiReferralTrafficSummary,
  AiReferralUtmSourceCoverage,
} from './aiCrawlerLogs';
import type {
  AiCrawlerLogPeriodComparison,
  AiCrawlerLogPeriodCrawlerComparison,
} from './aiCrawlerLogComparison';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function number(value: number): string {
  return new Intl.NumberFormat('en').format(value);
}

function statusCode(value: number): string {
  return value === 0 ? '000' : String(value);
}

function formatResponseTiming(timing: AiCrawlerResponseTiming | undefined): string {
  if (!timing) return 'not logged';
  const values = [
    timing.timeToFirstByte
      ? `TTFB p50 ${timing.timeToFirstByte.p50Band}, p95 ${timing.timeToFirstByte.p95Band} (${number(timing.timeToFirstByte.sampledRequests)})`
      : undefined,
    timing.responseDuration
      ? `duration p50 ${timing.responseDuration.p50Band}, p95 ${timing.responseDuration.p95Band} (${number(timing.responseDuration.sampledRequests)})`
      : undefined,
  ].filter((value): value is string => value !== undefined);
  return values.join(' · ') || 'not logged';
}

function formatCloudFrontResults(profile: AiCrawlerCloudFrontResultProfile | undefined): string {
  if (!profile) return 'not logged';
  const resultTypes =
    profile.resultTypes
      .map(({ resultType, requests }) => `${resultType} ${number(requests)}`)
      .join(', ') || 'not logged';
  const responseTypes =
    profile.responseResultTypes
      .map(({ resultType, requests }) => `${resultType} ${number(requests)}`)
      .join(', ') || 'not logged';
  return `result ${resultTypes} · response result ${responseTypes} · differing pairs ${number(profile.differingResultTypes)}/${number(profile.pairedRequests)}`;
}

function formatAuditedAnswerContent(item: AiCrawlerLogGeoPathObservation): string {
  if (!item.answerContentCoverage) return 'not matched';
  if (item.answerContentCoverage !== 'measured') return item.answerContentCoverage;
  const author =
    item.currentVisibleAuthor === undefined
      ? 'author unknown'
      : item.currentVisibleAuthor
        ? 'author yes'
        : 'author no';
  const date =
    item.currentVisibleDate === undefined
      ? 'date unknown'
      : item.currentVisibleDate
        ? 'date yes'
        : 'date no';
  const accessSchema =
    item.currentSchemaIsAccessibleForFree === undefined
      ? ''
      : ` · isAccessibleForFree ${item.currentSchemaIsAccessibleForFree}`;
  const nonBooleanSchema = item.currentSchemaHasNonBooleanAccessibleForFreeValue
    ? ' · non-boolean free-access value'
    : '';
  return `Q ${item.currentQuestionHeadings ?? '—'} · answers ${item.currentConciseAnswerBlocks ?? '—'} · ${author} · ${date}${accessSchema}${nonBooleanSchema}`;
}

function formatAuditedCitationEvidence(item: AiCrawlerLogGeoPathObservation): string {
  if (!item.citationEvidenceCoverage) return 'not matched';
  if (item.citationEvidenceCoverage !== 'measured') return item.citationEvidenceCoverage;
  return `sources ${item.currentExternalSourceLinkCount ?? '—'} · markers ${item.currentInlineCitationMarkerCount ?? '—'} · unresolved targets ${item.currentUnresolvedCitationTargetCount ?? '—'}`;
}

function formatGeoReviewSignal(signal: AiCrawlerGeoReviewSignal): string {
  const labels: Record<AiCrawlerGeoReviewSignal, string> = {
    'robots-blocked': 'Blocked by current robots policy',
    noindex: 'Current noindex control',
    nosnippet: 'Current nosnippet control',
    'max-snippet-zero': 'Current max-snippet:0 control',
    noarchive: 'Current Amazonbot noarchive directive',
    'client-error-responses': 'Logged 4xx responses',
    'server-error-responses': 'Logged 5xx responses',
    'no-question-headings': 'No measured question headings',
    'no-concise-answer-blocks': 'No measured concise answer blocks',
    'no-visible-author': 'No measured visible author',
    'no-visible-date': 'No measured visible date',
    'no-external-source-links': 'No measured external source links',
    'no-inline-citation-markers': 'No measured inline citation markers',
    'unresolved-citation-targets': 'Unresolved in-page citation targets',
    'apple-ai-context-excluded-by-paywall-schema':
      'Apple AI context excluded by isAccessibleForFree:false',
    'apple-ai-context-hidden-by-nosnippet': 'Apple AI context hidden by nosnippet',
  };
  return labels[signal];
}

function renderGeoPriorityQueue(correlation: AiCrawlerLogGeoCorrelation): string {
  const queue = correlation.priorityReviewQueue ?? [];
  if (queue.length === 0) return '';
  const rows = queue
    .map(
      (item, index) =>
        '<tr><td class="num">' +
        number(index + 1) +
        '</td><td>' +
        escapeHtml(item.provider) +
        ' · ' +
        escapeHtml(item.crawlerToken) +
        '<br><span class="muted">' +
        escapeHtml(item.activity.replace(/-/g, ' ')) +
        '</span></td><td><code>' +
        escapeHtml(item.path) +
        '</code></td><td class="num">' +
        number(item.requests) +
        '<br><span class="muted">' +
        item.crawlerRequestSharePercent +
        '% of ' +
        number(item.crawlerRequests) +
        '</span></td><td>' +
        escapeHtml(item.lastSeenAt ?? 'unknown') +
        '</td><td>' +
        escapeHtml(item.reviewSignals.map(formatGeoReviewSignal).join(' · ')) +
        '</td></tr>'
    )
    .join('');
  return (
    '<details class="correlation"><summary>GEO priority review queue (' +
    number(queue.length) +
    ' observed crawler-path rows' +
    (correlation.priorityReviewQueueTruncated ? ', coverage capped' : '') +
    ')</summary>' +
    '<p class="note">Ranked by request share within each crawler token sample, then raw request count and the number of measured review prompts. Signals are current audit evidence paired with a log sample; they are prompts to inspect, not SEO requirements, cause attribution, or evidence that a crawler cited the page.' +
    (correlation.priorityReviewQueueTruncated
      ? ' The queue may omit rows because the queue, crawler path detail, or saved audit page set was capped.'
      : '') +
    '</p><div class="table-wrap"><table><thead><tr><th>#</th><th>Provider / token</th><th>Path</th><th class="num">Requests / token sample</th><th>Last seen (UTC)</th><th>Measured review prompts</th></tr></thead><tbody>' +
    rows +
    '</tbody></table></div></details>'
  );
}

function renderPathTable(crawler: AiCrawlerLogSummary): string {
  const rows = crawler.paths
    .map(
      (item: AiCrawlerLogPath) =>
        `<tr data-search="${escapeHtml(`${crawler.token} ${item.path}`.toLowerCase())}"><td><code>${escapeHtml(item.path)}</code></td><td class="num">${number(item.requests)}</td><td>${escapeHtml(item.firstSeenAt ?? 'unknown')}</td><td>${escapeHtml(item.lastSeenAt ?? 'unknown')}</td><td class="num">${item.daysBeforeLatestRequest === undefined ? '—' : number(item.daysBeforeLatestRequest)}</td><td class="num">${number(item.timestampedRequests)}</td><td>${escapeHtml(item.statusCodes.map(({ status, requests }) => `${statusCode(status)}×${number(requests)}`).join(', ') || 'unknown')}${item.statusCodesTruncated ? ' +' : ''}</td><td>${escapeHtml(item.originResponseStatusCodes.map(({ status, requests }) => `${statusCode(status)}×${number(requests)}`).join(', ') || 'not logged')}${item.originResponseStatusCodesTruncated ? ' +' : ''}${item.edgeOriginStatusDifferences ? ` · ${number(item.edgeOriginStatusDifferences)} edge/origin differ` : ''}</td><td>${escapeHtml(item.responseContentTypes.map(({ contentType, requests }) => `${contentType}×${number(requests)}`).join(', ') || 'unknown')}${item.responseContentTypesTruncated ? ' +' : ''}</td><td>${escapeHtml(formatResponseTiming(item.responseTiming))}</td><td>${escapeHtml(formatCloudFrontResults(item.cloudFrontResultProfile))}</td><td class="num">${number(item.successfulResponses)}</td><td class="num">${number(item.redirects)}</td><td class="num">${number(item.clientErrors)}</td><td class="num">${number(item.serverErrors)}</td></tr>`
    )
    .join('');
  return `<div class="table-wrap"><table><caption>Top observed request paths for ${escapeHtml(crawler.token)}</caption><thead><tr><th scope="col">Path (query removed)</th><th scope="col" class="num">Requests</th><th scope="col">First seen (UTC)</th><th scope="col">Last seen (UTC)</th><th scope="col" class="num">Days before latest event</th><th scope="col" class="num">Timestamped</th><th scope="col">Frequent logged HTTP codes</th><th scope="col">Origin codes / edge differences</th><th scope="col">Response media types</th><th scope="col">Request timing bands</th><th scope="col">CloudFront result profile</th><th scope="col" class="num">2xx</th><th scope="col" class="num">3xx</th><th scope="col" class="num">4xx</th><th scope="col" class="num">5xx</th></tr></thead><tbody>${rows || '<tr><td colspan="15" class="empty">No paths recorded.</td></tr>'}</tbody></table></div><p class="note">“Days before latest event” is relative to the newest parseable request for this token in the supplied log. Logged HTTP code lists show the ten most frequent codes per path; a trailing “+” means additional codes were omitted. Origin codes appear only when the log supplies them; a difference marks edge/origin status disagreement and can reflect CDN or WAF behavior. Response media types come only from logs that include a response content-type field. Timing percentiles are approximate fixed-band observations and cover only requests with a recognized timing field. CloudFront result types are logged edge classifications; differing result and response-result types are reported as-is.</p>${crawler.pathsTruncated ? '<p class="note">Only the top 200 paths are listed; JSON retains a truncation indicator.</p>' : ''}`;
}

function renderFailureHotspots(crawler: AiCrawlerLogSummary): string {
  if (crawler.failureHotspots.length === 0)
    return '<p class="note">No 4xx or 5xx responses were recorded in this sample.</p>';
  const rows = crawler.failureHotspots
    .map(
      (item) =>
        `<tr data-search="${escapeHtml(`${crawler.token} ${item.path}`.toLowerCase())}"><td><code>${escapeHtml(item.path)}</code></td><td class="num">${number(item.requests)}</td><td class="num">${number(item.failureRequests)} (${item.failureSharePercent}%)</td><td class="num">${number(item.clientErrors)}</td><td class="num">${number(item.serverErrors)}</td><td>${escapeHtml(item.lastSeenAt ?? 'unknown')}</td><td>${escapeHtml(item.originResponseStatusCodes.map(({ status, requests }) => `${statusCode(status)}×${number(requests)}`).join(', ') || 'not logged')}${item.originResponseStatusCodesTruncated ? ' +' : ''}${item.edgeOriginStatusDifferences ? `<br>${number(item.edgeOriginStatusDifferences)} edge/origin differ` : ''}</td><td>${escapeHtml(item.responseContentTypes.map(({ contentType, requests }) => `${contentType}×${number(requests)}`).join(', ') || 'unknown')}${item.responseContentTypesTruncated ? ' +' : ''}</td><td>${escapeHtml(formatResponseTiming(item.responseTiming))}</td><td class="num">${number(item.cloudflareVerifiedBotRequests)} / ${number(item.cloudflareBotAnnotatedRequests)} requests<br>${number(item.cloudflareVerifiedBotFailureRequests)} failures</td><td class="num">${number(item.cloudflareBlockingFailureRequests)} block · ${number(item.cloudflareChallengeFailureRequests)} challenge · ${number(item.cloudflareChallengeResolvedFailureRequests)} solved/bypassed<br>${number(item.cloudflareSecurityActionRequests)} requests with logged actions</td><td>${escapeHtml(item.statusCodes.map(({ status, requests }) => `${statusCode(status)}×${number(requests)}`).join(', ') || 'unknown')}${item.statusCodesTruncated ? ' +' : ''}</td></tr>`
    )
    .join('');
  return `<div class="table-wrap"><table><thead><tr><th>Path</th><th class="num">Requests</th><th class="num">4xx/5xx share</th><th class="num">4xx</th><th class="num">5xx</th><th>Last seen (UTC)</th><th>Origin codes / edge differences</th><th>Response media types</th><th>Request timing bands</th><th class="num">Cloudflare verified requests / failures</th><th class="num">Cloudflare edge actions on failed requests</th><th>Frequent logged HTTP codes</th></tr></thead><tbody>${rows}</tbody></table></div>${crawler.failureHotspotsTruncated ? '<p class="note">Showing the 50 highest-priority paths with 4xx/5xx responses; JSON reports truncation.</p>' : ''}<p class="note">Failure share is the 4xx+5xx request count divided by all logged requests for that exact normalized path. Cloudflare verified requests count logged verified-bot evidence for the claimed crawler token; verified failures are 4xx/5xx responses among those requests. Edge-action counts show requests with a logged security action and corresponding failure status; they are coincident observations, not cause attribution. Zeros can mean fields were unavailable, so they do not imply spoofing or no security action. All counts describe this sample.</p>`;
}

function renderDailyTable(daily: AiCrawlerLogDailyActivity[]): string {
  const entries = daily.slice(-60);
  if (!entries.length) return '<p class="note">No parseable timestamps for daily grouping.</p>';
  const rows = entries
    .map(
      (day) =>
        `<tr><td>${escapeHtml(day.date)}</td><td class="num">${number(day.requests)}</td><td class="num">${number(day.successfulResponses)}</td><td class="num">${number(day.redirects)}</td><td class="num">${number(day.clientErrors)}</td><td class="num">${number(day.serverErrors)}</td><td class="num">${number(day.otherResponses)}</td><td>${escapeHtml(formatResponseTiming(day.responseTiming))}</td></tr>`
    )
    .join('');
  return `<div class="table-wrap"><table><caption>Daily requests from ${escapeHtml(daily.length > 60 ? 'the last 60 days' : 'the supplied logs')}</caption><thead><tr><th scope="col">UTC date</th><th scope="col" class="num">Requests</th><th scope="col" class="num">2xx</th><th scope="col" class="num">3xx</th><th scope="col" class="num">4xx</th><th scope="col" class="num">5xx</th><th scope="col" class="num">Other</th><th scope="col">Timing p50 / p95 bands</th></tr></thead><tbody>${rows}</tbody></table></div><p class="note">Daily timing bands include only rows with valid logged measurements; they can be a subset of that day's requests. p50/p95 are approximate buckets, not exact values.</p>${daily.length > 60 ? '<p class="note">Showing the last 60 UTC days; the structured JSON retains up to 730 days.</p>' : ''}`;
}

function renderAiReferralTraffic(sources: AiReferralTrafficSummary[]): string {
  if (sources.length === 0) return '';
  const rows = sources
    .map((source) => {
      const details =
        source.requests === 0
          ? '<p class="note">No requests with this configured UTM marker were observed.</p>'
          : `<details><summary>${number(source.paths.length)} retained path rows · ${source.dailyActivity.length} UTC day buckets</summary><div class="table-wrap"><table><thead><tr><th>Path (query removed)</th><th class="num">Requests</th><th>HTTP codes</th><th>Response media types</th><th class="num">2xx</th><th class="num">3xx</th><th class="num">4xx</th><th class="num">5xx</th><th>Last seen (UTC)</th></tr></thead><tbody>${source.paths.map((item) => `<tr><td><code>${escapeHtml(item.path)}</code></td><td class="num">${number(item.requests)}</td><td>${escapeHtml(item.statusCodes.map(({ status, requests }) => `${statusCode(status)}×${number(requests)}`).join(', ') || 'unknown')}${item.statusCodesTruncated ? ' +' : ''}</td><td>${escapeHtml(item.responseContentTypes.map(({ contentType, requests }) => `${contentType}×${number(requests)}`).join(', ') || 'not logged')}${item.responseContentTypesTruncated ? ' +' : ''}</td><td class="num">${number(item.responseClasses.successful2xx)}</td><td class="num">${number(item.responseClasses.redirects3xx)}</td><td class="num">${number(item.responseClasses.clientErrors4xx)}</td><td class="num">${number(item.responseClasses.serverErrors5xx)}</td><td>${escapeHtml(item.lastSeenAt ?? 'unknown')}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">No retained path details.</td></tr>'}</tbody></table></div>${source.pathsTruncated || source.uniquePathsTruncated ? '<p class="note">Path details are capped. The unique-path count is a lower bound when its truncation flag is set.</p>' : ''}<div class="table-wrap"><table><caption>Daily tagged requests for ${escapeHtml(source.source)}</caption><thead><tr><th>UTC date</th><th class="num">Requests</th></tr></thead><tbody>${
              source.dailyActivity
                .slice(-30)
                .map(
                  (day) =>
                    `<tr><td>${escapeHtml(day.date)}</td><td class="num">${number(day.requests)}</td></tr>`
                )
                .join('') || '<tr><td colspan="2" class="empty">No parseable timestamps.</td></tr>'
            }</tbody></table></div>${source.dailyActivityTruncated || source.dailyActivity.length > 30 ? '<p class="note">Showing the latest 30 day buckets; JSON retains up to 730.</p>' : ''}</details>`;
      return `<tr><td>${escapeHtml(source.source)}</td><td class="num">${number(source.requests)}</td><td class="num">${number(source.uniquePaths)}${source.uniquePathsTruncated ? '+' : ''}</td><td class="num">${number(source.responseClasses.successful2xx)}</td><td class="num">${number(source.responseClasses.redirects3xx)}</td><td class="num">${number(source.responseClasses.clientErrors4xx)}</td><td class="num">${number(source.responseClasses.serverErrors5xx)}</td><td>${escapeHtml(source.firstSeenAt ?? '—')} → ${escapeHtml(source.lastSeenAt ?? '—')}</td><td>${details}</td></tr>`;
    })
    .join('');
  return `<section class="correlation"><span class="eyebrow">First-party tagged request evidence</span><h2>Requests carrying configured AI referral tags</h2><p class="note">Only a matching <code>utm_source</code> is used. The report keeps the configured source label and normalized request path, not query values. Per-path response media types are bounded logged headers, not content-quality checks. These are HTTP request rows, not sessions, unique visitors, or proof that an AI system cited a page. Missing tags do not mean there was no AI referral; analytics exports may provide broader attribution.</p><div class="table-wrap"><table><thead><tr><th>Configured source label</th><th class="num">Requests</th><th class="num">Unique retained paths</th><th class="num">2xx</th><th class="num">3xx</th><th class="num">4xx</th><th class="num">5xx</th><th>Observed span (UTC)</th><th>Path and daily detail</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function renderUtmSourceCoverage(coverage: AiReferralUtmSourceCoverage | undefined): string {
  if (!coverage) return '';
  const markerShare =
    coverage.parsedRequestRows > 0
      ? `${((coverage.requestsWithUtmSource / coverage.parsedRequestRows) * 100).toFixed(1)}% of ${number(coverage.parsedRequestRows)} parsed request rows`
      : 'no parsed request rows';
  return `<p class="note">UTM source marker coverage: ${number(coverage.requestsWithUtmSource)} request rows carried a marker (${markerShare}) · ${number(coverage.requestsWithConfiguredSource)} matched configured labels · ${number(coverage.requestsWithUnconfiguredSingleValue)} had one unconfigured value · ${number(coverage.requestsWithConflictingValues)} had conflicting values · ${number(coverage.requestsWithEmptyOrOversizedValue)} had an empty or oversized value. Unmatched values are not retained and are not assumed to be AI referrals.</p>`;
}

function renderIpRangeVerification(
  verification: AiCrawlerAccessLogAnalysis['ipRangeVerification']
): string {
  if (!verification || verification.length === 0) return '';
  const rows = verification
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.token)}</td><td class="num">${number(item.configuredCidrCount)}</td><td class="num">${number(item.userAgentMatchedRequests)}</td><td class="num">${number(item.requestsWithMatchedRange)}</td><td class="num">${number(item.requestsOutsideConfiguredRanges)}</td><td class="num">${number(item.requestsWithoutClientIp)}</td><td class="num">${number(item.requestsWithInvalidClientIp)}</td></tr>`
    )
    .join('');
  return `<details class="correlation"><summary>Caller-supplied crawler IP range checks (${number(verification.length)} tokens)</summary><p class="note">A range match means the logged source address fell inside a CIDR you supplied. It does not authenticate a crawler or confirm that the ranges are current. Aviary does not fetch provider ranges, and this report contains neither raw addresses nor CIDR values.</p><div class="table-wrap"><table><thead><tr><th>Claimed token</th><th class="num">Configured CIDRs</th><th class="num">User-agent matches</th><th class="num">In supplied ranges</th><th class="num">Outside ranges</th><th class="num">Address missing</th><th class="num">Address invalid</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}

function renderCrawler(crawler: AiCrawlerLogSummary): string {
  const methods =
    crawler.requestMethods
      .map(({ method, requests }) => `${escapeHtml(method)} ${number(requests)}`)
      .join(' · ') || 'not recorded';
  const statuses =
    crawler.statusCodes
      .map(({ status, requests }) => `${statusCode(status)} ${number(requests)}`)
      .join(' · ') || 'not recorded';
  const botEvidence = crawler.cloudflareBotEvidence;
  const scoreGroups =
    botEvidence.requestsWithBotScore > 0
      ? `Score groups: ${number(botEvidence.botScoreGroups.automated)} automated · ${number(botEvidence.botScoreGroups.likelyAutomated)} likely automated · ${number(botEvidence.botScoreGroups.likelyHuman)} likely human · ${number(botEvidence.botScoreGroups.notComputed)} not computed (${number(botEvidence.requestsWithBotScore)} scored)`
      : 'Bot score not supplied';
  const scoreSources = Object.entries(botEvidence.botScoreSourceCounts)
    .filter(([, requests]) => requests > 0)
    .map(([source, requests]) => `${escapeHtml(source)} ${number(requests)}`)
    .join(' · ');
  const verifiedCategories = botEvidence.verifiedBotCategories
    .map(({ category, requests }) => `${escapeHtml(category)} ${number(requests)}`)
    .join(' · ');
  const security = crawler.cloudflareSecurityActions;
  const securitySummary =
    security.requestsWithSecurityActions > 0
      ? `Cloudflare security actions: ${number(security.blockingRequests)} blocking · ${number(security.challengeRequests)} challenge · ${number(security.challengeSolvedOrBypassedRequests)} solved/bypassed · ${number(security.allowBypassOrSkipRequests)} allow/bypass/skip · ${number(security.otherActionRequests)} other across ${number(security.requestsWithSecurityActions)} annotated requests.`
      : 'Cloudflare SecurityAction fields were not observed.';
  const botEvidenceSummary =
    botEvidence.requestsWithCloudflareBotFields === 0
      ? `<p class="meta">Cloudflare bot verification/score fields: not present in these logs.<br>${securitySummary}</p>`
      : `<p class="meta">Cloudflare bot fields on ${number(botEvidence.requestsWithCloudflareBotFields)} claimed-crawler requests; ${number(botEvidence.verifiedBotRequests)} carried verified-bot evidence. ${scoreGroups}. Score sources: ${scoreSources || 'not supplied'}. Verified-bot category: ${verifiedCategories || 'not supplied'}${botEvidence.verifiedBotCategoriesTruncated ? ' · additional categories omitted' : ''}. These are Cloudflare log annotations, not proof of the named product identity.<br>${securitySummary}</p>`;
  return `<section class="crawler-card"><div class="crawler-head"><div><span class="eyebrow">${escapeHtml(crawler.provider)} · ${escapeHtml(crawler.activity.replace(/-/g, ' '))}</span><h3>${escapeHtml(crawler.token)}</h3></div><strong class="total">${number(crawler.requests)}<small>requests</small></strong></div><div class="stats"><div><strong>${number(crawler.uniquePaths)}</strong><span>unique paths</span></div><div><strong>${number(crawler.responseClasses.successful2xx)}</strong><span>2xx responses</span></div><div><strong>${number(crawler.responseClasses.clientErrors4xx)}</strong><span>4xx responses</span></div><div><strong>${number(crawler.responseClasses.serverErrors5xx)}</strong><span>5xx responses</span></div></div><p class="meta">UTC range: ${escapeHtml(crawler.firstSeenAt ?? 'unknown')} → ${escapeHtml(crawler.lastSeenAt ?? 'unknown')}<br>4xx/5xx: ${number(crawler.failureRequests)} of ${number(crawler.requests)} requests (${crawler.failureRatePercent}%) across ${number(crawler.pathsWithFailures)} paths</p><p class="meta">Methods: ${methods}${crawler.requestMethodsTruncated ? ' · additional methods omitted' : ''}<br>Status codes: ${statuses}${crawler.statusCodesTruncated ? ' · additional codes omitted' : ''}${crawler.originStatusObservations > 0 ? `<br>Edge/origin status differences: ${number(crawler.edgeOriginStatusDifferences)} of ${number(crawler.originStatusObservations)} paired responses` : ''}<br>Request timing: ${escapeHtml(formatResponseTiming(crawler.responseTiming))}<br>CloudFront results: ${escapeHtml(formatCloudFrontResults(crawler.cloudFrontResultProfile))}</p>${botEvidenceSummary}<details><summary>4xx/5xx path hotspots (${number(crawler.pathsWithFailures)})</summary>${renderFailureHotspots(crawler)}</details><details open><summary>Observed paths</summary>${renderPathTable(crawler)}</details><details><summary>Daily trend (${number(crawler.dailyActivity.length)} days)</summary>${renderDailyTable(crawler.dailyActivity)}</details></section>`;
}

function renderPathResponseComparison(
  comparison: AiCrawlerAccessLogAnalysis['searchCrawlerPathComparison']
): string {
  if (comparison.crawlersCompared.length < 2) return '';
  const label = comparison.activity === 'search-crawl' ? 'Search' : 'Training-data';
  const disparityRows = comparison.disparities
    .map((item) => {
      const profiles = item.crawlers
        .map(
          (profile) =>
            `<div><strong>${escapeHtml(profile.crawlerToken)}</strong> (${escapeHtml(profile.provider)}): ${number(profile.requests)} req · 2xx ${number(profile.successfulResponses)} · 3xx ${number(profile.redirects)} · 4xx ${number(profile.clientErrors)} · 5xx ${number(profile.serverErrors)} · HTTP ${escapeHtml(profile.statusCodes.map(({ status, requests }) => `${statusCode(status)}×${number(requests)}`).join(', ') || 'unknown')}${profile.statusCodesTruncated ? ' +' : ''} · media ${escapeHtml(profile.responseContentTypes.map(({ contentType, requests }) => `${contentType}×${number(requests)}`).join(', ') || 'unknown')}${profile.responseContentTypesTruncated ? ' +' : ''}</div>`
        )
        .join('');
      const difference = item.hasSuccessFailureSplit
        ? '<strong class="blocked">2xx / 4xx–5xx split</strong>'
        : item.hasDifferentStatusCodeSets
          ? 'HTTP status codes differ'
          : item.hasDifferentContentTypeSets
            ? 'Response media types differ'
            : 'Response classes differ';
      return `<tr data-search="${escapeHtml(`${item.path} ${item.crawlers.map(({ crawlerToken }) => crawlerToken).join(' ')}`.toLowerCase())}"><td><code>${escapeHtml(item.path)}</code></td><td class="num">${number(item.observedCrawlerCount)}</td><td>${difference}${item.statusCodeDetailsTruncated ? ' · code detail capped' : ''}${item.contentTypeDetailsTruncated ? ' · media detail capped' : ''}</td><td>${profiles}</td></tr>`;
    })
    .join('');
  return `<section class="correlation"><span class="eyebrow">Cross-token server evidence</span><h2>${label} crawler response differences</h2><p class="note">${number(comparison.pathsWithDifferentResponseClasses)} of ${number(comparison.sharedPathsCompared)} shared paths showed different response classes; ${number(comparison.pathsWithDifferentStatusCodeSets)} had different reported HTTP code sets; ${number(comparison.pathsWithDifferentContentTypeSets)} had different reported media-type sets; ${number(comparison.pathsWithSuccessFailureSplit)} had a 2xx versus 4xx/5xx split. ${comparison.crawlersCompared.length} ${label.toLowerCase()} tokens compared.</p>${comparison.inputPathsTruncated ? '<p class="note">At least one crawler path list was truncated to its most-requested paths, so less-requested shared paths may be missing.</p>' : ''}${comparison.pathsWithTruncatedStatusCodeDetails ? `<p class="note">${number(comparison.pathsWithTruncatedStatusCodeDetails)} shared paths have a crawler with more than ten status codes; low-frequency codes may be absent from comparisons.</p>` : ''}${comparison.pathsWithTruncatedContentTypeDetails ? `<p class="note">${number(comparison.pathsWithTruncatedContentTypeDetails)} shared paths have more than five response media types under a crawler token; lower-frequency types may be absent.</p>` : ''}<div class="table-wrap"><table><thead><tr><th>Path (query removed)</th><th>Tokens</th><th>Difference</th><th>HTTP status classes, codes, and response media types by claimed token</th></tr></thead><tbody>${disparityRows || '<tr><td colspan="4" class="empty">No response-class, reported status-code, or media-type differences among shared retained paths.</td></tr>'}</tbody></table></div>${comparison.rowsTruncated ? '<p class="note">Detailed rows are capped at 500; comparison totals include all shared retained paths.</p>' : ''}<p class="note">${escapeHtml(comparison.note)}</p></section>`;
}

function renderAnalysis(analysis: AiCrawlerAccessLogAnalysis, index: number): string {
  const botRows = analysis.crawlers
    .map(
      (crawler) =>
        `<tr><td>${escapeHtml(crawler.provider)}</td><td>${escapeHtml(crawler.token)}</td><td>${escapeHtml(crawler.activity.replace(/-/g, ' '))}</td><td class="num">${number(crawler.requests)}</td><td class="num">${number(crawler.uniquePaths)}</td><td class="num">${number(crawler.responseClasses.clientErrors4xx)}</td><td class="num">${number(crawler.responseClasses.serverErrors5xx)}</td></tr>`
    )
    .join('');
  const responseComparison = analysis.searchCrawlerPathComparison;
  const parityHtml =
    renderPathResponseComparison(responseComparison) +
    renderPathResponseComparison(analysis.trainingCrawlerPathComparison);
  const crawlerDetails = analysis.crawlers.length
    ? analysis.crawlers.map(renderCrawler).join('')
    : '<p class="empty">No known AI crawler tokens were observed in this log.</p>';
  return `<section class="report" aria-labelledby="report-${index}"><div class="report-head"><div><span class="eyebrow">Access log ${String(index + 1).padStart(2, '0')} · ${number(analysis.linesRead)} non-empty lines</span><h2 id="report-${index}">${escapeHtml(analysis.sourceFile ?? 'Local log input')}</h2><p class="note">${escapeHtml(analysis.firstSeenAt ?? 'Unknown start')} → ${escapeHtml(analysis.lastSeenAt ?? 'Unknown end')} · recognized ${number(analysis.recognizedAiCrawlerRequests)} AI crawler requests</p></div></div><div class="stats overall"><div><strong>${number(analysis.parsedRequests)}</strong><span>parsed requests</span></div><div><strong>${number(analysis.skippedLines)}</strong><span>skipped lines</span></div><div><strong>${number(analysis.requestsWithUnrecognizedUserAgent)}</strong><span>other user agents</span></div><div><strong>${number(analysis.uniquePathsAcrossRecognizedBots)}</strong><span>unique AI paths</span></div></div><div class="table-wrap"><table><caption>AI crawler request totals from ${escapeHtml(analysis.sourceFile ?? 'the log')}</caption><thead><tr><th scope="col">Provider</th><th scope="col">Token claim</th><th scope="col">Activity class</th><th scope="col" class="num">Requests</th><th scope="col" class="num">Paths</th><th scope="col" class="num">4xx</th><th scope="col" class="num">5xx</th></tr></thead><tbody>${botRows || '<tr><td colspan="7" class="empty">No recognized crawler requests.</td></tr>'}</tbody></table></div>${renderIpRangeVerification(analysis.ipRangeVerification)}${parityHtml}${renderUtmSourceCoverage(analysis.utmSourceAttributionCoverage)}${renderAiReferralTraffic(analysis.aiReferralTraffic ?? [])}<div class="crawler-grid">${crawlerDetails}</div><p class="note">${escapeHtml(analysis.note)}</p></section>`;
}

function formatReferralCrawlerOverlap(
  overlap: AiReferralGeoAuditCoverage['pathObservations'][number]['searchCrawlers']
): string {
  if (overlap.logCoverage === 'not-observed-in-sample') return 'Not observed in this log sample';
  if (overlap.logCoverage === 'incomplete')
    return 'No retained match; path omitted from a truncated crawler list';
  return `${overlap.tokens.join(', ')} · ${number(overlap.requests)} requests · ${number(overlap.failures)} 4xx/5xx${overlap.latestRequestAt ? ` · last ${overlap.latestRequestAt}` : ''}${overlap.logCoverage === 'observed-incomplete' ? ' · lower bound; path omitted from a truncated crawler list' : ''}`;
}

function renderAiReferralAuditCoverage(coverage: AiReferralGeoAuditCoverage): string {
  if (coverage.sources.length === 0) return '';
  const sourceRows = coverage.sources
    .map((source) => {
      const searchOverlap = `${number(source.retainedPathsWithSearchCrawlerRequests)} paths · ${number(source.searchCrawlerRequestsOnRetainedPaths)} requests · ${number(source.searchCrawlerFailuresOnRetainedPaths)} failures · ${number(source.retainedPathsWithIncompleteSearchCrawlerCoverage)} incomplete`;
      const trainingOverlap = `${number(source.retainedPathsWithTrainingCrawlerRequests)} paths · ${number(source.trainingCrawlerRequestsOnRetainedPaths)} requests · ${number(source.trainingCrawlerFailuresOnRetainedPaths)} failures · ${number(source.retainedPathsWithIncompleteTrainingCrawlerCoverage)} incomplete`;
      return `<tr><td>${escapeHtml(source.source)}</td><td class="num">${number(source.requestsInSample)}</td><td class="num">${number(source.retainedPathsCompared)}</td><td class="num">${number(source.retainedPathsMatchedToAudit)}</td><td class="num">${number(source.retainedPathsAmbiguousInAudit)}</td><td class="num">${number(source.retainedPathsNotInAudit)}</td><td class="num">${number(source.retainedRequestsMatchedToAudit)} / ${number(source.retainedRequestsCompared)}</td><td class="num">${number(source.retainedRequestsOnNoindexPages)} noindex · ${number(source.retainedRequestsOnSnippetRestrictedPages)} snippet restricted</td><td class="num">${number(source.retainedRequestsOnPagesWithQuestionHeadings)} question headings · ${number(source.retainedRequestsOnPagesWithConciseAnswerBlocks)} answer blocks</td><td>${escapeHtml(searchOverlap)}</td><td>${escapeHtml(trainingOverlap)}</td><td>${source.pathsTruncated || source.uniquePathsTruncated ? 'Retained path list capped' : 'Retained paths complete'}</td></tr>`;
    })
    .join('');
  const pathRows = coverage.pathObservations
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.source)}</td><td><code>${escapeHtml(item.path)}</code></td><td class="num">${number(item.requests)}</td><td>${escapeHtml(item.auditMatchType)}</td><td>${item.auditUrl ? escapeHtml(item.auditUrl) : '—'}</td><td>${item.currentNoindex === undefined ? 'not assessed' : item.currentNoindex ? 'yes' : 'no'}</td><td>${item.currentNoSnippet === undefined && item.currentMaxSnippetZero === undefined ? 'not assessed' : item.currentNoSnippet || item.currentMaxSnippetZero ? 'restricted' : 'no restriction'}</td><td>${item.currentQuestionHeadings === undefined ? 'not assessed' : number(item.currentQuestionHeadings)}</td><td>${item.currentConciseAnswerBlocks === undefined ? 'not assessed' : number(item.currentConciseAnswerBlocks)}</td><td>${escapeHtml(formatReferralCrawlerOverlap(item.searchCrawlers))}</td><td>${escapeHtml(formatReferralCrawlerOverlap(item.trainingDataCrawlers))}</td></tr>`
    )
    .join('');
  return `<details class="correlation"><summary>Tagged referral request paths against the audit (${number(coverage.sources.length)} source labels)</summary><p class="note">${escapeHtml(coverage.note)}</p><div class="table-wrap"><table><thead><tr><th>Source label</th><th class="num">All tagged requests</th><th class="num">Retained paths</th><th class="num">Matched</th><th class="num">Ambiguous</th><th class="num">Not in audit</th><th class="num">Matched requests / retained</th><th class="num">Current controls on matched pages</th><th class="num">Current content signals</th><th>Search crawler overlap</th><th>Training crawler overlap</th><th>Coverage</th></tr></thead><tbody>${sourceRows}</tbody></table></div><details><summary>Retained path details (${number(coverage.pathObservations.length)}${coverage.pathObservationsTruncated ? '+' : ''})</summary><div class="table-wrap"><table><thead><tr><th>Source</th><th>Path</th><th class="num">Requests</th><th>Audit match</th><th>Audit URL</th><th>Noindex</th><th>Snippet</th><th>Question headings</th><th>Concise answer blocks</th><th>Search crawler log sample</th><th>Training crawler log sample</th></tr></thead><tbody>${pathRows || '<tr><td colspan="11" class="empty">No retained tagged paths.</td></tr>'}</tbody></table></div>${coverage.pathObservationsTruncated ? '<p class="note">Path details are capped at 2,000 across source labels.</p>' : ''}</details></details>`;
}

function renderAuditCorrelation(correlation: AiCrawlerLogGeoCorrelation): string {
  const rows = correlation.pathObservations
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.crawlerToken)}</td><td><code>${escapeHtml(item.path)}</code></td><td>${number(item.requests)}</td><td>${escapeHtml(item.lastSeenAt ?? 'unknown')}</td><td>${item.daysBeforeLatestRequest === undefined ? '—' : number(item.daysBeforeLatestRequest)}</td><td>${escapeHtml(item.auditMatchType)}</td><td>${escapeHtml(item.currentRobotsAccess)}</td><td>${item.currentNoindex ? 'yes' : item.currentNoindex === false ? 'no' : 'not assessed'}</td><td>${item.currentNoSnippet || item.currentMaxSnippetZero ? 'restricted' : item.currentNoSnippet === false || item.currentMaxSnippetZero === false ? 'no restriction' : 'not assessed'}</td><td>${item.currentNoArchive === undefined ? 'not assessed' : item.currentNoArchive ? 'present' : 'absent'}</td><td>${escapeHtml(formatAuditedAnswerContent(item))}</td><td>${escapeHtml(formatAuditedCitationEvidence(item))}</td></tr>`
    )
    .join('');
  const coverage = correlation.auditPathCoverage;
  const coverageSummaries = coverage.crawlers
    .map(
      (crawler) =>
        `<tr><td>${escapeHtml(crawler.provider)}</td><td>${escapeHtml(crawler.crawlerToken)}</td><td>${escapeHtml(crawler.latestRequestAt ?? 'unknown')}</td><td class="num">${number(crawler.pathsEvaluated)}</td><td class="num">${number(crawler.pathsObserved)}</td><td class="num">${number(crawler.observedPathsWithin7DaysOfLatestRequest)}</td><td class="num">${number(crawler.observedPaths8To30DaysBeforeLatestRequest)}</td><td class="num">${number(crawler.observedPathsOver30DaysBeforeLatestRequest)}</td><td class="num">${number(crawler.observedPathsWithoutTimestamp)}</td><td class="num">${number(crawler.pathsNotObservedInLog)}</td><td class="num">${number(crawler.pathsAmbiguous)}</td><td class="num">${number(crawler.pathsUnassessableBecauseTruncated)}</td><td class="num">${number(crawler.currentlyNoArchivePaths)}</td></tr>`
    )
    .join('');
  const coverageRowsPerCrawler = Math.max(1, Math.floor(2_000 / coverage.crawlers.length));
  const coverageRows = coverage.crawlers
    .flatMap((crawler) =>
      crawler.paths
        .slice(0, coverageRowsPerCrawler)
        .map(
          (item) =>
            `<tr><td>${escapeHtml(crawler.crawlerToken)}</td><td><code>${escapeHtml(item.path)}</code></td><td>${number(item.auditedUrlCount)}</td><td>${escapeHtml(item.observation)}</td><td>${item.requests === undefined ? '—' : number(item.requests)}</td><td>${escapeHtml(item.statusCodes?.map(({ status, requests }) => `${statusCode(status)}×${number(requests)}`).join(', ') || '—')}${item.statusCodesTruncated ? ' +' : ''}</td><td>${escapeHtml(item.responseContentTypes?.map(({ contentType, requests }) => `${contentType}×${number(requests)}`).join(', ') || '—')}${item.responseContentTypesTruncated ? ' +' : ''}</td><td>${item.timestampedRequests === undefined ? '—' : number(item.timestampedRequests)}</td><td>${escapeHtml(item.lastSeenAt ?? '—')}</td><td>${item.daysBeforeLatestRequest === undefined ? '—' : number(item.daysBeforeLatestRequest)}</td><td>${escapeHtml(item.currentRobotsAccess)}</td><td>${item.currentNoindex ? 'yes' : item.currentNoindex === false ? 'no' : 'not assessed'}</td><td>${item.currentNoSnippet || item.currentMaxSnippetZero ? 'restricted' : item.currentNoSnippet === false || item.currentMaxSnippetZero === false ? 'no restriction' : 'not assessed'}</td><td>${item.currentNoArchive === undefined ? 'not assessed' : item.currentNoArchive ? 'present' : 'absent'}</td></tr>`
        )
    )
    .join('');
  const coverageHtmlTruncated =
    coverage.rowsTruncated ||
    coverage.crawlers.some((crawler) => crawler.paths.length > coverageRowsPerCrawler);
  const coverageHtml =
    renderGeoPriorityQueue(correlation) +
    `<details><summary>Audit page coverage by crawler (${number(coverage.uniqueAuditPaths)} unique paths)</summary><p class="note">${escapeHtml(coverage.note)}${coverage.auditPagesSkipped ? ` Audit pages skipped: ${number(coverage.auditPagesSkipped)}.` : ''}</p><div class="table-wrap"><table><thead><tr><th>Provider</th><th>Token</th><th>Latest event (UTC)</th><th>Audited paths</th><th>Observed</th><th>0–7 days old</th><th>8–30 days old</th><th>Over 30 days old</th><th>Timestamp unknown</th><th>Not observed</th><th>Ambiguous</th><th>Unassessable</th><th>Current noarchive paths</th></tr></thead><tbody>${coverageSummaries}</tbody></table></div><div class="table-wrap"><table><thead><tr><th>Token</th><th>Path (query removed)</th><th>Audited URL count</th><th>Log observation</th><th>Requests</th><th>HTTP codes</th><th>Response media types</th><th>Timestamped requests</th><th>Last seen (UTC)</th><th>Days before latest event</th><th>Current robots</th><th>Noindex</th><th>Snippet</th><th>Noarchive</th></tr></thead><tbody>${coverageRows || '<tr><td colspan="14" class="empty">No audited paths.</td></tr>'}</tbody></table></div>${coverageHtmlTruncated ? '<p class="note">Path-level HTML details are capped fairly at 2,000 rows; structured per-token summary counts include all unique audited paths, and the JSON report carries its own detail truncation flag.</p>' : ''}</details>`;
  const referralCoverageHtml = correlation.aiReferralAuditCoverage
    ? renderAiReferralAuditCoverage(correlation.aiReferralAuditCoverage)
    : '';
  return `<section class="correlation"><span class="eyebrow">Current audit snapshot · ${escapeHtml(correlation.auditTimestamp)}</span><h2>Observed paths against the GEO audit</h2><p class="note">${escapeHtml(correlation.origin)} · ${number(correlation.logPathsMatchedToAudit)} paths matched · ${number(correlation.logPathsAmbiguousInAudit)} ambiguous · ${number(correlation.logPathsNotInAudit)} not audited · ${number(correlation.requestsOnCurrentlyRobotsBlockedPaths)} matched requests fall on currently blocked paths · matched paths returned ${number(correlation.requestsOnAuditedPathsWithRedirects)} redirects, ${number(correlation.requestsOnAuditedPathsWithClientErrors)} client errors, and ${number(correlation.requestsOnAuditedPathsWithServerErrors)} server errors · ${number(correlation.requestsOnAuditedPathsWithQuestionHeadings)} matched requests on paths with measured question headings · ${number(correlation.requestsOnAuditedPathsWithConciseAnswerBlocks)} with concise answer blocks · ${number(correlation.requestsOnAuditedPathsWithExternalSourceLinks)} with external source links · ${number(correlation.requestsOnAuditedPathsWithInlineCitationMarkers)} with inline citation markers · ${number(correlation.requestsOnApplebotPagesMarkedPaywalled)} Applebot requests on pages marked paywalled in JSON-LD · ${number(correlation.requestsOnApplebotPagesWithNoSnippet)} on pages with nosnippet · ${number(correlation.requestsOnApplebotPagesWithDocumentedAiContextExclusion)} on pages with either documented AI-context exclusion</p><div class="table-wrap"><table><thead><tr><th>Token</th><th>Path</th><th>Requests</th><th>Last seen (UTC)</th><th>Days before latest event</th><th>Audit match</th><th>Robots</th><th>Noindex</th><th>Snippet</th><th>Noarchive</th><th>Current answer structure</th><th>Current source/citation evidence</th></tr></thead><tbody>${rows || '<tr><td colspan="12" class="empty">No retained paths.</td></tr>'}</tbody></table></div>${coverageHtml}${referralCoverageHtml}<p class="note">${escapeHtml(correlation.note)}</p></section>`;
}

function renderRobotsReplay(replay: AiCrawlerRobotsPolicyAnalysis): string {
  const rows = replay.pathObservations
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.crawlerToken)}</td><td><code>${escapeHtml(item.path)}</code></td><td>${number(item.requests)}</td><td><strong class="policy-${escapeHtml(item.policyDecision)}">${escapeHtml(item.policyDecision)}</strong></td><td>${escapeHtml(item.selectedAgents.join(', ') || '—')}</td><td>${item.matchedRule ? `${escapeHtml(item.matchedRule.directive)} ${escapeHtml(item.matchedRule.pattern)} (line ${number(item.matchedRule.line)})` : '—'}</td></tr>`
    )
    .join('');
  const summary = replay.crawlers
    .map(
      (crawler) =>
        `<tr><td>${escapeHtml(crawler.token)}</td><td>${escapeHtml(crawler.activity)}</td><td>${number(crawler.pathsEvaluated)}</td><td>${number(crawler.allowedPaths)}</td><td>${number(crawler.blockedPaths)}</td><td>${number(crawler.blockedRequests)}</td></tr>`
    )
    .join('');
  return `<section class="correlation"><span class="eyebrow">Saved robots.txt snapshot · ${escapeHtml(replay.sourceModifiedAt ?? 'mtime unavailable')}</span><h2>Replay retained log paths against robots.txt</h2><p class="note">${escapeHtml(replay.origin)} · SHA-256 ${escapeHtml(replay.robotsSha256)} · results use the current supplied rules, separate from historical HTTP responses.</p><div class="table-wrap"><table><thead><tr><th>Token</th><th>Activity</th><th>Paths evaluated</th><th>Allowed</th><th>Blocked</th><th>Blocked requests</th></tr></thead><tbody>${summary || '<tr><td colspan="6" class="empty">No crawler tokens.</td></tr>'}</tbody></table></div><details><summary>Path-level decisions (${number(replay.pathObservations.length)})</summary><div class="table-wrap"><table><thead><tr><th>Token</th><th>Path</th><th>Requests</th><th>Decision</th><th>Selected groups</th><th>Matched rule</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">No retained paths.</td></tr>'}</tbody></table></div></details><p class="note">${escapeHtml(replay.note)}</p></section>`;
}

function renderRobotsComparison(comparison: AiCrawlerRobotsPolicyComparison): string {
  const rows = comparison.pathChanges
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.crawlerToken)}</td><td><code>${escapeHtml(item.path)}</code></td><td>${number(item.requests)}</td><td>${escapeHtml(item.baselineDecision ?? 'not available')}</td><td>${escapeHtml(item.policyDecision)}</td><td><strong class="policy-${escapeHtml(item.change)}">${escapeHtml(item.change)}</strong></td><td>${item.baselineMatchedRule ? `${escapeHtml(item.baselineMatchedRule.directive)} ${escapeHtml(item.baselineMatchedRule.pattern)}` : '—'} → ${item.matchedRule ? `${escapeHtml(item.matchedRule.directive)} ${escapeHtml(item.matchedRule.pattern)}` : '—'}</td></tr>`
    )
    .join('');
  return `<section class="correlation"><span class="eyebrow">Robots policy diff · ${escapeHtml(comparison.origin)}</span><h2>What changed for observed crawler paths?</h2><p class="note">${number(comparison.pathsNewlyBlocked)} newly blocked · ${number(comparison.pathsNewlyAllowed)} newly allowed · ${number(comparison.pathsWithRuleChanges)} matching-rule changes · ${number(comparison.pathsNotComparable)} not comparable · ${number(comparison.requestsNewlyBlocked)} logged requests moved to blocked paths.</p><p class="meta">Baseline SHA-256 ${escapeHtml(comparison.baselineSnapshot.sha256)} · Current SHA-256 ${escapeHtml(comparison.currentSnapshot.sha256)}</p><div class="table-wrap"><table><thead><tr><th>Token</th><th>Path</th><th>Requests</th><th>Baseline</th><th>Current</th><th>Change</th><th>Matched rule: baseline → current</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty">No path observations.</td></tr>'}</tbody></table></div><p class="note">${escapeHtml(comparison.note)}</p></section>`;
}

function renderLogPeriodComparison(comparison: AiCrawlerLogPeriodComparison): string {
  const rows = comparison.crawlers
    .map((crawler: AiCrawlerLogPeriodCrawlerComparison) => {
      const delta =
        crawler.failureRateDeltaPercentagePoints > 0
          ? `+${crawler.failureRateDeltaPercentagePoints}`
          : String(crawler.failureRateDeltaPercentagePoints);
      const formatCoverage = (baseline: number | null, current: number | null): string =>
        baseline === null && current === null
          ? 'unknown'
          : `${baseline === null ? '?' : number(baseline)} → ${current === null ? '?' : number(current)}`;
      const cloudflare = `Verified ${formatCoverage(crawler.baselineCloudflareVerifiedBotRequests, crawler.currentCloudflareVerifiedBotRequests)} · actions ${formatCoverage(crawler.baselineCloudflareSecurityActionRequests, crawler.currentCloudflareSecurityActionRequests)} · blocks ${formatCoverage(crawler.baselineCloudflareBlockingRequests, crawler.currentCloudflareBlockingRequests)} · challenges ${formatCoverage(crawler.baselineCloudflareChallengeRequests, crawler.currentCloudflareChallengeRequests)}`;
      const formatTimingDelta = (metric: typeof crawler.timing.responseDuration): string =>
        metric.change === 'not-comparable'
          ? 'not comparable (' +
            (metric.baselineSamples ?? '?') +
            ' → ' +
            (metric.currentSamples ?? '?') +
            ' samples)'
          : metric.baselineP95Band +
            ' → ' +
            metric.currentP95Band +
            ' (' +
            metric.change +
            '; ' +
            number(metric.baselineSamples ?? 0) +
            ' → ' +
            number(metric.currentSamples ?? 0) +
            ' samples)';
      const timing =
        'Duration ' +
        formatTimingDelta(crawler.timing.responseDuration) +
        ' · TTFB ' +
        formatTimingDelta(crawler.timing.timeToFirstByte);
      const edgeProfile = crawler.cloudFrontResults;
      const formatResultTypes = (types: typeof edgeProfile.resultTypes): string =>
        types
          .filter((item) => (item.baselineRequests ?? 0) > 0 || (item.currentRequests ?? 0) > 0)
          .map(
            (item) =>
              `${item.resultType} ${item.baselineSharePercent === null ? '?' : `${item.baselineSharePercent}%`}→${item.currentSharePercent === null ? '?' : `${item.currentSharePercent}%`}${item.shareDeltaPercentagePoints === null ? '' : ` (${item.shareDeltaPercentagePoints > 0 ? '+' : ''}${item.shareDeltaPercentagePoints} pp)`}`
          )
          .join(' · ') || 'not logged';
      const cloudFront = edgeProfile.comparisonAvailable
        ? `edge ${formatResultTypes(edgeProfile.resultTypes)}; response ${formatResultTypes(edgeProfile.responseResultTypes)}; paired differences ${edgeProfile.baselineDifferenceSharePercent === null ? '?' : `${edgeProfile.baselineDifferenceSharePercent}%`}→${edgeProfile.currentDifferenceSharePercent === null ? '?' : `${edgeProfile.currentDifferenceSharePercent}%`}`
        : 'not comparable (CloudFront result fields absent or unpaired)';
      return `<tr><td>${escapeHtml(crawler.provider)} · ${escapeHtml(crawler.token)}</td><td class="num">${number(crawler.baselineRequests)} → ${number(crawler.currentRequests)}<br>${crawler.requestDelta > 0 ? '+' : ''}${number(crawler.requestDelta)}</td><td class="num">${crawler.baselineFailureRatePercent}% → ${crawler.currentFailureRatePercent}%<br>${delta} pp</td><td class="num">${number(crawler.sharedRetainedPathsCompared)}</td><td class="num">${number(crawler.sharedPathsWithNewFailures)} new · ${number(crawler.sharedPathsWithResolvedFailures)} cleared</td><td class="num">${number(crawler.pathsOnlyInCurrentRetainedList)} current · ${number(crawler.pathsOnlyInBaselineRetainedList)} baseline</td><td>${escapeHtml(cloudflare)}</td><td>${escapeHtml(cloudFront)}</td><td>${escapeHtml(timing)}</td><td>${crawler.inputPathsTruncated ? 'Path lists truncated' : 'Retained lists compared'}</td></tr>`;
    })
    .join('');
  const details = comparison.crawlers
    .filter(({ pathChanges }) => pathChanges.length > 0)
    .map((crawler) => {
      const pathRows = crawler.pathChanges
        .map((item) => {
          const before = item.baseline;
          const after = item.current;
          const formatProfile = (profile: typeof before): string =>
            profile
              ? `${number(profile.requests)} req · ${number(profile.failureRequests)} failures · ${profile.requestSharePercent}% sample share · ${profile.failureRatePercent}% failed · HTTP ${profile.statusCodes.map(statusCode).join(', ') || 'unknown'}${profile.statusCodesTruncated ? ' +' : ''} · media ${profile.responseContentTypes.join(', ') || 'unknown'}${profile.responseContentTypesTruncated ? ' +' : ''}`
              : 'not retained';
          const baselineSummary = formatProfile(before);
          const currentSummary = formatProfile(after);
          const failureDelta =
            item.failureRateDeltaPercentagePoints === null
              ? '—'
              : `${item.failureRateDeltaPercentagePoints > 0 ? '+' : ''}${item.failureRateDeltaPercentagePoints} pp`;
          const requestShareDelta =
            item.requestShareDeltaPercentagePoints === null
              ? '—'
              : `${item.requestShareDeltaPercentagePoints > 0 ? '+' : ''}${item.requestShareDeltaPercentagePoints} pp`;
          return `<tr><td><code>${escapeHtml(item.path)}</code></td><td>${escapeHtml(item.change)}</td><td>${escapeHtml(baselineSummary)}</td><td>${escapeHtml(currentSummary)}</td><td class="num">${failureDelta}<br>${requestShareDelta} share</td></tr>`;
        })
        .join('');
      return `<details><summary>${escapeHtml(crawler.token)} · ${number(crawler.pathChanges.length)} path change(s)${crawler.pathChangesTruncated ? ' · capped' : ''}</summary><div class="table-wrap"><table><thead><tr><th>Path</th><th>Change</th><th>Baseline</th><th>Current</th><th>Failure / request share delta</th></tr></thead><tbody>${pathRows}</tbody></table></div></details>`;
    })
    .join('');
  const referralRows = comparison.aiReferralSources
    .map((source) => {
      const requests = (value: number | null): string =>
        value === null ? 'unknown' : number(value);
      const delta =
        source.requestDelta === null
          ? '—'
          : `${source.requestDelta > 0 ? '+' : ''}${number(source.requestDelta)}`;
      const failureRate =
        source.baselineFailureRatePercent === null || source.currentFailureRatePercent === null
          ? 'not comparable'
          : `${source.baselineFailureRatePercent}% (${number(source.baselineFailureRequests ?? 0)} failures) → ${source.currentFailureRatePercent}% (${number(source.currentFailureRequests ?? 0)} failures)${source.failureRateDeltaPercentagePoints === null ? '' : ` (${source.failureRateDeltaPercentagePoints > 0 ? '+' : ''}${source.failureRateDeltaPercentagePoints} pp)`}`;
      return `<tr><td>${escapeHtml(source.source)}</td><td class="num">${requests(source.baselineRequests)} → ${requests(source.currentRequests)}<br>${delta}</td><td>${escapeHtml(failureRate)}</td><td class="num">${requests(source.baselineUniquePaths)} → ${requests(source.currentUniquePaths)}</td><td>${source.comparisonAvailable ? `${number(source.pathsWithNewFailures)} paths with new failures · ${number(source.pathsWithResolvedFailures)} cleared` : 'Matching source label missing from one report'}</td><td>${source.baselinePathsTruncated === null || source.currentPathsTruncated === null ? 'Coverage unavailable' : source.baselinePathsTruncated || source.currentPathsTruncated ? 'At least one retained path list is capped' : 'Path lists complete within the tracked sample'}</td></tr>`;
    })
    .join('');
  const referralDetails = comparison.aiReferralSources
    .filter(({ pathChanges }) => pathChanges.length > 0)
    .map((source) => {
      const pathRows = source.pathChanges
        .map((item) => {
          const profile = (value: typeof item.baseline): string =>
            value
              ? `${number(value.requests)} requests · ${number(value.failureRequests)} failures · ${value.requestSharePercent}% share · ${value.failureRatePercent}% failed · HTTP ${value.statusCodes.map(statusCode).join(', ') || 'unknown'}${value.statusCodesTruncated ? ' +' : ''} · media ${value.responseContentTypes.join(', ') || 'not logged'}${value.responseContentTypesTruncated ? ' +' : ''}`
              : 'not retained';
          return `<tr><td><code>${escapeHtml(item.path)}</code></td><td>${escapeHtml(item.change)}</td><td>${escapeHtml(profile(item.baseline))}</td><td>${escapeHtml(profile(item.current))}</td></tr>`;
        })
        .join('');
      return `<details><summary>${escapeHtml(source.source)} · ${number(source.pathChanges.length)} changed path(s)${source.pathChangesTruncated ? ' · capped' : ''}</summary><div class="table-wrap"><table><thead><tr><th>Path</th><th>Change</th><th>Baseline</th><th>Current</th></tr></thead><tbody>${pathRows}</tbody></table></div></details>`;
    })
    .join('');
  const attributionCoverage = comparison.utmSourceAttributionCoverage;
  const formatCoverageCount = (
    coverage: AiReferralUtmSourceCoverage | null | undefined,
    field: keyof AiReferralUtmSourceCoverage
  ): string => (coverage ? number(coverage[field]) : 'unavailable');
  const coverageRows = attributionCoverage
    ? (
        [
          ['Parsed request rows', 'parsedRequestRows'],
          ['Requests carrying utm_source', 'requestsWithUtmSource'],
          ['Configured source matches', 'requestsWithConfiguredSource'],
          ['Unconfigured single values', 'requestsWithUnconfiguredSingleValue'],
          ['Conflicting values', 'requestsWithConflictingValues'],
          ['Empty or oversized values', 'requestsWithEmptyOrOversizedValue'],
        ] as const
      )
        .map(([label, field]) => {
          return `<tr><td>${escapeHtml(label)}</td><td class="num">${escapeHtml(formatCoverageCount(attributionCoverage.baseline, field))} → ${escapeHtml(formatCoverageCount(attributionCoverage.current, field))}</td></tr>`;
        })
        .join('') +
      `<tr><td>Marker share of parsed requests</td><td class="num">${escapeHtml(attributionCoverage.baseline && attributionCoverage.baseline.parsedRequestRows > 0 ? `${((attributionCoverage.baseline.requestsWithUtmSource / attributionCoverage.baseline.parsedRequestRows) * 100).toFixed(1)}%` : attributionCoverage.baseline ? '—' : 'unavailable')} → ${escapeHtml(attributionCoverage.current && attributionCoverage.current.parsedRequestRows > 0 ? `${((attributionCoverage.current.requestsWithUtmSource / attributionCoverage.current.parsedRequestRows) * 100).toFixed(1)}%` : attributionCoverage.current ? '—' : 'unavailable')}</td></tr>`
    : '';
  const attributionCoverageHtml = attributionCoverage
    ? `<h3>UTM marker coverage</h3><p class="note">${attributionCoverage.comparisonAvailable ? 'Compares all parsed request rows in the two supplied logs.' : 'Coverage is unavailable for at least one report version.'} Unconfigured values are not retained or presumed to represent AI traffic.</p><div class="table-wrap"><table><thead><tr><th>Marker class</th><th class="num">Baseline → current</th></tr></thead><tbody>${coverageRows}</tbody></table></div>`
    : '';
  return `<section class="correlation"><span class="eyebrow">Crawler access sample comparison</span><h2>How did the supplied crawler samples change?</h2><p class="note">${escapeHtml(comparison.note)}</p><div class="table-wrap"><table><thead><tr><th>Claimed crawler</th><th class="num">Requests baseline → current</th><th class="num">Failure rate baseline → current</th><th class="num">Shared retained paths</th><th class="num">Shared paths with failures</th><th class="num">Only in retained list</th><th>Cloudflare verification/actions baseline → current</th><th>CloudFront result distribution</th><th>Timing p95 bands</th><th>Coverage</th></tr></thead><tbody>${rows || '<tr><td colspan="10" class="empty">No recognized crawler tokens in either sample.</td></tr>'}</tbody></table></div>${details || '<p class="note">No crawler path-level changes met the report criteria.</p>'}<p class="note">CloudFront distributions use each field's own logged-request denominator. The paired-difference rate only uses requests with both result fields. A changed distribution is descriptive and does not by itself identify a configuration problem.</p><h3>Tagged AI referral requests by period</h3><p class="note">Only exact configured source labels in both saved analyses can be compared; request counts are not sessions. Use identical UTM mappings and similarly scoped log windows.</p><div class="table-wrap"><table><thead><tr><th>Source label</th><th class="num">Requests baseline → current</th><th>Failure rate</th><th class="num">Unique retained paths</th><th>Path failures</th><th>Coverage</th></tr></thead><tbody>${referralRows || '<tr><td colspan="6" class="empty">No referral sources were configured in both samples.</td></tr>'}</tbody></table></div>${referralDetails || '<p class="note">No tagged referral path changes met the report criteria.</p>'}${attributionCoverageHtml}</section>`;
}

function renderSitemapFreshness(analysis: AiCrawlerSitemapFreshnessAnalysis): string {
  const crawlerRows = analysis.crawlers
    .map(
      (crawler) =>
        `<tr><td>${escapeHtml(crawler.provider)} · ${escapeHtml(crawler.crawlerToken)}<br><span class="muted">${escapeHtml(crawler.activity.replace(/-/g, ' '))}</span></td><td class="num">${number(crawler.sitemapUrlsProvided)}</td><td class="num">${number(crawler.pagesWithValidLastmod)}</td><td class="num">${number(crawler.pagesObservedInLog)}</td><td class="num">${number(crawler.pagesWithUpdateAfterLastObservedRequest)}<br>${number(crawler.requestsOnPagesWithUpdateAfterLastObservedRequest)} requests</td><td class="num">${number(crawler.pagesObservedSameUtcDayAsLastmod)}</td><td class="num">${number(crawler.pagesObservedAfterLastmod)}</td><td class="num">${number(crawler.pagesNotObservedInLog)}</td><td class="num">${number(crawler.pagesWithoutLastmod)} / ${number(crawler.pagesWithInvalidLastmod)}</td><td class="num">${number(crawler.ambiguousPaths)}</td></tr>`
    )
    .join('');
  const opportunityRows = analysis.updateOpportunities
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.provider)} · ${escapeHtml(item.crawlerToken)}<br><span class="muted">${escapeHtml(item.activity.replace(/-/g, ' '))}</span></td><td><code>${escapeHtml(item.path)}</code></td><td class="num">${number(item.requests)}<br><span class="muted">${item.crawlerRequestSharePercent}% of ${number(item.crawlerRequests)}</span></td><td>${escapeHtml(item.sitemapLastModified)}</td><td>${escapeHtml(item.lastSeenAt)}</td><td class="num">${number(item.daysBetweenLastRequestAndUpdate)}</td></tr>`
    )
    .join('');
  const schemaComparison = analysis.schemaDateComparison;
  const schemaOpportunityRows =
    schemaComparison?.opportunities
      .map(
        (item) =>
          `<tr><td><code>${escapeHtml(item.path)}</code></td><td>${escapeHtml(item.sitemapLastModified)}</td><td>${escapeHtml(item.schemaDateModifiedDays.join(', ') || 'no valid date')}</td><td>${escapeHtml(item.reason.replace(/-/g, ' '))}</td></tr>`
      )
      .join('') ?? '';
  const schemaComparisonHtml = schemaComparison
    ? `<details><summary>Sitemap and JSON-LD dateModified comparison (${escapeHtml(schemaComparison.auditTimestamp)})</summary><p class="note">${number(schemaComparison.pagesWithMatchingSchemaDateModified)} pages match · ${number(schemaComparison.pagesWithDifferentSchemaDateModified)} differ · ${number(schemaComparison.pagesWithMultipleSchemaDateModified)} have multiple schema dates · ${number(schemaComparison.pagesWithoutSchemaDateModified)} have no valid dateModified · ${number(schemaComparison.pagesWithNonDateSchemaDateModified)} contain a non-date value · ${number(schemaComparison.auditPathsNotFound)} not in audit · ${number(schemaComparison.auditPathsAmbiguous)} ambiguous paths.</p><div class="table-wrap"><table><thead><tr><th>Path</th><th>Sitemap lastmod (UTC day)</th><th>JSON-LD dateModified UTC days</th><th>Review</th></tr></thead><tbody>${schemaOpportunityRows || '<tr><td colspan="4" class="empty">No sitemap and schema date differences or omissions were measured.</td></tr>'}</tbody></table></div>${schemaComparison.opportunitiesTruncated ? '<p class="note">Showing the first 500 date review rows in issue-priority order.</p>' : ''}<p class="note">Date agreement is a consistency observation across a saved audit and sitemap snapshot; neither declaration proves the page’s actual last significant update. Pages absent from the saved audit or with ambiguous path matches are not compared.</p></details>`
    : '';
  return `<section class="correlation"><span class="eyebrow">Sitemap snapshot · ${escapeHtml(analysis.sitemapUrl)}</span><h2>Declared updates against observed crawler visits</h2><p class="note">${escapeHtml(analysis.origin)} · ${number(analysis.sitemapUrlsProvided)} unique sitemap URLs · ${number(analysis.pagesWithValidLastmod)} valid lastmod dates · ${number(analysis.duplicateSitemapEntries)} duplicate entries · ${number(analysis.sitemapUrlsSkippedAsAmbiguous)} URLs skipped for path ambiguity · ${analysis.sitemapUrlsTruncated ? 'URL limit reached · ' : ''}${analysis.sitemapEntriesTruncated ? 'sitemap entry detail capped · ' : ''}${analysis.inputLogPathsTruncated ? 'log detail capped · ' : ''}${analysis.opportunitiesTruncated ? 'opportunity detail capped' : ''}</p><div class="table-wrap"><table><thead><tr><th>Provider / token</th><th>Sitemap URLs</th><th>Valid lastmod</th><th>Observed in sample</th><th>Update after last request</th><th>Same UTC day</th><th>Observed after update</th><th>Not observed</th><th>Missing / invalid dates</th><th>Ambiguous paths</th></tr></thead><tbody>${crawlerRows || '<tr><td colspan="10" class="empty">No eligible crawler tokens were found in this log sample.</td></tr>'}</tbody></table></div><details><summary>Pages with a declared update after the latest observed request (${number(analysis.updateOpportunities.length)}${analysis.opportunitiesTruncated ? '+' : ''})</summary><div class="table-wrap"><table><thead><tr><th>Provider / token</th><th>Path</th><th>Requests / token sample</th><th>Sitemap lastmod (UTC day)</th><th>Last observed request (UTC)</th><th>Request predates update by days</th></tr></thead><tbody>${opportunityRows || '<tr><td colspan="6" class="empty">No comparable update-after-request pages were observed.</td></tr>'}</tbody></table></div>${analysis.opportunitiesTruncated ? '<p class="note">Showing the top 500 rows, ordered by request volume and then day gap. Aggregate counts cover the full retained input.</p>' : ''}</details>${schemaComparisonHtml}<p class="note">${escapeHtml(analysis.note)}</p></section>`;
}

/** Render the local log summaries without external scripts, stylesheets, or network requests. */
export function renderAiCrawlerAccessLogHtml(
  analyses: AiCrawlerAccessLogAnalysis[],
  correlations: AiCrawlerLogGeoCorrelation[] = [],
  robotsReplays: AiCrawlerRobotsPolicyAnalysis[] = [],
  robotsComparisons: AiCrawlerRobotsPolicyComparison[] = [],
  periodComparisons: AiCrawlerLogPeriodComparison[] = [],
  sitemapFreshnessAnalyses: AiCrawlerSitemapFreshnessAnalysis[] = []
): string {
  const content =
    analyses
      .map((analysis, index) =>
        [
          renderAnalysis(analysis, index),
          ...(correlations[index] ? [renderAuditCorrelation(correlations[index]!)] : []),
          ...(robotsReplays[index] ? [renderRobotsReplay(robotsReplays[index]!)] : []),
          ...(robotsComparisons[index] ? [renderRobotsComparison(robotsComparisons[index]!)] : []),
          ...(periodComparisons[index]
            ? [renderLogPeriodComparison(periodComparisons[index]!)]
            : []),
          ...(sitemapFreshnessAnalyses[index]
            ? [renderSitemapFreshness(sitemapFreshnessAnalyses[index]!)]
            : []),
        ].join('\n')
      )
      .join('\n') || '<p class="empty">No logs were analyzed.</p>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>AI crawler access · Aviary GEO</title><style>
:root{color-scheme:light;--paper:#f3f0e8;--ink:#202d2b;--muted:#63716c;--line:#c6c9bd;--forest:#174f44;--rust:#b3482f;--white:#fffdf8;--mono:ui-monospace,SFMono-Regular,Consolas,monospace;--serif:Georgia,"Iowan Old Style","Times New Roman",serif}*{box-sizing:border-box}body{margin:0;background:linear-gradient(110deg,rgba(23,79,68,.035),transparent 60%),var(--paper);color:var(--ink);font-family:var(--serif)}main{max-width:1380px;margin:0 auto;padding:clamp(20px,5vw,72px)}.mast{display:flex;justify-content:space-between;gap:20px;padding:13px 0;border-top:4px solid var(--forest);border-bottom:1px solid var(--forest);font:10px var(--mono);letter-spacing:.13em;text-transform:uppercase;color:var(--forest)}.hero{padding:clamp(40px,7vw,85px) 0 35px;border-bottom:1px solid var(--ink)}.eyebrow{display:block;font:700 10px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--rust)}h1{margin:13px 0 16px;font:400 clamp(44px,8vw,90px)/.9 var(--serif);letter-spacing:-.055em}h1 em{color:var(--forest)}.hero p{max-width:770px;color:#4b5b55;line-height:1.65}.stamp{float:right;display:grid;place-items:center;border:1px solid var(--forest);background:#e0ebe2;padding:18px;min-width:150px}.stamp strong{font:400 38px var(--serif);color:var(--forest)}.stamp span{font:9px var(--mono);text-transform:uppercase;color:var(--muted)}.filter{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:24px 0}.filter label{font:700 9px var(--mono);text-transform:uppercase;letter-spacing:.08em}.filter input{width:min(420px,100%);min-height:40px;padding:9px 11px;border:1px solid var(--line);background:var(--white);font:11px var(--mono)}.report{padding:40px 0;border-bottom:1px solid var(--line)}.report-head h2{margin:8px 0;font:400 clamp(24px,4vw,38px) var(--serif);overflow-wrap:anywhere}.note,.meta{font:10px/1.65 var(--mono);color:var(--muted)}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-block:1px solid var(--line);margin:20px 0}.stats>div{padding:13px 16px;border-right:1px solid var(--line)}.stats>div:last-child{border:0}.stats strong{display:block;font:400 25px var(--serif);color:var(--forest)}.stats span{font:9px var(--mono);color:var(--muted);text-transform:uppercase}.table-wrap{overflow:auto;border:1px solid var(--line);background:rgba(255,253,248,.7);margin:12px 0}table{width:100%;min-width:700px;border-collapse:collapse;font-size:12px}caption{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}th{padding:10px;background:var(--forest);color:white;text-align:left;font:9px var(--mono);text-transform:uppercase;letter-spacing:.08em}td{padding:10px;border-top:1px solid #d5d8cd;vertical-align:top;line-height:1.45}tbody tr:hover{background:#e3eee6}.num{text-align:right;font:10px var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}code{font:11px var(--mono);overflow-wrap:anywhere}.crawler-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,540px),1fr));gap:22px;margin-top:22px}.crawler-card{padding:19px;background:rgba(255,253,248,.55);border:1px solid var(--line);border-top:3px solid var(--forest)}.crawler-head{display:flex;justify-content:space-between;gap:14px;align-items:start}.crawler-head h3{margin:8px 0 0;font:400 24px var(--serif)}.total{color:var(--forest);font:400 24px var(--serif);text-align:right}.total small{display:block;font:9px var(--mono);color:var(--muted);text-transform:uppercase}.crawler-card .stats{grid-template-columns:repeat(4,minmax(0,1fr));margin:16px 0}.crawler-card .stats>div{padding:9px}.crawler-card .stats strong{font-size:19px}.meta{overflow-wrap:anywhere}.crawler-card details{margin-top:13px}.crawler-card summary{cursor:pointer;color:var(--forest);font:700 10px var(--mono);text-transform:uppercase;letter-spacing:.07em}.empty{text-align:center;color:var(--muted);padding:24px}.footer{padding:22px 0;color:var(--muted);font:9px/1.6 var(--mono)}.correlation{padding:24px 0;border-bottom:1px solid var(--line)}.correlation h2{font:400 clamp(24px,4vw,36px) var(--serif)}.policy-blocked{color:var(--rust)}.policy-allowed{color:var(--forest)}.policy-not-assessed,.policy-not-applicable{color:var(--muted)}:focus-visible{outline:3px solid var(--rust);outline-offset:2px}@media(max-width:720px){main{padding:18px}.stamp{float:none;margin-bottom:20px;width:130px}.stats{grid-template-columns:repeat(2,1fr)}.stats>div:nth-child(2){border-right:0}.stats>div:nth-child(n+3){border-top:1px solid var(--line)}.crawler-grid{grid-template-columns:1fr}.crawler-card .stats{grid-template-columns:repeat(2,1fr)}}
</style></head><body><main><header class="mast"><strong>Aviary · GEO observatory</strong><span>Local crawler access analysis</span></header><section class="hero"><div class="stamp"><strong>${number(analyses.length)}</strong><span>separate log files</span></div><span class="eyebrow">Server evidence · not visibility metrics</span><h1>Who came to<br><em>fetch the pages?</em></h1><p>Inspect claimed AI search, user-triggered fetch, and training-data crawler requests in your own access logs. User-agent matches are not authenticated bot identities, and they do not prove indexing or citation. Each source file remains separate because rotated logs can overlap.</p></section><div class="filter"><label for="path-filter">Filter crawler paths</label><input id="path-filter" type="search" placeholder="Search provider, token, or path rows" autocomplete="off"></div>${content}<footer class="footer">Generated locally by Aviary. Query strings, fragments, source IPs, referrers, and complete user-agent strings are omitted.</footer></main><script>document.querySelector('#path-filter')?.addEventListener('input',(event)=>{const needle=event.target.value.trim().toLowerCase();document.querySelectorAll('tbody tr[data-search]').forEach((row)=>{row.hidden=!(row.dataset.search||'').includes(needle);});});</script></body></html>`;
}

/** Render an offline robots-policy replay over saved-audit or bounded sitemap targets. */
export function renderAiCrawlerRobotsAuditReplayHtml(
  replay: AiCrawlerRobotsAuditReplay,
  comparison?: AiCrawlerRobotsAuditReplayComparison
): string {
  const policyRows = replay.crawlerPolicies
    .map(
      (crawler) =>
        `<tr><td>${escapeHtml(crawler.provider)}</td><td>${escapeHtml(crawler.token)}${crawler.customToken ? ' · custom' : ''}</td><td>${escapeHtml(crawler.activity)}</td><td class="num">${number(crawler.pagesEvaluated)}</td><td class="num">${number(crawler.pagesAllowed)}</td><td class="num">${number(crawler.pagesBlocked)}</td><td>${crawler.blockedUrls.map(escapeHtml).join('<br>') || '—'}${crawler.blockedUrlsTruncated ? '<br>Additional blocked URLs omitted.' : ''}</td></tr>`
    )
    .join('');
  const detailRows = replay.rows
    .map(
      (row) =>
        `<tr><td>${number(row.auditUrlIndex)}</td><td>${escapeHtml(row.provider)}</td><td>${escapeHtml(row.crawlerToken)}${row.customToken ? ' · custom' : ''}</td><td><code>${escapeHtml(row.url)}</code></td><td>${row.queryStringEvaluated ? `yes · ${number(row.queryParametersEvaluated)} parameter(s)` : 'no'}</td><td><strong class="${row.allowed ? 'allowed' : 'blocked'}">${row.allowed ? 'allowed' : 'blocked'}</strong></td><td>${escapeHtml(row.selectedAgents.join(', ') || '—')}</td><td>${row.matchedRule ? `${escapeHtml(row.matchedRule.directive)} ${escapeHtml(row.matchedRule.pattern)} · line ${number(row.matchedRule.line)}` : '—'}</td></tr>`
    )
    .join('');
  const comparisonRows =
    comparison?.changes
      .map(
        (row) =>
          `<tr><td>${number(row.auditUrlIndex)}</td><td>${escapeHtml(row.crawlerToken)}</td><td><code>${escapeHtml(row.url)}</code></td><td>${row.baselineAllowed === undefined ? 'not available' : row.baselineAllowed ? 'allowed' : 'blocked'}</td><td>${row.allowed ? 'allowed' : 'blocked'}</td><td><strong class="${row.change === 'newly-blocked' ? 'blocked' : row.change === 'newly-allowed' ? 'allowed' : ''}">${escapeHtml(row.change)}</strong></td></tr>`
      )
      .join('') ?? '';
  const comparisonSection = comparison
    ? `<h2>Policy snapshot changes</h2><p class="note">${number(comparison.urlTokenPairsNewlyBlocked)} newly blocked · ${number(comparison.urlTokenPairsNewlyAllowed)} newly allowed · ${number(comparison.urlTokenPairsWithRuleChanges)} rule changes · ${number(comparison.urlTokenPairsNotComparable)} not comparable · baseline SHA-256 ${escapeHtml(comparison.baselineSnapshot.sha256)}</p><div class="table-wrap"><table><thead><tr><th>Audit URL index</th><th>Token</th><th>Audited path</th><th>Baseline</th><th>Current</th><th>Change</th></tr></thead><tbody>${comparisonRows || '<tr><td colspan="6">No retained comparison rows.</td></tr>'}</tbody></table></div><p class="note">${escapeHtml(comparison.note)}${comparison.changesTruncated ? ' Comparison details are incomplete or capped.' : ''}</p>`
    : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Robots policy replay · Aviary GEO</title><style>:root{color-scheme:light;--paper:#f3f0e8;--ink:#202d2b;--muted:#63716c;--line:#c6c9bd;--forest:#174f44;--rust:#b3482f;--white:#fffdf8;--mono:ui-monospace,SFMono-Regular,Consolas,monospace;--serif:Georgia,"Iowan Old Style","Times New Roman",serif}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--serif)}main{max-width:1380px;margin:0 auto;padding:clamp(20px,5vw,72px)}header{border-top:4px solid var(--forest);border-bottom:1px solid var(--forest);padding:14px 0;color:var(--forest);font:10px var(--mono);letter-spacing:.12em;text-transform:uppercase}.hero{padding:clamp(36px,7vw,80px) 0 30px;border-bottom:1px solid var(--ink)}.eyebrow{font:700 10px var(--mono);letter-spacing:.13em;text-transform:uppercase;color:var(--rust)}h1{font:400 clamp(42px,8vw,84px)/.95 var(--serif);letter-spacing:-.05em;margin:16px 0}h1 em{color:var(--forest)}p{line-height:1.6}.meta,.note{font:10px/1.7 var(--mono);color:var(--muted);overflow-wrap:anywhere}.stats{display:grid;grid-template-columns:repeat(4,1fr);border-block:1px solid var(--line);margin:20px 0}.stats div{padding:13px;border-right:1px solid var(--line)}.stats div:last-child{border:0}.stats strong{display:block;font:400 25px var(--serif);color:var(--forest)}.stats span{font:9px var(--mono);text-transform:uppercase;color:var(--muted)}h2{font:400 clamp(26px,4vw,38px) var(--serif);margin-top:40px}.table-wrap{overflow:auto;border:1px solid var(--line);background:var(--white);margin:14px 0}table{width:100%;min-width:820px;border-collapse:collapse;font-size:12px}th{padding:10px;background:var(--forest);color:white;text-align:left;font:9px var(--mono);text-transform:uppercase;letter-spacing:.06em}td{padding:10px;border-top:1px solid var(--line);vertical-align:top;line-height:1.45}tbody tr:hover{background:#e3eee6}.num{text-align:right;font:10px var(--mono);white-space:nowrap}code{font:10px var(--mono);overflow-wrap:anywhere}.blocked{color:var(--rust)}.allowed{color:var(--forest)}footer{padding:24px 0;font:9px/1.6 var(--mono);color:var(--muted)}@media(max-width:700px){main{padding:18px}.stats{grid-template-columns:repeat(2,1fr)}.stats div:nth-child(2){border-right:0}.stats div:nth-child(n+3){border-top:1px solid var(--line)}}</style></head><body><main><header>Aviary · GEO observatory · Local policy replay</header><section class="hero"><span class="eyebrow">Snapshot review · not a crawl simulation</span><h1>Robots rules across<br><em>audited paths.</em></h1><p>Re-evaluate saved audit URLs against a local robots.txt snapshot without fetching pages. This checks the supplied URL and query against user-agent groups in the snapshot. It does not prove what the provider crawled or what rules were active at the audit time.</p><p class="meta">Origin ${escapeHtml(replay.origin)} · Audit ${escapeHtml(replay.auditTimestamp ?? 'timestamp unavailable')} · Robots snapshot ${escapeHtml(replay.robotsModifiedAt ?? 'mtime unavailable')} · SHA-256 ${escapeHtml(replay.robotsSha256)}</p><div class="stats"><div><strong>${number(replay.pagesOnOrigin)}</strong><span>pages evaluated</span></div><div><strong>${number(replay.crawlerPolicies.reduce((sum, row) => sum + row.pagesBlocked, 0))}</strong><span>blocked token-page pairs</span></div><div><strong>${number(replay.pagesSkipped)}</strong><span>invalid or off-origin</span></div><div><strong>${number(replay.auditPagesUnavailable)}</strong><span>failed source audit pages</span></div></div></section><h2>Policy coverage by crawler token</h2><div class="table-wrap"><table><thead><tr><th>Provider</th><th>Token</th><th>Activity</th><th>Pages</th><th>Allowed</th><th>Blocked</th><th>Blocked URL examples</th></tr></thead><tbody>${policyRows || '<tr><td colspan="7">No crawler policies were evaluated.</td></tr>'}</tbody></table></div><h2>Page-level policy decisions</h2><div class="table-wrap"><table><thead><tr><th>Audit URL index</th><th>Provider</th><th>Token</th><th>Audited path</th><th>Query used?</th><th>Decision</th><th>Selected groups</th><th>Matched rule</th></tr></thead><tbody>${detailRows || '<tr><td colspan="8">No same-origin audit URLs were available.</td></tr>'}</tbody></table></div>${comparisonSection}<p class="note">${escapeHtml(replay.note)}${replay.rowsTruncated ? ' Detailed rows are capped; see the structured report for the truncation flag and complete summary counts.' : ''}</p><footer>Generated locally by Aviary. No audit or robots file contents are included in this report.</footer></main></body></html>`;
  if (replay.targetSource !== 'sitemap') return html;
  const sitemapUrl = escapeHtml(replay.sitemapUrl ?? 'provided sitemap');
  return html
    .replace('<em>audited paths.</em>', '<em>sitemap URLs.</em>')
    .replace(
      'Re-evaluate saved audit URLs against a local robots.txt snapshot without fetching pages. This checks the supplied URL and query against user-agent groups in the snapshot. It does not prove what the provider crawled or what rules were active at the audit time.',
      `Re-evaluate URLs discovered from ${sitemapUrl} against a supplied robots.txt snapshot. Sitemap discovery fetches sitemap documents; replay does not fetch page content or simulate a crawler.`
    )
    .replace('Audit timestamp unavailable', `Sitemap ${sitemapUrl} · no page audit`)
    .replace('failed source audit pages', 'saved-audit errors (not assessed)')
    .replace(/Audit URL index/g, 'Target URL index')
    .replace(/Audited path/g, 'Sitemap path')
    .replace(
      'No same-origin audit URLs were available.',
      'No same-origin sitemap URLs were available.'
    )
    .replace('Page-level policy decisions', 'Sitemap URL policy decisions')
    .replace(
      'No audit or robots file contents are included in this report.',
      'No sitemap or robots file contents are included in this report.'
    );
}
