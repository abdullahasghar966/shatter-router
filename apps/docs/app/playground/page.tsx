import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Playground } from './playground';

export const metadata: Metadata = {
  title: 'Playground',
  description: 'Try every Shatter Router option live and copy the matching createShatter config.',
};

export default function PlaygroundPage(): ReactNode {
  return (
    <>
      <header className="page-head">
        <p className="kicker">Playground</p>
        <h1>Tune the glass.</h1>
        <p className="lede">
          Change any option in the panel, then click the stage: it breaks with your settings and
          swaps the scene. The code below always matches.
        </p>
      </header>
      <Playground />
    </>
  );
}
