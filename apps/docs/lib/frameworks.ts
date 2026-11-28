/** The frameworks the docs show code for (ADR-061), in tab order. */
export type Framework = 'next' | 'react-router' | 'react' | 'vanilla';

export const FRAMEWORKS: readonly { id: Framework; label: string }[] = [
  { id: 'next', label: 'Next.js' },
  { id: 'react-router', label: 'React Router' },
  { id: 'react', label: 'React' },
  { id: 'vanilla', label: 'Vanilla' },
];

export const DEFAULT_FRAMEWORK: Framework = 'next';

/** Where the choice is remembered; read by the layout's script before first paint. */
export const FRAMEWORK_KEY = 'docs-framework';
