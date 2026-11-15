import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Slow — Shatter Router Next.js example' };

/** Rendered on every request, so the 400 ms wait happens on each navigation. */
export const dynamic = 'force-dynamic';

/** How long the page's data takes, ms. */
const SLOW_MS = 400;

export default async function Slow(): Promise<ReactNode> {
  await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
  return (
    <section className="hero compact">
      <p className="eyebrow">Server component</p>
      <h1>Worth the wait.</h1>
      <p className="lede" data-testid="slow-data">
        Rendered after {SLOW_MS} ms on the server.
      </p>
    </section>
  );
}
