/// Engine configuration, populated from environment variables with sensible defaults.
#[derive(Debug, Clone)]
pub struct EngineConfig {
    /// HTTP User-Agent string.
    pub user_agent: String,
    /// Total request timeout in milliseconds.
    pub timeout_ms: u64,
    /// Path to the Node CLI script (for the render path).
    pub node_cli_path: String,
    /// Whether to automatically fall back to the Node renderer for SPAs.
    pub auto_render_fallback: bool,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            user_agent: std::env::var("AVIARY_USER_AGENT").unwrap_or_else(|_| {
                "Mozilla/5.0 (compatible; aviary-engine/0.1; +https://github.com/aviary)"
                    .to_string()
            }),
            timeout_ms: std::env::var("AVIARY_TIMEOUT_MS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(15_000),
            node_cli_path: std::env::var("AVIARY_NODE_CLI")
                .unwrap_or_else(|_| "dist/cli.js".to_string()),
            auto_render_fallback: std::env::var("AVIARY_AUTO_RENDER")
                .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
                .unwrap_or(true),
        }
    }
}
