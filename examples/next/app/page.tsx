import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';
import { Card, swatches } from './cards';
import { NavigateButton } from './navigate-button';

export default function Home(): ReactNode {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Next.js example</p>
        <h1>Break the page.</h1>
        <p className="lede">
          A Next.js App Router app. Links are <code>&lt;ShatterLink&gt;</code> (wrapping{' '}
          <code>next/link</code>, prefetch included): modifier clicks, new tabs, downloads and other
          origins are left to the browser.
        </p>
        <div className="actions">
          <ShatterLink className="button" href="/work">
            See the work
          </ShatterLink>
          <ShatterLink className="button ghost" href="/about">
            About this example
          </ShatterLink>
          <NavigateButton />
        </div>
      </section>
      <section className="grid" aria-label="Featured">
        {swatches.slice(0, 3).map((swatch, index) => (
          <Card key={swatch[0]} swatch={swatch} index={index} />
        ))}
      </section>
    </>
  );
}
