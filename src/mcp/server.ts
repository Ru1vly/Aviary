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

import { SEOChecker } from '../index';
import { CHECKER_REGISTRY, CheckerKey } from '../checkers/registry';

// Single source of truth for valid category names, instead of a hand-typed
// list that drifts from the real 28-checker registry (the old version only
// listed 11).
const CATEGORY_KEYS = CHECKER_REGISTRY.map((c) => c.key) as [CheckerKey, ...CheckerKey[]];

function gradeFor(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function createServer(): McpServer {
  const server = new McpServer({ name: 'aviary', version: '1.0.0' });

  server.registerTool(
    'seo_audit',
    {
      description: `Run a comprehensive SEO audit on a URL. Returns detailed check results across ${CHECKER_REGISTRY.length} categories including meta tags, headings, performance, accessibility, security, and more.`,
      inputSchema: z.object({
        url: z.string().url('Must be a valid URL starting with http:// or https://'),
        preset: z
          .enum(['basic', 'advanced', 'strict'])
          .optional()
          .default('advanced')
          .describe('Audit preset (default: advanced)'),
        categories: z
          .array(z.enum(CATEGORY_KEYS))
          .optional()
          .describe('Specific categories to check (optional, runs all if omitted)'),
      }),
    },
    async ({ url, preset, categories }) => {
      const checker = new SEOChecker({ url, headless: true, config: { preset }, categories });
      const report = await checker.check();
      return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
    }
  );

  server.registerTool(
    'seo_score',
    {
      description: 'Get a quick SEO score for a URL without full details. Returns score 0-100 and grade (A-F).',
      inputSchema: z.object({
        url: z.string().url('Must be a valid URL'),
      }),
    },
    async ({ url }) => {
      const checker = new SEOChecker({ url, headless: true });
      const report = await checker.check();
      const summary = {
        url,
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
      description: 'Run SEO checks for a specific category only (e.g., metaTags, security, performance).',
      inputSchema: z.object({
        url: z.string().url('Must be a valid URL'),
        category: z.enum(CATEGORY_KEYS).describe('Category to check'),
      }),
    },
    async ({ url, category }) => {
      const checker = new SEOChecker({
        url,
        headless: true,
        config: { preset: 'advanced' },
        categories: [category],
      });
      const report = await checker.check();
      const checks = report.checks[category];
      return { content: [{ type: 'text', text: JSON.stringify({ url, category, checks }, null, 2) }] };
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
