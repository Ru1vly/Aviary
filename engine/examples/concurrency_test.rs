use aviary_engine::{crawler::fetch, config::EngineConfig};
use tokio::task::JoinSet;

#[tokio::main]
async fn main() {
    let config = EngineConfig::default();
    println!("🚀 Launching 500 concurrent fetch requests to https://www.kodfikirsanat.com...");
    
    let mut set = JoinSet::new();
    for _ in 0..500 {
        let cfg = config.clone();
        set.spawn(async move {
            fetch("https://www.kodfikirsanat.com", &cfg).await.ok()
        });
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
