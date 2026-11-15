import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';

export default function NotFound(): ReactNode {
  return (
    <section className="hero compact">
      <p className="eyebrow">404</p>
      <h1>Nothing here.</h1>
      <p className="lede">
        <ShatterLink href="/">Back home</ShatterLink>
      </p>
    </section>
  );
}
