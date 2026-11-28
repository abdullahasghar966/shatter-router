import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';
import { Code } from './code';
import { Hero } from './hero';
import { Specimens } from './specimens';

export const metadata: Metadata = {
  title: { absolute: 'Shatter Router — break the page' },
};

const FEATURES = [
  [
    'Seamless',
    'The first frame of every effect is the page itself: a capture of the live DOM on a pixel-exact camera, checked by seam tests on three browser engines.',
  ],
  [
    'Fast',
    'One WebGL context, one draw call per frame, no allocations in the render loop. 60 fps with 160 shards on a laptop GPU.',
  ],
  [
    'Free until used',
    'The core is 2.35 kB. The renderer, the capture and the physics load on idle, in their own chunks.',
  ],
  [
    'Any router',
    'Vanilla, React, React Router and the Next.js App Router, with back and forward included.',
  ],
  [
    'Always navigates',
    'No WebGL2, reduced motion, a slow capture or an error: the page still changes, with a crossfade or instantly.',
  ],
  [
    'Yours to extend',
    'Effects are a few lines of GLSL against a documented interface. Rapier physics is one import away.',
  ],
] as const;

export default function Home(): ReactNode {
  return (
    <>
      <Hero />
      <Specimens />
      <section className="section" aria-labelledby="why">
        <p className="kicker">What it does</p>
        <h2 id="why">Every route change, through glass.</h2>
        <ul className="features">
          {FEATURES.map(([title, text], i) => (
            <li key={title}>
              <span className="num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="section split" aria-labelledby="start">
        <div>
          <p className="kicker">Quick start</p>
          <h2 id="start">Three lines in a Next.js app.</h2>
          <p className="lede">
            Wrap the layout, swap <code>Link</code> for <code>ShatterLink</code>, and every
            navigation breaks the page. Every link on this site is one.
          </p>
          <div className="hero-actions">
            <ShatterLink className="button" href="/docs/getting-started">
              Get started
            </ShatterLink>
            <ShatterLink className="button ghost" href="/playground">
              Open the playground
            </ShatterLink>
          </div>
        </div>
        <div>
          <Code lang="sh">{`pnpm add shatter-router`}</Code>
          <Code lang="tsx">{`
// app/layout.tsx
import { ShatterProvider, ShatterLink } from 'shatter-router/next';

<ShatterProvider>
  <ShatterLink href="/work">Work</ShatterLink>
  {children}
</ShatterProvider>
`}</Code>
        </div>
      </section>
    </>
  );
}
