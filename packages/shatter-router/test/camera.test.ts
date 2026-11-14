import { describe, expect, it } from 'vitest';
import { createPixelCamera, DEFAULT_FOV_Y, projectToScreen } from '../src/engine/camera';

const SIZES: [number, number][] = [
  [1440, 900],
  [375, 812],
  [1163.636, 654.545],
  [3840, 2160],
];

describe('createPixelCamera', () => {
  it.each(SIZES)('maps the z = 0 plane 1:1 to CSS pixels at %dx%d', (width, height) => {
    const camera = createPixelCamera(width, height);
    const points: [number, number][] = [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
      [width / 2, height / 2],
      [width * 0.37, height * 0.81],
      [1, 1],
    ];
    for (const [x, y] of points) {
      const screen = projectToScreen(camera, width, height, x, y, 0);
      // Float32 matrix terms limit the precision; a thousandth of a pixel is far below visible.
      expect(screen.x).toBeCloseTo(x, 2);
      expect(screen.y).toBeCloseTo(y, 2);
    }
  });

  it('puts the camera at (h / 2) / tan(fov / 2)', () => {
    const camera = createPixelCamera(1000, 800);
    expect(camera.cameraZ).toBeCloseTo(400 / Math.tan(DEFAULT_FOV_Y / 2), 6);
  });

  it('uses +y down: a larger y lands lower on screen', () => {
    const camera = createPixelCamera(800, 600);
    const top = projectToScreen(camera, 800, 600, 400, 100, 0);
    const bottom = projectToScreen(camera, 800, 600, 400, 500, 0);
    expect(bottom.y).toBeGreaterThan(top.y);
  });

  it('gives depth: +z moves toward the viewer and magnifies about the centre', () => {
    const camera = createPixelCamera(800, 600);
    const flat = projectToScreen(camera, 800, 600, 600, 450, 0);
    const near = projectToScreen(camera, 800, 600, 600, 450, 200);
    expect(near.x - 400).toBeGreaterThan(flat.x - 400);
    expect(near.y - 300).toBeGreaterThan(flat.y - 300);
    expect(near.depth).toBeLessThan(flat.depth);
    // The viewport centre does not move with depth.
    const centre = projectToScreen(camera, 800, 600, 400, 300, 200);
    expect(centre.x).toBeCloseTo(400, 3);
    expect(centre.y).toBeCloseTo(300, 3);
  });

  it('keeps the z = 0 plane and maxZ inside the clip volume', () => {
    const camera = createPixelCamera(1440, 900);
    const plane = projectToScreen(camera, 1440, 900, 720, 450, 0);
    expect(plane.depth).toBeGreaterThan(-1);
    expect(plane.depth).toBeLessThan(1);
    const closest = projectToScreen(camera, 1440, 900, 720, 450, camera.maxZ);
    expect(closest.depth).toBeGreaterThan(-1);
    expect(camera.maxZ).toBeLessThan(camera.cameraZ - camera.near);
  });

  it('writes into the provided array without allocating a new one', () => {
    const out = new Float32Array(16);
    const camera = createPixelCamera(640, 480, DEFAULT_FOV_Y, out);
    expect(camera.viewProjection).toBe(out);
  });

  it('rejects an empty viewport', () => {
    expect(() => createPixelCamera(0, 600)).toThrow(RangeError);
    expect(() => createPixelCamera(800, Number.NaN)).toThrow(RangeError);
  });
});
