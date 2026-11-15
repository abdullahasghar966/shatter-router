import { act, useEffect, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import {
  BrowserRouter,
  MemoryRouter,
  Outlet,
  Route,
  RouterProvider,
  Routes,
  StaticRouter,
  createMemoryRouter,
  useLocation,
} from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransitionRequest } from '../src/core/types';
import {
  ShatterLink,
  ShatterNavLink,
  ShatterProvider,
  createShatterBrowserRouter,
  useShatterNavigate,
  type ShatterNavigateFunction,
} from '../src/react-router/index';
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

async function render(node: Parameters<typeof mount>[0]): Promise<Mounted> {
  const result = await mount(node);
  mounted.push(result);
  return result;
}

afterEach(async () => {
  for (const item of mounted.splice(0)) await item.unmount();
  document.body.innerHTML = '';
});

function heading(container: HTMLElement): string {
  return container.querySelector('h1')?.textContent ?? '';
}

/** Makes the fake record what the page showed when each commit resolved. */
function recordShownAtCommit(shatter: FakeShatter, container: HTMLElement): string[] {
  const shown: string[] = [];
  shatter.transition = vi.fn(async (request: TransitionRequest) => {
    shatter.requests.push(request);
    await request.commit();
    shown.push(heading(container));
  });
  return shown;
}

function Nav(): ReactNode {
  return (
    <nav>
      <ShatterLink to="/">Home</ShatterLink>
      <ShatterLink to="/about">About</ShatterLink>
      <ShatterNavLink to="/work" className={({ isActive }) => (isActive ? 'active' : '')}>
        Work
      </ShatterNavLink>
    </nav>
  );
}

function page(title: string): ReactNode {
  return <h1>{title}</h1>;
}

describe('React Router adapter, declarative mode', () => {
  function App({ shatter, children }: { shatter: FakeShatter; children?: ReactNode }): ReactNode {
    return (
      <ShatterProvider instance={shatter}>
        {children}
        <Nav />
        <Routes>
          <Route path="/" element={page('Home')} />
          <Route path="/about" element={page('About')} />
          <Route path="/work" element={page('Work')} />
        </Routes>
      </ShatterProvider>
    );
  }

  it('server-renders real links', () => {
    const html = renderToString(
      <StaticRouter location="/">
        <ShatterProvider>
          <ShatterLink to="/about">About</ShatterLink>
        </ShatterProvider>
      </StaticRouter>,
    );
    expect(html).toContain('href="/about"');
  });

  it('resolves the commit only once the new route is in the DOM', async () => {
    const shatter = fakeShatter();
    const { container } = await render(
      <MemoryRouter>
        <App shatter={shatter} />
      </MemoryRouter>,
    );
    const shown = recordShownAtCommit(shatter, container);
    expect(heading(container)).toBe('Home');
    expect(await click(anchor(container, 'About'), { clientX: 12, clientY: 34 })).toBe(true);
    await settle();
    expect(shown).toEqual(['About']);
    expect(shatter.requests[0]?.origin).toEqual({ x: 12, y: 34 });
  });

  it('works with NavLink and keeps its active class', async () => {
    const shatter = fakeShatter();
    const { container } = await render(
      <MemoryRouter>
        <App shatter={shatter} />
      </MemoryRouter>,
    );
    const shown = recordShownAtCommit(shatter, container);
    await click(anchor(container, 'Work'));
    await settle();
    expect(shown).toEqual(['Work']);
    expect(anchor(container, 'Work').className).toBe('active');
  });

  it('leaves modifier clicks to the browser', async () => {
    const shatter = fakeShatter();
    const { container } = await render(
      <MemoryRouter>
        <App shatter={shatter} />
      </MemoryRouter>,
    );
    expect(await click(anchor(container, 'About'), { metaKey: true })).toBe(false);
    expect(await click(anchor(container, 'About'), { button: 1 })).toBe(false);
    await settle();
    expect(shatter.requests).toHaveLength(0);
    expect(heading(container)).toBe('Home');
  });

  it('does not intercept reloadDocument links', async () => {
    const shatter = fakeShatter();
    const { container } = await render(
      <MemoryRouter>
        <ShatterProvider instance={shatter}>
          <ShatterLink to="/about" reloadDocument>
            About
          </ShatterLink>
        </ShatterProvider>
      </MemoryRouter>,
    );
    expect(await click(anchor(container, 'About'))).toBe(false);
    expect(shatter.requests).toHaveLength(0);
  });

  it('replaces the entry for a link to the current location, like <Link>', async () => {
    const shatter = fakeShatter();
    const actions: string[] = [];
    function Spy(): null {
      const location = useLocation();
      useEffect(() => {
        actions.push(location.key);
      }, [location]);
      return null;
    }
    const { container } = await render(
      <MemoryRouter initialEntries={['/about']}>
        <App shatter={shatter} />
        <Spy />
      </MemoryRouter>,
    );
    await click(anchor(container, 'About'));
    await settle();
    expect(shatter.committed).toHaveLength(1);
    expect(actions).toHaveLength(2);
  });

  it('useShatterNavigate passes effect and origin', async () => {
    const shatter = fakeShatter();
    let go: ShatterNavigateFunction | null = null;
    function Probe(): null {
      go = useShatterNavigate();
      return null;
    }
    const { container } = await render(
      <MemoryRouter>
        <App shatter={shatter}>
          <Probe />
        </App>
      </MemoryRouter>,
    );
    const shown = recordShownAtCommit(shatter, container);
    await settle();
    const navigate = go as unknown as ShatterNavigateFunction;
    // act() holds renders until its callback returns, and the commit waits for
    // the render: start the navigation inside act, await it afterwards.
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = navigate('/work', { effect: 'implode', origin: { x: 1, y: 2 } });
    });
    await settle();
    await done;
    expect(shown).toEqual(['Work']);
    expect(shatter.requests[0]?.effect).toBe('implode');
    expect(shatter.requests[0]?.origin).toEqual({ x: 1, y: 2 });
  });
});

