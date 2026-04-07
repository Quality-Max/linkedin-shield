/**
 * LinkedIn Shield — Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isLinkedIn = tab?.url?.includes('linkedin.com');

  if (!isLinkedIn) {
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('no-linkedin').style.display = 'block';
    return;
  }

  document.getElementById('page-url').textContent = new URL(tab.url).hostname;

  // Get stats from background
  chrome.runtime.sendMessage({ type: 'get_stats', tabId: tab.id }, (stats) => {
    if (stats) {
      document.getElementById('probes-count').textContent = stats.probes || 0;
      document.getElementById('fingerprints-count').textContent = stats.fingerprints || 0;
      document.getElementById('trackers-count').textContent = stats.trackers || 0;
      document.getElementById('total-count').textContent = stats.total || 0;

      // Show context details
      const ctx = stats.context;
      if (ctx && stats.total > 0) {
        const section = document.getElementById('context-section');
        const details = document.getElementById('context-details');
        section.style.display = 'block';

        let html = '';

        // Extension probing with name lookup
        if (stats.probes > 0) {
          const matched = [];
          const categories = {};
          (ctx.extensionIds || []).forEach(id => {
            const ext = (typeof KNOWN_EXTENSIONS !== 'undefined') ? KNOWN_EXTENSIONS[id] : null;
            if (ext) {
              matched.push(ext);
              categories[ext.category] = (categories[ext.category] || 0) + 1;
            }
          });

          html += `<div style="margin-bottom:8px;"><span style="color:#ef4444;">&#9632;</span> <strong>${stats.probes} extensions scanned</strong></div>`;

          if (matched.length > 0) {
            html += '<div style="margin-left:14px; margin-bottom:6px;">';
            matched.slice(0, 8).forEach(ext => {
              const catColor = ext.category.includes('Automation') ? '#ef4444' : ext.category.includes('Privacy') || ext.category.includes('Ad Blocker') ? '#f59e0b' : ext.category.includes('Accessibility') ? '#a855f7' : '#6366f1';
              html += `<div style="font-size:10px; padding:2px 0;"><span style="color:${catColor};">${ext.name}</span> <span style="color:#3a3854;">(${ext.category})</span></div>`;
            });
            if (matched.length > 8) html += `<div style="font-size:10px; color:#3a3854;">+${matched.length - 8} more known extensions</div>`;
            html += '</div>';

            // Category summary
            const catSummary = Object.entries(categories).map(([cat, count]) => `${count} ${cat.toLowerCase()}`).join(', ');
            html += `<div style="font-size:10px; color:#56546a; margin-bottom:6px;">Categories detected: ${catSummary}</div>`;
          } else {
            html += `<div style="font-size:10px; color:#56546a; margin-left:14px; margin-bottom:6px;">LinkedIn probed ${stats.probes} extension IDs from a list of 6,236 known extensions</div>`;
          }
        }

        if (ctx.fingerprintApis && ctx.fingerprintApis.length > 0) {
          html += `<div style="margin-bottom:6px;"><span style="color:#f59e0b;">&#9632;</span> <strong>Device fingerprinted</strong> — CPU cores, RAM, battery spoofed</div>`;
        }
        if (stats.trackers > 0) {
          html += `<div style="margin-bottom:6px;"><span style="color:#6366f1;">&#9632;</span> <strong>${stats.trackers} surveillance endpoints</strong> blocked</div>`;
        }
        details.innerHTML = html;
      }

      // Store stats for share button
      window._shieldStats = stats;
    }
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

    let text = `LinkedIn Shield blocked ${s.total || 0} surveillance attempts on my last visit:\n\n`;
    text += `🔍 ${s.probes || 0} extension probes (LinkedIn scanned for installed extensions)\n`;
    text += `🖥️ ${s.fingerprints || 0} device fingerprints spoofed\n`;
    text += `🛡️ ${s.trackers || 0} trackers blocked\n`;
    if (matched.length > 0) {
      text += `\nLinkedIn specifically checked for: ${matched.slice(0, 5).join(', ')}`;
      if (matched.length > 5) text += ` +${matched.length - 5} more`;
      text += '\n';
    }
    text += `\nOpen-source: github.com/Quality-Max/linkedin-shield`;

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('share-btn');
      btn.textContent = 'Copied to clipboard!';
      setTimeout(() => { btn.textContent = 'Share Results'; }, 2000);
    });

  // AI Analysis button
  const aiBtn = document.getElementById('ai-analyze-btn');
  const aiResult = document.getElementById('ai-result');

  aiBtn.addEventListener('click', async () => {
    aiBtn.disabled = true;
    aiBtn.textContent = 'Analyzing...';
    aiResult.classList.add('visible');
    aiResult.textContent = 'Connecting to AI...';

    chrome.runtime.sendMessage({ type: 'get_stats', tabId: tab.id }, (stats) => {
      chrome.runtime.sendMessage({ type: 'ai_analyze', stats: stats || {} }, (resp) => {
        if (resp?.analysis) {
          aiResult.textContent = resp.analysis;
        } else if (resp?.error) {
          aiResult.textContent = resp.error;
        } else {
          aiResult.textContent = 'No response from AI.';
        }
        aiBtn.disabled = false;
        aiBtn.textContent = 'Analyze with AI';
      });
    });
  });

  // Settings toggle
  const settingsPanel = document.getElementById('settings-panel');
  document.getElementById('settings-toggle').addEventListener('click', () => {
    settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
  });

  // Load saved settings
  const saved = await chrome.storage.local.get(['ai_api_key', 'ai_provider']);
  if (saved.ai_api_key) {
    document.getElementById('ai-key').value = '••••••••' + saved.ai_api_key.slice(-4);
  }
  if (saved.ai_provider) {
    document.getElementById('ai-provider').value = saved.ai_provider;
  }

  // Save settings
  document.getElementById('save-settings').addEventListener('click', async () => {
    const key = document.getElementById('ai-key').value;
    const provider = document.getElementById('ai-provider').value;

    const toSave = { ai_provider: provider };

    // Only save key if it's a real key (not the masked display)
    if (key && !key.startsWith('••')) {
      toSave.ai_api_key = key;

      // Set API base for QMax
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
