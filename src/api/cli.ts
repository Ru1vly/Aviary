#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { API_CLI_HELP, parseApiCliAction } from './cliOptions';
import { loadEnvConfig } from '../config/env';
import { CHECKER_REGISTRY, type CheckerKey } from '../checkers/registry';
import { startAviaryApiServer, stopAviaryApiServer } from './server';

async function main(): Promise<void> {
  const action = parseApiCliAction(process.argv.slice(2));
  if (action === 'help') {
    process.stdout.write(API_CLI_HELP);
    return;
  }
  if (action === 'version') {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')) as {
      version: string;
    };
    process.stdout.write(`${pkg.version}\n`);
    return;
  }

  const certPath = process.env.AVIARY_API_TLS_CERT;
  const keyPath = process.env.AVIARY_API_TLS_KEY;
  if (Boolean(certPath) !== Boolean(keyPath)) {
    throw new Error('Set both AVIARY_API_TLS_CERT and AVIARY_API_TLS_KEY to enable TLS.');
  }
  const envConfig = loadEnvConfig();
  if (
    envConfig.timeout !== undefined &&
    (!Number.isInteger(envConfig.timeout) || envConfig.timeout < 1)
  ) {
    throw new Error('AVIARY_TIMEOUT must be a positive integer in milliseconds.');
  }
  if (
    envConfig.settleAfterNavigationMs !== undefined &&
    (!Number.isInteger(envConfig.settleAfterNavigationMs) ||
      envConfig.settleAfterNavigationMs < 0 ||
      envConfig.settleAfterNavigationMs > 30_000)
  ) {
    throw new Error('AVIARY_SETTLE_AFTER_NAVIGATION_MS must be an integer from 0 to 30000.');
  }
  if (
    envConfig.concurrency !== undefined &&
    (!Number.isInteger(envConfig.concurrency) ||
      envConfig.concurrency < 1 ||
      envConfig.concurrency > 8)
  ) {
    throw new Error('AVIARY_CONCURRENCY must be an integer from 1 to 8.');
  }
  if (envConfig.preset && !['basic', 'advanced', 'strict', 'geo'].includes(envConfig.preset)) {
    throw new Error('AVIARY_PRESET must be basic, advanced, strict, or geo.');
  }
  const knownCategories = new Set<string>(CHECKER_REGISTRY.map(({ key }) => key));
  const invalidCategories =
    envConfig.categories?.filter((category) => !knownCategories.has(category)) ?? [];
  if (invalidCategories.length > 0) {
    throw new Error(
      `AVIARY_CATEGORIES contains unknown category key(s): ${invalidCategories.join(', ')}.`
    );
  }
  const viewportMatch = envConfig.viewport?.match(/^(\d+)x(\d+)$/i);
  if (envConfig.viewport && !viewportMatch) {
    throw new Error('AVIARY_VIEWPORT must use WxH format, for example 1920x1080.');
  }
  const viewport = viewportMatch
    ? { width: Number(viewportMatch[1]), height: Number(viewportMatch[2]) }
    : undefined;
  if (viewport && (viewport.width < 1 || viewport.height < 1)) {
    throw new Error('AVIARY_VIEWPORT dimensions must be positive integers.');
  }
  const port =
    process.env.AVIARY_API_PORT === undefined ? undefined : Number(process.env.AVIARY_API_PORT);
  const server = await startAviaryApiServer({
    host: process.env.AVIARY_API_HOST,
    port,
    apiKey: process.env.AVIARY_API_KEY,
    auditDefaults: {
      headless: envConfig.headless,
      timeout: envConfig.timeout,
      settleAfterNavigationMs: envConfig.settleAfterNavigationMs,
      viewport,
      concurrency: envConfig.concurrency,
      config: envConfig.preset ? { preset: envConfig.preset } : undefined,
      categories: envConfig.categories?.map((category) => category as CheckerKey),
    },
    tls:
      certPath && keyPath
        ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
        : undefined,
  });
  const address = server.address();
  const protocol = certPath && keyPath ? 'https' : 'http';
  const addressText =
    typeof address === 'object' && address
      ? `${address.address.includes(':') ? `[${address.address}]` : address.address}:${address.port}`
      : 'unknown';
  process.stdout.write(`Aviary API listening on ${protocol}://${addressText}\n`);
  if (process.env.AVIARY_API_KEY) process.stdout.write('Bearer authentication is enabled.\n');

  let shuttingDown = false;
  const close = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.off('SIGINT', close);
    process.off('SIGTERM', close);
    void stopAviaryApiServer(server).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Aviary API shutdown failed: ${message}\n`);
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Could not start the Aviary API.';
  process.stderr.write(`Aviary API startup failed: ${message}\n`);
  process.exitCode = 1;
});
