'use client';

import { type ReactNode, useEffect } from 'react';
import { useShatter } from 'shatter-router/next';

/** The longest first-load entrance (Reveal: a few words, 55 ms apart, 720 ms each). */
const ENTRANCE_MS = 1600;
/** Card tilt at the edges, in degrees. */
const TILT = 5;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The site's small interactions (ADR-050), in one component with document-
 * level listeners (they work on every route without per-page wiring):
 *
 * - marks `<html data-entered>` once the first-load entrance is over, or at
 *   the first transition, so entrances never run under the glass;
 * - (the cursor is the library's interaction kit since M17, ADR-060: it is
 *   never frozen into a capture and does not spoil the pre-capture);
 * - cards that tilt toward the pointer under a sheen that follows it.
 */
export function Lab(): ReactNode {
  const shatter = useShatter();

  // Entrances only on the first load. Any press ends the entrance at once:
  // it runs on window in the capture phase, before Shatter's own press-time
  // capture (document), so a capture never freezes a half-finished entrance.
  useEffect(() => {
    const root = document.documentElement;
    const enter = (): void => {
      root.setAttribute('data-entered', '');
    };
    const timer = window.setTimeout(enter, ENTRANCE_MS);
    const off = shatter?.on('start', enter);
    window.addEventListener('pointerdown', enter, { capture: true, passive: true });
    window.addEventListener('keydown', enter, { capture: true, passive: true });
    // The page is interactive from here on (tests wait for it).
    root.setAttribute('data-lab', 'ready');
    return () => {
      window.clearTimeout(timer);
      off?.();
      window.removeEventListener('pointerdown', enter, true);
      window.removeEventListener('keydown', enter, true);
    };
  }, [shatter]);

  // Card tilt and sheen.
  useEffect(() => {
    if (reducedMotion()) return undefined;
    let current: HTMLElement | null = null;
    const reset = (card: HTMLElement): void => {
      card.style.removeProperty('--rx');
      card.style.removeProperty('--ry');
    };
    const onMove = (event: PointerEvent): void => {
      const card = (event.target as Element | null)?.closest<HTMLElement>('.card') ?? null;
      if (current && current !== card) reset(current);
      current = card;
      if (!card || event.pointerType !== 'mouse') return;
      const rect = card.getBoundingClientRect();
      const u = (event.clientX - rect.left) / rect.width;
      const v = (event.clientY - rect.top) / rect.height;
      card.style.setProperty('--ry', `${((u - 0.5) * 2 * TILT).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${((0.5 - v) * 2 * TILT).toFixed(2)}deg`);
      card.style.setProperty('--mx', `${(u * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${(v * 100).toFixed(1)}%`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      if (current) reset(current);
    };
  }, []);

  return null;
}
