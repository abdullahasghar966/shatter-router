import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Code } from '../../code';

export const metadata: Metadata = { title: 'Content Security Policy' };

export default function Csp(): ReactNode {
  return (
    <>
      <p className="kicker">Docs</p>
      <h1>Content Security Policy</h1>
      <p className="lede">
        Two directives matter. Without them nothing breaks: the effect falls back to a plain
        navigation, or to the procedural motion.
      </p>

      <h2>For the capture</h2>
      <p>
        The page is rendered into an image from a <code>data:</code> URL (an SVG with the page
        inside) and drawn into a canvas, so images must allow <code>data:</code> and{' '}
        <code>blob:</code>:
      </p>
      <Code lang="http">{`Content-Security-Policy: img-src 'self' data: blob:`}</Code>
      <p>
        Without them the capture fails: the <code>fallback</code> event fires with{' '}
        <code>capture-failed</code>, and the page changes with a crossfade. The browser also logs a
        CSP violation. The e2e suite checks exactly this on a page with{' '}
        <code>img-src &apos;self&apos;</code>.
      </p>

      <h2>For Rapier physics</h2>
      <p>
        Rapier is WebAssembly. With <code>physics: rapier()</code> scripts need{' '}
        <code>&apos;wasm-unsafe-eval&apos;</code>:
      </p>
      <Code lang="http">{`Content-Security-Policy: script-src 'self' 'wasm-unsafe-eval'`}</Code>
      <p>
        Without it Rapier can&apos;t start, and the shards fall with the procedural motion instead,
        which needs nothing extra. This is tested too.
      </p>

      <h2>What you don&apos;t need</h2>
      <ul>
        <li>
          No <code>worker-src</code>: everything runs on the main thread (fracturing 160 shards
          takes under a millisecond).
        </li>
        <li>
          No <code>&apos;unsafe-eval&apos;</code> and no inline scripts. The shaders are compiled by
          WebGL, not by JavaScript.
        </li>
      </ul>

      <h2>One more thing: fetching the page&apos;s assets</h2>
      <p>
        To put images, background images and web fonts inside the picture, the capture fetches them
        (usually straight from the browser&apos;s cache) and inlines them. Those requests are
        governed by <code>connect-src</code>. A policy that already lets your page load its images
        and fonts from <code>&apos;self&apos;</code> or your CDN usually allows this, as long as{' '}
        <code>connect-src</code> lists the same origins. Cross-origin images without CORS are never
        fetched: they become transparent in the picture.
      </p>
    </>
  );
}
