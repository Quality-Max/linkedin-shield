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
      context: msg.context || null,
    };

    // Update badge and tooltip
    const total = msg.total || 0;
    chrome.action.setBadgeText({ text: total > 0 ? String(total) : '', tabId });
    chrome.action.setBadgeBackgroundColor({ color: total > 50 ? '#ef4444' : total > 10 ? '#f59e0b' : '#22c55e', tabId });
    chrome.action.setTitle({
      title: `LinkedIn Shield — ${total} blocked\n${msg.probes || 0} extension probes\n${msg.fingerprints || 0} fingerprint APIs spoofed\n${msg.trackers || 0} trackers blocked`,
      tabId,
    });
  }

  if (msg.type === 'get_stats') {
    sendResponse(tabStats[msg.tabId] || { probes: 0, fingerprints: 0, trackers: 0, total: 0 });
    return true;
  }

  if (msg.type === 'ai_analyze') {
    // Must call sendResponse asynchronously — return true to keep channel open
    handleAIAnalysis(msg.stats).then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ error: `Analysis failed: ${err.message}` });
    });
    return true; // keep message channel open for async response
  }
});

// Track blocked requests via declarativeNetRequest
if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
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
}

// Clean up tab stats when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabStats[tabId];
});

// ── AI Analysis Mode (optional — requires API key) ───────────────────

async function handleAIAnalysis(stats) {
  const result = await chrome.storage.local.get(['ai_api_key', 'ai_provider', 'ai_api_base', 'ai_model']);
  const apiKey = result.ai_api_key;
  const provider = result.ai_provider || 'anthropic';

  if (!apiKey) {
    return { error: 'No API key configured. Go to Settings to add one.' };
  }

  const ctx = stats.context || {};
  const extSample = (ctx.extensionIds || []).slice(0, 5).join(', ') || 'none captured';
  const blockedSample = (ctx.blockedUrls || []).join('\n  ') || 'none';
  const fpApis = (ctx.fingerprintApis || []).join(', ') || 'none';

  const prompt = `You are a privacy security analyst. A user visited LinkedIn and the following surveillance was detected and blocked:

EXTENSION PROBING: ${stats.probes || 0} unique chrome-extension:// URLs probed (LinkedIn checking which extensions are installed)
Sample extension IDs probed: ${extSample}

DEVICE FINGERPRINTING: ${stats.fingerprints || 0} APIs intercepted and spoofed: ${fpApis}

SURVEILLANCE ENDPOINTS BLOCKED: ${stats.trackers || 0}
  ${blockedSample}

HIDDEN IFRAMES: ${ctx.iframesRemoved || 0} invisible tracking iframes from HUMAN Security (protechts.net) removed

Explain in 4-5 sentences:
1. What specific data LinkedIn was trying to collect from this user
2. What the extension probing reveals (job hunting tools, ad blockers, accessibility tools, etc.)
3. How device fingerprinting creates a unique ID that follows you across sites
4. The real-world privacy risk and what LinkedIn could do with this data
Be specific to the numbers above. Direct and factual, no fluff.`;

  let apiBase, model, headers;

  if (provider === 'anthropic') {
    apiBase = 'https://api.anthropic.com/v1';
    model = 'claude-haiku-4-5-20251001';
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };

    const resp = await fetch(`${apiBase}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { error: `Claude API error (${resp.status}): ${errText.slice(0, 150)}` };
    }

    const data = await resp.json();
    return { analysis: data.content?.[0]?.text || 'No response.' };
  }

  // OpenAI-compatible format (works with OpenAI, QMax/Qwen, DeepSeek, etc.)
  apiBase = (result.ai_api_base || 'https://api.openai.com/v1').replace(/\/$/, '');
  model = result.ai_model || 'gpt-4o-mini';

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

  if (!resp.ok) {
    const errText = await resp.text();
    return { error: `API error (${resp.status}): ${errText.slice(0, 150)}` };
  }

  const data = await resp.json();
  return { analysis: data.choices?.[0]?.message?.content || 'No response.' };
}
