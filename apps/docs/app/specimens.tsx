'use client';

import { type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useRef } from 'react';
import { useShatter } from 'shatter-router/next';
import { breakInPlace, type StageEffect } from './live-stage';

/**
 * The specimen strip (ADR-067). The featured specimen breaks as its section
 * scrolls past (`scrollBreak`, ADR-064): the section is pinned while it breaks.
 * The three others break in place when pressed, with the rest of the page live.
 * (Click only: a resting pointer would also break them, and a click during the
 * hold would then break them twice.)
 */

interface Specimen {
  readonly name: string;
  readonly title: string;
  readonly text: string;
}

const SPECIMENS: readonly Specimen[] = [
  { name: 'melt', title: 'Melt', text: 'The piece sags and runs off the bench.' },
  { name: 'ripple', title: 'Ripple', text: 'Rings travel out from the press.' },
  { name: 'glitch', title: 'Glitch', text: 'The piece tears into slices and jumps.' },
];

function Tile({ specimen }: { readonly specimen: Specimen }): ReactNode {
  const shatter = useShatter();
  const ref = useRef<HTMLDivElement>(null);
  const effect: StageEffect = specimen.name;

  const breakIt = (): void => {
    const el = ref.current;
    if (shatter && el) void breakInPlace(shatter, el, effect);
  };
  const onClick = (event: MouseEvent<HTMLDivElement>): void => {
    // A press that is not a click on the tile (a selection, a drag) does nothing.
    if (event.detail > 0) breakIt();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    breakIt();
  };

  return (
    <div
      ref={ref}
      className="specimen"
      role="button"
      tabIndex={0}
      aria-label={`Break the ${specimen.title} specimen`}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <p className="tag">effect: &apos;{specimen.name}&apos;</p>
      <h3>{specimen.title}</h3>
      <p>{specimen.text}</p>
    </div>
  );
}

export function Specimens(): ReactNode {
  const shatter = useShatter();
  const sectionRef = useRef<HTMLElement>(null);
  const featuredRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const featured = featuredRef.current;
    if (!shatter || !section || !featured) return undefined;
    let alive = true;
    let stop: (() => void) | undefined;
    // The markup is checked by the docs e2e: a RangeError here would be a bug in this page.
    void shatter.scrollBreak(featured, { section, effect: 'shatter' }).then(
      (off) => {
        if (alive) stop = off;
        else off();
      },
      () => undefined,
    );
    return () => {
      alive = false;
      stop?.();
    };
  }, [shatter]);

  return (
    <section ref={sectionRef} className="specimen-section" aria-labelledby="specimens">
      <div className="specimen-pin">
        <header className="specimen-head">
          <p className="kicker">Specimens</p>
          <h2 id="specimens">Scroll, or press a piece.</h2>
        </header>
        <div className="specimen-row">
          <div ref={featuredRef} className="specimen featured">
            <p className="tag">scrolls · effect: &apos;shatter&apos;</p>
            <h3>Shatter</h3>
            <p>This one breaks as the section scrolls past.</p>
          </div>
          {SPECIMENS.map((specimen) => (
            <Tile key={specimen.name} specimen={specimen} />
          ))}
        </div>
      </div>
    </section>
  );
}
