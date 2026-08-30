import type { SEOCheckResult } from './types';

/**
 * Per-severity weight applied when computing the overall score.
 * - error failures penalise 3x
 * - warning failures penalise 1x (default, also applied when severity is unset)
 * - info failures penalise 0.5x
 * This prevents low-priority category checks from unfairly dragging the
 * score down as much as a real error would.
 */
function severityWeight(severity?: string): number {
  switch (severity) {
    case 'error':
      return 3;
    case 'info':
      return 0.5;
    default:
      return 1; // 'warning' or unset
  }
}

/**
 * Calculate a severity-weighted score (0-100) across a set of check results.
 *
 * Extracted from SEOChecker as a standalone, exported, pure function so it
 * can be unit-tested directly and reused as the single source of truth for
 * the score TS reports — including reconciling it against the Rust engine's
 * separate scoring formula (see compute_score in engine/src/lib.rs, which
 * mirrors this function's weights and null-on-empty behavior exactly).
 *
 * Returns `null`, not a magic 0 or 100, when `checks` has nothing to weigh
 * (e.g. every checker disabled, or an MCP `categories` filter matching
 * nothing) — a passed/failed rate is undefined when nothing was checked,
 * and picking either constant would misreport "everything passed" or
 * "everything failed".
 */
export function calculateWeightedScore(checks: SEOCheckResult[]): number | null {
  let totalWeight = 0;
  let passedWeight = 0;

  for (const check of checks) {
    const weight = severityWeight(check.severity);
    totalWeight += weight;
    if (check.passed) passedWeight += weight;
  }

  if (totalWeight === 0) return null;
  return Math.round((passedWeight / totalWeight) * 100);
}
