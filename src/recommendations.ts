import { CHECKER_REGISTRY, type CheckerKey } from './checkers/registry';
import type { RuleSeverity, SEOCheckResult, SEOReport } from './types';
import { calculateSEOCheckScoreLifts } from './scoring';

export type SEORecommendationPriority = 'high' | 'medium' | 'low';

export interface SEORecommendationExample {
  language: 'html' | 'json';
  code: string;
}

export interface SEORecommendation {
  category: CheckerKey;
  categoryLabel: string;
  checkName: string;
  finding: string;
  severity?: RuleSeverity;
  priority: SEORecommendationPriority;
  /** Single-check counterfactual lift in Aviary's weighted score, not a search-ranking estimate. */
  scoreLift: number | null;
  action: string;
  quickWin: boolean;
  example?: SEORecommendationExample;
}

const CATEGORY_ACTIONS: Record<CheckerKey, string> = {
  metaTags:
    'Update the page head with accurate, unique title, description, canonical, and social metadata for this page.',
  headings:
    'Give the page one clear primary heading, then keep section headings in a logical hierarchy.',
  images:
    'Add useful alternative text to informative images and use an empty alt value for decorative images.',
  performance:
    'Profile the slowest page resources first, then reduce blocking work and defer non-critical assets.',
  robotsTxt:
    'Review robots.txt rules so important pages remain crawlable and blocked paths are intentional.',
  sitemap:
    'Publish a valid XML sitemap with canonical, indexable URLs and reference it from robots.txt.',
  security:
    'Serve the page and its assets over HTTPS, then configure the security headers indicated by the finding.',
  structuredData:
    'Correct the structured data fields and validate the resulting JSON-LD or microdata against the page content.',
  socialMedia:
    'Add social sharing metadata with a representative title, description, and image for this page.',
  content:
    'Revise the page with original, useful content that directly answers its intended search query.',
  links:
    'Update or remove links that resolve to errors, and use descriptive text for important destinations.',
  uiElements:
    'Add the missing browser and page cues, such as a favicon, breadcrumb trail, or document language.',
  technical:
    'Resolve the reported response, redirect, duplicate, or compression issue at the source or server configuration.',
  accessibility:
    'Fix the named accessibility barrier and verify the affected control works with keyboard and assistive technology.',
  urlFactors: 'Use a concise, readable URL that describes the page and remains stable over time.',
  spamDetection:
    'Remove hidden, repetitive, or manipulative content and keep the visible page useful to readers.',
  pageQuality:
    'Improve the page with accurate, current, original information and clear evidence of who is responsible for it.',
  advancedImages:
    'Serve appropriately sized responsive images, include dimensions, and defer images below the initial viewport.',
  multimedia:
    'Provide captions or transcripts and make media metadata describe the actual content.',
  coreWebVitals:
    'Identify the largest render-blocking resources and layout shifts, then optimize the slowest user-visible path.',
  analytics:
    'Check the named analytics or verification tag is installed once and points to the intended property.',
  mobileUX:
    'Make the page fit the device viewport and keep interactive targets readable and easy to tap.',
  schemaValidation:
    'Correct the reported Schema.org type or property and keep structured data consistent with visible content.',
  resourceOptimization:
    'Reduce transfer and render cost with appropriate compression, caching, and smaller unused assets.',
  legalCompliance:
    'Have a qualified reviewer check the relevant disclosures and consent behavior for the regions you serve.',
  ecommerce:
    'Make product availability, pricing, reviews, and purchase steps clear and consistent across the page.',
  internationalization:
    'Align the page language, localized content, and hreflang references for each intended locale.',
  heatmap:
    'Review the flagged layout area and confirm the primary action is easy to see and reach.',
  geo: 'Review crawler access and page-content observations against the goals for each AI search service; use its webmaster tools to measure actual citations.',
};

const QUICK_WIN_PATTERN =
  /(?:title|description|canonical|alt text|favicon|language tag|viewport).*(?:missing|absent|not found|not present|required)|(?:missing|absent|not found|not present|required).*(?:title|description|canonical|alt text|favicon|language tag|viewport)/i;
const PRIORITY_RANK: Record<SEORecommendationPriority, number> = { high: 0, medium: 1, low: 2 };
const MIN_EXTERNAL_SOURCE_LINKS_FOR_CONCENTRATION_NOTE = 5;
const SOURCE_HOST_CONCENTRATION_NOTE_PERCENT = 80;

