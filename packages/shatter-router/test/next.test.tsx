import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
  PathnameContext,
  SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { act, useMemo, useState, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransitionRequest } from '../src/core/types';
import {
  PENDING_ATTRIBUTE,
  ShatterLink,
  ShatterProvider,
  useShatterNavigate,
  type ShatterNavigateFunction,
  type WaitFor,
} from '../src/next/index';
import { waitForSettled } from '../src/next/settled';
import {
  anchor,
  click,
  fakeShatter,
  mount,
  settle,
  type FakeShatter,
  type Mounted,
} from './helpers/react';

const mounted: Mounted[] = [];

afterEach(async () => {
  for (const item of mounted.splice(0)) await item.unmount();
  document.body.innerHTML = '';
});

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

/** Routes of the fake app; `/slow` shows a pending loading UI first. */
function Page({ pathname, loading }: { pathname: string; loading: boolean }): ReactNode {
  if (loading) return <p {...{ [PENDING_ATTRIBUTE]: '' }}>Loading…</p>;
  const titles: Record<string, string> = { '/': 'Home', '/about': 'About', '/slow': 'Slow' };
  return <h1>{titles[pathname] ?? 'Not found'}</h1>;
}

interface FakeApp {
  readonly pushes: string[];
}

/**
 * A stand-in for the App Router: provides the contexts `useRouter`,
 * `usePathname` and `useSearchParams` read, renders asynchronously like a
 * transition, and shows a loading state for `/slow` for `slowMs`.
 */
function NextApp({
  children,
  app,
  slowMs = 40,
}: {
  children: (pathname: string, loading: boolean) => ReactNode;
  app: FakeApp;
  slowMs?: number;
}): ReactNode {
  const [url, setUrl] = useState(() => new URL(window.location.href));
  const [loading, setLoading] = useState(false);
  const router = useMemo<AppRouterInstance>(() => {
    const go = (href: string, replace: boolean): void => {
      app.pushes.push(href);
      const next = new URL(href, window.location.href);
      setTimeout(() => {
        if (replace) window.history.replaceState({ __NA: true }, '', next);
        else window.history.pushState({ __NA: true }, '', next);
        setUrl(next);
        if (next.pathname === '/slow') {
          setLoading(true);
          setTimeout(() => {
            setLoading(false);
          }, slowMs);
        }
      }, 5);
    };
    return {
      back: () => {
        window.history.back();
      },
      forward: () => {
        window.history.forward();
      },
      refresh: () => undefined,
      push: (href) => {
        go(href, false);
      },
      replace: (href) => {
        go(href, true);
      },
      prefetch: () => undefined,
      bfcacheId: 'test',
    };
  }, [app, slowMs]);
  return (
    <AppRouterContext.Provider value={router}>
      <PathnameContext.Provider value={url.pathname}>
        <SearchParamsContext.Provider value={url.searchParams}>
          {children(url.pathname, loading)}
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  );
}

async function renderApp(
  shatter: FakeShatter,
  waitFor: WaitFor = 'settled',
  extra?: ReactNode,
): Promise<{ container: HTMLElement; app: FakeApp }> {
  const app: FakeApp = { pushes: [] };
  const result = await mount(
    <NextApp app={app}>
      {(pathname, loading) => (
        <ShatterProvider instance={shatter} waitFor={waitFor}>
          <nav>
            <ShatterLink href="/">Home</ShatterLink>
            <ShatterLink href="/about">About</ShatterLink>
            <ShatterLink href="/slow">Slow</ShatterLink>
          </nav>
          {extra}
          <main>
            <Page pathname={pathname} loading={loading} />
          </main>
        </ShatterProvider>
      )}
    </NextApp>,
  );
  mounted.push(result);
  return { container: result.container, app };
}

function shown(container: HTMLElement): string {
  return container.querySelector('main')?.textContent ?? '';
}

function recordShownAtCommit(shatter: FakeShatter, container: HTMLElement): string[] {
  const seen: string[] = [];
  shatter.transition = vi.fn(async (request: TransitionRequest) => {
    shatter.requests.push(request);
    await request.commit();
    seen.push(shown(container));
  });
  return seen;
}

