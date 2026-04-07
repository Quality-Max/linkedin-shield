/**
 * Bridge script tests — message relay from MAIN to ISOLATED world
 */
import { describe, it, expect, vi } from 'vitest';

describe('Bridge — Message Relay', () => {
  function createBridgeHandler(sendMessage) {
    return (event) => {
      if (event.source !== 'window') return;
      if (event.data?.type === 'linkedin_shield_stats') {
        sendMessage({
          type: 'shield_stats',
          probes: event.data.probes || 0,
          fingerprints: event.data.fingerprints || 0,
          trackers: event.data.trackers || 0,
          total: event.data.total || 0,
          context: event.data.context || null,
        });
      }
    };
  }

  it('relays linkedin_shield_stats messages', () => {
    const sendMessage = vi.fn();
    const handler = createBridgeHandler(sendMessage);

    handler({
      source: 'window',
      data: {
        type: 'linkedin_shield_stats',
        probes: 42,
        fingerprints: 3,
        trackers: 5,
        total: 50,
        context: { detectionMethod: 'live' },
      },
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'shield_stats',
      probes: 42,
      fingerprints: 3,
      trackers: 5,
      total: 50,
      context: { detectionMethod: 'live' },
    });
  });

  it('ignores messages from other sources', () => {
    const sendMessage = vi.fn();
    const handler = createBridgeHandler(sendMessage);

    handler({
      source: 'other-frame',
      data: { type: 'linkedin_shield_stats', probes: 10 },
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('ignores non-shield messages', () => {
    const sendMessage = vi.fn();
    const handler = createBridgeHandler(sendMessage);

    handler({
      source: 'window',
      data: { type: 'some_other_message', value: 123 },
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('defaults missing fields to 0', () => {
    const sendMessage = vi.fn();
    const handler = createBridgeHandler(sendMessage);

    handler({
      source: 'window',
      data: { type: 'linkedin_shield_stats' },
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'shield_stats',
      probes: 0,
      fingerprints: 0,
      trackers: 0,
      total: 0,
      context: null,
    });
  });
});