function priorityFor(check: SEOCheckResult): SEORecommendationPriority {
  if (check.severity === 'error') return 'high';
  if (check.severity === 'info' || /skipped due to error/i.test(check.message)) return 'low';
  return 'medium';
}

function actionFor(category: CheckerKey, check: SEOCheckResult): string {
  if (category === 'security' && check.name === 'security-headers') {
    const details =
      check.details && typeof check.details === 'object'
        ? (check.details as Record<string, unknown>)
        : {};
    const affectedHeaders = [
      ...(Array.isArray(details.missing) ? details.missing : []),
      ...(Array.isArray(details.invalid) ? details.invalid : []),
    ].filter((header): header is string => typeof header === 'string');
    const diagnostics = Array.isArray(details.diagnostics)
      ? details.diagnostics.filter((message): message is string => typeof message === 'string')
      : [];
    const target =
      affectedHeaders.length > 0
        ? `Configure ${[...new Set(affectedHeaders)].join(', ')} on page responses at the server or CDN.`
        : 'Configure the reported security headers on page responses at the server or CDN.';
    return [target, ...diagnostics].join(' ');
  }
  return CATEGORY_ACTIONS[category];
}

function exampleFor(
  category: CheckerKey,
  check: SEOCheckResult
): SEORecommendationExample | undefined {
  const text = `${check.name ?? ''} ${check.message}`;
  const missing = /missing|not found|absent|not present|no h1|no .+ found/i.test(check.message);
  if (!missing || /skipped due to error/i.test(check.message)) return undefined;

  if (category === 'metaTags') {
    if (/title/i.test(text))
      return { language: 'html', code: '<title>Clear, page-specific title</title>' };
    if (/meta description/i.test(text)) {
      return {
        language: 'html',
        code: '<meta name="description" content="A concise summary of this page.">',
      };
    }
    if (/canonical/i.test(text)) {
      return {
        language: 'html',
        code: '<link rel="canonical" href="https://example.com/your-page">',
      };
    }
    if (/viewport/i.test(text)) {
      return {
        language: 'html',
        code: '<meta name="viewport" content="width=device-width, initial-scale=1">',
      };
    }
    if (/open graph|og:/i.test(text)) {
      return {
        language: 'html',
        code: '<meta property="og:title" content="Page title">\n<meta property="og:description" content="Page summary">\n<meta property="og:image" content="https://example.com/share-image.jpg">',
      };
    }
  }
  if (category === 'headings' && /h1/i.test(text)) {
    return { language: 'html', code: '<h1>The main topic of this page</h1>' };
  }
  if (category === 'images' && /alt/i.test(text)) {
    return {
      language: 'html',
      code: '<img src="/images/product.webp" alt="Blue ceramic mug on a wooden table">',
    };
  }
  if (category === 'accessibility' && /form/i.test(text) && /label/i.test(text)) {
    return {
      language: 'html',
      code: '<label for="email">Email address</label>\n<input id="email" name="email" type="email">',
    };
  }
  if (category === 'accessibility' && /interactive elements missing labels/i.test(check.message)) {
    return {
      language: 'html',
      code: '<button type="button" aria-label="Open navigation menu">☰</button>',
    };
  }
  if (category === 'uiElements' && /favicon/i.test(text)) {
    return { language: 'html', code: '<link rel="icon" href="/favicon.ico" sizes="any">' };
  }
  if (category === 'uiElements' && /language|lang/i.test(text)) {
    return { language: 'html', code: '<html lang="en">' };
  }
  if (category === 'structuredData' && /json-ld|structured data/i.test(text)) {
    return {
      language: 'json',
      code: '{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "Page title",\n  "url": "https://example.com/your-page"\n}',
    };
  }
  return undefined;
}

