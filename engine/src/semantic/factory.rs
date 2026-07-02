use std::sync::Arc;

use super::{OllamaAnalyzer, SemanticAnalyzer, StubAnalyzer};

/// Construct a `SemanticAnalyzer` from environment variables.
///
/// | Variable                | Default                      |
/// |-------------------------|------------------------------|
/// | `E2E_SEO_LLM_PROVIDER`  | `"stub"`                     |
/// | `E2E_SEO_LLM_ENDPOINT`  | `"http://localhost:11434"`   |
/// | `E2E_SEO_LLM_MODEL`     | `"llama3"`                   |
/// | `E2E_SEO_LLM_API_KEY`   | *(unused for stub/ollama)*   |
pub fn from_env() -> Arc<dyn SemanticAnalyzer> {
    let provider = std::env::var("E2E_SEO_LLM_PROVIDER")
        .unwrap_or_else(|_| "stub".into())
        .to_ascii_lowercase();

    match provider.as_str() {
        "ollama" => {
            let endpoint = std::env::var("E2E_SEO_LLM_ENDPOINT")
                .unwrap_or_else(|_| "http://localhost:11434".into());
            let model = std::env::var("E2E_SEO_LLM_MODEL")
                .unwrap_or_else(|_| "llama3".into());
            let client = reqwest::Client::new();
            Arc::new(OllamaAnalyzer { endpoint, model, client })
        }
        _ => Arc::new(StubAnalyzer),
    }
}
