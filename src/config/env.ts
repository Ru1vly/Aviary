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
  llmProvider?: string; // AVIARY_LLM_PROVIDER
  llmEndpoint?: string; // AVIARY_LLM_ENDPOINT
  llmModel?: string; // AVIARY_LLM_MODEL
  llmApiKey?: string; // AVIARY_LLM_API_KEY (never logged)
}

export function loadEnvConfig(): EnvConfig {
  return {
    url: process.env.AVIARY_URL,
    headless: process.env.AVIARY_HEADLESS ? process.env.AVIARY_HEADLESS !== 'false' : undefined,
    timeout: process.env.AVIARY_TIMEOUT ? parseInt(process.env.AVIARY_TIMEOUT) : undefined,
    viewport: process.env.AVIARY_VIEWPORT,
    preset: process.env.AVIARY_PRESET as EnvConfig['preset'],
    output: process.env.AVIARY_OUTPUT,
    htmlOutput: process.env.AVIARY_HTML_OUTPUT,
    logLevel: process.env.AVIARY_LOG_LEVEL || 'info',
    llmProvider: process.env.AVIARY_LLM_PROVIDER || 'stub',
    llmEndpoint: process.env.AVIARY_LLM_ENDPOINT || 'http://localhost:11434',
    llmModel: process.env.AVIARY_LLM_MODEL || 'llama3.2',
    llmApiKey: process.env.AVIARY_LLM_API_KEY,
  };
}
