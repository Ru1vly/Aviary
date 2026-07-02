use crate::context::PageContext;
use super::{CheckResult, Rule, Severity};

/// Checks heading structure: single H1, non-empty H1, no skipped levels.
pub struct HeadingsRule;

impl Rule for HeadingsRule {
    fn name(&self) -> &str {
        "headings"
    }

    fn check(&self, ctx: &PageContext) -> Vec<CheckResult> {
        let mut results = Vec::new();

        let h1s: Vec<&str> = ctx
            .headings
            .iter()
            .filter(|(tag, _)| tag == "h1")
            .map(|(_, text)| text.as_str())
            .collect();

        // ── Single H1 ────────────────────────────────────────────────────────
        let h1_count = h1s.len();
        results.push(CheckResult {
            name: "single_h1".into(),
            passed: h1_count == 1,
            message: match h1_count {
                0 => "No H1 heading found".into(),
                1 => "Exactly one H1 heading found".into(),
                n => format!("Found {n} H1 headings; only one is recommended"),
            },
            severity: Severity::Error,
            details: Some(serde_json::json!({ "h1_count": h1_count })),
        });

        // ── H1 not empty ─────────────────────────────────────────────────────
        if let Some(h1_text) = h1s.first() {
            let empty = h1_text.trim().is_empty();
            results.push(CheckResult {
                name: "h1_not_empty".into(),
                passed: !empty,
                message: if empty {
                    "H1 heading is empty".into()
                } else {
                    format!("H1 content: \"{}\"", h1_text.trim())
                },
                severity: Severity::Error,
                details: Some(serde_json::json!({ "h1": h1_text })),
            });
        }

        // ── Heading hierarchy ─────────────────────────────────────────────────
        // Collect levels actually present
        let levels: Vec<u8> = ctx
            .headings
            .iter()
            .filter_map(|(tag, _)| {
                tag.strip_prefix('h')
                    .and_then(|n| n.parse::<u8>().ok())
                    .filter(|&n| n >= 1 && n <= 6)
            })
            .collect();

        let mut skip_detected = false;
        let mut prev_level: u8 = 0;
        for &level in &levels {
            if prev_level > 0 && level > prev_level + 1 {
                skip_detected = true;
                break;
            }
            prev_level = level;
        }

        results.push(CheckResult {
            name: "heading_hierarchy".into(),
            passed: !skip_detected,
            message: if skip_detected {
                "Heading levels are skipped (e.g. H1 → H3 without H2)".into()
            } else {
                "Heading hierarchy is valid".into()
            },
            severity: Severity::Warning,
            details: Some(serde_json::json!({ "heading_levels": levels })),
        });

        results
    }
}
