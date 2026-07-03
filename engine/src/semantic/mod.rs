use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tracing::warn;

/// The result of semantic (LLM-based) SEO analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticAnalysis {
    pub intent_coherent: bool,
    /// 0.0 – 1.0 quality score.
    pub content_score: f32,
    pub suggestions: Vec<String>,
    pub provider: String,
}

/// Trait for semantic content analyzers.
#[async_trait]
pub trait SemanticAnalyzer: Send + Sync {
    async fn evaluate(
        &self,
        title: &str,
        description: &str,
        body: &str,
    ) -> anyhow::Result<SemanticAnalysis>;
    fn provider_name(&self) -> &str;
}

// ── Stub ──────────────────────────────────────────────────────────────────────

/// Placeholder analyzer that always returns a neutral result.
pub struct StubAnalyzer;

#[async_trait]
impl SemanticAnalyzer for StubAnalyzer {
    async fn evaluate(
        &self,
        _title: &str,
        _description: &str,
        _body: &str,
    ) -> anyhow::Result<SemanticAnalysis> {
        Ok(SemanticAnalysis {
            intent_coherent: true,
            content_score: 0.5,
            suggestions: vec![
                "Configure a semantic analyzer via E2E_SEO_LLM_PROVIDER env var".to_string(),
            ],
            provider: "stub".to_string(),
        })
    }

    fn provider_name(&self) -> &str {
        "stub"
    }
}

// ── Ollama ────────────────────────────────────────────────────────────────────

/// Analyzer backed by a local Ollama instance.
pub struct OllamaAnalyzer {
    pub endpoint: String,
    pub model: String,
    pub client: reqwest::Client,
}

#[async_trait]
impl SemanticAnalyzer for OllamaAnalyzer {
    async fn evaluate(
        &self,
        title: &str,
        description: &str,
        body: &str,
    ) -> anyhow::Result<SemanticAnalysis> {
        let max_len = 4000;
        let mut body_preview = body;
        if body.len() > max_len {
            let mut end = max_len;
            while end > 0 && !body.is_char_boundary(end) {
                end -= 1;
            }
            body_preview = &body[..end];
            if let Some(last_space) = body_preview.rfind(char::is_whitespace) {
                body_preview = &body_preview[..last_space];
            }
        }
        let prompt = format!(
            "You are an SEO expert. Analyze the following page content for semantic coherence and intent alignment.\n\n\
            Title: {title}\nDescription: {description}\nContent (limited to 4000 chars): {body_preview}\n\n\
            Respond in JSON with fields: intent_coherent (bool), content_score (float 0-1), suggestions (string array)."
        );

        let payload = serde_json::json!({
            "model": self.model,
            "prompt": prompt,
            "stream": false,
            "format": "json"
        });

        let url = format!("{}/api/generate", self.endpoint.trim_end_matches('/'));

        let response = self
            .client
            .post(&url)
            .timeout(std::time::Duration::from_secs(10))
            .json(&payload)
            .send()
            .await;

        let fallback = || SemanticAnalysis {
            intent_coherent: true,
            content_score: 0.5,
            suggestions: vec!["Analysis unavailable due to LLM error/timeout".to_string()],
            provider: format!("ollama/{} (fallback)", self.model),
        };

        match response {
            Ok(resp) => {
                let json = match resp.json::<serde_json::Value>().await {
                    Ok(j) => j,
                    Err(e) => {
                        warn!("Ollama response malformed JSON: {e}");
                        return Ok(fallback());
                    }
                };

                let response_text = json
                    .get("response")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                if response_text.is_empty() {
                    warn!("Ollama response missing 'response' field");
                    return Ok(fallback());
                }

                let parsed: serde_json::Value = match serde_json::from_str(response_text) {
                    Ok(p) => p,
                    Err(e) => {
                        warn!("Ollama inner response malformed JSON: {e}");
                        return Ok(fallback());
                    }
                };

                Ok(SemanticAnalysis {
                    intent_coherent: parsed
                        .get("intent_coherent")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(true),
                    content_score: parsed
                        .get("content_score")
                        .and_then(|v| v.as_f64())
                        .map(|f| f as f32)
                        .unwrap_or(0.5),
                    suggestions: parsed
                        .get("suggestions")
                        .and_then(|v| v.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|s| s.as_str().map(str::to_string))
                                .collect()
                        })
                        .unwrap_or_default(),
                    provider: format!("ollama/{}", self.model),
                })
            }
            Err(e) => {
                warn!("Ollama request failed or timed out: {e}");
                Ok(fallback())
            }
        }
    }

    fn provider_name(&self) -> &str {
        "ollama"
    }
}

pub mod factory;
