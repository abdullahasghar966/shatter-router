import { nextFrame } from '../core/frame';
import type { Snapshot } from '../core/snapshot';
import { createPixelCamera } from './camera';
import { CRACK_DURATION_MS, CRACK_HOLD_MS, crackAt } from './crack';
import {
  clampShardCount,
  type DeviceTier,
  deviceTier,
  FLOATS_PER_VERTEX as SHARD_FLOATS,
  fracture,
  type FractureGeometry,
  type FractureOptions,
  TIER_SHARDS,
  VERTEX_LAYOUT,
} from './fracture';
import { GLDevice, GLError, type GLProgram } from './gl';
import { Overlay } from './overlay';
import { PAGE_FRAGMENT, PAGE_VERTEX, SHARD_FRAGMENT, SHARD_VERTEX } from './shaders';

export { GLError } from './gl';
export type { DeviceTier } from './fracture';

/** GPU objects that die with a lost context and are rebuilt on demand. */
interface Resources {
  readonly pageProgram: GLProgram;
  readonly pageVao: WebGLVertexArrayObject;
  readonly quadBuffer: WebGLBuffer;
  readonly shardProgram: GLProgram;
  readonly shardVao: WebGLVertexArrayObject;
  readonly shardBuffer: WebGLBuffer;
}

const QUAD_FLOATS = 5; // x, y, z, u, v

type Scene = 'page' | 'shards';

export interface FractureStats {
  readonly shardCount: number;
  readonly vertexCount: number;
  /** Time spent computing the geometry on the CPU, in ms. */
  readonly fractureMs: number;
}

export interface CrackOptions {
  readonly duration?: number;
  readonly hold?: number;
  /** Stops the animation early (for example when the transition is skipped). */
  readonly signal?: AbortSignal;
}

/**
 * The WebGL side of a transition: owns the single GL context, the top-layer
 * overlay, the page texture and the shard mesh. Created lazily on first use
 * and reused for the life of the page.
 */
export class Engine {
  /** Draws every cell edge and the impact point (debug mode). */
  wireframe = false;

  private readonly device: GLDevice;
  private readonly overlay: Overlay;
  private readonly win: Window;
  private readonly viewProjection = new Float32Array(16);
  private readonly quad = new Float32Array(4 * QUAD_FLOATS);
  private resources: Resources | null = null;
  private texture: WebGLTexture | null = null;
  private snapshot: Snapshot | null = null;
  private geometry: FractureGeometry | null = null;
  private scene: Scene = 'page';
  private crackRadius = 0;
  private flash = 0;
  private drawCalls = 0;

  constructor(doc: Document) {
    const win = doc.defaultView;
    if (!win) throw new GLError('Document has no window');
    this.win = win;
    this.device = new GLDevice(doc);
    this.overlay = new Overlay(doc, this.device.canvas);
    this.device.onRestore(() => {
      // Everything created before the loss is gone; rebuild lazily.
      this.resources = null;
      this.texture = null;
    });
  }

  get maxTextureSize(): number {
    return this.device.maxTextureSize;
  }

  get contextLost(): boolean {
    return this.isContextLost();
  }

  /** Live GPU textures (0 between transitions). Exposed for leak tests and the debug panel. */
  get textureCount(): number {
    return this.device.textureCount;
  }

  /** Draw calls issued for the most recent frame. */
  get lastFrameDrawCalls(): number {
    return this.drawCalls;
  }

  get covering(): boolean {
    return this.overlay.visible;
  }

  /**
   * Shows the snapshot as an intact, unbroken page above the live DOM.
   * Resolves once that frame has actually been presented, so the caller may
   * change the DOM underneath without the user seeing it.
   */
  async cover(snapshot: Snapshot): Promise<void> {
    if (this.isContextLost()) throw new GLError('WebGL context is lost');
    this.release();
    this.snapshot = snapshot;
    this.scene = 'page';

    this.device.resize(snapshot.deviceWidth, snapshot.deviceHeight);
    this.overlay.setSize(snapshot.width, snapshot.height);
    createPixelCamera(snapshot.width, snapshot.height, undefined, this.viewProjection);
    this.texture = this.device.createTexture(snapshot.source);
    this.setQuad(snapshot.width, snapshot.height);

    // Showing a still-transparent overlay is harmless: the DOM beneath is the
    // very page the snapshot shows. Draw, then wait until that frame is on screen.
    this.overlay.show();
    this.draw();
    await nextFrame(this.win);
    if (this.isContextLost()) {
      this.release();
      throw new GLError('WebGL context was lost while covering');
    }
    // Redraw inside a frame callback so the presented frame is guaranteed to
    // carry the page even if the first draw raced the overlay's first paint.
    this.draw();
    await nextFrame(this.win);
  }

