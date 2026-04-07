/**
 * LinkedIn Shield — Content Script (MAIN world)
 *
 * Blocks extension probing and spoofs fingerprint APIs.
 * Does NOT count in real-time (avoids infinite counter bug).
 * Stats are snapshot-based: count once after initial scan completes.
 */

(function () {
  'use strict';

  if (window.__linkedinShieldActive) return;
  window.__linkedinShieldActive = true;
  if (window !== window.top) return;

  let probeCount = 0;
  let scanComplete = false;
  let scanTimeout = null;

  // ── 1. Block extension probing ──────────────────────────────────────

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
      probeCount++;
      resetScanTimer();
      return Promise.resolve(new Response('', { status: 404 }));
    }
    return originalFetch.apply(this, args);
  };

  const origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (typeof url === 'string' && (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://'))) {
      probeCount++;
      resetScanTimer();
      this._blocked = true;
      return;
    }
    return origXhrOpen.call(this, method, url, ...rest);
  };

  const origXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (this._blocked) return;
    return origXhrSend.apply(this, args);
  };

  // ── 2. Fingerprint spoofing ─────────────────────────────────────────

  try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 }); } catch (e) {}
  try { if ('deviceMemory' in navigator) Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); } catch (e) {}
  if ('getBattery' in navigator) {
    navigator.getBattery = () => Promise.resolve({
      charging: true, chargingTime: 0, dischargingTime: Infinity,
      level: 1.0, addEventListener: () => {}
    });
  }

  // ── 3. Remove surveillance iframes ──────────────────────────────────

  let iframesRemoved = 0;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.tagName === 'IFRAME' && (node.src || '').includes('protechts.net')) {
          node.remove();
          iframesRemoved++;
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

  // ── 4. Scan completion detection ────────────────────────────────────
  // LinkedIn fires all probes in a burst. When probes stop for 3 seconds,
  // consider the scan complete and send final stats once.

  function resetScanTimer() {
    if (scanComplete) return;
    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(finalizeScan, 3000);
  }

  function finalizeScan() {
    if (scanComplete) return;
    scanComplete = true;
    sendStats();
  }

  function sendStats() {
    // 3 fingerprint APIs always spoofed (CPU, memory, battery)
    const fingerprints = 3;
    // Trackers: sensorCollect + protechts (blocked by rules.json)
    const trackers = 2 + iframesRemoved;
    const total = probeCount + fingerprints + trackers;

    window.postMessage({
      type: 'linkedin_shield_stats',
      probes: probeCount,
      fingerprints: fingerprints,
      trackers: trackers,
      total: total,
    }, '*');
  }

  // Fallback: send stats after 10s even if scan doesn't complete
  setTimeout(() => { if (!scanComplete) finalizeScan(); }, 10000);

})();
