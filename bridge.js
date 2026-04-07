/**
 * LinkedIn Shield — Bridge Script
 * Runs in ISOLATED world. Listens for stats from MAIN world content.js
 * and relays them to the background service worker via chrome.runtime.
 */

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'linkedin_shield_stats') {
    try {
      chrome.runtime.sendMessage({
        type: 'shield_stats',
        probes: event.data.probes || 0,
        fingerprints: event.data.fingerprints || 0,
        trackers: event.data.trackers || 0,
        total: event.data.total || 0,
      });
    } catch (e) {
      // Extension context invalidated
    }
  }
});
