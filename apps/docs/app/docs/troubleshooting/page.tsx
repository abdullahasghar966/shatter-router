import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';
import { Code } from '../../code';

export const metadata: Metadata = { title: 'Troubleshooting' };

export default function Troubleshooting(): ReactNode {
  return (
    <>
      <p className="kicker">Docs</p>
      <h1>Troubleshooting</h1>
      <p className="lede">
        First, turn on debug mode. The panel shows each phase&apos;s timing, why a transition fell
        back, and a seam check that diffs the glass against the live page.
      </p>
      <Code lang="ts">{`createShatter({ debug: true });   // or { debug: { panel: false } } for logs only`}</Code>

      <h2>The page changes, but nothing breaks</h2>
      <p>The effect fell back. Listen for the reason, or read it in the debug panel:</p>
      <Code lang="ts">{`shatter.on('fallback', ({ reason }) => console.log(reason));`}</Code>
      <ul>
        <li>
          <code>reduced-motion</code>: the system asks for less motion. That is intended.
        </li>
        <li>
          <code>capture-budget</code>: capturing took longer than <code>captureBudget</code> (250
          ms). Very large DOMs, many images or huge fonts slow the capture down. Ignore heavy parts
          with <code>data-shatter-ignore</code>, or raise the budget.
        </li>
        <li>
          <code>capture-failed</code>: usually a strict Content Security Policy (see{' '}
          <ShatterLink href="/docs/csp">CSP</ShatterLink>).
        </li>
        <li>
          <code>unsupported</code> / <code>context-lost</code>: no WebGL2, or the GPU dropped the
          context. It recovers by itself when the context comes back.
        </li>
        <li>
          <code>pinch-zoom</code>, <code>hidden</code>, <code>disabled</code>: a pinch-zoomed page,
          a background tab, or <code>backForward: &apos;none&apos;</code>.
        </li>
      </ul>

      <h2>Images are blank in the glass</h2>
      <p>
        A cross-origin image without CORS would taint the canvas, so it is left transparent in the
        picture. Serve it with CORS and add <code>crossorigin</code>:
      </p>
      <Code lang="html">{`<img src="https://cdn.example.com/photo.jpg" crossorigin="anonymous" alt="" />`}</Code>
      <p>Images more than 128 px outside the viewport are skipped on purpose.</p>

      <h2>Iframes, video and canvas</h2>
      <ul>
        <li>
          <strong>Iframes</strong> (same-origin included) are drawn as a solid box in their
          background colour: a page can&apos;t read a cross-origin frame&apos;s pixels.
        </li>
        <li>
          <strong>Video</strong> shows its current frame when it is same-origin, else its poster,
          else its background.
        </li>
        <li>
          <strong>Canvas</strong> is copied unless it is tainted.
        </li>
        <li>
          <strong>Anything else</strong> you don&apos;t want in the picture (a map, an ad):{' '}
          <code>data-shatter-ignore</code> draws it as its background colour.
        </li>
      </ul>

      <h2>The page jumps when the glass appears</h2>
      <ul>
        <li>
          The scrollbar appears or disappears between pages: add{' '}
          <code>
            html {'{'} scrollbar-gutter: stable; {'}'}
          </code>
          .
        </li>
        <li>
          A smooth-scroll library keeps moving the page: pass its stop and start as{' '}
          <code>scrollLock</code>.
        </li>
        <li>
          Text looks one pixel off: run the seam check in the debug panel. On Windows, Chromium
          draws small text with ClearType on the page and in grayscale in the picture, so glyph
          edges differ slightly.
        </li>
      </ul>

      <h2>The effect starts before the new page has loaded</h2>
      <p>
        Shatter waits until the route has rendered, its web fonts and images have loaded, and it is
        scrolled into place, for at most <code>readyTimeout</code> (1500 ms). In Next.js, mark
        content that is still streaming with <code>data-shatter-pending</code>. Loading boundaries (
        <code>loading.tsx</code>) are waited for by default.
      </p>

      <h2>Back and forward don&apos;t shatter (React Router)</h2>
      <p>
        Create the router with <code>createShatterBrowserRouter</code>. A plain{' '}
        <code>createBrowserRouter</code> starts listening to history before Shatter can, and
        Chromium then lets it render first.
      </p>
    </>
  );
}
