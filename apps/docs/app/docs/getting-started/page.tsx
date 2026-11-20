import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';
import { Code } from '../../code';

export const metadata: Metadata = { title: 'Getting started' };

export default function GettingStarted(): ReactNode {
  return (
    <>
      <p className="kicker">Docs</p>
      <h1>Getting started</h1>
      <p className="lede">One package, four entry points. Pick the one that matches your router.</p>
      <Code lang="sh">{`pnpm add shatter-router   # or npm install / yarn add`}</Code>
      <p>
        Add <code>scrollbar-gutter: stable</code> to your root element so the page keeps its width
        while the glass is up:
      </p>
      <Code lang="css">{`html { scrollbar-gutter: stable; }`}</Code>

      <h2 id="nextjs">Next.js (App Router)</h2>
      <p>
        Wrap your root layout in <code>ShatterProvider</code> and use <code>ShatterLink</code>{' '}
        wherever you used <code>next/link</code>. Back and forward shatter too.
      </p>
      <Code lang="tsx">{`
// app/layout.tsx
import { ShatterProvider } from 'shatter-router/next';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ShatterProvider options={{ effect: 'shatter' }}>{children}</ShatterProvider>
      </body>
    </html>
  );
}

// anywhere
import { ShatterLink } from 'shatter-router/next';

<ShatterLink href="/work">Work</ShatterLink>
<ShatterLink href="/about" effect="flip">About</ShatterLink>
`}</Code>
      <p>
        By default the effect waits until the new route has settled, including{' '}
        <code>loading.tsx</code> boundaries. Mark content that is still loading with{' '}
        <code>data-shatter-pending</code>, or pass <code>waitFor=&quot;commit&quot;</code> to
        animate as soon as the route has rendered.
      </p>

      <h2 id="react-router">React Router (v7, data mode)</h2>
      <p>
        Create the router with <code>createShatterBrowserRouter</code> (it installs the back/forward
        gate before the router starts listening), and render <code>ShatterProvider</code> inside it,
        in your root route.
      </p>
      <Code lang="tsx">{`
import { RouterProvider, Outlet } from 'react-router';
import {
  createShatterBrowserRouter,
  ShatterProvider,
  ShatterLink,
} from 'shatter-router/react-router';

function Root() {
  return (
    <ShatterProvider options={{ effect: 'shatter' }}>
      <nav>
        <ShatterLink to="/">Home</ShatterLink>
        <ShatterLink to="/work" effect="explode">Work</ShatterLink>
      </nav>
      <Outlet />
    </ShatterProvider>
  );
}

const router = createShatterBrowserRouter([
  { path: '/', Component: Root, children: [/* your routes */] },
]);

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
`}</Code>
      <p>
        <code>ShatterNavLink</code> wraps <code>NavLink</code>, and{' '}
        <code>useShatterNavigate()</code> navigates in code. Declarative mode (
        <code>&lt;BrowserRouter&gt;</code> with <code>ShatterProvider</code> inside it) works too,
        back and forward included. Only a data router made with the plain{' '}
        <code>createBrowserRouter</code> plays back/forward without an effect in Chromium, because
        it starts listening before Shatter can.
      </p>

      <h2 id="react">React with any router</h2>
      <p>
        <code>shatter-router/react</code> takes a <code>navigate</code> function, so it works with
        any router that can push a URL.
      </p>
      <Code lang="tsx">{`
import { ShatterProvider, ShatterLink } from 'shatter-router/react';

// navigate(href, { replace, state }) may return a promise that resolves once the route rendered.
<ShatterProvider
  navigate={(href, { replace }) => (replace ? myRouter.replace(href) : myRouter.push(href))}
  options={{ effect: 'implode' }}
>
  <ShatterLink href="/work">Work</ShatterLink>
</ShatterProvider>
`}</Code>

      <h2 id="vanilla">Vanilla</h2>
      <p>
        The core gives you <code>transition()</code>, which wraps your own page swap, and the link
        rules every adapter uses (modifier keys, middle clicks, <code>target</code>,{' '}
        <code>download</code>, external links, <code>data-shatter=&quot;off&quot;</code> and
        same-page hash links keep their native behaviour).
      </p>
      <Code lang="ts">{`
import { classifyLinkClick, createShatter, findAnchor, getLinkEffect } from 'shatter-router';

const shatter = createShatter({ effect: 'shatter' });

document.addEventListener('click', (event) => {
  const anchor = findAnchor(event);
  if (!anchor) return;
  const decision = classifyLinkClick(event, anchor);
  if (!decision.intercept) return;
  event.preventDefault();
  void shatter.transition({
    origin: { x: event.clientX, y: event.clientY },
    effect: getLinkEffect(anchor), // data-shatter-effect="flip"
    commit: () => {
      history.pushState(null, '', decision.url);
      render(decision.url); // your page swap
    },
  });
});

// Back/forward: the DOM still shows the old page in popstate.
window.addEventListener('popstate', () => {
  void shatter.transition({
    direction: 'back',
    commit: () => render(new URL(location.href)),
  });
});
`}</Code>
      <p>
        Next: the <ShatterLink href="/docs/api">API reference</ShatterLink> lists every option, or
        try them in the <ShatterLink href="/playground">playground</ShatterLink>.
      </p>
    </>
  );
}
