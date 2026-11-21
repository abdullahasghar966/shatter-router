import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LANDING, LIGHTHOUSE } from '../../../lib/measurements';

export const metadata: Metadata = { title: 'Performance' };

const SIZES: readonly (readonly [string, string, string])[] = [
  [
    'shatter-router (core)',
    '1.8 kB',
    'Everything until the first transition: options, events, link rules.',
  ],
  ['shatter-router/react', '2.57 kB', 'Core included.'],
  ['shatter-router/react-router', '4.14 kB', 'Core and React adapter included.'],
  ['shatter-router/next', '4.28 kB', 'Core and React adapter included.'],
  ['runtime (lazy)', '7.55 kB', 'State machine, fallbacks, focus and announcements.'],
  ['engine (lazy)', '19.76 kB', 'WebGL2 renderer, fracture, all five effects. Budget 22 KB.'],
  ['capture (lazy)', '12.53 kB', 'DOM capture, modern-screenshot included.'],
  ['debug (lazy, debug mode only)', '3.44 kB', 'The debug panel and seam check.'],
  [
    'rapier + backend (lazy, physics only)',
    '0.26 + 1.44 kB',
    'Plus Rapier itself (1.65 MB gzip), only with physics: rapier().',
  ],
];

const FRAMES: readonly (readonly [string, string, string, string])[] = [
  ['shatter', '60.0 fps', '17.1 ms', '22.7 ms'],
  ['explode', '60.0 fps', '17.1 ms', '22.0 ms'],
  ['implode', '60.0 fps', '17.0 ms', '23.5 ms'],
  ['flip', '60.0 fps', '17.0 ms', '21.4 ms'],
  ['assemble', '60.0 fps', '17.0 ms', '20.7 ms'],
];

export default function Performance(): ReactNode {
  return (
    <>
      <p className="kicker">Docs</p>
      <h1>Performance</h1>
      <p className="lede">
        Every number on this page was measured, on a mid-range laptop (NVIDIA RTX 4050 Laptop GPU,
        Windows 11, Chrome) unless it says otherwise.
      </p>

      <h2>Bundle size (min + gzip)</h2>
      <p>
        You pay 1.8 kB up front. The rest loads on idle after the page has loaded, in its own
        chunks, and size-limit enforces every budget in CI.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Entry</th>
            <th scope="col">Size</th>
            <th scope="col">Contains</th>
          </tr>
        </thead>
        <tbody>
          {SIZES.map(([entry, size, note]) => (
            <tr key={entry}>
              <td>
                <code>{entry}</code>
              </td>
              <td>{size}</td>
              <td>{note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Frame rate</h2>
      <p>
        1440×900, 160 shards, measured by the e2e suite in headed Chrome on the GPU. One draw call
        per frame for every effect, and no long task (over 50 ms) between the glass appearing and
        disappearing.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Effect</th>
            <th scope="col">Frame rate</th>
            <th scope="col">Worst frame</th>
            <th scope="col">Capture</th>
          </tr>
        </thead>
        <tbody>
          {FRAMES.map(([effect, fps, worst, capture]) => (
            <tr key={effect}>
              <td>
                <code>{effect}</code>
              </td>
              <td>{fps}</td>
              <td>{worst}</td>
              <td>{capture}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Capture on this site</h2>
      <p>
        The landing page of this site at 1440×900: capture <strong>{LANDING.captureMs}</strong> (
        {LANDING.where}). The budget is 120 ms; above <code>captureBudget</code> (250 ms) the effect
        is skipped rather than making you wait.
      </p>
      <h3>What makes a capture slower</h3>
      <p>
        A capture copies every element of the page with its computed style, and inlines the web
        fonts it draws. Shatter Router already inlines only the font files whose characters the page
        uses and leaves your CSS custom properties out of the copy. What is left is up to the page:
        each element and especially each pseudo-element (<code>::before</code>, <code>::after</code>
        ) adds a little to every navigation. Prefer backgrounds and borders for decoration, and
        avoid splitting text into one element per letter.
      </p>

      <h2>No garbage in the render loop</h2>
      <p>
        The e2e suite counts every allocation made while the shards move, with the Chrome DevTools
        Protocol&apos;s allocation tracker. The result is 0 bytes per frame for every effect. The
        same test found two per-frame allocations during development (an array destructuring and a{' '}
        <code>for...of</code>), which are fixed. One exception: in Rapier mode, Rapier&apos;s own
        bindings allocate a few kilobytes per frame.
      </p>

      <h2>Everything else</h2>
      <ul>
        <li>Fracture: 0.6 ms for 160 shards at 1440×900, on the main thread (no worker needed).</li>
        <li>One WebGL context for the life of the page, created on first use.</li>
        <li>
          GPU textures and the captured image are freed when the transition ends. 100 transitions in
          a row grow the JS heap by about 0.1 MB (noise) and leave 0 textures alive.
        </li>
        <li>The shader source is minified at build time: comments and indentation never ship.</li>
      </ul>

      <h2>This site on Lighthouse (mobile)</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Page</th>
            <th scope="col">Performance</th>
            <th scope="col">Accessibility</th>
          </tr>
        </thead>
        <tbody>
          {LIGHTHOUSE.pages.map(([page, performance, accessibility]) => (
            <tr key={page}>
              <td>
                <code>{page}</code>
              </td>
              <td>{performance}</td>
              <td>{accessibility}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{LIGHTHOUSE.how}</p>
    </>
  );
}
