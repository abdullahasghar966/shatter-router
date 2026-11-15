import type { ReactNode } from 'react';

/** A code block with a small language label. No highlighting: the type does the work. */
export function Code({ lang, children }: { lang: string; children: string }): ReactNode {
  return (
    <div className="code-block">
      <span className="code-label" aria-hidden="true">
        {lang}
      </span>
      <pre tabIndex={0}>
        <code>{children.trim()}</code>
      </pre>
    </div>
  );
}
