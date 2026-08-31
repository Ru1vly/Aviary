use anyhow::{Context, Result};
use tokio::process::Command;
use tracing::{debug, warn, info};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, oneshot};
use tokio::sync::Mutex as AsyncMutex;
use tokio::net::UnixStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use serde::{Deserialize, Serialize};

use crate::context::PageContext;

/// Detect whether the fast-path result looks like a SPA (minimal content, JS framework signals).
///
/// Word count alone is not a reliable signal — plenty of legitimate static
/// pages (landing pages, example.com-style stubs) have well under 50 words
/// of text. Low word count only means "render this" when paired with an
/// actual SPA framework marker, or when the body is empty outright.
pub fn looks_like_spa(ctx: &PageContext) -> bool {
    let word_count = ctx.text_content.split_whitespace().count();
    let html_lower = ctx.html.to_ascii_lowercase();
    let spa_markers = [
        "id=\"root\"",
        "id=\"app\"",
        "id=\"__next\"",
        "data-reactroot",
        "ng-version",
        "data-server-rendered=\"false\"",
    ];
    let has_marker = spa_markers.iter().any(|m| html_lower.contains(m));
    has_marker || word_count == 0
}

#[derive(Serialize)]
struct WorkerRequest {
    id: u64,
    url: String,
}

#[derive(Serialize)]
struct PingRequest {
    id: u64,
    #[serde(rename = "type")]
    msg_type: String,
}

#[derive(Deserialize, Debug)]
struct WorkerResponse {
    id: u64,
    success: Option<bool>,
    report: Option<serde_json::Value>,
    error: Option<String>,
    #[serde(rename = "type")]
    msg_type: Option<String>,
}

type ReplySender = oneshot::Sender<Result<String>>;

struct WorkerPool {
    sender: mpsc::Sender<(String, ReplySender)>,
}

static WORKER_POOL: tokio::sync::OnceCell<WorkerPool> = tokio::sync::OnceCell::const_new();

async fn get_worker_pool(node_cli_path: &str) -> &'static WorkerPool {
    let path = node_cli_path.replace("cli.js", "worker.js");
    WORKER_POOL.get_or_init(|| async move {
        let (tx, rx) = mpsc::channel(100);
        tokio::spawn(worker_manager(path, rx));
        WorkerPool { sender: tx }
    }).await
}

/// Backoff schedule for worker respawn attempts: without this, a worker
/// that fails immediately on every launch (missing `dist/worker.js`, a
/// crash loop, ...) gets relaunched in a tight ~1s loop indefinitely.
const BACKOFF_SCHEDULE_MS: [u64; 6] = [500, 1_000, 2_000, 4_000, 8_000, 16_000];
const MAX_BACKOFF_MS: u64 = 30_000;

fn backoff_delay(consecutive_failures: u32) -> Duration {
    let idx = (consecutive_failures as usize).min(BACKOFF_SCHEDULE_MS.len() - 1);
    Duration::from_millis(BACKOFF_SCHEDULE_MS[idx].min(MAX_BACKOFF_MS))
}

const PING_INTERVAL: Duration = Duration::from_secs(5);
/// A connection that hasn't produced a pong (or any other message — see the
/// reader task) in this long is presumed hung rather than merely slow, and
/// gets torn down and respawned.
const PONG_TIMEOUT: Duration = Duration::from_secs(20);

