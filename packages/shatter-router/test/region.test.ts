import { describe, expect, it } from 'vitest';
import { clipBox, snapRegion } from '../src/core/region';
import { fracture, FLOATS_PER_VERTEX } from '../src/engine/fracture';
import { impactPattern } from '../src/engine/patterns/impact';

const VIEWPORT = { width: 1280, height: 800 };

describe('snapRegion (ADR-063)', () => {
  it('snaps outward to whole device pixels', () => {
    const region = snapRegion({ left: 10.4, top: 20.6, width: 100.2, height: 50.1 }, VIEWPORT, 2);
    expect(region).not.toBeNull();
    if (!region) return;
    expect(region.deviceX).toBe(20); // floor(10.4 × 2)
    expect(region.deviceY).toBe(41); // floor(20.6 × 2)
    expect(region.deviceWidth).toBe(202); // ceil(110.6 × 2) − 20 = 222 − 20
    expect(region.deviceHeight).toBe(101); // ceil(70.7 × 2) − 41 = 142 − 41
    // The CSS rectangle is the device one divided by the scale.
    expect(region.x).toBe(10);
    expect(region.width).toBe(101);
  });

  it('clamps to the viewport', () => {
    const region = snapRegion({ left: -50, top: 700, width: 200, height: 300 }, VIEWPORT, 1);
    expect(region).toMatchObject({ x: 0, y: 700, width: 150, height: 100 });
  });

  it('is null when nothing of the box is visible', () => {
    expect(snapRegion({ left: -300, top: 0, width: 200, height: 50 }, VIEWPORT, 1)).toBeNull();
    expect(snapRegion({ left: 0, top: 900, width: 50, height: 50 }, VIEWPORT, 1)).toBeNull();
    expect(snapRegion({ left: 0, top: 0, width: 0, height: 50 }, VIEWPORT, 1)).toBeNull();
  });

  it('keeps a region whole at scale 1 and does not change an integral box', () => {
    expect(snapRegion({ left: 40, top: 60, width: 300, height: 200 }, VIEWPORT, 1)).toEqual({
      x: 40,
      y: 60,
      width: 300,
      height: 200,
      deviceX: 40,
      deviceY: 60,
      deviceWidth: 300,
      deviceHeight: 200,
    });
  });

  it('refuses a degenerate viewport or scale', () => {
    expect(
      snapRegion({ left: 0, top: 0, width: 10, height: 10 }, { width: 0, height: 10 }, 1),
    ).toBeNull();
    expect(snapRegion({ left: 0, top: 0, width: 10, height: 10 }, VIEWPORT, 0)).toBeNull();
  });
});

describe('clipBox', () => {
  it('intersects a box with the box of a clipping ancestor', () => {
    expect(
      clipBox(
        { left: 0, top: 0, width: 100, height: 100 },
        { left: 50, top: 10, width: 100, height: 40 },
      ),
    ).toEqual({ left: 50, top: 10, width: 50, height: 40 });
  });

  it('is null when the two boxes do not meet', () => {
    expect(
      clipBox(
        { left: 0, top: 0, width: 10, height: 10 },
        { left: 20, top: 0, width: 10, height: 10 },
      ),
    ).toBeNull();
  });
});

describe('fracture with an offset (a region on the page)', () => {
  const W = 300;
  const H = 200;
  const OFFSET = { x: 500, y: 320 };
  const origin = { x: 150, y: 100 };

  it('moves every piece and the origin by the offset, and keeps the area', () => {
    const local = fracture(impactPattern, { width: W, height: H, origin, count: 40, seed: 7 });
    const placed = fracture(impactPattern, {
      width: W,
      height: H,
      origin,
      count: 40,
      seed: 7,
      offset: OFFSET,
    });
    expect(placed.origin).toEqual({ x: origin.x + OFFSET.x, y: origin.y + OFFSET.y });
    const area = (shards: typeof local.shards): number =>
      shards.reduce((sum, shard) => sum + shard.area, 0);
    expect(area(placed.shards)).toBeCloseTo(W * H, 0);
    expect(placed.shards.length).toBe(local.shards.length);
    for (let i = 0; i < local.shards.length; i++) {
      const a = local.shards[i];
      const b = placed.shards[i];
      if (!a || !b) throw new Error('shard missing');
      expect(b.centroid.x).toBeCloseTo(a.centroid.x + OFFSET.x, 6);
      expect(b.centroid.y).toBeCloseTo(a.centroid.y + OFFSET.y, 6);
      expect(b.distance).toBeCloseTo(a.distance, 6);
      expect(b.polygon[0]).toBeCloseTo((a.polygon[0] ?? 0) + OFFSET.x, 6);
    }
  });

  it('keeps every vertex inside the region rectangle on the page', () => {
    const placed = fracture(impactPattern, {
      width: W,
      height: H,
      origin,
      count: 40,
      seed: 7,
      offset: OFFSET,
    });
    const v = placed.vertices;
    for (let o = 0; o < v.length; o += FLOATS_PER_VERTEX) {
      const x = v[o] ?? 0;
      const y = v[o + 1] ?? 0;
      expect(x).toBeGreaterThanOrEqual(OFFSET.x - 1e-3);
      expect(x).toBeLessThanOrEqual(OFFSET.x + W + 1e-3);
      expect(y).toBeGreaterThanOrEqual(OFFSET.y - 1e-3);
      expect(y).toBeLessThanOrEqual(OFFSET.y + H + 1e-3);
    }
  });

  it('keeps the UVs local to the crop, so the cropped texture maps exactly', () => {
    const local = fracture(impactPattern, { width: W, height: H, origin, count: 40, seed: 7 });
    const placed = fracture(impactPattern, {
      width: W,
      height: H,
      origin,
      count: 40,
      seed: 7,
      offset: OFFSET,
    });
    for (let o = 0; o < local.vertices.length; o += FLOATS_PER_VERTEX) {
      expect(placed.vertices[o + 3]).toBeCloseTo(local.vertices[o + 3] ?? 0, 6);
      expect(placed.vertices[o + 4]).toBeCloseTo(local.vertices[o + 4] ?? 0, 6);
      expect(placed.vertices[o + 3] ?? 0).toBeGreaterThanOrEqual(0);
      expect(placed.vertices[o + 3] ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it('moves the tear path with the pieces', () => {
    const path = [
      { x: 20, y: 30 },
      { x: 120, y: 60 },
    ];
    const placed = fracture(impactPattern, {
      width: W,
      height: H,
      origin,
      count: 30,
      seed: 3,
      path,
      offset: OFFSET,
    });
    expect(placed.path?.[0]).toBeCloseTo(20 + OFFSET.x, 6);
    expect(placed.path?.[1]).toBeCloseTo(30 + OFFSET.y, 6);
  });
});
