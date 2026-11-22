import { easeTime } from '../core/easing';
import { MAX_PATH_POINTS } from './path';
import { type EffectSource, effectName, isComposition } from '../core/compose';
import {
  type EffectComposition,
  type EffectContext,
  type EffectState,
  SHARD_ATTRIBUTE_FLOATS,
  type ShardInfo,
  type ShatterEffect,
} from '../core/effect';
import { nextFrame } from '../core/frame';
import {
  PHYSICS_TRANSFORM_FLOATS,
  type PhysicsBackend,
  type PhysicsShard,
  type PhysicsSimulation,
} from '../core/physics';
import { createRandom } from '../core/random';
import { lightFade, type Rgb } from '../core/shading';
import type { Snapshot } from '../core/snapshot';
import { createPixelCamera, type PixelCamera } from './camera';
import { CRACK_DURATION_MS, CRACK_HOLD_MS, crackAt } from './crack';
import {
  clampShardCount,
  type DeviceTier,
  deviceTier,
  FLOATS_PER_VERTEX as SHARD_FLOATS,
  fracture,
  type FractureGeometry,
  type FractureOptions,
  type FracturePattern,
  TIER_SHARDS,
  VERTEX_LAYOUT,
} from './fracture';
import { GLDevice, GLError, type GLProgram } from './gl';
import { FrameLoop, type LoopStats } from './loop';
import { Overlay } from './overlay';
import { composeEffect } from './compose';
import { reverseEffect, REVERSE_SUFFIX } from './effects/reverse';
import { MATERIAL_FLOATS, packMaterial, resolveMaterial, type ResolvedMaterial } from './materials';
import { MOTIONS, PATTERNS, PHYSICS_DAMPING } from './plugins';
import type { MaterialSource } from '../core/material';
import { PAGE_FRAGMENT, PAGE_VERTEX, shardFragmentSource, shardVertexSource } from './shaders';
import { staggerOrder } from './stagger';

export { GLError } from './gl';
export type { LoopStats } from './loop';
export { BUILT_IN_EFFECT_NAMES } from './plugins';

/** Effects and compositions registered by the user, by name. */
export type EffectRegistry = ReadonlyMap<string, ShatterEffect | EffectComposition>;

/** Texels per shard in the shard data texture: `Shard.a`, `Shard.b`, then `order`. */
const SHARD_TEXELS = 3;
const DEFAULT_PATTERN = 'impact';

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
  /** A tear (ADR-060): the page breaks along these viewport points. */
  readonly path?: readonly { readonly x: number; readonly y: number }[];
}

export interface MotionRequest {
  /** Motion phase length in ms. */
  readonly duration: number;
  readonly gravity: number;
  readonly impulse: number;
  readonly direction: 'forward' | 'back';
  readonly seed?: number;
}

/** Shading settings that apply whatever the material (master prompt 5.5). */
export interface ShadingOptions {
  /** Tint of the cut edges, 0..1 channels, overriding the material's (`glassTint`); null keeps it. */
  readonly tint: Rgb | null;
  /** Colour fringing along fast shards' motion. */
  readonly chromatic: boolean;
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
  private shading: ShadingOptions = { tint: null, chromatic: true };
  /** The material of the current transition (ADR-057), and its uniforms. */
  private material: ResolvedMaterial = resolveMaterial('glass');
  private readonly materialData = packMaterial(this.material, new Float32Array(MATERIAL_FLOATS));

