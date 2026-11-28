'use client';

import { type CSSProperties, type MouseEvent, type ReactNode, useEffect, useState } from 'react';
import { ShatterLink, useShatter } from 'shatter-router/next';
import {
  type BreakWith,
  breakWithFrom,
  breakWithSearch,
  EASING_CHOICES,
  effectFor,
  effectLiteral,
  MATERIAL_CHOICES,
  PATTERN_CHOICES,
  PLAIN,
  replaceSearch,
  SLOW_FACTOR,
  studioHref,
} from '../../../lib/break-with';
import { SelectField } from '../../select-field';

interface Props {
  name: string;
  title: string;
  kicker: string;
  durationMs: number;
  pattern: string;
  colors: readonly [string, string];
}

/**
 * The effect page's stage (ADR-061): the hero breaks in place where it is
 * clicked (a transition whose commit changes nothing, like the home hero,
 * ADR-042), the Replay button breaks it from its centre, and the controls set
 * the pattern, the material, the easing and slow motion (4× the effect's own
 * duration). The settings live in the query string; the code below shows
 * them, and "Open in Studio" carries them to the playground.
 */
export function EffectStage({
  name,
  title,
  kicker,
  durationMs,
  pattern,
  colors,
}: Props): ReactNode {
  const shatter = useShatter();
  const [settings, setSettings] = useState<BreakWith>(PLAIN);

  useEffect(() => {
    setSettings(breakWithFrom(window.location.search));
  }, []);

  const update = (next: BreakWith): void => {
    setSettings(next);
    replaceSearch(breakWithSearch(next, window.location.search));
  };

  const effect = effectFor(name, durationMs, settings);
  const breakAt = (x: number, y: number): void => {
    void shatter?.transition({ commit: () => undefined, effect, origin: { x, y }, scroll: 'none' });
  };

  const onHero = (event: MouseEvent<HTMLElement>): void => {
    if ((event.target as Element).closest('a, button, select, label')) return;
    breakAt(event.clientX, event.clientY);
  };

  const onReplay = (event: MouseEvent<HTMLButtonElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    breakAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const literal = effectLiteral(effect);
  const ms = settings.slow ? durationMs * SLOW_FACTOR : durationMs;
  return (
    <>
      <header
        className="effect-hero"
        style={{ '--c1': colors[0], '--c2': colors[1] } as CSSProperties}
        onClick={onHero}
      >
        <p className="kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="effect-hint">Click anywhere here to break it</p>
      </header>
      <section className="stage-controls" aria-label="Replay this effect">
        <div className="stage-actions">
          <button type="button" className="button" onClick={onReplay}>
            Replay
          </button>
          <button
            type="button"
            className="button ghost"
            aria-pressed={settings.slow}
            onClick={() => {
              update({ ...settings, slow: !settings.slow });
            }}
          >
            Slow motion ×{SLOW_FACTOR}
          </button>
          <ShatterLink className="button ghost" href={studioHref(name, durationMs, settings)}>
            Open in Studio
          </ShatterLink>
        </div>
        <div className="break-with">
          <SelectField
            label="Pattern"
            value={settings.pattern}
            choices={PATTERN_CHOICES}
            text={(choice) => (choice === 'own' ? `its own (${pattern})` : choice)}
            onChange={(next) => {
              update({ ...settings, pattern: next });
            }}
          />
          <SelectField
            label="Material"
            value={settings.material}
            choices={MATERIAL_CHOICES}
            text={(choice) => (choice === 'site' ? 'the site’s (header)' : choice)}
            onChange={(material) => {
              update({ ...settings, material });
            }}
          />
          <SelectField
            label="Easing"
            value={settings.easing}
            choices={EASING_CHOICES}
            onChange={(easing) => {
              update({ ...settings, easing });
            }}
          />
        </div>
        <p className="stage-readout">
          motion {(ms / 1000).toFixed(1)} s{settings.slow ? ' (slow)' : ''}
        </p>
        <div className="code-block">
          <span className="code-label" aria-hidden="true">
            this break
          </span>
          <pre tabIndex={0} data-testid="effect-code">
            <code>{`createShatter({ effect: ${literal} });\n\n<ShatterLink href="/work" effect=${typeof effect === 'string' ? `"${effect}"` : `{${literal}}`}>Work</ShatterLink>`}</code>
          </pre>
        </div>
      </section>
    </>
  );
}
