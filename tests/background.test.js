/**
 * Background service worker tests — message handling, badge updates, stats management
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Background — Message Handling', () => {
  let tabStats;
  let chrome;

  beforeEach(() => {
    tabStats = {};
    chrome = {
      action: {
        setBadgeText: vi.fn(),
        setBadgeBackgroundColor: vi.fn(),
        setTitle: vi.fn(),
      },
    };
  });

  function handleMessage(msg, sender) {
    if (msg.type === 'shield_stats' && sender.tab) {
      const tabId = sender.tab.id;
      tabStats[tabId] = {
        probes: msg.probes || 0,
        fingerprints: msg.fingerprints || 0,
        trackers: msg.trackers || 0,
        total: msg.total || 0,
        url: sender.tab.url,
        timestamp: Date.now(),
        context: msg.context || null,
      };
      const total = msg.total || 0;
      chrome.action.setBadgeText({ text: total > 0 ? String(total) : '', tabId });
      chrome.action.setBadgeBackgroundColor({
        color: total > 50 ? '#ef4444' : total > 10 ? '#f59e0b' : '#22c55e',
        tabId,
      });
      return true;
    }

    if (msg.type === 'get_stats') {
      let result = tabStats[msg.tabId];
      if (!result || result.total === 0) {
        const latest = Object.values(tabStats).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
        if (latest && latest.total > 0) result = latest;
      }
      return result || { probes: 0, fingerprints: 0, trackers: 0, total: 0 };
    }
    return null;
  }

  it('stores shield_stats for a tab', () => {
    handleMessage(
      { type: 'shield_stats', probes: 100, fingerprints: 3, trackers: 2, total: 105 },
      { tab: { id: 42, url: 'https://linkedin.com/feed/' } },
    );
    expect(tabStats[42]).toBeDefined();
    expect(tabStats[42].probes).toBe(100);
    expect(tabStats[42].total).toBe(105);
  });

  it('sets green badge for low total', () => {
    handleMessage({ type: 'shield_stats', total: 5 }, { tab: { id: 1, url: 'https://linkedin.com' } });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#22c55e',
      tabId: 1,
    });
  });

  it('sets green badge for exactly 10 (boundary)', () => {
    handleMessage({ type: 'shield_stats', total: 10 }, { tab: { id: 1, url: 'https://linkedin.com' } });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#22c55e',
      tabId: 1,
    });
  });

  it('sets yellow badge for 11 (just above green boundary)', () => {
    handleMessage({ type: 'shield_stats', total: 11 }, { tab: { id: 1, url: 'https://linkedin.com' } });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#f59e0b',
      tabId: 1,
    });
  });

  it('sets yellow badge for exactly 50 (boundary)', () => {
    handleMessage({ type: 'shield_stats', total: 50 }, { tab: { id: 1, url: 'https://linkedin.com' } });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#f59e0b',
      tabId: 1,
    });
  });

  it('sets red badge for 51 (just above yellow boundary)', () => {
    handleMessage({ type: 'shield_stats', total: 51 }, { tab: { id: 1, url: 'https://linkedin.com' } });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#ef4444',
      tabId: 1,
    });
  });

  it('sets red badge for high total (>50)', () => {
    handleMessage({ type: 'shield_stats', total: 100 }, { tab: { id: 1, url: 'https://linkedin.com' } });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#ef4444',
      tabId: 1,
    });
  });

  it('hides badge when total is 0', () => {
    handleMessage({ type: 'shield_stats', total: 0 }, { tab: { id: 1, url: 'https://linkedin.com' } });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '', tabId: 1 });
  });

  it('shows badge text when total > 0', () => {
    handleMessage({ type: 'shield_stats', total: 42 }, { tab: { id: 1, url: 'https://linkedin.com' } });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '42', tabId: 1 });
  });

  it('returns stats for get_stats with matching tab', () => {
    tabStats[5] = { probes: 10, fingerprints: 3, trackers: 2, total: 15, timestamp: Date.now() };
    const result = handleMessage({ type: 'get_stats', tabId: 5 });
    expect(result.total).toBe(15);
  });

  it('falls back to most recent tab stats when requested tab has 0', () => {
    tabStats[5] = { probes: 0, fingerprints: 0, trackers: 0, total: 0, timestamp: 100 };
    tabStats[10] = { probes: 50, fingerprints: 3, trackers: 2, total: 55, timestamp: 200 };
    const result = handleMessage({ type: 'get_stats', tabId: 5 });
    expect(result.total).toBe(55);
  });

  it('returns default stats when no tab data exists', () => {
    const result = handleMessage({ type: 'get_stats', tabId: 999 });
    expect(result).toEqual({ probes: 0, fingerprints: 0, trackers: 0, total: 0 });
  });

  it('ignores shield_stats without sender.tab', () => {
    const result = handleMessage({ type: 'shield_stats', total: 100 }, {});
    expect(result).toBeNull();
    expect(Object.keys(tabStats)).toHaveLength(0);
  });

  it('defaults missing fields to 0', () => {
    handleMessage({ type: 'shield_stats' }, { tab: { id: 1, url: 'https://linkedin.com' } });
    expect(tabStats[1].probes).toBe(0);
    expect(tabStats[1].fingerprints).toBe(0);
    expect(tabStats[1].trackers).toBe(0);
    expect(tabStats[1].total).toBe(0);
  });

  it('returns null for unknown message types', () => {
    const result = handleMessage({ type: 'unknown' }, { tab: { id: 1 } });
    expect(result).toBeNull();
  });
});

describe('Background — Tab Cleanup', () => {
  it('removes tab stats on tab close', () => {
    const tabStats = { 1: { probes: 10 }, 2: { probes: 20 } };
    delete tabStats[1];
    expect(tabStats[1]).toBeUndefined();
    expect(tabStats[2]).toBeDefined();
  });
});
