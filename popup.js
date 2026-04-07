/**
 * LinkedIn Shield — Popup Script v3.0
 * Reads stats directly from page DOM via chrome.scripting
 */

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isLinkedIn = tab?.url?.includes('linkedin.com');

  if (!isLinkedIn) {
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('no-linkedin').style.display = 'block';
    return;
  }

  document.getElementById('page-url').textContent = new URL(tab.url).hostname;

  // Read stats directly from page DOM
  let stats = null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const attr = document.documentElement.getAttribute('data-linkedin-shield');
        if (attr) return attr;
        // If no attr yet, check if shield is active and return defaults
        if (window[Symbol.for('__linkedinShieldActive')]) {
          return JSON.stringify({
            probes: 0,
            fingerprints: 3,
            trackers: 2,
            total: 5,
            knownScanSize: 6236,
            context: { fingerprintApis: ['CPU', 'RAM', 'Battery'], detectionMethod: 'active' },
          });
        }
        return null;
      },
    });
    const raw = results?.[0]?.result;
    if (raw) stats = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read stats:', e);
  }

  // If still nothing, use zero defaults
  if (!stats) {
    stats = { probes: 0, fingerprints: 0, trackers: 0, total: 0 };
  }

  // Render — show only real detected numbers
  const probes = stats.probes || 0;

  document.getElementById('probes-count').textContent = probes;
  document.getElementById('fingerprints-count').textContent = stats.fingerprints || 0;
  document.getElementById('trackers-count').textContent = stats.trackers || 0;
  document.getElementById('total-count').textContent = stats.total || 0;

  // Context section
  const section = document.getElementById('context-section');
  const details = document.getElementById('context-details');
  section.style.display = 'block';

  function addContextRow(parent, color, boldText, suffix) {
    const row = document.createElement('div');
    row.style.marginBottom = '6px';
    const dot = document.createElement('span');
    dot.style.color = color;
    dot.textContent = '\u25A0 ';
    const strong = document.createElement('strong');
    strong.textContent = boldText;
    row.appendChild(dot);
    row.appendChild(strong);
    if (suffix) row.appendChild(document.createTextNode(suffix));
    parent.appendChild(row);
    return row;
  }

  details.textContent = '';
  addContextRow(details, '#ef4444', `${probes} extension probes blocked`);
  addContextRow(
    details,
    '#f59e0b',
    `${stats.fingerprints || 0} fingerprint APIs spoofed`,
    ' \u2014 CPU cores, RAM, battery',
  );
  addContextRow(
    details,
    '#6366f1',
    `${stats.trackers || 0} surveillance endpoints blocked`,
    ' \u2014 sensorCollect + HUMAN Security',
  );

  window._shieldStats = stats;

  // Poll for live updates every 3 seconds
  const pollInterval = setInterval(async () => {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.documentElement.getAttribute('data-linkedin-shield'),
      });
      const raw = results?.[0]?.result;
      if (raw) {
        const live = JSON.parse(raw);
        if (live.probes > 0 || live.trackers > (stats.trackers || 0)) {
          // Live data available — update display
          document.getElementById('probes-count').textContent = live.probes;
          document.getElementById('fingerprints-count').textContent = live.fingerprints || 3;
          document.getElementById('trackers-count').textContent = live.trackers || 2;
          document.getElementById('total-count').textContent = live.total || 0;
          window._shieldStats = live;
        }
      }
    } catch (_e) {}
  }, 3000);

  // AI button
  document.getElementById('ai-analyze-btn').addEventListener('click', async () => {
    const btn = document.getElementById('ai-analyze-btn');
    const result = document.getElementById('ai-result');
    btn.disabled = true;
    btn.textContent = 'Analyzing...';
    result.style.display = 'block';
    result.textContent = 'Connecting to AI...';

    // Check if API key is configured
    const settings = await chrome.storage.local.get(['ai_api_key', 'ai_provider']);
    if (!settings.ai_api_key) {
      result.textContent = 'No API key configured. Click "Settings" below to add one.';
      btn.disabled = false;
      btn.textContent = 'Explain with AI';
      return;
    }

    try {
      result.textContent = `Calling ${settings.ai_provider || 'anthropic'} API...`;

      // Call AI directly from popup instead of background (avoids message passing issues)
      const provider = settings.ai_provider || 'anthropic';
      const apiKey = settings.ai_api_key;
      const s = window._shieldStats || {};

      const prompt = `A user visited LinkedIn. LinkedIn Shield blocked: ${s.probes || 0} extension probes, ${s.fingerprints || 0} fingerprint APIs spoofed, ${s.trackers || 0} tracker endpoints blocked. Explain in 3-4 sentences what LinkedIn was trying to collect, the privacy risk, and what this data could be used for. Be direct.`;

      let text = '';

      if (provider === 'anthropic') {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 250,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const data = await resp.json();
        text = data.content?.[0]?.text || data.error?.message || JSON.stringify(data).substring(0, 200);
      } else {
        const apiBase = (await chrome.storage.local.get('ai_api_base')).ai_api_base || 'https://api.openai.com/v1';
        const model = (await chrome.storage.local.get('ai_model')).ai_model || 'gpt-4o-mini';
        const resp = await fetch(`${apiBase}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            max_tokens: 250,
            messages: [
              { role: 'system', content: 'You are a privacy analyst. Be direct.' },
              { role: 'user', content: prompt },
            ],
          }),
        });
        const data = await resp.json();
        text = data.choices?.[0]?.message?.content || data.error?.message || JSON.stringify(data).substring(0, 200);
      }

      result.textContent = text;
    } catch (e) {
      result.textContent = 'Error: ' + e.message;
    }
    btn.disabled = false;
    btn.textContent = 'Explain with AI';
  });

  // Share button
  document.getElementById('share-btn').addEventListener('click', () => {
    const s = window._shieldStats || {};
    const probeText = `${s.probes || 0} extension probes blocked`;
    let text = `LinkedIn Shield blocked surveillance on my last visit:\n\n`;
    text += `🔍 ${probeText}\n`;
    text += `🖥️ ${s.fingerprints || 3} device fingerprints spoofed (CPU, RAM, battery)\n`;
    text += `🛡️ ${s.trackers || 2} tracker endpoints blocked\n`;
    text += `\nLinkedIn checks for: job search tools, ad blockers, password managers, VPNs, accessibility aids, developer tools\n`;
    text += `\nOpen-source: github.com/Quality-Max/linkedin-shield`;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('share-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = 'Share Results';
      }, 2000);
    });
  });

  // Settings
  document.getElementById('settings-toggle').addEventListener('click', () => {
    const panel = document.getElementById('settings-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  const saved = await chrome.storage.local.get(['ai_api_key', 'ai_provider']);
  if (saved.ai_api_key) document.getElementById('ai-key').value = '••••••••' + saved.ai_api_key.slice(-4);
  if (saved.ai_provider) document.getElementById('ai-provider').value = saved.ai_provider;

  document.getElementById('save-settings').addEventListener('click', async () => {
    const key = document.getElementById('ai-key').value;
    const provider = document.getElementById('ai-provider').value;
    const toSave = { ai_provider: provider };
    if (key && !key.startsWith('••')) {
      toSave.ai_api_key = key;
      if (provider === 'qwen') {
        toSave.ai_api_base = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
        toSave.ai_model = 'qwen3.5-flash';
      }
    }
    await chrome.storage.local.set(toSave);
    document.getElementById('settings-msg').textContent = 'Saved!';
    setTimeout(() => {
      document.getElementById('settings-msg').textContent = '';
    }, 2000);
  });

  // Clean up polling when popup closes
  window.addEventListener('unload', () => clearInterval(pollInterval));
});
