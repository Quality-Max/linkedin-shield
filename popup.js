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
        if (stats.probes > 0) {
          html += `<div style="margin-bottom:6px;"><span style="color:#ef4444;">&#9632;</span> <strong>${stats.probes} extensions scanned</strong> — LinkedIn checked if you have job search tools, ad blockers, accessibility aids, sales tools, and more installed</div>`;
        }
        if (ctx.fingerprintApis && ctx.fingerprintApis.length > 0) {
          html += `<div style="margin-bottom:6px;"><span style="color:#f59e0b;">&#9632;</span> <strong>Device fingerprinted</strong> — CPU cores, RAM size, and battery status spoofed with fake values</div>`;
        }
        if (stats.trackers > 0) {
          html += `<div style="margin-bottom:6px;"><span style="color:#6366f1;">&#9632;</span> <strong>${stats.trackers} surveillance endpoints</strong> — sensorCollect telemetry and HUMAN Security tracking iframe blocked</div>`;
        }
        if (ctx.blockedUrls && ctx.blockedUrls.length > 0) {
          html += `<div style="margin-top:6px; padding:6px 8px; background:#0d0d14; border-radius:4px; font-family:monospace; font-size:9px; color:#56546a; max-height:60px; overflow-y:auto;">`;
          ctx.blockedUrls.forEach(u => { html += u + '<br>'; });
          html += '</div>';
        }
        details.innerHTML = html;
      }
    }
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
