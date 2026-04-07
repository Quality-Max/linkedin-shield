/**
 * LinkedIn Shield — Content Script (MAIN world)
 * Runs at document_start on all linkedin.com pages and frames.
 *
 * Intercepts extension probing and device fingerprinting.
 * Tracker blocking is handled by rules.json at network level.
 */

(function () {
  'use strict';

  // ── Shared state via window (persists across SPA navigations) ──
  if (window.__linkedinShieldActive) return; // Already running in this context
  window.__linkedinShieldActive = true;

  const stats = window.__linkedinShieldStats || { probes: 0, fingerprints: 0, trackers: 0 };
  const seen = window.__linkedinShieldSeen || new Set();
  window.__linkedinShieldStats = stats;
  window.__linkedinShieldSeen = seen;

  // Only run full interception in top frame
  if (window !== window.top) return;

  // ── 1. Block extension probing ──────────────────────────────────────

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
      if (!seen.has(url)) { seen.add(url); stats.probes++; syncBadge(); }
      return Promise.resolve(new Response('', { status: 404 }));
    }
    // Count surveillance endpoints once
    const surv = matchSurveillance(url);
    if (surv && !seen.has('surv:' + surv)) { seen.add('surv:' + surv); stats.trackers++; syncBadge(); }
    return originalFetch.apply(this, args);
  };

  const origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (typeof url === 'string') {
      if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
        if (!seen.has(url)) { seen.add(url); stats.probes++; syncBadge(); }
        this._blocked = true;
        return;
      }
      const surv = matchSurveillance(url);
      if (surv && !seen.has('surv:' + surv)) { seen.add('surv:' + surv); stats.trackers++; syncBadge(); }
    }
    return origXhrOpen.call(this, method, url, ...rest);
  };

  const origXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (this._blocked) return;
    return origXhrSend.apply(this, args);
  };

  // ── 2. Block resource timing probes ─────────────────────────────────

  const origPerfEntries = performance.getEntriesByName;
  if (origPerfEntries) {
    performance.getEntriesByName = function (name, ...rest) {
      if (typeof name === 'string' && (name.includes('chrome-extension://') || name.includes('moz-extension://'))) {
        if (!seen.has(name)) { seen.add(name); stats.probes++; syncBadge(); }
        return [];
      }
      return origPerfEntries.call(this, name, ...rest);
    };
  }

  // ── 3. Fingerprint spoofing (count once per API) ────────────────────

  const fakeCores = [2, 4, 8][Math.floor(Math.random() * 3)];
  const fakeMem = [4, 8, 16][Math.floor(Math.random() * 3)];

  if (!seen.has('fp:cpu')) {
    try {
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => {
          if (!seen.has('fp:cpu')) { seen.add('fp:cpu'); stats.fingerprints++; syncBadge(); }
          return fakeCores;
        }
      });
    } catch (e) {} // Already defined
  }

  if ('deviceMemory' in navigator && !seen.has('fp:mem')) {
    try {
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => {
          if (!seen.has('fp:mem')) { seen.add('fp:mem'); stats.fingerprints++; syncBadge(); }
          return fakeMem;
        }
      });
    } catch (e) {}
  }

  if ('getBattery' in navigator) {
    navigator.getBattery = () => {
      if (!seen.has('fp:battery')) { seen.add('fp:battery'); stats.fingerprints++; syncBadge(); }
      return Promise.resolve({ charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1.0, addEventListener: () => {} });
    };
  }

  // ── 4. Remove surveillance iframes ──────────────────────────────────

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.tagName === 'IFRAME') {
          const src = (node.src || '') + (node.getAttribute('src') || '');
          if (src.includes('protechts.net')) {
            node.remove();
            if (!seen.has('iframe:protechts')) { seen.add('iframe:protechts'); stats.trackers++; syncBadge(); }
          }
        }
      }
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  // ── 5. Surveillance URL matcher ─────────────────────────────────────

  function matchSurveillance(url) {
    const patterns = ['sensorCollect', 'protechts.net', 'spectroscopy', 'browser-id', 'fingerprintjs'];
    const lower = url.toLowerCase();
    for (const p of patterns) { if (lower.includes(p)) return p; }
    return null;
  }

  // ── 6. Badge sync (throttled, max once per second) ──────────────────

  let syncTimer = null;
  function syncBadge() {
    if (syncTimer) return;
    syncTimer = setTimeout(() => {
      syncTimer = null;
      const total = stats.probes + stats.fingerprints + stats.trackers;
      window.postMessage({
        type: 'linkedin_shield_stats',
        probes: stats.probes,
        fingerprints: stats.fingerprints,
        trackers: stats.trackers,
        total: total,
      }, '*');
    }, 1000);
  }

  // Initial sync
  setTimeout(syncBadge, 3000);

})();
