/**
 * Pixel-exact perspective camera.
 *
 * World space is CSS pixels: the origin is the viewport's top-left corner,
 * +x points right, +y points DOWN and +z points toward the viewer. The camera
 * sits in front of the viewport centre at the one distance where the `z = 0`
 * plane maps 1 world unit to exactly 1 CSS pixel:
 *
 *   cameraZ = (viewportHeight / 2) / tan(fovY / 2)
 *
 * A perspective camera (not an orthographic one) is used so shards gain real
 * depth when they tumble toward the viewer.
 */

/** Vertical field of view in radians. 40 degrees keeps perspective distortion gentle. */
export const DEFAULT_FOV_Y = (40 * Math.PI) / 180;

export interface PixelCamera {
  /** Column-major 4x4 matrix taking world (CSS pixel) space to clip space. */
  readonly viewProjection: Float32Array;
  /** Distance from the camera to the `z = 0` plane, in CSS pixels. */
  readonly cameraZ: number;
  /** Near plane distance from the camera. */
  readonly near: number;
  /** Far plane distance from the camera. */
  readonly far: number;
  /** The largest world-space z a vertex may have before it crosses the near plane. */
  readonly maxZ: number;
}

/**
 * Builds the view-projection matrix for a `width` x `height` CSS-pixel viewport.
 * Writes into `out` when given so the render loop can stay allocation-free.
 */
export function createPixelCamera(
  width: number,
  height: number,
  fovY: number = DEFAULT_FOV_Y,
  out: Float32Array = new Float32Array(16),
): PixelCamera {
  if (!(width > 0) || !(height > 0)) {
    throw new RangeError(`Camera viewport must be positive, got ${width}x${height}`);
  }
  const halfTan = Math.tan(fovY / 2);
  const cameraZ = height / 2 / halfTan;
  const near = cameraZ * 0.05;
  const far = cameraZ * 12;

  // Projection terms (standard OpenGL perspective, camera looking down -z).
  const sy = 1 / halfTan;
  const sx = sy * (height / width);
  const a = (far + near) / (near - far);
  const b = (2 * far * near) / (near - far);

  // View transform folded in: xv = x - w/2, yv = -(y - h/2), zv = z - cameraZ.
  // clip = P * V * world, written out directly (column-major).
  out[0] = sx;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = -sy;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[10] = a;
  out[11] = -1;

  out[12] = -sx * (width / 2);
  out[13] = sy * (height / 2);
  out[14] = -a * cameraZ + b;
  out[15] = cameraZ;

  return { viewProjection: out, cameraZ, near, far, maxZ: cameraZ - near * 1.5 };
}

/** Projects a world-space point to CSS-pixel screen coordinates (for tests and debug overlays). */
export function projectToScreen(
  camera: PixelCamera,
  width: number,
  height: number,
  x: number,
  y: number,
  z: number,
): { x: number; y: number; depth: number } {
  const m = camera.viewProjection;
  const cx = (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0);
  const cy = (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0);
  const cz = (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0);
  const cw = (m[3] ?? 0) * x + (m[7] ?? 0) * y + (m[11] ?? 0) * z + (m[15] ?? 0);
  return {
    x: ((cx / cw) * 0.5 + 0.5) * width,
    y: (1 - ((cy / cw) * 0.5 + 0.5)) * height,
    depth: cz / cw,
  };
}
