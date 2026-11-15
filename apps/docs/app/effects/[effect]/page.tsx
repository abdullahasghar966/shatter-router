import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';
import { EFFECTS, findEffect } from '../../../lib/effects';
import { Code } from '../../code';

interface Props {
  params: Promise<{ effect: string }>;
}

export const dynamicParams = false;

export function generateStaticParams(): { effect: string }[] {
  return EFFECTS.map((effect) => ({ effect: effect.name }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const effect = findEffect((await params).effect);
  return effect ? { title: `${effect.title} effect`, description: effect.summary } : {};
}

export default async function EffectPage({ params }: Props): Promise<ReactNode> {
  const effect = findEffect((await params).effect);
  if (!effect) notFound();
  const others = EFFECTS.filter((other) => other.name !== effect.name);
  return (
    <>
      <header
        className="effect-hero"
        style={{ '--c1': effect.colors[0], '--c2': effect.colors[1] } as CSSProperties}
      >
        <p className="kicker">{effect.custom ? 'Custom effect' : 'Built-in effect'}</p>
        <h1>{effect.title}</h1>
      </header>
      <div className="effect-body">
        <div className="prose">
          <p className="lede">{effect.summary}</p>
          <h2>How it moves</h2>
          <p>{effect.motion}</p>
          <h2>How it ends</h2>
          <p>{effect.ends}</p>
          <h2>Use it</h2>
          {effect.custom ? (
            <>
              <p>
                Register the effect once, then name it like a built-in one. The full source is in{' '}
                <ShatterLink href="/docs/custom-effects">Writing a custom effect</ShatterLink>.
              </p>
              <Code lang="ts">{`
import { rippleOut } from './effects/ripple-out';

shatter.registerEffect(rippleOut);
`}</Code>
            </>
          ) : (
            <p>For every navigation, for one link, or for one call:</p>
          )}
          <Code lang="tsx">{`
createShatter({ effect: '${effect.name}' });

<ShatterLink href="/work" effect="${effect.name}">Work</ShatterLink>

<a href="/work" data-shatter-effect="${effect.name}">Work</a>
`}</Code>
        </div>
        <nav className="effect-nav" aria-label="Other effects">
          <h2>Try another</h2>
          <ul>
            {others.map((other) => (
              <li key={other.name}>
                <ShatterLink href={`/effects/${other.name}`} effect={other.name}>
                  {other.title}
                </ShatterLink>
              </li>
            ))}
            <li>
              <ShatterLink href="/effects">All effects</ShatterLink>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
