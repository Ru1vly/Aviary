import { BaseChecker, CheckOutcome } from './base';

export class SecurityChecker extends BaseChecker {
  protected checks() {
    return [
      { id: 'https-enabled', run: () => this.checkHTTPS() },
      { id: 'mixed-content-check', run: () => this.checkMixedContent() },
      { id: 'security-headers', run: () => this.checkSecurityHeaders() },
    ];
  }

  private async checkHTTPS(): Promise<CheckOutcome> {
    const url = new URL(this.page.url());

    if (url.protocol === 'https:') {
      return this.pass('Site is using HTTPS (secure connection)', { protocol: url.protocol });
    } else {
      return this.fail('Site is not using HTTPS - this negatively impacts SEO and user trust', {
        protocol: url.protocol,
      });
    }
  }

  private async checkMixedContent(): Promise<CheckOutcome> {
    const url = new URL(this.page.url());

    if (url.protocol !== 'https:') {
      return this.pass('Mixed content check skipped (not HTTPS)');
    }

    try {
      // Check for HTTP resources on HTTPS page
      const mixedContent = await this.page.evaluate(() => {
        const resources = new Map<string, string>();
        const addIfInsecure = (value: string | null | undefined, source: string): void => {
          if (!value) return;
          try {
            const resolved = new URL(value, window.location.href);
            if (resolved.protocol === 'http:' && !resources.has(resolved.href)) {
              resources.set(resolved.href, `${source}: ${resolved.href}`);
            }
          } catch {
            // Ignore invalid resource URLs; other audit checks report malformed markup.
          }
        };

        // Include resources the browser attempted to load, such as fonts and CSS background images.
        const loadedResources = performance.getEntriesByType(
          'resource'
        ) as PerformanceResourceTiming[];
        for (const resource of loadedResources) {
          addIfInsecure(resource.name, `Loaded ${resource.initiatorType || 'browser'} resource`);
        }

        // Also inspect markup directly because browsers can block mixed-content requests before
        // they appear in the Resource Timing buffer.
        const elements = document.querySelectorAll(
          'img[src],script[src],iframe[src],frame[src],audio[src],video[src],video[poster],source[src],track[src],object[data],embed[src],link[href]'
        );
        const labelByTag: Record<string, string> = {
          img: 'Image',
          script: 'Script',
          iframe: 'Frame',
          frame: 'Frame',
          audio: 'Audio',
          video: 'Video',
          source: 'Media source',
          track: 'Media track',
          object: 'Object',
          embed: 'Embedded resource',
          link: 'Linked resource',
        };
        for (const element of Array.from(elements)) {
          const tag = element.tagName.toLowerCase();
          if (tag === 'link') {
            const rel = (element.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
            if (
              !rel.some((token) =>
                [
                  'stylesheet',
                  'icon',
                  'apple-touch-icon',
                  'preload',
                  'modulepreload',
                  'prefetch',
                  'manifest',
                ].includes(token)
              )
            )
              continue;
          }

          const label = labelByTag[tag] ?? 'Resource';
          const attributes =
            tag === 'object'
              ? ['data']
              : tag === 'video'
                ? ['src', 'poster']
                : [tag === 'link' ? 'href' : 'src'];
          for (const attribute of attributes) {
            addIfInsecure(element.getAttribute(attribute), label);
          }
          if (tag === 'img') {
            addIfInsecure((element as HTMLImageElement).currentSrc, label);
          }
        }

        return [...resources.values()];
      });

      if (mixedContent.length > 0) {
        return this.fail(
          `Found ${mixedContent.length} mixed content resources (HTTP on HTTPS page)`,
          {
            mixedContent: mixedContent.slice(0, 10), // First 10
            total: mixedContent.length,
          }
        );
      }

      return this.pass('No mixed content detected');
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'Mixed content check skipped due to error',
      };
    }
  }