  private readonly device: GLDevice;
  private readonly overlay: Overlay;
  private readonly win: Window;
  private readonly loop: FrameLoop;
  private readonly viewProjection = new Float32Array(16);
  private readonly quad = new Float32Array(4 * QUAD_FLOATS);
  /** Shader programs by their GLSL chunks: compositions of one motion share one. */
  private readonly programs = new Map<string, EffectProgram>();
  /** Time-reversed effects, one per base effect (ADR-047). */
  private readonly reversed = new Map<ShatterEffect, ShatterEffect>();
  /** Built-in motions and patterns, loading or loaded, by name (ADR-048). */
  private readonly motions = new Map<string, Promise<ShatterEffect>>();
  private readonly patternLoads = new Map<string, Promise<FracturePattern>>();
  private readonly patterns = new Map<string, FracturePattern>();
  /** Effects built from compositions, by composition. */
  private readonly composed = new WeakMap<EffectComposition, ShatterEffect>();
  /** Effects a physics backend can drive, with their air drag in 1/s. */
  private readonly physical = new WeakMap<ShatterEffect, number>();
  private camera: PixelCamera | null = null;
  private resources: PageResources | null = null;
  private texture: WebGLTexture | null = null;
  private shardData: WebGLTexture | null = null;
  private snapshot: Snapshot | null = null;
  /** The incoming page, for effects that end on it. */
  private incomingTexture: WebGLTexture | null = null;
  private incoming: Snapshot | null = null;
  /** Physics mode: the simulation, its transforms (one mat4 per shard) and their texture. */
  private simulation: PhysicsSimulation | null = null;
  private transforms: Float32Array | null = null;
  private transformTexture: WebGLTexture | null = null;
  private geometry: FractureGeometry | null = null;
  private effect: ShatterEffect | null = null;
  private state: EffectState | null = null;
  private scene: Scene = 'page';
  private moving = false;
  private crackRadius = 0;
  private flash = 0;
  private time = 0;
  /** The tear path of this transition as shader uniforms (ADR-060), filled at fracture. */
  private readonly pathData = new Float32Array(MAX_PATH_POINTS * 2);
  private pathCount = 0;
  /** The crack's per-frame state, reused (ADR-040). */
  private readonly crackFrame = { radius: 0, flash: 0, done: false };
  private drawCalls = 0;
  private drawnFrames = 0;

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
      this.transformTexture = null;
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

