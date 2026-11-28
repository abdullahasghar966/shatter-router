import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Library } from './library';

export const metadata: Metadata = {
  title: 'Effects',
  description:
    'The Shatter Router effect library: sixteen motions in five families and a custom one, each with any pattern and material.',
};

export default function Effects(): ReactNode {
  return (
    <>
      <header className="page-head">
        <p className="kicker">Library</p>
        <h1>Seventeen ways to break a page.</h1>
        <p className="lede">
          Sixteen motions built in, in five families, and one written in the docs. Pick a pattern
          and a material to break them with; each card opens its page using its effect, so click
          where you want the glass to break.
        </p>
      </header>
      <Library />
    </>
  );
}