  private async checkSecurityHeaders(): Promise<CheckOutcome> {
    try {
      if (!this.response) {
        return this.fail('Could not check security headers - no response available');
      }

      const headers = this.response.headers();
      const securityHeaders = {
        'strict-transport-security': headers['strict-transport-security'],
        'x-content-type-options': headers['x-content-type-options'],
        'x-frame-options': headers['x-frame-options'],
        'content-security-policy': headers['content-security-policy'],
      };
      const presentHeaders = Object.entries(securityHeaders).filter(([_, value]) =>
        Boolean(value?.trim())
      );
      const absentHeaders = Object.entries(securityHeaders)
        .filter(([_, value]) => !value?.trim())
        .map(([key]) => key);
      const invalidHeaders: string[] = [];
      const diagnostics: string[] = [];
      const compensatingControls: string[] = [];

      const hsts = securityHeaders['strict-transport-security'] ?? '';
      const hstsMaxAgeDirectives = hsts
        .split(';')
        .map((directive) => directive.trim())
        .filter((directive) => /^max-age\s*=/i.test(directive));
      const parsedHstsMaxAge =
        hstsMaxAgeDirectives.length === 1
          ? /^max-age\s*=\s*(\d+)$/i.exec(hstsMaxAgeDirectives[0] ?? '')
          : null;
      if (hsts && (!parsedHstsMaxAge || Number(parsedHstsMaxAge[1]) <= 0)) {
        invalidHeaders.push('strict-transport-security');
        diagnostics.push('HSTS must contain exactly one positive max-age value.');
      }

      const contentTypeOptions = securityHeaders['x-content-type-options']?.trim().toLowerCase();
      if (contentTypeOptions && contentTypeOptions !== 'nosniff') {
        invalidHeaders.push('x-content-type-options');
        diagnostics.push('X-Content-Type-Options must be "nosniff".');
      }

      const csp = securityHeaders['content-security-policy']?.trim();
      let cspIsWellFormed = false;
      let cspHasFrameAncestors = false;
      if (csp) {
        const directives = csp
          .split(';')
          .map((directive) => directive.trim())
          .filter(Boolean);
        cspIsWellFormed =
          directives.length > 0 &&
          directives.every((directive) => /^[a-z][\w-]*(?:\s+.*)?$/i.test(directive));
        if (!cspIsWellFormed) {
          invalidHeaders.push('content-security-policy');
          diagnostics.push('Content-Security-Policy must contain well-formed directives.');
        } else {
          cspHasFrameAncestors = directives.some((directive) =>
            /^frame-ancestors(?:\s|$)/i.test(directive)
          );
        }
      }

      const frameOptions = securityHeaders['x-frame-options']?.trim().toLowerCase();
      if (frameOptions && frameOptions !== 'deny' && frameOptions !== 'sameorigin') {
        invalidHeaders.push('x-frame-options');
        diagnostics.push('X-Frame-Options must be "DENY" or "SAMEORIGIN".');
      }
      if (cspHasFrameAncestors && !frameOptions) {
        compensatingControls.push('x-frame-options protected by CSP frame-ancestors');
        diagnostics.push(
          'CSP frame-ancestors provides framing protection without X-Frame-Options.'
        );
      }

      if (!csp && headers['content-security-policy-report-only']?.trim()) {
        diagnostics.push(
          'Content-Security-Policy-Report-Only reports violations but does not enforce a policy.'
        );
      }

      const missingHeaders = absentHeaders.filter(
        (name) => name !== 'x-frame-options' || !cspHasFrameAncestors
      );

      if (missingHeaders.length === 0 && invalidHeaders.length === 0) {
        return this.pass('Important security headers are present and their values are valid', {
          headers: securityHeaders,
          diagnostics,
          compensatingControls,
        });
      } else {
        const issues = [
          ...(missingHeaders.length ? [`${missingHeaders.length} missing`] : []),
          ...(invalidHeaders.length ? [`${invalidHeaders.length} misconfigured`] : []),
        ];
        return this.fail(`Security headers need attention: ${issues.join(', ')}`, {
          present: presentHeaders.map(([key]) => key),
          missing: missingHeaders,
          invalid: invalidHeaders,
          diagnostics,
          compensatingControls,
          headers: securityHeaders,
        });
      }
    } catch (error) {
      return {
        passed: false,
        severity: 'info',
        message: 'Security headers check skipped due to error',
      };
    }
  }
}
