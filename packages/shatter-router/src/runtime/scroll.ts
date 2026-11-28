import { DEFAULT_INTENSITY } from '../core/interaction';
import type { MaterialSource } from '../core/material';
import type { PausePoint, ScrollBreakOptions } from '../core/types';
import { readViewport } from '../core/viewport';
import type { EffectRegistry } from '../engine/index';
import { frameOf } from './geometry';
import type { Loaded, Settings } from './index';

/**
 * Scroll-driven breaking (ADR-064). The element sits in a sticky box inside a
 * tall section; as the section scrolls, the break's timeline is scrubbed by the
 * progress `p` through the pinned range. Loaded on first use, like the rest of
 * the runtime's optional parts.
 */

/** The engine calls a scrubbed break needs. */
export interface ScrubEngine {
  readonly overlayElement: HTMLElement;
  readonly scrubLength: number;
  scrub(ms: number): void;
  setOverlayShown(shown: boolean): void;
  release(): void;
}

export interface ScrollBreakHost {
  load(): Promise<Loaded | null>;
  /** True when no timed transition owns the engine. */
  idle(): boolean;
  readonly settings: Settings;
  registry(): EffectRegistry;
  material(): MaterialSource | undefined;
  pause(point: PausePoint): Promise<void>;
}

export interface ScrollBreaks {
  /** Registers a break. Throws a RangeError when the markup cannot scrub (ADR-064). */
  add(target: Element, options: ScrollBreakOptions): () => void;
  /** Ends every scrub at once: the elements are live again (a navigation starts). */
  interrupt(): void;
  destroy(): void;
}

interface Break {
  readonly target: HTMLElement;
  readonly pin: HTMLElement;
  readonly section: HTMLElement;
  readonly options: ScrollBreakOptions;
  engine: ScrubEngine | null;
  preparing: boolean;
  /** Bumped on every reset: a preparation that finishes later is stale. */
  token: number;
  /** The element's own clip-path, saved while the break hides it. */
  savedClip: string | null;
}

const HIDDEN = 'inset(100%)';
// Mirrors the runtime's defaults for a break (kept in step with runtime/index.ts).
const DEFAULT_MOTION_MS = 1000;
const SUBSTITUTE_EFFECT = 'shatter';

export function createScrollBreaks(host: ScrollBreakHost): ScrollBreaks {
  const breaks = new Set<Break>();
  /** The break whose engine is prepared or being prepared: one page at a time. */
  let owner: Break | null = null;
  let frame = 0;
  let listening = false;

  function clip(b: Break, hidden: boolean): void {
    if (hidden) {
      b.savedClip ??= b.target.style.clipPath;
      b.target.style.clipPath = HIDDEN;
    } else if (b.savedClip !== null) {
      b.target.style.clipPath = b.savedClip;
      b.savedClip = null;
    }
  }

  /** Puts the element back as the page had it, releasing the break if nothing else owns the engine. */
  function reset(b: Break): void {
    b.token++;
    b.preparing = false;
    if (owner === b) owner = null;
    if (b.engine) {
      b.engine.overlayElement.style.pointerEvents = '';
      // A timed transition that is running owns the engine: it releases it itself.
      if (host.idle()) b.engine.release();
      b.engine = null;
    }
    clip(b, false);
  }

  /**
   * The progress range of the section: its scroll height beyond the sticky box.
   * Whole pixels, as the browser scrolls in whole pixels: progress 0 is then the
   * exact scroll position where the section pins.
   */
  function measure(b: Break): { top: number; range: number } {
    const section = b.section.getBoundingClientRect();
    return {
      top: Math.round(section.top + window.scrollY),
      range: Math.round(section.height - b.pin.getBoundingClientRect().height),
    };
  }

  function show(b: Break, progress: number): void {
    const engine = b.engine;
    if (!engine) return;
    engine.setOverlayShown(true);
    engine.overlayElement.style.pointerEvents = 'none';
    engine.scrub(progress * engine.scrubLength);
    clip(b, progress > 0);
  }

  function update(b: Break): void {
    const y = window.scrollY;
    const { top, range } = measure(b);
    if (y < top) {
      // Above the section: the page is live and whole.
      reset(b);
      return;
    }
    if (y > top + range) {
      // Past the pinned range: the pieces have left the screen, so the overlay
      // goes; the element stays hidden (a break keeps its end state).
      const engine = b.engine;
      if (engine) {
        engine.scrub(engine.scrubLength);
        engine.setOverlayShown(false);
        clip(b, true);
      }
      return;
    }
    const progress = Math.min(1, Math.max(0, (y - top) / Math.max(1, range)));
    if (b.engine) {
      show(b, progress);
      return;
    }
    if (!b.preparing && owner === null && host.idle()) start(b);
  }

  function start(b: Break): void {
    const token = b.token;
    b.preparing = true;
    owner = b;
    prepareBreak(host, b.target, b.options).then(
      (engine) => {
        if (b.token !== token) {
          // Stopped while preparing: nothing shows it, so it is released now.
          if (engine && host.idle()) engine.release();
          return;
        }
        b.preparing = false;
        if (!engine) {
          owner = null;
          return;
        }
        b.engine = engine;
        update(b);
      },
      () => {
        if (b.token === token) {
          b.preparing = false;
          owner = null;
        }
      },
    );
  }

  function tick(): void {
    frame = 0;
    for (const b of breaks) update(b);
  }

  function onScroll(): void {
    if (frame === 0) frame = requestAnimationFrame(tick);
  }

  function onResize(): void {
    // The layout changed: every break is prepared again from the new page.
    for (const b of breaks) reset(b);
    onScroll();
  }

  function listen(on: boolean): void {
    if (on === listening) return;
    listening = on;
    const method = on ? 'addEventListener' : 'removeEventListener';
    window[method]('scroll', onScroll, { passive: true });
    window[method]('resize', onResize);
  }

  return {
    add(target, options) {
      if (!(target instanceof HTMLElement)) {
        throw new RangeError('scrollBreak: the target must be an HTML element');
      }
      const pin = stickyAncestor(target);
      if (!pin) {
        throw new RangeError(
          'scrollBreak: the target needs a sticky box around it (position: sticky), ADR-064',
        );
      }
      const section = options.section ?? pin.parentElement;
      if (!(section instanceof HTMLElement) || !section.contains(pin)) {
        throw new RangeError('scrollBreak: the section must contain the sticky box');
      }
      const b: Break = {
        target,
        pin,
        section,
        options,
        engine: null,
        preparing: false,
        token: 0,
        savedClip: null,
      };
      if (measure(b).range <= 0) {
        throw new RangeError('scrollBreak: the section must be taller than its sticky box');
      }
      breaks.add(b);
      listen(true);
      onScroll();
      return () => {
        if (!breaks.delete(b)) return;
        reset(b);
        if (breaks.size === 0) listen(false);
      };
    },
    interrupt() {
      for (const b of breaks) reset(b);
    },
    destroy() {
      for (const b of breaks) reset(b);
      breaks.clear();
      listen(false);
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}

/** The nearest sticky box: the target itself, or an ancestor. */
function stickyAncestor(target: Element): HTMLElement | null {
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el instanceof HTMLElement && getComputedStyle(el).position === 'sticky') return el;
  }
  return null;
}

