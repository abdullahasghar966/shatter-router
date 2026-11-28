/**
 * Measurements of this site, recorded with device and method in
 * context/PROGRESS.md. Capture: Milestone 19 (2026-11-21, ADR-051, ADR-052);
 * Lighthouse: see `how`.
 */
export const LANDING = {
  captureMs: '45–79 ms (median 51 ms)',
  where:
    'installed Chrome on the RTX 4050 laptop, warm captures after the priming capture; the first capture after load takes 103–123 ms',
};

export const LIGHTHOUSE = {
  pages: [
    ['/', 98, 100],
    ['/effects', 96, 100],
    ['/effects/flip', 96, 100],
    ['/playground', 97, 100],
    ['/docs', 100, 100],
    ['/docs/getting-started', 96, 100],
    ['/docs/api', 99, 100],
    ['/docs/custom-effects', 97, 100],
    ['/docs/performance', 97, 100],
  ] as (readonly [string, number, number])[],
  how: 'Lighthouse 12.6.0, mobile (simulated slow 4G and 4× CPU slowdown), on the live site (Vercel), installed Chrome, 2026-11-22. Largest contentful paint 1.4–2.6 s, total blocking time 20–170 ms, layout shift 0.',
};

/**
 * The benchmark page run on the reference machine (`coverage/m20/bench-gpu.mjs`,
 * PROGRESS M20).
 */
export const BENCHMARK_REFERENCE = {
  captureMs: '76–109 ms (median 99–102 ms)',
  fractureMs: '1.5–7.8 ms (median 2.5–2.9 ms)',
  fps: '144 fps (the display’s refresh rate)',
  worstFrameMs: '7.4–20.7 ms (median 7.8–8.1 ms)',
  where:
    'a Windows 11 laptop with an NVIDIA RTX 4050, installed Chrome 157, 1440×900 at 1×, a 144 Hz display; three sessions of five runs on this page, 2026-11-22',
};
