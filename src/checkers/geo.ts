import { BaseChecker, CheckOutcome } from './base';
import { fetchRobotsPolicy } from '../robots';
import type { SiteWideGeoLlmsLinkTargetProfile } from '../sitewide';

const SEARCH_CRAWLERS = [
  { token: 'Googlebot', surface: 'Google Search, including its AI search features' },
  { token: 'bingbot', surface: 'Bing Search and Copilot grounding' },
  { token: 'OAI-SearchBot', surface: 'ChatGPT Search' },
  { token: 'Claude-SearchBot', surface: 'Claude Search' },
  { token: 'PerplexityBot', surface: 'Perplexity Search' },
  { token: 'MistralAI-Index', surface: 'Mistral Search and Vibe grounding' },
  { token: 'Amzn-SearchBot', surface: 'Amazon search experiences, including Alexa' },
  { token: 'Applebot', surface: 'Apple Search and Apple Intelligence context' },
] as const;

const DATA_USE_CRAWLERS = [
  { token: 'GPTBot', purpose: 'OpenAI model development' },
  { token: 'ClaudeBot', purpose: 'Anthropic model development' },
  {
    token: 'Amazonbot',
    purpose: 'Amazon product and service improvement; may be used to train Amazon AI models',
  },
  {
    token: 'Applebot-Extended',
    purpose: 'Apple generative foundation-model training policy; does not crawl pages',
  },
  {
    token: 'Google-Extended',
    purpose: 'Gemini Apps and Vertex AI controls; not Google Search inclusion',
  },
  {
    token: 'MistralAI-Training',
    purpose: 'Mistral generative AI training datasets; not search indexing or live Vibe answers',
  },
] as const;

const ROBOTS_CONTROLLED_USER_FETCHERS = [
  { token: 'MistralAI-User', surface: 'Mistral Vibe user-requested page fetches' },
] as const;

const OPTIONAL_LLM_FILES = ['/llms.txt', '/llms-full.txt'] as const;
const MAX_LLM_FILE_BYTES = 64 * 1024;
const MAX_SOURCE_HTML_BYTES = 2 * 1024 * 1024;
const CONTENT_PARITY_SHINGLE_WORDS = 5;
const MAX_CONTENT_PARITY_TEXT_CHARACTERS = 1_000_000;
const MAX_CONTENT_PARITY_WORD_TOKENS = 25_000;

function profileLlmsMarkdownLinks(content: string, fileUrl: URL): SiteWideGeoLlmsLinkTargetProfile {
  const profile: SiteWideGeoLlmsLinkTargetProfile = {
    markdownLinks: 0,
    uniqueWebTargets: 0,
    duplicateWebTargets: 0,
    sameOriginWebLinks: 0,
    externalHttpsLinks: 0,
    externalHttpLinks: 0,
    relativeLinks: 0,
    unsupportedSchemeLinks: 0,
    invalidTargets: 0,
    emptyLabels: 0,
    malformedLinkCandidates: 0,
  };
  const seenWebTargets = new Set<string>();
  const linkPattern = /\[([^\]\n]*)\]\(([^)\n]*)\)/g;
  const candidateCount = (content.match(/\[[^\]\n]*\]\s*\(/g) ?? []).length;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(content)) !== null) {
    profile.markdownLinks += 1;
    if (!(match[1] ?? '').trim()) profile.emptyLabels += 1;
    const targetText = (match[2] ?? '').trim();
    const destinationMatch = targetText.match(/^(?:<([^>]*)>|([^\s]+))/);
    const destination = (destinationMatch?.[1] ?? destinationMatch?.[2] ?? '').trim();
    if (!destination) {
      profile.invalidTargets += 1;
      continue;
    }

    const explicitScheme = /^[a-z][a-z\d+.-]*:/i.test(destination);
    const protocolRelative = destination.startsWith('//');
    if (!explicitScheme && !protocolRelative) profile.relativeLinks += 1;

    try {
      const resolved = new URL(destination, fileUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        profile.unsupportedSchemeLinks += 1;
        continue;
      }
      if (resolved.origin === fileUrl.origin) profile.sameOriginWebLinks += 1;
      else if (resolved.protocol === 'https:') profile.externalHttpsLinks += 1;
      else profile.externalHttpLinks += 1;
      if (seenWebTargets.has(resolved.href)) profile.duplicateWebTargets += 1;
      else seenWebTargets.add(resolved.href);
    } catch {
      profile.invalidTargets += 1;
    }
  }
  profile.uniqueWebTargets = seenWebTargets.size;
  profile.malformedLinkCandidates = Math.max(0, candidateCount - profile.markdownLinks);
  return profile;
}

function summarizeCrawlerTokens(tokens: string[], maxShown = 8): string {
  if (tokens.length === 0) return 'none';
  const shown = tokens.slice(0, maxShown).join(', ');
  return tokens.length > maxShown ? `${shown}, and ${tokens.length - maxShown} more` : shown;
}

export class GeoChecker extends BaseChecker {
  private robotsPolicyPromise?: ReturnType<typeof fetchRobotsPolicy>;

  protected checks() {
    return [
      { id: 'ai-search-crawler-access', run: () => this.checkSearchCrawlerAccess() },
      { id: 'ai-data-use-crawler-policy', run: () => this.checkDataUseCrawlerPolicy() },
      { id: 'ai-user-initiated-fetch-access', run: () => this.checkUserInitiatedFetchAccess() },
      { id: 'ai-search-preview-controls', run: () => this.checkSearchPreviewControls() },
      { id: 'answer-content-profile', run: () => this.profileAnswerContent() },
      { id: 'source-rendered-content-profile', run: () => this.profileSourceRenderedContent() },
      { id: 'citation-evidence-profile', run: () => this.profileCitationEvidence() },
      { id: 'llms-txt-convention-inventory', run: () => this.inventoryLlmsFiles() },
    ];
  }

  private getRobotsPolicy(): ReturnType<typeof fetchRobotsPolicy> {
    if (!this.robotsPolicyPromise) {
      const pageUrl = new URL(this.page.url());
      this.robotsPolicyPromise = fetchRobotsPolicy(pageUrl.origin, 5_000);
    }
    return this.robotsPolicyPromise;
  }