describe('React Router adapter, data mode', () => {
  function Root({
    shatter,
    readyTimeout,
  }: {
    shatter: FakeShatter;
    readyTimeout?: number;
  }): ReactNode {
    return (
      <ShatterProvider instance={shatter} options={readyTimeout ? { readyTimeout } : {}}>
        <Nav />
        <ShatterLink to="/slow">Slow</ShatterLink>
        <Outlet />
      </ShatterProvider>
    );
  }

  it('waits for the loader and the render before resolving the commit', async () => {
    const shatter = fakeShatter();
    let release: () => void = () => undefined;
    const loaderDone = new Promise<void>((resolve) => {
      release = resolve;
    });
    const router = createMemoryRouter([
      {
        path: '/',
        element: <Root shatter={shatter} />,
        children: [
          { index: true, element: page('Home') },
          {
            path: 'slow',
            loader: async () => {
              await loaderDone;
              return null;
            },
            element: page('Slow'),
          },
        ],
      },
    ]);
    const { container } = await render(<RouterProvider router={router} />);
    const shown = recordShownAtCommit(shatter, container);
    await click(anchor(container, 'Slow'));
    await settle(30);
    expect(shown).toEqual([]);
    expect(heading(container)).toBe('Home');
    release();
    await settle(10);
    expect(shown).toEqual(['Slow']);
  });

  it('gives up waiting after readyTimeout so the overlay never hangs', async () => {
    const shatter = fakeShatter();
    const router = createMemoryRouter([
      {
        path: '/',
        // Wide margins: under CPU load (parallel test files) timers fire late.
        element: <Root shatter={shatter} readyTimeout={300} />,
        children: [
          { index: true, element: page('Home') },
          { path: 'slow', loader: () => new Promise(() => undefined), element: page('Slow') },
        ],
      },
    ]);
    const { container } = await render(<RouterProvider router={router} />);
    const shown = recordShownAtCommit(shatter, container);
    await click(anchor(container, 'Slow'));
    await settle(30);
    expect(shown).toEqual([]);
    await settle(450);
    expect(shown).toEqual(['Home']);
  });
});

