#!/usr/bin/env node
/**
 * aviary MCP Server
 * Exposes SEO audit capabilities as Model Context Protocol tools
 * Compatible with Claude Desktop, Cursor, Windsurf, and other MCP clients
 *
 * Usage: node dist/mcp/server.js
 * Add to MCP client config:
 *   { "command": "node", "args": ["path/to/dist/mcp/server.js"] }
 */

import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SEOChecker } from '../index';
import { CHECKER_REGISTRY, CheckerKey } from '../checkers/registry';
import { loadSettleAfterNavigationMs } from '../config/env';

// Single source of truth for valid category names, instead of a hand-typed
// list that drifts from the real 28-checker registry (the old version only
// listed 11).
const CATEGORY_KEYS = CHECKER_REGISTRY.map((c) => c.key) as [CheckerKey, ...CheckerKey[]];

function gradeFor(score: number | null): 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A' {
  if (score === null) return 'N/A';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function createServer(): McpServer {
  const defaultSettleAfterNavigationMs = loadSettleAfterNavigationMs();
  if (
    defaultSettleAfterNavigationMs !== undefined &&
    (!Number.isInteger(defaultSettleAfterNavigationMs) ||
      defaultSettleAfterNavigationMs < 0 ||
      defaultSettleAfterNavigationMs > 30_000)
  ) {
    throw new Error('AVIARY_SETTLE_AFTER_NAVIGATION_MS must be an integer from 0 to 30000.');
  }
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as {
    version: string;
  };
  const server = new McpServer({ name: 'aviary', version: pkg.version });

  server.registerTool(
    'seo_audit',
    {
      description: `Run a real-browser SEO audit on a URL. Returns detailed results for enabled categories; use the geo preset to run only AI discoverability checks.`,
      inputSchema: z.object({
        url: z.string().url('Must be a valid URL starting with http:// or https://'),
        preset: z
          .enum(['basic', 'advanced', 'strict', 'geo'])
          .optional()
          .default('advanced')
          .describe('Audit preset (default: advanced; geo runs only AI discoverability checks)'),
        categories: z
          .array(z.enum(CATEGORY_KEYS))
          .optional()
          .describe('Specific categories to check (optional, runs all if omitted)'),
        settleAfterNavigationMs: z
          .number()
          .int()
          .min(0)
          .max(30_000)
          .optional()
          .describe('Fixed delay after navigation readiness, in milliseconds (default: 1000)'),
      }),
    },
    async ({ url, preset, categories, settleAfterNavigationMs }) => {
      const checker = new SEOChecker({
        url,
        headless: true,
        config: { preset },
        categories,
        settleAfterNavigationMs: settleAfterNavigationMs ?? defaultSettleAfterNavigationMs,
      });
      const report = await checker.check();
      return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
    }
  );

  server.registerTool(
    'seo_score',
    {
      description:
        'Get a quick SEO score for a URL without full details. Returns score 0-100 and grade (A-F).',
      inputSchema: z.object({
        url: z.string().url('Must be a valid URL'),
        settleAfterNavigationMs: z
          .number()
          .int()
          .min(0)
          .max(30_000)
          .optional()
          .describe('Fixed delay after navigation readiness, in milliseconds (default: 1000)'),
      }),
    },
    async ({ url, settleAfterNavigationMs }) => {
      const checker = new SEOChecker({
        url,
        headless: true,
        settleAfterNavigationMs: settleAfterNavigationMs ?? defaultSettleAfterNavigationMs,
      });
      const report = await checker.check();
      const summary = {
        url,
        navigationWaitUntil: report.navigationWaitUntil,
        settleAfterNavigationMs: report.settleAfterNavigationMs,
        score: report.score,
        grade: gradeFor(report.score),
        passed: report.summary.passed,
        failed: report.summary.failed,
        total: report.summary.total,
      };
      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.registerTool(
    'seo_check_category',
    {
      description:
        'Run SEO checks for a specific category only (e.g., metaTags, security, performance).',
      inputSchema: z.object({
        url: z.string().url('Must be a valid URL'),
        category: z.enum(CATEGORY_KEYS).describe('Category to check'),
        settleAfterNavigationMs: z
          .number()
          .int()
          .min(0)
          .max(30_000)
          .optional()
          .describe('Fixed delay after navigation readiness, in milliseconds (default: 1000)'),
      }),
    },
    async ({ url, category, settleAfterNavigationMs }) => {
      const checker = new SEOChecker({
        url,
        headless: true,
        config: { preset: 'advanced' },
        categories: [category],
        settleAfterNavigationMs: settleAfterNavigationMs ?? defaultSettleAfterNavigationMs,
      });
      const report = await checker.check();
      const checks = report.checks[category];
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                url,
                category,
                navigationWaitUntil: report.navigationWaitUntil,
                settleAfterNavigationMs: report.settleAfterNavigationMs,
                checks,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

void serveStdio(createServer, {
  onerror: (err) => {
    process.stderr.write(JSON.stringify({ level: 'error', message: err.message }) + '\n');
  },
});
process.stderr.write('aviary MCP server running on stdio\n');
