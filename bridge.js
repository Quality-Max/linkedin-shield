/**
 * LinkedIn Shield — Bridge Script (ISOLATED world)
 * Relays stats from MAIN world content.js to background service worker.
 */

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'linkedin_shield_stats') {
    try {
      if (!chrome.runtime?.sendMessage) return;
      chrome.runtime.sendMessage({
        type: 'shield_stats',
        probes: event.data.probes || 0,
        fingerprints: event.data.fingerprints || 0,
        trackers: event.data.trackers || 0,
        total: event.data.total || 0,
        context: event.data.context || null,
      });
    } catch (_e) {
      // Extension context invalidated (reload/update) — silently ignore
    }
  }
});
