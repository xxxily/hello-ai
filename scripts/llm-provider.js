/**
 * LLM Provider Presets & Configuration
 *
 * Supports multiple LLM providers via OpenAI-compatible API.
 * Provider can be selected via the LLM_PROVIDER env var, or auto-detected
 * from LLM_API_KEY / LLM_BASE_URL.
 */

/** Built-in provider presets */
const PROVIDER_PRESETS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
    temperatureRange: [0, 2],
  },
  minimax: {
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.io/v1',
    defaultModel: 'MiniMax-M2.5',
    envKey: 'MINIMAX_API_KEY',
    temperatureRange: [0, 1],
    models: ['MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed'],
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY',
    temperatureRange: [0, 2],
  },
  ollama: {
    name: 'Ollama (Local)',
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'llama3',
    envKey: null,
    temperatureRange: [0, 2],
  },
};

/**
 * Auto-detect provider from API key or base URL.
 */
function detectProvider(apiKey, baseUrl) {
  if (baseUrl) {
    if (baseUrl.includes('minimax')) return 'minimax';
    if (baseUrl.includes('deepseek')) return 'deepseek';
    if (baseUrl.includes('openai.com')) return 'openai';
    if (baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost')) return 'ollama';
  }
  if (process.env.MINIMAX_API_KEY) return 'minimax';
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek';
  if (apiKey && apiKey !== 'local-fallback') return 'openai';
  return 'ollama';
}

/**
 * Clamp temperature to the provider's accepted range.
 */
function clampTemperature(temperature, providerName) {
  const preset = PROVIDER_PRESETS[providerName];
  if (!preset) return temperature;
  const [min, max] = preset.temperatureRange;
  return Math.min(Math.max(temperature, min), max);
}

/**
 * Resolve the full LLM configuration from environment variables.
 *
 * Priority:
 *   1. Explicit LLM_PROVIDER env var
 *   2. Auto-detection from LLM_BASE_URL / API keys
 *   3. Fallback to 'ollama' when no API key is set
 *
 * Returns { provider, baseUrl, apiKey, model, preset }
 */
function resolveLLMConfig() {
  const explicitProvider = (process.env.LLM_PROVIDER || '').toLowerCase();
  const rawApiKey = process.env.LLM_API_KEY || '';
  const rawBaseUrl = process.env.LLM_BASE_URL || '';
  const rawModel = process.env.LLM_MODEL || '';

  // Determine provider
  let provider;
  if (explicitProvider && PROVIDER_PRESETS[explicitProvider]) {
    provider = explicitProvider;
  } else {
    provider = detectProvider(rawApiKey, rawBaseUrl);
  }

  const preset = PROVIDER_PRESETS[provider];

  // Resolve API key: explicit LLM_API_KEY > provider-specific env key > local-fallback
  let apiKey = rawApiKey;
  if (!apiKey && preset.envKey) {
    apiKey = process.env[preset.envKey] || '';
  }
  if (!apiKey) apiKey = 'local-fallback';

  // Resolve base URL
  const baseUrl = rawBaseUrl || preset.baseUrl;

  // Resolve model
  const model = rawModel || preset.defaultModel;

  return { provider, baseUrl, apiKey, model, preset };
}

/**
 * Build the request body for a chat completion call.
 * Applies provider-specific adjustments (e.g. temperature clamping).
 */
function buildRequestBody(provider, model, messages, options = {}) {
  const temperature = clampTemperature(
    options.temperature ?? 0.1,
    provider
  );

  const body = {
    model,
    messages,
    temperature,
  };

  // response_format is widely supported by OpenAI-compatible APIs
  if (options.responseFormat) {
    body.response_format = options.responseFormat;
  }

  return body;
}

/**
 * Strip <think>…</think> tags that some models (e.g. MiniMax-M2.5) may
 * include in their responses.
 */
function stripThinkTags(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export {
  PROVIDER_PRESETS,
  detectProvider,
  clampTemperature,
  resolveLLMConfig,
  buildRequestBody,
  stripThinkTags,
};
