//! `aviary-fast` — the TUI's opt-in fast path.
//!
//! Runs the Rust engine's plain-HTTP-fetch analysis (the 4 implemented rule
//! categories: meta_tags, headings, security, content — see
//! engine/src/rules/) and prints a report shaped like the Node CLI's
//! `--json` output on stdout, so the TUI's existing `SEOReport` parsing and
//! dashboard rendering work unchanged for either source. Categories this
//! binary doesn't implement are simply absent from `checks` rather than
//! present-but-empty, which the TUI's `Option<Vec<_>>` fields already
//! deserialize as `None` for.
//!
//! This is explicitly a partial, faster alternative to the full 28-checker
//! Playwright audit (`node dist/cli.js --json`), not a replacement for it —
//! see the "fast" field this report carries, which the TUI uses to label
//! the result and offer running the full audit afterward.

use aviary_engine::{config::EngineConfig, run_analysis, Severity};
use serde_json::{json, Value};
use std::collections::HashMap;

/// Rust rule categories that already share a name with their TS checker
/// registry key (see src/checkers/registry.ts) map through unchanged;
/// "meta_tags" is the one exception ("metaTags" in TS).
fn ts_category_key(rule_name: &str) -> String {
    match rule_name {
        "meta_tags" => "metaTags".to_string(),
        other => other.to_string(),
    }
}

fn severity_str(s: &Severity) -> &'static str {
    match s {
        Severity::Error => "error",
        Severity::Warning => "warning",
        Severity::Info => "info",
    }
}

#[tokio::main]
async fn main() {
    let url = match std::env::args().nth(1) {
        Some(u) => u,
        None => {
            eprintln!("Usage: aviary-fast <url>");
            std::process::exit(2);
        }
    };

    let config = EngineConfig::default();
    let result = match run_analysis(&url, &config).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("{e:#}");
            std::process::exit(1);
        }
    };

    let mut checks: HashMap<String, Vec<Value>> = HashMap::new();
    let mut passed = 0usize;
    let mut failed = 0usize;

    for (rule_name, results) in &result.results_by_category {
        let key = ts_category_key(rule_name);
        let entry = checks.entry(key).or_default();
        for r in results {
            if r.passed {
                passed += 1;
            } else {
                failed += 1;
            }
            entry.push(json!({
                "passed": r.passed,
                "message": r.message,
                "severity": severity_str(&r.severity),
                "details": r.details,
                "name": r.name,
            }));
        }
    }

    let report = json!({
        "url": result.url,
        "timestamp": result.timestamp,
        "score": result.score,
        "summary": {
            "total": passed + failed,
            "passed": passed,
            "failed": failed,
        },
        "checks": checks,
        "fast": true,
        "fastCategories": checks.keys().collect::<Vec<_>>(),
    });

    match serde_json::to_string(&report) {
        Ok(s) => println!("{s}"),
        Err(e) => {
            eprintln!("Failed to serialize fast-path report: {e}");
            std::process::exit(1);
        }
    }
}
