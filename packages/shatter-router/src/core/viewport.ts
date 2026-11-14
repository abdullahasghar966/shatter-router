/** Highest device-pixel ratio the overlay renders at (master prompt, section 3.3). */
export const MAX_DPR = 2;

/** A measurement of the visible viewport, in CSS pixels unless noted. */
export interface ViewportMetrics {
  /** Width of the visible area, excluding a classic vertical scrollbar. */
  readonly width: number;
  /** Height of the visible area, excluding a classic horizontal scrollbar. */
  readonly height: number;
  readonly scrollX: number;
  readonly scrollY: number;
  /** Backing-store pixels per CSS pixel: `min(devicePixelRatio, 2)`. */
  readonly scale: number;
  /** True when the page is pinch-zoomed; the WebGL effect must not run then. */
  readonly pinchZoomed: boolean;
}

/**
 * Reads the viewport the overlay has to cover. `visualViewport` is preferred
 * because it excludes classic scrollbars and stays fractional under browser
 * zoom; `documentElement.clientWidth/Height` is the fallback.
 */
export function readViewport(win: Window): ViewportMetrics {
  const root = win.document.documentElement;
  const visual = win.visualViewport;
  const pinchZoomed = visual ? Math.abs(visual.scale - 1) > 0.01 : false;
  const useVisual = visual !== null && !pinchZoomed && visual.width > 0 && visual.height > 0;
  return {
    width: useVisual ? visual.width : root.clientWidth,
    height: useVisual ? visual.height : root.clientHeight,
    scrollX: win.scrollX,
    scrollY: win.scrollY,
    scale: Math.min(win.devicePixelRatio || 1, MAX_DPR),
    pinchZoomed,
  };
}

/** Backing-store size for a viewport, shrunk uniformly if it would exceed `maxSize`. */
export function deviceSize(
  viewport: Pick<ViewportMetrics, 'width' | 'height' | 'scale'>,
  maxSize: number,
): { width: number; height: number; scale: number } {
  let scale = viewport.scale;
  const longest = Math.max(viewport.width, viewport.height) * scale;
  if (longest > maxSize) scale *= maxSize / longest;
  return {
    width: Math.max(1, Math.round(viewport.width * scale)),
    height: Math.max(1, Math.round(viewport.height * scale)),
    scale,
  };
}
