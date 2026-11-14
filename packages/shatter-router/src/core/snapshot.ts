import type { ViewportMetrics } from './viewport';

/** A rasterised copy of the viewport, ready to upload as a texture. */
export interface Snapshot {
  /** Pixel source. Row 0 is the top of the viewport. Never origin-tainted. */
  readonly source: HTMLCanvasElement | ImageBitmap;
  /** Viewport size in CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Size of `source` in device pixels. */
  readonly deviceWidth: number;
  readonly deviceHeight: number;
  /** How long the capture took, in milliseconds. */
  readonly duration: number;
  /** Releases the pixel source. Safe to call more than once. */
  dispose(): void;
}

export interface CaptureRequest {
  readonly viewport: ViewportMetrics;
  /** Largest texture side the GPU accepts; the capture is scaled down to fit. */
  readonly maxTextureSize: number;
}

/**
 * Turns the live DOM into a `Snapshot`. The default implementation renders the
 * DOM through an SVG `<foreignObject>`; the interface exists so that strategy
 * can be swapped without touching the rest of the pipeline.
 */
export interface Capturer {
  capture(request: CaptureRequest): Promise<Snapshot>;
  destroy(): void;
}

export class CaptureError extends Error {
  override readonly name = 'CaptureError';
}
