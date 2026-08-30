import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import { MockServer } from '../mocks/mockServer';

/**
 * Drives the real MCP server (src/mcp/server.ts, run through tsx rather than
 * a pre-built dist/ — the unit-test CI job runs before the build job, see
 * .github/workflows/ci.yml) over its actual stdio JSON-RPC transport,
 * against a local MockServer fixture instead of a real site. This is the
 * only test that imports src/mcp/server.ts at all.
 */
describe('MCP server (stdio protocol)', () => {
  let mockServer: MockServer;
  let proc: ChildProcessWithoutNullStreams;
  let buffer = '';
  const pending = new Map<number, (msg: Record<string, unknown>) => void>();
  const unmatched: Record<string, unknown>[] = [];
  let nextId = 1;

  function send(message: Record<string, unknown>): void {
    proc.stdin.write(JSON.stringify(message) + '\n');
  }

  function call(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      send({ jsonrpc: '2.0', id, method, params });
    });
  }

  function notify(method: string): void {
    send({ jsonrpc: '2.0', method });
  }

  beforeAll(async () => {
    mockServer = new MockServer(3457);
    await mockServer.start();

    const tsxBin = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
    proc = spawn(tsxBin, ['src/mcp/server.ts'], { cwd: process.cwd() });

    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (typeof msg.id === 'number' && pending.has(msg.id)) {
          const resolve = pending.get(msg.id)!;
          pending.delete(msg.id);
          resolve(msg);
        } else {
          unmatched.push(msg);
        }
      }
    });

    // Let the process start listening before the first request.
    await new Promise((r) => setTimeout(r, 500));
  }, 30000);

  afterAll(async () => {
    proc.kill();
    await mockServer.stop();
  });

  it('initialize returns protocol info', async () => {
    const res = await call('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'vitest', version: '0.0.0' },
    });
    expect(res.result).toMatchObject({
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'aviary' },
    });
  });

  it('sends no reply to a notification (no id)', async () => {
    const before = unmatched.length;
    notify('notifications/initialized');
    // Confirm silence rather than a positive signal — wait, then assert
    // nothing arrived that wasn't already accounted for by a pending call.
    await new Promise((r) => setTimeout(r, 300));
    expect(unmatched.length).toBe(before);
  });

  it('tools/list includes all 3 tools with every registry category in their enums', async () => {
    const res = await call('tools/list');
    const tools = (res.result as { tools: Array<{ name: string; inputSchema: unknown }> }).tools;
    expect(tools.map((t) => t.name).sort()).toEqual(['seo_audit', 'seo_check_category', 'seo_score']);

    const checkCategoryTool = tools.find((t) => t.name === 'seo_check_category')!;
    const schema = checkCategoryTool.inputSchema as {
      properties: { category: { enum: string[] } };
    };
    expect(schema.properties.category.enum).toHaveLength(28);
    expect(schema.properties.category.enum).toContain('heatmap');
  });

  it('tools/call with invalid input returns a structured isError result, not a protocol error', async () => {
    const res = await call('tools/call', {
      name: 'seo_audit',
      arguments: { url: 'not-a-url' },
    });
    expect(res.error).toBeUndefined();
    const result = res.result as { content: Array<{ text: string }>; isError: boolean };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/valid url/i);
  });

  it('seo_check_category runs only the requested category against a real fixture', async () => {
    const res = await call('tools/call', {
      name: 'seo_check_category',
      arguments: { url: mockServer.getUrl('/optimal'), category: 'metaTags' },
    });
    const result = res.result as { content: Array<{ text: string }> };
    const payload = JSON.parse(result.content[0].text);
    expect(payload.category).toBe('metaTags');
    expect(Array.isArray(payload.checks)).toBe(true);
    expect(payload.checks.length).toBeGreaterThan(0);
  }, 60000);

  it('seo_score returns a score and grade for a real fixture page', async () => {
    const res = await call('tools/call', {
      name: 'seo_score',
      arguments: { url: mockServer.getUrl('/optimal') },
    });
    const result = res.result as { content: Array<{ text: string }> };
    const payload = JSON.parse(result.content[0].text);
    expect(typeof payload.score).toBe('number');
    expect(['A', 'B', 'C', 'D', 'F']).toContain(payload.grade);
  }, 60000);
});
