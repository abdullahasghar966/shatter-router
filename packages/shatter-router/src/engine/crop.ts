import type { Region } from '../core/region';

/** What the engine needs to draw one region of a viewport capture (ADR-063). */
export interface PageFrame {
  /** The whole viewport, in CSS and device pixels. */
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly deviceWidth: number;
    readonly deviceHeight: number;
  };
  /** The part of it the transition breaks. */
  readonly region: Region;
}

/** The region of a capture as a new canvas, in device pixels (the page's own grid). */
export function cropCapture(
  doc: Document,
  source: HTMLCanvasElement | ImageBitmap,
  region: Region,
): HTMLCanvasElement {
  const canvas = doc.createElement('canvas');
  canvas.width = region.deviceWidth;
  canvas.height = region.deviceHeight;
  // Opaque, like the capture itself: the page has no transparency (ADR-009).
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!context) throw new Error('2D canvas is unavailable for the region crop');
  context.drawImage(
    source,
    region.deviceX,
    region.deviceY,
    region.deviceWidth,
    region.deviceHeight,
    0,
    0,
    region.deviceWidth,
    region.deviceHeight,
  );
  return canvas;
}

/** Whether a region is the whole capture (no crop needed). */
export function isWholeCapture(
  region: Region,
  capture: { readonly deviceWidth: number; readonly deviceHeight: number },
): boolean {
  return (
    region.deviceX === 0 &&
    region.deviceY === 0 &&
    region.deviceWidth === capture.deviceWidth &&
    region.deviceHeight === capture.deviceHeight
  );
}
