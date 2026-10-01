// 12-Factor App: Config from Environment
export interface EnvConfig {
  url?: string;
  headless?: boolean;
  timeout?: number;
  settleAfterNavigationMs?: number;
  viewport?: string;
  preset?: 'basic' | 'advanced' | 'strict' | 'geo';
  output?: string;
  htmlOutput?: string;
  pdfOutput?: string;
  historyOutput?: string;
  junitOutput?: string;
  sarifOutput?: string;
  markdownOutput?: string;
  csvOutput?: string;
  concurrency?: number;
  failOnFindings?: boolean;
  failOnDuplicateMetadata?: boolean;
  failOnDuplicateContent?: boolean;
  failBelowScore?: number;
  baselineReport?: string;
  failOnRegression?: boolean;
  categories?: string[];
  logLevel?: string;
  llmProvider?: string; // AVIARY_LLM_PROVIDER
  llmEndpoint?: string; // AVIARY_LLM_ENDPOINT
  llmModel?: string; // AVIARY_LLM_MODEL
  llmApiKey?: string; // AVIARY_LLM_API_KEY (never logged)
}

export function loadSettleAfterNavigationMs(): number | undefined {
  const raw = process.env.AVIARY_SETTLE_AFTER_NAVIGATION_MS?.trim();
  return raw ? Number(raw) : undefined;
}

export function loadEnvConfig(): EnvConfig {
  const rawHeadless = process.env.AVIARY_HEADLESS?.trim().toLowerCase();
  if (rawHeadless && rawHeadless !== 'true' && rawHeadless !== 'false') {
    throw new Error('AVIARY_HEADLESS must be either "true" or "false".');
  }
  const rawPreset = process.env.AVIARY_PRESET?.trim();
  if (rawPreset && !['basic', 'advanced', 'strict', 'geo'].includes(rawPreset)) {
    throw new Error('AVIARY_PRESET must be basic, advanced, strict, or geo.');
  }
  const categories = process.env.AVIARY_CATEGORIES?.split(',')
    .map((category) => category.trim())
    .filter(Boolean);
  const rawFailBelowScore = process.env.AVIARY_FAIL_BELOW_SCORE?.trim();
  const rawTimeout = process.env.AVIARY_TIMEOUT?.trim();

  return {
    url: process.env.AVIARY_URL,
    headless: rawHeadless ? rawHeadless === 'true' : undefined,
    timeout: rawTimeout ? Number(rawTimeout) : undefined,
    settleAfterNavigationMs: loadSettleAfterNavigationMs(),
    viewport: process.env.AVIARY_VIEWPORT,
    preset: rawPreset as EnvConfig['preset'],
    output: process.env.AVIARY_OUTPUT,
    htmlOutput: process.env.AVIARY_HTML_OUTPUT,
    pdfOutput: process.env.AVIARY_PDF_OUTPUT,
    historyOutput: process.env.AVIARY_HISTORY_OUTPUT,
    junitOutput: process.env.AVIARY_JUNIT_OUTPUT,
    sarifOutput: process.env.AVIARY_SARIF_OUTPUT,
    markdownOutput: process.env.AVIARY_MARKDOWN_OUTPUT,
    csvOutput: process.env.AVIARY_CSV_OUTPUT,
    concurrency:
      process.env.AVIARY_CONCURRENCY !== undefined
        ? Number(process.env.AVIARY_CONCURRENCY)
        : undefined,
    failOnFindings: process.env.AVIARY_FAIL_ON_FINDINGS === 'true',
    failOnDuplicateMetadata: process.env.AVIARY_FAIL_ON_DUPLICATE_METADATA === 'true',
    failOnDuplicateContent: process.env.AVIARY_FAIL_ON_DUPLICATE_CONTENT === 'true',
    failBelowScore: rawFailBelowScore ? Number(rawFailBelowScore) : undefined,
    baselineReport: process.env.AVIARY_BASELINE_REPORT,
    failOnRegression: process.env.AVIARY_FAIL_ON_REGRESSION === 'true',
    categories: categories?.length ? categories : undefined,
    logLevel: process.env.AVIARY_LOG_LEVEL || 'info',
    llmProvider: process.env.AVIARY_LLM_PROVIDER || 'stub',
    llmEndpoint: process.env.AVIARY_LLM_ENDPOINT || 'http://localhost:11434',
    llmModel: process.env.AVIARY_LLM_MODEL || 'llama3.2',
    llmApiKey: process.env.AVIARY_LLM_API_KEY,
  };
}
