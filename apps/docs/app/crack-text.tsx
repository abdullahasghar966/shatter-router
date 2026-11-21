import type { ReactNode } from 'react';

/**
 * Text that splits along a crack on hover (ADR-050): two copies of the word,
 * each clipped to one side of a slanted line, slide apart a pixel or two and
 * heal. Two elements per label instead of one per letter: every element of
 * the page costs every capture (ADR-051). The first copy is the accessible
 * text; the second is decorative.
 */
export function CrackText({ children }: { children: string }): ReactNode {
  return (
    <span className="crack-text">
      <span>{children}</span>
      <span aria-hidden="true">{children}</span>
    </span>
  );
}
