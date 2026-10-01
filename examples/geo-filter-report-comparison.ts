import { readFileSync } from 'node:fs';
import { compareSEOReports, evaluateSEOAuditGeoChangeGate } from '../src';
import type { SEOReport } from '../src';

function loadReport(file: string): SEOReport {
  return JSON.parse(readFileSync(file, 'utf8')) as SEOReport;
}

function main(): void {
  const [currentFile, baselineFile, signal, url, transition] = process.argv.slice(2);
  if (!currentFile || !baselineFile) {
    process.stderr.write('Usage: pnpm exec tsx examples/geo-filter-report-comparison.ts <current.json> <baseline.json> [exact-signal] [exact-url] [<before=>after>]\n');
    process.exitCode = 2;
    return;
  }

  const separator = transition?.indexOf('=>') ?? -1;
  const before = separator < 0 ? '' : transition!.slice(0, separator).trim();
  const after = separator < 0 ? '' : transition!.slice(separator + 2).trim();
  if (transition !== undefined && (!before || !after)) {
    process.stderr.write('Transition must use the form <before=>after>.\n');
    process.exitCode = 2;
    return;
  }

  const comparison = compareSEOReports(loadReport(currentFile), loadReport(baselineFile));
  const filters = {
    ...(signal ? { signals: [signal] } : {}),
    ...(url ? { urls: [url] } : {}),
    ...(transition && before && after ? { transitions: [{ before, after }] } : {}),
  };
  const gate = evaluateSEOAuditGeoChangeGate(comparison, { filters });
  const changes = gate.matchingChanges;
  process.stdout.write(`GEO gate ${gate.passed ? 'passed' : 'failed'}; crawler/preview controls comparable on ${gate.comparablePages}/${gate.matchedPages} matched page(s); ${changes.length} matching change(s)\n`);
  for (const reason of gate.failureReasons) process.stdout.write(`[${reason.code}] ${reason.message}\n`);
  if (!gate.passed) process.exitCode = 1;
  const printable = (value: string): string => value.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
  for (const change of changes) {
    process.stdout.write(`${printable(change.signal)}: ${printable(change.before)} → ${printable(change.after)} (${printable(change.url)})\n`);
  }
}

main();
