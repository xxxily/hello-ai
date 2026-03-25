import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveLLMConfig, buildRequestBody, stripThinkTags } from '../scripts/llm-provider.js';

/**
 * Integration tests for LLM provider module.
 *
 * These tests verify end-to-end provider configuration resolution and
 * request building across different provider scenarios.
 *
 * Tests marked with `MINIMAX_API_KEY` in the environment will attempt
 * a live API call to verify connectivity.
 */

describe('Integration: provider config resolution', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
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

  it('should produce a valid MiniMax chat completion request body', () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.MINIMAX_API_KEY = 'test-key';

    const config = resolveLLMConfig();
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
    ];

    const body = buildRequestBody(config.provider, config.model, messages, {
      temperature: 0.1,
      responseFormat: { type: 'json_object' },
    });

    expect(body.model).toBe('MiniMax-M2.5');
    expect(body.temperature).toBe(0.1);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toHaveLength(2);

    // Verify the full request URL would be correct
    const url = `${config.baseUrl}/chat/completions`;
    expect(url).toBe('https://api.minimax.io/v1/chat/completions');
  });

  it('should auto-detect MiniMax and resolve full config from MINIMAX_API_KEY alone', () => {
    process.env.MINIMAX_API_KEY = 'mm-test-key';

    const config = resolveLLMConfig();
    expect(config.provider).toBe('minimax');
    expect(config.baseUrl).toBe('https://api.minimax.io/v1');
    expect(config.model).toBe('MiniMax-M2.5');
    expect(config.apiKey).toBe('mm-test-key');
  });

  it('should handle MiniMax response with think tags in JSON output', () => {
    const rawResponse = `<think>
Let me evaluate these projects...
Project 1 looks good for the agents category.
Project 2 is not AI-related.
</think>
{
  "evaluations": [
    {
      "id": 0,
      "is_valuable": true,
      "category_id": "agents",
      "project": { "name": "test-agent", "description": "测试代理", "tags": ["agent"], "health": "Active" }
    },
    {
      "id": 1,
      "is_valuable": false,
      "reason": "Not AI-related"
    }
  ]
}`;

    const cleaned = stripThinkTags(rawResponse);
    const parsed = JSON.parse(cleaned);
    expect(parsed.evaluations).toHaveLength(2);
    expect(parsed.evaluations[0].is_valuable).toBe(true);
    expect(parsed.evaluations[1].is_valuable).toBe(false);
  });
});

describe('Integration: live MiniMax API call', () => {
  const apiKey = process.env.MINIMAX_API_KEY;

  it.skipIf(!apiKey)('should successfully call MiniMax chat completions API', async () => {
    const config = {
      provider: 'minimax',
      baseUrl: 'https://api.minimax.io/v1',
      apiKey,
      model: 'MiniMax-M2.5-highspeed',
    };

    const messages = [
      { role: 'system', content: 'Respond ONLY with valid JSON.' },
      { role: 'user', content: 'Return a JSON object with a single key "status" and value "ok".' },
    ];

    const body = buildRequestBody(config.provider, config.model, messages, {
      temperature: 0.1,
      responseFormat: { type: 'json_object' },
    });

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data.choices).toBeDefined();
    expect(data.choices.length).toBeGreaterThan(0);

    let content = data.choices[0].message.content;
    content = stripThinkTags(content);
    const parsed = JSON.parse(content);
    expect(parsed.status).toBe('ok');
  }, 30000);
});
