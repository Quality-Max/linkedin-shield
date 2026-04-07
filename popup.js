/**
 * LinkedIn Shield — Popup Script
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

  // Get stats — try background first, then read DOM attribute directly
  let stats = null;

  // Method 1: Ask background service worker
  try {
    stats = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'get_stats', tabId: tab.id }, resolve);
    });
  } catch (e) {}

  // Method 2: Read from DOM attribute set by content.js (MAIN world)
  if (!stats || stats.total === 0) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.documentElement.getAttribute('data-linkedin-shield'),
      });
      const raw = results?.[0]?.result;
      if (raw) stats = JSON.parse(raw);
    } catch (e) {}
  }

  // Render stats
  if (stats && stats.total > 0) {
    document.getElementById('probes-count').textContent = stats.probes || 0;
    document.getElementById('fingerprints-count').textContent = stats.fingerprints || 0;
    document.getElementById('trackers-count').textContent = stats.trackers || 0;
    document.getElementById('total-count').textContent = stats.total || 0;

    // Context details
    const ctx = stats.context;
    if (ctx) {
      const section = document.getElementById('context-section');
      const details = document.getElementById('context-details');
      section.style.display = 'block';

      let html = '';
      if (stats.probes > 0) {
        const matched = [];
        if (typeof KNOWN_EXTENSIONS !== 'undefined') {
          (ctx.extensionIds || []).forEach(id => {
            const ext = KNOWN_EXTENSIONS[id];
            if (ext) matched.push(ext);
          });
        }

        html += `<div style="margin-bottom:8px;"><span style="color:#ef4444;">&#9632;</span> <strong>${stats.probes} extensions scanned</strong></div>`;

        if (matched.length > 0) {
          html += '<div style="margin-left:14px; margin-bottom:6px;">';
          matched.slice(0, 8).forEach(ext => {
            const color = ext.category.includes('Automation') ? '#ef4444' : ext.category.includes('Privacy') || ext.category.includes('Ad Blocker') ? '#f59e0b' : '#6366f1';
            html += `<div style="font-size:10px; padding:2px 0;"><span style="color:${color};">${ext.name}</span> <span style="color:#3a3854;">(${ext.category})</span></div>`;
          });
          if (matched.length > 8) html += `<div style="font-size:10px; color:#3a3854;">+${matched.length - 8} more</div>`;
          html += '</div>';
        } else {
          html += `<div style="font-size:10px; color:#56546a; margin-left:14px; margin-bottom:6px;">Probed ${stats.probes} extension IDs from LinkedIn's 6,236 watchlist</div>`;
        }
      }
      if (ctx.fingerprintApis?.length > 0) {
        html += `<div style="margin-bottom:6px;"><span style="color:#f59e0b;">&#9632;</span> <strong>Device fingerprinted</strong> — CPU, RAM, battery spoofed</div>`;
      }
      if (stats.trackers > 0) {
        html += `<div style="margin-bottom:6px;"><span style="color:#6366f1;">&#9632;</span> <strong>${stats.trackers} surveillance endpoints</strong> blocked</div>`;
      }
      details.innerHTML = html;
    }
  }

  window._shieldStats = stats;

  // AI Analyze button
  document.getElementById('ai-analyze-btn').addEventListener('click', async () => {
    const btn = document.getElementById('ai-analyze-btn');
    const result = document.getElementById('ai-result');
    btn.disabled = true;
    btn.textContent = 'Analyzing...';
    result.classList.add('visible');
    result.textContent = 'Connecting to AI...';

    try {
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'ai_analyze', stats: window._shieldStats || {} }, resolve);
      });
      result.textContent = resp?.analysis || resp?.error || 'No response.';
    } catch (e) {
      result.textContent = 'Error: ' + e.message;
    }
    btn.disabled = false;
    btn.textContent = 'Explain with AI';
  });

  // Share button
  document.getElementById('share-btn').addEventListener('click', () => {
    const s = window._shieldStats || {};
    const ctx = s.context || {};
    const matched = [];
    if (typeof KNOWN_EXTENSIONS !== 'undefined') {
      (ctx.extensionIds || []).forEach(id => {
        const ext = KNOWN_EXTENSIONS[id];
        if (ext) matched.push(`${ext.name} (${ext.category})`);
      });
    }

    let text = `LinkedIn Shield blocked ${s.total || 0} surveillance attempts:\n\n`;
    text += `🔍 ${s.probes || 0} extension probes\n`;
    text += `🖥️ ${s.fingerprints || 0} fingerprints spoofed\n`;
    text += `🛡️ ${s.trackers || 0} trackers blocked\n`;
    if (matched.length > 0) {
      text += `\nLinkedIn checked for: ${matched.slice(0, 5).join(', ')}`;
      if (matched.length > 5) text += ` +${matched.length - 5} more`;
    }
    text += `\n\ngithub.com/Quality-Max/linkedin-shield`;

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('share-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Share Results'; }, 2000);
    });
  });

  // Settings
  document.getElementById('settings-toggle').addEventListener('click', () => {
    const panel = document.getElementById('settings-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  const saved = await chrome.storage.local.get(['ai_api_key', 'ai_provider']);
  if (saved.ai_api_key) {
    document.getElementById('ai-key').value = '••••••••' + saved.ai_api_key.slice(-4);
  }
  if (saved.ai_provider) {
    document.getElementById('ai-provider').value = saved.ai_provider;
  }

  document.getElementById('save-settings').addEventListener('click', async () => {
    const key = document.getElementById('ai-key').value;
    const provider = document.getElementById('ai-provider').value;
    const toSave = { ai_provider: provider };
    if (key && !key.startsWith('••')) {
      toSave.ai_api_key = key;
      if (provider === 'qmax') {
        toSave.ai_api_base = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
        toSave.ai_model = 'qwen3.5-flash';
      }
    }
    await chrome.storage.local.set(toSave);
    document.getElementById('settings-msg').textContent = 'Saved!';
    setTimeout(() => { document.getElementById('settings-msg').textContent = ''; }, 2000);
  });
});
