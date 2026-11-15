import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Browser support' };

const FEATURES: readonly (readonly [string, string, string])[] = [
  ['WebGL2', 'Required for the effect.', 'Plain navigation (fallback reason “unsupported”).'],
  [
    'Popover API (top layer)',
    'Puts the glass above dialogs and other popovers.',
    'A fixed, maximum z-index layer.',
  ],
  [
    'View Transitions',
    'The reduced-motion crossfade and the fallback crossfade.',
    'An instant swap.',
  ],
  ['WebAssembly', 'Only for physics: rapier().', 'The procedural motion.'],
];

export default function BrowserSupport(): ReactNode {
  return (
    <>
      <p className="kicker">Docs</p>
      <h1>Browser support</h1>
      <p className="lede">
        Any browser with WebGL2 gets the effect. Every other browser still navigates.
      </p>

      <h2>Tested on every pull request</h2>
      <p>
        The end-to-end suite, seam tests included, runs on three engines through Playwright 1.65:
        Chromium (Chrome 159), Firefox 159 and WebKit, on Linux in CI and on Windows locally.
      </p>

      <h2>What each feature does, and what happens without it</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Used for</th>
            <th scope="col">Without it</th>
          </tr>
        </thead>
        <tbody>
          {FEATURES.map(([feature, use, without]) => (
            <tr key={feature}>
              <td>{feature}</td>
              <td>{use}</td>
              <td>{without}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Known differences</h2>
      <ul>
        <li>
          <strong>Text antialiasing.</strong> The first frame matches the live page to within 0.5 %
          of pixels on every engine, and the differences are on glyph edges. On Windows, Chromium
          draws small text with ClearType on the page but in grayscale in the picture.
        </li>
        <li>
          <strong>Linux Chromium at 2× zoom.</strong> Some paragraph lines with fractional line
          heights land half a CSS pixel apart in the picture (measured 0.52 % of pixels, allowed up
          to 0.6 %).
        </li>
        <li>
          <strong>Pinch zoom.</strong> While the page is pinch-zoomed the effect is skipped (reason{' '}
          <code>pinch-zoom</code>), because the glass can&apos;t line up with a zoomed visual
          viewport.
        </li>
        <li>
          <strong>Hidden tabs</strong> swap instantly.
        </li>
        <li>
          <strong>Cross-document navigation</strong> (multi-page apps) is out of scope: the glass
          can&apos;t survive a page unload.
        </li>
      </ul>
    </>
  );
}
