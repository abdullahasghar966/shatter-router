import type { Shatter, TransitionRequest } from '../core/types';
import { boundedCommit } from '../react/shared';

interface Waiter {
  readonly from: string;
  readonly resolve: () => void;
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
 *   then a `popstate` is dispatched again for the router (ADR-026).
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

  constructor(timeout: number) {
    this.timeout = timeout;
  }

  /** Called by `<ShatterRouteSignal>` after every commit of the router's location. */
  rendered(key: string, idle: boolean): void {
    this.key = key;
    this.renderedRoute = windowRoute();
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
   * The capture-phase `popstate` listener. Returns true when the event was
   * held back and a transition should start.
   */
  holdPop(event: PopStateEvent): boolean {
    if (this.releasing || !this.connected) return false;
    // Fragment-only history moves (and moves back to what is shown) keep the route.
    if (!this.pendingPop && windowRoute() === this.renderedRoute) return false;
    event.stopImmediatePropagation();
    this.pendingPop = true;
    return true;
  }

  /** The commit of a back/forward transition: let the router see the popstate now. */
  commitPop(): Promise<void> {
    const changes = windowRoute() !== this.renderedRoute;
    const next = this.nextRender();
    this.releasePop();
    if (!changes) next.cancel();
    return next.promise;
  }

  /** Dispatches the held-back popstate, if any, for the router's own listener. */
  releasePop(): void {
    if (!this.pendingPop) return;
    this.pendingPop = false;
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
