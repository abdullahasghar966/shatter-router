/**
 * Measurements of this site (Milestone 11, 2026-11-15), recorded with
 * device and method in context/PROGRESS.md.
 */
export const LANDING = {
  captureMs: '48–88 ms (median 82 ms)',
  where:
    '12 captures in installed Chrome on the RTX 4050 laptop, after the priming capture; 2 outliers of 129 and 156 ms',
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
