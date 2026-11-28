import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Playground } from './playground';

export const metadata: Metadata = {
  title: 'Studio',
  description:
    'The Shatter Router studio: presets, every option live, undo, and the matching config for Next.js, React Router, React or vanilla.',
};

export default function PlaygroundPage(): ReactNode {
  return (
    <>
      <header className="page-head">
        <p className="kicker">Studio</p>
        <h1>Tune the glass.</h1>
        <p className="lede">
          Start from a preset or change any option in the panel, then click the stage: it breaks
          with your settings and swaps the scene. The code below always matches, for your framework.
        </p>
      </header>
      <Playground />
    </>
  );
}
