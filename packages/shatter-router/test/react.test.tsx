import { StrictMode, useEffect, useState, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Shatter, TransitionRequest } from '../src/core/types';
import {
  ShatterLink,
  ShatterProvider,
  useShatter,
  useShatterNavigate,
  type ShatterNavigateFunction,
} from '../src/react/index';
import { boundedCommit } from '../src/react/shared';
import { anchor, click, fakeShatter, mount, settle, type Mounted } from './helpers/react';

const mounted: Mounted[] = [];

async function render(node: Parameters<typeof mount>[0]): Promise<Mounted> {
  const result = await mount(node);
  mounted.push(result);
  return result;
}

afterEach(async () => {
  for (const item of mounted.splice(0)) await item.unmount();
  document.body.innerHTML = '';
});

describe('ShatterLink (shatter-router/react)', () => {
  it('server-renders a plain <a href> without touching the DOM APIs', () => {
    const html = renderToString(
      <ShatterProvider navigate={() => undefined}>
        <ShatterLink href="/about" className="nav">
          About
        </ShatterLink>
      </ShatterProvider>,
    );
    expect(html).toBe('<a class="nav" href="/about">About</a>');
  });

  it('intercepts a plain primary click and commits through the router', async () => {
    const shatter = fakeShatter();
    const navigate = vi.fn();
    const { container } = await render(
      <ShatterProvider instance={shatter} navigate={navigate}>
        <ShatterLink href="/about" state={{ from: 'home' }}>
          About
        </ShatterLink>
      </ShatterProvider>,
    );
    const prevented = await click(anchor(container, 'About'), { clientX: 30, clientY: 40 });
    await settle();
    expect(prevented).toBe(true);
    expect(shatter.requests).toHaveLength(1);
    expect(shatter.requests[0]?.origin).toEqual({ x: 30, y: 40 });
    expect(navigate).toHaveBeenCalledWith('/about', { replace: false, state: { from: 'home' } });
    expect(shatter.committed).toHaveLength(1);
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
    ['middle button', { button: 1 }],
  ])('keeps native behaviour for a %s click', async (_name, init) => {
    const shatter = fakeShatter();
    const { container } = await render(
      <ShatterProvider instance={shatter} navigate={() => undefined}>
        <ShatterLink href="/about">About</ShatterLink>
      </ShatterProvider>,
    );
    expect(await click(anchor(container, 'About'), init)).toBe(false);
    expect(shatter.requests).toHaveLength(0);
  });

  it.each([
    ['target="_blank"', { href: '/about', target: '_blank' }],
    ['download', { href: '/file.pdf', download: '' }],
    ['an external origin', { href: 'https://elsewhere.example/' }],
    ['a same-page hash', { href: '#section' }],
    ['a mailto link', { href: 'mailto:someone@example.com' }],
  ])('keeps native behaviour for %s', async (_name, props) => {
    const shatter = fakeShatter();
    const { container } = await render(
      <ShatterProvider instance={shatter} navigate={() => undefined}>
        <ShatterLink {...props}>Link</ShatterLink>
      </ShatterProvider>,
    );
    expect(await click(anchor(container, 'Link'))).toBe(false);
    expect(shatter.requests).toHaveLength(0);
  });

  it('honours data-shatter="off" on an ancestor', async () => {
    const shatter = fakeShatter();
    const { container } = await render(
      <ShatterProvider instance={shatter} navigate={() => undefined}>
        <nav data-shatter="off">
          <ShatterLink href="/about">About</ShatterLink>
        </nav>
      </ShatterProvider>,
    );
    expect(await click(anchor(container, 'About'))).toBe(false);
    expect(shatter.requests).toHaveLength(0);
  });

  it('runs the app onClick first and respects its preventDefault', async () => {
    const shatter = fakeShatter();
    const order: string[] = [];
    const { container } = await render(
      <ShatterProvider instance={shatter} navigate={() => undefined}>
        <ShatterLink
          href="/a"
          onClick={() => {
            order.push('app');
          }}
        >
          A
        </ShatterLink>
        <ShatterLink
          href="/b"
          onClick={(event) => {
            event.preventDefault();
          }}
        >
          B
        </ShatterLink>
      </ShatterProvider>,
    );
    await click(anchor(container, 'A'));
    expect(order).toEqual(['app']);
    expect(shatter.requests).toHaveLength(1);
    await click(anchor(container, 'B'));
    expect(shatter.requests).toHaveLength(1);
  });

  it('is a plain link when no router is connected', async () => {
    const shatter = fakeShatter();
    const { container } = await render(
      <ShatterProvider instance={shatter}>
        <ShatterLink href="/about">About</ShatterLink>
      </ShatterProvider>,
    );
    expect(await click(anchor(container, 'About'))).toBe(false);
    expect(shatter.requests).toHaveLength(0);
  });

  it('uses the effect prop, else data-shatter-effect, else the default', async () => {
    const shatter = fakeShatter();
    const { container } = await render(
      <ShatterProvider instance={shatter} navigate={() => undefined}>
        <div data-shatter-effect="implode">
          <ShatterLink href="/a">A</ShatterLink>
          <ShatterLink href="/b" effect="explode">
            B
          </ShatterLink>
        </div>
        <ShatterLink href="/c">C</ShatterLink>
      </ShatterProvider>,
    );
    await click(anchor(container, 'A'));
    await click(anchor(container, 'B'));
    await click(anchor(container, 'C'));
    await settle();
    expect(shatter.requests.map((request) => request.effect)).toEqual([
      'implode',
      'explode',
      undefined,
    ]);
  });

  it('breaks from the centre of the link on keyboard activation', async () => {
    const shatter = fakeShatter();
    const { container } = await render(
      <ShatterProvider instance={shatter} navigate={() => undefined}>
        <ShatterLink href="/about">About</ShatterLink>
      </ShatterProvider>,
    );
    const link = anchor(container, 'About');
    link.getBoundingClientRect = () => new DOMRect(100, 50, 80, 20);
    await click(link, { detail: 0, clientX: 0, clientY: 0 });
    expect(shatter.requests[0]?.origin).toEqual({ x: 140, y: 60 });
  });

  it('forwards refs and anchor attributes', async () => {
    let element: HTMLAnchorElement | null = null;
    const { container } = await render(
      <ShatterProvider navigate={() => undefined}>
        <ShatterLink
          href="/about"
          aria-current="page"
          ref={(node) => {
            element = node;
          }}
        >
          About
        </ShatterLink>
      </ShatterProvider>,
    );
    expect(element).toBe(anchor(container, 'About'));
    expect(anchor(container, 'About').getAttribute('aria-current')).toBe('page');
  });
});

