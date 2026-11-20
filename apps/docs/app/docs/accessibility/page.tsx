import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Code } from '../../code';

export const metadata: Metadata = { title: 'Accessibility' };

export default function Accessibility(): ReactNode {
  return (
    <>
      <p className="kicker">Docs</p>
      <h1>Accessibility</h1>
      <p className="lede">
        Breaking glass is decoration. Navigation stays a navigation: focus, announcements and
        reduced motion are handled for you.
      </p>

      <h2>Reduced motion</h2>
      <p>
        With <code>prefers-reduced-motion: reduce</code> the effect does not play. The default,{' '}
        <code>reducedMotion: &apos;crossfade&apos;</code>, swaps the page with a View Transition
        crossfade of at most 200 ms where the browser supports it, and instantly elsewhere.{' '}
        <code>&apos;instant&apos;</code> always swaps instantly. <code>&apos;ignore&apos;</code>{' '}
        plays the full effect anyway. It exists for demos and is discouraged.
      </p>

      <h2>Focus</h2>
      <p>After the reveal, focus moves to the first of:</p>
      <ol>
        <li>
          an element with <code>data-shatter-focus</code>,
        </li>
        <li>
          the first <code>h1</code> inside <code>main</code>,
        </li>
        <li>
          <code>main</code> itself.
        </li>
      </ol>
      <p>
        An element that is not focusable gets <code>tabindex=&quot;-1&quot;</code> until it loses
        focus again, so keyboard and screen-reader users start reading the new page from the top.
      </p>
      <Code lang="html">{`<h2 data-shatter-focus>Your order</h2>`}</Code>

      <h2>Announcements</h2>
      <p>
        The new <code>document.title</code> is announced through a visually hidden{' '}
        <code>aria-live=&quot;polite&quot;</code> region, as a full page load would. Give every
        route a distinct title.
      </p>

      <h2>Input during the effect</h2>
      <p>
        The glass catches pointer input while it is up, so nothing underneath is clicked by
        accident. <kbd>Escape</kbd>, a click on the glass, or hiding the tab skips to the end at
        once.
      </p>

      <h2>Links keep their meaning</h2>
      <p>
        Modifier clicks (open in a new tab), middle clicks, <code>target</code>,{' '}
        <code>download</code>, external links and same-page anchors behave natively. Keyboard
        activation works like a click and breaks the glass from the link&apos;s centre.
      </p>

      <h2>This site</h2>
      <p>
        Every page here is checked with Lighthouse on mobile, and the scores are on the performance
        page. The hero on the home page breaks on any click, and its <q>Break it</q> button does the
        same for keyboard users.
      </p>
    </>
  );
}
