import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Code } from '../../code';

export const metadata: Metadata = { title: 'API reference' };

const PATTERNS: readonly (readonly [string, string])[] = [
  [`'impact'`, 'Voronoi cells, small near the click and large at the edges (the default).'],
  [`'radial'`, 'A windscreen spider web: rays from the click crossed by rings.'],
  [`'rings'`, 'Even concentric bands around the click, cut into short arcs.'],
  [`'triangles'`, 'Low-poly facets.'],
  [`'hex'`, 'A honeycomb.'],
  [`'bricks'`, 'Rows of offset bricks.'],
  [`'tiles'`, 'A square grid.'],
  [`'strips'`, 'Vertical blinds, a few dozen wide pieces.'],
];

const MOTIONS: readonly (readonly [string, string])[] = [
  [`'shatter'`, 'Gravity. A long crack, then the pane drops (the default).'],
  [`'crumble'`, 'Gravity. Gives way from the bottom up, rows dropping in turn.'],
  [`'rain'`, 'Gravity. Tiles drop straight down at random moments and streak.'],
  [`'explode'`, 'Force. A flash, a shockwave and a blast at the viewer.'],
  [`'implode'`, 'Force. Pieces spiral into the click and vanish.'],
  [`'vortex'`, 'Force. A twister flings pieces outward and up.'],
  [`'wind'`, 'Force. A gust from the click’s side blows pieces away.'],
  [`'flip'`, 'Order. Pieces turn over; their backs are the new page.'],
  [`'blinds'`, 'Order. Strips turn edge-on like venetian blinds.'],
  [`'domino'`, 'Order. Pieces tip over in a cascade, then drop.'],
  [`'slide'`, 'Order. Rows slide out in opposite directions.'],
  [`'fold'`, 'Order. Pieces fold over toward the click like origami.'],
  [`'melt'`, 'Matter. The page sags and drips away.'],
  [`'ripple'`, 'Matter. Rings bob on a swell from the click.'],
  [`'glitch'`, 'Matter. Rows jump, colours split, the page drops out.'],
  [`'assemble'`, 'Assembly. The old page falls while the new one flies together.'],
];

const MATERIALS: readonly (readonly [string, string])[] = [
  [
    `'glass'`,
    'Clear glass: a bright rim on every cut edge, a glint, colour fringing (the default).',
  ],
  [`'ice'`, 'Frosted: faces cloud over as they move, wide white edges, a soft glint.'],
  [`'mirror'`, 'A turning face mirrors a soft sky; a hard, bright glint.'],
  [`'obsidian'`, 'Dark volcanic glass: deep shade away from the light, a razor glint.'],
  [`'paper'`, 'No shine: white paper edges and soft shading as pieces turn.'],
  [`'metal'`, 'Brushed steel: grey edges and a streaked glint.'],
  [`'holo'`, 'Holographic foil: thin-film colours along the edges and in the glint.'],
];

const STAGGERS: readonly (readonly [string, string])[] = [
  [`'radial'`, 'From the impact point outward (the default of every built-in effect).'],
  [`'linear'`, 'Across the page, left to right.'],
  [
    `{ type: 'linear', angle }`,
    'Along an angle in degrees: 90 is top to bottom, 180 right to left.',
  ],
  [`'spiral'`, 'Once around the impact point, moving outward.'],
  [`'random'`, 'Any order (fixed by the seed option).'],
  [`'reading-order'`, 'Row by row, each left to right.'],
];