describe('ShatterProvider and hooks (shatter-router/react)', () => {
  it('creates one instance after mount and destroys it on unmount, also under StrictMode', async () => {
    const seen: (Shatter | null)[] = [];
    function Probe(): null {
      const shatter = useShatter();
      useEffect(() => {
        seen.push(shatter);
      }, [shatter]);
      return null;
    }
    const app = await mount(
      <StrictMode>
        <ShatterProvider options={{ precapture: false }}>
          <Probe />
        </ShatterProvider>
      </StrictMode>,
    );
    const live = seen.at(-1);
    expect(seen[0]).toBeNull();
    expect(live).not.toBeNull();
    expect(live?.state).toBe('idle');
    await app.unmount();
    // A destroyed instance commits plainly instead of running a transition.
    const commit = vi.fn();
    await live?.transition({ commit });
    expect(commit).toHaveBeenCalledOnce();
  });

  it('never destroys a caller-owned instance', async () => {
    const shatter = fakeShatter();
    const app = await mount(<ShatterProvider instance={shatter} />);
    await app.unmount();
    expect(shatter.destroyCount).toBe(0);
  });

  it('useShatterNavigate passes effect, origin and replace', async () => {
    const shatter = fakeShatter();
    const navigate = vi.fn();
    let go: ShatterNavigateFunction | null = null;
    function Probe(): null {
      go = useShatterNavigate();
      return null;
    }
    await render(
      <ShatterProvider instance={shatter} navigate={navigate}>
        <Probe />
      </ShatterProvider>,
    );
    expect(go).not.toBeNull();
    await (go as unknown as ShatterNavigateFunction)('/work', {
      effect: 'implode',
      origin: { x: 5, y: 6 },
      replace: true,
    });
    expect(shatter.requests[0]?.effect).toBe('implode');
    expect(shatter.requests[0]?.origin).toEqual({ x: 5, y: 6 });
    expect(shatter.requests[0]?.replace).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/work', { replace: true, state: undefined });
  });

  it('flushes a synchronous state update before the commit resolves', async () => {
    const shatter = fakeShatter();
    let setPage: ((page: string) => void) | null = null;
    let shownAtCommit = '';
    function App(): ReactNode {
      const [page, set] = useState('home');
      setPage = set;
      return <h1>{page}</h1>;
    }
    const { container } = await render(
      <ShatterProvider
        instance={shatter}
        navigate={(href) => {
          setPage?.(href);
        }}
      >
        <App />
        <ShatterLink href="/about">About</ShatterLink>
      </ShatterProvider>,
    );
    shatter.transition = vi.fn(async (request: TransitionRequest) => {
      await request.commit();
      shownAtCommit = container.querySelector('h1')?.textContent ?? '';
    });
    await click(anchor(container, 'About'));
    await settle();
    expect(shownAtCommit).toBe('/about');
  });
});

describe('boundedCommit', () => {
  it('resolves after the timeout when the router never renders', async () => {
    const started = performance.now();
    await boundedCommit(() => new Promise(() => undefined), 30);
    expect(performance.now() - started).toBeGreaterThanOrEqual(25);
  });

  it('passes errors on, thrown or rejected', async () => {
    await expect(
      boundedCommit(() => {
        throw new Error('sync');
      }, 100),
    ).rejects.toThrow('sync');
    await expect(boundedCommit(() => Promise.reject(new Error('async')), 100)).rejects.toThrow(
      'async',
    );
  });
});