  /** GL draw calls and drawn frames since the engine was created (debug panel). */
  get drawStats(): { readonly calls: number; readonly frames: number } {
    return { calls: this.drawCalls, frames: this.drawnFrames };
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

  /** Sets the shading used by every following frame. */
  setShading(shading: ShadingOptions): void {
    this.shading = shading;
  }

  /**
   * Sets the material of the following frames (ADR-057): a built-in name or a
   * material object. Throws for an unknown name. Returns the material's name.
   */
  setMaterial(source: MaterialSource): string {
    this.material = resolveMaterial(source);
    packMaterial(this.material, this.materialData);
    return this.material.name;
  }

  /**
   * Resolves an effect name, object or composition to a ready effect (ADR-048):
   * user-registered names first, then the built-in ones; `'<name>:reverse'` is
   * the time reverse (ADR-047). Loads the motion and pattern chunks it needs.
   */
  async loadEffect(effect: EffectSource, registered: EffectRegistry): Promise<ShatterEffect> {
    const resolved = await this.resolve(effect, registered, 0);
    await this.loadPattern(resolved.pattern ?? DEFAULT_PATTERN);
    return resolved;
  }

  /** Loads an effect's chunks ahead of a transition. Never rejects: errors surface in the transition. */
  preloadEffect(effect: EffectSource, registered: EffectRegistry): Promise<void> {
    return this.loadEffect(effect, registered).then(
      () => undefined,
      () => undefined,
    );
  }

  private async resolve(
    effect: EffectSource,
    registered: EffectRegistry,
    depth: number,
  ): Promise<ShatterEffect> {
    if (depth > 4) throw new GLError(`Effect "${effectName(effect)}" refers to itself`);
    if (typeof effect !== 'string') {
      return isComposition(effect) ? this.compose(effect, registered) : effect;
    }
    if (effect.endsWith(REVERSE_SUFFIX)) {
      // Built once per base effect, so its shader program is cached too.
      const base = await this.resolve(
        effect.slice(0, -REVERSE_SUFFIX.length),
        registered,
        depth + 1,
      );
      let reversed = this.reversed.get(base);
      if (!reversed) {
        reversed = reverseEffect(base);
        this.reversed.set(base, reversed);
      }
      return reversed;
    }
    const found = registered.get(effect);
    if (found) return this.resolve(found, registered, depth + 1);
    return this.loadMotion(effect);
  }

  /** A built-in motion, loaded once. */
  private loadMotion(name: string): Promise<ShatterEffect> {
    let loading = this.motions.get(name);
    if (!loading) {
      const loader = MOTIONS[name];
      if (!loader) return Promise.reject(new GLError(`Unknown effect "${name}"`));
      loading = loader().then((motion) => {
        const damping = PHYSICS_DAMPING[name];
        if (damping !== undefined) this.physical.set(motion, damping);
        return motion;
      });
      // A failed chunk load may succeed on the next try.
      loading.catch(() => this.motions.delete(name));
      this.motions.set(name, loading);
    }
    return loading;
  }

  /** A fracture pattern, loaded once; afterwards `fracture()` can use it synchronously. */
  private loadPattern(name: string): Promise<FracturePattern> {
    let loading = this.patternLoads.get(name);
    if (!loading) {
      const loader = PATTERNS[name];
      if (!loader) return Promise.reject(new GLError(`Unknown pattern "${name}"`));
      loading = loader().then((pattern) => {
        this.patterns.set(name, pattern);
        return pattern;
      });
      loading.catch(() => this.patternLoads.delete(name));
      this.patternLoads.set(name, loading);
    }
    return loading;
  }

  /**
   * The effect a composition describes: its motion (a registered effect or a
   * built-in one) with the composition's name, pattern, stagger and duration.
   */
  private async compose(
    spec: EffectComposition,
    registered: EffectRegistry,
  ): Promise<ShatterEffect> {
    const cached = this.composed.get(spec);
    if (cached) return cached;
    // An unknown material fails here, before anything is shown (ADR-057).
    if (spec.material !== undefined) resolveMaterial(spec.material);
    // A registered effect object may serve as the motion; compositions do not nest.
    const own = registered.get(spec.motion);
    const motion = own && !isComposition(own) ? own : await this.loadMotion(spec.motion);
    const effect = composeEffect(spec, motion);
    const damping = this.physical.get(motion);
    if (damping !== undefined) this.physical.set(effect, damping);
    this.composed.set(spec, effect);
    return effect;
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
    const { effect, origin, thickness, seed, path } = request;
    const count = clampShardCount(request.count);
    const started = performance.now();
    const options: FractureOptions = {
      width: snapshot.width,
      height: snapshot.height,
      origin,
      count,
      thickness,
      ...(seed === undefined ? {} : { seed }),
      ...(path ? { path } : {}),
    };
    const seedPoints = effect.seedPoints?.({
      width: snapshot.width,
      height: snapshot.height,
      origin,
      count,
      random: createRandom(seed),
    });
    const patternName = effect.pattern ?? DEFAULT_PATTERN;
    const pattern = this.patterns.get(patternName);
    if (!pattern) throw new GLError(`Pattern "${patternName}" is not loaded`);
    const geometry = fracture(pattern, seedPoints ? { ...options, seedPoints } : options);
    const fractureMs = performance.now() - started;
    this.pathData.fill(0);
    if (geometry.path) this.pathData.set(geometry.path);
    this.pathCount = geometry.path ? geometry.path.length / 2 : 0;

    const { gl } = this.device;
    const { shardBuffer } = this.ensurePageResources();
    gl.bindBuffer(gl.ARRAY_BUFFER, shardBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.geometry = geometry;
    this.effect = effect;
    this.ensureEffectProgram(effect);
    // Rest-pose data until prepareMotion() supplies the effect's own.
    this.uploadShardData(
      new Float32Array(geometry.shards.length * SHARD_ATTRIBUTE_FLOATS),
      new Float32Array(geometry.shards.length),
    );
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
      order: staggerOrder(effect.stagger, {
        shards: geometry.shards,
        width: geometry.width,
        height: geometry.height,
        origin: geometry.origin,
        maxRadius: geometry.maxRadius,
        seed: request.seed,
      }),
    };
    const { data } = effect.shardAttributes(context);
    if (data.length !== shards.length * SHARD_ATTRIBUTE_FLOATS) {
      throw new GLError(
        `Effect "${effect.name}" returned ${data.length} floats; expected ${shards.length * SHARD_ATTRIBUTE_FLOATS}`,
      );
    }
    this.uploadShardData(data, context.order);
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
   * Hands the prepared motion to a physics backend (after `prepareMotion`).
   * Only the falling built-in effects can be driven by physics; returns false
   * (procedural motion) for any other effect.
   */
  startPhysics(backend: PhysicsBackend): boolean {
    const state = this.state;
    const effect = this.effect;
    const geometry = this.geometry;
    const damping = effect ? this.physical.get(effect) : undefined;
    if (!state || !geometry || damping === undefined) return false;
    const data = state.attributes;
    const shards: PhysicsShard[] = state.shards.map((shard) => {
      const o = shard.id * SHARD_ATTRIBUTE_FLOATS;
      return {
        ...shard,
        velocity: { x: data[o] ?? 0, y: data[o + 1] ?? 0, z: data[o + 2] ?? 0 },
        delay: data[o + 3] ?? 0,
        spin: {
          x: data[o + 4] ?? 0,
          y: data[o + 5] ?? 0,
          z: data[o + 6] ?? 0,
          speed: data[o + 7] ?? 0,
        },
      };
    });
    this.simulation = backend.createSimulation({
      width: geometry.width,
      height: geometry.height,
      thickness: geometry.thickness,
      gravity: state.gravity,
      linearDamping: damping,
      shards,
    });
    const transforms = new Float32Array(shards.length * PHYSICS_TRANSFORM_FLOATS);
    this.simulation.write(transforms);
    this.transforms = transforms;
    this.device.deleteTexture(this.transformTexture);
    this.transformTexture = this.device.createDataTexture(
      4,
      Math.max(1, shards.length),
      transforms,
    );
    return true;
  }

  /** Steps the simulation to `seconds` and uploads the transforms. */
  private stepPhysics(seconds: number): void {
    const { simulation, transforms, transformTexture } = this;
    if (!simulation || !transforms || !transformTexture) return;
    simulation.advance(seconds);
    simulation.write(transforms);
    this.device.updateDataTexture(
      transformTexture,
      4,
      transforms.length / PHYSICS_TRANSFORM_FLOATS,
      transforms,
    );
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
        const frame = crackAt(
          now - started,
          maxRadius,
          this.effect?.crackDuration ?? CRACK_DURATION_MS,
          CRACK_HOLD_MS,
          this.crackFrame,
        );
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
      const simulation = this.simulation;
      const complete = simulation
        ? t >= state.duration || simulation.finished
        : effect.isComplete(easeTime(effect.easing, t, state.duration), state);
      if (complete) {
        if (!endsAtRest) return true;
        // The frame in which the effect completes is not drawn otherwise: the
        // caller hides the overlay right away.
        this.time = Math.max(t, state.duration) / 1000;
        this.draw();
        finalDrawn = true;
        return false;
      }
      this.time = t / 1000;
      this.stepPhysics(this.time);
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
    // A simulation only runs forward: an earlier time keeps the latest state.
    this.stepPhysics(this.time);
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
      // Unit 3: physics transforms; the shard data stands in when there are none.
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.transformTexture ?? this.shardData);
      gl.uniform1i(program.uniform('uTransforms'), 3);
      gl.uniform1f(program.uniform('uPhysics'), this.simulation ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(program.uniform('uMaxZ'), camera ? camera.maxZ : 0);
      gl.uniform2f(program.uniform('uViewport'), geometry.width, geometry.height);
      gl.uniform2f(program.uniform('uOrigin'), geometry.origin.x, geometry.origin.y);
      gl.uniform1f(program.uniform('uMaxRadius'), geometry.maxRadius);
      const state = this.state;
      // The motion's own pace (ADR-059): the shader sees the eased time.
      gl.uniform1f(
        program.uniform('uTimeValue'),
        this.moving ? easeTime(effect.easing, this.time, state ? state.duration / 1000 : 0) : 0,
      );
      // Lighting is exactly 0 until the motion starts and fades in over 60 ms.
      gl.uniform1f(program.uniform('uLight'), this.moving ? lightFade(this.time) : 0);
      gl.uniform1f(program.uniform('uChromatic'), this.shading.chromatic ? 1 : 0);
      // Indexed, not destructured: array destructuring creates an iterator
      // per frame in unoptimised code (ADR-040).
      const tint = this.shading.tint ?? this.material.tint;
      gl.uniform3f(program.uniform('uTint'), tint[0], tint[1], tint[2]);
      const m = this.materialData;
      gl.uniform4f(program.uniform('uMatA'), m[0] ?? 0, m[1] ?? 0, m[2] ?? 0, m[3] ?? 0);
      gl.uniform4f(program.uniform('uMatB'), m[4] ?? 0, m[5] ?? 0, m[6] ?? 0, m[7] ?? 0);
      gl.uniform4f(program.uniform('uMatC'), m[8] ?? 0, m[9] ?? 0, m[10] ?? 0, m[11] ?? 0);
      gl.uniform1f(program.uniform('uMoving'), this.moving ? 1 : 0);
      gl.uniform1f(program.uniform('uDuration'), state ? state.duration / 1000 : 1);
      gl.uniform1f(program.uniform('uGravity'), state ? state.gravity : 0);
      gl.uniform1f(program.uniform('uImpulse'), state ? state.impulse : 0);
      gl.uniform1f(program.uniform('uThickness'), geometry.thickness);
      gl.uniform1f(program.uniform('uDirection'), state?.direction === 'back' ? -1 : 1);
      gl.uniform1f(program.uniform('uCrackRadius'), this.crackRadius);
      gl.uniform1f(program.uniform('uFlash'), this.flash);
      // A tear (ADR-060): the crack grows out from the path.
      gl.uniform1f(program.uniform('uPathCount'), this.pathCount);
      gl.uniform2fv(program.uniform('uPath'), this.pathData);
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
    // Either branch above issues exactly one draw call.
    this.drawCalls += 1;
    this.drawnFrames += 1;
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
    const pattern = this.patterns.get(DEFAULT_PATTERN);
    if (!pattern) throw new GLError(`Pattern "${DEFAULT_PATTERN}" is not loaded`);
    const total = Math.max(1, Math.floor(runs));
    for (let i = 0; i < Math.min(20, total); i++) fracture(pattern, { ...options, seed: i });
    const times: number[] = [];
    for (let i = 0; i < total; i++) {
      const start = performance.now();
      fracture(pattern, { ...options, seed: 1000 + i });
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
    this.simulation?.free();
    this.simulation = null;
    this.transforms = null;
    this.device.deleteTexture(this.transformTexture);
    this.transformTexture = null;
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

  private uploadShardData(data: Float32Array, order: Float32Array): void {
    this.device.deleteTexture(this.shardData);
    const rows = data.length / SHARD_ATTRIBUTE_FLOATS;
    // Three RGBA texels per shard, one row per shard: the effect's 8 floats
    // (`Shard.a`, `Shard.b`), then `Shard.order` (ADR-048).
    const stride = SHARD_TEXELS * 4;
    const texels = new Float32Array(Math.max(1, rows) * stride);
    for (let i = 0; i < rows; i++) {
      const from = i * SHARD_ATTRIBUTE_FLOATS;
      texels.set(data.subarray(from, from + SHARD_ATTRIBUTE_FLOATS), i * stride);
      texels[i * stride + SHARD_ATTRIBUTE_FLOATS] = order[i] ?? 0;
    }
    this.shardData = this.device.createDataTexture(SHARD_TEXELS, Math.max(1, rows), texels);
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
    const key = `${effect.vertexChunk}\0${effect.fragmentChunk ?? ''}`;
    const cached = this.programs.get(key);
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
    this.programs.set(key, entry);
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
