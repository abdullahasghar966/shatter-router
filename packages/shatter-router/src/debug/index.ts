import type { ShatterEventName, ShatterTestHook } from '../core/types';
import { readViewport } from '../core/viewport';
import type { Loaded } from '../runtime/index';

/**
 * The debug panel (master prompt section 10, ADR-041): a lazy chunk loaded
 * only with `debug: true`. It lives in a shadow root (app CSS cannot reach
 * it), in the top layer above the overlay, and is excluded from captures.
 */

/** What the runtime gives the panel. */
export interface DebugHost {
  readonly hook: ShatterTestHook;
  /** Runs `work` with the loaded engine and capturer while no transition can start. */
  exclusive<T>(work: (loaded: Loaded) => Promise<T>): Promise<T>;
  readonly shards: 'auto' | number;
  readonly thickness: number;
  readonly seed: number | undefined;
}

export interface DebugPanel {
  update(event: ShatterEventName): void;
  destroy(): void;
}

/** A pixel differs when a channel differs by more than this (0.1 of full scale, like the e2e threshold). */
export const SEAM_CHANNEL_TOLERANCE = 26;

export interface SeamDiff {
  readonly width: number;
  readonly height: number;
  /** Share of pixels that differ, in percent. */
  readonly percent: number;
  /** Red where the pixels differ, the dimmed live frame elsewhere. */
  readonly heatmap: ImageData;
}

/** Compares two RGBA frames of the same size pixel by pixel. */
export function diffFrames(
  live: Uint8ClampedArray | Uint8Array,
  overlay: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): SeamDiff {
  const heatmap = new ImageData(width, height);
  const out = heatmap.data;
  let differing = 0;
  for (let i = 0; i < width * height * 4; i += 4) {
    const delta = Math.max(
      Math.abs((live[i] ?? 0) - (overlay[i] ?? 0)),
      Math.abs((live[i + 1] ?? 0) - (overlay[i + 1] ?? 0)),
      Math.abs((live[i + 2] ?? 0) - (overlay[i + 2] ?? 0)),
    );
    if (delta > SEAM_CHANNEL_TOLERANCE) {
      differing++;
      out[i] = 255;
      out[i + 1] = 0;
      out[i + 2] = 0;
    } else {
      const grey =
        ((live[i] ?? 0) * 0.3 + (live[i + 1] ?? 0) * 0.59 + (live[i + 2] ?? 0) * 0.11) * 0.35;
      out[i] = grey;
      out[i + 1] = grey;
      out[i + 2] = grey;
    }
    out[i + 3] = 255;
  }
  return { width, height, percent: (differing * 100) / Math.max(1, width * height), heatmap };
}

const STYLE = `:host{all:initial}
.p{position:fixed;right:8px;bottom:8px;z-index:2147483647;width:280px;max-height:90vh;overflow:auto;
font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#dfe9f5;background:#0d1726ee;
border:1px solid #cfe8ff55;border-radius:8px;padding:8px;box-sizing:border-box}
.h{display:flex;justify-content:space-between;align-items:center;font-weight:700;margin-bottom:4px}
button{font:inherit;color:inherit;background:#1d3150;border:1px solid #cfe8ff55;border-radius:4px;padding:2px 6px;cursor:pointer}
button:disabled{opacity:.5;cursor:default}
dl{display:grid;grid-template-columns:auto 1fr;gap:0 8px;margin:4px 0}dt{color:#8fa6c2}dd{margin:0;text-align:right}
label{display:block;margin:4px 0}canvas{display:block;width:100%;margin-top:4px;border-radius:4px}
.c dl,.c label,.c .s,.c canvas{display:none}`;

const ms = (value: number | undefined): string =>
  value === undefined ? '–' : `${value.toFixed(0)} ms`;

