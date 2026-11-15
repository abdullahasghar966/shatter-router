import type { ReactNode } from 'react';

/**
 * The loading UI carries `data-shatter-pending`: with `waitFor: 'settled'`
 * (the default) the transition waits until it is gone.
 */
export default function Loading(): ReactNode {
  return (
    <section className="hero compact" data-shatter-pending="" data-testid="loading">
      <p className="eyebrow">Loading</p>
      <h1>Loading…</h1>
    </section>
  );
}
