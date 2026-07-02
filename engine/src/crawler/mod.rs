use std::collections::HashMap;
use std::time::Instant;

use anyhow::{Context, Result};
use tracing::debug;

use crate::config::EngineConfig;

/// Fetch a URL with plain HTTP and return raw bytes + headers + timing.
pub async fn fetch(url: &str, config: &EngineConfig) -> Result<RawResponse> {
    let client = reqwest::Client::builder()
        .user_agent(&config.user_agent)
        .timeout(std::time::Duration::from_millis(config.timeout_ms))
        .redirect(reqwest::redirect::Policy::limited(10))
        .gzip(true)
        .brotli(true)
        .build()
        .context("Failed to build HTTP client")?;

    let t0 = Instant::now();
    let response = client
        .get(url)
        .send()
        .await
        .with_context(|| format!("GET request failed for {url}"))?;

    let status = response.status().as_u16();
    let headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| {
            (
                k.as_str().to_ascii_lowercase(),
                v.to_str().unwrap_or("").to_string(),
            )
        })
        .collect();

    let html = response
        .text()
        .await
        .context("Failed to read response body")?;

    let load_time_ms = t0.elapsed().as_millis() as u64;
    debug!(url, status, load_time_ms, "Fetched page");

    Ok(RawResponse {
        html,
        headers,
        status_code: status,
        load_time_ms,
    })
}

/// Raw HTTP response before DOM parsing.
pub struct RawResponse {
    pub html: String,
    pub headers: HashMap<String, String>,
    pub status_code: u16,
    pub load_time_ms: u64,
}

pub mod parser;
pub mod renderer;
