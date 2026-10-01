import { describe, expect, it, vi } from 'vitest';
import { AviaryApiClient, AviaryApiError } from '../../src/api/client';

function jsonResponse(value: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), { status, headers });
}

function progressEvent(status: 'queued' | 'running' | 'completed' = 'running') {
  return {
    id: 'job-1',
    status,
    revision: 2,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:01.000Z',
    progress: { completedUrls: 1, requestedUrls: 2, lastUrl: 'https://example.com/' },
  };
}

describe('AviaryApiClient', () => {
  it('validates its origin, timeout, and API key configuration', () => {
    for (const baseUrl of [
      'not a URL',
      'file:///tmp/aviary',
      'https://user:password@example.com',
      'https://example.com/api',
      'https://example.com?token=x',
    ]) {
      expect(() => new AviaryApiClient({ baseUrl })).toThrow();
    }
    for (const requestTimeoutMs of [0, 1.5, -1, 2_147_483_648]) {
      expect(() => new AviaryApiClient({ baseUrl: 'http://localhost', requestTimeoutMs })).toThrow(
        'requestTimeoutMs'
      );
    }
    for (const apiKey of [' secret', 'secret ', 'secret\nvalue']) {
      expect(() => new AviaryApiClient({ baseUrl: 'http://localhost', apiKey })).toThrow(
        'API keys'
      );
    }
  });

  it('sends authenticated JSON requests and URL-encodes job identifiers', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      jsonResponse({
        id: 'job-1',
        status: 'queued',
        revision: 1,
        createdAt: 'now',
        links: { self: '/' },
      })
    );
    const injectedClient = new AviaryApiClient({
      baseUrl: 'https://api.example.com',
      apiKey: 'secret',
      fetch: fetcher,
    });
    await injectedClient.createAudit({ urls: ['https://example.com/'] });
    await injectedClient.getAudit('job/one');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [createUrl, createInit] = fetcher.mock.calls[0]!;
    expect(createUrl).toBeInstanceOf(URL);
    expect(createUrl).toHaveProperty('pathname', '/v1/audits');
    expect(new Headers(createInit?.headers).get('authorization')).toBe('Bearer secret');
    expect(JSON.parse(String(createInit?.body))).toEqual({ urls: ['https://example.com/'] });
    expect(fetcher.mock.calls[1]?.[0]).toHaveProperty('pathname', '/v1/audits/job%2Fone');
  });

  it('converts problem responses and Retry-After seconds into typed API errors', async () => {
    const client = new AviaryApiClient({
      baseUrl: 'http://localhost',
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ detail: 'Please retry shortly.' }, 503, { 'retry-after': '3' })
        ),
    });

    await expect(client.getAudit('job')).rejects.toMatchObject<AviaryApiError>({
      name: 'AviaryApiError',
      message: 'Please retry shortly.',
      status: 503,
      retryAfterMs: 3_000,
      problem: { detail: 'Please retry shortly.' },
    });
  });

  it('handles a 204 cancellation response and an already-aborted request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new AviaryApiClient({ baseUrl: 'http://localhost', fetch: fetcher });
    await expect(client.cancelAudit('job')).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('DELETE');

    const controller = new AbortController();
    controller.abort();
    await expect(client.getAudit('job', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('waits through transient overload and reports job updates until completion', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ detail: 'busy' }, 503))
      .mockResolvedValueOnce(jsonResponse(progressEvent('running')))
      .mockResolvedValueOnce(jsonResponse(progressEvent('completed')));
    const updates: string[] = [];
    const client = new AviaryApiClient({ baseUrl: 'http://localhost', fetch: fetcher });

    const job = await client.waitForAudit('job', {
      maxWaitMs: 2_000,
      pollIntervalMs: 1,
      maxPollIntervalMs: 2,
      onUpdate: (update) => updates.push(update.status),
    });

    expect(job.status).toBe('completed');
    expect(updates).toEqual(['running', 'completed']);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('streams progress across chunk boundaries and rejects malformed event data', async () => {
    const encoded = new TextEncoder().encode(`data: ${JSON.stringify(progressEvent())}\n\n`);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, 12));
        controller.enqueue(encoded.slice(12));
        controller.close();
      },
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(stream, { headers: { 'content-type': 'text/event-stream' } })
      );
    const updates: string[] = [];
    const client = new AviaryApiClient({ baseUrl: 'http://localhost', fetch: fetcher });
    await expect(
      client.streamAudit('job', { onUpdate: (event) => updates.push(event.status) })
    ).resolves.toMatchObject({ id: 'job-1', status: 'running' });
    expect(updates).toEqual(['running']);

    const invalidClient = new AviaryApiClient({
      baseUrl: 'http://localhost',
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response('data: {bad json}\n\n', { headers: { 'content-type': 'text/event-stream' } })
        ),
    });
    await expect(invalidClient.streamAudit('job')).rejects.toThrow('malformed JSON');
  });
});
