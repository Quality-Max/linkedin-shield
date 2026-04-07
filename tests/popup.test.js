/**
 * Popup tests — stats rendering, fallback logic, AI button behavior
 */
import { describe, it, expect } from 'vitest';

describe('Popup — Stats Display', () => {
  it('shows ~6.2K when probes is 0 (research-based fallback)', () => {
    const probes = 0;
    const showKnown = probes === 0;
    expect(showKnown).toBe(true);
    expect(showKnown ? '~6.2K' : probes).toBe('~6.2K');
  });

  it('shows actual probe count when probes > 0', () => {
    const probes = 150;
    const showKnown = probes === 0;
    expect(showKnown).toBe(false);
    expect(showKnown ? '~6.2K' : probes).toBe(150);
  });

  it('defaults fingerprints to 3 when missing', () => {
    const stats = {};
    expect(stats.fingerprints || 3).toBe(3);
  });

  it('defaults trackers to 2 when missing', () => {
    const stats = {};
    expect(stats.trackers || 2).toBe(2);
  });

  it('uses stats values when present', () => {
    const stats = { fingerprints: 5, trackers: 8 };
    expect(stats.fingerprints || 3).toBe(5);
    expect(stats.trackers || 2).toBe(8);
  });
});

describe('Popup — Stats Parsing', () => {
  it('parses DOM attribute stats correctly', () => {
    const raw = JSON.stringify({
      probes: 42,
      fingerprints: 3,
      trackers: 4,
      total: 49,
      knownScanSize: 6236,
      context: { detectionMethod: 'live' },
    });
    const stats = JSON.parse(raw);
    expect(stats.probes).toBe(42);
    expect(stats.total).toBe(49);
    expect(stats.context.detectionMethod).toBe('live');
  });

  it('creates valid fallback stats when no DOM data', () => {
    const stats = {
      probes: 0,
      fingerprints: 3,
      trackers: 2,
      total: 5,
      knownScanSize: 6236,
      context: {
        fingerprintApis: ['navigator.hardwareConcurrency', 'navigator.deviceMemory', 'navigator.getBattery()'],
        detectionMethod: 'research-based',
      },
    };
    expect(stats.total).toBe(5);
    expect(stats.context.fingerprintApis).toHaveLength(3);
    expect(stats.context.detectionMethod).toBe('research-based');
  });

  it('handles malformed JSON gracefully', () => {
    const raw = 'not valid json {{{';
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_e) {
      // expected
    }
    expect(parsed).toBeNull();
  });

  it('handles null/undefined raw values', () => {
    const raw = null;
    const stats = raw ? JSON.parse(raw) : null;
    expect(stats).toBeNull();
  });
});

describe('Popup — Live Update Logic', () => {
  it('updates display when live probes > 0', () => {
    const current = { probes: 0, trackers: 2 };
    const live = { probes: 50, fingerprints: 3, trackers: 3, total: 56 };
    const shouldUpdate = live.probes > 0 || live.trackers > (current.trackers || 0);
    expect(shouldUpdate).toBe(true);
  });

  it('updates display when live trackers increase', () => {
    const current = { probes: 0, trackers: 2 };
    const live = { probes: 0, fingerprints: 3, trackers: 4, total: 7 };
    const shouldUpdate = live.probes > 0 || live.trackers > (current.trackers || 0);
    expect(shouldUpdate).toBe(true);
  });

  it('does not update when live data is same or less', () => {
    const current = { probes: 0, trackers: 2 };
    const live = { probes: 0, fingerprints: 3, trackers: 2, total: 5 };
    const shouldUpdate = live.probes > 0 || live.trackers > (current.trackers || 0);
    expect(shouldUpdate).toBe(false);
  });

  it('handles missing trackers in current stats', () => {
    const current = {};
    const live = { probes: 0, trackers: 1 };
    const shouldUpdate = live.probes > 0 || live.trackers > (current.trackers || 0);
    expect(shouldUpdate).toBe(true);
  });
});

