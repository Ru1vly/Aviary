use anyhow::{Context, Result};
use tokio::process::Command;
use tracing::{debug, warn};

use crate::context::PageContext;

/// Detect whether the fast-path result looks like a SPA (minimal content, JS framework signals).
pub fn looks_like_spa(ctx: &PageContext) -> bool {
    let word_count = ctx.text_content.split_whitespace().count();
    if word_count < 50 {
        return true;
    }
    // Check for common SPA root markers in the raw HTML.
    let html_lower = ctx.html.to_ascii_lowercase();
    let spa_markers = [
        "id=\"root\"",
        "id=\"app\"",
        "id=\"__next\"",
        "data-reactroot",
        "ng-version",
        "data-server-rendered=\"false\"",
    ];
    spa_markers.iter().any(|m| html_lower.contains(m))
}

/// Spawn `node dist/cli.js --url <URL> --json` and return the raw JSON string.
/// Falls back gracefully on failure.
pub async fn render_via_node(url: &str, node_cli_path: &str) -> Result<String> {
    debug!(url, node_cli_path, "Spawning Node renderer");

    let output = Command::new("node")
        .arg(node_cli_path)
        .arg("--url")
        .arg(url)
        .arg("--json")
        .output()
        .await
        .with_context(|| format!("Failed to spawn node process for {url}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        warn!("Node renderer exited with non-zero status: {stderr}");
        anyhow::bail!(
            "Node renderer failed (exit code {:?}): {stderr}",
            output.status.code()
        );
    }

    let stdout = String::from_utf8(output.stdout)
        .context("Node renderer output is not valid UTF-8")?;

    Ok(stdout)
}
