'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useShatter } from 'shatter-router/next';

interface Reading {
  effect: string | null;
  captureMs: number | null;
  shards: number | null;
  fractureMs: number | null;
}

const EMPTY: Reading = { effect: null, captureMs: null, shards: null, fractureMs: null };

function value(number: number | null, digits: number): string {
  return number === null ? '—' : number.toFixed(digits);
}

/**
 * Instrument readouts (ADR-050): what the last transition measured on this
 * device, from the library's own events. Announced politely, so a screen
 * reader hears the numbers after a break without being interrupted.
 */
export function Readouts(): ReactNode {
  const shatter = useShatter();
  const [reading, setReading] = useState<Reading>(EMPTY);
  useEffect(() => {
    if (!shatter) return undefined;
    const offs = [
      shatter.on('covered', ({ captureMs }) => {
        setReading((r) => ({ ...r, captureMs }));
      }),
      shatter.on('fractured', ({ shardCount, fractureMs }) => {
        setReading((r) => ({ ...r, shards: shardCount, fractureMs }));
      }),
      shatter.on('animating', ({ effect }) => {
        setReading((r) => ({ ...r, effect }));
      }),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [shatter]);

  const live = reading.captureMs !== null;
  return (
    <aside className="readouts" aria-labelledby="readouts-title" data-live={live}>
      <p className="readouts-title" id="readouts-title">
        Instrument · last break
        <span className="lamp" aria-hidden="true" />
      </p>
      <dl aria-live="polite">
        <dt>effect</dt>
        <dd>{reading.effect ?? '—'}</dd>
        <dt>capture</dt>
        <dd>
          {value(reading.captureMs, 0)}
          <small>ms</small>
        </dd>
        <dt>shards</dt>
        <dd>{reading.shards ?? '—'}</dd>
        <dt>fracture</dt>
        <dd>
          {value(reading.fractureMs, 1)}
          <small>ms</small>
        </dd>
      </dl>
      <p className="readouts-foot">
        {live ? 'measured on this device, just now' : 'break the page to take a reading'}
      </p>
    </aside>
  );
}