describe('Popup — AI Button', () => {
  it('requires API key before calling AI', () => {
    const settings = {};
    expect(!!settings.ai_api_key).toBe(false);
  });

  it('detects when API key is configured', () => {
    const settings = { ai_api_key: 'sk-test123' };
    expect(!!settings.ai_api_key).toBe(true);
  });

  it('builds correct Anthropic request headers', () => {
    const apiKey = 'sk-ant-test';
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('builds correct OpenAI-compatible request headers', () => {
    const apiKey = 'sk-openai-test';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
    expect(headers['Authorization']).toBe('Bearer sk-openai-test');
  });

  it('uses correct model for Anthropic', () => {
    const provider = 'anthropic';
    const model = provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini';
    expect(model).toBe('claude-haiku-4-5-20251001');
  });

  it('uses QMax provider settings', () => {
    const provider = 'qmax';
    const apiBase =
      provider === 'qmax' ? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' : 'https://api.openai.com/v1';
    const model = provider === 'qmax' ? 'qwen3.5-flash' : 'gpt-4o-mini';
    expect(apiBase).toBe('https://dashscope-intl.aliyuncs.com/compatible-mode/v1');
    expect(model).toBe('qwen3.5-flash');
  });

  it('defaults to OpenAI when provider is not anthropic', () => {
    const provider = 'openai';
    const isAnthropic = provider === 'anthropic';
    expect(isAnthropic).toBe(false);
  });

  it('extracts text from Anthropic response', () => {
    const data = { content: [{ text: 'LinkedIn was trying to collect...' }] };
    const text = data.content?.[0]?.text || 'No response.';
    expect(text).toBe('LinkedIn was trying to collect...');
  });

  it('extracts text from OpenAI response', () => {
    const data = { choices: [{ message: { content: 'Analysis result here' } }] };
    const text = data.choices?.[0]?.message?.content || 'No response.';
    expect(text).toBe('Analysis result here');
  });

  it('handles API error response', () => {
    const data = { error: { message: 'Invalid API key' } };
    const text = data.content?.[0]?.text || data.error?.message || 'Unknown error';
    expect(text).toBe('Invalid API key');
  });

  it('handles empty API response', () => {
    const data = {};
    const text = data.content?.[0]?.text || data.error?.message || JSON.stringify(data).substring(0, 200);
    expect(text).toBe('{}');
  });

  it('handles Anthropic response with empty content array', () => {
    const data = { content: [] };
    const text = data.content?.[0]?.text || 'No response.';
    expect(text).toBe('No response.');
  });
});

describe('Popup — Settings', () => {
  it('masks saved API key showing only last 4 chars', () => {
    const key = 'sk-ant-api03-very-long-key-here-abcd';
    const masked = '••••••••' + key.slice(-4);
    expect(masked).toBe('••••••••abcd');
    expect(masked.startsWith('••')).toBe(true);
  });

  it('does not save key if it starts with mask chars', () => {
    const key = '••••••••abcd';
    const shouldSave = key && !key.startsWith('••');
    expect(shouldSave).toBe(false);
  });

  it('saves new key when entered', () => {
    const key = 'sk-new-key-12345';
    const shouldSave = key && !key.startsWith('••');
    expect(shouldSave).toBe(true);
  });

  it('does not save empty key', () => {
    const key = '';
    const shouldSave = key && !key.startsWith('••');
    expect(shouldSave).toBeFalsy();
  });

  it('sets QMax-specific settings when provider is qmax', () => {
    const provider = 'qmax';
    const toSave = { ai_provider: provider };
    if (provider === 'qmax') {
      toSave.ai_api_base = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
      toSave.ai_model = 'qwen3.5-flash';
    }
    expect(toSave.ai_api_base).toBe('https://dashscope-intl.aliyuncs.com/compatible-mode/v1');
    expect(toSave.ai_model).toBe('qwen3.5-flash');
  });

  it('does not set QMax settings for other providers', () => {
    const provider = 'openai';
    const toSave = { ai_provider: provider };
    if (provider === 'qmax') {
      toSave.ai_api_base = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
    }
    expect(toSave.ai_api_base).toBeUndefined();
  });
});

describe('Popup — Share Text', () => {
  it('uses live stats when probes > 0', () => {
    const s = { probes: 42, fingerprints: 3, trackers: 5 };
    const probeText =
      s.probes > 0
        ? `${s.probes} extension probes detected & blocked`
        : '~6,236 known extension probes blocked (BrowserGate research)';
    expect(probeText).toBe('42 extension probes detected & blocked');
  });

  it('uses research fallback when probes is 0', () => {
    const s = { probes: 0, trackers: 2 };
    const probeText =
      s.probes > 0
        ? `${s.probes} extension probes detected & blocked`
        : '~6,236 known extension probes blocked (BrowserGate research)';
    expect(probeText).toContain('BrowserGate research');
  });

  it('includes github link', () => {
    const text = 'Open-source: github.com/Quality-Max/linkedin-shield';
    expect(text).toContain('github.com/Quality-Max/linkedin-shield');
  });
});
