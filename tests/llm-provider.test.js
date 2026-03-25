import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PROVIDER_PRESETS,
  detectProvider,
  clampTemperature,
  resolveLLMConfig,
  buildRequestBody,
  stripThinkTags,
} from '../scripts/llm-provider.js';

/* ------------------------------------------------------------------ */
/*  PROVIDER_PRESETS                                                   */
/* ------------------------------------------------------------------ */
describe('PROVIDER_PRESETS', () => {
  it('should contain openai, minimax, deepseek, and ollama presets', () => {
    expect(PROVIDER_PRESETS).toHaveProperty('openai');
    expect(PROVIDER_PRESETS).toHaveProperty('minimax');
    expect(PROVIDER_PRESETS).toHaveProperty('deepseek');
    expect(PROVIDER_PRESETS).toHaveProperty('ollama');
  });

  it('minimax preset should use api.minimax.io base URL', () => {
    expect(PROVIDER_PRESETS.minimax.baseUrl).toBe('https://api.minimax.io/v1');
  });

  it('minimax preset should default to MiniMax-M2.5 model', () => {
    expect(PROVIDER_PRESETS.minimax.defaultModel).toBe('MiniMax-M2.5');
  });

  it('minimax preset should have temperature range [0, 1]', () => {
    expect(PROVIDER_PRESETS.minimax.temperatureRange).toEqual([0, 1]);
  });

  it('minimax preset should list available models', () => {
    expect(PROVIDER_PRESETS.minimax.models).toContain('MiniMax-M2.7');
    expect(PROVIDER_PRESETS.minimax.models).toContain('MiniMax-M2.5');
    expect(PROVIDER_PRESETS.minimax.models).toContain('MiniMax-M2.5-highspeed');
  });

  it('minimax preset should use MINIMAX_API_KEY env var', () => {
    expect(PROVIDER_PRESETS.minimax.envKey).toBe('MINIMAX_API_KEY');
  });

  it('openai preset should have temperature range [0, 2]', () => {
    expect(PROVIDER_PRESETS.openai.temperatureRange).toEqual([0, 2]);
  });

  it('each preset should have required fields', () => {
    for (const [key, preset] of Object.entries(PROVIDER_PRESETS)) {
      expect(preset).toHaveProperty('name');
      expect(preset).toHaveProperty('baseUrl');
      expect(preset).toHaveProperty('defaultModel');
      expect(preset).toHaveProperty('temperatureRange');
      expect(preset.temperatureRange).toHaveLength(2);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  detectProvider                                                      */
/* ------------------------------------------------------------------ */
describe('detectProvider', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('should detect minimax from base URL containing "minimax"', () => {
    expect(detectProvider('key', 'https://api.minimax.io/v1')).toBe('minimax');
  });

  it('should detect deepseek from base URL', () => {
    expect(detectProvider('key', 'https://api.deepseek.com/v1')).toBe('deepseek');
  });

  it('should detect openai from base URL', () => {
    expect(detectProvider('key', 'https://api.openai.com/v1')).toBe('openai');
  });

  it('should detect ollama from localhost URL', () => {
    expect(detectProvider('key', 'http://127.0.0.1:11434/v1')).toBe('ollama');
    expect(detectProvider('key', 'http://localhost:11434/v1')).toBe('ollama');
  });

  it('should detect minimax from MINIMAX_API_KEY env var', () => {
    process.env.MINIMAX_API_KEY = 'test-key';
    expect(detectProvider('', '')).toBe('minimax');
  });

  it('should detect deepseek from DEEPSEEK_API_KEY env var', () => {
    delete process.env.MINIMAX_API_KEY;
    process.env.DEEPSEEK_API_KEY = 'test-key';
    expect(detectProvider('', '')).toBe('deepseek');
  });

  it('should default to openai when API key is provided without URL', () => {
    delete process.env.MINIMAX_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    expect(detectProvider('sk-test', '')).toBe('openai');
  });

  it('should default to ollama when no API key or URL', () => {
    delete process.env.MINIMAX_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    expect(detectProvider('', '')).toBe('ollama');
    expect(detectProvider('local-fallback', '')).toBe('ollama');
  });
});

/* ------------------------------------------------------------------ */
/*  clampTemperature                                                    */
/* ------------------------------------------------------------------ */
describe('clampTemperature', () => {
  it('should clamp temperature to minimax range [0, 1]', () => {
    expect(clampTemperature(1.5, 'minimax')).toBe(1);
    expect(clampTemperature(0.5, 'minimax')).toBe(0.5);
    expect(clampTemperature(0, 'minimax')).toBe(0);
    expect(clampTemperature(-0.1, 'minimax')).toBe(0);
  });

  it('should allow temperature up to 2 for openai', () => {
    expect(clampTemperature(1.5, 'openai')).toBe(1.5);
    expect(clampTemperature(2, 'openai')).toBe(2);
    expect(clampTemperature(2.5, 'openai')).toBe(2);
  });

  it('should return original value for unknown provider', () => {
    expect(clampTemperature(5, 'unknown-provider')).toBe(5);
  });
});

/* ------------------------------------------------------------------ */
/*  resolveLLMConfig                                                    */
/* ------------------------------------------------------------------ */
describe('resolveLLMConfig', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    // Clear all relevant env vars
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;
    delete process.env.MINIMAX_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('should use explicit LLM_PROVIDER when set', () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.LLM_API_KEY = 'test-key';
    const config = resolveLLMConfig();
    expect(config.provider).toBe('minimax');
    expect(config.baseUrl).toBe('https://api.minimax.io/v1');
    expect(config.model).toBe('MiniMax-M2.5');
  });

  it('should use provider-specific env key when LLM_API_KEY is empty', () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.MINIMAX_API_KEY = 'mm-key-123';
    const config = resolveLLMConfig();
    expect(config.apiKey).toBe('mm-key-123');
  });

  it('should override model with LLM_MODEL env var', () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.LLM_MODEL = 'MiniMax-M2.7';
    const config = resolveLLMConfig();
    expect(config.model).toBe('MiniMax-M2.7');
  });

  it('should override base URL with LLM_BASE_URL env var', () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.LLM_BASE_URL = 'https://custom-proxy.example.com/v1';
    const config = resolveLLMConfig();
    expect(config.baseUrl).toBe('https://custom-proxy.example.com/v1');
  });

  it('should fallback to ollama when no keys set', () => {
    const config = resolveLLMConfig();
    expect(config.provider).toBe('ollama');
    expect(config.model).toBe('llama3');
    expect(config.apiKey).toBe('local-fallback');
  });

  it('should auto-detect minimax from MINIMAX_API_KEY', () => {
    process.env.MINIMAX_API_KEY = 'mm-key';
    const config = resolveLLMConfig();
    expect(config.provider).toBe('minimax');
    expect(config.apiKey).toBe('mm-key');
  });
});

