// Install an unpublished root tarball in isolation and exercise its public entry points.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync, spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const archive = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !archive.endsWith('.tgz'))
  throw new Error('Supply a packed Aviary root tarball.');
const nativeArchive = process.argv[3] ? path.resolve(process.argv[3]) : undefined;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aviary-consumer-check-'));
const npmCommand =
  process.platform === 'win32'
    ? [
        process.execPath,
        path.join(
          path.dirname(
            execFileSync('where.exe', ['npm.cmd'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
          ),
          'node_modules/npm/bin/npm-cli.js'
        ),
      ]
    : ['npm'];
const npmRun = (args) =>
  execFileSync(npmCommand[0], [...npmCommand.slice(1), ...args], {
    cwd: directory,
    encoding: 'utf8',
  });
function runCli(file, args) {
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 30000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout + result.stderr;
}
async function mcpVersion(file) {
  const child = spawn(process.execPath, [file], {
    cwd: directory,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  try {
    return await new Promise((resolve, reject) => {
      let output = '';
      let errors = '';
      const timer = setTimeout(
        () => reject(new Error(`MCP initialization timed out: ${errors}`)),
        20000
      );
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.stderr.on('data', (chunk) => {
        errors += chunk;
      });
      child.stdout.on('data', (chunk) => {
        output += chunk;
        let boundary;
        while ((boundary = output.indexOf('\n')) >= 0) {
          const line = output.slice(0, boundary);
          output = output.slice(boundary + 1);
          if (!line.trim()) continue;
          try {
            const message = JSON.parse(line);
            if (message.id === 1) {
              clearTimeout(timer);
              if (message.error) reject(new Error(JSON.stringify(message.error)));
              else resolve(message.result.serverInfo.version);
            }
          } catch (error) {
            clearTimeout(timer);
            reject(error);
          }
        }
      });
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'candidate-check', version: '1' },
          },
        }) + '\n'
      );
    });
  } finally {
    child.kill();
  }
}
async function main() {
  try {
    fs.writeFileSync(path.join(directory, 'package.json'), '{"private":true}');
    npmRun(['install', '--omit=optional', '--ignore-scripts', '--no-audit', '--no-fund', archive]);
    if (nativeArchive)
      npmRun(['install', '--ignore-scripts', '--no-audit', '--no-fund', nativeArchive]);
    const installed = path.join(directory, 'node_modules/@ru1vly/aviary');
    const manifest = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
    const version = manifest.version;
    assert(Object.values(manifest.optionalDependencies).every((value) => value === version));
    const aviary = require(installed);
    assert(Object.keys(aviary).length > 100);
    const cli = path.join(installed, 'dist/cli.js');
    assert.equal(runCli(cli, ['--version']).trim(), version);
    assert.match(runCli(cli, ['--help']), /--geo-answer-observations/);
    const apiCli = path.join(installed, 'dist/api/cli.js');
    assert.equal(runCli(apiCli, ['--version']).trim(), version);
    assert.match(runCli(apiCli, ['--help']), /Usage:/);
    const report = aviary.analyzeAiAnswerCitationObservations(
      {
        schemaVersion: 1,
        observations: [
          {
            provider: 'Search',
            prompt: 'Explain citation evidence',
            observedAt: '2026-10-01T00:00:00Z',
            answerText: 'PRIVATE_ANSWER',
            citedUrls: ['https://example.com/guide?secret=PRIVATE_QUERY'],
            citationListComplete: true,
          },
        ],
      },
      ['example.com']
    );
    const html = aviary.renderAiAnswerCitationObservationHtml(report);
    assert(!/PRIVATE_ANSWER|PRIVATE_QUERY|NaN%|Infinity%/.test(html));
    assert.match(html, /example\.com\/guide/);
    const fixture = path.join(directory, 'observations.json');
    const output = path.join(directory, 'citations.json');
    fs.writeFileSync(
      fixture,
      JSON.stringify({
        schemaVersion: 1,
        observations: [
          {
            provider: 'Search',
            prompt: 'Explain evidence',
            observedAt: '2026-10-01T00:00:00Z',
            citedUrls: ['https://example.com/guide'],
            citationListComplete: true,
          },
        ],
      })
    );
    runCli(cli, [
      '--geo-answer-observations',
      fixture,
      '--geo-answer-owned-domain',
      'example.com',
      '--output',
      output,
    ]);
    assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).summary.citationEvents, 1);
    const app = aviary.createAviaryApiApp({});
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const response = await fetch(base + '/health');
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'ok', service: 'aviary-api', version });
      const spec = await (await fetch(base + '/openapi.yaml')).text();
      assert(spec.split(/\r?\n/).includes(`  version: ${version}`));
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    assert.equal(await mcpVersion(path.join(installed, 'dist/mcp/server.js')), version);
    if (nativeArchive) {
      const platform = `${process.platform}-${process.arch}`;
      const native = path.join(directory, 'node_modules/@ru1vly', `aviary-${platform}`);
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(native, 'package.json'), 'utf8')).version,
        version
      );
      for (const [script, binary] of [
        ['smoke-test-binary.js', 'tui'],
        ['smoke-test-fast-binary.js', 'aviary-fast'],
      ])
        execFileSync(
          process.execPath,
          [
            path.join(__dirname, script),
            path.join(native, binary + (process.platform === 'win32' ? '.exe' : '')),
          ],
          { stdio: 'inherit' }
        );
    }
    const result = {
      version,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
      node: process.version,
      exports: Object.keys(aviary).length,
      checks: [
        'isolated install',
        'optional versions',
        'SDK report and privacy',
        'CLI help/version/offline analysis',
        'API help/version/health/OpenAPI',
        'MCP initialization',
        ...(nativeArchive ? ['installed native binaries'] : []),
      ],
    };
    fs.writeFileSync(
      path.join(path.dirname(archive), 'consumer-smoke.json'),
      JSON.stringify(result, null, 2) + '\n'
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
