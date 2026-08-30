use std::collections::HashMap;
use std::time::Instant;
use std::sync::{OnceLock, RwLock};

use anyhow::{Context, Result};
use tracing::debug;

use crate::config::EngineConfig;

// Keyed by (user_agent, timeout_ms) rather than a single OnceLock<Client>:
// a bare OnceLock bakes in whichever EngineConfig the first caller in the
// process happened to pass, silently ignoring every other caller's
// user-agent/timeout for the process's lifetime. Caching per distinct
// config still reuses (and pools connections on) a client across repeated
// calls with the same config — the common case, since EngineConfig is
// usually constructed once from env — while staying correct when it isn't.
static CLIENT_CACHE: OnceLock<RwLock<HashMap<(String, u64), reqwest::Client>>> = OnceLock::new();

fn client_for(config: &EngineConfig) -> reqwest::Client {
    let cache = CLIENT_CACHE.get_or_init(|| RwLock::new(HashMap::new()));
    let key = (config.user_agent.clone(), config.timeout_ms);

    if let Some(client) = cache.read().expect("client cache poisoned").get(&key) {
        return client.clone();
    }

    let mut cache = cache.write().expect("client cache poisoned");
    // Re-check: another task may have built this config's client while we
    // were waiting for the write lock.
    if let Some(client) = cache.get(&key) {
        return client.clone();
    }

    let client = reqwest::Client::builder()
        .user_agent(&config.user_agent)
        .timeout(std::time::Duration::from_millis(config.timeout_ms))
        .redirect(reqwest::redirect::Policy::limited(10))
        .pool_max_idle_per_host(10_000)
        .pool_idle_timeout(std::time::Duration::from_secs(90))
        .gzip(true)
        .brotli(true)
        .build()
        .expect("Failed to build HTTP client");
    cache.insert(key, client.clone());
    client
}

/// Fetch a URL with plain HTTP and return raw bytes + headers + timing.
pub async fn fetch(url: &str, config: &EngineConfig) -> Result<RawResponse> {
    let client = client_for(config);

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
    let trace_id = uuid::Uuid::new_v4().to_string();
    let _span = tracing::info_span!("fetch", trace_id = %trace_id).entered();
    debug!(url, status, load_time_ms, trace_id = %trace_id, "Fetched page");
    crate::metrics().crawler_latency_ms.record(load_time_ms as f64, &[]);

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
