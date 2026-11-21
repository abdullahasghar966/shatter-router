'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { createShatter, type Shatter, type ShatterOptions } from 'shatter-router';
import { rippleOut } from '../../effects/ripple-out';
import {
  configCode,
  configFromSearch,
  configToSearch,
  DEFAULTS,
  EFFECT_NAMES,
  LIMITS,
  type PlaygroundConfig,
  effectOf,
  PATTERNS,
  STAGGERS,
} from './config';

/** Sliders fire on every step; browsers limit replaceState calls (Safari throws). */
const URL_WRITE_DELAY_MS = 250;

/** Keeps the settings in the address bar, without a history entry. */
function writeUrl(config: PlaygroundConfig): void {
  const { pathname, search, hash } = window.location;
  const next = configToSearch(config, search);
  if (next === search) return;
  const url = `${pathname}${next}${hash}`;
  window.history.replaceState(window.history.state, '', url);
}

const SCENES = [
  { title: 'Glass', note: 'scene one of two', colors: ['#ff6a45', '#ffc2a8'] },
  { title: 'Shards', note: 'scene two of two', colors: ['#2cb5a0', '#c3f3e8'] },
] as const;

/** The site's `?budget=<ms>` test switch, read once like `providers.tsx` does. */
function captureBudget(): { captureBudget?: number } {
  const raw = new URLSearchParams(window.location.search).get('budget');
  const value = Number(raw);
  return raw !== null && Number.isFinite(value) ? { captureBudget: value } : {};
}

async function optionsFor(config: PlaygroundConfig): Promise<ShatterOptions> {
  const physics =
    config.physics === 'rapier'
      ? (await import('shatter-router/rapier')).rapier({ floor: config.floor })
      : 'procedural';
  return {
    // A pattern or stagger makes the effect a composition of parts (ADR-048).
    effect: effectOf(config),
    shards: config.shards === 0 ? 'auto' : config.shards,
    ...(config.duration === 0 ? {} : { duration: config.duration }),
    gravity: config.gravity,
    impulse: config.impulse,
    thickness: config.thickness,
    glassTint: config.glassTint,
    chromatic: config.chromatic,
    physics,
    ...(config.seed === 0 ? {} : { seed: config.seed }),
    debug: config.debug,
    // Like the site's own instance, `?budget=<ms>` (e2e on slow machines).
    ...captureBudget(),
    // reducedMotion stays at its default: the playground respects the
    // user's setting like any other page.
  };
}

/**
 * Tweakpane shows each row's label in a sibling element, not a `<label>`, so
 * its inputs, selects and the colour swatch have no accessible name. Name
 * them after the row's label (`.tp-lblv_l`, the label view in tweakpane.js).
 */
function nameControls(container: HTMLElement): void {
  for (const row of container.querySelectorAll('.tp-lblv')) {
    const label = row.querySelector('.tp-lblv_l')?.textContent.trim();
    if (!label) continue;
    for (const control of row.querySelectorAll('.tp-lblv_v input, .tp-lblv_v select')) {
      control.setAttribute('aria-label', label);
    }
    for (const button of row.querySelectorAll('.tp-lblv_v button')) {
      if (!button.textContent.trim()) button.setAttribute('aria-label', `${label}: pick a colour`);
    }
  }
}

/**
 * The playground: a stage that breaks on click with the panel's settings,
 * using its own Shatter instance (the site's instance keeps the site's
 * options). The instance is rebuilt on the next click after a change. The
 * settings live in the URL's query, so Back, a reload and a shared link
 * bring them back.
 */
