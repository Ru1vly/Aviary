//! `e2e-seo-engine` — Dual-engine SEO analysis library.
//!
//! # Quick start
//!
//! ```rust,no_run
//! use e2e_seo_engine::{run_analysis, config::EngineConfig};
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let config = EngineConfig::default();
//!     let result = run_analysis("https://example.com", &config).await?;
//!     println!("Score: {}/100", result.score);
//!     Ok(())
//! }
//! ```

pub mod config;
pub mod context;
pub mod crawler;
pub mod rules;
pub mod semantic;

pub use config::EngineConfig;
pub use context::PageContext;
pub use rules::{CheckResult, Severity};
pub use semantic::{SemanticAnalysis, SemanticAnalyzer};

use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

/// The complete result of analysing a single URL.
#[derive(Debug, Serialize, Deserialize)]
pub struct EngineResult {
    pub url: String,
    pub page_context: PageContext,
    pub check_results: Vec<CheckResult>,
    pub semantic_analysis: Option<SemanticAnalysis>,
    /// Overall SEO score 0–100.
    pub score: u32,
    /// ISO-8601 timestamp of when the analysis ran.
    pub timestamp: String,
}

/// Run a full SEO analysis on the given URL.
///
/// 1. Fetches the page via reqwest (fast path).
/// 2. Parses the HTML into a `PageContext`.
/// 3. If `config.auto_render_fallback` is set and the page looks like a SPA,
///    falls back to `node dist/cli.js` (render path) — the Node JSON is stored
///    as-is in `EngineResult` (full TUI integration deferred).
/// 4. Runs all built-in Rust rules.
/// 5. Optionally runs the configured semantic analyzer.
/// 6. Computes a simple percentage score.
pub async fn run_analysis(url: &str, config: &EngineConfig) -> Result<EngineResult> {
    info!(url, "Starting SEO analysis");

    // ── Fast path ─────────────────────────────────────────────────────────────
    let raw = crawler::fetch(url, config)
        .await
        .with_context(|| format!("Failed to fetch {url}"))?;

    let mut ctx = crawler::parser::parse(raw, url)
        .context("Failed to parse HTML")?;

    // ── Render path (SPA fallback) ────────────────────────────────────────────
    if config.auto_render_fallback && crawler::renderer::looks_like_spa(&ctx) {
        warn!(url, "SPA detected — falling back to Node renderer");
        match crawler::renderer::render_via_node(url, &config.node_cli_path).await {
            Ok(json_str) => {
                // Re-parse the richer HTML if the Node CLI returns an `html` field.
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_str) {
                    if let Some(html) = val.get("html").and_then(|v| v.as_str()) {
                        let raw2 = crawler::RawResponse {
                            html: html.to_string(),
                            headers: ctx.response_headers.clone(),
                            status_code: ctx.status_code,
                            load_time_ms: ctx.load_time_ms,
                        };
                        if let Ok(ctx2) = crawler::parser::parse(raw2, url) {
                            ctx = ctx2;
                        }
                    }
                }
            }
            Err(e) => {
                warn!("Node renderer failed, continuing with fast-path data: {e}");
            }
        }
    }

    // ── Rule engine ───────────────────────────────────────────────────────────
    let all_rules = rules::all_rules();
    let mut check_results: Vec<CheckResult> = Vec::new();
    for rule in &all_rules {
        check_results.extend(rule.check(&ctx));
    }

    // ── Semantic analysis ─────────────────────────────────────────────────────
    let analyzer = semantic::factory::from_env();
    let semantic_analysis = match analyzer
        .evaluate(
            ctx.title.as_deref().unwrap_or(""),
            ctx.meta_description.as_deref().unwrap_or(""),
            &ctx.text_content,
        )
        .await
    {
        Ok(a) => Some(a),
        Err(e) => {
            warn!("Semantic analysis failed: {e}");
            None
        }
    };

    // ── Score ─────────────────────────────────────────────────────────────────
    let score = compute_score(&check_results, semantic_analysis.as_ref());

    let result = EngineResult {
        url: url.to_string(),
        page_context: ctx,
        check_results,
        semantic_analysis,
        score,
        timestamp: Utc::now().to_rfc3339(),
    };

    info!(url, score, "Analysis complete");
    Ok(result)
}

/// Compute a 0–100 score based on passed checks and semantic score.
fn compute_score(results: &[CheckResult], semantic: Option<&SemanticAnalysis>) -> u32 {
    if results.is_empty() {
        return 0;
    }

    let error_weight = 3u32;
    let warning_weight = 2u32;
    let info_weight = 1u32;

    let (total_weight, passed_weight) = results.iter().fold((0u32, 0u32), |(t, p), r| {
        let w = match r.severity {
            Severity::Error => error_weight,
            Severity::Warning => warning_weight,
            Severity::Info => info_weight,
        };
        (t + w, p + if r.passed { w } else { 0 })
    });

    let rule_score = if total_weight > 0 {
        (passed_weight as f64 / total_weight as f64 * 90.0) as u32
    } else {
        0
    };

    let semantic_bonus = semantic
        .map(|s| (s.content_score * 10.0) as u32)
        .unwrap_or(0);

    (rule_score + semantic_bonus).min(100)
}
