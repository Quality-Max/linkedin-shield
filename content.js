/**
 * LinkedIn Shield — Content Script
 * Runs at document_start on all linkedin.com pages.
 *
 * Intercepts and neutralizes extension probing, device fingerprinting,
 * and hidden tracker injection at the JavaScript level.
 */

(function () {
  'use strict';

  const SHIELD_PREFIX = '[LinkedIn Shield]';
  let probesBlocked = 0;
  let fingerprintsBlocked = 0;
  let trackersBlocked = 0;

  // ── 1. Block extension probing ──────────────────────────────────────
  // LinkedIn's Spectroscopy script probes chrome-extension:// URLs to
  // detect installed extensions. We intercept fetch/XMLHttpRequest and
  // block any request targeting chrome-extension:// or moz-extension://.

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
      probesBlocked++;
      updateBadge();
      return Promise.reject(new TypeError('LinkedIn Shield: extension probe blocked'));
    }
    // Block known tracking endpoints
    if (isTrackerUrl(url)) {
      trackersBlocked++;
      updateBadge();
      return Promise.resolve(new Response('', { status: 204 }));
    }
    return originalFetch.apply(this, args);
  };

  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (typeof url === 'string') {
      if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
        probesBlocked++;
        updateBadge();
        // Set a flag so send() becomes a no-op
        this._shieldBlocked = true;
        return;
      }
      if (isTrackerUrl(url)) {
        trackersBlocked++;
        updateBadge();
        this._shieldBlocked = true;
        return;
      }
    }
    return originalXHROpen.call(this, method, url, ...rest);
  };

  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (this._shieldBlocked) return;
    return originalXHRSend.apply(this, args);
  };

  // ── 2. Block resource timing probe ──────────────────────────────────
  // Extensions can also be detected via performance.getEntriesByName()
  // which reveals loaded resource URLs including extension resources.

  const originalGetEntries = performance.getEntriesByName;
  if (originalGetEntries) {
    performance.getEntriesByName = function (name, ...rest) {
      if (typeof name === 'string' && (name.includes('chrome-extension://') || name.includes('moz-extension://'))) {
        probesBlocked++;
        updateBadge();
        return [];
      }
      return originalGetEntries.call(this, name, ...rest);
    };
  }

  // ── 3. Neuter navigator/device fingerprinting APIs ──────────────────
  // LinkedIn collects 48+ device data points. We add noise to the most
  // sensitive ones without breaking site functionality.

  // Randomize hardwareConcurrency (CPU cores)
  const realCores = navigator.hardwareConcurrency;
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => {
      fingerprintsBlocked++;
      return [2, 4, 8][Math.floor(Math.random() * 3)];
    }
  });

  // Randomize deviceMemory
  if ('deviceMemory' in navigator) {
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => {
        fingerprintsBlocked++;
        return [4, 8, 16][Math.floor(Math.random() * 3)];
      }
    });
  }

  // Block battery API (reveals charging status / battery level)
  if ('getBattery' in navigator) {
    navigator.getBattery = () => {
      fingerprintsBlocked++;
      updateBadge();
      return Promise.reject(new Error('LinkedIn Shield: battery API blocked'));
    };
  }

  // ── 4. Block hidden iframes ─────────────────────────────────────────
  // LinkedIn injects zero-pixel iframes from li.protechts.net (HUMAN Security).

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.tagName === 'IFRAME') {
          const src = node.src || node.getAttribute('src') || '';
          if (src.includes('protechts.net') || src.includes('li.protechts') ||
              (node.width === '0' && node.height === '0') ||
              node.style.display === 'none' || node.style.width === '0px') {
            node.remove();
            trackersBlocked++;
            updateBadge();
          }
        }
      }
    }
  });

  // Start observing once DOM is ready
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  // ── 5. Tracker URL detection ────────────────────────────────────────

  function isTrackerUrl(url) {
    const patterns = [
      '/li/track',
      'sensorCollect',
      'protechts.net',
      'spectroscopy',
      'browser-id',
      'fingerprintjs',
      '/platform-telemetry/',
      '/realtime/frontBuzz498',
    ];
    const lower = url.toLowerCase();
    return patterns.some(p => lower.includes(p));
  }

  // ── 6. Badge / stats sync ───────────────────────────────────────────

  function updateBadge() {
    const total = probesBlocked + fingerprintsBlocked + trackersBlocked;
    // Post to bridge.js (ISOLATED world) which relays to background
    window.postMessage({
      type: 'linkedin_shield_stats',
      probes: probesBlocked,
      fingerprints: fingerprintsBlocked,
      trackers: trackersBlocked,
      total: total,
    }, '*');
  }

  // Send initial stats after page settles
  setTimeout(updateBadge, 2000);
  setTimeout(updateBadge, 5000);
  setTimeout(updateBadge, 15000);

})();
