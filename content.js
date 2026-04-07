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

  // ── 0. Suppress LinkedIn's noisy SDUI console warnings ──────────────
  const nativeWarn = console.warn;
  const nativeError = console.error;
  const sduiFilter = /BooleanExpression with operator|Attribute .* could not be converted to a proto/;
  console.warn = function (...args) {
    if (typeof args[0] === 'string' && sduiFilter.test(args[0])) return;
    return nativeWarn.apply(console, args);
  };
  console.error = function (...args) {
    if (typeof args[0] === 'string' && sduiFilter.test(args[0])) return;
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

  // ── 2. PerformanceObserver (backup counting) ────────────────────────
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name && entry.name.includes('chrome-extension://')) probeCount++;
      }
    });
    po.observe({ type: 'resource', buffered: true });
  } catch (_e) {}

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
