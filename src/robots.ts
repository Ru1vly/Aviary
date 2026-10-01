export const AVIARY_CRAWLER_USER_AGENT =
  'Mozilla/5.0 (compatible; AviaryBot/0.1; +https://github.com/Ru1vly/Aviary)';
const AVIARY_ROBOTS_PRODUCT_TOKEN = 'aviarybot';
const ROBOTS_MAX_BYTES = 1024 * 1024;

interface RobotsRule {
  allow: boolean;
  pattern: string;
  matcher: RegExp;
  specificity: number;
  line: number;
}

interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  hasRules: boolean;
}

export interface RobotsDecision {
  allowed: boolean;
  matchedAgents: string[];
  matchedRule?: {
    directive: 'allow' | 'disallow';
    pattern: string;
    specificity: number;
    line: number;
  };
}

export interface RobotsPolicy {
  /** Evaluate one URL against the rules for a crawler product token. */
  allows(url: URL, userAgentToken?: string): boolean;
  /** Explain the selected user-agent groups and most-specific matching rule. */
  explain(url: URL, userAgentToken?: string): RobotsDecision;
  failureReason?: string;
}

function normalizeRobotsPath(value: string): string {
  let normalized = '';
  for (let index = 0; index < value.length;) {
    if (value[index] === '%' && /^[\da-f]{2}$/i.test(value.slice(index + 1, index + 3))) {
      const encoded = value.slice(index + 1, index + 3).toUpperCase();
      const byte = Number.parseInt(encoded, 16);
      const character = String.fromCharCode(byte);
      normalized += /^[a-z\d\-._~]$/i.test(character) ? character : `%${encoded}`;
      index += 3;
      continue;
    }
    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);
    if (codePoint > 0x7f) {
      normalized += [...Buffer.from(character, 'utf8')]
        .map((byte) => `%${byte.toString(16).padStart(2, '0').toUpperCase()}`)
        .join('');
    } else if (character === '%') {
      normalized += '%25';
    } else {
      // Use URI serialization for ASCII path/query characters that the URL
      // serializer percent-encodes (spaces, controls, brackets, and so on).
      // Keep `*` and the RFC 9309 `$` end marker intact in rule patterns.
      normalized += encodeURI(character);
    }
    index += character.length;
  }
  return normalized;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function createRule(allow: boolean, rawPattern: string, line: number): RobotsRule | undefined {
  const source = rawPattern.trim();
  if (!source.startsWith('/')) return undefined;
  const pattern = normalizeRobotsPath(source);
  const endAnchored = pattern.endsWith('$');
  const body = endAnchored ? pattern.slice(0, -1) : pattern;
  const expression = body.split('*').map(escapeRegularExpression).join('.*');
  return {
    allow,
    pattern,
    matcher: new RegExp(`^${expression}${endAnchored ? '$' : ''}`),
    specificity: Buffer.byteLength(body.replace(/\*/g, ''), 'utf8'),
    line,
  };
}

function parseRobotsPolicy(source: string): RobotsPolicy {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | undefined;

  for (const [lineIndex, rawLine] of source.split(/\r\n?|\n/).entries()) {
    const line = (rawLine.split('#', 1)[0] ?? '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      if (!current || current.hasRules) {
        current = { agents: [], rules: [], hasRules: false };
        groups.push(current);
      }
      if (value) current.agents.push(value.toLowerCase());
      continue;
    }
    if (field !== 'allow' && field !== 'disallow') continue;
    if (!current) continue;
    current.hasRules = true;
    if (!value) continue;
    const rule = createRule(field === 'allow', value, lineIndex + 1);
    if (rule) current.rules.push(rule);
  }

  const explain = (url: URL, userAgentToken = AVIARY_ROBOTS_PRODUCT_TOKEN): RobotsDecision => {
    const userAgent = userAgentToken.toLowerCase();
    const specificGroups = groups.filter(({ agents }) =>
      agents.some((agent) => agent !== '*' && userAgent.includes(agent))
    );
    const selectedGroups =
      specificGroups.length > 0
        ? specificGroups
        : groups.filter(({ agents }) => agents.includes('*'));
    const rules = selectedGroups.flatMap(({ rules: groupRules }) => groupRules);
    const requestTarget = normalizeRobotsPath(`${url.pathname}${url.search}`);
    const matchedAgents = [...new Set(selectedGroups.flatMap(({ agents }) => agents))];
    if (requestTarget === '/robots.txt') return { allowed: true, matchedAgents };
    let bestSpecificity = -1;
    let bestAllow = true;
    let matchedRule: RobotsRule | undefined;
    for (const rule of rules) {
      if (!rule.matcher.test(requestTarget)) continue;
      if (rule.specificity > bestSpecificity) {
        bestSpecificity = rule.specificity;
        bestAllow = rule.allow;
        matchedRule = rule;
      } else if (rule.specificity === bestSpecificity && rule.allow) {
        bestAllow = true;
        matchedRule = rule;
      }
    }
    return {
      allowed: bestAllow,
      matchedAgents,
      ...(matchedRule
        ? {
            matchedRule: {
              directive: matchedRule.allow ? ('allow' as const) : ('disallow' as const),
              pattern: matchedRule.pattern,
              specificity: matchedRule.specificity,
              line: matchedRule.line,
            },
          }
        : {}),
    };
  };

  return {
    explain,
    allows(url, userAgentToken = AVIARY_ROBOTS_PRODUCT_TOKEN) {
      return explain(url, userAgentToken).allowed;
    },
  };
}

