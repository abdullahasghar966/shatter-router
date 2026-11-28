import { type Box, clipBox, type Region, snapRegion } from '../core/region';
import type { Snapshot } from '../core/snapshot';
import type { PageFrame } from '../engine/crop';

/**
 * Region geometry (ADR-063), loaded only when a break targets an element: the
 * element's box, cut down by every ancestor that clips (`overflow` other than
 * `visible`), snapped to the capture's device pixels. Null when nothing of it
 * is visible.
 */
export function regionOf(target: Element, snapshot: Snapshot): Region | null {
  let box: Box | null = boxOf(target.getBoundingClientRect());
  for (let el = target.parentElement; el && box; el = el.parentElement) {
    if (el === document.documentElement) break;
    const style = window.getComputedStyle(el);
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      box = clipBox(box, boxOf(el.getBoundingClientRect()));
    }
  }
  if (!box || snapshot.width <= 0) return null;
  // The capture's own scale, so the crop lands on its pixels.
  const scale = snapshot.deviceWidth / snapshot.width;
  return snapRegion(box, { width: snapshot.width, height: snapshot.height }, scale);
}

function boxOf(rect: DOMRect): Box {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/**
 * The frame of a region break: the element's region in the capture, and the
 * capture's viewport. Null when the element has no visible box.
 */
export function frameOf(target: Element, snapshot: Snapshot): PageFrame | null {
  const region = regionOf(target, snapshot);
  if (!region) return null;
  return {
    viewport: {
      width: snapshot.width,
      height: snapshot.height,
      deviceWidth: snapshot.deviceWidth,
      deviceHeight: snapshot.deviceHeight,
    },
    region,
  };
}
