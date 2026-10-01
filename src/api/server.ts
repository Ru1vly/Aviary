import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server } from 'node:http';
import {
  createServer as createHttpsServer,
  type ServerOptions as HttpsServerOptions,
} from 'node:https';
import { resolve } from 'node:path';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import { z } from 'zod';
import { auditUrls } from '../index';
import { discoverLinkedUrls, discoverSitemapUrls, filterUrlsByRobotsTxt } from '../crawler';
import { AVIARY_CRAWLER_USER_AGENT } from '../robots';
import { CHECKER_REGISTRY, type CheckerKey } from '../checkers/registry';
import type { SEOAuditBatchOptions, SEOAuditBatchReport } from '../types';

const CATEGORY_KEYS = CHECKER_REGISTRY.map(({ key }) => key) as [CheckerKey, ...CheckerKey[]];
const API_PREFIX = '/v1';
function packageVersion(): string {
  try {
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, '../../package.json'), 'utf8')
    ) as { version?: unknown };
    return typeof packageJson.version === 'string' ? packageJson.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

const PACKAGE_VERSION = packageVersion();
const appShutdownHandlers = new WeakMap<express.Express, () => Promise<void>>();
const serverShutdownHandlers = new WeakMap<Server, () => Promise<void>>();
const serverStopPromises = new WeakMap<Server, Promise<void>>();

export type AviaryApiJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AviaryApiJobProgress {
  completedUrls: number;
  requestedUrls: number;
  lastUrl?: string;
}

export interface AviaryApiJob {
  id: string;
  status: AviaryApiJobStatus;
  /** True after an accepted DELETE while the job is queued or running. */
  cancelRequested?: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  progress: AviaryApiJobProgress;
  report?: SEOAuditBatchReport;
  error?: string;
}

export interface AviaryApiTlsOptions {
  key: HttpsServerOptions['key'];
  cert: HttpsServerOptions['cert'];
}

type AuditDefaults = Omit<SEOAuditBatchOptions, 'onProgress' | 'signal'>;

export interface AviaryApiOptions {
  /** Bind address. Defaults to AVIARY_API_HOST or 127.0.0.1. */
  host?: string;
  /** Listen port. Defaults to AVIARY_API_PORT or 3333. */
  port?: number;
  /** Bearer token. Defaults to AVIARY_API_KEY when set. */
  apiKey?: string;
  /** TLS certificate and private key. Required with apiKey for non-loopback binds. */
  tls?: AviaryApiTlsOptions;
  /** Maximum URLs accepted per batch job. Defaults to 100, maximum 1,000. */
  maxBatchUrls?: number;
  /** Maximum simultaneous batch jobs. Defaults to 2, maximum 8. */
  maxConcurrentJobs?: number;
  /** Maximum jobs waiting for a worker. Defaults to 10, maximum 100. */
  maxPendingJobs?: number;
  /** Maximum job records retained in memory. Defaults to 100, maximum 10,000. */
  maxStoredJobs?: number;
  /** Requests allowed per IP in each fixed window. Defaults to 60 per minute. */
  rateLimitRequests?: number;
  rateLimitWindowMs?: number;
  /** Defaults shared by jobs; per-request concurrency, categories, timeout, and preset remain validated. */
  auditDefaults?: AuditDefaults;
}

interface AviaryApiAuditOptions {
  concurrency?: number;
  timeout?: number;
  navigationWaitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
  settleAfterNavigationMs?: number;
  categories?: CheckerKey[];
  preset?: 'basic' | 'advanced' | 'strict' | 'geo';
}

export type AviaryApiAuditRequest = AviaryApiAuditOptions &
  (
    | {
        urls: string[];
        sitemap?: never;
        crawl?: never;
        maxUrls?: never;
        maxDepth?: never;
        maxPageBytes?: never;
        maxTotalBytes?: never;
      }
    | {
        sitemap: string;
        crawl?: never;
        maxUrls?: number;
        maxDepth?: never;
        maxPageBytes?: never;
        maxTotalBytes?: never;
        urls?: never;
      }
    | {
        crawl: string;
        sitemap?: never;
        maxUrls?: number;
        maxDepth?: number;
        maxPageBytes?: number;
        maxTotalBytes?: number;
        urls?: never;
      }
  );

