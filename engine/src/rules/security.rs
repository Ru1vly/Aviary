use crate::context::PageContext;
use super::{CheckResult, Rule, Severity};

/// Checks HTTPS, mixed content, and security response headers.
pub struct SecurityRule;

impl Rule for SecurityRule {
    fn name(&self) -> &str {
        "security"
    }

    fn check(&self, ctx: &PageContext) -> Vec<CheckResult> {
        let mut results = Vec::new();

        // ── HTTPS ────────────────────────────────────────────────────────────
        let is_https = ctx.protocol == "https";
        results.push(CheckResult {
            name: "https_protocol".into(),
            passed: is_https,
            message: if is_https {
                "Page is served over HTTPS".into()
            } else {
                "Page is NOT served over HTTPS".into()
            },
            severity: Severity::Error,
            details: Some(serde_json::json!({ "protocol": ctx.protocol })),
        });

        // ── Mixed content ────────────────────────────────────────────────────
        // Only relevant on HTTPS pages.
        if is_https {
            // Simple heuristic: look for http:// in src/href attributes of resources.
            let mixed = detect_mixed_content(&ctx.html);
            results.push(CheckResult {
                name: "mixed_content".into(),
                passed: mixed.is_empty(),
                message: if mixed.is_empty() {
                    "No mixed content detected".into()
                } else {
                    format!("Mixed content detected ({} insecure resource(s))", mixed.len())
                },
                severity: Severity::Error,
                details: if mixed.is_empty() {
                    None
                } else {
                    Some(serde_json::json!({ "insecure_resources": mixed }))
                },
            });
        }

        // ── X-Content-Type-Options ───────────────────────────────────────────
        let xcto = ctx
            .response_headers
            .get("x-content-type-options")
            .map(String::as_str)
            .unwrap_or("");
        results.push(CheckResult {
            name: "x_content_type_options".into(),
            passed: xcto.to_ascii_lowercase().contains("nosniff"),
            message: if xcto.is_empty() {
                "X-Content-Type-Options header is missing".into()
            } else {
                format!("X-Content-Type-Options: {xcto}")
            },
            severity: Severity::Warning,
            details: if xcto.is_empty() {
                None
            } else {
                Some(serde_json::json!({ "value": xcto }))
            },
        });

        // ── X-Frame-Options ──────────────────────────────────────────────────
        let xfo = ctx
            .response_headers
            .get("x-frame-options")
            .map(String::as_str)
            .unwrap_or("");
        results.push(CheckResult {
            name: "x_frame_options".into(),
            passed: !xfo.is_empty(),
            message: if xfo.is_empty() {
                "X-Frame-Options header is missing".into()
            } else {
                format!("X-Frame-Options: {xfo}")
            },
            severity: Severity::Warning,
            details: if xfo.is_empty() {
                None
            } else {
                Some(serde_json::json!({ "value": xfo }))
            },
        });

        results
    }
}

/// Returns a list of `http://` resource URLs found in `src` or `href` attributes.
fn detect_mixed_content(html: &str) -> Vec<String> {
    // We do a simple substring scan rather than a full DOM walk for speed.
    let mut found = Vec::new();
    let patterns = [" src=\"http://", " href=\"http://", " src='http://", " href='http://"];
    for pattern in &patterns {
        let mut start = 0;
        while let Some(pos) = html[start..].find(pattern) {
            let abs = start + pos + pattern.len();
            // Grab until closing quote
            let quote = if pattern.ends_with('"') { '"' } else { '\'' };
            if let Some(end) = html[abs..].find(quote) {
                found.push(html[abs..abs + end].to_string());
            }
            start = abs;
        }
    }
    found.sort();
    found.dedup();
    found
}
