import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MockServer } from '../mocks/mockServer';

/**
 * Drives the real CLI (src/cli.ts, run through tsx — see mcpServer.test.ts
 * for why not a pre-built dist/) as a subprocess rather than importing it:
 * importing it directly executes module-level side effects (starts a
 * Prometheus metrics HTTP server on port 9090 — see
 * docs/ACCURACY_LIMITATIONS.md 4.2) that don't belong running inside the
 * test process.
 */
function runCli(args: string[], env: Record<string, string> = {}): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const tsxBin = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
  return new Promise((resolve) => {
    const proc = spawn(tsxBin, ['src/cli.ts', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => resolve({ stdout, stderr, code }));
  });
}

describe('cli.ts', () => {
  let mockServer: MockServer;

  beforeAll(async () => {
    mockServer = new MockServer(3458);
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  it('--help prints usage to stderr with exit code 0, and stdout stays empty', async () => {
    const { stdout, stderr, code } = await runCli(['--help']);
    expect(code).toBe(0);
    expect(stderr).toContain('Usage: aviary');
    expect(stderr).toContain(`across ${28} categories`);
    expect(stdout).toBe('');
  });

  it('rejects a positional URL argument with a clear error instead of trying to use it', async () => {
    const { stderr, code } = await runCli(['https://example.com']);
    expect(code).toBe(1);
    expect(stderr).toContain('Positional URL arguments are no longer supported');
    expect(stderr).toContain('-u');
  });

  it('rejects an invalid URL before launching a browser', async () => {
    const { stderr, code } = await runCli(['-u', 'not a url']);
    expect(code).toBe(1);
    expect(stderr).toContain('Invalid URL');
  });

  it('--json prints only a parseable JSON report to stdout, with everything else on stderr', async () => {
    const { stdout, stderr, code } = await runCli(
      ['-u', mockServer.getUrl('/optimal'), '--json'],
      { AVIARY_LOG_LEVEL: 'debug' } // proves debug-level logging doesn't leak onto stdout either
    );
    expect(code).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.url).toBe(mockServer.getUrl('/optimal'));
    expect(report.checks).toBeDefined();
    // Confirms logger.debug output (enabled above) went to stderr, not stdout.
    expect(stderr.length).toBeGreaterThan(0);
  }, 60000);

  it('prints a human-readable report to stderr (not --json), with the score line handling null gracefully', async () => {
    const { stderr, code } = await runCli(['-u', mockServer.getUrl('/optimal')]);
    expect(code).toBe(0);
    expect(stderr).toContain('SEO Report for');
    expect(stderr).toMatch(/Score: (\d+\/100|N\/A)/);
  }, 60000);

  it('writes the --html report even when --json is also passed', async () => {
    // The TUI always passes both flags together (--json to parse the
    // result back, --html to get a report file) -- these used to be
    // mutually exclusive because the --json branch returned before ever
    // reaching the file-writing code.
    const htmlPath = path.join(os.tmpdir(), `aviary-cli-test-${Date.now()}.html`);
    try {
      const { code } = await runCli(['-u', mockServer.getUrl('/optimal'), '--json', '--html', htmlPath]);
      expect(code).toBe(0);
      expect(fs.existsSync(htmlPath)).toBe(true);
      const html = fs.readFileSync(htmlPath, 'utf8');
      expect(html).toContain(mockServer.getUrl('/optimal'));
    } finally {
      fs.rmSync(htmlPath, { force: true });
    }
  }, 60000);
});
