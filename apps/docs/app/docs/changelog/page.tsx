import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Markdown } from '../../../lib/markdown';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Every release of shatter-router, and what is merged for the next one.',
};

// Read at build time (the page is static): the package's changelog, and the
// changesets merged since the last release (ADR-061). `next build` runs in
// apps/docs.
const REPO = join(process.cwd(), '..', '..');

interface Pending {
  bump: string;
  text: string;
}

const ORDER = ['major', 'minor', 'patch'];

function pending(): Pending[] {
  const dir = join(REPO, '.changeset');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map((name) => {
      const raw = readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n');
      const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
      const bump = /:\s*(major|minor|patch)/.exec(match?.[1] ?? '')?.[1] ?? 'patch';
      return { bump, text: (match?.[2] ?? raw).trim() };
    })
    .sort((a, b) => ORDER.indexOf(a.bump) - ORDER.indexOf(b.bump));
}

export default function Changelog(): ReactNode {
  const changelog = readFileSync(join(REPO, 'packages', 'shatter-router', 'CHANGELOG.md'), 'utf8')
    // The package name heading: the page has its own.
    .replace(/^# .*\n/, '');
  const next = pending();
  return (
    <>
      <p className="kicker">Docs</p>
      <h1>Changelog</h1>
      <p className="lede">
        What changed in each release of <code>shatter-router</code>, newest first, and what is
        merged for the next one.
      </p>
      {next.length > 0 ? (
        <section className="changes" aria-labelledby="unreleased">
          <h2 id="unreleased">Unreleased</h2>
          <ul>
            {next.map((change, i) => (
              <li key={i}>
                <span className="change-bump">{change.bump}</span>
                <Markdown source={change.text} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="changes" aria-label="Releases">
        <Markdown source={changelog} />
      </section>
    </>
  );
}
