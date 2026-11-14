import { nextFrame } from '../core/frame';
import type { Shatter, TransitionRequest } from '../core/types';
import { boundedCommit } from '../react/shared';

interface Waiter {
  readonly from: string;
  readonly resolve: () => void;
}

interface ScrollPosition {
  readonly x: number;
  readonly y: number;
}

function currentScroll(): ScrollPosition {
  return { x: window.scrollX, y: window.scrollY };
}

/**
 * The location key React Router gives the entry the browser just moved to:
 * it keeps it in `history.state.key`; the first entry has none ('default').
 */
function incomingKey(): string {
  const state = window.history.state as { key?: unknown } | null;
  return typeof state?.key === 'string' ? state.key : 'default';
}

/** `pathname + search` of the window: what decides whether a popstate changes the route. */
function windowRoute(): string {
  return window.location.pathname + window.location.search;
}

/**
 * Connects transitions to React Router's render cycle:
 *
 * - `commit()` resolves once `<ShatterRouteSignal>` has seen a new location
 *   key in a layout effect while the data router (if any) is idle, so the
 *   new route is in the DOM under the overlay.
 * - Back/forward: the router's `popstate` handling is held back (the browser
 *   history itself has already moved) until the outgoing page is captured,
 *   then a `popstate` is dispatched again for the router (ADR-026, ADR-028).
 */
export class RouteBridge {
  /** Longest wait for a render, ms (the provider's `readyTimeout`). */
  timeout: number;
  private key: string | null = null;
  private renderedRoute = '';
  private readonly waiters = new Set<Waiter>();
  private pendingPop = false;
  private releasing = false;
  private inflight = 0;
  /** Last known scroll position of each rendered history entry, by location key. */
  private readonly positions = new Map<string, ScrollPosition>();
  /** Where the held back/forward navigation should end up scrolled, if known. */
  private popTarget: ScrollPosition | null = null;
  /** Scroll position of the page shown while its popstate is held. */
  private heldScroll: ScrollPosition | null = null;
  private restorationBefore: ScrollRestoration | null = null;

  constructor(timeout: number) {
    this.timeout = timeout;
  }

  /**
   * Takes over scroll restoration for history traversals (ADR-030): the
   * browser must not scroll the old page while its popstate is held, so every
   * rendered entry is set to `scrollRestoration = 'manual'`, and the bridge
   * remembers and restores positions itself. Returns the detach function.
   */
  attach(): () => void {
    this.restorationBefore ??= window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const onScroll = (): void => {
      const held = this.heldScroll;
      if (held) {
        // The browser may still apply its own restoration to the held page
        // (Firefox ignores 'manual' on the first entry, ADR-030): undo it.
        // Scroll events run before the next paint, so the jump is never seen.
        if (window.scrollX !== held.x || window.scrollY !== held.y) window.scrollTo(held.x, held.y);
        return;
      }
      if (this.key !== null) this.positions.set(this.key, currentScroll());
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (this.restorationBefore !== null) {
        window.history.scrollRestoration = this.restorationBefore;
        this.restorationBefore = null;
      }
    };
  }

  /** Called by `<ShatterRouteSignal>` after every commit of the router's location. */
  rendered(key: string, idle: boolean): void {
    this.key = key;
    this.renderedRoute = windowRoute();
    // Each history entry has its own mode; set it on every entry we show.
    if (this.restorationBefore !== null) window.history.scrollRestoration = 'manual';
    if (!idle) return;
    for (const waiter of [...this.waiters]) {
      if (waiter.from !== key) {
        this.waiters.delete(waiter);
        waiter.resolve();
      }
    }
  }

  /** True once a signal has reported a location. */
  get connected(): boolean {
    return this.key !== null;
  }

