import { describe, expect, it, vi } from 'vitest';
import { frameLoaded } from '../src/capture/index';

describe('frameLoaded (capture sandbox)', () => {
  it('resolves when the frame fires load', async () => {
    const frame = document.createElement('iframe');
    let resolved = false;
    const waiting = frameLoaded(frame, 10_000).then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    frame.dispatchEvent(new Event('load'));
    await waiting;
    expect(resolved).toBe(true);
  });

  it('never waits longer than the timeout', async () => {
    vi.useFakeTimers();
    try {
      const frame = document.createElement('iframe');
      let resolved = false;
      const waiting = frameLoaded(frame, 1000).then(() => {
        resolved = true;
      });
      await vi.advanceTimersByTimeAsync(999);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await waiting;
      expect(resolved).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
