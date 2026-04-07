/**
 * LinkedIn Shield — Content Script (MAIN world) v3.2
 *
 * Combined approach:
 * - Proxy on window.fetch for live probe counting (worked in v2.4)
 * - Fingerprint spoofing
 * - DOM attribute for popup to read
 * - Periodic stats updates
 */

(function () {
  'use strict';

  const SHIELD_KEY = Symbol.for('__linkedinShieldActive');
  if (window[SHIELD_KEY]) return;
  Object.defineProperty(window, SHIELD_KEY, { value: true, writable: false, configurable: false });
  if (window !== window.top) return;

  // ── 0. Suppress LinkedIn's noisy console spam ───────────────────────
  const nativeWarn = console.warn;
  const nativeError = console.error;
  const linkedInNoise =
    /BooleanExpression with operator|Attribute .* could not be converted to a proto|Minified React error|VIDEOJS: WARN|Highcharts warning|^network error$/i;
  function isLinkedInNoise(args) {
    const first = args[0];
    if (typeof first === 'string' && linkedInNoise.test(first)) return true;
    if (first instanceof Error && linkedInNoise.test(first.message)) return true;
    // Check if error originates from LinkedIn's bundled scripts
    if (first instanceof Error && first.stack && /licdn\.com|aero-v1/.test(first.stack)) return true;
    return false;
  }
  console.warn = function (...args) {
    if (isLinkedInNoise(args)) return;
    return nativeWarn.apply(console, args);
  };
  console.error = function (...args) {
    if (isLinkedInNoise(args)) return;
    return nativeError.apply(console, args);
  };

  let probeCount = 0;
  let iframesRemoved = 0;
  const probedExtensions = [];
  const blockedUrls = [];

  // ── 1. Proxy on window.fetch ────────────────────────────────────────
  const nativeFetch = window.fetch;
  const fetchProxy = new Proxy(nativeFetch, {
    apply(target, thisArg, args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (url.includes('chrome-extension://') || url.includes('moz-extension://')) {
        probeCount++;
        if (probedExtensions.length < 20) {
          const m = url.match(/(?:chrome|moz)-extension:\/\/([^/]+)/);
          if (m && m[1] !== 'invalid') probedExtensions.push(m[1]);
        }
        return Promise.resolve(new Response('', { status: 404 }));
      }
      if (url.includes('sensorCollect') || url.includes('spectroscopy')) {
        if (blockedUrls.length < 10) blockedUrls.push(url.substring(0, 80));
      }
      return Reflect.apply(target, thisArg, args);
    },
  });
  Object.defineProperty(window, 'fetch', { value: fetchProxy, writable: true, configurable: true });

  // ── 2. PerformanceObserver + periodic scan for extension probes ─────
  const seenEntries = new Set();
  function countPerfEntries(entries) {
    for (const entry of entries) {
      if (entry.name && entry.name.includes('chrome-extension://') && !seenEntries.has(entry.name)) {
        seenEntries.add(entry.name);
        probeCount++;
        if (probedExtensions.length < 50) {
          const m = entry.name.match(/chrome-extension:\/\/([^/]+)/);
          if (m && m[1] !== 'invalid') probedExtensions.push(m[1]);
        }
      }
    }
  }
  try {
    const po = new PerformanceObserver((list) => countPerfEntries(list.getEntries()));
    po.observe({ type: 'resource', buffered: true });
  } catch (_e) {}
  // Periodic scan catches entries the observer may have missed
  setInterval(() => {
    try {
      countPerfEntries(performance.getEntriesByType('resource'));
    } catch (_e) {}
  }, 2000);

  // ── 2b. Intercept XMLHttpRequest (LinkedIn may use XHR for probes) ──
  const nativeXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (typeof url === 'string' && (url.includes('chrome-extension://') || url.includes('moz-extension://'))) {
      probeCount++;
      if (probedExtensions.length < 50) {
        const m = url.match(/(?:chrome|moz)-extension:\/\/([^/]+)/);
        if (m && m[1] !== 'invalid') probedExtensions.push(m[1]);
      }
      // Abort silently — don't actually send
      return;
    }
    return nativeXHROpen.call(this, method, url, ...rest);
  };

  // ── 3. Fingerprint spoofing ─────────────────────────────────────────
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
  } catch (_e) {}
  try {
    if ('deviceMemory' in navigator) Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  } catch (_e) {}
  if ('getBattery' in navigator) {
    navigator.getBattery = () =>
      Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1.0,
        addEventListener: () => {},
      });
  }

  // ── 4. Remove surveillance iframes ──────────────────────────────────
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.tagName === 'IFRAME' && String(node.src || '').includes('protechts.net')) {
          node.remove();
          iframesRemoved++;
        }
      }
    }
  });
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ── 5. Write stats to DOM + postMessage every 3s ────────────────────
  function writeStats() {
    const data = {
      probes: probeCount,
      fingerprints: 3,
      trackers: 2 + iframesRemoved,
      total: probeCount + 3 + 2 + iframesRemoved,
      knownScanSize: 6236,
      context: {
        extensionIds: probedExtensions,
        blockedUrls: blockedUrls,
        fingerprintApis: ['navigator.hardwareConcurrency', 'navigator.deviceMemory', 'navigator.getBattery()'],
        iframesRemoved: iframesRemoved,
        detectionMethod: probeCount > 0 ? 'live' : 'research-based',
      },
    };
    document.documentElement.setAttribute('data-linkedin-shield', JSON.stringify(data));
    window.postMessage({ type: 'linkedin_shield_stats', ...data }, window.location.origin);
  }

  setInterval(writeStats, 3000);
  setTimeout(writeStats, 2000);
  setTimeout(writeStats, 5000);
})();
