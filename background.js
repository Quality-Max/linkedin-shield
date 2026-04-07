/**
 * LinkedIn Shield — Background Service Worker
 * Tracks blocked probes, updates badge, handles AI analysis mode.
 */

// ── Early injection: inject content.js into MAIN world before page scripts ──
chrome.webNavigation?.onCommitted?.addListener(
  (details) => {
    if (details.frameId !== 0) return; // top frame only
    if (!details.url.includes('linkedin.com')) return;
    chrome.scripting
      .executeScript({
        target: { tabId: details.tabId },
        files: ['content.js'],
        world: 'MAIN',
        injectImmediately: true,
      })
      .catch(() => {}); // Ignore errors on restricted pages
  },
  { url: [{ hostContains: 'linkedin.com' }] },
);

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
    chrome.action.setBadgeBackgroundColor({
      color: total > 50 ? '#ef4444' : total > 10 ? '#f59e0b' : '#22c55e',
      tabId,
    });
    chrome.action.setTitle({
      title: `LinkedIn Shield — ${total} blocked\n${msg.probes || 0} extension probes\n${msg.fingerprints || 0} fingerprint APIs spoofed\n${msg.trackers || 0} trackers blocked`,
      tabId,
    });
  }

  if (msg.type === 'get_stats') {
    // Try exact tab first, then fall back to most recent LinkedIn tab stats
    let result = tabStats[msg.tabId];
    if (!result || result.total === 0) {
      const latest = Object.values(tabStats).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
      if (latest && latest.total > 0) result = latest;
    }
    sendResponse(result || { probes: 0, fingerprints: 0, trackers: 0, total: 0 });
    return true;
  }
});

// Track blocked requests via declarativeNetRequest (only in dev mode with Feedback permission)
if (chrome.declarativeNetRequest?.onRuleMatchedDebug) {
  try {
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
        chrome.action.setBadgeBackgroundColor({
          color: total > 50 ? '#ef4444' : total > 10 ? '#f59e0b' : '#22c55e',
          tabId,
        });
      }
    });
  } catch (_e) {
    /* Feedback permission not granted — debug listener unavailable */
  }
}

// Clean up tab stats when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabStats[tabId];
});
