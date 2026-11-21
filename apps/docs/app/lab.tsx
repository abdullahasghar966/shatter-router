'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { useShatter } from 'shatter-router/next';

/** The longest first-load entrance (Reveal: a few words, 55 ms apart, 720 ms each). */
const ENTRANCE_MS = 1600;
/** How far the cursor ring trails the pointer per frame (0..1). */
const FOLLOW = 0.22;
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
 * - a cursor ring that trails the pointer and grows over links and buttons
 *   (the native cursor stays; off for touch and reduced motion);
 * - cards that tilt toward the pointer under a sheen that follows it.
 */
export function Lab(): ReactNode {
  const shatter = useShatter();
  const ring = useRef<HTMLDivElement>(null);

  // Entrances only on the first load.
  useEffect(() => {
    const root = document.documentElement;
    const enter = (): void => {
      root.setAttribute('data-entered', '');
    };
    const timer = window.setTimeout(enter, ENTRANCE_MS);
    const off = shatter?.on('start', enter);
    return () => {
      window.clearTimeout(timer);
      off?.();
    };
  }, [shatter]);

  // Cursor ring.
  useEffect(() => {
    const element = ring.current;
    if (!element || reducedMotion()) return undefined;
    let x = -100;
    let y = -100;
    let targetX = -100;
    let targetY = -100;
    let frame = 0;
    const step = (): void => {
      x += (targetX - x) * FOLLOW;
      y += (targetY - y) * FOLLOW;
      element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      frame =
        Math.abs(targetX - x) + Math.abs(targetY - y) > 0.3
          ? window.requestAnimationFrame(step)
          : 0;
    };
    const onMove = (event: PointerEvent): void => {
      if (event.pointerType !== 'mouse') {
        element.dataset.visible = 'false';
        return;
      }
      targetX = event.clientX;
      targetY = event.clientY;
      if (element.dataset.visible !== 'true') {
        // Appear where the pointer is, without sweeping in from the corner.
        x = targetX;
        y = targetY;
        element.dataset.visible = 'true';
      }
      const over = (event.target as Element | null)?.closest('a, button, [role="button"]');
      element.dataset.over = over ? 'true' : 'false';
      if (!frame) frame = window.requestAnimationFrame(step);
    };
    const onLeave = (): void => {
      element.dataset.visible = 'false';
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

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

  return <div ref={ring} className="cursor-ring" aria-hidden="true" data-visible="false" />;
}