/** Convert failed checks and actionable GEO signals into severity-ordered next steps. */
export function generateSEORecommendations(report: SEOReport): SEORecommendation[] {
  const categoryOrder = new Map(CHECKER_REGISTRY.map(({ key }, index) => [key, index]));
  const allChecks = CHECKER_REGISTRY.flatMap(({ key }) => report.checks[key] ?? []);
  const scoreLift = calculateSEOCheckScoreLifts(allChecks);

  const recommendations = CHECKER_REGISTRY.flatMap(({ key, label }) =>
    (report.checks[key] ?? [])
      .filter((check) => !check.passed)
      .map((check) => {
        const findingText = `${check.name ?? ''} ${check.message}`;
        const unavailable = /skipped due to error/i.test(check.message);
        const example = unavailable ? undefined : exampleFor(key, check);
        return {
          category: key,
          categoryLabel: label,
          checkName: check.name ?? label,
          finding: check.message,
          severity: check.severity,
          priority: priorityFor(check),
          scoreLift: unavailable ? null : (scoreLift.get(check) ?? null),
          action: unavailable
            ? 'Resolve the audit access or network error, then run the check again before changing the page.'
            : actionFor(key, check),
          quickWin:
            !unavailable &&
            (QUICK_WIN_PATTERN.test(findingText) ||
              (key === 'headings' && /no h1/i.test(check.message)) ||
              (key === 'uiElements' && /no favicon found/i.test(check.message))),
          ...(example ? { example } : {}),
        };
      })
  );
  const citationEvidence = (report.checks.geo ?? []).find(
    ({ name }) => name === 'citation-evidence-profile'
  );
  const citationDetails =
    citationEvidence?.details && typeof citationEvidence.details === 'object'
      ? (citationEvidence.details as Record<string, unknown>)
      : undefined;
  const unresolvedTargetCount = citationDetails?.unresolvedInlineCitationTargetCount;
  if (
    citationEvidence?.passed &&
    citationDetails &&
    typeof unresolvedTargetCount === 'number' &&
    Number.isFinite(unresolvedTargetCount) &&
    unresolvedTargetCount > 0
  ) {
    const targets = Array.isArray(citationDetails.unresolvedInlineCitationTargets)
      ? citationDetails.unresolvedInlineCitationTargets.filter(
          (target): target is string => typeof target === 'string'
        )
      : [];
    recommendations.push({
      category: 'geo',
      categoryLabel: CHECKER_REGISTRY.find(({ key }) => key === 'geo')?.label ?? 'GEO',
      checkName: 'citation-evidence-profile',
      finding: `${unresolvedTargetCount} citation-shaped in-page link(s) point to fragment targets missing from this rendered DOM snapshot${targets.length > 0 ? ` (${targets.slice(0, 3).join(', ')})` : ''}.`,
      severity: 'info',
      priority: 'low',
      scoreLift: null,
      action:
        'Check each reported fragment: add the intended target ID to the page or update/remove the stale citation link. Confirm the target is present after the page finishes rendering.',
      quickWin: false,
    });
  }
  const sourceLinkCount = citationDetails?.externalSourceLinkCount;
  const leadingSourceShare = citationDetails?.topSourceHostLinkSharePercent;
  if (
    citationEvidence?.passed &&
    citationDetails &&
    typeof sourceLinkCount === 'number' &&
    sourceLinkCount >= MIN_EXTERNAL_SOURCE_LINKS_FOR_CONCENTRATION_NOTE &&
    typeof leadingSourceShare === 'number' &&
    Number.isFinite(leadingSourceShare) &&
    leadingSourceShare >= SOURCE_HOST_CONCENTRATION_NOTE_PERCENT
  ) {
    const sourceHostRows = Array.isArray(citationDetails.sourceHostLinkCounts)
      ? citationDetails.sourceHostLinkCounts
      : [];
    const leadingHost = sourceHostRows.find(
      (value) =>
        value &&
        typeof value === 'object' &&
        typeof (value as Record<string, unknown>).host === 'string'
    ) as Record<string, unknown> | undefined;
    const hostContext = typeof leadingHost?.host === 'string' ? ` (${leadingHost.host})` : '';
    recommendations.push({
      category: 'geo',
      categoryLabel: CHECKER_REGISTRY.find(({ key }) => key === 'geo')?.label ?? 'GEO',
      checkName: 'citation-evidence-profile',
      finding: `${leadingSourceShare}% of ${sourceLinkCount} observed external source links point to one host${hostContext}. This is a source-distribution observation, not a search-ranking signal.`,
      severity: 'info',
      priority: 'low',
      scoreLift: null,
      action:
        'Review whether the source mix reflects the evidence available for this page; keep references that directly support its claims and add independent sources where the subject warrants them.',
      quickWin: false,
    });
  }

  return recommendations.sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (b.scoreLift ?? -1) - (a.scoreLift ?? -1) ||
      Number(b.quickWin) - Number(a.quickWin) ||
      (categoryOrder.get(a.category) ?? 0) - (categoryOrder.get(b.category) ?? 0) ||
      a.checkName.localeCompare(b.checkName)
  );
}
