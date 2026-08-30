use aviary_engine::{run_analysis, config::EngineConfig, init_telemetry};

#[path = "common/mod.rs"]
mod common;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();
    // Installs the meter provider so crawler_latency_ms is actually
    // recorded instead of going to the SDK's no-op default meter.
    let _prometheus_registry = init_telemetry();

    let base_url = common::spawn_fixture_server().await;
    let config = EngineConfig::default();
    println!("🚀 Launching Rust-Native SEO Analysis (Fast Path) on {base_url} (local fixture)...");

    let result = run_analysis(&base_url, &config).await?;
    
    println!("\n📊 Analysis Complete!");
    println!("URL: {}", result.url);
    match result.score {
        Some(score) => println!("Score: {score}/100"),
        None => println!("Score: N/A (no checks applicable)"),
    }
    println!("Passed: {}", result.check_results.iter().filter(|r| r.passed).count());
    println!("Failed: {}", result.check_results.iter().filter(|r| !r.passed).count());
    
    println!("\n🔍 Failed Checks Detail:");
    for check in result.check_results.iter().filter(|r| !r.passed) {
        println!("  - [{:?}] {}", check.severity, check.message);
    }
    
    if let Some(semantic) = result.semantic_analysis {
        println!("\n🤖 Semantic Analysis (Intent coherence):");
        println!("  - Intent Coherent: {}", semantic.intent_coherent);
        println!("  - Content Score: {:.2}", semantic.content_score);
        println!("  - Suggestions: {:?}", semantic.suggestions);
    }

    Ok(())
}
