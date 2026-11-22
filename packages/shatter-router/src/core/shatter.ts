import type { EffectComposition, ShatterEffect } from './effect';
import type { MaterialSource } from './material';
import { isBrowser } from './env';
import { classifyLinkClick, findAnchor, getLinkEffect } from './links';
import type { TransitionState } from './machine';
import type {
  Shatter,
  ShatterEventHandler,
  ShatterEventMap,
  ShatterEventName,
  ShatterOptions,
  TransitionRequest,
} from './types';

/** What the lazily loaded runtime needs from the instance that created it. */
export interface RuntimeHost {
  readonly options: ShatterOptions;
  readonly effects: ReadonlyMap<string, ShatterEffect | EffectComposition>;
  /** `pathname + search` when Shatter was created: the page the memory starts on (ADR-047). */
  readonly startKey: string;
  /** The material set with `setMaterial()`, else the `material` option (ADR-057). */
  material(): MaterialSource | undefined;
  emit<K extends ShatterEventName>(event: K, payload: ShatterEventMap[K]): void;
}

/** The transition runtime (state machine, fallbacks, a11y), in its own lazy chunk. */
export interface ShatterRuntime {
  readonly state: TransitionState;
  transition(request: TransitionRequest): Promise<void>;
  /** Starts loading the engine and capture chunks. */
  warmUp(): void;
  /** The pointer is about to activate a link: start capturing now. */
  /** `effect`: the link's own effect, whose chunks can be fetched now (ADR-048). */
  precapture(effect?: string): void;
  destroy(): void;
}

export type RuntimeLoader = () => Promise<{
  createRuntime(host: RuntimeHost): ShatterRuntime;
}>;

const HOVER_DWELL_MS = 120;

/**
 * The part of Shatter that ships in the core entry: options, events, the
 * effect registry and the listeners that detect navigation intent. Everything
 * else loads lazily, prefetched when the browser is idle. If the runtime
 * cannot load at all, navigation still happens, without an effect.
 */
export class ShatterFacade implements Shatter {
  private readonly handlers = new Map<ShatterEventName, Set<(payload: never) => void>>();
  private readonly effects = new Map<string, ShatterEffect | EffectComposition>();
  private readonly cleanups: (() => void)[] = [];
  private runtime: ShatterRuntime | null = null;
  private loading: Promise<ShatterRuntime | null> | null = null;
  private destroyed = false;
  /** Set with `setMaterial()`; undefined: the `material` option (ADR-057). */
  private material: MaterialSource | undefined = undefined;
  private readonly startKey = isBrowser() ? location.pathname + location.search : '';

  constructor(
    private readonly options: ShatterOptions,
    private readonly loader: RuntimeLoader,
  ) {
    if (!isBrowser()) return;
    const warmUp = (): void => {
      void this.load().then((runtime) => runtime?.warmUp());
    };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(warmUp, { timeout: 2000 });
      this.cleanups.push(() => {
        window.cancelIdleCallback(handle);
      });
    } else {
      const handle = window.setTimeout(warmUp, 200);
      this.cleanups.push(() => {
        window.clearTimeout(handle);
      });
    }
    this.listenForIntent();
  }

  get state(): TransitionState {
    return this.runtime?.state ?? 'idle';
  }

  on<K extends ShatterEventName>(event: K, handler: ShatterEventHandler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  registerEffect(effect: ShatterEffect | (EffectComposition & { readonly name: string })): void {
    if (!effect.name) throw new TypeError('An effect needs a name');
    this.effects.set(effect.name, effect);
  }

  setMaterial(material: MaterialSource | undefined): void {
    this.material = material;
  }

  async transition(request: TransitionRequest): Promise<void> {
    if (this.destroyed || !isBrowser()) {
      await request.commit();
      return;
    }
    const runtime = await this.load();
    // A runtime that was destroyed meanwhile commits plainly itself.
    if (runtime) {
      await runtime.transition(request);
      return;
    }
    // The runtime chunk could not load (offline, blocked): navigate plainly.
    this.emit('start', undefined);
    this.emit('fallback', { reason: 'unsupported' });
    await request.commit();
    this.emit('committed', undefined);
    this.emit('end', { fallback: true });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.runtime?.destroy();
    this.handlers.clear();
  }

  private load(): Promise<ShatterRuntime | null> {
    this.loading ??= this.loader().then(
      (module) => {
        if (this.destroyed) return null;
        this.runtime = module.createRuntime({
          options: this.options,
          effects: this.effects,
          startKey: this.startKey,
          material: () => this.material ?? this.options.material,
          emit: (event, payload) => {
            this.emit(event, payload);
          },
        });
        return this.runtime;
      },
      () => null,
    );
    return this.loading;
  }

  private emit<K extends ShatterEventName>(event: K, payload: ShatterEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        (handler as ShatterEventHandler<K>)(payload);
      } catch (error) {
        // A throwing listener must not derail the transition.
        console.error('[shatter-router] event handler threw', error);
      }
    }
  }

  /** Pre-capture triggers: pointerdown (default) or a hover dwell on a link Shatter will handle. */
  private listenForIntent(): void {
    const mode = this.options.precapture ?? 'pointerdown';
    if (mode === false) return;
    // The link's own effect comes along, so its chunks load early (ADR-048).
    const intent = (anchor: Element): void => {
      const effect = getLinkEffect(anchor);
      void this.load().then((runtime) => runtime?.precapture(effect));
    };
    const wouldIntercept = (
      event: PointerEvent,
      anchor: HTMLAnchorElement | null,
    ): anchor is HTMLAnchorElement => {
      return (
        anchor !== null &&
        classifyLinkClick(
          {
            button: event.button,
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            defaultPrevented: false,
          },
          anchor,
        ).intercept
      );
    };
    if (mode === 'pointerdown') {
      const onDown = (event: PointerEvent): void => {
        const anchor = findAnchor(event);
        if (event.isPrimary && wouldIntercept(event, anchor)) intent(anchor);
      };
      document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
      this.cleanups.push(() => {
        document.removeEventListener('pointerdown', onDown, true);
      });
      return;
    }
    let dwell = 0;
    let hovered: Element | null = null;
    const onOver = (event: PointerEvent): void => {
      const anchor = findAnchor(event);
      if (!anchor || anchor === hovered) return;
      hovered = anchor;
      window.clearTimeout(dwell);
      if (wouldIntercept(event, anchor)) {
        dwell = window.setTimeout(() => {
          intent(anchor);
        }, HOVER_DWELL_MS);
      }
    };
    const onOut = (event: PointerEvent): void => {
      const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (hovered && related && hovered.contains(related)) return;
      hovered = null;
      window.clearTimeout(dwell);
    };
    document.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    this.cleanups.push(() => {
      window.clearTimeout(dwell);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
    });
  }
}

/** Creates a Shatter instance. Safe to call during SSR; nothing touches the DOM until used. */
export function createShatter(options: ShatterOptions = {}): Shatter {
  return new ShatterFacade(options, () => import('../runtime/index'));
}
