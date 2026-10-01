import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createAviaryApiApp, type AviaryApiOptions } from '../../src/api/server';

const servers: Server[] = [];

async function withApi(
  options: AviaryApiOptions,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const server = createServer(createAviaryApiApp(options));
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('API test server did not bind TCP.');
  await run(`http://127.0.0.1:${address.port}`);
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

describe('Aviary API server', () => {
  it('validates safe listener, queue, rate-limit, and audit-default settings', () => {
    expect(() => createAviaryApiApp({ host: '0.0.0.0' })).toThrow(/API key and TLS/);
    expect(() => createAviaryApiApp({ host: 'localhost ' })).toThrow(/hostname or IP address/);
    expect(() => createAviaryApiApp({ maxConcurrentJobs: 9 })).toThrow(/maxConcurrentJobs/);
    expect(() => createAviaryApiApp({ maxPendingJobs: -1 })).toThrow(/maxPendingJobs/);
    expect(() => createAviaryApiApp({ apiKey: 'short' })).toThrow(/at least 24 characters/);
    expect(() => createAviaryApiApp({ auditDefaults: { concurrency: 0 } })).toThrow(
      /auditDefaults\.concurrency/
    );
    expect(() =>
      createAviaryApiApp({ auditDefaults: { categories: ['unknown' as never] } })
    ).toThrow(/unknown category/);
  });

  it('serves a versioned health response, security headers, and the OpenAPI contract', async () => {
    await withApi({}, async (baseUrl) => {
      const health = await fetch(`${baseUrl}/health`);
      const body = (await health.json()) as Record<string, unknown>;
      const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
      expect(health.status).toBe(200);
      expect(body).toEqual({ status: 'ok', service: 'aviary-api', version });
      expect(health.headers.get('x-content-type-options')).toBe('nosniff');
      expect(health.headers.get('x-frame-options')).toBe('DENY');
      expect(health.headers.get('cache-control')).toBe('no-store');

      const openapi = await fetch(`${baseUrl}/openapi.yaml`);
      expect(openapi.status).toBe(200);
      expect(openapi.headers.get('content-type')).toContain('application/yaml');
      const openapiDocument = await openapi.text();
      expect(openapiDocument).toContain('/v1/audits');
      expect(openapiDocument).toContain(`  version: ${version}`);
    });
  });

  it('returns structured validation, missing-resource, and malformed-JSON problems', async () => {
    await withApi({}, async (baseUrl) => {
      const invalid = await fetch(`${baseUrl}/v1/audits`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(invalid.status).toBe(400);
      expect(invalid.headers.get('content-type')).toContain('application/problem+json');
      expect(await invalid.json()).toMatchObject({
        title: 'Invalid audit request',
        status: 400,
        instance: '/v1/audits',
      });

      const missing = await fetch(`${baseUrl}/v1/audits/missing`);
      expect(missing.status).toBe(404);
      expect(await missing.json()).toMatchObject({ title: 'Audit not found', status: 404 });

      const malformed = await fetch(`${baseUrl}/v1/audits`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad json',
      });
      expect(malformed.status).toBe(400);
      expect(await malformed.json()).toMatchObject({ title: 'Malformed JSON', status: 400 });
    });
  });

  it('requires a timing-safe bearer credential when API authentication is configured', async () => {
    const apiKey = 'aviary-test-key-that-is-at-least-24-chars';
    await withApi({ apiKey }, async (baseUrl) => {
      const denied = await fetch(`${baseUrl}/v1/audits/missing`);
      expect(denied.status).toBe(401);
      expect(denied.headers.get('www-authenticate')).toContain('Bearer');

      const allowed = await fetch(`${baseUrl}/v1/audits/missing`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      expect(allowed.status).toBe(404);
      expect(await allowed.json()).toMatchObject({ title: 'Audit not found' });
    });
  });

  it('returns rate-limit metadata and a retryable problem after the configured request budget', async () => {
    await withApi({ rateLimitRequests: 1 }, async (baseUrl) => {
      const first = await fetch(`${baseUrl}/v1/missing`);
      expect(first.status).toBe(404);
      expect(first.headers.get('x-ratelimit-limit')).toBe('1');
      expect(first.headers.get('x-ratelimit-remaining')).toBe('0');

      const limited = await fetch(`${baseUrl}/v1/missing`);
      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(await limited.json()).toMatchObject({ title: 'Too many requests', status: 429 });
    });
  });

  it('runs a loopback batch job through completion, streams its terminal update, and rejects late cancellation', async () => {
    const site = createServer((_request, response) => {
      response.setHeader('content-type', 'text/html');
      response.end(
        '<!doctype html><html><head><title>Local API test</title></head><body></body></html>'
      );
    });
    await new Promise<void>((resolve, reject) => {
      site.once('error', reject);
      site.listen(0, '127.0.0.1', () => {
        site.off('error', reject);
        resolve();
      });
    });
    const address = site.address();
    if (!address || typeof address === 'string') throw new Error('Test site did not bind TCP.');

    try {
      await withApi({ auditDefaults: { categories: [], timeout: 10_000 } }, async (baseUrl) => {
        const submitted = await fetch(`${baseUrl}/v1/audits`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ urls: [`http://127.0.0.1:${address.port}/`] }),
        });
        expect(submitted.status).toBe(202);
        const created = (await submitted.json()) as { id: string; status: string };
        expect(created.status).toMatch(/queued|running/);
        expect(submitted.headers.get('location')).toContain(`/v1/audits/${created.id}`);

        let job:
          | { status: string; progress: { completedUrls: number }; report?: { results: unknown[] } }
          | undefined;
        for (let attempt = 0; attempt < 300; attempt += 1) {
          const response = await fetch(`${baseUrl}/v1/audits/${created.id}`);
          job = (await response.json()) as typeof job;
          if (job?.status === 'completed' || job?.status === 'failed') break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(job?.status).toBe('completed');
        expect(job?.progress.completedUrls).toBe(1);
        expect(job?.report?.results).toHaveLength(1);

        const events = await fetch(`${baseUrl}/v1/audits/${created.id}/events`);
        expect(events.headers.get('content-type')).toContain('text/event-stream');
        expect(await events.text()).toContain('"status":"completed"');

        const cancelled = await fetch(`${baseUrl}/v1/audits/${created.id}`, { method: 'DELETE' });
        expect(cancelled.status).toBe(409);
        expect(await cancelled.json()).toMatchObject({ title: 'Audit cannot be cancelled' });
      });
    } finally {
      site.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        site.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
