'use client';

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { ShatterLink } from 'shatter-router/next';
import {
  type BreakWith,
  breakWithFrom,
  breakWithSearch,
  effectFor,
  MATERIAL_CHOICES,
  PATTERN_CHOICES,
  PLAIN,
  replaceSearch,
} from '../../lib/break-with';
import { EFFECTS, FAMILIES, type Family } from '../../lib/effects';
import { useHoverHoldBreak, type StageEffect } from '../live-stage';
import { SelectField } from '../select-field';

type FamilyChoice = Family | 'all';

/**
 * The card's art is a live stage (ADR-067): resting the pointer on it breaks
 * it in place with the card's effect, with the pattern and material chosen.
 */
function StageArt({ effect }: { readonly effect: StageEffect }): ReactNode {
  const ref = useRef<HTMLSpanElement>(null);
  useHoverHoldBreak(ref, effect);
  return <span ref={ref} className="card-art" aria-hidden="true" />;
}

function familyFrom(search: string): FamilyChoice {
  const value = new URLSearchParams(search).get('family');
  return FAMILIES.find((family) => family.id === value)?.id ?? 'all';
}

function librarySearch(family: FamilyChoice, settings: BreakWith, current: string): string {
  const params = new URLSearchParams(breakWithSearch(settings, current, ['pattern', 'material']));
  if (family === 'all') params.delete('family');
  else params.set('family', family);
  const search = params.toString();
  return search ? `?${search}` : '';
}

/**
 * The Library (ADR-061): every effect by family, a family filter, and the
 * pattern and material every card breaks with. The view lives in the query
 * string (written with replaceState), so Back to the Library shows it again;
 * the server renders the plain view and the URL's view applies after mount,
 * like the playground (ADR-047).
 */
export function Library(): ReactNode {
  const [family, setFamily] = useState<FamilyChoice>('all');
  const [settings, setSettings] = useState<BreakWith>(PLAIN);

  useEffect(() => {
    setFamily(familyFrom(window.location.search));
    setSettings(breakWithFrom(window.location.search));
  }, []);

  const update = (nextFamily: FamilyChoice, next: BreakWith): void => {
    setFamily(nextFamily);
    setSettings(next);
    replaceSearch(librarySearch(nextFamily, next, window.location.search));
  };

  const shown = FAMILIES.filter((group) => family === 'all' || group.id === family);
  const count = EFFECTS.filter((effect) => family === 'all' || effect.family === family).length;
  // The effect page starts with the same pattern and material.
  const query = breakWithSearch(settings, '', ['pattern', 'material']);

  return (
    <>
      <div className="library-controls">
        <div className="chips" role="group" aria-label="Family">
          {(['all', ...FAMILIES.map((group) => group.id)] as const).map((id) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={family === id}
              onClick={() => {
                update(id, settings);
              }}
            >
              {id === 'all' ? 'All' : (FAMILIES.find((group) => group.id === id)?.title ?? id)}
            </button>
          ))}
        </div>
        <div className="break-with">
          <SelectField
            label="Pattern"
            value={settings.pattern}
            choices={PATTERN_CHOICES}
            text={(choice) => (choice === 'own' ? 'each effect’s own' : choice)}
            onChange={(pattern) => {
              update(family, { ...settings, pattern });
            }}
          />
          <SelectField
            label="Material"
            value={settings.material}
            choices={MATERIAL_CHOICES}
            text={(choice) => (choice === 'site' ? 'the site’s (header)' : choice)}
            onChange={(material) => {
              update(family, { ...settings, material });
            }}
          />
        </div>
        <p className="library-count" role="status">
          {count === EFFECTS.length
            ? `${String(count)} effects`
            : `${String(count)} of ${String(EFFECTS.length)} effects`}
        </p>
      </div>
      {shown.map((group) => (
        <section key={group.id} className="family" aria-labelledby={`family-${group.id}`}>
          <header className="family-head">
            <h2 id={`family-${group.id}`}>{group.title}</h2>
            <p>{group.summary}</p>
          </header>
          <ul className="gallery">
            {EFFECTS.filter((effect) => effect.family === group.id).map((effect) => {
              const stage = effectFor(effect.name, effect.durationMs, { ...settings, slow: false });
              return (
                <li key={effect.name}>
                  <ShatterLink
                    className="card"
                    href={`/effects/${effect.name}${query}`}
                    effect={stage}
                    style={{ '--c1': effect.colors[0], '--c2': effect.colors[1] } as CSSProperties}
                  >
                    <StageArt effect={stage} />
                    <p className="tag">
                      {effect.custom ? 'Custom effect' : `effect: '${effect.name}'`}
                    </p>
                    <h3>{effect.title}</h3>
                    <p>{effect.summary}</p>
                    <p className="card-meta">
                      {settings.pattern === 'own' ? effect.pattern : settings.pattern} ·{' '}
                      {(effect.durationMs / 1000).toFixed(1)} s
                    </p>
                  </ShatterLink>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