/** Parse a local robots.txt snapshot into an explainable, pure path policy. */
export function parseRobotsTxtPolicy(source: string): RobotsPolicy {
  if (Buffer.byteLength(source, 'utf8') > ROBOTS_MAX_BYTES) {
    throw new Error('robots.txt snapshot exceeds the 1 MiB parsing limit.');
  }
  return parseRobotsPolicy(source);
}

function policyFailure(reason: string): RobotsPolicy {
  return {
    allows: () => false,
    explain: () => ({ allowed: false, matchedAgents: [] }),
    failureReason: reason,
  };
}

async function readRobotsBody(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const available = ROBOTS_MAX_BYTES - byteLength;
      if (available <= 0) {
        await reader.cancel();
        break;
      }
      const piece = value.byteLength > available ? value.subarray(0, available) : value;
      chunks.push(piece);
      byteLength += piece.byteLength;
      if (piece.byteLength < value.byteLength || byteLength >= ROBOTS_MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }
    return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
}

/** Fetch one robots policy for a crawl, failing closed for server/network errors. */
export async function fetchRobotsPolicy(
  origin: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<RobotsPolicy> {
  if (signal?.aborted) throw new Error('Page discovery was cancelled.');
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timeout = setTimeout(onAbort, timeoutMs);
  let currentUrl = new URL('/robots.txt', origin);

  try {
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      const response = await fetch(currentUrl, {
        headers: {
          accept: 'text/plain, */*;q=0.1',
          'user-agent': AVIARY_CRAWLER_USER_AGENT,
        },
        redirect: 'manual',
        signal: controller.signal,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel().catch(() => undefined);
        if (!location || redirectCount === 5)
          return policyFailure('robots.txt exceeded the five-redirect limit');
        let destination: URL;
        try {
          destination = new URL(location, currentUrl);
        } catch {
          return policyFailure('robots.txt returned an invalid redirect URL');
        }
        if (
          (destination.protocol !== 'http:' && destination.protocol !== 'https:') ||
          destination.username ||
          destination.password
        ) {
          return policyFailure('robots.txt redirected to an invalid URL');
        }
        currentUrl = destination;
        continue;
      }
      if (response.status >= 400 && response.status < 500) {
        await response.body?.cancel().catch(() => undefined);
        return {
          allows: () => true,
          explain: () => ({ allowed: true, matchedAgents: [] }),
        };
      }
      if (response.status >= 500 || !response.ok) {
        await response.body?.cancel().catch(() => undefined);
        return policyFailure(`robots.txt returned HTTP ${response.status}`);
      }
      return parseRobotsPolicy(await readRobotsBody(response));
    }
    return policyFailure('robots.txt redirect limit was exceeded');
  } catch (error) {
    if (signal?.aborted) throw new Error('Page discovery was cancelled.');
    if (controller.signal.aborted)
      return policyFailure(`robots.txt request timed out after ${timeoutMs} ms`);
    const message = error instanceof Error ? error.message : String(error);
    return policyFailure(`robots.txt could not be reached: ${message}`);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}
