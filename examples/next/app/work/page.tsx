import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';
import { Card, swatches } from '../cards';

export const metadata: Metadata = { title: 'Work — Shatter Router Next.js example' };

export default function Work(): ReactNode {
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">Selected work</p>
        <h1>Six pieces of glass.</h1>
      </section>
      <section className="grid" aria-label="All work">
        {swatches.map((swatch, index) => (
          <Card key={swatch[0]} swatch={swatch} index={index} />
        ))}
      </section>
      <p className="footnote">
        <ShatterLink href="/about#links">How links are handled</ShatterLink>
      </p>
    </>
  );
}