describe('Next.js adapter', () => {
  it('server-renders a real link', () => {
    const app: FakeApp = { pushes: [] };
    const html = renderToString(
      <NextApp app={app}>
        {() => (
          <ShatterProvider>
            <ShatterLink href="/about">About</ShatterLink>
          </ShatterProvider>
        )}
      </NextApp>,
    );
    expect(html).toContain('href="/about"');
  });

  it('pushes with scroll: false and resolves once the new route rendered', async () => {
    const shatter = fakeShatter();
    const { container, app } = await renderApp(shatter);
    const seen = recordShownAtCommit(shatter, container);
    expect(await click(anchor(container, 'About'), { clientX: 3, clientY: 4 })).toBe(true);
    await settle(30);
    expect(app.pushes).toEqual(['/about']);
    expect(seen).toEqual(['About']);
    expect(shatter.requests[0]?.origin).toEqual({ x: 3, y: 4 });
  });

  it("waitFor 'settled' waits for [data-shatter-pending] to go", async () => {
    const shatter = fakeShatter();
    const { container } = await renderApp(shatter, 'settled');
    const seen = recordShownAtCommit(shatter, container);
    await click(anchor(container, 'Slow'));
    await settle(20);
    expect(seen).toEqual([]);
    await settle(60);
    expect(seen).toEqual(['Slow']);
  });

  it("waitFor 'commit' resolves on the loading UI", async () => {
    const shatter = fakeShatter();
    const { container } = await renderApp(shatter, 'commit');
    const seen = recordShownAtCommit(shatter, container);
    await click(anchor(container, 'Slow'));
    await settle(20);
    expect(seen).toEqual(['Loading…']);
  });

  it('leaves modifier clicks to the browser', async () => {
    const shatter = fakeShatter();
    const { container, app } = await renderApp(shatter);
    expect(await click(anchor(container, 'About'), { ctrlKey: true })).toBe(false);
    expect(await click(anchor(container, 'About'), { button: 1 })).toBe(false);
    await settle(20);
    expect(shatter.requests).toHaveLength(0);
    expect(app.pushes).toEqual([]);
  });

  it('a link to the current URL does not wait for a render that never comes', async () => {
    const shatter = fakeShatter();
    const { container } = await renderApp(shatter);
    const started = performance.now();
    await click(anchor(container, 'Home'));
    await settle(80);
    expect(shatter.committed).toHaveLength(1);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('useShatterNavigate passes effect, origin and replace', async () => {
    const shatter = fakeShatter();
    let go: ShatterNavigateFunction | null = null;
    function Probe(): null {
      go = useShatterNavigate();
      return null;
    }
    const { container, app } = await renderApp(shatter, 'settled', <Probe />);
    const seen = recordShownAtCommit(shatter, container);
    const navigate = go as unknown as ShatterNavigateFunction;
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = navigate('/about', { effect: 'implode', origin: { x: 1, y: 2 }, replace: true });
    });
    await settle(30);
    await done;
    expect(seen).toEqual(['About']);
    expect(app.pushes).toEqual(['/about']);
    expect(shatter.requests[0]?.effect).toBe('implode');
  });

  it('holds back/forward until captured, then lets the router render', async () => {
    const shatter = fakeShatter();
    const { container } = await renderApp(shatter);
    // A stand-in for the App Router's own popstate listener (added after the gate).
    const onPop = (): void => {
      window.dispatchEvent(new CustomEvent('test-router-pop'));
    };
    window.addEventListener('popstate', onPop);
    await click(anchor(container, 'About'));
    await settle(30);
    expect(shown(container)).toBe('About');

    const atStart: string[] = [];
    let routerSawPopAtStart = false;
    let routerSawPop = false;
    window.addEventListener('test-router-pop', () => {
      routerSawPop = true;
    });
    shatter.transition = vi.fn(async (request: TransitionRequest) => {
      shatter.requests.push(request);
      atStart.push(shown(container));
      routerSawPopAtStart = routerSawPop;
      await request.commit();
    });
    window.history.back();
    await settle(60);
    window.removeEventListener('popstate', onPop);
    expect(shatter.requests.at(-1)?.direction).toBe('back');
    expect(atStart).toEqual(['About']);
    expect(routerSawPopAtStart).toBe(false);
    expect(routerSawPop).toBe(true);
  });
});

describe('waitForSettled', () => {
  it('resolves at once without markers, after removal with markers, or at the timeout', async () => {
    await waitForSettled(document, 1000);
    const marker = document.createElement('div');
    marker.setAttribute(PENDING_ATTRIBUTE, '');
    document.body.append(marker);
    const pending = waitForSettled(document, 1000);
    setTimeout(() => {
      marker.removeAttribute(PENDING_ATTRIBUTE);
    }, 10);
    await pending;
    marker.setAttribute(PENDING_ATTRIBUTE, '');
    const started = performance.now();
    await waitForSettled(document, 30);
    expect(performance.now() - started).toBeGreaterThanOrEqual(25);
  });
});