  private getSearchCrawlers(): Array<{ token: string; surface: string }> {
    const configured = this.threshold<unknown>(
      'ai-search-crawler-access',
      'crawlers',
      SEARCH_CRAWLERS
    );
    const candidates = [...SEARCH_CRAWLERS, ...(Array.isArray(configured) ? configured : [])];
    const seenTokens = new Set<string>();
    const crawlers = candidates.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const candidate = value as Record<string, unknown>;
      const token = typeof candidate.token === 'string' ? candidate.token.trim() : '';
      const surface = typeof candidate.surface === 'string' ? candidate.surface.trim() : '';
      const key = token.toLowerCase();
      if (
        !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(token) ||
        !surface ||
        surface.length > 160 ||
        seenTokens.has(key)
      )
        return [];
      seenTokens.add(key);
      return [{ token, surface }];
    });
    return crawlers;
  }

  private getDataUseCrawlers(): Array<{ token: string; purpose: string }> {
    const configured = this.threshold<unknown>(
      'ai-data-use-crawler-policy',
      'crawlers',
      DATA_USE_CRAWLERS
    );
    const candidates = [...DATA_USE_CRAWLERS, ...(Array.isArray(configured) ? configured : [])];
    const seenTokens = new Set<string>();
    return candidates.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const candidate = value as Record<string, unknown>;
      const token = typeof candidate.token === 'string' ? candidate.token.trim() : '';
      const purpose = typeof candidate.purpose === 'string' ? candidate.purpose.trim() : '';
      const key = token.toLowerCase();
      if (
        !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(token) ||
        !purpose ||
        purpose.length > 160 ||
        seenTokens.has(key)
      )
        return [];
      seenTokens.add(key);
      return [{ token, purpose }];
    });
  }

  private async checkSearchCrawlerAccess(): Promise<CheckOutcome> {
    try {
      const url = new URL(this.page.url());
      const policy = await this.getRobotsPolicy();
      if (policy.failureReason) {
        return {
          passed: false,
          severity: 'info',
          message: 'AI search crawler access could not be read from robots.txt',
          details: { reason: policy.failureReason },
        };
      }

      const crawlers = this.getSearchCrawlers().map(({ token, surface }) => ({
        token,
        surface,
        ...policy.explain(url, token),
      }));
      const blocked = crawlers.filter(({ allowed }) => !allowed);

      return {
        passed: blocked.length === 0,
        severity: 'info',
        message:
          blocked.length === 0
            ? `robots.txt permits all ${crawlers.length} checked search crawlers on this URL`
            : `robots.txt blocks ${blocked.map(({ token }) => token).join(', ')} on this URL`,
        details: {
          pagePath: url.pathname,
          crawlers,
          scope:
            'robots.txt only; CDN, firewall, authentication, and crawler indexing were not checked',
        },
      };
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'AI search crawler access could not be assessed',
        details: { reason: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  private async checkDataUseCrawlerPolicy(): Promise<CheckOutcome> {
    try {
      const url = new URL(this.page.url());
      const policy = await this.getRobotsPolicy();
      if (policy.failureReason) {
        return {
          passed: false,
          severity: 'info',
          message: 'AI data-use crawler controls could not be read from robots.txt',
          details: { reason: policy.failureReason },
        };
      }

      const crawlers = this.getDataUseCrawlers().map(({ token, purpose }) => ({
        token,
        purpose,
        ...policy.explain(url, token),
      }));
      const blocked = crawlers.filter(({ allowed }) => !allowed).map(({ token }) => token);
      const allowed = crawlers
        .filter(({ allowed: isAllowed }) => isAllowed)
        .map(({ token }) => token);

      return {
        passed: true,
        severity: 'info',
        message: `AI data-use controls are separate from search access: ${allowed.length} allowed (${summarizeCrawlerTokens(allowed)}), ${blocked.length} blocked (${summarizeCrawlerTokens(blocked)})`,
        details: {
          pagePath: url.pathname,
          crawlers,
          allowed,
          blocked,
          note: 'This is a policy inventory. Aviary does not recommend allowing or blocking model-training crawlers.',
        },
      };
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'AI data-use crawler controls could not be assessed',
        details: { reason: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  private async checkUserInitiatedFetchAccess(): Promise<CheckOutcome> {
    try {
      const url = new URL(this.page.url());
      const policy = await this.getRobotsPolicy();
      if (policy.failureReason) {
        return {
          passed: false,
          severity: 'info',
          message: 'Robots policy for documented user-triggered fetchers could not be read',
          details: { reason: policy.failureReason },
        };
      }
      const crawlers = ROBOTS_CONTROLLED_USER_FETCHERS.map(({ token, surface }) => ({
        token,
        surface,
        ...policy.explain(url, token),
      }));
      const blocked = crawlers.filter(({ allowed }) => !allowed).map(({ token }) => token);
      return {
        passed: true,
        severity: 'info',
        message: `robots.txt ${blocked.length > 0 ? `blocks ${blocked.join(', ')}` : 'permits'} documented user-triggered fetch access on this URL`,
        details: {
          pagePath: url.pathname,
          crawlers,
          note: 'Only user-triggered fetchers with an explicitly documented robots policy are included. This is access policy, not search indexing or a citation prediction.',
        },
      };
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'Robots policy for documented user-triggered fetchers could not be assessed',
        details: { reason: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  private async checkSearchPreviewControls(): Promise<CheckOutcome> {
    try {
      const xRobotsTag = this.response?.headers()['x-robots-tag'] ?? '';
      const searchCrawlers = this.getSearchCrawlers();
      const dataUseCrawlers = this.getDataUseCrawlers();
      const previewData = await this.page.evaluate(
        ({ headerValue, crawlerTokens, dataUseTokens }) => {
          const knownSources = new Set([
            'robots',
            ...crawlerTokens.map((token) => token.toLowerCase()),
            ...dataUseTokens.map((token) => token.toLowerCase()),
          ]);
          const metaDirectives = Array.from(document.querySelectorAll('meta[name]')).flatMap(
            (meta) => {
              const source = (meta.getAttribute('name') ?? '').toLowerCase();
              return knownSources.has(source)
                ? [{ source, value: (meta.getAttribute('content') ?? '').toLowerCase() }]
                : [];
            }
          );
          const directiveNames = new Set([
            'all',
            'noindex',
            'nofollow',
            'none',
            'noarchive',
            'nosnippet',
            'indexifembedded',
            'notranslate',
            'noimageindex',
            'max-snippet',
            'max-image-preview',
            'max-video-preview',
            'unavailable_after',
            'noai',
            'noimageai',
          ]);
          const headerDirectives: Array<{ source: string; value: string }> = [];
          let activeHeaderSource: string | undefined = 'x-robots-tag';
          for (const rawPart of headerValue.split(',')) {
            const value = rawPart.trim().toLowerCase();
            if (!value) continue;
            const scoped = /^([a-z][a-z0-9_-]*)\s*:\s*(.*)$/i.exec(value);
            const prefix = scoped?.[1]?.toLowerCase();
            if (prefix && !directiveNames.has(prefix)) {
              activeHeaderSource = knownSources.has(prefix) ? prefix : undefined;
              if (activeHeaderSource && scoped?.[2])
                headerDirectives.push({ source: activeHeaderSource, value: scoped[2] });
              continue;
            }
            if (activeHeaderSource) headerDirectives.push({ source: activeHeaderSource, value });
          }
          const allDirectives = [...metaDirectives, ...headerDirectives];
          const crawlerControls = crawlerTokens.map((token) => {
            const applicable = allDirectives.filter(
              ({ source }) =>
                source === 'robots' || source === 'x-robots-tag' || source === token.toLowerCase()
            );
            const tokens = applicable.flatMap(({ value }) => value.split(/[\s,]+/).filter(Boolean));
            const maxSnippetZero = applicable.some(({ value }) =>
              /(?:^|[,\s])max-snippet\s*:\s*0(?:$|[,\s])/i.test(value)
            );
            return {
              token,
              noindex: tokens.includes('noindex') || tokens.includes('none'),
              noSnippet: tokens.includes('nosnippet') || tokens.includes('none') || maxSnippetZero,
              maxSnippetZero,
            };
          });
          const dataUseCrawlerControls = dataUseTokens
            .filter(
              (token) => !['google-extended', 'applebot-extended'].includes(token.toLowerCase())
            )
            .map((token) => {
              const applicable = allDirectives.filter(
                ({ source }) =>
                  source === 'robots' || source === 'x-robots-tag' || source === token.toLowerCase()
              );
              const tokens = applicable.flatMap(({ value }) =>
                value.split(/[\s,]+/).filter(Boolean)
              );
              return {
                token,
                noindex: tokens.includes('noindex') || tokens.includes('none'),
                noArchive: tokens.includes('noarchive'),
              };
            });
          const noindex = crawlerControls.some(({ noindex: restricted }) => restricted);
          const noSnippet = crawlerControls.some(({ noSnippet: restricted }) => restricted);
          const maxSnippetZero = crawlerControls.some(
            ({ maxSnippetZero: restricted }) => restricted
          );
          const root = document.querySelector('main, article') ?? document.body;
          const renderedText = (element: Element | null): string =>
            element ? ((element as HTMLElement).innerText ?? element.textContent ?? '') : '';
          const isVisible = (element: Element): boolean => {
            for (let current: Element | null = element; current; current = current.parentElement) {
              const style = window.getComputedStyle(current);
              if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                style.visibility === 'collapse' ||
                Number(style.opacity) === 0
              )
                return false;
            }
            return Array.from(element.getClientRects()).some(
              (rect) => rect.width > 0 && rect.height > 0
            );
          };
          const visibleText = isVisible(root ?? document.body) ? renderedText(root).trim() : '';
          const visibleWords = visibleText ? visibleText.split(/\s+/).filter(Boolean).length : 0;
          const contentRegion = root ?? document.body;
          const visibleDataNoSnippetElements = Array.from(
            document.querySelectorAll('[data-nosnippet]')
          ).filter(
            (element) =>
              isVisible(element) &&
              (element === contentRegion ||
                contentRegion.contains(element) ||
                element.contains(contentRegion))
          );
          const topLevelDataNoSnippetElements = visibleDataNoSnippetElements.filter(
            (element) =>
              !visibleDataNoSnippetElements.some(
                (parent) => parent !== element && parent.contains(element)
              )
          );
          const dataNoSnippetWords = topLevelDataNoSnippetElements.reduce((count, element) => {
            const text = renderedText(
              element.contains(contentRegion) ? contentRegion : element
            ).trim();
            return count + (text ? text.split(/\s+/).filter(Boolean).length : 0);
          }, 0);
          return {
            noindex,
            noSnippet,
            maxSnippetZero,
            crawlerControls,
            dataUseCrawlerControls,
            dataNoSnippetElements: visibleDataNoSnippetElements.length,
            dataNoSnippetWords,
            dataNoSnippetWordSharePercent:
              visibleWords > 0
                ? Number(((dataNoSnippetWords / visibleWords) * 100).toFixed(1))
                : null,
            visibleTextWords: visibleWords,
            visibleTextCharacters: visibleText.length,
            directives: allDirectives,
          };
        },
        {
          headerValue: xRobotsTag,
          crawlerTokens: searchCrawlers.map(({ token }) => token),
          dataUseTokens: dataUseCrawlers.map(({ token }) => token),
        }
      );
      const status = this.response?.status();
      const restricted =
        previewData.noindex || previewData.noSnippet || (status !== undefined && status !== 200);
      const noindexCrawlers = previewData.crawlerControls
        .filter(({ noindex }) => noindex)
        .map(({ token }) => token);
      const noSnippetCrawlers = previewData.crawlerControls
        .filter(({ noSnippet }) => noSnippet)
        .map(({ token }) => token);
      const dataUseNoindexCrawlers = previewData.dataUseCrawlerControls
        .filter(({ noindex }) => noindex)
        .map(({ token }) => token);
      const noArchiveCrawlers = previewData.dataUseCrawlerControls
        .filter(({ noArchive }) => noArchive)
        .map(({ token }) => token);
      const crawlerControlSummary = `search crawler noindex: ${summarizeCrawlerTokens(noindexCrawlers)}; snippet restrictions: ${summarizeCrawlerTokens(noSnippetCrawlers)}; data-use noindex: ${summarizeCrawlerTokens(dataUseNoindexCrawlers)}; data-use noarchive: ${summarizeCrawlerTokens(noArchiveCrawlers)}`;
      const dataNoSnippetSummary =
        previewData.dataNoSnippetElements > 0
          ? `${previewData.dataNoSnippetWords} visible words in ${previewData.dataNoSnippetElements} data-nosnippet element(s) (${previewData.dataNoSnippetWordSharePercent === null ? 'share unavailable' : `${previewData.dataNoSnippetWordSharePercent}% of visible text`})`
          : 'no visible data-nosnippet regions';

      return {
        passed: !restricted,
        severity: 'info',
        message: restricted
          ? status !== undefined && status !== 200
            ? `The page returned HTTP ${status}; search indexing eligibility may be affected. ${crawlerControlSummary}. ${dataNoSnippetSummary}`
            : `Page directives restrict indexing or search snippets; confirm that this is intentional. ${crawlerControlSummary}. ${dataNoSnippetSummary}`
          : `${previewData.visibleTextCharacters} visible content characters are available without a page-wide noindex or nosnippet directive. ${crawlerControlSummary}. ${dataNoSnippetSummary}`,
        details: {
          ...(status !== undefined ? { responseStatus: status } : {}),
          noindex: previewData.noindex,
          noSnippet: previewData.noSnippet,
          maxSnippetZero: previewData.maxSnippetZero,
          crawlerControls: previewData.crawlerControls,
          dataUseCrawlerControls: previewData.dataUseCrawlerControls,
          dataNoSnippetElements: previewData.dataNoSnippetElements,
          dataNoSnippetWords: previewData.dataNoSnippetWords,
          dataNoSnippetWordSharePercent: previewData.dataNoSnippetWordSharePercent,
          visibleTextWords: previewData.visibleTextWords,
          visibleTextCharacters: previewData.visibleTextCharacters,
          directives: previewData.directives,
        },
      };
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'Search preview controls could not be inspected',
        details: { reason: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  private async inventoryLlmsFiles(): Promise<CheckOutcome> {
    try {
      const pageUrl = new URL(this.page.url());
      const policy = await this.getRobotsPolicy();
      if (policy.failureReason) {
        return {
          passed: false,
          severity: 'info',
          message:
            'Optional llms.txt files were not requested because robots.txt could not be assessed',
          details: { reason: policy.failureReason, paths: OPTIONAL_LLM_FILES },
        };
      }

      const resources = await Promise.all(
        OPTIONAL_LLM_FILES.map(async (pathname) => {
          const fileUrl = new URL(pathname, pageUrl.origin);
          const robotsDecision = policy.explain(fileUrl, 'AviaryBot');
          if (!robotsDecision.allowed) {
            return {
              path: pathname,
              robotsAllowed: false,
              robotsDecision,
              status: undefined,
              found: false,
              reason: 'Not requested because robots.txt disallows AviaryBot.',
            };
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3_000);
          try {
            const response = await fetch(fileUrl, {
              headers: {
                accept: 'text/plain, text/markdown;q=0.9, */*;q=0.1',
                'user-agent': 'AviaryBot/0.1 (+https://github.com/Ru1vly/Aviary)',
              },
              redirect: 'manual',
              signal: controller.signal,
            });
            const base = {
              path: pathname,
              robotsAllowed: true,
              robotsDecision,
              status: response.status,
              contentType: response.headers.get('content-type') ?? undefined,
            };
            if (!response.ok) {
              await response.body?.cancel().catch(() => undefined);
              return {
                ...base,
                found: false,
                ...(response.status >= 300 && response.status < 400 ? { redirected: true } : {}),
              };
            }

            const chunks: Uint8Array[] = [];
            let bytesExamined = 0;
            let truncated = false;
            const reader = response.body?.getReader();
            if (reader) {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const available = MAX_LLM_FILE_BYTES - bytesExamined;
                  if (available <= 0) {
                    truncated = true;
                    await reader.cancel();
                    break;
                  }
                  const part = value.byteLength > available ? value.subarray(0, available) : value;
                  chunks.push(part);
                  bytesExamined += part.byteLength;
                  if (part.byteLength < value.byteLength || bytesExamined >= MAX_LLM_FILE_BYTES) {
                    truncated =
                      part.byteLength < value.byteLength || bytesExamined >= MAX_LLM_FILE_BYTES;
                    await reader.cancel();
                    break;
                  }
                }
              } catch (error) {
                await reader.cancel().catch(() => undefined);
                throw error;
              }
            }
            const content = new TextDecoder('utf-8').decode(Buffer.concat(chunks));
            const isHtml =
              /^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(base.contentType ?? '') ||
              /^\s*<(?:!doctype\s+html|html\b)/i.test(content);
            const nonEmptyLines = content.split(/\r\n?|\n/).filter((line) => line.trim()).length;
            const markdownHeadingCount = (content.match(/^#{1,6}\s+.+$/gm) ?? []).length;
            const markdownLinkCount = (content.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
            const linkTargetProfile =
              response.status === 200 && !isHtml
                ? profileLlmsMarkdownLinks(content, fileUrl)
                : undefined;
            return {
              ...base,
              found: response.status === 200 && !isHtml,
              ...(isHtml
                ? { reason: 'The URL returned an HTML page, not a plain-text or Markdown file.' }
                : {}),
              bytesExamined,
              truncated,
              nonEmptyLines,
              markdownHeadingCount,
              markdownLinkCount,
              ...(linkTargetProfile ? { linkTargetProfile } : {}),
            };
          } catch (error) {
            return {
              path: pathname,
              robotsAllowed: true,
              robotsDecision,
              status: undefined,
              found: false,
              reason: controller.signal.aborted
                ? 'Request timed out after 3000 ms.'
                : error instanceof Error
                  ? error.message
                  : 'Unknown request error',
            };
          } finally {
            clearTimeout(timeout);
          }
        })
      );
      const found = resources.filter(({ found: isFound }) => isFound).map(({ path }) => path);
      const confirmedAbsent = resources.every(({ status }) => status === 404 || status === 410);

      return {
        passed: true,
        severity: 'info',
        message:
          found.length > 0
            ? `Found ${found.join(' and ')}; file contents were summarized without evaluating quality`
            : confirmedAbsent
              ? 'Neither optional llms.txt convention file exists at the site root; this is not a search requirement'
              : 'Availability of optional llms.txt convention files could not be confirmed; review statuses and reasons below',
        details: {
          resources,
          note: 'llms.txt is an optional convention, not a Google Search requirement. Aviary reports availability, bounded Markdown structure, and local link-target classes using an inline [label](destination) pattern; reference-style links and escaped Markdown syntax are not parsed. It does not fetch linked targets or assess content quality.',
          maximumBytesPerFile: MAX_LLM_FILE_BYTES,
        },
      };
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'Optional llms.txt files could not be inventoried',
        details: { reason: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  private async profileAnswerContent(): Promise<CheckOutcome> {
    try {
      const profile = await this.page.evaluate(() => {
        const root = document.querySelector('main, article') ?? document.body;
        const isVisible = (element: Element | null): element is Element => {
          if (!element) return false;
          for (let current: Element | null = element; current; current = current.parentElement) {
            const style = window.getComputedStyle(current);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              style.visibility === 'collapse' ||
              Number(style.opacity) === 0
            )
              return false;
          }
          return Array.from(element.getClientRects()).some(
            (rect) => rect.width > 0 && rect.height > 0
          );
        };
        const renderedText = (element: Element | null): string =>
          element ? ((element as HTMLElement).innerText ?? element.textContent ?? '') : '';
        const text = isVisible(root) ? renderedText(root).trim() : '';
        const headings = Array.from(root?.querySelectorAll('h1,h2,h3,h4,h5,h6') ?? []).filter(
          isVisible
        );
        const questionPattern =
          /[?？]|^(?:what|who|when|where|why|how|can|does|is|are|should|which|will|qué|quién|cuándo|dónde|por qué|cómo|cuál|cuáles|quiénes|quand|où|pourquoi|comment|quel|quelle|quels|quelles|was|wer|wann|wo|warum|wie|welcher|welche|welches|cosa|chi|quando|dove|perché|come|quale|quali|quem|onde|por que|qual|quais|wat|wie|wanneer|waar|waarom|hoe|welke|ne|kim|nerede|neden|niçin|nasıl|hangi)(?=$|[\s:：])/i;
        let questionHeadings = 0;
        let conciseAnswerBlocks = 0;
        for (const heading of headings) {
          const headingText = renderedText(heading).trim();
          if (!questionPattern.test(headingText)) continue;
          questionHeadings += 1;
          const following = heading.nextElementSibling;
          if (!following || following.tagName.toLowerCase() !== 'p' || !isVisible(following))
            continue;
          const answerText = renderedText(following).trim();
          const wordCount = answerText ? answerText.split(/\s+/).length : 0;
          if (wordCount >= 8 && wordCount <= 100) conciseAnswerBlocks += 1;
        }

        const externalContentLinks = Array.from(root?.querySelectorAll('a[href]') ?? []).filter(
          (link) => {
            if (!isVisible(link)) return false;
            const rel = (link.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
            if (rel.includes('sponsored') || rel.includes('ugc')) return false;
            try {
              const target = new URL(link.getAttribute('href') ?? '', window.location.href);
              return (
                ['http:', 'https:'].includes(target.protocol) &&
                target.origin !== window.location.origin
              );
            } catch {
              return false;
            }
          }
        ).length;
        const jsonLdTypes = new Set<string>();
        const identityEntities: Array<{
          types: string[];
          id?: string;
          name?: string;
          sameAs: string[];
          sameAsTruncated: boolean;
        }> = [];
        let identityEntityListTruncated = false;
        let schemaAuthor = false;
        let schemaDate = false;
        const schemaDateModifiedDays = new Set<string>();
        let schemaDateModifiedDaysTruncated = false;
        let schemaDateModifiedHasNonDateValue = false;
        const accessibleForFreeValues = new Set<boolean>();
        let accessibleForFreeHasNonBooleanValue = false;
        const identityTypeName = (value: string): string =>
          value
            .split(/[\/#:]/)
            .pop()
            ?.toLowerCase() ?? '';
        const resolveSchemaUrl = (value: string): string | undefined => {
          try {
            const url = new URL(value, window.location.href);
            return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
              ? url.href
              : undefined;
          } catch {
            return undefined;
          }
        };
        const readTypes = (value: unknown): void => {
          if (!value || typeof value !== 'object') return;
          if (Array.isArray(value)) {
            value.forEach(readTypes);
            return;
          }
          const record = value as Record<string, unknown>;
          const type = record['@type'];
          const types =
            typeof type === 'string'
              ? [type]
              : Array.isArray(type)
                ? type.filter((item): item is string => typeof item === 'string')
                : [];
          types.forEach((item) => jsonLdTypes.add(item));
          const identityTypes = types.filter((item) => {
            const name = identityTypeName(item);
            return (
              name === 'person' ||
              name === 'brand' ||
              /(?:organization|corporation|business|company)$/.test(name)
            );
          });
          if (identityTypes.length > 0) {
            const rawId = typeof record['@id'] === 'string' ? record['@id'].trim() : '';
            const id = rawId ? (resolveSchemaUrl(rawId) ?? rawId) : undefined;
            const rawName = record.name;
            const name =
              typeof rawName === 'string'
                ? rawName.trim()
                : rawName && typeof rawName === 'object' && !Array.isArray(rawName)
                  ? typeof (rawName as Record<string, unknown>)['@value'] === 'string'
                    ? String((rawName as Record<string, unknown>)['@value']).trim()
                    : undefined
                  : undefined;
            const rawSameAs = Array.isArray(record.sameAs)
              ? record.sameAs
              : record.sameAs === undefined
                ? []
                : [record.sameAs];
            const allSameAs = [
              ...new Set(
                rawSameAs.flatMap((entry) => {
                  const raw =
                    typeof entry === 'string'
                      ? entry
                      : entry && typeof entry === 'object' && !Array.isArray(entry)
                        ? String(
                            (entry as Record<string, unknown>)['@id'] ??
                              (entry as Record<string, unknown>).url ??
                              ''
                          )
                        : '';
                  const url = raw ? resolveSchemaUrl(raw) : undefined;
                  return url ? [url] : [];
                })
              ),
            ];
            const sameAs = allSameAs.slice(0, 10);
            if (identityEntities.length < 20) {
              identityEntities.push({
                types: identityTypes,
                ...(id ? { id } : {}),
                ...(name ? { name } : {}),
                sameAs,
                sameAsTruncated: allSameAs.length > 10,
              });
            } else {
              identityEntityListTruncated = true;
            }
          }
          if (Object.prototype.hasOwnProperty.call(record, 'author')) schemaAuthor = true;
          if (
            ['datePublished', 'dateModified', 'dateCreated'].some((key) =>
              Object.prototype.hasOwnProperty.call(record, key)
            )
          )
            schemaDate = true;
          if (Object.prototype.hasOwnProperty.call(record, 'dateModified')) {
            const rawValues = Array.isArray(record.dateModified)
              ? record.dateModified
              : [record.dateModified];
            for (const rawDate of rawValues) {
              if (typeof rawDate !== 'string') {
                schemaDateModifiedHasNonDateValue = true;
                continue;
              }
              const candidate = rawDate.trim();
              const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(candidate);
              let day: string | undefined;
              if (dateOnly) {
                const parsed = new Date(`${candidate}T00:00:00.000Z`);
                if (
                  Number.isFinite(parsed.getTime()) &&
                  parsed.toISOString().slice(0, 10) === candidate
                )
                  day = candidate;
              } else if (
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(
                  candidate
                )
              ) {
                const datePrefix = candidate.slice(0, 10);
                const parsedDate = new Date(`${datePrefix}T00:00:00.000Z`);
                const parsedTimestamp = Date.parse(candidate);
                if (
                  Number.isFinite(parsedDate.getTime()) &&
                  parsedDate.toISOString().slice(0, 10) === datePrefix &&
                  Number.isFinite(parsedTimestamp)
                ) {
                  day = new Date(parsedTimestamp).toISOString().slice(0, 10);
                }
              }
              if (day) {
                if (schemaDateModifiedDays.has(day)) continue;
                if (schemaDateModifiedDays.size < 11) schemaDateModifiedDays.add(day);
                else schemaDateModifiedDaysTruncated = true;
              } else schemaDateModifiedHasNonDateValue = true;
            }
          }
          if (Object.prototype.hasOwnProperty.call(record, 'isAccessibleForFree')) {
            if (typeof record.isAccessibleForFree === 'boolean')
              accessibleForFreeValues.add(record.isAccessibleForFree);
            else accessibleForFreeHasNonBooleanValue = true;
          }
          Object.values(record).forEach(readTypes);
        };
        for (const script of Array.from(
          document.querySelectorAll('script[type="application/ld+json"]')
        )) {
          try {
            readTypes(JSON.parse(script.textContent ?? 'null'));
          } catch {
            /* Existing schema checks report malformed blocks. */
          }
        }

        const visibleAuthor = Array.from(
          root?.querySelectorAll(
            '[rel="author"], [itemprop="author"], [class*="author" i], [data-author]'
          ) ?? []
        ).some(isVisible);
        const visibleDate = Array.from(root?.querySelectorAll('time[datetime]') ?? []).some(
          isVisible
        );
        const documentLanguage = document.documentElement.lang.trim().slice(0, 80);
        let documentLanguageValid: boolean | undefined;
        if (documentLanguage) {
          try {
            documentLanguageValid = Intl.getCanonicalLocales(documentLanguage).length === 1;
          } catch {
            documentLanguageValid = false;
          }
        }

        return {
          contentWords: text ? text.split(/\s+/).length : 0,
          mainOrArticleRegion: Boolean(document.querySelector('main, article')),
          headingCount: headings.length,
          questionHeadings,
          conciseAnswerBlocks,
          listCount: root?.querySelectorAll('ul,ol').length ?? 0,
          tableCount: root?.querySelectorAll('table').length ?? 0,
          externalContentLinks,
          visibleAuthor,
          visibleDate,
          schemaAuthor,
          schemaDate,
          schemaDateModifiedDays: [...schemaDateModifiedDays].sort().slice(0, 10),
          schemaDateModifiedDaysTruncated:
            schemaDateModifiedDaysTruncated || schemaDateModifiedDays.size > 10,
          schemaDateModifiedHasNonDateValue,
          schemaIsAccessibleForFree:
            accessibleForFreeValues.size > 1
              ? 'mixed'
              : accessibleForFreeValues.has(true)
                ? true
                : accessibleForFreeValues.has(false)
                  ? false
                  : 'not-declared',
          schemaHasNonBooleanAccessibleForFreeValue: accessibleForFreeHasNonBooleanValue,
          jsonLdTypes: [...jsonLdTypes].slice(0, 20),
          jsonLdTypeListTruncated: jsonLdTypes.size > 20,
          identityEntities,
          identityEntityListTruncated,
          documentLanguage: documentLanguage || undefined,
          ...(documentLanguageValid !== undefined ? { documentLanguageValid } : {}),
        };
      });

      return {
        ...this.pass(
          `Content profile: ${profile.contentWords} words, ${profile.conciseAnswerBlocks}/${profile.questionHeadings} question headings followed by concise answers, ${profile.externalContentLinks} external content links`,
          {
            ...profile,
            interpretation:
              'Observations only. These structures are not known requirements or ranking guarantees for generative search.',
          }
        ),
        severity: 'info',
      };
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'Answer-content signals could not be profiled',
        details: { reason: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  private async profileSourceRenderedContent(): Promise<CheckOutcome> {
    const notAssessed = (reason: string): CheckOutcome => ({
      passed: true,
      severity: 'info',
      message: `Source-to-rendered content comparison was not assessed: ${reason}`,
      details: { assessed: false, reason },
    });

    try {
      if (!this.response) return notAssessed('the initial document response is unavailable');
      const status = this.response.status();
      if (status !== 200) return notAssessed(`the initial document returned HTTP ${status}`);

      const headers = this.response.headers();
      const contentType = headers['content-type'] ?? '';
      if (contentType && !/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(contentType)) {
        return notAssessed(`the initial response content type was ${contentType}`);
      }
      const declaredLength = Number(headers['content-length']);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_SOURCE_HTML_BYTES) {
        return notAssessed(
          `the initial HTML exceeded the ${MAX_SOURCE_HTML_BYTES.toLocaleString()} byte analysis cap`
        );
      }

      const sourceHtml = await this.response.text();
      const sourceBytes = Buffer.byteLength(sourceHtml, 'utf8');
      if (sourceBytes > MAX_SOURCE_HTML_BYTES) {
        return notAssessed(
          `the initial HTML exceeded the ${MAX_SOURCE_HTML_BYTES.toLocaleString()} byte analysis cap`
        );
      }
      if (!contentType && !/^\s*(?:<!doctype\s+html|<html\b)/i.test(sourceHtml)) {
        return notAssessed('the initial response did not look like an HTML document');
      }

      const profile = await this.page.evaluate(
        ({ html, shingleWords, maxTextCharacters, maxWordTokens }) => {
          const sourceDocument = new DOMParser().parseFromString(html, 'text/html');
          const sourceRoot = sourceDocument.querySelector('main, article') ?? sourceDocument.body;
          const renderedRoot = document.querySelector('main, article') ?? document.body;
          const sourceText = (() => {
            const clone = sourceRoot?.cloneNode(true) as Element | undefined;
            clone
              ?.querySelectorAll('script,style,template,svg,canvas')
              .forEach((element) => element.remove());
            return clone?.textContent ?? '';
          })();
          const renderedText = renderedRoot
            ? ((renderedRoot as HTMLElement).innerText ?? renderedRoot.textContent ?? '')
            : '';
          const sourceTextSample = sourceText.slice(0, maxTextCharacters);
          const renderedTextSample = renderedText.slice(0, maxTextCharacters);
          const tokenize = (value: string): { tokens: string[]; wordCount: number } => {
            const expression = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;
            const normalizedValue = value.normalize('NFKC').toLowerCase();
            const tokens: string[] = [];
            let wordCount = 0;
            let match: RegExpExecArray | null;
            while ((match = expression.exec(normalizedValue)) !== null) {
              wordCount += 1;
              if (tokens.length < maxWordTokens) tokens.push(match[0]);
            }
            return { tokens, wordCount };
          };
          const makeShingles = (tokens: string[]): Set<string> => {
            const width = Math.min(shingleWords, tokens.length);
            const shingles = new Set<string>();
            for (let index = 0; width > 0 && index <= tokens.length - width; index += 1) {
              shingles.add(tokens.slice(index, index + width).join(' '));
            }
            return shingles;
          };
          const sourceTokenization = tokenize(sourceTextSample);
          const renderedTokenization = tokenize(renderedTextSample);
          const sourceTokens = sourceTokenization.tokens;
          const renderedTokens = renderedTokenization.tokens;
          const sourceShingles = makeShingles(sourceTokens);
          const renderedShingles = makeShingles(renderedTokens);
          let sharedShingles = 0;
          for (const phrase of renderedShingles) {
            if (sourceShingles.has(phrase)) sharedShingles += 1;
          }
          const renderedOnlyShingles = [...renderedShingles].filter(
            (phrase) => !sourceShingles.has(phrase)
          ).length;
          const coverage =
            renderedShingles.size > 0 ? (sharedShingles / renderedShingles.size) * 100 : null;
          return {
            assessed: true,
            sourceHasMainOrArticle: Boolean(sourceDocument.querySelector('main, article')),
            renderedHasMainOrArticle: Boolean(document.querySelector('main, article')),
            sourceWordCount: sourceTokenization.wordCount,
            renderedWordCount: renderedTokenization.wordCount,
            sourcePhraseSampleTruncated: sourceTokenization.wordCount > sourceTokens.length,
            renderedPhraseSampleTruncated: renderedTokenization.wordCount > renderedTokens.length,
            sourceTextSampleTruncated: sourceText.length > maxTextCharacters,
            renderedTextSampleTruncated: renderedText.length > maxTextCharacters,
            sourcePhraseCount: sourceShingles.size,
            renderedPhraseCount: renderedShingles.size,
            sharedRenderedPhraseCount: sharedShingles,
            renderedOnlyPhraseCount: renderedOnlyShingles,
            renderedPhraseCoveragePercent: coverage === null ? null : Number(coverage.toFixed(1)),
            phraseWindowWords: Math.min(shingleWords, renderedTokens.length),
            maximumTextCharactersPerDocument: maxTextCharacters,
            maximumPhraseTokensPerDocument: maxWordTokens,
          };
        },
        {
          html: sourceHtml,
          shingleWords: CONTENT_PARITY_SHINGLE_WORDS,
          maxTextCharacters: MAX_CONTENT_PARITY_TEXT_CHARACTERS,
          maxWordTokens: MAX_CONTENT_PARITY_WORD_TOKENS,
        }
      );
      const cappedSides = [
        profile.sourcePhraseSampleTruncated || profile.sourceTextSampleTruncated
          ? 'source text sample capped'
          : undefined,
        profile.renderedPhraseSampleTruncated || profile.renderedTextSampleTruncated
          ? 'rendered text sample capped'
          : undefined,
      ].filter((value): value is string => Boolean(value));
      const capNote =
        cappedSides.length > 0
          ? `; ${cappedSides.join(' and ')} at ${MAX_CONTENT_PARITY_TEXT_CHARACTERS.toLocaleString()} characters / ${MAX_CONTENT_PARITY_WORD_TOKENS.toLocaleString()} words`
          : '';

      return {
        passed: true,
        severity: 'info',
        message:
          profile.renderedPhraseCoveragePercent === null
            ? 'Source and rendered text were compared, but the rendered page had too little text to form a phrase sample'
            : `${profile.renderedPhraseCoveragePercent}% of rendered ${profile.phraseWindowWords}-word phrase samples also appeared in the initial HTML (${profile.sourceWordCount} source words, ${profile.renderedWordCount} rendered words, ${profile.renderedOnlyPhraseCount} rendered-only phrases${capNote})`,
        details: {
          ...profile,
          sourceHtmlBytes: sourceBytes,
          interpretation:
            'A low overlap indicates text present after browser rendering but not found in the initial HTML snapshot. The comparison uses the leading text sample when content exceeds its cap. Hidden markup, late updates, personalization, and text normalization can also affect overlap. Rendering and access behavior varies by crawler; this comparison does not identify what any specific crawler can execute or predict citations.',
        },
      };
    } catch (error) {
      return notAssessed(
        error instanceof Error ? error.message : 'the document source could not be read'
      );
    }
  }

  private async profileCitationEvidence(): Promise<CheckOutcome> {
    try {
      const profile = await this.page.evaluate(() => {
        const root = document.querySelector('main, article') ?? document.body;
        const isVisible = (element: Element | null): element is Element => {
          if (!element) return false;
          for (let current: Element | null = element; current; current = current.parentElement) {
            const style = window.getComputedStyle(current);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              style.visibility === 'collapse' ||
              Number(style.opacity) === 0
            )
              return false;
          }
          return Array.from(element.getClientRects()).some(
            (rect) => rect.width > 0 && rect.height > 0
          );
        };
        const renderedText = (element: Element | null): string =>
          element ? ((element as HTMLElement).innerText ?? element.textContent ?? '') : '';
        const externalLinks = Array.from(root?.querySelectorAll('a[href]') ?? []).flatMap(
          (link) => {
            if (!isVisible(link)) return [];
            const rel = (link.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
            if (rel.includes('sponsored') || rel.includes('ugc')) return [];
            try {
              const target = new URL(link.getAttribute('href') ?? '', window.location.href);
              if (
                target.origin === window.location.origin ||
                !['http:', 'https:'].includes(target.protocol)
              )
                return [];
              const label = (
                link.getAttribute('aria-label')?.trim() ||
                renderedText(link).trim() ||
                link.getAttribute('title') ||
                ''
              ).replace(/\s+/g, ' ');
              const genericLabel =
                /^(?:click here|read more|here|source|link|website|learn more|more|leer más|aquí|fuente|más información|lire la suite|ici|source|en savoir plus|weiterlesen|hier|quelle|mehr erfahren|leggi di più|qui|fonte|saiba mais|leia mais|buraya tıklayın|daha fazla|kaynak)$/i.test(
                  label
                );
              return [
                {
                  host: target.hostname.toLowerCase(),
                  descriptive: label.length >= 3 && !genericLabel && !/^https?:\/\//i.test(label),
                },
              ];
            } catch {
              return [];
            }
          }
        );
        const referenceHeadings = Array.from(root?.querySelectorAll('h2,h3,h4,h5,h6') ?? []).filter(
          (heading) =>
            isVisible(heading) &&
            /^(?:references?|sources?|bibliography|citations?|notes|referencias?|fuentes|bibliografía|quellen|literatur|riferimenti|fonti|referências|fontes|bronnen|kaynaklar|atıflar)$/i.test(
              renderedText(heading).trim()
            )
        );
        const referenceLinkCount = referenceHeadings.reduce((count, heading) => {
          let sibling = heading.nextElementSibling;
          let sectionLinks = 0;
          while (sibling && !/^H[1-6]$/.test(sibling.tagName)) {
            sectionLinks += Array.from(sibling.querySelectorAll('a[href]')).filter(
              isVisible
            ).length;
            sibling = sibling.nextElementSibling;
          }
          return count + sectionLinks;
        }, 0);
        const inlineCitationLinks = Array.from(
          root?.querySelectorAll(
            'sup a[href^="#"], a[role="doc-noteref"][href^="#"], a[href^="#ref" i], a[href^="#cite" i], a[href^="#note" i], a[href^="#fn" i], a[href^="#footnote" i]'
          ) ?? []
        ).filter(isVisible);
        let resolvedInlineCitationTargetsWithExternalLinks = 0;
        let resolvedInlineCitationTargetsWithoutExternalLinks = 0;
        const unresolvedInlineCitationTargets = inlineCitationLinks.flatMap((link) => {
          const href = link.getAttribute('href') ?? '';
          const encodedTarget = href.startsWith('#') ? href.slice(1) : '';
          if (!encodedTarget) return [];
          let target = encodedTarget;
          try {
            target = decodeURIComponent(encodedTarget);
          } catch {
            /* Keep the literal fragment for ID matching. */
          }
          const referenceTarget =
            document.getElementById(target) ||
            Array.from(document.getElementsByName(target)).find(
              (element) => element.tagName.toLowerCase() === 'a'
            );
          if (!referenceTarget) return [href];
          const referenceContext = referenceTarget.closest('li') ?? referenceTarget;
          const hasExternalSourceLink = Array.from(
            referenceContext.querySelectorAll('a[href]')
          ).some((sourceLink) => {
            if (!isVisible(sourceLink)) return false;
            const rel = (sourceLink.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
            if (rel.includes('sponsored') || rel.includes('ugc')) return false;
            try {
              const sourceUrl = new URL(
                sourceLink.getAttribute('href') ?? '',
                window.location.href
              );
              return (
                ['http:', 'https:'].includes(sourceUrl.protocol) &&
                sourceUrl.origin !== window.location.origin
              );
            } catch {
              return false;
            }
          });
          if (hasExternalSourceLink) resolvedInlineCitationTargetsWithExternalLinks += 1;
          else resolvedInlineCitationTargetsWithoutExternalLinks += 1;
          return [];
        });
        const unresolvedInlineCitationTargetSamples = [...new Set(unresolvedInlineCitationTargets)];
        const unresolvedInlineCitationTargetSample = unresolvedInlineCitationTargetSamples
          .slice(0, 10)
          .map((href) => (href.length > 200 ? `${href.slice(0, 199)}…` : href));
        const hasCitationField = (value: unknown): boolean => {
          if (!value || typeof value !== 'object') return false;
          if (Array.isArray(value)) return value.some(hasCitationField);
          const record = value as Record<string, unknown>;
          return (
            Object.prototype.hasOwnProperty.call(record, 'citation') ||
            Object.values(record).some(hasCitationField)
          );
        };
        const jsonLdCitationFields = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]')
        ).filter((script) => {
          try {
            return hasCitationField(JSON.parse(script.textContent ?? 'null'));
          } catch {
            return false;
          }
        }).length;
        const sourceHostLinkCounts = new Map<string, number>();
        for (const { host } of externalLinks)
          sourceHostLinkCounts.set(host, (sourceHostLinkCounts.get(host) ?? 0) + 1);
        const rankedSourceHosts = [...sourceHostLinkCounts.entries()]
          .map(([host, links]) => ({ host, links }))
          .sort((left, right) => right.links - left.links || left.host.localeCompare(right.host));
        const sourceHosts = rankedSourceHosts.map(({ host }) => host);
        return {
          externalSourceLinkCount: externalLinks.length,
          uniqueSourceHosts: new Set(externalLinks.map(({ host }) => host)).size,
          descriptiveSourceLinkCount: externalLinks.filter(({ descriptive }) => descriptive).length,
          sourceHosts: sourceHosts.slice(0, 12),
          sourceHostListTruncated: sourceHosts.length > 12,
          sourceHostLinkCounts: rankedSourceHosts.slice(0, 12),
          sourceHostLinkCountsTruncated: rankedSourceHosts.length > 12,
          topSourceHostLinkSharePercent:
            externalLinks.length > 0
              ? Number(
                  (((rankedSourceHosts[0]?.links ?? 0) / externalLinks.length) * 100).toFixed(1)
                )
              : null,
          referenceSectionCount: referenceHeadings.length,
          referenceSectionLinkCount: referenceLinkCount,
          inlineCitationMarkerCount: inlineCitationLinks.length,
          resolvedInlineCitationTargetsWithExternalLinks,
          resolvedInlineCitationTargetsWithoutExternalLinks,
          unresolvedInlineCitationTargetCount: unresolvedInlineCitationTargets.length,
          unresolvedInlineCitationTargets: unresolvedInlineCitationTargetSample,
          unresolvedInlineCitationTargetsTruncated:
            unresolvedInlineCitationTargetSamples.length > 10 ||
            unresolvedInlineCitationTargetSamples.some((href) => href.length > 200),
          jsonLdBlocksWithCitationField: jsonLdCitationFields,
        };
      });

      return {
        ...this.pass(
          `Evidence profile: ${profile.externalSourceLinkCount} external source links across ${profile.uniqueSourceHosts} hosts; ${profile.referenceSectionLinkCount} links under reference headings; ${profile.unresolvedInlineCitationTargetCount} unresolved in-page citation target(s)`,
          {
            ...profile,
            interpretation:
              'Counts visible source and citation-shaped markup only. Aviary does not verify source quality, claim support, or citation eligibility.',
          }
        ),
        severity: 'info',
      };
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'Citation and evidence signals could not be profiled',
        details: { reason: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }
}
