/**
 * Small WebGL2 abstraction: one context for the life of the page, created
 * lazily, with context-loss tracking and a live-texture counter (used by the
 * leak tests and the debug panel).
 */

export class GLError extends Error {
  override readonly name = 'GLError';
}

export type GLTextureSource = HTMLCanvasElement | ImageBitmap | OffscreenCanvas | ImageData;

export interface GLProgram {
  readonly program: WebGLProgram;
  /** Looks up (and caches) a uniform location. Null when the uniform is unused. */
  uniform(name: string): WebGLUniformLocation | null;
  /** Looks up (and caches) an attribute location. -1 when the attribute is unused. */
  attribute(name: string): number;
}

const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: true,
  depth: true,
  stencil: false,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
};

export class GLDevice {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  readonly maxTextureSize: number;

  private lost = false;
  private liveTextures = 0;
  private readonly restoreListeners = new Set<() => void>();
  private readonly onLost = (event: Event): void => {
    // preventDefault tells the browser we want the context back.
    event.preventDefault();
    this.lost = true;
    this.liveTextures = 0;
  };
  private readonly onRestored = (): void => {
    this.lost = false;
    for (const listener of this.restoreListeners) listener();
  };

  constructor(doc: Document) {
    const canvas = doc.createElement('canvas');
    const gl = canvas.getContext('webgl2', CONTEXT_ATTRIBUTES);
    if (!gl) throw new GLError('WebGL2 is not available');
    this.canvas = canvas;
    this.gl = gl;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
  }

  /** True while the context is lost; rendering must use the fallback until it is restored. */
  get contextLost(): boolean {
    return this.lost || this.gl.isContextLost();
  }

  /** Number of textures created through this device and not yet deleted. */
  get textureCount(): number {
    return this.liveTextures;
  }

  /** Registers a callback run after a lost context is restored (GPU objects must be rebuilt). */
  onRestore(listener: () => void): () => void {
    this.restoreListeners.add(listener);
    return () => this.restoreListeners.delete(listener);
  }

  /** Sets the backing-store size in device pixels and the matching GL viewport. */
  resize(deviceWidth: number, deviceHeight: number): void {
    const { canvas, gl } = this;
    if (canvas.width !== deviceWidth) canvas.width = deviceWidth;
    if (canvas.height !== deviceHeight) canvas.height = deviceHeight;
    gl.viewport(0, 0, deviceWidth, deviceHeight);
  }

  createProgram(vertexSource: string, fragmentSource: string): GLProgram {
    const { gl } = this;
    const vertex = this.compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    // Shaders are owned by the program from here on.
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
      const log = gl.getProgramInfoLog(program) ?? 'unknown error';
      gl.deleteProgram(program);
      throw new GLError(`Program link failed: ${log}`);
    }
    const uniforms = new Map<string, WebGLUniformLocation | null>();
    const attributes = new Map<string, number>();
    return {
      program,
      uniform: (name) => {
        let location = uniforms.get(name);
        if (location === undefined) {
          location = gl.getUniformLocation(program, name);
          uniforms.set(name, location);
        }
        return location;
      },
      attribute: (name) => {
        let location = attributes.get(name);
        if (location === undefined) {
          location = gl.getAttribLocation(program, name);
          attributes.set(name, location);
        }
        return location;
      },
    };
  }

  /**
   * Uploads a page snapshot as an RGBA8 texture. The pixels are treated as
   * already-sRGB display values: no colour-space conversion on upload and no
   * gamma maths in the shaders, so what goes in comes out bit-identical.
   * Row 0 of the source is the top of the page (no Y flip).
   */
  createTexture(source: GLTextureSource): WebGLTexture {
    const { gl } = this;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.liveTextures += 1;
    return texture;
  }

  /**
   * Uploads per-shard data as an RGBA32F texture (`width` texels per row,
   * `height` rows). Float textures cannot be filtered: always NEAREST, read with texelFetch.
   */
  createDataTexture(width: number, height: number, data: Float32Array): WebGLTexture {
    const { gl } = this;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.liveTextures += 1;
    return texture;
  }

  deleteTexture(texture: WebGLTexture | null): void {
    if (!texture) return;
    this.gl.deleteTexture(texture);
    if (this.liveTextures > 0) this.liveTextures -= 1;
  }

  /** Removes listeners and asks the browser to drop the context. */
  destroy(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.restoreListeners.clear();
    this.liveTextures = 0;
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  private compile(type: number, source: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type);
    if (!shader) throw new GLError('Could not create shader (context lost?)');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const log = gl.getShaderInfoLog(shader) ?? 'unknown error';
      gl.deleteShader(shader);
      throw new GLError(`Shader compile failed: ${log}`);
    }
    return shader;
  }
}
