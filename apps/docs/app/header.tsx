'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';

const NAV = [
  ['/effects', 'Effects'],
  ['/playground', 'Playground'],
  ['/docs', 'Docs'],
] as const;

export function Header(): ReactNode {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <ShatterLink className="brand" href="/">
        Shatter<span aria-hidden="true">/</span>
        <span className="sr-only"> </span>Router
      </ShatterLink>
      <nav aria-label="Main">
        {NAV.map(([href, label]) => (
          <ShatterLink
            key={href}
            href={href}
            {...(pathname === href || pathname.startsWith(`${href}/`)
              ? { 'aria-current': 'page' as const }
              : {})}
          >
            {label}
          </ShatterLink>
        ))}
        <a href="https://github.com/abdullahasghar966/shatter-router" rel="noopener">
          GitHub
        </a>
      </nav>
    </header>
  );
}
