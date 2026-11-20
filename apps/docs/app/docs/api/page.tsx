import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Code } from '../../code';

export const metadata: Metadata = { title: 'API reference' };

const OPTIONS: readonly (readonly [string, string, string])[] = [
  [
    'effect',
    `'shatter'`,
    'Effect name or effect object: shatter, explode, implode, flip, assemble, or one you registered.',
  ],
  ['duration', 'the effect’s own, else 1000', 'Motion phase length in ms, not counting the crack.'],
  [
    'shards',
    `'auto'`,
    'Number of shards, or auto by device tier: 40 (low), 90 (mid), 160 (high). Clamped to 12–400.',
  ],
  ['gravity', '2600', 'px/s², positive is down.'],
  ['impulse', '900', 'Launch speed in px/s.'],
  ['thickness', '6', 'Glass thickness in CSS px, seen on the shards’ sides as they tumble.'],
  ['glassTint', `'#cfe8ff'`, 'Colour of the cut edges (#rgb or #rrggbb), mixed in at 12 %.'],
  ['chromatic', 'true', 'Colour fringing along fast shards’ motion, up to 1.5 px.'],
  [
    'physics',
    `'procedural'`,
    'Or a physics plugin such as rapier({ floor: true }) from shatter-router/rapier, loaded lazily. Drives shatter and explode.',
  ],
  [
    'precapture',
    `'pointerdown'`,
    `Capture before the click to hide its latency: 'pointerdown', 'hover' (after a 120 ms dwell) or false.`,
  ],
  ['captureBudget', '250', 'Longest capture in ms before falling back to a plain navigation.'],
  [
    'readyTimeout',
    '1500',
    'Longest wait in ms for the new route (fonts, images) before animating anyway.',
  ],
  [
    'reducedMotion',
    `'crossfade'`,
    `With prefers-reduced-motion: 'crossfade' (≤ 200 ms View Transition), 'instant', or 'ignore' (demos only).`,
  ],
  [
    'backForward',
    `'mirror'`,
    `Effect for back/forward. 'mirror': Back plays the exact reverse of the effect that brought you to the page, from the same point, and Forward replays it. 'reverse' (shatter becomes assemble and so on), 'same', or 'none'.`,
  ],
  ['seed', 'random', 'Makes fracture layouts and motion deterministic.'],
  [
    'debug',
    'false',
    'true: the debug panel, window.__SHATTER_TEST__ and diagnostics. { panel: false } keeps all but the panel.',
  ],
  [
    'scrollLock',
    'none',
    'Your own lock for smooth-scroll libraries (Lenis and the like), used alongside the built-in one.',
  ],
];

const EVENTS: readonly (readonly [string, string])[] = [
  ['start', 'A transition was requested.'],
  ['covered', '{ captureMs, precaptured }: the glass shows the outgoing page.'],
  ['fractured', '{ shardCount, fractureMs }: the page is cut, nothing has moved yet.'],
  ['committed', 'Your commit() finished.'],
  ['animating', '{ effect }: the new route is ready under the glass; the effect starts.'],
  ['end', '{ fallback }: the glass is gone and the new page is live.'],
  ['fallback', '{ reason }: the WebGL effect was skipped. The navigation still completes.'],
  ['error', '{ error }: something threw inside the pipeline. The navigation still completes.'],
];

const ATTRIBUTES: readonly (readonly [string, string])[] = [
  ['data-shatter="off"', 'On a link: plain navigation, no effect.'],
  ['data-shatter-effect="flip"', 'On a link or an ancestor: the effect for that link.'],
  [
    'data-shatter-ignore',
    'On any element: left out of the capture and drawn as its background colour.',
  ],
  [
    'data-shatter-focus',
    'On the element that should get focus after the reveal (else the first h1 in main, else main).',
  ],
  [
    'data-shatter-pending',
    'Next.js: on content that is still loading; the effect waits until none is left.',
  ],
];

function Table({
  head,
  rows,
}: {
  head: readonly string[];
  rows: readonly (readonly string[])[];
}): ReactNode {
  return (
    <table>
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell} scope="col">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, i) => (
              <td key={i}>{i === 0 ? <code>{cell}</code> : cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ApiReference(): ReactNode {
  return (
    <>
      <p className="kicker">Docs</p>
      <h1>API reference</h1>
      <p className="lede">Everything is typed; this page is the short version.</p>

      <h2 id="create-shatter">createShatter(options)</h2>
      <Code lang="ts">{`
import { createShatter } from 'shatter-router';

const shatter = createShatter({ effect: 'shatter', shards: 'auto' });
`}</Code>
      <p>
        Creates one instance for the page. It costs 1.8 kB until first use; the renderer and the
        capture load on idle. The adapters create it for you.
      </p>
      <Table head={['Option', 'Default', 'What it does']} rows={OPTIONS} />

      <h2 id="instance">The instance</h2>
      <Code lang="ts">{`
await shatter.transition({
  commit: () => router.push('/work'),  // show the new route (may return a promise)
  origin: { x: 640, y: 360 },          // impact point, viewport px (default: centre)
  effect: 'flip',                      // per-call effect
  direction: 'forward',                // or 'back'
  replace: false,                      // true: the commit replaces the history entry
  scroll: 'top',                       // 'top' | 'none' | { x, y }
});

const off = shatter.on('end', ({ fallback }) => console.log('done', fallback));
shatter.registerEffect(myEffect);
shatter.state;     // 'idle' | 'capturing' | 'covering' | 'committing' | 'waiting' | 'animating' | 'revealing' | 'fallback'
shatter.destroy(); // frees the WebGL context; idempotent
`}</Code>
      <p>
        A new navigation during a transition wins: before the commit the old one is dropped, after
        it the old effect fast-forwards within a frame. <kbd>Escape</kbd> or a click on the glass
        skips to the end.
      </p>
      <h3>Events</h3>
      <Table head={['Event', 'Payload and meaning']} rows={EVENTS} />

      <h2 id="react">React, React Router, Next.js</h2>
      <p>The three adapters have the same shape.</p>
      <Code lang="tsx">{`
<ShatterProvider options={...} instance={existing} />  // one instance for the app
<ShatterLink href="/work" effect="flip">Work</ShatterLink>
const navigate = useShatterNavigate();                   // navigate('/work', { effect, origin, replace })
const shatter = useShatter();                            // the instance (null before mount)
`}</Code>
      <ul>
        <li>
          <code>shatter-router/react</code>: the provider takes <code>navigate(href, info)</code>{' '}
          for any router.
        </li>
        <li>
          <code>shatter-router/react-router</code>: also <code>ShatterNavLink</code> and{' '}
          <code>createShatterBrowserRouter</code>; <code>ShatterLink</code> takes <code>to</code>.
        </li>
        <li>
          <code>shatter-router/next</code>: <code>ShatterLink</code> wraps <code>next/link</code>{' '}
          (string hrefs); the provider takes{' '}
          <code>waitFor: &apos;settled&apos; | &apos;commit&apos;</code>.
        </li>
      </ul>

      <h2 id="physics">Physics</h2>
      <Code lang="ts">{`
import { rapier } from 'shatter-router/rapier'; // peer: @dimforge/rapier3d-compat

createShatter({ physics: rapier({ floor: true }), duration: 2500 });
`}</Code>
      <p>
        Rapier loads only when this mode is used. If it can&apos;t load (offline, a strict CSP), the
        procedural motion plays instead.
      </p>

      <h2 id="html">HTML attributes</h2>
      <Table head={['Attribute', 'Effect']} rows={ATTRIBUTES} />
    </>
  );
}
