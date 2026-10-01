import type { AviaryApiAuditRequest, AviaryApiJob, AviaryApiJobStatus } from './server';

export interface AviaryApiClientOptions {
  /** API origin, for example `http://127.0.0.1:3333`. */
  baseUrl: string;
  /** Bearer key when the server has authentication enabled. */
  apiKey?: string;
  /** Per-request network timeout. Defaults to 30 seconds. */
  requestTimeoutMs?: number;
  /** Injectable fetch implementation for Node.js or browser clients. */
  fetch?: typeof fetch;
}

export interface AviaryApiCreateJobResponse {
  id: string;
  status: AviaryApiJobStatus;
  revision: number;
  createdAt: string;
  links: { self: string };
}

export interface AviaryApiRequestOptions {
  signal?: AbortSignal;
}

export interface AviaryApiWaitOptions extends AviaryApiRequestOptions {
  /** Maximum time to poll before rejecting. Defaults to five minutes. */
  maxWaitMs?: number;
  /** Initial idle delay between polls. Defaults to one second. */
  pollIntervalMs?: number;
  /** Maximum delay reached by exponential backoff. Defaults to ten seconds. */
  maxPollIntervalMs?: number;
  onUpdate?: (job: AviaryApiJob) => void;
}

export interface AviaryApiProgressEvent {
  id: string;
  status: AviaryApiJobStatus;
  cancelRequested?: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  progress: { completedUrls: number; requestedUrls: number; lastUrl?: string };
  error?: string;
}

export interface AviaryApiStreamOptions extends AviaryApiRequestOptions {
  onUpdate?: (event: AviaryApiProgressEvent) => void;
}

export class AviaryApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly problem?: unknown,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'AviaryApiError';
  }
}

function abortError(): Error {
  const error = new Error('The Aviary API request was aborted.');
  error.name = 'AbortError';
  return error;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

function retryDelay(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - Date.now());
}

function problemMessage(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('detail' in value)) return undefined;
  return typeof value.detail === 'string' ? value.detail : undefined;
}

function isTerminal(status: AviaryApiJobStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function isProgressEvent(value: unknown): value is AviaryApiProgressEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Partial<AviaryApiProgressEvent>;
  return (
    typeof event.id === 'string' &&
    typeof event.status === 'string' &&
    ['queued', 'running', 'completed', 'failed', 'cancelled'].includes(event.status) &&
    (event.cancelRequested === undefined || typeof event.cancelRequested === 'boolean') &&
    typeof event.revision === 'number' &&
    Number.isInteger(event.revision) &&
    typeof event.createdAt === 'string' &&
    typeof event.updatedAt === 'string' &&
    typeof event.progress === 'object' &&
    event.progress !== null &&
    typeof event.progress.completedUrls === 'number' &&
    typeof event.progress.requestedUrls === 'number'
  );
}

/** Typed client for submitting, polling, waiting on, and cancelling Aviary audit jobs. */
export class AviaryApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly requestTimeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(options: AviaryApiClientOptions) {
    let base: URL;
    try {
      base = new URL(options.baseUrl);
    } catch {
      throw new Error('Aviary API baseUrl must be a valid HTTP or HTTPS URL.');
    }
    if (
      (base.protocol !== 'http:' && base.protocol !== 'https:') ||
      base.username ||
      base.password ||
      base.pathname !== '/' ||
      base.search ||
      base.hash
    ) {
      throw new Error(
        'Aviary API baseUrl must be an HTTP or HTTPS origin without credentials, a path, or a query.'
      );
    }
    this.baseUrl = base.origin;
    this.apiKey = options.apiKey;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    if (
      !Number.isInteger(this.requestTimeoutMs) ||
      this.requestTimeoutMs < 1 ||
      this.requestTimeoutMs > 2_147_483_647
    ) {
      throw new Error('requestTimeoutMs must be an integer from 1 to 2,147,483,647.');
    }
    if (this.apiKey && (this.apiKey.trim() !== this.apiKey || /[\r\n]/.test(this.apiKey))) {
      throw new Error('API keys cannot have surrounding whitespace or line breaks.');
    }
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async createAudit(
    request: AviaryApiAuditRequest,
    options: AviaryApiRequestOptions = {}
  ): Promise<AviaryApiCreateJobResponse> {
    return this.request<AviaryApiCreateJobResponse>(
      '/v1/audits',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
      options.signal
    );
  }

  async getAudit(id: string, options: AviaryApiRequestOptions = {}): Promise<AviaryApiJob> {
    return this.request<AviaryApiJob>(
      `/v1/audits/${encodeURIComponent(id)}`,
      { method: 'GET' },
      options.signal
    );
  }

