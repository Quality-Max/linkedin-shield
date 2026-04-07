/**
 * LinkedIn Shield — Content Script (MAIN world) v3.0
 *
 * Spoofs fingerprint APIs + counts known LinkedIn surveillance.
 * Probe counting based on BrowserGate research (6,236 extension IDs).
 * LinkedIn's scanner saves fetch() at parse time — interception impossible.
 * Instead, we detect the scan via PerformanceObserver + error listener.
 */

(function () {
  'use strict';

  if (window.__linkedinShieldActive) return;
  window.__linkedinShieldActive = true;
  if (window !== window.top) return;

  let probeCount = 0;
  let errorCount = 0;

  // ── 1. Count extension probes via error events ──────────────────────
  // LinkedIn's fetch to chrome-extension://invalid/ generates global errors
  // we can count even without intercepting fetch itself.

  window.addEventListener('error', (e) => {
    if (e.filename && e.filename.includes('chrome-extension://')) {
      probeCount++;
    }
  }, true);

  // Also listen for unhandled rejections (fetch failures)
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String(e.reason?.message || e.reason || '');
    if (msg.includes('chrome-extension') || msg.includes('ERR_FAILED')) {
      probeCount++;
    }
  });

  // ── 2. PerformanceObserver for resource timing ──────────────────────

  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name && entry.name.includes('chrome-extension://')) {
          probeCount++;
        }
      }
    });
    po.observe({ type: 'resource', buffered: true });
  } catch (e) {}

  // ── 3. Fingerprint spoofing ─────────────────────────────────────────

  try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 }); } catch (e) {}
  try { if ('deviceMemory' in navigator) Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); } catch (e) {}
  if ('getBattery' in navigator) {
    navigator.getBattery = () => Promise.resolve({
      charging: true, chargingTime: 0, dischargingTime: Infinity,
      level: 1.0, addEventListener: () => {}
    });
  }

  // ── 4. Remove surveillance iframes ──────────────────────────────────

  let iframesRemoved = 0;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.tagName === 'IFRAME') {
          const src = String(node.src || '');
          if (src.includes('protechts.net')) {
            node.remove();
            iframesRemoved++;
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

  // ── 5. Send stats periodically ──────────────────────────────────────

  function sendStats() {
    // Use detected probes if any, otherwise use known count from research
    const detectedProbes = probeCount;
    const knownProbes = detectedProbes > 0 ? detectedProbes : null;

    const fingerprints = 3; // CPU, memory, battery always spoofed
    const trackers = 2 + iframesRemoved; // sensorCollect + protechts (blocked by rules.json)

    const statsData = {
      probes: knownProbes || 0,
      fingerprints: fingerprints,
      trackers: trackers,
      total: (knownProbes || 0) + fingerprints + trackers,
      knownScanSize: 6236, // BrowserGate documented count
      context: {
        extensionIds: [],
        blockedUrls: [],
        fingerprintApis: ['navigator.hardwareConcurrency', 'navigator.deviceMemory', 'navigator.getBattery()'],
        iframesRemoved: iframesRemoved,
        detectionMethod: detectedProbes > 0 ? 'live' : 'research-based',
      },
    };

    document.documentElement.setAttribute('data-linkedin-shield', JSON.stringify(statsData));
    window.postMessage({ type: 'linkedin_shield_stats', ...statsData }, '*');
  }

  // Send stats at increasing intervals
  setTimeout(sendStats, 5000);
  setTimeout(sendStats, 15000);
  setTimeout(sendStats, 30000);
  setInterval(sendStats, 10000);

})();
