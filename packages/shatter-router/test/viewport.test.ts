import { describe, expect, it } from 'vitest';
import { deviceSize, MAX_DPR, readViewport } from '../src/core/viewport';

interface FakeWindowInit {
  dpr: number;
  client: [number, number];
  scroll?: [number, number];
  visual?: { width: number; height: number; scale: number } | null;
}

function fakeWindow(init: FakeWindowInit): Window {
  return {
    devicePixelRatio: init.dpr,
    scrollX: init.scroll?.[0] ?? 0,
    scrollY: init.scroll?.[1] ?? 0,
    visualViewport: init.visual ?? null,
    document: { documentElement: { clientWidth: init.client[0], clientHeight: init.client[1] } },
  } as unknown as Window;
}

describe('readViewport', () => {
  it('prefers the visual viewport (fractional, scrollbar-free)', () => {
    const viewport = readViewport(
      fakeWindow({
        dpr: 1.1,
        client: [1164, 655],
        scroll: [0, 120.5],
        visual: { width: 1163.64, height: 654.55, scale: 1 },
      }),
    );
    expect(viewport).toEqual({
      width: 1163.64,
      height: 654.55,
      scrollX: 0,
      scrollY: 120.5,
      scale: 1.1,
      pinchZoomed: false,
    });
  });

  it('falls back to the client size without a visual viewport', () => {
    const viewport = readViewport(fakeWindow({ dpr: 1, client: [1263, 720] }));
    expect(viewport.width).toBe(1263);
    expect(viewport.height).toBe(720);
    expect(viewport.pinchZoomed).toBe(false);
  });

  it('flags pinch zoom and ignores the zoomed visual size', () => {
    const viewport = readViewport(
      fakeWindow({ dpr: 3, client: [390, 844], visual: { width: 195, height: 422, scale: 2 } }),
    );
    expect(viewport.pinchZoomed).toBe(true);
    expect(viewport.width).toBe(390);
    expect(viewport.height).toBe(844);
  });

  it(`caps the scale at ${MAX_DPR}`, () => {
    expect(readViewport(fakeWindow({ dpr: 3, client: [390, 844] })).scale).toBe(2);
    expect(readViewport(fakeWindow({ dpr: 0, client: [390, 844] })).scale).toBe(1);
  });
});

describe('deviceSize', () => {
  it('multiplies by the scale and rounds to whole pixels', () => {
    expect(deviceSize({ width: 1163.64, height: 654.55, scale: 1.1 }, 8192)).toEqual({
      width: 1280,
      height: 720,
      scale: 1.1,
    });
  });

  it('shrinks both sides together when the texture limit is exceeded', () => {
    const size = deviceSize({ width: 3000, height: 1500, scale: 2 }, 4096);
    expect(size.width).toBe(4096);
    expect(size.height).toBe(2048);
    expect(size.scale).toBeCloseTo(4096 / 3000, 10);
    expect(size.width / size.height).toBeCloseTo(2, 3);
  });

  it('never returns an empty size', () => {
    expect(deviceSize({ width: 0.2, height: 0.2, scale: 1 }, 4096)).toMatchObject({
      width: 1,
      height: 1,
    });
  });
});