  async cancelAudit(
    id: string,
    options: AviaryApiRequestOptions = {}
  ): Promise<AviaryApiJob | undefined> {
    return this.request<AviaryApiJob | undefined>(
      `/v1/audits/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      options.signal
    );
  }

  /** Consume Server-Sent Events until the server closes the progress stream. */
  async streamAudit(
    id: string,
    options: AviaryApiStreamOptions = {}
  ): Promise<AviaryApiProgressEvent | undefined> {
    if (options.signal?.aborted) throw abortError();
    const headers = new Headers({ Accept: 'text/event-stream' });
    if (this.apiKey) headers.set('Authorization', `Bearer ${this.apiKey}`);
    const response = await this.fetcher(
      new URL(`/v1/audits/${encodeURIComponent(id)}/events`, `${this.baseUrl}/`),
      { headers, signal: options.signal }
    );
    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = undefined;
      }
      throw new AviaryApiError(
        problemMessage(body) ?? `Aviary API returned HTTP ${response.status}.`,
        response.status,
        body,
        retryDelay(response)
      );
    }
    if (!response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream')) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('Aviary progress endpoint did not return a Server-Sent Events stream.');
    }
    if (!response.body) throw new Error('Aviary progress stream has no response body.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let latest: AviaryApiProgressEvent | undefined;
    let finished = false;
    const consume = (block: string): void => {
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n');
      if (!data) return;
      let value: unknown;
      try {
        value = JSON.parse(data);
      } catch {
        throw new Error('Aviary progress stream contained malformed JSON.');
      }
      if (!isProgressEvent(value))
        throw new Error('Aviary progress stream contained an invalid job update.');
      latest = value;
      options.onUpdate?.(value);
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          finished = true;
          buffer += decoder.decode();
          if (buffer.trim()) consume(buffer);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > 256 * 1024)
          throw new Error('Aviary progress event exceeded the 256 KiB buffer limit.');
        let separator: RegExpExecArray | null;
        while ((separator = /\r?\n\r?\n/.exec(buffer)) !== null) {
          consume(buffer.slice(0, separator.index));
          buffer = buffer.slice(separator.index + separator[0].length);
        }
      }
      return latest;
    } finally {
      if (!finished) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  /** Poll with bounded backoff until the job reaches a terminal state. */
  async waitForAudit(id: string, options: AviaryApiWaitOptions = {}): Promise<AviaryApiJob> {
    const maxWaitMs = options.maxWaitMs ?? 5 * 60_000;
    const initialDelay = options.pollIntervalMs ?? 1_000;
    const maxDelay = options.maxPollIntervalMs ?? 10_000;
    if (
      !Number.isInteger(maxWaitMs) ||
      maxWaitMs < 1 ||
      maxWaitMs > 2_147_483_647 ||
      !Number.isInteger(initialDelay) ||
      initialDelay < 1 ||
      initialDelay > 2_147_483_647 ||
      !Number.isInteger(maxDelay) ||
      maxDelay < initialDelay ||
      maxDelay > 2_147_483_647
    ) {
      throw new Error(
        'Polling timeout and intervals must be positive integers; maxPollIntervalMs must be at least pollIntervalMs.'
      );
    }

    const startedAt = Date.now();
    let delay = initialDelay;
    while (true) {
      if (options.signal?.aborted) throw abortError();
      try {
        const job = await this.getAudit(id, options);
        options.onUpdate?.(job);
        if (isTerminal(job.status)) return job;
      } catch (error) {
        if (!(error instanceof AviaryApiError) || (error.status !== 429 && error.status !== 503))
          throw error;
        delay = Math.max(delay, error.retryAfterMs ?? delay);
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed >= maxWaitMs)
        throw new Error(`Aviary audit ${id} did not finish within ${maxWaitMs} ms.`);
      await wait(Math.min(delay, maxWaitMs - elapsed), options.signal);
      delay = Math.min(maxDelay, Math.ceil(delay * 1.5));
    }
  }

  /** Submit a job and wait for its completed, failed, or cancelled result. */
  async audit(
    request: AviaryApiAuditRequest,
    options: AviaryApiWaitOptions = {}
  ): Promise<AviaryApiJob> {
    const created = await this.createAudit(request, options);
    return this.waitForAudit(created.id, options);
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    parentSignal?: AbortSignal
  ): Promise<T> {
    if (parentSignal?.aborted) throw abortError();
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    parentSignal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    const headers = new Headers(init.headers);
    if (this.apiKey) headers.set('Authorization', `Bearer ${this.apiKey}`);
    try {
      const response = await this.fetcher(new URL(path, `${this.baseUrl}/`), {
        ...init,
        headers,
        signal: controller.signal,
      });
      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = undefined;
        }
        throw new AviaryApiError(
          problemMessage(body) ?? `Aviary API returned HTTP ${response.status}.`,
          response.status,
          body,
          retryDelay(response)
        );
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof AviaryApiError) throw error;
      if (controller.signal.aborted) throw abortError();
      throw error;
    } finally {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', onAbort);
    }
  }
}