/* ------------------------------------------------------------------ */
/*  buildRequestBody                                                    */
/* ------------------------------------------------------------------ */
describe('buildRequestBody', () => {
  it('should clamp temperature for minimax provider', () => {
    const body = buildRequestBody('minimax', 'MiniMax-M2.5', [], {
      temperature: 1.5,
    });
    expect(body.temperature).toBe(1);
  });

  it('should keep temperature within range for openai', () => {
    const body = buildRequestBody('openai', 'gpt-4o-mini', [], {
      temperature: 1.5,
    });
    expect(body.temperature).toBe(1.5);
  });

  it('should include response_format when provided', () => {
    const body = buildRequestBody('minimax', 'MiniMax-M2.5', [], {
      responseFormat: { type: 'json_object' },
    });
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('should not include response_format when not provided', () => {
    const body = buildRequestBody('minimax', 'MiniMax-M2.5', []);
    expect(body).not.toHaveProperty('response_format');
  });

  it('should set model and messages correctly', () => {
    const msgs = [{ role: 'user', content: 'Hello' }];
    const body = buildRequestBody('minimax', 'MiniMax-M2.5', msgs);
    expect(body.model).toBe('MiniMax-M2.5');
    expect(body.messages).toBe(msgs);
  });

  it('should default temperature to 0.1 when not specified', () => {
    const body = buildRequestBody('minimax', 'MiniMax-M2.5', []);
    expect(body.temperature).toBe(0.1);
  });
});

/* ------------------------------------------------------------------ */
/*  stripThinkTags                                                      */
/* ------------------------------------------------------------------ */
describe('stripThinkTags', () => {
  it('should remove think tags and their content', () => {
    const input = '<think>reasoning here</think>{"result": true}';
    expect(stripThinkTags(input)).toBe('{"result": true}');
  });

  it('should handle multiline think tags', () => {
    const input = '<think>\nStep 1: ...\nStep 2: ...\n</think>\n{"evaluations": []}';
    expect(stripThinkTags(input)).toBe('{"evaluations": []}');
  });

  it('should return original text when no think tags present', () => {
    const input = '{"evaluations": []}';
    expect(stripThinkTags(input)).toBe('{"evaluations": []}');
  });

  it('should handle multiple think tag blocks', () => {
    const input = '<think>a</think>hello<think>b</think>world';
    expect(stripThinkTags(input)).toBe('helloworld');
  });

  it('should handle empty think tags', () => {
    const input = '<think></think>result';
    expect(stripThinkTags(input)).toBe('result');
  });
});
