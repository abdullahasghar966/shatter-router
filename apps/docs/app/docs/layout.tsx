import type { ReactNode } from 'react';
import { DocsNav, NextPage } from './docs-nav';

export default function DocsLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="docs">
      <DocsNav />
      <article className="prose">
        {children}
        <NextPage />
      </article>
    </div>
  );
}
