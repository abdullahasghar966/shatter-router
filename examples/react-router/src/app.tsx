import { useEffect, type ReactNode } from 'react';
import { Outlet, Route, Routes, ScrollRestoration, type RouteObject } from 'react-router';
import type { ShatterEventName, ShatterOptions } from 'shatter-router';
import {
  ShatterLink,
  ShatterNavLink,
  ShatterProvider,
  useShatter,
} from 'shatter-router/react-router';
import { About, Home, NotFound, Slow, SlowRoute, Work, slowLoader } from './pages';

declare global {
  interface Window {
    /** Lifecycle events seen so far (debug mode), for the e2e suite. */
    __shatterEvents?: ShatterEventName[];
  }
}

/** Records lifecycle events on `window.__shatterEvents` when debug mode is on. */
function EventLog({ enabled }: { enabled: boolean }): null {
  const shatter = useShatter();
  useEffect(() => {
    if (!enabled || !shatter) return undefined;
    const events: ShatterEventName[] = (window.__shatterEvents ??= []);
    const names: ShatterEventName[] = [
      'start',
      'covered',
      'committed',
      'animating',
      'end',
      'fallback',
    ];
    const offs = names.map((name) => shatter.on(name, () => events.push(name)));
    return () => {
      for (const off of offs) off();
    };
  }, [enabled, shatter]);
  return null;
}

function Layout({ options, dataMode }: { options: ShatterOptions; dataMode: boolean }): ReactNode {
  return (
    <ShatterProvider options={options}>
      <EventLog enabled={Boolean(options.debug)} />
      <header className="site-header">
        <ShatterLink className="brand" to="/">
          Shatter<span>/</span>Router
        </ShatterLink>
        <nav aria-label="Main">
          <ShatterNavLink to="/" end>
            Home
          </ShatterNavLink>
          <ShatterNavLink to="/work">Work</ShatterNavLink>
          <ShatterNavLink to="/about">About</ShatterNavLink>
          <ShatterNavLink to="/slow">Slow</ShatterNavLink>
          <a href="https://github.com/abdullahasghar966/shatter-router" rel="noopener">
            GitHub
          </a>
        </nav>
      </header>
      <main id="app" tabIndex={-1}>
        <Outlet />
      </main>
      <p className="fixed-note">position: fixed</p>
      {dataMode ? <ScrollRestoration /> : null}
    </ShatterProvider>
  );
}

/** Data mode: `createBrowserRouter` routes with a loader on `/slow`. */
export function dataRoutes(options: ShatterOptions): RouteObject[] {
  return [
    {
      path: '/',
      element: <Layout options={options} dataMode />,
      children: [
        { index: true, element: <Home /> },
        { path: 'work', element: <Work /> },
        { path: 'about', element: <About /> },
        { path: 'slow', loader: slowLoader, element: <SlowRoute /> },
        { path: '*', element: <NotFound /> },
      ],
    },
  ];
}

/** Declarative mode: the same pages under `<BrowserRouter>`. */
export function DeclarativeApp({ options }: { options: ShatterOptions }): ReactNode {
  return (
    <Routes>
      <Route path="/" element={<Layout options={options} dataMode={false} />}>
        <Route index element={<Home />} />
        <Route path="work" element={<Work />} />
        <Route path="about" element={<About />} />
        <Route path="slow" element={<Slow />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
