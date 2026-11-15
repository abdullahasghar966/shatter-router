import type { CSSProperties, ReactNode } from 'react';

export const swatches = [
  ['Ember', '#ff5a36', '#ffb199'],
  ['Lagoon', '#1fb6a6', '#a7f3e8'],
  ['Iris', '#6d5efc', '#c9c3ff'],
  ['Citrine', '#f2c94c', '#fff1bf'],
  ['Moss', '#3f8f4f', '#bfe6c6'],
  ['Rose', '#e8457c', '#ffc2d6'],
] as const;

export function Card({
  swatch,
  index,
}: {
  swatch: (typeof swatches)[number];
  index: number;
}): ReactNode {
  const [name, from, to] = swatch;
  return (
    <article className="card" style={{ '--from': from, '--to': to } as CSSProperties}>
      <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
      <h3>{name}</h3>
      <p>Case study {index + 1}: a page that breaks beautifully.</p>
    </article>
  );
}
