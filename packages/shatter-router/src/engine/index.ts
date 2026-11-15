import {
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardInfo,
  type ShatterEffect,
} from '../core/effect';
import { nextFrame } from '../core/frame';
import { createRandom } from '../core/random';
import type { Snapshot } from '../core/snapshot';
import { createPixelCamera, type PixelCamera } from './camera';
import { CRACK_DURATION_MS, CRACK_HOLD_MS, crackAt } from './crack';
import { assembleEffect } from './effects/assemble';
import { explodeEffect } from './effects/explode';
import { flipEffect } from './effects/flip';
import { implodeEffect } from './effects/implode';
import { shatterEffect } from './effects/shatter';
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
import { FrameLoop, type LoopStats } from './loop';
import { Overlay } from './overlay';
import { PAGE_FRAGMENT, PAGE_VERTEX, shardFragmentSource, shardVertexSource } from './shaders';

export { GLError } from './gl';
export type { LoopStats } from './loop';

/** Effects that ship with the library, by name. */
export const BUILT_IN_EFFECTS: ReadonlyMap<string, ShatterEffect> = new Map(
  [shatterEffect, explodeEffect, implodeEffect, flipEffect, assembleEffect].map(
    (effect) => [effect.name, effect] as const,
  ),
);

interface PageResources {
  readonly program: GLProgram;
  readonly vao: WebGLVertexArrayObject;
  readonly quadBuffer: WebGLBuffer;
  readonly shardBuffer: WebGLBuffer;
}

interface EffectProgram {
  readonly program: GLProgram;
  readonly vao: WebGLVertexArrayObject;
}

const QUAD_FLOATS = 5; // x, y, z, u, v

type Scene = 'page' | 'shards';

export interface FractureStats {
  readonly shardCount: number;
  readonly vertexCount: number;
  /** Time spent computing the geometry on the CPU, in ms. */
  readonly fractureMs: number;
}

export interface FractureRequest {
  readonly effect: ShatterEffect;
  readonly origin: { readonly x: number; readonly y: number };
  readonly count: number;
  readonly thickness: number;
  readonly seed?: number;
}

export interface MotionRequest {
  /** Motion phase length in ms. */
  readonly duration: number;
  readonly gravity: number;
  readonly impulse: number;
  readonly direction: 'forward' | 'back';
  readonly seed?: number;
}

export interface PhaseOptions {
  /** Ends the phase at its final state within one frame (skip, interruption). */
  readonly signal?: AbortSignal;
}

/**
 * The WebGL side of a transition: owns the single GL context, the top-layer
 * overlay, the page texture, the shard mesh and the per-shard effect data.
 * Created lazily on first use and reused for the life of the page.
 */
export class Engine {
  /** Draws every cell edge and the impact point (debug mode). */
  wireframe = false;

  private readonly device: GLDevice;
  private readonly overlay: Overlay;
  private readonly win: Window;
  private readonly loop: FrameLoop;
  private readonly viewProjection = new Float32Array(16);
  private readonly quad = new Float32Array(4 * QUAD_FLOATS);
  private readonly programs = new Map<ShatterEffect, EffectProgram>();
  private camera: PixelCamera | null = null;
  private resources: PageResources | null = null;
  private texture: WebGLTexture | null = null;
  private shardData: WebGLTexture | null = null;
  private snapshot: Snapshot | null = null;
  /** The incoming page, for effects that end on it. */
  private incomingTexture: WebGLTexture | null = null;
  private incoming: Snapshot | null = null;
  private geometry: FractureGeometry | null = null;
  private effect: ShatterEffect | null = null;
  private state: EffectState | null = null;
  private scene: Scene = 'page';
  private moving = false;
  private crackRadius = 0;
  private flash = 0;
  private time = 0;
  private drawCalls = 0;

