use crate::context::PageContext;
use super::{CheckResult, Rule, Severity};

/// Checks meta-tag SEO requirements: title, description, canonical, viewport, OG, Twitter.
pub struct MetaTagsRule;

impl Rule for MetaTagsRule {
    fn name(&self) -> &str {
        "meta_tags"
    }

    fn check(&self, ctx: &PageContext) -> Vec<CheckResult> {
        let mut results = Vec::new();

        // ── Title ────────────────────────────────────────────────────────────
        match &ctx.title {
            None => results.push(CheckResult {
                name: "title_present".into(),
                passed: false,
                message: "Page is missing a <title> tag".into(),
                severity: Severity::Error,
                details: None,
            }),
            Some(title) => {
                let len = title.len();
                // Matches TS's checkTitle (src/checkers/metaTags.ts) —
                // the two engines previously disagreed here (this used to
                // accept 10–60), which docs/ACCURACY.md called out as a
                // known divergence rather than a bug to fix, deferred until
                // extract_text's script/style-stripping bug was fixed
                // (word counts feeding into any threshold comparison were
                // unreliable before that).
                let in_range = (30..=60).contains(&len);
                results.push(CheckResult {
                    name: "title_length".into(),
                    passed: in_range,
                    message: if in_range {
                        format!("Title length is {len} characters (30–60)")
                    } else {
                        format!("Title length is {len} characters; should be 30–60")
                    },
                    severity: Severity::Warning,
                    details: Some(serde_json::json!({ "title": title, "length": len })),
                });
            }
        }

        // ── Meta description ────────────────────────────────────────────────
        match &ctx.meta_description {
            None => results.push(CheckResult {
                name: "meta_description_present".into(),
                passed: false,
                message: "Page is missing a meta description".into(),
                severity: Severity::Error,
                details: None,
            }),
            Some(desc) => {
                let len = desc.len();
                // Matches TS's checkMetaDescription — was 50–160.
                let in_range = (120..=160).contains(&len);
                results.push(CheckResult {
                    name: "meta_description_length".into(),
                    passed: in_range,
                    message: if in_range {
                        format!("Meta description length is {len} characters (120–160)")
                    } else {
                        format!("Meta description length is {len} characters; should be 120–160")
                    },
                    severity: Severity::Warning,
                    details: Some(serde_json::json!({ "description": desc, "length": len })),
                });
            }
        }

        // ── Canonical ────────────────────────────────────────────────────────
        results.push(CheckResult {
            name: "canonical_present".into(),
            passed: ctx.canonical.is_some(),
            message: if ctx.canonical.is_some() {
                format!("Canonical URL present: {}", ctx.canonical.as_deref().unwrap_or(""))
            } else {
                "No canonical <link> tag found".into()
            },
            severity: Severity::Warning,
            details: ctx.canonical.as_ref().map(|c| serde_json::json!({ "canonical": c })),
        });

        // ── Viewport ────────────────────────────────────────────────────────
        results.push(CheckResult {
            name: "viewport_present".into(),
            passed: ctx.viewport.is_some(),
            message: if ctx.viewport.is_some() {
                "Viewport meta tag present".into()
            } else {
                "Missing viewport meta tag".into()
            },
            severity: Severity::Error,
            details: ctx.viewport.as_ref().map(|v| serde_json::json!({ "viewport": v })),
        });

        // ── OG tags ──────────────────────────────────────────────────────────
        for og_key in &["title", "description", "image"] {
            let present = ctx.og_tags.contains_key(*og_key);
            results.push(CheckResult {
                name: format!("og_{og_key}_present"),
                passed: present,
                message: if present {
                    format!("og:{og_key} present")
                } else {
                    format!("Missing og:{og_key} Open Graph tag")
                },
                severity: Severity::Warning,
                details: ctx
                    .og_tags
                    .get(*og_key)
                    .map(|v| serde_json::json!({ "value": v })),
            });
        }

        // ── Twitter card ─────────────────────────────────────────────────────
        let has_twitter_card = ctx.twitter_tags.contains_key("card");
        results.push(CheckResult {
            name: "twitter_card_present".into(),
            passed: has_twitter_card,
            message: if has_twitter_card {
                format!(
                    "Twitter card present: {}",
                    ctx.twitter_tags.get("card").map(String::as_str).unwrap_or("")
                )
            } else {
                "Missing twitter:card meta tag".into()
            },
            severity: Severity::Info,
            details: ctx
                .twitter_tags
                .get("card")
                .map(|v| serde_json::json!({ "card": v })),
        });

        results
    }
}
