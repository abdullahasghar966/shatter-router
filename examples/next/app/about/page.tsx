import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';

export const metadata: Metadata = { title: 'About — Shatter Router Next.js example' };

export default function About(): ReactNode {
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">About</p>
        <h1>Links that behave.</h1>
      </section>
      <section className="prose" id="links">
        <p>
          Ctrl/Cmd/Shift/Alt-click, middle-click, <code>target=&quot;_blank&quot;</code>,{' '}
          <code>download</code> and cross-origin links keep their native behaviour.
        </p>
        <ul>
          <li>
            <ShatterLink href="/work" target="_blank">
              Work in a new tab
            </ShatterLink>
          </li>
          <li>
            <ShatterLink href="/work" data-shatter="off">
              Work, opted out with data-shatter=&quot;off&quot;
            </ShatterLink>
          </li>
          <li>
            <a href="#links">Same-page anchor</a>
          </li>
        </ul>
      </section>
    </>
  );
}
