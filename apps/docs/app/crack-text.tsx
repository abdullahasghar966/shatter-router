import type { CSSProperties, ReactNode } from 'react';

/** A small deterministic offset per letter, so server and client agree. */
function jitter(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

/**
 * Text that splits along a crack on hover (ADR-050): each letter shifts a
 * little up or down depending on which side of a slanted line it is, then
 * heals. Screen readers get the plain text; the letters are decorative.
 */
export function CrackText({ children }: { children: string }): ReactNode {
  // Labels are short ASCII words: code points are the letters.
  const letters = Array.from(children);
  const middle = (letters.length - 1) / 2;
  return (
    <>
      <span className="sr-only">{children}</span>
      <span className="crack-text" aria-hidden="true">
        {letters.map((letter, i) => {
          const side = i <= middle ? -1 : 1;
          const style = {
            '--dx': `${(side * 0.6 + jitter(i, 1) * 0.6).toFixed(2)}px`,
            '--dy': `${(side * 1.6 + jitter(i, 2) * 1.2).toFixed(2)}px`,
            '--dr': `${(jitter(i, 3) * 7).toFixed(1)}deg`,
          } as CSSProperties;
          return (
            // Letters may repeat: the index is the identity.
            <span key={i} style={style}>
              {letter === ' ' ? ' ' : letter}
            </span>
          );
        })}
      </span>
    </>
  );
}