interface RateLimitBucket {
  startedAt: number;
  count: number;
}

function loopbackHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function configuredInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function validApiKey(candidate: string | undefined, expected: string): boolean {
  if (!candidate) return false;
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return (
    candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes)
  );
}

function problem(
  res: Response,
  status: number,
  title: string,
  detail: string,
  instance: string
): void {
  res.status(status).type('application/problem+json').json({
    type: 'about:blank',
    title,
    status,
    detail,
    instance,
  });
}

function snapshot(job: AviaryApiJob): AviaryApiJob {
  return {
    id: job.id,
    status: job.status,
    ...(job.cancelRequested ? { cancelRequested: true } : {}),
    revision: job.revision,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    progress: { ...job.progress },
    ...(job.report ? { report: job.report } : {}),
    ...(job.error ? { error: job.error } : {}),
  };
}

function withoutInlineScreenshots(batch: SEOAuditBatchReport): SEOAuditBatchReport {
  return {
    ...batch,
    results: batch.results.map((result) => {
      if (result.status !== 'complete') return result;
      const heatmap = result.report.checks.heatmap.map((check) => {
        if (!check.details || typeof check.details.screenshot !== 'string') return check;
        const { screenshot: _screenshot, ...details } = check.details;
        return { ...check, details };
      });
      return {
        ...result,
        report: {
          ...result.report,
          checks: { ...result.report.checks, heatmap },
        },
      };
    }),
  };
}

