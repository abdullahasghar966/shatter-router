import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';
import { EFFECTS } from '../../lib/effects';

export const metadata: Metadata = {
  title: 'Effects',
  description: 'Every Shatter Router effect. Each card opens its page using that effect.',
};

export default function Effects(): ReactNode {
  return (
    <>
      <header className="page-head">
        <p className="kicker">Gallery</p>
        <h1>Six ways to break a page.</h1>
        <p className="lede">
          Five built in, one written in the docs. Each card opens its page using that effect, so
          click where you want the glass to break.
        </p>
      </header>
      <ul className="gallery">
        {EFFECTS.map((effect) => (
          <li key={effect.name}>
            <ShatterLink
              className="card"
              href={`/effects/${effect.name}`}
              effect={effect.name}
              style={{ '--c1': effect.colors[0], '--c2': effect.colors[1] } as CSSProperties}
            >
              <span className="card-art" aria-hidden="true" />
              <p className="tag">{effect.custom ? 'Custom effect' : `effect: '${effect.name}'`}</p>
              <h2>{effect.title}</h2>
              <p>{effect.summary}</p>
            </ShatterLink>
          </li>
        ))}
      </ul>
    </>
  );
}