const OPTIONS: readonly (readonly [string, string, string])[] = [
  [
    'effect',
    `'shatter'`,
    'Effect name (see Motions), effect object or composition: one you registered, or { motion, pattern, material, stagger, … } (see Compositions).',
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
  [
    'material',
    `'glass'`,
    'What the pieces are made of: a name (see Materials) or an object with your own values. Change it later with setMaterial().',
  ],
  [
    'glassTint',
    'the material’s',
    'Colour of the cut edges (#rgb or #rrggbb), overriding the material’s own tint.',
  ],
  ['chromatic', 'true', 'Colour fringing along fast shards’ motion, up to 1.5 px.'],
  [
    'interaction',
    'off',
    `true or { cursor, charge, tear, preCrack, haptics }: a cursor kit ('ring', 'reticle', 'hammer', 'glass-cutter', 'none') that arms over links, press and hold to hit harder, drag across a link to tear the page along the drag, haptic ticks on touch. A lazy chunk; off under reduced motion.`,
  ],
  [
    'sound',
    'off',
    'true or { volume }: procedural sound for every motion and material, after the first click or key press, never under reduced motion. Toggle with setSound().',
  ],
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
        Creates one instance for the page. It costs 2.35 kB until first use; the renderer and the
        capture load on idle. The adapters create it for you.
      </p>
      <Table head={['Option', 'Default', 'What it does']} rows={OPTIONS} />

      <h2 id="instance">The instance</h2>
      <Code lang="ts">{`
await shatter.transition({
  commit: () => router.push('/work'),  // show the new route (may return a promise)
  origin: { x: 640, y: 360 },          // impact point, viewport px (default: centre)
  effect: 'flip',                      // per-call effect
  material: 'ice',                     // per-call material
  intensity: 0.8,                      // 0..1, how hard it is hit (0.5: as set)
  path: [{ x: 200, y: 300 }, { x: 900, y: 420 }], // tear along these points
  direction: 'forward',                // or 'back'
  replace: false,                      // true: the commit replaces the history entry
  scroll: 'top',                       // 'top' | 'none' | { x, y }
});

const off = shatter.on('end', ({ fallback }) => console.log('done', fallback));
shatter.registerEffect(myEffect);
shatter.setMaterial('obsidian');       // following transitions; undefined: back to the option
shatter.setSound(true);                // turn sound on or off (still waits for a gesture)
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

      <h2 id="compositions">Compositions</h2>
      <p>
        An effect can be put together from parts. Each part loads on first use, so a page only
        downloads the parts it plays. Pass a composition anywhere an effect goes, or register it
        under a name.
      </p>
      <Code lang="ts">{`
shatter.transition({ commit, effect: { motion: 'explode', stagger: 'linear' } });

shatter.registerEffect({
  name: 'curtain',
  motion: 'flip',                          // how the pieces move: a built-in effect or one you registered
  pattern: 'hex',                          // how the page breaks (see Patterns)
  material: 'paper',                       // what the pieces are made of (see Materials)
  stagger: { type: 'linear', angle: 90 },  // the order the pieces start in
  timing: { duration: 1400 },              // motion length, ms
});
// then effect: 'curtain' or data-shatter-effect="curtain"
`}</Code>
      <Table head={['Motion', 'How the pieces move']} rows={MOTIONS} />
      <Table head={['Pattern', 'How the page breaks']} rows={PATTERNS} />
      <Table head={['Stagger', 'Order the pieces start in']} rows={STAGGERS} />
      <h3 id="materials">Materials</h3>
      <p>
        A material is a set of shading values, so any material goes with any motion and pattern. All
        of its light is exactly zero while a piece is at rest, so the first and last frames are the
        page whatever it is made of. Precedence: a transition’s <code>material</code>, then the
        effect’s own, then <code>setMaterial()</code> or the option.
      </p>
      <Table head={['Material', 'What it looks like']} rows={MATERIALS} />
      <Code lang="ts">{`
// Your own: any of these fields; the rest come from glass (or from the
// built-in material whose name you reuse, to tweak it).
createShatter({
  material: { name: 'amber', tint: '#ffb000', glint: 1.2, shininess: 90, frost: 0.2 },
});
// Fields: tint, tintStrength, sideShade, rim, rimWidth, glint, shininess,
// chromatic, frost, reflect, iridescence, brushed, diffuse.
`}</Code>
      <p>
        Back plays the reverse of a composition too: <code>flip</code> compositions turn back, and
        every other one runs backwards in time.
      </p>

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
