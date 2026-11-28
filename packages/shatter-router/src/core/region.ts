/**
 * Regions (ADR-063): the part of the page one transition breaks. A region is
 * snapped to whole device pixels once, and the crop, the geometry and the cover
 * all use that same grid, so the first-frame seam is measured on the pixels a
 * region covers and nothing shifts by a sub-pixel between them.
 */

/** A rectangle in CSS pixels of the viewport, with its device-pixel grid. */
export interface Region {
  /** CSS pixels, viewport coordinates (the top-left of the viewport is 0, 0). */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** The same rectangle in device pixels, on whole numbers. */
  readonly deviceX: number;
  readonly deviceY: number;
  readonly deviceWidth: number;
  readonly deviceHeight: number;
}

/** The box of an element, as `getBoundingClientRect` reports it. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The region an element's box covers in a viewport, snapped outward to whole
 * device pixels (floor of the top-left, ceil of the bottom-right, both clamped
 * to the viewport). Null when nothing of the box is visible.
 */
export function snapRegion(
  box: Box,
  viewport: { readonly width: number; readonly height: number },
  scale: number,
): Region | null {
  if (!(scale > 0) || !(viewport.width > 0) || !(viewport.height > 0)) return null;
  const deviceViewportWidth = Math.round(viewport.width * scale);
  const deviceViewportHeight = Math.round(viewport.height * scale);
  const x0 = clamp(Math.floor(box.left * scale), 0, deviceViewportWidth);
  const y0 = clamp(Math.floor(box.top * scale), 0, deviceViewportHeight);
  const x1 = clamp(Math.ceil((box.left + box.width) * scale), 0, deviceViewportWidth);
  const y1 = clamp(Math.ceil((box.top + box.height) * scale), 0, deviceViewportHeight);
  if (!(x1 > x0) || !(y1 > y0)) return null;
  return {
    x: x0 / scale,
    y: y0 / scale,
    width: (x1 - x0) / scale,
    height: (y1 - y0) / scale,
    deviceX: x0,
    deviceY: y0,
    deviceWidth: x1 - x0,
    deviceHeight: y1 - y0,
  };
}

/**
 * The box cut down to what a clipping ancestor shows (`overflow` other than
 * `visible`): the intersection of the two boxes. Null when they do not meet.
 */
export function clipBox(box: Box, clip: Box): Box | null {
  const left = Math.max(box.left, clip.left);
  const top = Math.max(box.top, clip.top);
  const right = Math.min(box.left + box.width, clip.left + clip.width);
  const bottom = Math.min(box.top + box.height, clip.top + clip.height);
  if (!(right > left) || !(bottom > top)) return null;
  return { left, top, width: right - left, height: bottom - top };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
