'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';
import { DOCS } from '../../lib/docs';

export function DocsNav(): ReactNode {
  const pathname = usePathname();
  return (
    <nav className="docs-nav" aria-label="Documentation">
      <ul>
        {DOCS.map(([href, label]) => (
          <li key={href}>
            <ShatterLink
              href={href}
              {...(pathname === href ? { 'aria-current': 'page' as const } : {})}
            >
              {label}
            </ShatterLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** "Next: …" at the end of each page. */
export function NextPage(): ReactNode {
  const pathname = usePathname();
  const index = DOCS.findIndex(([href]) => href === pathname);
  const next = index >= 0 ? DOCS[index + 1] : undefined;
  if (!next) return null;
  return (
    <p className="next-page">
      Next: <ShatterLink href={next[0]}>{next[1]}</ShatterLink>
    </p>
  );
}
