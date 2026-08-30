/**
 * Named performance thresholds shared across checkers that measure the same thing.
 *
 * Scope note: this only covers the one threshold the plan flagged as an outright
 * inconsistency (mobileUX.ts checked page load time against 5000ms while its own
 * message said "Target: < 3s", and performance.ts/coreWebVitals.ts independently
 * used 3000ms for the same navigation-timing measurement). Extracting the
 * remaining ~180 checker-specific inline thresholds (each a one-off judgment call
 * for that checker, not a cross-checker disagreement) to named, rule-option-
 * overridable constants is separate, larger follow-up work — not started here.
 */

/** Page load time (ms) above which a full-page-load check fails. Shared by performance.ts, coreWebVitals.ts, and mobileUX.ts. */
export const PAGE_LOAD_TIME_MS = 3000;
