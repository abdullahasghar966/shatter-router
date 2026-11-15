import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteBridge } from '../src/react/route-bridge';

/** Pretends the document is `height` px tall in a 600 px viewport (happy-dom has no layout). */
function setPageHeight(height: number): void {
  const root = document.scrollingElement ?? document.documentElement;
  Object.defineProperty(root, 'scrollHeight', { configurable: true, get: () => height });
  Object.defineProperty(root, 'clientHeight', { configurable: true, get: () => 600 });
  Object.defineProperty(root, 'scrollWidth', { configurable: true, get: () => 1280 });
  Object.defineProperty(root, 'clientWidth', { configurable: true, get: () => 1280 });
}

function scrollTo(y: number): void {
  window.scrollTo(0, y);
  window.dispatchEvent(new Event('scroll'));
}

/**
 * A stand-in router: on popstate it renders the entry the browser is on (and
 * may scroll). As in a browser, the scroll event fires after the render.
 */
function routerOnPop(bridge: RouteBridge, render: () => void): () => void {
  const onPop = (): void => {
    render();
    bridge.rendered(`token-${entry}`, true);
    window.dispatchEvent(new Event('scroll'));
  };
  window.addEventListener('popstate', onPop);
  return () => {
    window.removeEventListener('popstate', onPop);
  };
}

let entry = 'A';
let detach: (() => void) | null = null;
let stopRouter: (() => void) | null = null;

function setup(): RouteBridge {
  const bridge = new RouteBridge(200, () => entry);
  detach = bridge.attach();
  return bridge;
}

/** The browser moving to `name`'s history entry (URL and entry key). */
function moveTo(name: string): void {
  entry = name;
  window.history.replaceState(null, '', `/${name.toLowerCase()}`);
}

/** Renders entry A at 300 px, then navigates (forward) to entry B at 0 px. */
async function visitAThenB(bridge: RouteBridge): Promise<void> {
  moveTo('A');
  setPageHeight(2000);
  bridge.rendered('token-A', true);
  scrollTo(300);
  await bridge.commit(() => {
    moveTo('B');
    setTimeout(() => {
      bridge.rendered('token-B', true);
    }, 5);
  });
  // The runtime scrolls a forward navigation to the top under the overlay.
  scrollTo(0);
}

beforeEach(() => {
  entry = 'A';
  window.scrollTo(0, 0);
});

afterEach(() => {
  stopRouter?.();
  stopRouter = null;
  detach?.();
  detach = null;
});

describe('RouteBridge scroll restoration (ADR-030, ADR-035)', () => {
  it('restores the entry position when the page only clamped the old one', async () => {
    const bridge = setup();
    await visitAThenB(bridge);
    // Back to A (300 px), then forward to B on a page too short for 300 px.
    moveTo('A');
    expect(bridge.holdPop()).toBe(true);
    stopRouter = routerOnPop(bridge, () => {
      window.scrollTo(0, 300);
    });
    await bridge.commitPop();
    expect(window.scrollY).toBe(300);
    stopRouter();

    moveTo('B');
    expect(bridge.holdPop()).toBe(true);
    stopRouter = routerOnPop(bridge, () => {
      setPageHeight(690); // max scroll 90: the browser clamps 300 to 90
      window.scrollTo(0, 90);
    });
    await bridge.commitPop();
    expect(window.scrollY).toBe(0);
  });

  it('leaves a position the app chose alone', async () => {
    const bridge = setup();
    await visitAThenB(bridge);
    moveTo('A');
    expect(bridge.holdPop()).toBe(true);
    stopRouter = routerOnPop(bridge, () => {
      window.scrollTo(0, 50); // e.g. <ScrollRestoration> with its own key
    });
    await bridge.commitPop();
    expect(window.scrollY).toBe(50);
  });

  it('keeps manual scroll restoration while attached and restores the old mode', () => {
    window.history.scrollRestoration = 'auto';
    const bridge = setup();
    expect(window.history.scrollRestoration).toBe('manual');
    bridge.rendered('token-A', true);
    detach?.();
    detach = null;
    expect(window.history.scrollRestoration).toBe('auto');
  });
});

describe('RouteBridge commits', () => {
  it('a navigation that keeps the route resolves after two frames, not at the timeout', async () => {
    const bridge = setup();
    bridge.rendered('token-A', true);
    const started = performance.now();
    await bridge.commit(() => undefined, { changesRoute: false });
    expect(performance.now() - started).toBeLessThan(150);
  });

  it('a navigation that never renders resolves at the timeout', async () => {
    const bridge = setup();
    bridge.rendered('token-A', true);
    const started = performance.now();
    await bridge.commit(() => undefined);
    expect(performance.now() - started).toBeGreaterThanOrEqual(190);
  });

  it('scrolls a #fragment into view after the render', async () => {
    const bridge = setup();
    bridge.rendered('token-A', true);
    const target = document.createElement('section');
    target.id = 'part two';
    const spy = vi.fn();
    target.scrollIntoView = spy;
    document.body.append(target);
    await bridge.commit(
      () => {
        setTimeout(() => {
          bridge.rendered('token-B', true);
        }, 5);
      },
      { hash: '#part%20two' },
    );
    expect(spy).toHaveBeenCalledOnce();
    target.remove();
  });
});
