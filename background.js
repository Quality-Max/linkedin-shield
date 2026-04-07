/**
 * LinkedIn Shield — Background Service Worker
 * Tracks blocked probes, updates badge, handles AI analysis mode.
 */

// Per-tab stats
const tabStats = {};

// Listen for stats from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'shield_stats' && sender.tab) {
    const tabId = sender.tab.id;
    tabStats[tabId] = {
      probes: msg.probes || 0,
      fingerprints: msg.fingerprints || 0,
      trackers: msg.trackers || 0,
      total: msg.total || 0,
      url: sender.tab.url,
      timestamp: Date.now(),
    };

    // Update badge
    const total = msg.total || 0;
    chrome.action.setBadgeText({ text: total > 0 ? String(total) : '', tabId });
    chrome.action.setBadgeBackgroundColor({ color: total > 50 ? '#ef4444' : total > 10 ? '#f59e0b' : '#22c55e', tabId });
  }

  if (msg.type === 'get_stats') {
    sendResponse(tabStats[msg.tabId] || { probes: 0, fingerprints: 0, trackers: 0, total: 0 });
    return true;
  }

  if (msg.type === 'ai_analyze') {
    handleAIAnalysis(msg.stats, sendResponse);
    return true; // async response
  }
});

// Track blocked requests via declarativeNetRequest
chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener((info) => {
  const tabId = info.request.tabId;
  if (tabId > 0) {
    if (!tabStats[tabId]) {
      tabStats[tabId] = { probes: 0, fingerprints: 0, trackers: 0, total: 0, timestamp: Date.now() };
    }
    tabStats[tabId].trackers++;
    tabStats[tabId].total++;

    const total = tabStats[tabId].total;
    chrome.action.setBadgeText({ text: total > 0 ? String(total) : '', tabId });
    chrome.action.setBadgeBackgroundColor({ color: total > 50 ? '#ef4444' : total > 10 ? '#f59e0b' : '#22c55e', tabId });
  }
});

// Clean up tab stats when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabStats[tabId];
});

// ── AI Analysis Mode (optional — requires API key) ───────────────────

async function handleAIAnalysis(stats, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['ai_api_key', 'ai_provider']);
    const apiKey = result.ai_api_key;
    const provider = result.ai_provider || 'anthropic';

    if (!apiKey) {
      sendResponse({ error: 'No API key configured. Go to Settings to add one.' });
      return;
    }

    const prompt = `You are a privacy security analyst. A user visited LinkedIn and the following tracking was detected:

- Extension probes blocked: ${stats.probes} (LinkedIn tried to detect installed browser extensions)
- Device fingerprints blocked: ${stats.fingerprints} (attempts to collect hardware/browser info)
- Tracker requests blocked: ${stats.trackers} (hidden tracking pixels, iframes, and beacons)

In 3-4 sentences, explain:
1. What data LinkedIn was trying to collect
2. The privacy risk if this wasn't blocked
3. What this data could be used for (profiling, ad targeting, etc.)

Be direct and factual. No marketing language.`;

    let response;

    if (provider === 'anthropic') {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await resp.json();
      response = data.content?.[0]?.text || 'Analysis unavailable.';
    } else {
      // OpenAI-compatible (works with QMax/Qwen, OpenAI, DeepSeek, etc.)
      const apiBase = result.ai_api_base || 'https://api.openai.com/v1';
      const model = result.ai_model || 'gpt-4o-mini';
      const resp = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 200,
          messages: [
            { role: 'system', content: 'You are a privacy security analyst. Be direct and factual.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      const data = await resp.json();
      response = data.choices?.[0]?.message?.content || 'Analysis unavailable.';
    }

    sendResponse({ analysis: response });
  } catch (e) {
    sendResponse({ error: `Analysis failed: ${e.message}` });
  }
}
