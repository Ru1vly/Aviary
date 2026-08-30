use std::collections::HashMap;

use anyhow::Result;
use scraper::{Html, Selector};
use tracing::warn;
use url::Url;

use crate::context::{ImageInfo, PageContext};
use super::RawResponse;

/// Parse a raw HTTP response into a fully-populated `PageContext`.
pub fn parse(raw: RawResponse, page_url: &str) -> Result<PageContext> {
    let document = Html::parse_document(&raw.html);

    let title = extract_title(&document);
    let meta_description = extract_meta_name(&document, "description");
    let viewport = extract_meta_name(&document, "viewport");
    let robots_meta = extract_meta_name(&document, "robots");
    let canonical = extract_canonical(&document);
    let headings = extract_headings(&document);
    let links = extract_links(&document);
    let images = extract_images(&document);
    let og_tags = extract_og_tags(&document);
    let twitter_tags = extract_twitter_tags(&document);
    let json_ld = extract_json_ld(&document);
    let text_content = extract_text(&document);

    let protocol = Url::parse(page_url)
        .ok()
        .map(|u| u.scheme().to_string())
        .unwrap_or_else(|| "http".into());

    Ok(PageContext {
        url: page_url.to_string(),
        html: raw.html,
        title,
        meta_description,
        canonical,
        headings,
        links,
        images,
        og_tags,
        twitter_tags,
        json_ld,
        response_headers: raw.headers,
        status_code: raw.status_code,
        load_time_ms: raw.load_time_ms,
        text_content,
        protocol,
        viewport,
        robots_meta,
    })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn extract_title(doc: &Html) -> Option<String> {
    let sel = Selector::parse("title").ok()?;
    doc.select(&sel)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
        .filter(|s| !s.is_empty())
}

fn extract_meta_name(doc: &Html, name: &str) -> Option<String> {
    let sel = Selector::parse(&format!("meta[name=\"{name}\"]")).ok()?;
    doc.select(&sel)
        .next()
        .and_then(|el| el.value().attr("content").map(str::to_string))
}

fn extract_canonical(doc: &Html) -> Option<String> {
    let sel = Selector::parse("link[rel=\"canonical\"]").ok()?;
    doc.select(&sel)
        .next()
        .and_then(|el| el.value().attr("href").map(str::to_string))
}

fn extract_headings(doc: &Html) -> Vec<(String, String)> {
    // A single "h1, h2, h3, h4, h5, h6" selector (rather than one pass per
    // tag) is what makes `doc.select` yield headings in document order —
    // querying tag-by-tag would instead group all h1s, then all h2s, etc.,
    // destroying the order the hierarchy rule needs to detect real skips.
    let sel = match Selector::parse("h1, h2, h3, h4, h5, h6") {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    doc.select(&sel)
        .map(|el| {
            let tag = el.value().name().to_string();
            let text = el.text().collect::<String>().trim().to_string();
            (tag, text)
        })
        .collect()
}

fn extract_links(doc: &Html) -> Vec<String> {
    let sel = match Selector::parse("a[href]") {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    doc.select(&sel)
        .filter_map(|el| el.value().attr("href").map(str::to_string))
        .collect()
}

fn extract_images(doc: &Html) -> Vec<ImageInfo> {
    let sel = match Selector::parse("img") {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    doc.select(&sel)
        .filter_map(|el| {
            el.value().attr("src").map(|src| ImageInfo {
                src: src.to_string(),
                alt: el.value().attr("alt").map(str::to_string),
                width: el.value().attr("width").map(str::to_string),
                height: el.value().attr("height").map(str::to_string),
            })
        })
        .collect()
}

fn extract_og_tags(doc: &Html) -> HashMap<String, String> {
    let sel = match Selector::parse("meta[property^=\"og:\"]") {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };
    let mut map = HashMap::new();
    for el in doc.select(&sel) {
        if let (Some(prop), Some(content)) = (
            el.value().attr("property"),
            el.value().attr("content"),
        ) {
            let key = prop.trim_start_matches("og:").to_string();
            map.insert(key, content.to_string());
        }
    }
    map
}

fn extract_twitter_tags(doc: &Html) -> HashMap<String, String> {
    let sel = match Selector::parse("meta[name^=\"twitter:\"]") {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };
    let mut map = HashMap::new();
    for el in doc.select(&sel) {
        if let (Some(name), Some(content)) = (
            el.value().attr("name"),
            el.value().attr("content"),
        ) {
            let key = name.trim_start_matches("twitter:").to_string();
            map.insert(key, content.to_string());
        }
    }
    map
}

fn extract_json_ld(doc: &Html) -> Vec<serde_json::Value> {
    let sel = match Selector::parse("script[type=\"application/ld+json\"]") {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let mut results = Vec::new();
    for el in doc.select(&sel) {
        let raw = el.text().collect::<String>();
        match serde_json::from_str::<serde_json::Value>(&raw) {
            Ok(v) => results.push(v),
            Err(e) => warn!("Failed to parse JSON-LD block: {e}"),
        }
    }
    results
}

fn extract_text(doc: &Html) -> String {
    let sel = match Selector::parse("body") {
        Ok(s) => s,
        Err(_) => return String::new(),
    };
    let excluded_sel = match Selector::parse("script, style, noscript") {
        Ok(s) => s,
        Err(_) => return String::new(),
    };

    let Some(body) = doc.select(&sel).next() else {
        return String::new();
    };

    // Node ids of every script/style/noscript element under <body>, so a
    // text node can be skipped if any of its ancestors is one of them —
    // this is what actually excludes script/style content; the previous
    // implementation collected every text node unconditionally, script and
    // style bodies included.
    let excluded_ids: std::collections::HashSet<_> =
        body.select(&excluded_sel).map(|el| el.id()).collect();

    let mut text = String::new();
    for node in body.descendants() {
        if let scraper::node::Node::Text(t) = node.value() {
            if node.ancestors().any(|a| excluded_ids.contains(&a.id())) {
                continue;
            }
            let s = t.trim();
            if !s.is_empty() {
                if !text.is_empty() {
                    text.push(' ');
                }
                text.push_str(s);
            }
        }
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Regression test for the abandoned `extract_text` implementation:
    /// script/style/noscript content was previously included in every word
    /// count, content-to-html ratio, and the `looks_like_spa` heuristic.
    #[test]
    fn extract_text_excludes_script_and_style_content() {
        let html = r#"
            <html><body>
                <h1>Real heading text</h1>
                <script>var shouldNotAppear = "in the extracted text";</script>
                <style>.also-should-not-appear { color: red; }</style>
                <noscript>Enable JavaScript should not appear either</noscript>
                <p>Real paragraph text.</p>
            </body></html>
        "#;
        let doc = Html::parse_document(html);
        let text = extract_text(&doc);

        assert!(text.contains("Real heading text"));
        assert!(text.contains("Real paragraph text."));
        assert!(!text.contains("shouldNotAppear"));
        assert!(!text.contains("also-should-not-appear"));
        assert!(!text.contains("Enable JavaScript"));
    }

    /// Regression test for extract_headings looping tag-by-tag (h1s, then
    /// h2s, ...), which destroyed document order and made a real
    /// out-of-order heading skip unobservable.
    #[test]
    fn extract_headings_preserves_document_order() {
        let html = r#"
            <html><body>
                <h1>Title</h1>
                <h3>Skipped h2</h3>
                <h2>Out of order</h2>
            </body></html>
        "#;
        let doc = Html::parse_document(html);
        let headings = extract_headings(&doc);

        assert_eq!(
            headings,
            vec![
                ("h1".to_string(), "Title".to_string()),
                ("h3".to_string(), "Skipped h2".to_string()),
                ("h2".to_string(), "Out of order".to_string()),
            ]
        );
    }
}
