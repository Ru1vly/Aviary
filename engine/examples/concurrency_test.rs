use aviary_engine::{crawler::fetch, config::EngineConfig};
use tokio::task::JoinSet;

#[path = "common/mod.rs"]
mod common;

#[tokio::main]
async fn main() {
    let base_url = common::spawn_fixture_server().await;
    let config = EngineConfig::default();
    println!("🚀 Launching 500 concurrent fetch requests to {base_url} (local fixture)...");

    let mut set = JoinSet::new();
    for _ in 0..500 {
        let cfg = config.clone();
        let url = base_url.clone();
        set.spawn(async move { fetch(&url, &cfg).await.ok() });
    }
    
    let mut successful = 0;
    while let Some(res) = set.join_next().await {
        if let Ok(Some(_)) = res {
            successful += 1;
        }
    }
    
    println!("✅ Stress test complete!");
    println!("Total successful concurrent connections: {}", successful);
}
