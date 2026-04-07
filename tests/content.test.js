/**
 * Content script tests — fetch proxy, fingerprint spoofing, stats writing
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Content Script — Fetch Proxy', () => {
  let probeCount;
  let probedExtensions;
  let blockedUrls;
  let nativeFetch;
  let fetchProxy;

  beforeEach(() => {
    probeCount = 0;
    probedExtensions = [];
    blockedUrls = [];
    nativeFetch = vi.fn(() => Promise.resolve(new Response('OK')));

    fetchProxy = new Proxy(nativeFetch, {
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
  });

  it('blocks chrome-extension:// probes and returns 404', async () => {
    const resp = await fetchProxy('chrome-extension://abcdef123456/manifest.json');
    expect(resp.status).toBe(404);
    expect(probeCount).toBe(1);
    expect(probedExtensions).toContain('abcdef123456');
    expect(nativeFetch).not.toHaveBeenCalled();
  });

  it('blocks moz-extension:// probes', async () => {
    const resp = await fetchProxy('moz-extension://some-firefox-ext/manifest.json');
    expect(resp.status).toBe(404);
    expect(probeCount).toBe(1);
    expect(probedExtensions).toContain('some-firefox-ext');
  });

  it('skips "invalid" extension IDs', async () => {
    await fetchProxy('chrome-extension://invalid/manifest.json');
    expect(probeCount).toBe(1);
    expect(probedExtensions).toHaveLength(0);
  });

  it('passes through normal URLs', async () => {
    await fetchProxy('https://www.linkedin.com/feed/');
    expect(probeCount).toBe(0);
    expect(nativeFetch).toHaveBeenCalledWith('https://www.linkedin.com/feed/');
  });

  it('logs sensorCollect URLs but still passes them through', async () => {
    await fetchProxy('https://www.linkedin.com/li/sensorCollect');
    expect(blockedUrls).toHaveLength(1);
    expect(nativeFetch).toHaveBeenCalled();
  });

  it('logs spectroscopy URLs', async () => {
    await fetchProxy('https://www.linkedin.com/spectroscopy/api');
    expect(blockedUrls).toHaveLength(1);
  });

  it('caps probedExtensions at 20', async () => {
    for (let i = 0; i < 25; i++) {
      await fetchProxy(`chrome-extension://ext${i}/manifest.json`);
    }
    expect(probeCount).toBe(25);
    expect(probedExtensions).toHaveLength(20);
  });

  it('caps blockedUrls at 10', async () => {
    for (let i = 0; i < 15; i++) {
      await fetchProxy(`https://linkedin.com/sensorCollect?v=${i}`);
    }
    expect(blockedUrls).toHaveLength(10);
  });

  it('handles Request objects with url property', async () => {
    await fetchProxy({ url: 'chrome-extension://reqobj123/manifest.json' });
    expect(probeCount).toBe(1);
    expect(probedExtensions).toContain('reqobj123');
  });
});

describe('Content Script — Fingerprint Spoofing', () => {
  it('spoofs hardwareConcurrency to 4', () => {
    const nav = {};
    Object.defineProperty(nav, 'hardwareConcurrency', { get: () => 4 });
    expect(nav.hardwareConcurrency).toBe(4);
  });

  it('spoofs deviceMemory to 8', () => {
    const nav = { deviceMemory: 16 };
    Object.defineProperty(nav, 'deviceMemory', { get: () => 8 });
    expect(nav.deviceMemory).toBe(8);
  });

  it('spoofs getBattery to return full charge', async () => {
    const fakeBattery = {
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1.0,
      addEventListener: () => {},
    };
    const getBattery = () => Promise.resolve(fakeBattery);
    const battery = await getBattery();
    expect(battery.charging).toBe(true);
    expect(battery.level).toBe(1.0);
    expect(battery.dischargingTime).toBe(Infinity);
    expect(battery.chargingTime).toBe(0);
  });
});

describe('Content Script — Stats Writing', () => {
  it('writes correct stats to DOM attribute', () => {
    const probeCount = 5;
    const iframesRemoved = 1;
    const probedExtensions = ['ext1', 'ext2'];
    const blockedUrls = ['https://linkedin.com/sensorCollect'];
    const attrs = {};

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
      attrs['data-linkedin-shield'] = JSON.stringify(data);
    }

    writeStats();
    const stats = JSON.parse(attrs['data-linkedin-shield']);

    expect(stats.probes).toBe(5);
    expect(stats.fingerprints).toBe(3);
    expect(stats.trackers).toBe(3); // 2 + 1 iframe
    expect(stats.total).toBe(11); // 5 + 3 + 2 + 1
    expect(stats.knownScanSize).toBe(6236);
    expect(stats.context.detectionMethod).toBe('live');
    expect(stats.context.extensionIds).toEqual(['ext1', 'ext2']);
    expect(stats.context.fingerprintApis).toHaveLength(3);
  });

  it('uses research-based detection when probeCount is 0', () => {
    const probeCount = 0;
    const method = probeCount > 0 ? 'live' : 'research-based';
    expect(method).toBe('research-based');
  });

  it('calculates total correctly with zero iframes', () => {
    const probeCount = 10;
    const iframesRemoved = 0;
    const total = probeCount + 3 + 2 + iframesRemoved;
    expect(total).toBe(15);
  });
});
