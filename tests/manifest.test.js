/**
 * Manifest validation tests — ensures extension config is correct
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const manifest = JSON.parse(readFileSync(resolve(__dirname, '../manifest.json'), 'utf8'));

describe('Manifest — Required Fields', () => {
  it('uses manifest version 3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('has a name', () => {
    expect(manifest.name).toBe('LinkedIn Shield');
  });

  it('has a valid version format', () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('has a description', () => {
    expect(manifest.description).toBeTruthy();
    expect(manifest.description.length).toBeGreaterThan(10);
  });
});

describe('Manifest — Permissions', () => {
  it('requests only necessary permissions', () => {
    const expected = ['storage', 'declarativeNetRequest', 'scripting', 'webNavigation'];
    expect(manifest.permissions).toEqual(expect.arrayContaining(expected));
  });

  it('does not request overly broad permissions', () => {
    const dangerous = ['tabs', 'history', 'bookmarks', 'downloads', 'management'];
    for (const perm of dangerous) {
      expect(manifest.permissions).not.toContain(perm);
    }
  });

  it('has host permissions for LinkedIn domains', () => {
    expect(manifest.host_permissions).toEqual(expect.arrayContaining(['*://*.linkedin.com/*']));
  });

  it('has host permissions for AI APIs', () => {
    const aiHosts = manifest.host_permissions.filter(
      (h) =>
        h.includes('anthropic.com') ||
        h.includes('openai.com') ||
        h.includes('aliyuncs.com') ||
        h.includes('deepseek.com'),
    );
    expect(aiHosts.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Manifest — Content Scripts', () => {
  it('has MAIN world content script for interception', () => {
    const mainScript = manifest.content_scripts.find((cs) => cs.world === 'MAIN');
    expect(mainScript).toBeDefined();
    expect(mainScript.js).toContain('content.js');
    expect(mainScript.run_at).toBe('document_start');
    expect(mainScript.matches).toContain('*://*.linkedin.com/*');
  });

  it('has ISOLATED world bridge script', () => {
    const bridgeScript = manifest.content_scripts.find((cs) => !cs.world || cs.world === 'ISOLATED');
    expect(bridgeScript).toBeDefined();
    expect(bridgeScript.js).toContain('bridge.js');
    expect(bridgeScript.run_at).toBe('document_start');
  });

  it('all referenced scripts exist on disk', () => {
    const scripts = manifest.content_scripts.flatMap((cs) => cs.js);
    for (const script of scripts) {
      expect(existsSync(resolve(__dirname, '..', script))).toBe(true);
    }
  });
});

describe('Manifest — Background', () => {
  it('has background service worker', () => {
    expect(manifest.background.service_worker).toBe('background.js');
  });

  it('background script exists on disk', () => {
    expect(existsSync(resolve(__dirname, '..', manifest.background.service_worker))).toBe(true);
  });
});

describe('Manifest — Icons', () => {
  it('has all required icon sizes', () => {
    const sizes = ['16', '32', '48', '128'];
    for (const size of sizes) {
      expect(manifest.icons[size]).toBeDefined();
    }
  });

  it('icon files exist on disk', () => {
    for (const path of Object.values(manifest.icons)) {
      expect(existsSync(resolve(__dirname, '..', path))).toBe(true);
    }
  });

  it('popup action icons match top-level icons', () => {
    const actionIcons = manifest.action.default_icon;
    for (const [size, path] of Object.entries(actionIcons)) {
      expect(manifest.icons[size]).toBe(path);
    }
  });
});

describe('Manifest — Popup', () => {
  it('has default popup', () => {
    expect(manifest.action.default_popup).toBe('popup.html');
  });

  it('popup file exists on disk', () => {
    expect(existsSync(resolve(__dirname, '..', manifest.action.default_popup))).toBe(true);
  });
});