/** Opens the panel. */
export function createDebugPanel(host: DebugHost, doc: Document = document): DebugPanel {
  const win = doc.defaultView ?? window;
  const element = doc.createElement('div');
  element.setAttribute('data-shatter-ignore', '');
  element.setAttribute('data-shatter-debug', '');
  const top = 'showPopover' in element;
  if (top) element.setAttribute('popover', 'manual');
  element.style.cssText =
    'all:initial;position:fixed;inset:auto 0 0 auto;margin:0;border:0;padding:0;background:none;overflow:visible';
  const root = element.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${STYLE}</style><div class="p" part="panel"><div class="h"><span>shatter-router</span><button data-k="toggle" aria-expanded="true">–</button></div>
<dl></dl><label><input type="checkbox" data-k="wire"> wireframe + impact point</label>
<div class="s"><button data-k="seam">Seam check</button> <span data-k="seam-result"></span></div><canvas hidden></canvas></div>`;
  doc.body.append(element);
  const panel = root.querySelector<HTMLElement>('.p');
  const list = root.querySelector('dl');
  const canvas = root.querySelector('canvas');
  const seamButton = root.querySelector<HTMLButtonElement>('[data-k="seam"]');
  const seamResult = root.querySelector<HTMLElement>('[data-k="seam-result"]');
  const wire = root.querySelector<HTMLInputElement>('[data-k="wire"]');
  const toggle = root.querySelector<HTMLButtonElement>('[data-k="toggle"]');
  if (!panel || !list || !canvas || !seamButton || !seamResult || !wire || !toggle) {
    throw new Error('debug panel markup');
  }
  const { hook } = host;

  let liveFps: number | null = null;
  let frameId = 0;
  let timer = 0;
  const raise = (): void => {
    if (!top || !element.isConnected) return;
    // Shown again after the overlay opens, so the panel stays above it.
    if (element.matches(':popover-open')) element.hidePopover();
    element.showPopover();
  };

  const render = (): void => {
    const timings = hook.timings();
    const fracture = hook.lastFracture;
    const animation = hook.lastAnimation;
    const rows: [string, string][] = [
      ['state', hook.state()],
      ['capture', ms(timings.capturing)],
      ['cover', ms(timings.covering)],
      ['commit', ms(timings.committing)],
      ['wait', ms(timings.waiting)],
      ['animate', ms(timings.animating)],
      ['shards', fracture ? `${fracture.shardCount} (${fracture.fractureMs.toFixed(1)} ms)` : '–'],
      ['tier', fracture?.tier ?? '–'],
      [
        'fps',
        liveFps !== null
          ? `${liveFps.toFixed(0)} live`
          : animation
            ? `${animation.fps.toFixed(1)} (worst ${animation.worstFrameMs.toFixed(0)} ms)`
            : '–',
      ],
      ['draw calls', animation ? `${animation.drawCallsPerFrame.toFixed(2)} / frame` : '–'],
      ['effect', hook.lastEffect ?? '–'],
      ['physics', hook.lastPhysics ?? '–'],
      ['fallback', hook.lastFallback ?? '–'],
      ['textures', String(hook.textureCount())],
    ];
    list.replaceChildren(
      ...rows.flatMap(([name, value]) => {
        const dt = doc.createElement('dt');
        dt.textContent = name;
        const dd = doc.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
      }),
    );
    seamButton.disabled = hook.state() !== 'idle';
  };

  const countFrames = (): void => {
    let frames = 0;
    let since = win.performance.now();
    const tick = (now: number): void => {
      frames++;
      if (now - since >= 250) {
        liveFps = (frames * 1000) / (now - since);
        frames = 0;
        since = now;
        render();
      }
      frameId = win.requestAnimationFrame(tick);
    };
    frameId = win.requestAnimationFrame(tick);
  };
  const stopCounting = (): void => {
    win.cancelAnimationFrame(frameId);
    liveFps = null;
  };

  toggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('c');
    toggle.textContent = collapsed ? '+' : '–';
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });
  wire.addEventListener('change', () => {
    hook.wireframe = wire.checked;
  });
  seamButton.addEventListener('click', () => {
    seamButton.disabled = true;
    seamResult.textContent = 'checking…';
    seamCheck(host, element, win)
      .then(({ diff, mode }) => {
        canvas.width = diff.width;
        canvas.height = diff.height;
        canvas.getContext('2d')?.putImageData(diff.heatmap, 0, 0);
        canvas.hidden = false;
        seamResult.textContent = `${diff.percent.toFixed(3)} % differ (${mode})`;
      })
      .catch((error: unknown) => {
        seamResult.textContent = `failed: ${error instanceof Error ? error.message : String(error)}`;
      })
      .finally(render);
  });

  if (top) element.showPopover();
  render();
  return {
    update(event) {
      if (event === 'start') {
        timer = win.setInterval(render, 100);
      } else if (event === 'covered') {
        raise();
      } else if (event === 'animating') {
        countFrames();
      } else if (event === 'end' || event === 'fallback') {
        stopCounting();
        win.clearInterval(timer);
        // The machine goes idle right after `end` is emitted.
        queueMicrotask(render);
      }
      render();
    },
    destroy() {
      stopCounting();
      win.clearInterval(timer);
      element.remove();
    },
  };
}

interface Frame {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/**
 * Seam check: the live page against the overlay's frame with the page
 * fractured at rest. With screen capture of this tab (the browser asks
 * first), both pictures are frames of the real tab, as in the e2e seam tests.
 * Without it, the capture itself is compared with the overlay's read-back,
 * which checks the GL pipeline but not the capture.
 */
async function seamCheck(
  host: DebugHost,
  panel: HTMLElement,
  win: Window,
): Promise<{ diff: SeamDiff; mode: string }> {
  const stream = await tabStream(win);
  const video = stream ? await playing(win, stream) : null;
  // Sharing a tab opens an infobar that shrinks the viewport: wait for it.
  if (video) await settled(win, video);
  panel.style.visibility = 'hidden';
  try {
    return await host.exclusive(async ({ engine, capturer }) => {
      const viewport = readViewport(win);
      const live = video ? await grab(win, video) : null;
      const snapshot = await capturer.capture({ viewport, maxTextureSize: engine.maxTextureSize });
      // The wireframe would be a difference of its own.
      const wireframe = engine.wireframe;
      engine.wireframe = false;
      try {
        const captured = live ? null : pixelsOf(snapshot.source);
        await engine.cover(snapshot);
        const { count } = engine.resolveShardCount(host.shards, snapshot.duration);
        engine.fracture({
          effect: engine.resolveEffect('shatter', new Map()),
          origin: { x: viewport.width / 2, y: viewport.height / 2 },
          count,
          thickness: host.thickness,
          ...(host.seed === undefined ? {} : { seed: host.seed }),
        });
        engine.draw();
        const overlay = video ? await grab(win, video) : engine.readPixels();
        const reference = live ?? captured;
        if (!reference) throw new Error('no reference frame');
        const [a, b] = sameSize(reference, overlay);
        return {
          diff: diffFrames(a.data, b.data, a.width, a.height),
          mode: live ? 'tab capture' : 'capture vs overlay',
        };
      } finally {
        engine.release();
        // Already freed by release() once covered; safe to repeat.
        snapshot.dispose();
        engine.wireframe = wireframe;
      }
    });
  } finally {
    panel.style.visibility = '';
    for (const track of stream?.getTracks() ?? []) track.stop();
  }
}

async function tabStream(win: Window): Promise<MediaStream | null> {
  const media = win.navigator.mediaDevices as MediaDevices | undefined;
  if (!media?.getDisplayMedia) return null;
  try {
    return await media.getDisplayMedia({
      video: { displaySurface: 'browser', cursor: 'never' },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
    } as DisplayMediaStreamOptions);
  } catch {
    return null;
  }
}

async function playing(win: Window, stream: MediaStream): Promise<HTMLVideoElement> {
  const video = win.document.createElement('video');
  video.muted = true;
  video.srcObject = stream;
  await video.play();
  return video;
}

/**
 * Waits (up to 3 s) until the viewport has kept its size for 300 ms and the
 * stream's frames have the viewport's aspect ratio. Tab capture scales frames
 * (to the screen's pixel ratio, capped at 1080p), which is fine: both frames
 * of the check get the same scaling.
 */
async function settled(win: Window, video: HTMLVideoElement): Promise<void> {
  const started = win.performance.now();
  let size = '';
  let since = started;
  for (;;) {
    const now = win.performance.now();
    const current = `${String(win.innerWidth)}x${String(win.innerHeight)}`;
    if (current !== size) {
      size = current;
      since = now;
    }
    const aspect = video.videoWidth / Math.max(1, video.videoHeight);
    const matches = Math.abs(aspect / (win.innerWidth / win.innerHeight) - 1) < 0.01;
    if ((now - since >= 300 && matches) || now - started > 3000) return;
    await new Promise((resolve) => win.setTimeout(resolve, 50));
  }
}

/** The next frame of the tab after the page has painted. */
async function grab(win: Window, video: HTMLVideoElement): Promise<Frame> {
  for (let i = 0; i < 3; i++) {
    await new Promise<void>((resolve) => {
      if ('requestVideoFrameCallback' in video) {
        video.requestVideoFrameCallback(() => {
          resolve();
        });
      } else {
        win.setTimeout(resolve, 50);
      }
    });
  }
  const width = video.videoWidth;
  const height = video.videoHeight;
  const canvas = win.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2D context');
  ctx.drawImage(video, 0, 0);
  return { width, height, data: ctx.getImageData(0, 0, width, height).data };
}

function pixelsOf(source: CanvasImageSource & { width: number; height: number }): Frame {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2D context');
  ctx.drawImage(source, 0, 0);
  return {
    width: canvas.width,
    height: canvas.height,
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
  };
}

/** Scales `b` to `a`'s size when they differ (e.g. a capture scaled to fit the texture limit). */
function sameSize(a: Frame, b: Frame): [Frame, Frame] {
  if (a.width === b.width && a.height === b.height) return [a, b];
  const source = document.createElement('canvas');
  source.width = b.width;
  source.height = b.height;
  source
    .getContext('2d')
    ?.putImageData(new ImageData(new Uint8ClampedArray(b.data), b.width, b.height), 0, 0);
  const scaled = pixelsOfScaled(source, a.width, a.height);
  return [a, scaled];
}

function pixelsOfScaled(source: HTMLCanvasElement, width: number, height: number): Frame {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2D context');
  ctx.drawImage(source, 0, 0, width, height);
  return { width, height, data: ctx.getImageData(0, 0, width, height).data };
}