describe('React Router adapter, back/forward', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('holds the popstate until captured, then lets the router render', async () => {
    const shatter = fakeShatter();
    const shownAtStart: string[] = [];
    const { container } = await render(
      <BrowserRouter>
        <ShatterProvider instance={shatter}>
          <Nav />
          <Routes>
            <Route path="/" element={page('Home')} />
            <Route path="/about" element={page('About')} />
            <Route path="/work" element={page('Work')} />
          </Routes>
        </ShatterProvider>
      </BrowserRouter>,
    );
    await click(anchor(container, 'About'));
    await settle();
    expect(heading(container)).toBe('About');
    expect(window.location.pathname).toBe('/about');

    let commitShown = '';
    shatter.transition = vi.fn(async (request: TransitionRequest) => {
      shatter.requests.push(request);
      // At transition start the router must not have rendered the old route yet.
      shownAtStart.push(heading(container));
      await request.commit();
      commitShown = heading(container);
    });
    window.history.back();
    await settle(50);
    expect(window.location.pathname).toBe('/');
    expect(shatter.requests.at(-1)?.direction).toBe('back');
    expect(shownAtStart).toEqual(['About']);
    expect(commitShown).toBe('Home');
    expect(heading(container)).toBe('Home');
  });

  it('data mode with createShatterBrowserRouter: back is held until captured', async () => {
    const shatter = fakeShatter();
    const router = createShatterBrowserRouter([
      {
        path: '/',
        element: (
          <ShatterProvider instance={shatter}>
            <Nav />
            <Outlet />
          </ShatterProvider>
        ),
        children: [
          { index: true, element: page('Home') },
          { path: 'about', element: page('About') },
        ],
      },
    ]);
    const { container } = await render(<RouterProvider router={router} />);
    await click(anchor(container, 'About'));
    await settle();
    expect(heading(container)).toBe('About');

    const shownAtStart: string[] = [];
    let commitShown = '';
    shatter.transition = vi.fn(async (request: TransitionRequest) => {
      shatter.requests.push(request);
      shownAtStart.push(heading(container));
      await request.commit();
      commitShown = heading(container);
    });
    window.history.back();
    await settle(50);
    expect(shownAtStart).toEqual(['About']);
    expect(commitShown).toBe('Home');
    router.dispose();
  });

  it('keeps scroll restoration manual and restores the entry position on back', async () => {
    const shatter = fakeShatter();
    window.history.scrollRestoration = 'auto';
    const app = await mount(
      <BrowserRouter>
        <ShatterProvider instance={shatter}>
          <Nav />
          <Routes>
            <Route path="/" element={page('Home')} />
            <Route path="/about" element={page('About')} />
          </Routes>
        </ShatterProvider>
      </BrowserRouter>,
    );
    expect(window.history.scrollRestoration).toBe('manual');
    window.scrollTo(0, 120);
    await click(anchor(app.container, 'About'));
    await settle();
    window.scrollTo(0, 0); // the runtime scrolls a forward navigation to the top
    window.history.back();
    await settle(50);
    expect(heading(app.container)).toBe('Home');
    expect(window.scrollY).toBe(120);
    await app.unmount();
    expect(window.history.scrollRestoration).toBe('auto');
  });

  it('ignores hash-only history moves', async () => {
    const shatter = fakeShatter();
    const { container } = await render(
      <BrowserRouter>
        <ShatterProvider instance={shatter}>
          <Routes>
            <Route path="/" element={page('Home')} />
          </Routes>
        </ShatterProvider>
      </BrowserRouter>,
    );
    window.history.pushState(null, '', '/#part');
    window.history.back();
    await settle(50);
    expect(shatter.requests).toHaveLength(0);
    expect(heading(container)).toBe('Home');
  });
});
