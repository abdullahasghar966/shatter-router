import { nextFrame } from '../core/frame';
import type { Snapshot } from '../core/snapshot';
import { createPixelCamera } from './camera';
import { GLDevice, GLError, type GLProgram } from './gl';
import { Overlay } from './overlay';
import { PAGE_FRAGMENT, PAGE_VERTEX } from './shaders';

export { GLError } from './gl';

/** GPU objects that die with a lost context and are rebuilt on demand. */
interface Resources {
  readonly program: GLProgram;
  readonly vao: WebGLVertexArrayObject;
  readonly vertexBuffer: WebGLBuffer;
}

const FLOATS_PER_VERTEX = 5; // x, y, z, u, v

/**
 * The WebGL side of a transition: owns the single GL context, the top-layer
 * overlay and the page texture. Created lazily on first use and reused for the
 * life of the page.
 */
export class Engine {
  private readonly device: GLDevice;
  private readonly overlay: Overlay;
  private readonly win: Window;
  private readonly viewProjection = new Float32Array(16);
  private readonly quad = new Float32Array(4 * FLOATS_PER_VERTEX);
  private resources: Resources | null = null;
  private texture: WebGLTexture | null = null;
  private snapshot: Snapshot | null = null;
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

  /** Redraws the current frame. */
  draw(): void {
    const { gl } = this.device;
    const texture = this.texture;
    if (!texture || this.device.contextLost) return;
    const { program, vao } = this.ensureResources();

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(program.program);
    gl.uniformMatrix4fv(program.uniform('uViewProjection'), false, this.viewProjection);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(program.uniform('uPage'), 0);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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

  /** Hides the overlay and frees the page texture and snapshot. Safe to call repeatedly. */
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
    const { vertexBuffer } = this.ensureResources();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.quad, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private ensureResources(): Resources {
    if (this.resources) return this.resources;
    const { gl } = this.device;
    const program = this.device.createProgram(PAGE_VERTEX, PAGE_FRAGMENT);
    const vao = gl.createVertexArray();
    const vertexBuffer = gl.createBuffer();
    const stride = FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    const position = program.attribute('aPosition');
    const uv = program.attribute('aUv');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.resources = { program, vao, vertexBuffer };
    return this.resources;
  }
}

/** Entry point of the lazily loaded engine chunk. */
export function createEngine(doc: Document): Engine {
  return new Engine(doc);
}