  constructor(doc: Document) {
    const win = doc.defaultView;
    if (!win) throw new GLError('Document has no window');
    this.win = win;
    this.loop = new FrameLoop(win);
    this.device = new GLDevice(doc);
    this.overlay = new Overlay(doc, this.device.canvas);
    this.device.onRestore(() => {
      // Everything created before the loss is gone; rebuild lazily.
      this.resources = null;
      this.programs.clear();
      this.texture = null;
      this.shardData = null;
      this.incomingTexture = null;
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

  /** Frame statistics of the most recent crack or motion phase. */
  get lastLoopStats(): LoopStats {
    return this.loop.lastStats;
  }

  get covering(): boolean {
    return this.overlay.visible;
  }

  /** The overlay element; it receives clicks during a transition. */
  get overlayElement(): HTMLElement {
    return this.overlay.host;
  }

  /** Looks up an effect: user-registered first, then built-in. */
  resolveEffect(
    effect: string | ShatterEffect,
    registered: ReadonlyMap<string, ShatterEffect>,
  ): ShatterEffect {
    if (typeof effect !== 'string') return effect;
    const found = registered.get(effect) ?? BUILT_IN_EFFECTS.get(effect);
    if (!found) throw new GLError(`Unknown effect "${effect}"`);
    return found;
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
    this.camera = createPixelCamera(
      snapshot.width,
      snapshot.height,
      undefined,
      this.viewProjection,
    );
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
   * Breaks the covered page into shards (using the effect's seed layout when
   * it has one) and switches to drawing them. At rest the shards tile the page
   * exactly, so the picture does not change.
   */
  fracture(request: FractureRequest): FractureStats {
    const snapshot = this.snapshot;
    if (!snapshot) throw new GLError('fracture() needs a covered page');
    const { effect, origin, thickness, seed } = request;
    const count = clampShardCount(request.count);
    const started = performance.now();
    const options: FractureOptions = {
      width: snapshot.width,
      height: snapshot.height,
      origin,
      count,
      thickness,
      ...(seed === undefined ? {} : { seed }),
    };
    const seedPoints = effect.seedPoints?.({
      width: snapshot.width,
      height: snapshot.height,
      origin,
      count,
      random: createRandom(seed),
    });
    const geometry = fracture(seedPoints ? { ...options, seedPoints } : options);
    const fractureMs = performance.now() - started;

    const { gl } = this.device;
    const { shardBuffer } = this.ensurePageResources();
    gl.bindBuffer(gl.ARRAY_BUFFER, shardBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.geometry = geometry;
    this.effect = effect;
    this.ensureEffectProgram(effect);
    // Rest-pose data until prepareMotion() supplies the effect's own.
    this.uploadShardData(new Float32Array(geometry.shards.length * SHARD_ATTRIBUTE_FLOATS));
    this.state = null;
    this.scene = 'shards';
    this.moving = false;
    this.crackRadius = 0;
    this.flash = 0;
    this.time = 0;
    this.draw();
    return { shardCount: geometry.shards.length, vertexCount: geometry.vertexCount, fractureMs };
  }

  /** Asks the effect for its per-shard data and uploads it. Nothing moves until `animate()`. */
  prepareMotion(request: MotionRequest): EffectState {
    const geometry = this.geometry;
    const effect = this.effect;
    const camera = this.camera;
    if (!geometry || !effect || !camera)
      throw new GLError('prepareMotion() needs a fractured page');
    const shards: ShardInfo[] = geometry.shards.map((shard, id) => ({
      id,
      centroid: shard.centroid,
      area: shard.area,
      inradius: shard.inradius,
      distance: shard.distance,
      polygon: shard.polygon,
    }));
    const context: EffectContext = {
      width: geometry.width,
      height: geometry.height,
      origin: geometry.origin,
      maxRadius: geometry.maxRadius,
      shards,
      duration: request.duration,
      gravity: request.gravity,
      impulse: request.impulse,
      thickness: geometry.thickness,
      direction: request.direction,
      cameraZ: camera.cameraZ,
      // Offset so motion differs from the fracture layout while staying deterministic.
      random: createRandom(request.seed === undefined ? undefined : request.seed + 0x9e3779b9),
    };
    const { data } = effect.shardAttributes(context);
    if (data.length !== shards.length * SHARD_ATTRIBUTE_FLOATS) {
      throw new GLError(
        `Effect "${effect.name}" returned ${data.length} floats; expected ${shards.length * SHARD_ATTRIBUTE_FLOATS}`,
      );
    }
    this.uploadShardData(data);
    this.state = { ...context, attributes: data };
    return this.state;
  }

  /**
   * Uploads the capture of the incoming page (effects with
   * `needsIncomingSnapshot`). The engine owns the snapshot from here on.
   */
  setIncoming(snapshot: Snapshot): void {
    if (this.isContextLost()) {
      snapshot.dispose();
      throw new GLError('WebGL context is lost');
    }
    this.device.deleteTexture(this.incomingTexture);
    this.incoming?.dispose();
    this.incoming = snapshot;
    this.incomingTexture = this.device.createTexture(snapshot.source);
  }

  /**
   * Swaps the effect of the fractured page (before `prepareMotion`), for
   * example when the incoming page could not be captured.
   */
  replaceEffect(effect: ShatterEffect): void {
    if (!this.geometry) throw new GLError('replaceEffect() needs a fractured page');
    this.effect = effect;
    this.ensureEffectProgram(effect);
  }

  /**
   * Plays the crack: fracture lines grow out of the impact point until they
   * reach the farthest corner, then hold. An aborted signal jumps to the end.
   */
  crack(options: PhaseOptions = {}): Promise<void> {
    const geometry = this.geometry;
    if (!geometry) return Promise.reject(new GLError('crack() needs a fractured page'));
    const { signal } = options;
    const maxRadius = geometry.maxRadius;
    let started = -1;
    return this.loop
      .run((now) => {
        if (this.isContextLost()) throw new GLError('WebGL context was lost while cracking');
        if (started < 0) started = now;
        const frame = crackAt(now - started, maxRadius, CRACK_DURATION_MS, CRACK_HOLD_MS);
        const done = frame.done || signal?.aborted === true;
        this.crackRadius = done ? maxRadius + 2 : frame.radius;
        this.flash = done ? 0 : frame.flash;
        this.draw();
        return done;
      })
      .then(() => {
        this.crackRadius = maxRadius + 2;
        this.flash = 0;
      });
  }

  /**
   * Runs the effect's motion until `isComplete` says it is over (or the signal
   * is aborted: then it ends within one frame). Resolves with frame statistics.
   */
  async animate(options: PhaseOptions = {}): Promise<LoopStats> {
    const state = this.state;
    const effect = this.effect;
    if (!state || !effect) throw new GLError('animate() needs prepareMotion()');
    const { signal } = options;
    // Effects that end on the incoming page get one last frame at their rest
    // pose (uTime = duration), shown for a frame before the overlay goes: the
    // last picture is the live page underneath (see core/effect.ts).
    const endsAtRest = effect.needsIncomingSnapshot;
    let finalDrawn = false;
    this.moving = true;
    this.flash = 0;
    let started = -1;
    await this.loop.run((now) => {
      if (this.isContextLost()) throw new GLError('WebGL context was lost while animating');
      if (started < 0) started = now;
      const t = now - started;
      if (signal?.aborted === true || finalDrawn) return true;
      if (effect.isComplete(t, state)) {
        if (!endsAtRest) return true;
        // The frame in which the effect completes is not drawn otherwise: the
        // caller hides the overlay right away.
        this.time = Math.max(t, state.duration) / 1000;
        this.draw();
        finalDrawn = true;
        return false;
      }
      this.time = t / 1000;
      this.draw();
      return false;
    });
    return this.loop.lastStats;
  }

  /** Debug: draws the motion frozen at `ms` into the motion phase. */
  setMotionTime(ms: number): void {
    if (!this.state) return;
    this.moving = true;
    this.time = Math.max(0, ms) / 1000;
    this.draw();
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
    const page = this.ensurePageResources();

    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const geometry = this.geometry;
    const effect = this.effect;
    if (this.scene === 'shards' && geometry && effect && this.shardData) {
      const { program, vao } = this.ensureEffectProgram(effect);
      const camera = this.camera;
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      if (this.moving) {
        // Premultiplied output: shards fade over the live page behind the canvas.
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.disable(gl.BLEND);
      }
      gl.useProgram(program.program);
      gl.uniformMatrix4fv(program.uniform('uViewProjection'), false, this.viewProjection);
      gl.uniform1i(program.uniform('uPage'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.shardData);
      gl.uniform1i(program.uniform('uShardData'), 1);
      // Unit 2: the incoming page; the outgoing one stands in when there is none.
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.incomingTexture ?? texture);
      gl.uniform1i(program.uniform('uIncoming'), 2);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(program.uniform('uMaxZ'), camera ? camera.maxZ : 0);
      gl.uniform2f(program.uniform('uViewport'), geometry.width, geometry.height);
      gl.uniform2f(program.uniform('uOrigin'), geometry.origin.x, geometry.origin.y);
      gl.uniform1f(program.uniform('uMaxRadius'), geometry.maxRadius);
      const state = this.state;
      gl.uniform1f(program.uniform('uTime'), this.moving ? this.time : 0);
      gl.uniform1f(program.uniform('uMoving'), this.moving ? 1 : 0);
      gl.uniform1f(program.uniform('uDuration'), state ? state.duration / 1000 : 1);
      gl.uniform1f(program.uniform('uGravity'), state ? state.gravity : 0);
      gl.uniform1f(program.uniform('uImpulse'), state ? state.impulse : 0);
      gl.uniform1f(program.uniform('uThickness'), geometry.thickness);
      gl.uniform1f(program.uniform('uDirection'), state?.direction === 'back' ? -1 : 1);
      gl.uniform1f(program.uniform('uCrackRadius'), this.crackRadius);
      gl.uniform1f(program.uniform('uFlash'), this.flash);
      gl.uniform1f(program.uniform('uWireframe'), this.wireframe ? 1 : 0);
      gl.bindVertexArray(vao);
      // At rest only the front faces of the outgoing page can be seen; in
      // motion every face of every layer can. Still one draw call.
      const layers = this.moving ? (effect.layers ?? 1) : 1;
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        this.moving ? geometry.vertexCount : geometry.frontVertexCount,
        layers,
      );
    } else {
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.useProgram(page.program.program);
      gl.uniformMatrix4fv(page.program.uniform('uViewProjection'), false, this.viewProjection);
      gl.uniform1i(page.program.uniform('uPage'), 0);
      gl.bindVertexArray(page.vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.bindVertexArray(null);
    this.drawCalls = 1;
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

  /** Hides the overlay and frees the page texture, mesh data and snapshot. Safe to call repeatedly. */
  release(): void {
    this.loop.stop();
    this.overlay.hide();
    this.device.deleteTexture(this.texture);
    this.texture = null;
    this.device.deleteTexture(this.shardData);
    this.shardData = null;
    this.device.deleteTexture(this.incomingTexture);
    this.incomingTexture = null;
    this.incoming?.dispose();
    this.incoming = null;
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
    this.effect = null;
    this.state = null;
    this.scene = 'page';
    this.moving = false;
    this.crackRadius = 0;
    this.flash = 0;
    this.time = 0;
  }

  destroy(): void {
    this.release();
    this.resources = null;
    this.programs.clear();
    this.overlay.destroy();
    this.device.destroy();
  }

  /** A method, not a property read, so a check after an await is not narrowed away. */
  private isContextLost(): boolean {
    return this.device.contextLost;
  }

  private uploadShardData(data: Float32Array): void {
    this.device.deleteTexture(this.shardData);
    const rows = data.length / SHARD_ATTRIBUTE_FLOATS;
    // Two RGBA texels (8 floats) per shard, one row per shard.
    this.shardData = this.device.createDataTexture(2, Math.max(1, rows), data);
  }

  private setQuad(width: number, height: number): void {
    // Triangle strip: top-left, top-right, bottom-left, bottom-right.
    this.quad.set([0, 0, 0, 0, 0, width, 0, 0, 1, 0, 0, height, 0, 0, 1, width, height, 0, 1, 1]);
    const { gl } = this.device;
    const { quadBuffer } = this.ensurePageResources();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.quad, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private ensurePageResources(): PageResources {
    if (this.resources) return this.resources;
    const { gl } = this.device;
    const bytes = Float32Array.BYTES_PER_ELEMENT;
    const program = this.device.createProgram(PAGE_VERTEX, PAGE_FRAGMENT);
    const vao = gl.createVertexArray();
    const quadBuffer = gl.createBuffer();
    const shardBuffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    const stride = QUAD_FLOATS * bytes;
    this.pointer(program, 'aPosition', 3, stride, 0);
    this.pointer(program, 'aUv', 2, stride, 3 * bytes);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.resources = { program, vao, quadBuffer, shardBuffer };
    return this.resources;
  }

  /** Compiles (once per effect) the shard program with the effect's GLSL chunks. */
  private ensureEffectProgram(effect: ShatterEffect): EffectProgram {
    const cached = this.programs.get(effect);
    if (cached) return cached;
    const { gl } = this.device;
    const { shardBuffer } = this.ensurePageResources();
    const program = this.device.createProgram(
      shardVertexSource(effect.vertexChunk),
      shardFragmentSource(effect.fragmentChunk),
    );
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, shardBuffer);
    const bytes = Float32Array.BYTES_PER_ELEMENT;
    const stride = SHARD_FLOATS * bytes;
    const L = VERTEX_LAYOUT;
    this.pointer(program, 'aPosition', L.position.size, stride, L.position.offset * bytes);
    this.pointer(program, 'aUv', L.uv.size, stride, L.uv.offset * bytes);
    this.pointer(program, 'aShardId', L.shardId.size, stride, L.shardId.offset * bytes);
    this.pointer(program, 'aCentroid', L.centroid.size, stride, L.centroid.offset * bytes);
    this.pointer(
      program,
      'aEdgeDistance',
      L.edgeDistance.size,
      stride,
      L.edgeDistance.offset * bytes,
    );
    this.pointer(program, 'aNormal', L.normal.size, stride, L.normal.offset * bytes);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    const entry = { program, vao };
    this.programs.set(effect, entry);
    return entry;
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