function normalizeOptions(options: AviaryApiOptions) {
  const host = options.host ?? process.env.AVIARY_API_HOST ?? '127.0.0.1';
  const port = options.port ?? configuredInteger('AVIARY_API_PORT', 3333, 1, 65_535);
  const maxBatchUrls =
    options.maxBatchUrls ?? configuredInteger('AVIARY_API_MAX_BATCH_URLS', 100, 1, 1_000);
  const maxConcurrentJobs =
    options.maxConcurrentJobs ?? configuredInteger('AVIARY_API_MAX_CONCURRENT_JOBS', 2, 1, 8);
  const maxPendingJobs =
    options.maxPendingJobs ?? configuredInteger('AVIARY_API_MAX_PENDING_JOBS', 10, 0, 100);
  const maxStoredJobs =
    options.maxStoredJobs ?? configuredInteger('AVIARY_API_MAX_STORED_JOBS', 100, 1, 10_000);
  const rateLimitRequests =
    options.rateLimitRequests ??
    configuredInteger('AVIARY_API_RATE_LIMIT_REQUESTS', 60, 1, 100_000);
  const rateLimitWindowMs =
    options.rateLimitWindowMs ??
    configuredInteger('AVIARY_API_RATE_LIMIT_WINDOW_MS', 60_000, 1_000, 86_400_000);
  const apiKey = options.apiKey ?? process.env.AVIARY_API_KEY;
  const auditDefaults = options.auditDefaults ?? {};

  if (!host.trim() || host.trim() !== host) {
    throw new Error(
      'Aviary API host must be a non-empty hostname or IP address without surrounding whitespace.'
    );
  }

  const bounds: Array<[string, number, number, number]> = [
    ['port', port, 1, 65_535],
    ['maxBatchUrls', maxBatchUrls, 1, 1_000],
    ['maxConcurrentJobs', maxConcurrentJobs, 1, 8],
    ['maxPendingJobs', maxPendingJobs, 0, 100],
    ['maxStoredJobs', maxStoredJobs, 1, 10_000],
    ['rateLimitRequests', rateLimitRequests, 1, 100_000],
    ['rateLimitWindowMs', rateLimitWindowMs, 1_000, 86_400_000],
  ];
  for (const [name, value, min, max] of bounds) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${name} must be an integer from ${min} to ${max}.`);
    }
  }
  if (
    auditDefaults.concurrency !== undefined &&
    (!Number.isInteger(auditDefaults.concurrency) ||
      auditDefaults.concurrency < 1 ||
      auditDefaults.concurrency > 8)
  ) {
    throw new Error('auditDefaults.concurrency must be an integer from 1 to 8.');
  }
  if (
    auditDefaults.timeout !== undefined &&
    (!Number.isInteger(auditDefaults.timeout) ||
      auditDefaults.timeout < 1 ||
      auditDefaults.timeout > 2_147_483_647)
  ) {
    throw new Error(
      'auditDefaults.timeout must be a positive integer no greater than 2,147,483,647.'
    );
  }
  if (
    auditDefaults.navigationWaitUntil !== undefined &&
    !['domcontentloaded', 'load', 'networkidle'].includes(auditDefaults.navigationWaitUntil)
  ) {
    throw new Error(
      'auditDefaults.navigationWaitUntil must be domcontentloaded, load, or networkidle.'
    );
  }
  if (
    auditDefaults.settleAfterNavigationMs !== undefined &&
    (!Number.isInteger(auditDefaults.settleAfterNavigationMs) ||
      auditDefaults.settleAfterNavigationMs < 0 ||
      auditDefaults.settleAfterNavigationMs > 30_000)
  ) {
    throw new Error('auditDefaults.settleAfterNavigationMs must be an integer from 0 to 30000.');
  }
  if (
    auditDefaults.viewport &&
    (!Number.isInteger(auditDefaults.viewport.width) ||
      auditDefaults.viewport.width < 1 ||
      !Number.isInteger(auditDefaults.viewport.height) ||
      auditDefaults.viewport.height < 1)
  ) {
    throw new Error('auditDefaults.viewport width and height must be positive integers.');
  }
  const knownCategories = new Set<string>(CATEGORY_KEYS);
  const invalidCategories =
    auditDefaults.categories?.filter((category) => !knownCategories.has(category)) ?? [];
  if (invalidCategories.length > 0) {
    throw new Error(
      `auditDefaults contains unknown category key(s): ${invalidCategories.join(', ')}.`
    );
  }
  if (!loopbackHost(host) && (!apiKey || !options.tls?.key || !options.tls.cert)) {
    throw new Error('Non-loopback Aviary API binds require an API key and TLS key/certificate.');
  }
  if (
    apiKey !== undefined &&
    (apiKey.length < 24 || apiKey.trim() !== apiKey || /[\r\n]/.test(apiKey))
  ) {
    throw new Error(
      'Aviary API keys must be at least 24 characters long, have no surrounding whitespace, and contain no line breaks.'
    );
  }

  return {
    host,
    port,
    apiKey,
    maxBatchUrls,
    maxConcurrentJobs,
    maxPendingJobs,
    maxStoredJobs,
    rateLimitRequests,
    rateLimitWindowMs,
    auditDefaults,
  };
}

/** Create the versioned Express app. Use startAviaryApiServer() for listener policy enforcement. */
export function createAviaryApiApp(options: AviaryApiOptions = {}): express.Express {
  const config = normalizeOptions(options);
  const app = express();
  const jobs = new Map<string, AviaryApiJob>();
  const requests = new Map<string, RateLimitBucket>();
  const queue: Array<{ id: string; input: AviaryApiAuditRequest }> = [];
  const jobControllers = new Map<string, AbortController>();
  const activeJobRuns = new Set<Promise<void>>();
  let activeJobs = 0;
  let shuttingDown = false;
  let appShutdownPromise: Promise<void> | undefined;
  const eventClients = new Map<string, Set<Response>>();
  const eventTimers = new Map<Response, ReturnType<typeof setInterval>>();
  let activeEventStreams = 0;
  let openApiDocument: string | undefined;
  try {
    openApiDocument = readFileSync(resolve(__dirname, '../../docs/openapi.yaml'), 'utf8').replace(
      /^  version: .+$/m,
      `  version: ${PACKAGE_VERSION}`
    );
  } catch {
    // Source-only or custom deployments may omit the optional packaged spec.
  }

  const urlSchema = z
    .string()
    .max(2_048)
    .url()
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
        );
      } catch {
        return false;
      }
    }, 'URLs must use HTTP or HTTPS and must not contain credentials.');
  const sitemapSchema = z
    .string()
    .max(2_048)
    .url()
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
        );
      } catch {
        return false;
      }
    }, 'Sitemap URL must use HTTP or HTTPS and must not contain credentials.');
  const auditSchema = z
    .object({
      urls: z.array(urlSchema).min(1).max(config.maxBatchUrls).optional(),
      sitemap: sitemapSchema.optional(),
      crawl: urlSchema.optional(),
      maxUrls: z.number().int().min(1).max(config.maxBatchUrls).optional(),
      maxDepth: z.number().int().min(0).max(32).optional(),
      maxPageBytes: z
        .number()
        .int()
        .min(1)
        .max(10 * 1024 * 1024)
        .optional(),
      maxTotalBytes: z
        .number()
        .int()
        .min(1)
        .max(1024 * 1024 * 1024)
        .optional(),
      concurrency: z.number().int().min(1).max(8).optional(),
      timeout: z.number().int().min(1).max(300_000).optional(),
      navigationWaitUntil: z.enum(['domcontentloaded', 'load', 'networkidle']).optional(),
      settleAfterNavigationMs: z.number().int().min(0).max(30_000).optional(),
      categories: z.array(z.enum(CATEGORY_KEYS)).max(CATEGORY_KEYS.length).optional(),
      preset: z.enum(['basic', 'advanced', 'strict', 'geo']).optional(),
    })
    .strict()
    .superRefine(
      (
        { urls, sitemap, crawl, maxUrls, maxDepth, maxPageBytes, maxTotalBytes, categories },
        context
      ) => {
        if ([urls, sitemap, crawl].filter(Boolean).length !== 1) {
          context.addIssue({
            code: 'custom',
            path: [],
            message: 'Provide exactly one of urls, sitemap, or crawl.',
          });
        }
        if (!sitemap && !crawl && maxUrls !== undefined) {
          context.addIssue({
            code: 'custom',
            path: ['maxUrls'],
            message: 'maxUrls can only be used with sitemap or crawl discovery.',
          });
        }
        if (!crawl && maxDepth !== undefined) {
          context.addIssue({
            code: 'custom',
            path: ['maxDepth'],
            message: 'maxDepth can only be used with crawl.',
          });
        }
        if (!crawl && maxPageBytes !== undefined) {
          context.addIssue({
            code: 'custom',
            path: ['maxPageBytes'],
            message: 'maxPageBytes can only be used with crawl.',
          });
        }
        if (!crawl && maxTotalBytes !== undefined) {
          context.addIssue({
            code: 'custom',
            path: ['maxTotalBytes'],
            message: 'maxTotalBytes can only be used with crawl.',
          });
        }
        const normalized = (urls ?? []).flatMap((value) => {
          try {
            const url = new URL(value);
            url.hash = '';
            return [url.href];
          } catch {
            return [];
          }
        });
        if (new Set(normalized).size !== normalized.length) {
          context.addIssue({
            code: 'custom',
            path: ['urls'],
            message: 'Duplicate URLs are not allowed in a batch.',
          });
        }
        if (categories && new Set(categories).size !== categories.length) {
          context.addIssue({
            code: 'custom',
            path: ['categories'],
            message: 'Duplicate categories are not allowed.',
          });
        }
      }
    );

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');
    if (options.tls)
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', service: 'aviary-api', version: PACKAGE_VERSION })
  );
  app.get('/openapi.yaml', (req, res) => {
    if (!openApiDocument)
      return problem(
        res,
        404,
        'OpenAPI document unavailable',
        'This installation does not include the API contract file.',
        req.path
      );
    res.type('application/yaml').send(openApiDocument);
  });

  app.use(API_PREFIX, (req, res, next) => {
    if (shuttingDown) {
      return problem(
        res,
        503,
        'Server is shutting down',
        'Submit the audit again after the API server restarts.',
        req.path
      );
    }
    next();
  });

  app.use(API_PREFIX, (req, res, next) => {
    const now = Date.now();
    for (const [address, bucket] of requests) {
      if (now - bucket.startedAt >= config.rateLimitWindowMs) requests.delete(address);
    }
    const address = req.socket.remoteAddress ?? 'unknown';
    const bucket = requests.get(address);
    if (!bucket || now - bucket.startedAt >= config.rateLimitWindowMs) {
      if (!bucket && requests.size >= 10_000) {
        res.setHeader('Retry-After', String(Math.ceil(config.rateLimitWindowMs / 1_000)));
        return problem(
          res,
          503,
          'Rate limit capacity reached',
          'Retry after active rate-limit windows expire.',
          req.path
        );
      }
      requests.set(address, { startedAt: now, count: 1 });
      res.setHeader('X-RateLimit-Limit', String(config.rateLimitRequests));
      res.setHeader('X-RateLimit-Remaining', String(config.rateLimitRequests - 1));
      res.setHeader(
        'X-RateLimit-Reset',
        String(Math.ceil((now + config.rateLimitWindowMs) / 1_000))
      );
      return next();
    }
    bucket.count += 1;
    const remaining = Math.max(0, config.rateLimitRequests - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(config.rateLimitRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil((bucket.startedAt + config.rateLimitWindowMs) / 1_000))
    );
    if (bucket.count > config.rateLimitRequests) {
      const retryAfter = Math.max(
        1,
        Math.ceil((config.rateLimitWindowMs - (now - bucket.startedAt)) / 1_000)
      );
      res.setHeader('Retry-After', String(retryAfter));
      return problem(
        res,
        429,
        'Too many requests',
        'The request limit for this client has been reached.',
        req.path
      );
    }
    next();
  });

  if (config.apiKey) {
    app.use(API_PREFIX, (req, res, next) => {
      const authorization = req.get('authorization') ?? '';
      const match = /^Bearer\s+(.+)$/i.exec(authorization);
      if (!validApiKey(match?.[1], config.apiKey!)) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="aviary-api"');
        return problem(res, 401, 'Unauthorized', 'A valid bearer token is required.', req.path);
      }
      next();
    });
  }

  app.use(API_PREFIX, express.json({ limit: 3 * 1024 * 1024, strict: true }));

  const sendJob = (res: Response, job: AviaryApiJob): void => {
    res.json(snapshot(job));
  };

  const closeEventStream = (response: Response): void => {
    const timer = eventTimers.get(response);
    if (!timer) return;
    clearInterval(timer);
    eventTimers.delete(response);
    for (const [jobId, clients] of eventClients) {
      if (!clients.delete(response)) continue;
      if (clients.size === 0) eventClients.delete(jobId);
      activeEventStreams -= 1;
      break;
    }
  };

  const notifyJob = (job: AviaryApiJob): void => {
    job.revision += 1;
    const clients = eventClients.get(job.id);
    if (!clients) return;
    const event = {
      id: job.id,
      status: job.status,
      ...(job.cancelRequested ? { cancelRequested: true } : {}),
      revision: job.revision,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      progress: job.progress,
      ...(job.error ? { error: job.error } : {}),
    };
    const encoded = JSON.stringify(event);
    for (const response of [...clients]) {
      try {
        response.write(`id: ${job.revision}\nevent: update\ndata: ${encoded}\n\n`);
      } catch {
        closeEventStream(response);
        continue;
      }
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        response.end();
        closeEventStream(response);
      }
    }
  };

  const sweepJobs = (): void => {
    const expiration = Date.now() - 60 * 60 * 1_000;
    for (const [id, job] of jobs) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        Date.parse(job.updatedAt) < expiration
      ) {
        jobs.delete(id);
      }
    }
    if (jobs.size >= config.maxStoredJobs) {
      const terminal = [...jobs.values()]
        .filter(
          (job) =>
            job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'
        )
        .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
      while (jobs.size >= config.maxStoredJobs && terminal.length > 0) {
        const oldest = terminal.shift();
        if (oldest) jobs.delete(oldest.id);
      }
    }
  };

  const runJob = async (id: string, input: AviaryApiAuditRequest): Promise<void> => {
    const job = jobs.get(id);
    if (!job) return;
    const controller = new AbortController();
    jobControllers.set(id, controller);
    job.status = 'running';
    job.updatedAt = new Date().toISOString();
    notifyJob(job);
    try {
      const onDiscoveryProgress = (discoveredUrls: number): void => {
        job.progress = { completedUrls: 0, requestedUrls: discoveredUrls };
        job.updatedAt = new Date().toISOString();
        notifyJob(job);
      };
      let urls = input.sitemap
        ? await discoverSitemapUrls(input.sitemap, {
            maxUrls: input.maxUrls ?? config.maxBatchUrls,
            timeoutMs: input.timeout ?? config.auditDefaults.timeout,
            signal: controller.signal,
            onDocument: ({ discoveredUrls }) => onDiscoveryProgress(discoveredUrls),
          })
        : input.crawl
          ? await discoverLinkedUrls(input.crawl, {
              maxUrls: input.maxUrls ?? config.maxBatchUrls,
              maxDepth: input.maxDepth,
              maxPageBytes: input.maxPageBytes,
              maxTotalBytes: input.maxTotalBytes,
              concurrency: input.concurrency ?? config.auditDefaults.concurrency ?? 2,
              timeoutMs: input.timeout ?? config.auditDefaults.timeout,
              signal: controller.signal,
              onPage: ({ discoveredUrls }) => onDiscoveryProgress(discoveredUrls),
            })
          : (input.urls ?? []);
      if (input.sitemap) {
        urls = await filterUrlsByRobotsTxt(urls, input.sitemap, {
          timeoutMs: input.timeout ?? config.auditDefaults.timeout,
          signal: controller.signal,
          onFilter: ({ allowedUrls }) => onDiscoveryProgress(allowedUrls),
        });
        if (urls.length === 0) {
          throw new Error(
            'No sitemap page URLs remain after applying the robots.txt policy for AviaryBot.'
          );
        }
      }
      job.progress.requestedUrls = urls.length;
      const report = await auditUrls(urls, {
        ...config.auditDefaults,
        signal: controller.signal,
        userAgent:
          input.crawl || input.sitemap ? AVIARY_CRAWLER_USER_AGENT : config.auditDefaults.userAgent,
        concurrency: input.concurrency ?? config.auditDefaults.concurrency ?? 2,
        timeout: input.timeout ?? config.auditDefaults.timeout,
        navigationWaitUntil: input.navigationWaitUntil ?? config.auditDefaults.navigationWaitUntil,
        settleAfterNavigationMs:
          input.settleAfterNavigationMs ?? config.auditDefaults.settleAfterNavigationMs,
        categories: input.categories ?? config.auditDefaults.categories,
        config: input.preset ? { preset: input.preset } : config.auditDefaults.config,
        onProgress: ({ completedUrls, requestedUrls, result }) => {
          job.progress = { completedUrls, requestedUrls, lastUrl: result.url };
          job.updatedAt = new Date().toISOString();
          notifyJob(job);
        },
      });
      job.report = withoutInlineScreenshots(report);
      job.status = controller.signal.aborted ? 'cancelled' : 'completed';
    } catch (error) {
      if (controller.signal.aborted) {
        job.status = 'cancelled';
      } else {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'The batch audit failed.';
      }
    } finally {
      job.updatedAt = new Date().toISOString();
      notifyJob(job);
      jobControllers.delete(id);
      activeJobs -= 1;
      pumpQueue();
    }
  };

  const pumpQueue = (): void => {
    while (activeJobs < config.maxConcurrentJobs && queue.length > 0) {
      const queued = queue.shift();
      if (!queued) return;
      activeJobs += 1;
      const run = runJob(queued.id, queued.input);
      activeJobRuns.add(run);
      void run.then(
        () => activeJobRuns.delete(run),
        () => activeJobRuns.delete(run)
      );
    }
  };

  app.post(`${API_PREFIX}/audits`, (req, res) => {
    const parsed = auditSchema.safeParse(req.body);
    if (!parsed.success) {
      return problem(
        res,
        400,
        'Invalid audit request',
        parsed.error.issues
          .map(({ path, message }) => `${path.length ? path.join('.') : 'body'}: ${message}`)
          .join(' '),
        req.path
      );
    }
    sweepJobs();
    if (queue.length >= config.maxPendingJobs && activeJobs >= config.maxConcurrentJobs) {
      res.setHeader('Retry-After', '5');
      return problem(
        res,
        503,
        'Audit queue is full',
        'Retry after a queued audit completes.',
        req.path
      );
    }
    if (jobs.size >= config.maxStoredJobs) {
      res.setHeader('Retry-After', '60');
      return problem(
        res,
        503,
        'Audit history is full',
        'Wait for a completed job to expire before submitting another audit.',
        req.path
      );
    }

    const data = parsed.data;
    const auditOptions: AviaryApiAuditOptions = {
      ...(data.concurrency !== undefined ? { concurrency: data.concurrency } : {}),
      ...(data.timeout !== undefined ? { timeout: data.timeout } : {}),
      ...(data.navigationWaitUntil !== undefined
        ? { navigationWaitUntil: data.navigationWaitUntil }
        : {}),
      ...(data.settleAfterNavigationMs !== undefined
        ? { settleAfterNavigationMs: data.settleAfterNavigationMs }
        : {}),
      ...(data.categories !== undefined ? { categories: data.categories } : {}),
      ...(data.preset !== undefined ? { preset: data.preset } : {}),
    };
    const input: AviaryApiAuditRequest = data.sitemap
      ? {
          sitemap: data.sitemap,
          ...(data.maxUrls !== undefined ? { maxUrls: data.maxUrls } : {}),
          ...auditOptions,
        }
      : data.crawl
        ? {
            crawl: data.crawl,
            ...(data.maxUrls !== undefined ? { maxUrls: data.maxUrls } : {}),
            ...(data.maxDepth !== undefined ? { maxDepth: data.maxDepth } : {}),
            ...(data.maxPageBytes !== undefined ? { maxPageBytes: data.maxPageBytes } : {}),
            ...(data.maxTotalBytes !== undefined ? { maxTotalBytes: data.maxTotalBytes } : {}),
            ...auditOptions,
          }
        : { urls: data.urls ?? [], ...auditOptions };

    const now = new Date().toISOString();
    const id = randomUUID();
    const job: AviaryApiJob = {
      id,
      status: 'queued',
      revision: 0,
      createdAt: now,
      updatedAt: now,
      progress: { completedUrls: 0, requestedUrls: input.urls?.length ?? 0 },
    };
    jobs.set(id, job);
    queue.push({ id, input });
    pumpQueue();
    res
      .location(`${API_PREFIX}/audits/${id}`)
      .status(202)
      .json({
        id,
        status: job.status,
        revision: job.revision,
        createdAt: job.createdAt,
        links: { self: `${API_PREFIX}/audits/${id}` },
      });
  });

  app.get(`${API_PREFIX}/audits/:id`, (req, res) => {
    sweepJobs();
    const job = jobs.get(req.params.id);
    if (!job)
      return problem(
        res,
        404,
        'Audit not found',
        'No retained audit job exists with this identifier.',
        req.path
      );
    sendJob(res, job);
  });

  app.get(`${API_PREFIX}/audits/:id/events`, (req, res) => {
    sweepJobs();
    const job = jobs.get(req.params.id);
    if (!job)
      return problem(
        res,
        404,
        'Audit not found',
        'No retained audit job exists with this identifier.',
        req.path
      );
    if (activeEventStreams >= 100) {
      res.setHeader('Retry-After', '5');
      return problem(
        res,
        503,
        'Event stream limit reached',
        'Retry after another progress stream closes.',
        req.path
      );
    }
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    const event = {
      id: job.id,
      status: job.status,
      ...(job.cancelRequested ? { cancelRequested: true } : {}),
      revision: job.revision,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      progress: job.progress,
      ...(job.error ? { error: job.error } : {}),
    };
    res.write(`id: ${job.revision}\nevent: update\ndata: ${JSON.stringify(event)}\n\n`);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return res.end();
    }
    const clients = eventClients.get(job.id) ?? new Set<Response>();
    clients.add(res);
    eventClients.set(job.id, clients);
    activeEventStreams += 1;
    eventTimers.set(
      res,
      setInterval(() => {
        if (res.destroyed || res.writableEnded) return closeEventStream(res);
        try {
          res.write(': keep-alive\n\n');
        } catch {
          closeEventStream(res);
        }
      }, 15_000)
    );
    res.once('close', () => closeEventStream(res));
    res.once('error', () => closeEventStream(res));
  });

  app.delete(`${API_PREFIX}/audits/:id`, (req, res) => {
    sweepJobs();
    const job = jobs.get(req.params.id);
    if (!job)
      return problem(
        res,
        404,
        'Audit not found',
        'No retained audit job exists with this identifier.',
        req.path
      );
    if (job.status === 'queued') {
      const queuedIndex = queue.findIndex(({ id }) => id === job.id);
      if (queuedIndex !== -1) queue.splice(queuedIndex, 1);
      job.status = 'cancelled';
      job.cancelRequested = true;
      job.updatedAt = new Date().toISOString();
      notifyJob(job);
      return res.status(204).end();
    }
    if (job.status === 'running') {
      if (!job.cancelRequested) {
        job.cancelRequested = true;
        job.updatedAt = new Date().toISOString();
        notifyJob(job);
      }
      jobControllers.get(job.id)?.abort();
      return res.status(202).json(snapshot(job));
    }
    return problem(
      res,
      409,
      'Audit cannot be cancelled',
      'Only queued or running audits can be cancelled.',
      req.path
    );
  });

  app.use((_req, res) =>
    problem(res, 404, 'Not found', 'No Aviary API resource matches this path.', _req.path)
  );

  const errorHandler: ErrorRequestHandler = (error: unknown, req: Request, res: Response, next) => {
    if (res.headersSent) return next(error);
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? (error as { status?: unknown }).status
        : undefined;
    if (status === 413)
      return problem(
        res,
        413,
        'Request too large',
        'JSON request bodies are limited to 3 MiB.',
        req.path
      );
    if (status === 400)
      return problem(res, 400, 'Malformed JSON', 'Send a valid JSON request body.', req.path);
    return problem(
      res,
      500,
      'Internal server error',
      'The API could not process the request.',
      req.path
    );
  };
  app.use(errorHandler);

  appShutdownHandlers.set(app, () => {
    if (appShutdownPromise) return appShutdownPromise;
    shuttingDown = true;

    for (const queued of queue.splice(0)) {
      const job = jobs.get(queued.id);
      if (!job || job.status !== 'queued') continue;
      job.status = 'cancelled';
      job.cancelRequested = true;
      job.updatedAt = new Date().toISOString();
      notifyJob(job);
    }

    for (const job of jobs.values()) {
      if (job.status !== 'running') continue;
      job.cancelRequested = true;
      job.updatedAt = new Date().toISOString();
      notifyJob(job);
      jobControllers.get(job.id)?.abort();
    }

    for (const clients of [...eventClients.values()]) {
      for (const response of [...clients]) {
        try {
          response.end();
        } catch {
          // A disconnected client must not prevent other streams and jobs from closing.
        } finally {
          closeEventStream(response);
        }
      }
    }

    appShutdownPromise = Promise.allSettled([...activeJobRuns]).then(() => undefined);
    return appShutdownPromise;
  });

  return app;
}

/** Start the API listener. Remote binds require both bearer authentication and TLS. */
export async function startAviaryApiServer(options: AviaryApiOptions = {}): Promise<Server> {
  const config = normalizeOptions(options);
  const app = createAviaryApiApp({ ...options, host: config.host, port: config.port });
  const server = options.tls
    ? createHttpsServer({ key: options.tls.key, cert: options.tls.cert }, app)
    : createHttpServer(app);

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(config.port, config.host);
  });
  const shutdown = appShutdownHandlers.get(app);
  if (shutdown) serverShutdownHandlers.set(server, shutdown);
  return server;
}

/** Cancel queued/running jobs, close event streams, and stop an Aviary API listener. */
export async function stopAviaryApiServer(server: Server): Promise<void> {
  const existingStop = serverStopPromises.get(server);
  if (existingStop) return existingStop;
  const stop = (async () => {
    const stopJobs = serverShutdownHandlers.get(server)?.();
    const closeListener = server.listening
      ? new Promise<void>((resolve, reject) => {
          server.close((error) => {
            const code = (error as NodeJS.ErrnoException | undefined)?.code;
            if (!error || code === 'ERR_SERVER_NOT_RUNNING') resolve();
            else reject(error);
          });
        })
      : Promise.resolve();
    await Promise.all([closeListener, stopJobs ?? Promise.resolve()]);
  })();
  serverStopPromises.set(server, stop);
  await stop;
}
