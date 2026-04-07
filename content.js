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

  console.log('[LinkedIn Shield] Content script active (MAIN world)');

  let probeCount = 0;
  let scanComplete = false;
  let scanTimeout = null;
  const probedExtensions = []; // Store first 20 probed extension IDs for context
  const blockedUrls = []; // Store blocked surveillance URLs

  // ── 1. Block extension probing ──────────────────────────────────────

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
      probeCount++;
      if (probedExtensions.length < 20) {
        // Extract extension ID from URL
        const match = url.match(/(?:chrome|moz)-extension:\/\/([^/]+)/);
        if (match) probedExtensions.push(match[1]);
      }
      resetScanTimer();
      return Promise.resolve(new Response('', { status: 404 }));
    }
    // Track blocked surveillance URLs
    if (url.includes('sensorCollect') || url.includes('protechts') || url.includes('spectroscopy')) {
      if (blockedUrls.length < 10) blockedUrls.push(url.substring(0, 100));
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
      context: {
        extensionIds: probedExtensions,
        blockedUrls: blockedUrls,
        fingerprintApis: ['navigator.hardwareConcurrency', 'navigator.deviceMemory', 'navigator.getBattery()'],
        iframesRemoved: iframesRemoved,
      },
    }, '*');
  }

  // Always send stats — even if 0 (so popup knows shield is active)
  setTimeout(() => { if (!scanComplete) finalizeScan(); }, 5000);
  // Second fallback
  setTimeout(() => sendStats(), 15000);

})();
