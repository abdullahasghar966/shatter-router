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
    ['/', 97, 100],
    ['/effects', 97, 100],
    ['/effects/flip', 97, 100],
    ['/playground', 97, 100],
    ['/docs', 97, 100],
    ['/docs/getting-started', 97, 100],
    ['/docs/api', 97, 100],
    ['/docs/custom-effects', 97, 100],
    ['/docs/performance', 99, 100],
  ] as (readonly [string, number, number])[],
  how: 'Lighthouse 12.6.0, mobile (simulated slow 4G and 4× CPU slowdown), production build served locally, installed Chrome 157. Largest contentful paint 2.0–2.5 s, total blocking time 20–90 ms, layout shift ≤ 0.004.',
};
