use crate::context::PageContext;
use super::{CheckResult, Rule, Severity};

/// Checks word count, content-to-HTML ratio, and basic readability.
pub struct ContentRule;

impl Rule for ContentRule {
    fn name(&self) -> &str {
        "content"
    }

    fn check(&self, ctx: &PageContext) -> Vec<CheckResult> {
        let mut results = Vec::new();
        let text = ctx.text_content.trim();

        // ── Word count ───────────────────────────────────────────────────────
        let word_count = text.split_whitespace().count();
        results.push(CheckResult {
            name: "word_count".into(),
            passed: word_count >= 300,
            message: if word_count >= 300 {
                format!("Word count is {word_count} (≥ 300)")
            } else {
                format!("Word count is {word_count}; at least 300 words recommended")
            },
            severity: Severity::Warning,
            details: Some(serde_json::json!({ "word_count": word_count })),
        });

        // ── Content-to-HTML ratio ────────────────────────────────────────────
        let html_len = ctx.html.len();
        let text_len = text.len();
        let ratio = if html_len > 0 {
            (text_len as f64 / html_len as f64) * 100.0
        } else {
            0.0
        };
        results.push(CheckResult {
            name: "content_to_html_ratio".into(),
            passed: ratio > 10.0,
            message: if ratio > 10.0 {
                format!("Content-to-HTML ratio is {ratio:.1}% (> 10%)")
            } else {
                format!("Content-to-HTML ratio is {ratio:.1}%; above 10% is recommended")
            },
            severity: Severity::Info,
            details: Some(serde_json::json!({
                "text_length": text_len,
                "html_length": html_len,
                "ratio_pct": ratio
            })),
        });

        // ── Readability: average sentence length ────────────────────────────
        let sentence_count = text
            .chars()
            .filter(|&c| c == '.' || c == '!' || c == '?')
            .count()
            .max(1);
        let avg_sentence_words = word_count as f64 / sentence_count as f64;
        let readable = avg_sentence_words <= 25.0;
        results.push(CheckResult {
            name: "readability_sentence_length".into(),
            passed: readable,
            message: if readable {
                format!("Average sentence length is {avg_sentence_words:.1} words (≤ 25)")
            } else {
                format!(
                    "Average sentence length is {avg_sentence_words:.1} words; aim for ≤ 25"
                )
            },
            severity: Severity::Info,
            details: Some(serde_json::json!({
                "avg_sentence_words": avg_sentence_words,
                "sentence_count": sentence_count,
                "word_count": word_count
            })),
        });

        results
    }
}
