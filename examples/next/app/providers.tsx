'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { ShatterEventName, ShatterOptions } from 'shatter-router';
import { ShatterProvider, useShatter, type WaitFor } from 'shatter-router/next';

declare global {
  interface Window {
    /** Lifecycle events seen so far (debug mode), for the e2e suite. */
    __shatterEvents?: ShatterEventName[];
  }
}

interface Settings {
  readonly options: ShatterOptions;
  readonly waitFor: WaitFor;
}

/**
 * Same query parameters as the other examples, read once on the client:
 * `?debug` (`&panel` for the debug panel), `?budget=<ms>`, `?seed=<n>`, `?shards=<n>`, `?duration=<ms>`, and
 * `?waitfor=commit`. Options render nothing, so reading them only on the
 * client cannot cause a hydration mismatch.
 */
function readSettings(): Settings {
  if (typeof window === 'undefined') return { options: {}, waitFor: 'settled' };
  const params = new URLSearchParams(window.location.search);
  const number = (name: string): number | undefined => {
    const value = Number(params.get(name));
    return params.has(name) && Number.isFinite(value) ? value : undefined;
  };
  const seed = number('seed');
  const shards = number('shards');
  const budget = number('budget');
  const duration = number('duration');
  return {
    options: {
      debug: params.has('debug') ? { panel: params.has('panel') } : false,
      ...(seed === undefined ? {} : { seed }),
      ...(shards === undefined ? {} : { shards }),
      ...(budget === undefined ? {} : { captureBudget: budget }),
      ...(duration === undefined ? {} : { duration }),
    },
    waitFor: params.get('waitfor') === 'commit' ? 'commit' : 'settled',
  };
}

/** Records lifecycle events on `window.__shatterEvents` when debug mode is on. */
function EventLog({ enabled }: { enabled: boolean }): null {
  const shatter = useShatter();
  useEffect(() => {
    if (!enabled || !shatter) return undefined;
    const events: ShatterEventName[] = (window.__shatterEvents ??= []);
    const names: ShatterEventName[] = [
      'start',
      'covered',
      'committed',
      'animating',
      'end',
      'fallback',
    ];
    const offs = names.map((name) => shatter.on(name, () => events.push(name)));
    return () => {
      for (const off of offs) off();
    };
  }, [enabled, shatter]);
  return null;
}

export function Providers({ children }: { children: ReactNode }): ReactNode {
  const [{ options, waitFor }] = useState(readSettings);
  return (
    <ShatterProvider options={options} waitFor={waitFor}>
      <EventLog enabled={Boolean(options.debug)} />
      {children}
    </ShatterProvider>
  );
}