async fn worker_manager(node_worker_path: String, mut rx: mpsc::Receiver<(String, ReplySender)>) {
    let mut current_id: u64 = 0;
    let mut consecutive_failures: u32 = 0;

    loop {
        // A freshly created, unpredictable temp directory (rather than a
        // fixed `/tmp/aviary-worker-<pid>.sock` path) avoids both path
        // guessing and stale-socket collisions across restarts; kept alive
        // for this iteration so it isn't cleaned up while the worker is
        // still using it.
        let worker_dir = match tempfile::Builder::new().prefix("aviary-worker-").tempdir() {
            Ok(d) => d,
            Err(e) => {
                warn!("Failed to create worker temp dir: {e}");
                consecutive_failures += 1;
                tokio::time::sleep(backoff_delay(consecutive_failures)).await;
                continue;
            }
        };
        let socket_path = worker_dir.path().join("worker.sock");

        let mut child = match Command::new("node")
            .arg(&node_worker_path)
            .arg(&socket_path)
            // Without this, a worker survives its parent's exit whenever the
            // host process is torn down without ever reaching the explicit
            // `child.kill()` below (e.g. normal process exit while this task
            // is still in its steady-state select loop) — it gets reparented
            // to init and keeps running, along with its inherited stdio fds.
            .kill_on_drop(true)
            .spawn() {
                Ok(c) => c,
                Err(e) => {
                    warn!("Failed to spawn node worker: {}", e);
                    consecutive_failures += 1;
                    tokio::time::sleep(backoff_delay(consecutive_failures)).await;
                    continue;
                }
            };

        // Wait for socket to be created
        let mut stream_opt = None;
        for _ in 0..50 {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            if let Ok(s) = UnixStream::connect(&socket_path).await {
                stream_opt = Some(s);
                break;
            }
            if let Ok(Some(status)) = child.try_wait() {
                warn!("Worker process exited prematurely: {:?}", status);
                break;
            }
        }

        let stream = match stream_opt {
            Some(s) => s,
            None => {
                warn!("Failed to connect to worker socket");
                let _ = child.kill().await;
                consecutive_failures += 1;
                tokio::time::sleep(backoff_delay(consecutive_failures)).await;
                continue;
            }
        };

        info!("Connected to Node.js worker via {}", socket_path.display());
        consecutive_failures = 0;

        let (mut read_half, mut write_half) = stream.into_split();
        let pending = Arc::new(AsyncMutex::new(std::collections::HashMap::<u64, ReplySender>::new()));
        let pending_clone = pending.clone();
        let last_activity = Arc::new(Mutex::new(Instant::now()));
        let last_activity_reader = last_activity.clone();

        // Reader task
        let mut reader_handle = tokio::spawn(async move {
            loop {
                let len = match read_half.read_u32().await {
                    Ok(l) => l,
                    Err(_) => break,
                };
                let mut buf = vec![0u8; len as usize];
                if read_half.read_exact(&mut buf).await.is_err() {
                    break;
                }

                if let Ok(resp) = rmp_serde::from_slice::<WorkerResponse>(&buf) {
                    // Any message — not just a pong — proves the worker is
                    // alive and responsive, so it resets the watchdog too.
                    *last_activity_reader.lock().expect("last_activity poisoned") = Instant::now();

                    if let Some(msg_type) = resp.msg_type {
                        if msg_type == "pong" {
                            continue;
                        }
                    }

                    let mut lock = pending_clone.lock().await;
                    if let Some(tx) = lock.remove(&resp.id) {
                        if resp.success == Some(true) {
                            let json_str = serde_json::to_string(&resp.report).unwrap_or_default();
                            let _ = tx.send(Ok(json_str));
                        } else {
                            let _ = tx.send(Err(anyhow::anyhow!("Worker error: {:?}", resp.error)));
                        }
                    }
                }
            }
        });

        let mut ping_interval = tokio::time::interval(PING_INTERVAL);
        ping_interval.tick().await; // consume the immediate first tick

        // Handle incoming requests
        loop {
            tokio::select! {
                Some((url, reply)) = rx.recv() => {
                    current_id += 1;
                    pending.lock().await.insert(current_id, reply);

                    let req = WorkerRequest { id: current_id, url };
                    let buf = match rmp_serde::to_vec_named(&req) {
                        Ok(b) => b,
                        Err(e) => {
                            warn!("Failed to serialize worker request: {e}");
                            if let Some(tx) = pending.lock().await.remove(&current_id) {
                                let _ = tx.send(Err(anyhow::anyhow!("Failed to serialize request: {e}")));
                            }
                            continue;
                        }
                    };

                    if write_half.write_u32(buf.len() as u32).await.is_err() || write_half.write_all(&buf).await.is_err() {
                        break;
                    }
                }
                _ = ping_interval.tick() => {
                    let idle = last_activity.lock().expect("last_activity poisoned").elapsed();
                    if idle > PONG_TIMEOUT {
                        warn!("Worker unresponsive for {idle:?}, forcing reconnect");
                        break;
                    }

                    let req = PingRequest { id: 0, msg_type: "ping".to_string() };
                    match rmp_serde::to_vec_named(&req) {
                        Ok(buf) => {
                            if write_half.write_u32(buf.len() as u32).await.is_err() || write_half.write_all(&buf).await.is_err() {
                                break;
                            }
                        }
                        Err(e) => warn!("Failed to serialize ping request: {e}"),
                    }
                }
                _ = &mut reader_handle => {
                    break;
                }
            }
        }

        warn!("Worker disconnected, restarting...");
        reader_handle.abort();
        let _ = child.kill().await;

        // Notify pending requests about failure
        let mut lock = pending.lock().await;
        for (_, tx) in lock.drain() {
            let _ = tx.send(Err(anyhow::anyhow!("Worker crashed during request")));
        }
        drop(lock);

        // worker_dir drops here, cleaning up the temp directory/socket now
        // that the worker is confirmed dead.
    }
}

pub async fn render_via_node(url: &str, node_cli_path: &str, timeout_ms: u64) -> Result<String> {
    debug!(url, node_cli_path, "Sending request to Node renderer pool");

    let pool = get_worker_pool(node_cli_path).await;

    let (tx, rx) = oneshot::channel();
    pool.sender.send((url.to_string(), tx)).await.map_err(|_| anyhow::anyhow!("Failed to send to pool"))?;

    match tokio::time::timeout(Duration::from_millis(timeout_ms), rx).await {
        Ok(recv_result) => recv_result
            .with_context(|| format!("Node renderer crashed or failed for {url}"))?,
        Err(_) => Err(anyhow::anyhow!(
            "Node renderer timed out after {timeout_ms}ms for {url}"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Regression test: `render_via_node` used to have no timeout on
    /// `rx.await`, so a worker that never replies (or, as here, never even
    /// starts — a bogus `node_cli_path`) would hang the caller forever
    /// instead of failing after `timeout_ms`. Bounds how long the call is
    /// allowed to take, independent of however many respawn attempts the
    /// backgrounded `worker_manager` makes in the meantime.
    #[tokio::test]
    async fn render_via_node_times_out_instead_of_hanging() {
        let start = Instant::now();
        let result = render_via_node(
            "http://127.0.0.1:1/does-not-matter",
            "definitely-not-a-real-path/cli.js",
            1_500,
        )
        .await;
        let elapsed = start.elapsed();

        assert!(result.is_err(), "expected a timeout error, got {result:?}");
        assert!(
            result.unwrap_err().to_string().contains("timed out"),
            "expected a timeout-specific error message"
        );
        // Generous upper bound — this is checking "bounded", not exact timing.
        assert!(
            elapsed < Duration::from_secs(5),
            "render_via_node took {elapsed:?}, expected it to give up around 1.5s"
        );
    }
}
