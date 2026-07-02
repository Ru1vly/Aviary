use crate::context::PageContext;
use serde::{Deserialize, Serialize};

/// Severity level for a check result.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Severity {
    Error,
    Warning,
    Info,
}

/// The outcome of a single SEO rule applied to a page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    pub name: String,
    pub passed: bool,
    pub message: String,
    pub severity: Severity,
    pub details: Option<serde_json::Value>,
}

/// Trait that every SEO rule must implement.
pub trait Rule: Send + Sync {
    /// Short, human-readable name for the rule.
    fn name(&self) -> &str;
    /// Run the rule against the given page context.
    fn check(&self, ctx: &PageContext) -> Vec<CheckResult>;
}

pub mod meta_tags;
pub mod headings;
pub mod security;
pub mod content;

/// Return all built-in rules.
pub fn all_rules() -> Vec<Box<dyn Rule>> {
    vec![
        Box::new(meta_tags::MetaTagsRule),
        Box::new(headings::HeadingsRule),
        Box::new(security::SecurityRule),
        Box::new(content::ContentRule),
    ]
}
