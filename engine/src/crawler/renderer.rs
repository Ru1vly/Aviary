use anyhow::{Context, Result};
use tokio::process::Command;
use tracing::{debug, warn, info};
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio::net::UnixStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use serde::{Deserialize, Serialize};

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

async fn worker_manager(node_worker_path: String, mut rx: mpsc::Receiver<(String, ReplySender)>) {
    let mut current_id: u64 = 0;
    
    loop {
        // Start worker process
        let socket_path = format!("/tmp/e2e-seo-worker-{}.sock", std::process::id());
        
        let _ = tokio::fs::remove_file(&socket_path).await;

        let mut child = match Command::new("node")
            .arg(&node_worker_path)
            .arg(&socket_path)
            .spawn() {
                Ok(c) => c,
                Err(e) => {
                    warn!("Failed to spawn node worker: {}", e);
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
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
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                continue;
            }
        };
        
        info!("Connected to Node.js worker via {}", socket_path);
        
        let (mut read_half, mut write_half) = stream.into_split();
        let pending = Arc::new(Mutex::new(std::collections::HashMap::<u64, ReplySender>::new()));
        let pending_clone = pending.clone();
        
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

        // Health checker task
        let (ping_tx, mut ping_rx) = mpsc::channel::<()>(1);
        let health_check = tokio::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                if ping_tx.send(()).await.is_err() {
                    break;
                }
            }
        });

        // Handle incoming requests
        loop {
            tokio::select! {
                Some((url, reply)) = rx.recv() => {
                    current_id += 1;
                    pending.lock().await.insert(current_id, reply);
                    
                    let req = WorkerRequest { id: current_id, url };
                    let buf = rmp_serde::to_vec_named(&req).unwrap();
                    
                    if write_half.write_u32(buf.len() as u32).await.is_err() || write_half.write_all(&buf).await.is_err() {
                        break;
                    }
                }
                Some(_) = ping_rx.recv() => {
                    let req = PingRequest { id: 0, msg_type: "ping".to_string() };
                    let buf = rmp_serde::to_vec_named(&req).unwrap();
                    if write_half.write_u32(buf.len() as u32).await.is_err() || write_half.write_all(&buf).await.is_err() {
                        break;
                    }
                }
                _ = &mut reader_handle => {
                    break;
                }
            }
        }
        
        warn!("Worker disconnected, restarting...");
        health_check.abort();
        let _ = child.kill().await;
        
        // Notify pending requests about failure
        let mut lock = pending.lock().await;
        for (_, tx) in lock.drain() {
            let _ = tx.send(Err(anyhow::anyhow!("Worker crashed during request")));
        }
    }
}

pub async fn render_via_node(url: &str, node_cli_path: &str) -> Result<String> {
    debug!(url, node_cli_path, "Sending request to Node renderer pool");
    
    let pool = get_worker_pool(node_cli_path).await;
    
    let (tx, rx) = oneshot::channel();
    pool.sender.send((url.to_string(), tx)).await.map_err(|_| anyhow::anyhow!("Failed to send to pool"))?;
    
    rx.await.with_context(|| format!("Node renderer crashed or failed for {url}"))?
}
