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
