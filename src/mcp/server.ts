#!/usr/bin/env node
/**
 * e2e-seo MCP Server
 * Exposes SEO audit capabilities as Model Context Protocol tools
 * Compatible with Claude Desktop, Cursor, Windsurf, and other MCP clients
 *
 * Usage: node dist/mcp/server.js
 * Add to MCP client config:
 *   { "command": "node", "args": ["path/to/dist/mcp/server.js"] }
 */

import { SEOChecker } from '../index';
import { generateHtmlReport } from '../reporter';

// MCP JSON-RPC protocol types
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

// MCP Tools definition
const TOOLS = [
  {
    name: 'seo_audit',
    description:
      'Run a comprehensive SEO audit on a URL. Returns detailed check results across 27 categories including meta tags, headings, performance, accessibility, security, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to audit (must include https://)' },
        preset: {
          type: 'string',
          enum: ['basic', 'advanced', 'strict'],
          description: 'Audit preset (default: advanced)',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific categories to check (optional, runs all if omitted)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'seo_score',
    description:
      'Get a quick SEO score for a URL without full details. Returns score 0-100 and grade (A-F).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to score' },
      },
      required: ['url'],
    },
  },
  {
    name: 'seo_check_category',
    description:
      'Run SEO checks for a specific category only (e.g., metaTags, security, performance).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to check' },
        category: {
          type: 'string',
          enum: [
            'metaTags',
            'headings',
            'images',
            'performance',
            'security',
            'accessibility',
            'content',
            'links',
            'structuredData',
            'mobileUX',
            'coreWebVitals',
          ],
          description: 'Category to check',
        },
      },
      required: ['url', 'category'],
    },
  },
];

import { z } from 'zod';

const SeoScoreSchema = z.object({
  url: z.string().url('Must be a valid URL starting with http:// or https://'),
});

const SeoAuditSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  preset: z.enum(['basic', 'advanced', 'strict']).optional().default('advanced'),
  categories: z.array(z.string()).optional(),
});

const SeoCheckCategorySchema = z.object({
  url: z.string().url('Must be a valid URL'),
  category: z.enum([
    'metaTags',
    'headings',
    'images',
    'performance',
    'security',
    'accessibility',
    'content',
    'links',
    'structuredData',
    'mobileUX',
    'coreWebVitals',
  ]),
});

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === 'seo_score') {
    const parsed = SeoScoreSchema.parse(args);
    const { url } = parsed;
    const checker = new SEOChecker({ url, headless: true });
    const report = await checker.check();
    const grade =
      report.score >= 90
        ? 'A'
        : report.score >= 80
          ? 'B'
          : report.score >= 70
            ? 'C'
            : report.score >= 60
              ? 'D'
              : 'F';
    return JSON.stringify(
      {
        url,
        score: report.score,
        grade,
        passed: report.summary.passed,
        failed: report.summary.failed,
        total: report.summary.total,
      },
      null,
      2,
    );
  }

  if (name === 'seo_audit') {
    const parsed = SeoAuditSchema.parse(args);
    const { url, preset } = parsed;
    const checker = new SEOChecker({
      url,
      headless: true,
      config: { preset },
    });
    const report = await checker.check();
    return JSON.stringify(report, null, 2);
  }

  if (name === 'seo_check_category') {
    const parsed = SeoCheckCategorySchema.parse(args);
    const { url, category } = parsed;
    const checker = new SEOChecker({
      url,
      headless: true,
      config: { preset: 'advanced' },
    });
    const report = await checker.check();
    const checks = (report.checks as Record<string, unknown>)[category];
    return JSON.stringify({ url, category, checks }, null, 2);
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function main() {
  // MCP uses stdio for communication
  process.stdin.setEncoding('utf8');

  let buffer = '';

  process.stdin.on('data', async (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      let request: MCPRequest;
      try {
        request = JSON.parse(line);
      } catch {
        continue;
      }

      let response: MCPResponse;

      try {
        if (request.method === 'initialize') {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'e2e-seo', version: '1.0.0' },
            },
          };
        } else if (request.method === 'tools/list') {
          response = { jsonrpc: '2.0', id: request.id, result: { tools: TOOLS } };
        } else if (request.method === 'tools/call') {
          const { name, arguments: toolArgs } = request.params as {
            name: string;
            arguments: Record<string, unknown>;
          };
          const result = await handleToolCall(name, toolArgs);
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: { content: [{ type: 'text', text: result }] },
          };
        } else {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32601, message: 'Method not found' },
          };
        }
      } catch (err) {
        response = {
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32603, message: (err as Error).message },
        };
      }

      process.stdout.write(JSON.stringify(response) + '\n');
    }
  });

  process.stdin.on('end', () => process.exit(0));
}

main().catch((err) => {
  process.stderr.write(JSON.stringify({ level: 'error', message: err.message }) + '\n');
  process.exit(1);
});
