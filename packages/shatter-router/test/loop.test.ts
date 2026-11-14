import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameLoop } from '../src/engine/loop';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('FrameLoop', () => {
  it('steps once per frame until the step returns true', async () => {
    const loop = new FrameLoop(window);
    let calls = 0;
    await loop.run(() => ++calls === 4);
    expect(calls).toBe(4);
    expect(loop.lastStats.frames).toBe(4);
    expect(loop.running).toBe(false);
  });

  it('passes non-decreasing timestamps', async () => {
    const loop = new FrameLoop(window);
    const times: number[] = [];
    await loop.run((now) => {
      times.push(now);
      return times.length === 5;
    });
    for (let i = 1; i < times.length; i++) {
      expect(times[i] ?? 0).toBeGreaterThanOrEqual(times[i - 1] ?? 0);
    }
  });

  it('keeps going on a timer when no frames come (hidden tab)', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const loop = new FrameLoop(window);
    let calls = 0;
    const done = loop.run(() => ++calls === 3);
    await vi.advanceTimersByTimeAsync(450);
    await done;
    expect(calls).toBe(3);
  });

  it('stop() ends a run early and resolves it', async () => {
    const loop = new FrameLoop(window);
    const done = loop.run(() => false);
    loop.stop();
    await expect(done).resolves.toBeUndefined();
    expect(loop.running).toBe(false);
  });

  it('a new run ends the previous one', async () => {
    const loop = new FrameLoop(window);
    const first = loop.run(() => false);
    const second = loop.run(() => true);
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });

  it('rejects the run when a step throws, instead of throwing from a frame callback', async () => {
    const loop = new FrameLoop(window);
    let calls = 0;
    const done = loop.run(() => {
      calls += 1;
      if (calls === 2) throw new Error('lost context');
      return false;
    });
    await expect(done).rejects.toThrow('lost context');
    expect(loop.running).toBe(false);
  });
});
