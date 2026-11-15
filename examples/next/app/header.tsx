'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';

const NAV = [
  ['/', 'Home'],
  ['/work', 'Work'],
  ['/about', 'About'],
  ['/slow', 'Slow'],
] as const;

export function Header(): ReactNode {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <ShatterLink className="brand" href="/">
        Shatter<span>/</span>Router
      </ShatterLink>
      <nav aria-label="Main">
        {NAV.map(([href, label]) => (
          <ShatterLink
            key={href}
            href={href}
            {...(pathname === href ? { 'aria-current': 'page' as const } : {})}
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