export function Playground(): ReactNode {
  const [config, setConfig] = useState<PlaygroundConfig>(DEFAULTS);
  const [scene, setScene] = useState(0);
  const [copied, setCopied] = useState('');
  const paneHost = useRef<HTMLDivElement>(null);
  const instance = useRef<{ shatter: Shatter; config: PlaygroundConfig } | null>(null);

  // Tweakpane, loaded on demand so it is not part of the page's first load.
  useEffect(() => {
    let disposed = false;
    let dispose = (): void => undefined;
    let pending: number | undefined;
    void import('tweakpane').then(({ Pane }) => {
      const container = paneHost.current;
      if (disposed || !container) return;
      const params = configFromSearch(window.location.search);
      setConfig({ ...params });
      const pane = new Pane({ container, title: 'Options' });
      pane.addBinding(params, 'effect', {
        options: Object.fromEntries(EFFECT_NAMES.map((name) => [name, name])),
      });
      pane.addBinding(params, 'pattern', {
        options: Object.fromEntries(PATTERNS.map((name) => [name, name])),
      });
      pane.addBinding(params, 'stagger', {
        options: Object.fromEntries(STAGGERS.map((name) => [name, name])),
      });
      pane.addBinding(params, 'shards', { ...LIMITS.shards, label: 'shards (0 = auto)' });
      pane.addBinding(params, 'duration', {
        ...LIMITS.duration,
        label: 'duration ms (0 = effect)',
      });
      const motion = pane.addFolder({ title: 'Motion' });
      motion.addBinding(params, 'gravity', LIMITS.gravity);
      motion.addBinding(params, 'impulse', LIMITS.impulse);
      motion.addBinding(params, 'physics', {
        options: { procedural: 'procedural', rapier: 'rapier' },
      });
      motion.addBinding(params, 'floor', { label: 'floor (rapier)' });
      const glass = pane.addFolder({ title: 'Glass' });
      glass.addBinding(params, 'thickness', LIMITS.thickness);
      glass.addBinding(params, 'glassTint', { label: 'tint' });
      glass.addBinding(params, 'chromatic');
      const more = pane.addFolder({ title: 'More', expanded: false });
      more.addBinding(params, 'seed', { ...LIMITS.seed, label: 'seed (0 = random)' });
      more.addBinding(params, 'debug');
      pane.addButton({ title: 'Reset' }).on('click', () => {
        Object.assign(params, DEFAULTS);
        pane.refresh();
      });
      pane.on('change', (event) => {
        setConfig({ ...params });
        window.clearTimeout(pending);
        // The end of a drag (or a select, a toggle) is written at once.
        if (event.last) writeUrl(params);
        else {
          pending = window.setTimeout(() => {
            writeUrl(params);
          }, URL_WRITE_DELAY_MS);
        }
      });
      nameControls(container);
      dispose = () => {
        pane.dispose();
      };
    });
    return () => {
      disposed = true;
      window.clearTimeout(pending);
      dispose();
    };
  }, []);

  useEffect(
    () => () => {
      instance.current?.shatter.destroy();
      instance.current = null;
    },
    [],
  );

  const shatterFor = async (current: PlaygroundConfig): Promise<Shatter> => {
    if (instance.current?.config === current) return instance.current.shatter;
    instance.current?.shatter.destroy();
    const shatter = createShatter(await optionsFor(current));
    shatter.registerEffect(rippleOut);
    instance.current = { shatter, config: current };
    return shatter;
  };

  const onStage = (event: MouseEvent<HTMLButtonElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    // Keyboard activation reports 0,0: break from the stage's centre.
    const origin =
      event.detail > 0
        ? { x: event.clientX, y: event.clientY }
        : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    void shatterFor(config).then((shatter) =>
      shatter.transition({
        origin,
        scroll: 'none',
        commit: () => {
          flushSync(() => {
            setScene((value) => 1 - value);
          });
        },
      }),
    );
  };

  const code = configCode(config);
  const onCopy = (): void => {
    navigator.clipboard.writeText(code).then(
      () => {
        setCopied('Copied.');
      },
      () => {
        setCopied('Copy failed: select the code below instead.');
      },
    );
  };

  const current = SCENES[scene] ?? SCENES[0];
  return (
    <>
      <div className="playground">
        <button
          type="button"
          className="stage"
          onClick={onStage}
          style={{ '--c1': current.colors[0], '--c2': current.colors[1] } as CSSProperties}
          aria-describedby="stage-help"
        >
          <span>
            <span className="stage-title" data-testid="stage-title">
              {current.title}
            </span>
            <span className="stage-note">{current.note} · click to break</span>
          </span>
        </button>
        <div className="pane-host" ref={paneHost} />
      </div>
      <p id="stage-help" className="sr-only">
        Breaks the page with the options from the panel and swaps the scene.
      </p>
      <section className="config" aria-labelledby="config-title">
        <div className="config-head">
          <h2 id="config-title">Your config</h2>
          <button type="button" className="button" onClick={onCopy}>
            Copy config
          </button>
        </div>
        <p role="status" className="copy-status">
          {copied}
        </p>
        <pre tabIndex={0} data-testid="config-code">
          <code>{code}</code>
        </pre>
      </section>
    </>
  );
}
