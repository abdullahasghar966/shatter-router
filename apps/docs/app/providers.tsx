'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { ShatterEventName, ShatterOptions } from 'shatter-router';
import { ShatterProvider, useShatter } from 'shatter-router/next';
import { rippleOut } from '../effects/ripple-out';

declare global {
  interface Window {
    /** Lifecycle events seen so far (debug mode), for the e2e suite. */
    __shatterEvents?: ShatterEventName[];
  }
}

/**
 * The site's options. Like the examples, `?debug` (with `&panel` for the
 * debug panel), `?budget=<ms>` and `?seed=<n>` are read once on the client for
 * the e2e suite; options render nothing, so there is no hydration mismatch.
 */
function readOptions(): ShatterOptions {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const number = (name: string): number | undefined => {
    const value = Number(params.get(name));
    return params.has(name) && Number.isFinite(value) ? value : undefined;
  };
  const seed = number('seed');
  const budget = number('budget');
  return {
    debug: params.has('debug') ? { panel: params.has('panel') } : false,
    ...(seed === undefined ? {} : { seed }),
    ...(budget === undefined ? {} : { captureBudget: budget }),
  };
}

/** Registers the custom effect so links can name it (`effect="ripple-out"`). */
function RegisterEffects(): null {
  const shatter = useShatter();
  useEffect(() => {
    shatter?.registerEffect(rippleOut);
  }, [shatter]);
  return null;
}

/** Records lifecycle events on `window.__shatterEvents` in debug mode. */
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
  const [options] = useState(readOptions);
  return (
    <ShatterProvider options={options}>
      <RegisterEffects />
      <EventLog enabled={Boolean(options.debug)} />
      {children}
    </ShatterProvider>
  );
}