  /** Resolves when a location other than the current one has rendered, or after the timeout. */
  private nextRender(): { promise: Promise<void>; cancel: () => void } {
    let waiter: Waiter | null = null;
    let timer = 0;
    const promise = new Promise<void>((resolve) => {
      const done = (): void => {
        window.clearTimeout(timer);
        resolve();
      };
      waiter = { from: this.key ?? '', resolve: done };
      this.waiters.add(waiter);
      timer = window.setTimeout(() => {
        if (waiter) this.waiters.delete(waiter);
        resolve();
      }, this.timeout);
    });
    return {
      promise,
      cancel: () => {
        window.clearTimeout(timer);
        if (waiter) {
          this.waiters.delete(waiter);
          waiter.resolve();
        }
      },
    };
  }

  /** Runs `navigate` (the router call) and resolves once its route has rendered. */
  commit(navigate: () => unknown): Promise<void> {
    this.releasePop();
    if (this.key !== null) this.positions.set(this.key, currentScroll());
    const next = this.nextRender();
    return boundedCommit(() => {
      const result = navigate();
      // Data routers return a promise that settles when the navigation does;
      // the signal decides when the route is visible, so only errors matter.
      if (result instanceof Promise) result.catch(() => undefined);
      return next.promise;
    }, this.timeout + 50).catch((error: unknown) => {
      next.cancel();
      throw error;
    });
  }

  /** Runs a transition, keeping count so a held-back popstate is never lost. */
  async run(shatter: Shatter, request: TransitionRequest): Promise<void> {
    this.inflight += 1;
    try {
      await shatter.transition(request);
    } finally {
      this.inflight -= 1;
      // A back/forward transition that was superseded before committing, and
      // nothing newer committed it either: hand the popstate to the router now.
      if (this.inflight === 0) this.releasePop();
    }
  }

  /**
   * Called by the popstate gate. Returns true when the router must not see
   * this popstate yet (the gate stops it) and a transition should start.
   * When the router already rendered the new route (its listener ran first),
   * the route matches and the move plays without an effect.
   */
  holdPop(): boolean {
    if (this.releasing || !this.connected) return false;
    // Fragment-only history moves (and moves back to what is shown) keep the route.
    if (!this.pendingPop && windowRoute() === this.renderedRoute) return false;
    if (!this.pendingPop) {
      this.heldScroll = currentScroll();
      if (this.key !== null) this.positions.set(this.key, this.heldScroll);
    }
    this.popTarget = this.positions.get(incomingKey()) ?? null;
    this.pendingPop = true;
    return true;
  }

  /**
   * Runs the back/forward transition one frame later, so that a scroll the
   * browser applies to the held page right after `popstate` has been undone
   * before the capture reads the page.
   */
  async runPop(shatter: Shatter): Promise<void> {
    this.inflight += 1;
    try {
      await nextFrame(window);
      await shatter.transition({ direction: 'back', commit: () => this.commitPop() });
    } finally {
      this.inflight -= 1;
      if (this.inflight === 0) this.releasePop();
    }
  }

  /**
   * The commit of a back/forward transition: let the router see the popstate
   * now, and once the route has rendered, restore the entry's scroll position
   * unless the app (for example React Router's `<ScrollRestoration>`) already
   * scrolled during the render.
   */
  async commitPop(): Promise<void> {
    const changes = windowRoute() !== this.renderedRoute;
    const target = this.popTarget;
    this.popTarget = null;
    const before = currentScroll();
    const next = this.nextRender();
    this.releasePop();
    if (!changes) next.cancel();
    await next.promise;
    const after = currentScroll();
    if (target && after.x === before.x && after.y === before.y) {
      window.scrollTo(target.x, target.y);
    }
  }

  /** Dispatches the held-back popstate, if any, for the router's own listener. */
  releasePop(): void {
    if (!this.pendingPop) return;
    this.pendingPop = false;
    this.heldScroll = null;
    this.releasing = true;
    try {
      window.dispatchEvent(
        new PopStateEvent('popstate', { state: window.history.state as unknown }),
      );
    } finally {
      this.releasing = false;
    }
  }

  /** Provider unmount: nothing may stay held back or waiting. */
  dispose(): void {
    this.releasePop();
    for (const waiter of [...this.waiters]) waiter.resolve();
    this.waiters.clear();
  }
}
