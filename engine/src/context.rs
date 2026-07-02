use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Information about an image found on the page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageInfo {
    pub src: String,
    pub alt: Option<String>,
    pub width: Option<String>,
    pub height: Option<String>,
}

/// All data extracted from a crawled page, passed to every rule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageContext {
    /// The final URL (after redirects).
    pub url: String,
    /// Raw HTML source.
    pub html: String,
    /// Contents of `<title>`.
    pub title: Option<String>,
    /// Contents of `<meta name="description">`.
    pub meta_description: Option<String>,
    /// Href of the canonical `<link>` tag.
    pub canonical: Option<String>,
    /// All headings as `(tag_name, text)` pairs, e.g. `("h1", "Hello")`.
    pub headings: Vec<(String, String)>,
    /// All `<a href>` values found on the page.
    pub links: Vec<String>,
    /// All `<img>` elements.
    pub images: Vec<ImageInfo>,
    /// Open Graph tags, keyed by the property suffix, e.g. `"title"`.
    pub og_tags: HashMap<String, String>,
    /// Twitter card tags, keyed by the name suffix, e.g. `"card"`.
    pub twitter_tags: HashMap<String, String>,
    /// All inline JSON-LD `<script type="application/ld+json">` blocks parsed.
    pub json_ld: Vec<serde_json::Value>,
    /// HTTP response headers (lower-cased keys).
    pub response_headers: HashMap<String, String>,
    /// HTTP status code.
    pub status_code: u16,
    /// Round-trip time in milliseconds.
    pub load_time_ms: u64,
    /// Extracted plain-text content (whitespace-normalised).
    pub text_content: String,
    /// `"https"` or `"http"`.
    pub protocol: String,
    /// Contents of `<meta name="viewport">`.
    pub viewport: Option<String>,
    /// Contents of `<meta name="robots">`.
    pub robots_meta: Option<String>,
}
