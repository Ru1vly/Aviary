//! `aviary-engine` — Dual-engine SEO analysis library.
//!
//! # Quick start
//!
//! ```rust,no_run
//! use aviary_engine::{run_analysis, config::EngineConfig};
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let config = EngineConfig::default();
//!     let result = run_analysis("https://example.com", &config).await?;
//!     println!("Score: {:?}/100", result.score);
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
use std::sync::OnceLock;
use opentelemetry::{global, metrics::Histogram};

/// Installs the process-wide OpenTelemetry meter provider backing
/// `metrics()`. Must run once, before the first `metrics()` call, or every
/// recorded metric silently goes to the SDK's no-op default meter instead
/// of the Prometheus registry this returns — callers are responsible for
/// exposing that registry (e.g. via an HTTP `/metrics` endpoint).
pub fn init_telemetry() -> prometheus::Registry {
    let registry = prometheus::Registry::new();
    if let Ok(exporter) = opentelemetry_prometheus::exporter().with_registry(registry.clone()).build() {
        let provider = opentelemetry_sdk::metrics::SdkMeterProvider::builder().with_reader(exporter).build();
        global::set_meter_provider(provider);
    }
    registry
}

pub struct EngineMetrics {
    pub crawler_latency_ms: Histogram<f64>,
}

pub fn metrics() -> &'static EngineMetrics {
    static METRICS: OnceLock<EngineMetrics> = OnceLock::new();
    METRICS.get_or_init(|| {
        let meter = global::meter("aviary_engine");
        EngineMetrics {
            crawler_latency_ms: meter.f64_histogram("crawler_latency_ms").build(),
        }
    })
}

/// The complete result of analysing a single URL.
#[derive(Debug, Serialize, Deserialize)]
pub struct EngineResult {
    pub url: String,
    pub page_context: PageContext,
    pub check_results: Vec<CheckResult>,
    pub semantic_analysis: Option<SemanticAnalysis>,
    /// The full Node CLI SEOReport (all 28 checkers, run against the
    /// JS-rendered DOM), present only when `looks_like_spa` triggered the
    /// render fallback and it succeeded. `check_results`/`score` above
    /// still describe the fast-path Rust analysis, not this report —
    /// callers that get a `node_report` should prefer it, since it's the
    /// strictly more complete result.
    pub node_report: Option<serde_json::Value>,
    /// Overall SEO score 0–100, computed identically to the TS engine's
    /// `calculateWeightedScore` (src/scoring.ts) so the two agree on shared
    /// fixtures. `None` when no rule produced a result to weight — not 0,
    /// which would misreport "everything failed", and not 100, which would
    /// misreport "everything passed".
    pub score: Option<u32>,
    /// Ollama-derived semantic/content-quality score (0.0–1.0), kept
    /// separate from `score` rather than folded into it — TS has no
    /// equivalent LLM-judged input, so blending it into the shared score
    /// would make the two engines' scores incomparable by construction.
    /// `None` when semantic analysis didn't run or failed.
    pub semantic_score: Option<f32>,
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
    let trace_id = uuid::Uuid::new_v4().to_string();
    let _span = tracing::info_span!("run_analysis", trace_id = %trace_id).entered();
    info!(url, trace_id = %trace_id, "Starting SEO analysis");

    // ── Fast path ─────────────────────────────────────────────────────────────
    let raw = crawler::fetch(url, config)
        .await
        .with_context(|| format!("Failed to fetch {url}"))?;

    let ctx = crawler::parser::parse(raw, url)
        .context("Failed to parse HTML")?;

    // ── Render path (SPA fallback) ────────────────────────────────────────────
    // The Node CLI's SEOReport has no `html` field, so an earlier version of
    // this code that looked for one to re-parse in Rust was a permanent
    // no-op. Re-parsing rendered HTML through the Rust parser would also
    // throw away the very thing the fallback exists for: the Node/Playwright
    // side already ran the full 28-checker audit against the JS-rendered
    // DOM, which the 4-category Rust rule engine can't reproduce from HTML
    // text alone. So the fallback's result is kept as-is (see
    // `EngineResult::node_report`) rather than fed back into `ctx` — the
    // fast-path `ctx` and its Rust rule results below still reflect the
    // pre-render HTTP fetch.
    let mut node_report: Option<serde_json::Value> = None;
    if config.auto_render_fallback && crawler::renderer::looks_like_spa(&ctx) {
        warn!(url, "SPA detected — falling back to Node renderer");
        match crawler::renderer::render_via_node(url, &config.node_cli_path, config.render_timeout_ms).await {
            Ok(json_str) => match serde_json::from_str::<serde_json::Value>(&json_str) {
                Ok(val) => node_report = Some(val),
                Err(e) => warn!("Node renderer returned invalid JSON: {e}"),
            },
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
    let semantic_score = semantic_analysis.as_ref().map(|s| s.content_score);
    let score = compute_score(&check_results);

    let result = EngineResult {
        url: url.to_string(),
        page_context: ctx,
        check_results,
        semantic_analysis,
        node_report,
        score,
        semantic_score,
        timestamp: Utc::now().to_rfc3339(),
    };

    info!(url, score = score.unwrap_or(0), "Analysis complete");
    Ok(result)
}

/// Compute a 0–100 severity-weighted pass rate, matching TS's
/// `calculateWeightedScore` (src/scoring.ts) exactly: error/warning/info
/// weight 3/1/0.5, `None` when nothing was checked. No fixed-point cap and
/// no LLM bonus folded in — see `EngineResult::semantic_score`.
fn compute_score(results: &[CheckResult]) -> Option<u32> {
    let error_weight = 3.0f64;
    let warning_weight = 1.0f64;
    let info_weight = 0.5f64;

    let (total_weight, passed_weight) = results.iter().fold((0.0f64, 0.0f64), |(t, p), r| {
        let w = match r.severity {
            Severity::Error => error_weight,
            Severity::Warning => warning_weight,
            Severity::Info => info_weight,
        };
        (t + w, p + if r.passed { w } else { 0.0 })
    });

    if total_weight == 0.0 {
        return None;
    }

    Some((passed_weight / total_weight * 100.0).round() as u32)
}
