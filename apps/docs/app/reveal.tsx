import { Fragment, type CSSProperties, type ReactNode } from 'react';

/**
 * Words that rise into place on the first page load only (ADR-050): the
 * `.reveal` animation is off once `<html data-entered>` is set (by `Lab`,
 * after the entrance or at the first transition), so client navigations,
 * whose entrance is the transition itself, never animate under the glass.
 * The spaces sit between the word boxes: inside an inline-block a trailing
 * space collapses.
 */
export function Reveal({ text, from = 0 }: { text: string; from?: number }): ReactNode {
  const words = text.split(' ');
  return (
    <span className="reveal">
      {words.map((word, i) => (
        // Words may repeat: the index is the identity.
        <Fragment key={i}>
          {i > 0 ? ' ' : null}
          <span style={{ '--i': from + i } as CSSProperties}>{word}</span>
        </Fragment>
      ))}
    </span>
  );
}
