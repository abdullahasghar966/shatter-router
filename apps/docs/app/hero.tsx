'use client';

import type { MouseEvent, ReactNode } from 'react';
import { ShatterLink, useShatter } from 'shatter-router/next';
import { Readouts } from './readouts';
import { Reveal } from './reveal';

/**
 * "Break the page." Clicking anywhere on the hero (except a link or a
 * control) breaks the page in place and puts it back together: a transition
 * whose commit changes nothing, played with `assemble` (the outgoing shards
 * fall while the same page's shards fly back in). The engine always covers
 * the whole viewport, so no region support is needed (ADR-042). The readouts
 * show what that break measured.
 */
export function Hero(): ReactNode {
  const shatter = useShatter();

  const breakAt = (x: number, y: number): void => {
    void shatter?.transition({
      commit: () => undefined,
      effect: 'assemble',
      origin: { x, y },
      scroll: 'none',
    });
  };

  const onClick = (event: MouseEvent<HTMLElement>): void => {
    if ((event.target as Element).closest('a, button, .readouts')) return;
    breakAt(event.clientX, event.clientY);
  };

  const onButton = (event: MouseEvent<HTMLButtonElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    breakAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  return (
    // The whole hero is a click target for pointer users; keyboard users get
    // the button, which does the same.
    <section className="hero" aria-labelledby="hero-title" onClick={onClick}>
      <div>
        <p className="kicker">Specimen 01 · WebGL2 page transitions</p>
        <h1 id="hero-title">
          <Reveal text="Break the page" />
          <span className="accent">.</span>
        </h1>
        <p className="subline">Click anywhere on the bench</p>
        <div className="hero-actions">
          <button type="button" className="button" onClick={onButton}>
            Break it
          </button>
          <ShatterLink className="button ghost" href="/effects">
            See every effect
          </ShatterLink>
        </div>
      </div>
      <div>
        <Readouts />
        <p className="hero-meta">one draw call · 60 fps · 2.4 kB until first use</p>
      </div>
    </section>
  );
}