/**
 * Captures the page and prepares the element's break for scrubbing (ADR-064).
 * The engine is left covering and prepared; the scroll code draws it. Null when
 * it cannot run, or a timed transition took the engine meanwhile.
 */
async function prepareBreak(
  host: ScrollBreakHost,
  target: Element,
  options: ScrollBreakOptions,
): Promise<ScrubEngine | null> {
  const loaded = await host.load();
  if (!loaded || !host.idle()) return null;
  const { engine } = loaded;
  if (engine.contextLost) return null;
  const viewport = readViewport(window);
  if (viewport.pinchZoomed) return null;
  const { settings } = host;
  const effect = await engine.loadEffect(options.effect ?? settings.effect, host.registry());
  engine.setMaterial(effect.material ?? host.material() ?? 'glass');
  const snapshot = await loaded.capturer
    .capture({ viewport, maxTextureSize: engine.maxTextureSize })
    .catch(() => null);
  // A timed transition that started meanwhile calls cover() itself, which releases.
  if (!snapshot) return null;
  if (!host.idle()) {
    snapshot.dispose();
    return null;
  }
  const frame = frameOf(target, snapshot);
  if (!frame) {
    snapshot.dispose();
    return null;
  }
  const { region } = frame;
  await engine.cover(snapshot, frame);
  if (!host.idle()) return null;
  const { count } = engine.resolveShardCount(settings.shards, snapshot.duration);
  const seed = settings.seed;
  engine.fracture({
    effect,
    origin: {
      x: region.x + region.width / 2,
      y: region.y + region.height / 2,
    },
    count,
    thickness: settings.thickness,
    ...(seed === undefined ? {} : { seed }),
  });
  // The motion that ends on the new page has no new page here: a plain break plays.
  let motion = effect;
  if (effect.needsIncomingSnapshot) {
    motion = await engine.loadEffect(SUBSTITUTE_EFFECT, host.registry());
    engine.replaceEffect(motion);
  }
  engine.prepareMotion({
    duration: options.duration ?? settings.duration ?? motion.duration ?? DEFAULT_MOTION_MS,
    gravity: settings.gravity,
    impulse: settings.impulse * (0.5 + DEFAULT_INTENSITY),
    direction: 'forward',
    ...(seed === undefined ? {} : { seed }),
  });
  if (!host.idle()) return null;
  engine.setOverlayShown(false);
  await host.pause('scrubbed');
  return engine;
}
