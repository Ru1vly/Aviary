//! Shared local HTTP fixture server for `engine/examples/*.rs`.
//!
//! Both `run_audit.rs` and `concurrency_test.rs` used to fetch a real,
//! unrelated third-party site (including firing 500 concurrent requests at
//! it from `concurrency_test.rs`) every time they ran. Serving a fixed page
//! from an in-process listener instead makes both examples self-contained,
//! deterministic, and no longer an unauthorized load test against someone
//! else's server.

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

// Body text is deliberately kept above 50 words: renderer::looks_like_spa
// treats a page with fewer than 50 words as SPA-shaped and triggers the
// Node-renderer fallback, which isn't built in this example's environment.
// These examples are meant to exercise the fast path; the fallback path
// gets its own dedicated hardening/tests rather than incidental exercise
// here.
const FIXTURE_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
  <title>Fixture Page for aviary-engine Examples</title>
  <meta name="description" content="A local fixture page used by aviary-engine's examples instead of a real third-party site.">
  <link rel="canonical" href="http://localhost/">
</head>
<body>
  <h1>Fixture Page</h1>
  <p>
    This page is served locally so that aviary-engine's examples do not send
    any requests to a real third-party website. It exists purely to give the
    fast-path crawler and rule engine something realistic to parse: a title,
    a meta description, a canonical link, a heading, and enough ordinary
    paragraph text that the SPA-detection heuristic in the renderer module
    does not mistake this static fixture for a JavaScript-rendered
    single-page application, which would otherwise trigger an unnecessary
    fallback to the Node renderer during a simple example run.
  </p>
</body>
</html>"#;

/// Starts a minimal HTTP/1.1 server on an OS-assigned localhost port that
/// serves `FIXTURE_HTML` for any request, and returns its base URL. The
/// server runs for the lifetime of the process (fine for a short-lived
/// example binary).
pub async fn spawn_fixture_server() -> String {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind fixture listener");
    let addr = listener.local_addr().expect("fixture listener local addr");

    tokio::spawn(async move {
        loop {
            let Ok((mut socket, _)) = listener.accept().await else {
                continue;
            };
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                // The fixture ignores the request entirely, but still needs to
                // read it off the socket before writing a response.
                let _ = socket.read(&mut buf).await;
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    FIXTURE_HTML.len(),
                    FIXTURE_HTML
                );
                let _ = socket.write_all(response.as_bytes()).await;
                let _ = socket.shutdown().await;
            });
        }
    });

    format!("http://{addr}")
}
