import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';

export default function NotFound(): ReactNode {
  return (
    <section className="not-found" aria-labelledby="nf-title">
      <p className="kicker">404</p>
      <h1 id="nf-title">Nothing here to break.</h1>
      <p className="lede">This page does not exist.</p>
      <p>
        <ShatterLink className="button" href="/">
          Back to the start
        </ShatterLink>
      </p>
    </section>
  );
}
