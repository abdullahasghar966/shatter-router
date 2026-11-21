'use client';

import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef } from 'react';

/** Shortest thumb, CSS px. */
const MIN_THUMB = 40;
/** Stretch per px/s of scroll velocity, and its ceiling. */
const STRETCH_PER_SPEED = 1 / 5000;
const MAX_STRETCH = 0.55;
/** How quickly the stretch springs back per frame (0..1). */
const SETTLE = 0.16;

/**
 * The glass rail (ADR-050): the page's scrollbar as a pane with a shard for a
 * thumb. It shows where you are, stretches with scroll speed and springs
 * back, and can be dragged or clicked. Native scrolling (wheel, keys, touch,
 * assistive technology) is untouched; this is a pointer convenience, hidden
 * from assistive technology and on touch screens.
 */
export function GlassScrollbar(): ReactNode {
  const rail = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const geometry = useRef({ thumb: MIN_THUMB, travel: 0, range: 0 });

  useEffect(() => {
    const railElement = rail.current;
    const thumbElement = thumb.current;
    if (!railElement || !thumbElement) return undefined;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stretch = 0;
    let lastY = window.scrollY;
    let lastTime = performance.now();
    let frame = 0;

    const measure = (): void => {
      const scroller = document.documentElement;
      const range = scroller.scrollHeight - window.innerHeight;
      const height = railElement.clientHeight;
      const size = Math.max(MIN_THUMB, (height * window.innerHeight) / scroller.scrollHeight);
      geometry.current = { thumb: size, travel: Math.max(0, height - size), range };
      thumbElement.style.height = `${size.toFixed(1)}px`;
      railElement.dataset.hidden = range <= 1 ? 'true' : 'false';
    };

    const draw = (): void => {
      const { travel, range } = geometry.current;
      const top = range > 0 ? (window.scrollY / range) * travel : 0;
      thumbElement.style.transform = `translateY(${top.toFixed(1)}px) scaleY(${(1 + stretch).toFixed(3)})`;
    };

    const settle = (): void => {
      stretch *= 1 - SETTLE;
      if (stretch < 0.002) stretch = 0;
      draw();
      frame = stretch > 0 ? window.requestAnimationFrame(settle) : 0;
    };

    const onScroll = (): void => {
      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const speed = (Math.abs(window.scrollY - lastY) / dt) * 1000;
      lastY = window.scrollY;
      lastTime = now;
      if (!still) stretch = Math.max(stretch, Math.min(MAX_STRETCH, speed * STRETCH_PER_SPEED));
      draw();
      if (stretch > 0 && !frame) frame = window.requestAnimationFrame(settle);
    };

    const onResize = (): void => {
      measure();
      draw();
    };

    measure();
    draw();
    // Content can change height without a resize (routes, images, fonts).
    const observer = new ResizeObserver(onResize);
    observer.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  /** Dragging the thumb scrolls the page in proportion. */
  const onThumbDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startScroll = window.scrollY;
    const move = (moveEvent: PointerEvent): void => {
      const { travel, range } = geometry.current;
      if (travel <= 0) return;
      window.scrollTo({
        top: startScroll + ((moveEvent.clientY - startY) / travel) * range,
        behavior: 'instant',
      });
    };
    const up = (): void => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  /** A click on the rail brings the thumb's centre there. */
  const onRailDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const element = rail.current;
    if (!element) return;
    const { thumb: size, travel, range } = geometry.current;
    if (travel <= 0) return;
    const y = event.clientY - element.getBoundingClientRect().top - size / 2;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: (Math.min(travel, Math.max(0, y)) / travel) * range,
      behavior: still ? 'instant' : 'smooth',
    });
  };

  return (
    <div
      ref={rail}
      className="glass-rail"
      aria-hidden="true"
      data-hidden="true"
      onPointerDown={onRailDown}
    >
      <div ref={thumb} className="glass-thumb" onPointerDown={onThumbDown} />
    </div>
  );
}
