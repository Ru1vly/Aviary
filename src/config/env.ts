// 12-Factor App: Config from Environment
export interface EnvConfig {
  url?: string;
  headless?: boolean;
  timeout?: number;
  viewport?: string;
  preset?: 'basic' | 'advanced' | 'strict';
  output?: string;
  htmlOutput?: string;
  logLevel?: string;
  llmProvider?: string; // E2E_SEO_LLM_PROVIDER
  llmEndpoint?: string; // E2E_SEO_LLM_ENDPOINT
  llmModel?: string; // E2E_SEO_LLM_MODEL
  llmApiKey?: string; // E2E_SEO_LLM_API_KEY (never logged)
}

export function loadEnvConfig(): EnvConfig {
  return {
    url: process.env.E2E_SEO_URL,
    headless: process.env.E2E_SEO_HEADLESS ? process.env.E2E_SEO_HEADLESS !== 'false' : undefined,
    timeout: process.env.E2E_SEO_TIMEOUT ? parseInt(process.env.E2E_SEO_TIMEOUT) : undefined,
    viewport: process.env.E2E_SEO_VIEWPORT,
    preset: process.env.E2E_SEO_PRESET as EnvConfig['preset'],
    output: process.env.E2E_SEO_OUTPUT,
    htmlOutput: process.env.E2E_SEO_HTML_OUTPUT,
    logLevel: process.env.E2E_SEO_LOG_LEVEL || 'info',
    llmProvider: process.env.E2E_SEO_LLM_PROVIDER || 'stub',
    llmEndpoint: process.env.E2E_SEO_LLM_ENDPOINT || 'http://localhost:11434',
    llmModel: process.env.E2E_SEO_LLM_MODEL || 'llama3.2',
    llmApiKey: process.env.E2E_SEO_LLM_API_KEY,
  };
}
