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
  const seenProbes = new Set();
  const seenTrackers = new Set();

  // ── 1. Block extension probing ──────────────────────────────────────
  // LinkedIn's Spectroscopy script probes chrome-extension:// URLs to
  // detect installed extensions. We intercept fetch/XMLHttpRequest and
  // block any request targeting chrome-extension:// or moz-extension://.

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
      if (!seenProbes.has(url)) { seenProbes.add(url); probesBlocked++; updateBadge(); }
      return Promise.resolve(new Response('', { status: 404 }));
    }
    // Count surveillance endpoints (blocking handled by rules.json at network level)
    const survPattern = matchSurveillanceUrl(url);
    if (survPattern && !seenTrackers.has(survPattern)) {
      seenTrackers.add(survPattern); trackersBlocked++; updateBadge();
    }
    return originalFetch.apply(this, args);
  };

  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (typeof url === 'string') {
      if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
        if (!seenProbes.has(url)) { seenProbes.add(url); probesBlocked++; updateBadge(); }
        this._shieldBlocked = true;
        return;
      }
      const xhrSurvPattern = matchSurveillanceUrl(url);
      if (xhrSurvPattern && !seenTrackers.has(xhrSurvPattern)) {
        seenTrackers.add(xhrSurvPattern); trackersBlocked++; updateBadge();
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
        if (!seenProbes.has('perf:' + name)) { seenProbes.add('perf:' + name); probesBlocked++; updateBadge(); }
        return [];
      }
      return originalGetEntries.call(this, name, ...rest);
    };
  }

  // ── 3. Neuter navigator/device fingerprinting APIs ──────────────────
  // LinkedIn collects 48+ device data points. We add noise to the most
  // sensitive ones without breaking site functionality.

  // Randomize hardwareConcurrency (CPU cores) — count once
  const fakeCores = [2, 4, 8][Math.floor(Math.random() * 3)];
  let cpuCounted = false;
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => {
      if (!cpuCounted) { fingerprintsBlocked++; cpuCounted = true; updateBadge(); }
      return fakeCores;
    }
  });

  // Randomize deviceMemory — count once
  if ('deviceMemory' in navigator) {
    const fakeMem = [4, 8, 16][Math.floor(Math.random() * 3)];
    let memCounted = false;
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => {
        if (!memCounted) { fingerprintsBlocked++; memCounted = true; updateBadge(); }
        return fakeMem;
      }
    });
  }

  // Block battery API — count once
  if ('getBattery' in navigator) {
    let batteryCounted = false;
    navigator.getBattery = () => {
      if (!batteryCounted) { fingerprintsBlocked++; batteryCounted = true; updateBadge(); }
      return Promise.resolve({ charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1.0, addEventListener: () => {} });
    };
  }

  // ── 4. Block hidden iframes ─────────────────────────────────────────
  // LinkedIn injects zero-pixel iframes from li.protechts.net (HUMAN Security).

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.tagName === 'IFRAME') {
          const src = node.src || node.getAttribute('src') || '';
          const isSurveillance = src.includes('protechts.net') || src.includes('li.protechts');
          if (isSurveillance) {
            node.remove();
            if (!seenTrackers.has('iframe:protechts')) { seenTrackers.add('iframe:protechts'); trackersBlocked++; updateBadge(); }
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

  // Only block surveillance-specific endpoints, not general LinkedIn tracking
  // These are already blocked at network level by rules.json — content script
  // only counts them, doesn't need to block (avoids retry loops)
  function matchSurveillanceUrl(url) {
    const patterns = [
      'sensorCollect',
      'protechts.net',
      'spectroscopy',
      'browser-id',
      'fingerprintjs',
    ];
    const lower = url.toLowerCase();
    for (const p of patterns) {
      if (lower.includes(p)) return p;
    }
    return null;
  }

  function isTrackerUrl(url) {
    return matchSurveillanceUrl(url) !== null;
  }

  // ── 6. Badge / stats sync (throttled) ──────────────────────────────

  let badgeTimer = null;
  function updateBadge() {
    if (badgeTimer) return;
    badgeTimer = setTimeout(() => {
      badgeTimer = null;
      const total = probesBlocked + fingerprintsBlocked + trackersBlocked;
      window.postMessage({
        type: 'linkedin_shield_stats',
        probes: probesBlocked,
        fingerprints: fingerprintsBlocked,
        trackers: trackersBlocked,
        total: total,
      }, '*');
    }, 500);
  }

  // Send initial stats after page settles
  setTimeout(updateBadge, 2000);
  setTimeout(updateBadge, 5000);
  setTimeout(updateBadge, 15000);

})();
