use e2e_seo_engine::{run_analysis, config::EngineConfig};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    let config = EngineConfig::default();
    println!("🚀 Launching Rust-Native SEO Analysis (Fast Path) on https://www.kodfikirsanat.com...");
    
    let result = run_analysis("https://www.kodfikirsanat.com", &config).await?;
    
    println!("\n📊 Analysis Complete!");
    println!("URL: {}", result.url);
    println!("Score: {}/100", result.score);
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