  /**
   * Turns the `shards` option into a count: a number is clamped to the
   * supported range; `'auto'` picks by device tier (cores, memory, and the
   * capture time just measured on this page).
   */
  resolveShardCount(
    option: 'auto' | number,
    captureMs: number,
  ): { count: number; tier: DeviceTier } {
    const nav = this.win.navigator as Navigator & { deviceMemory?: number };
    const tier = deviceTier({
      hardwareConcurrency: nav.hardwareConcurrency,
      ...(typeof nav.deviceMemory === 'number' ? { deviceMemory: nav.deviceMemory } : {}),
      captureMs,
    });
    const count = option === 'auto' ? TIER_SHARDS[tier] : clampShardCount(option);
    return { count, tier };
  }

  /**
   * Breaks the covered page into Voronoi shards and switches to drawing them.
   * At rest the shards tile the page exactly, so the picture does not change.
   */
  fracture(options: Omit<FractureOptions, 'width' | 'height'>): FractureStats {
    const snapshot = this.snapshot;
    if (!snapshot) throw new GLError('fracture() needs a covered page');
    const started = performance.now();
    const geometry = fracture({ ...options, width: snapshot.width, height: snapshot.height });
    const fractureMs = performance.now() - started;

    const { gl } = this.device;
    const { shardBuffer } = this.ensureResources();
    gl.bindBuffer(gl.ARRAY_BUFFER, shardBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.geometry = geometry;
    this.scene = 'shards';
    this.crackRadius = 0;
    this.flash = 0;
    this.draw();
    return {
      shardCount: geometry.shards.length,
      vertexCount: geometry.vertexCount,
      fractureMs,
    };
  }

  /**
   * Debug measurement: fractures a `width × height` viewport `runs` times
   * (after a short warm-up) and reports the median and 95th percentile CPU time.
   * Nothing is uploaded or drawn.
   */
  measureFracture(
    options: Omit<FractureOptions, 'seed'>,
    runs: number,
  ): { medianMs: number; p95Ms: number; runs: number } {
    const total = Math.max(1, Math.floor(runs));
    for (let i = 0; i < Math.min(20, total); i++) fracture({ ...options, seed: i });
    const times: number[] = [];
    for (let i = 0; i < total; i++) {
      const start = performance.now();
      fracture({ ...options, seed: 1000 + i });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return {
      medianMs: times[Math.floor(total / 2)] ?? Number.NaN,
      p95Ms: times[Math.min(total - 1, Math.floor(total * 0.95))] ?? Number.NaN,
      runs: total,
    };
  }

  /**
   * Plays the crack: fracture lines grow out of the impact point until they
   * reach the farthest corner, then hold. Resolves when done or aborted.
   */
  async crack(options: CrackOptions = {}): Promise<void> {
    const geometry = this.geometry;
    if (!geometry) throw new GLError('crack() needs a fractured page');
    const duration = options.duration ?? CRACK_DURATION_MS;
    const hold = options.hold ?? CRACK_HOLD_MS;
    const started = performance.now();
    for (;;) {
      const frame = crackAt(performance.now() - started, geometry.maxRadius, duration, hold);
      this.setCrack(frame.radius, frame.flash);
      if (frame.done || options.signal?.aborted) break;
      await nextFrame(this.win);
      if (this.isContextLost()) throw new GLError('WebGL context was lost while cracking');
    }
    // Leave the fully cracked state on screen.
    this.setCrack(geometry.maxRadius + 2, 0);
  }

  /** Sets the crack state and redraws (also used by tests to freeze a moment). */
  setCrack(radius: number, flash: number): void {
    this.crackRadius = radius;
    this.flash = flash;
    this.draw();
  }

  /** Redraws the current frame. */
  draw(): void {
    const texture = this.texture;
    if (!texture || this.device.contextLost) return;
    const { gl } = this.device;
    const resources = this.ensureResources();

    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const geometry = this.geometry;
    if (this.scene === 'shards' && geometry) {
      const { shardProgram: program, shardVao } = resources;
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.useProgram(program.program);
      gl.uniformMatrix4fv(program.uniform('uViewProjection'), false, this.viewProjection);
      gl.uniform1i(program.uniform('uPage'), 0);
      gl.uniform2f(program.uniform('uViewport'), geometry.width, geometry.height);
      gl.uniform2f(program.uniform('uOrigin'), geometry.origin.x, geometry.origin.y);
      gl.uniform1f(program.uniform('uCrackRadius'), this.crackRadius);
      gl.uniform1f(program.uniform('uFlash'), this.flash);
      gl.uniform1f(program.uniform('uWireframe'), this.wireframe ? 1 : 0);
      gl.bindVertexArray(shardVao);
      // While the shards lie flat only the front faces can be seen.
      gl.drawArrays(gl.TRIANGLES, 0, geometry.frontVertexCount);
    } else {
      const { pageProgram: program, pageVao } = resources;
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(program.program);
      gl.uniformMatrix4fv(program.uniform('uViewProjection'), false, this.viewProjection);
      gl.uniform1i(program.uniform('uPage'), 0);
      gl.bindVertexArray(pageVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.bindVertexArray(null);
    this.drawCalls = 1;
  }

  /**
   * Reads back the frame as it is drawn right now (RGBA, top row first).
   * Used by the seam check; redraws first because the drawing buffer is not preserved.
   */
  readPixels(): { width: number; height: number; data: Uint8Array } {
    const { gl, canvas } = this.device;
    this.draw();
    const { width, height } = canvas;
    const flipped = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, flipped);
    const data = new Uint8Array(flipped.length);
    const row = width * 4;
    for (let y = 0; y < height; y++) {
      data.set(flipped.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    }
    return { width, height, data };
  }

  /** Hides the overlay and frees the page texture, mesh and snapshot. Safe to call repeatedly. */
  release(): void {
    this.overlay.hide();
    if (this.texture) {
      this.device.deleteTexture(this.texture);
      this.texture = null;
    }
    if (this.snapshot) {
      this.snapshot.dispose();
      this.snapshot = null;
    }
    if (this.geometry && this.resources && !this.device.contextLost) {
      // Drop the mesh's GPU memory; the buffer object itself is reused.
      const { gl } = this.device;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.resources.shardBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, 0, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    this.geometry = null;
    this.scene = 'page';
    this.crackRadius = 0;
    this.flash = 0;
  }

  destroy(): void {
    this.release();
    this.resources = null;
    this.overlay.destroy();
    this.device.destroy();
  }

  /** A method, not a property read, so a check after an await is not narrowed away. */
  private isContextLost(): boolean {
    return this.device.contextLost;
  }

  private setQuad(width: number, height: number): void {
    // Triangle strip: top-left, top-right, bottom-left, bottom-right.
    this.quad.set([0, 0, 0, 0, 0, width, 0, 0, 1, 0, 0, height, 0, 0, 1, width, height, 0, 1, 1]);
    const { gl } = this.device;
    const { quadBuffer } = this.ensureResources();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.quad, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private ensureResources(): Resources {
    if (this.resources) return this.resources;
    const { gl } = this.device;
    const bytes = Float32Array.BYTES_PER_ELEMENT;

    const pageProgram = this.device.createProgram(PAGE_VERTEX, PAGE_FRAGMENT);
    const pageVao = gl.createVertexArray();
    const quadBuffer = gl.createBuffer();
    gl.bindVertexArray(pageVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    const quadStride = QUAD_FLOATS * bytes;
    this.pointer(pageProgram, 'aPosition', 3, quadStride, 0);
    this.pointer(pageProgram, 'aUv', 2, quadStride, 3 * bytes);

    const shardProgram = this.device.createProgram(SHARD_VERTEX, SHARD_FRAGMENT);
    const shardVao = gl.createVertexArray();
    const shardBuffer = gl.createBuffer();
    gl.bindVertexArray(shardVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, shardBuffer);
    const stride = SHARD_FLOATS * bytes;
    const L = VERTEX_LAYOUT;
    this.pointer(shardProgram, 'aPosition', L.position.size, stride, L.position.offset * bytes);
    this.pointer(shardProgram, 'aUv', L.uv.size, stride, L.uv.offset * bytes);
    this.pointer(shardProgram, 'aShardId', L.shardId.size, stride, L.shardId.offset * bytes);
    this.pointer(shardProgram, 'aCentroid', L.centroid.size, stride, L.centroid.offset * bytes);
    this.pointer(
      shardProgram,
      'aEdgeDistance',
      L.edgeDistance.size,
      stride,
      L.edgeDistance.offset * bytes,
    );
    this.pointer(shardProgram, 'aNormal', L.normal.size, stride, L.normal.offset * bytes);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.resources = { pageProgram, pageVao, quadBuffer, shardProgram, shardVao, shardBuffer };
    return this.resources;
  }

  /** Points an attribute at the bound buffer; attributes the compiler removed are skipped. */
  private pointer(
    program: GLProgram,
    name: string,
    size: number,
    stride: number,
    offset: number,
  ): void {
    const location = program.attribute(name);
    if (location < 0) return;
    const { gl } = this.device;
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
  }
}

/** Entry point of the lazily loaded engine chunk. */
export function createEngine(doc: Document): Engine {
  return new Engine(doc);
}
