import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';

export const metadata: Metadata = { title: 'Overview' };

export default function Overview(): ReactNode {
  return (
    <>
      <p className="kicker">Docs</p>
      <h1>How a page breaks</h1>
      <p className="lede">
        Shatter Router puts a picture of the current page under glass, lets your router render the
        next page behind it, and then breaks the glass.
      </p>
      <h2>The pipeline</h2>
      <ol>
        <li>
          <strong>Capture.</strong> On click (or already on press, with <code>precapture</code>) the
          visible viewport is rendered into a canvas through an SVG <code>foreignObject</code>.
        </li>
        <li>
          <strong>Cover.</strong> A full-viewport WebGL2 canvas in the browser&apos;s top layer
          shows that picture through a pixel-exact camera. The first frame is identical to the live
          page, and seam tests check that on Chromium, Firefox and WebKit.
        </li>
        <li>
          <strong>Fracture.</strong> The picture is cut into Voronoi cells, denser around the click,
          extruded into glass with a thickness. This happens while your router works.
        </li>
        <li>
          <strong>Commit.</strong> Your <code>commit()</code> runs: the router renders the new route
          under the glass. Shatter waits until it has rendered, its fonts and images have loaded,
          and it is scrolled into place.
        </li>
        <li>
          <strong>Animate.</strong> Cracks run out from the click, then the effect moves every shard
          in a vertex shader: one draw call per frame.
        </li>
        <li>
          <strong>Reveal.</strong> The canvas goes away, focus moves to the new page&apos;s heading
          and its title is announced.
        </li>
      </ol>
      <p>
        If any step can&apos;t run (no WebGL2, reduced motion, a capture over budget, an error), the
        page changes anyway, with a short crossfade or instantly. Navigation always completes.
      </p>
      <h2>Where to go next</h2>
      <ul>
        <li>
          <ShatterLink href="/docs/getting-started">Getting started</ShatterLink>: vanilla, React,
          React Router or Next.js.
        </li>
        <li>
          <ShatterLink href="/docs/api">API reference</ShatterLink>: every option, event and
          component.
        </li>
        <li>
          <ShatterLink href="/playground">Playground</ShatterLink>: try the options and copy the
          config.
        </li>
      </ul>
    </>
  );
}
