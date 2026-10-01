import { describe, expect, it } from 'vitest';
import { parseRobotsTxtPolicy } from '../../src/robots';

describe('parseRobotsTxtPolicy', () => {
  it('matches paths and query strings while ignoring comments and blank directives', () => {
    const policy = parseRobotsTxtPolicy(
      'User-agent: *\nDisallow: /private # internal pages\nDisallow:\nAllow: /public'
    );

    expect(policy.allows(new URL('https://example.com/public'))).toBe(true);
    expect(policy.explain(new URL('https://example.com/private?tab=1'))).toMatchObject({
      allowed: false,
      matchedAgents: ['*'],
      matchedRule: { directive: 'disallow', pattern: '/private', line: 2 },
    });
    expect(policy.allows(new URL('https://example.com/elsewhere'))).toBe(true);
  });

  it('chooses the most-specific rule and prefers Allow for equally specific matches', () => {
    const policy = parseRobotsTxtPolicy(
      'User-agent: *\nDisallow: /docs\nAllow: /docs/public\nDisallow: /same\nAllow: /same'
    );

    expect(policy.allows(new URL('https://example.com/docs/private'))).toBe(false);
    expect(policy.explain(new URL('https://example.com/docs/public/page'))).toMatchObject({
      allowed: true,
      matchedRule: { directive: 'allow', pattern: '/docs/public' },
    });
    expect(policy.explain(new URL('https://example.com/same'))).toMatchObject({
      allowed: true,
      matchedRule: { directive: 'allow', pattern: '/same' },
    });
  });

  it('uses matching crawler-specific groups instead of the wildcard group', () => {
    const policy = parseRobotsTxtPolicy(
      'User-agent: *\nDisallow: /\nUser-agent: GPTBot\nAllow: /training-docs'
    );

    expect(policy.explain(new URL('https://example.com/page'), 'Googlebot')).toMatchObject({
      allowed: false,
      matchedAgents: ['*'],
    });
    expect(policy.explain(new URL('https://example.com/training-docs'), 'GPTBot')).toMatchObject({
      allowed: true,
      matchedAgents: ['gptbot'],
      matchedRule: { directive: 'allow' },
    });
    expect(policy.allows(new URL('https://example.com/robots.txt'), 'GPTBot')).toBe(true);
  });

  it('applies wildcard rules, end anchors, and percent normalization', () => {
    const policy = parseRobotsTxtPolicy(
      'User-agent: *\nDisallow: /private/*\nAllow: /private/public$\nDisallow: /café'
    );

    expect(policy.allows(new URL('https://example.com/private/public'))).toBe(true);
    expect(policy.allows(new URL('https://example.com/private/public/child'))).toBe(false);
    expect(policy.allows(new URL('https://example.com/private/hidden'))).toBe(false);
    expect(policy.allows(new URL('https://example.com/caf%C3%A9'))).toBe(false);
  });

  it('rejects local robots snapshots over the one-MiB cap', () => {
    expect(() => parseRobotsTxtPolicy(`User-agent: *\n${'x'.repeat(1024 * 1024)}`)).toThrow(
      'robots.txt snapshot exceeds the 1 MiB parsing limit.'
    );
  });
});
