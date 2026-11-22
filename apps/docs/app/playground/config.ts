import {
  BUILT_IN_MATERIAL_NAMES,
  type BuiltInMaterialName,
  type Easing,
  type Stagger,
} from 'shatter-router';
import type { Framework } from '../../lib/frameworks';

/** The playground's settings: every option, with the library's defaults. */
export interface PlaygroundConfig {
  effect: string;
  /** Order in which pieces start (ADR-048); `'default'` keeps the effect's own. */
  stagger: StaggerChoice;
  /** Fracture pattern (ADR-053); `'default'` keeps the effect's own. */
  pattern: PatternChoice;
  /** What the pieces are made of (ADR-057). */
  material: BuiltInMaterialName;
  /** Pace of the motion (ADR-059). */
  easing: Easing;
  /** 0 = `'auto'`. */
  shards: number;
  /** 0 = the effect's own duration. */
  duration: number;
  gravity: number;
  impulse: number;
  thickness: number;
  glassTint: string;
  chromatic: boolean;
  physics: 'procedural' | 'rapier';
  floor: boolean;
  /** 0 = random each time. */
  seed: number;
  debug: boolean;
}

/** The fracture patterns the panel offers (ADR-053). */
export const PATTERNS = [
  'default',
  'impact',
  'radial',
  'rings',
  'triangles',
  'hex',
  'bricks',
  'tiles',
  'strips',
] as const;
export type PatternChoice = (typeof PATTERNS)[number];

/**
 * The effect the settings describe: a name, or a composition of parts when a
 * pattern or stagger is chosen (ADR-048).
 */
export function effectOf(
  config: PlaygroundConfig,
): string | { motion: string; pattern?: string; stagger?: Stagger; timing?: { easing: Easing } } {
  const stagger = staggerOf(config.stagger);
  const pattern = config.pattern === 'default' ? undefined : config.pattern;
  const easing = config.easing === 'linear' ? undefined : config.easing;
  if (!stagger && !pattern && !easing) return config.effect;
  return {
    motion: config.effect,
    ...(pattern ? { pattern } : {}),
    ...(stagger ? { stagger } : {}),
    ...(easing ? { timing: { easing } } : {}),
  };
}

/** The paces the panel offers (ADR-059). */
export const EASINGS: readonly Easing[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];

/** The stagger orders the panel offers. */
export const STAGGERS = [
  'default',
  'radial',
  'linear',
  'top-down',
  'spiral',
  'random',
  'reading-order',
] as const;
export type StaggerChoice = (typeof STAGGERS)[number];

/** The `stagger` value a choice stands for; undefined keeps the effect's own. */
export function staggerOf(choice: StaggerChoice): Stagger | undefined {
  if (choice === 'default') return undefined;
  if (choice === 'top-down') return { type: 'linear', angle: 90 };
  return choice;
}

export const DEFAULTS: PlaygroundConfig = {
  effect: 'shatter',
  stagger: 'default',
  pattern: 'default',
  material: 'glass',
  easing: 'linear',
  shards: 0,
  duration: 0,
  gravity: 2600,
  impulse: 900,
  thickness: 6,
  glassTint: '#cfe8ff',
  chromatic: true,
  physics: 'procedural',
  floor: false,
  seed: 0,
  debug: false,
};

export const EFFECT_NAMES = [
  'shatter',
  'explode',
  'implode',
  'flip',
  'assemble',
  // Motion families (ADR-055).
  'crumble',
  'rain',
  'vortex',
  'wind',
  'blinds',
  'domino',
  'slide',
  'fold',
  'melt',
  'ripple',
  'glitch',
  'ripple-out',
];

/** The materials the panel offers (ADR-057). */
export const MATERIAL_NAMES: readonly BuiltInMaterialName[] = BUILT_IN_MATERIAL_NAMES;

type NumberKey = {
  [K in keyof PlaygroundConfig]: PlaygroundConfig[K] extends number ? K : never;
}[keyof PlaygroundConfig];

/** The panel's slider ranges; values read from a URL are clamped to them. */
export const LIMITS: Readonly<Record<NumberKey, { min: number; max: number; step: number }>> = {
  shards: { min: 0, max: 400, step: 1 },
  duration: { min: 0, max: 6000, step: 50 },
  gravity: { min: 0, max: 8000, step: 100 },
  impulse: { min: 0, max: 3000, step: 50 },
  thickness: { min: 0, max: 24, step: 1 },
  seed: { min: 0, max: 9999, step: 1 },
};

const KEYS = Object.keys(DEFAULTS) as (keyof PlaygroundConfig)[];

/**
 * The query string for the settings: only the ones that differ from the
 * defaults, so a fresh playground has a clean URL. Back to the playground,
 * a reload and a shared link all restore them (ADR-047). Other parameters in
 * `current` are kept.
 */
export function configToSearch(config: PlaygroundConfig, current = ''): string {
  const params = new URLSearchParams(current);
  for (const key of KEYS) {
    params.delete(key);
    const value = config[key];
    if (value === DEFAULTS[key]) continue;
    if (key === 'glassTint' && String(value).toLowerCase() === DEFAULTS.glassTint) continue;
    params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

/** The settings in a query string; anything missing or invalid keeps its default. */
export function configFromSearch(search: string): PlaygroundConfig {
  const params = new URLSearchParams(search);
  const config: PlaygroundConfig = { ...DEFAULTS };
  const effect = params.get('effect');
  if (effect && EFFECT_NAMES.includes(effect)) config.effect = effect;
  const stagger = STAGGERS.find((choice) => choice === params.get('stagger'));
  if (stagger) config.stagger = stagger;
  const pattern = PATTERNS.find((choice) => choice === params.get('pattern'));
  if (pattern) config.pattern = pattern;
  const material = MATERIAL_NAMES.find((choice) => choice === params.get('material'));
  if (material) config.material = material;
  const easing = EASINGS.find((choice) => choice === params.get('easing'));
  if (easing) config.easing = easing;
  for (const key of Object.keys(LIMITS) as NumberKey[]) {
    const raw = params.get(key);
    if (raw === null || raw.trim() === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const { min, max } = LIMITS[key];
    config[key] = Math.min(max, Math.max(min, Math.round(value)));
  }
  const tint = params.get('glassTint');
  if (tint && /^#[0-9a-f]{6}$/i.test(tint)) config.glassTint = tint.toLowerCase();
  const physics = params.get('physics');
  if (physics === 'procedural' || physics === 'rapier') config.physics = physics;
  for (const key of ['chromatic', 'floor', 'debug'] as const) {
    const raw = params.get(key);
    // A bare `?debug` (the site's own debug switch) counts as on.
    if (raw === '' || raw === '1' || raw === 'true') config[key] = true;
    else if (raw === '0' || raw === 'false') config[key] = false;
  }
  return config;
}

/** A named composition in the Studio (ADR-061): the defaults plus a few settings. */
export interface Preset {
  readonly name: string;
  readonly note: string;
  readonly settings: Partial<PlaygroundConfig>;
}

export const PRESETS: readonly Preset[] = [
  {
    name: 'Windscreen',
    note: 'a blast through a spider web of glass',
    settings: { effect: 'explode', pattern: 'radial', material: 'glass' },
  },
  {
    name: 'Frost',
    note: 'a frozen pane that drops, easing out',
    settings: { effect: 'shatter', material: 'ice', easing: 'ease-out', shards: 220 },
  },
  {
    name: 'Obsidian vortex',
    note: 'dark glass flung up in a spiral',
    settings: { effect: 'vortex', pattern: 'triangles', material: 'obsidian', stagger: 'spiral' },
  },
  {
    name: 'Paper deal',
    note: 'paper tiles dealt off in reading order',
    settings: { effect: 'slide', pattern: 'tiles', material: 'paper', stagger: 'reading-order' },
  },
  {
    name: 'Honeycomb fold',
    note: 'mirror hexagons folding toward the click',
    settings: { effect: 'fold', pattern: 'hex', material: 'mirror' },
  },
  {
    name: 'Holo glitch',
    note: 'an iridescent signal dropping out',
    settings: { effect: 'glitch', material: 'holo' },
  },
];

/** The settings of a preset: everything else back to the defaults (debug kept). */
export function presetConfig(preset: Preset, current: PlaygroundConfig): PlaygroundConfig {
  return { ...DEFAULTS, ...preset.settings, debug: current.debug };
}

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.min(items.length - 1, Math.floor(random() * items.length))];
  if (item === undefined) throw new Error('pick from an empty list');
  return item;
}

function between(min: number, max: number, step: number, random: () => number): number {
  return min + Math.round((random() * (max - min)) / step) * step;
}

/**
 * Random settings (ADR-061): a motion, pattern, stagger, material and easing,
 * with motion values in a range that still reads well. Physics stays
 * procedural (Rapier is a 1.7 MB download), the seed random, debug as it was.
 */
export function randomConfig(current: PlaygroundConfig, random = Math.random): PlaygroundConfig {
  return {
    ...DEFAULTS,
    effect: pick(EFFECT_NAMES, random),
    pattern: pick(PATTERNS, random),
    stagger: pick(STAGGERS, random),
    material: pick(MATERIAL_NAMES, random),
    easing: pick(EASINGS, random),
    shards: between(40, 240, 10, random),
    gravity: between(1600, 4000, 100, random),
    impulse: between(500, 1600, 50, random),
    thickness: between(3, 12, 1, random),
    debug: current.debug,
  };
}

const ADAPTERS: Readonly<Record<Exclude<Framework, 'vanilla'>, { from: string; where: string }>> = {
  next: {
    from: 'shatter-router/next',
    where: '// app/shatter.tsx: wrap {children} in app/layout.tsx',
  },
  'react-router': {
    from: 'shatter-router/react-router',
    where: '// Render inside the router, in your root route (see Getting started)',
  },
  react: {
    from: 'shatter-router/react',
    where: '// Wrap your app; pass navigate={…} to connect your router',
  },
};

/**
 * The code that matches the settings for one framework (ADR-061): a
 * `createShatter({...})` call for vanilla, a `<ShatterProvider options>`
 * component for the React adapters. Options left at their defaults are
 * omitted (the effect is always shown).
 */
export function configCode(config: PlaygroundConfig, framework: Framework = 'vanilla'): string {
  const lines = optionLines(config);
  const custom = config.effect === 'ripple-out';
  const extra = [
    ...(config.physics === 'rapier' ? [`import { rapier } from 'shatter-router/rapier';`] : []),
    ...(custom
      ? [`import { rippleOut } from './effects/ripple-out'; // see “Writing a custom effect”`]
      : []),
  ];
  if (framework === 'vanilla') {
    const imports = [`import { createShatter } from 'shatter-router';`, ...extra];
    const register = custom ? '\nshatter.registerEffect(rippleOut);' : '';
    return `${imports.join('\n')}\n\nconst shatter = createShatter({\n${lines.join('\n')}\n});${register}\n`;
  }
  const adapter = ADAPTERS[framework];
  const imports = [
    ...(framework === 'next' ? [`'use client';`, ''] : []),
    ...(custom ? [`import { useEffect } from 'react';`] : []),
    `import { ShatterProvider${custom ? ', useShatter' : ''} } from '${adapter.from}';`,
    ...extra,
  ];
  const options = lines.map((line) => `      ${line}`).join('\n');
  const children = custom ? '      <RegisterEffects />\n      {children}' : '      {children}';
  const register = custom
    ? [
        '',
        '',
        '// Inside the provider: makes the custom effect available by name.',
        'function RegisterEffects() {',
        '  const shatter = useShatter();',
        '  useEffect(() => {',
        '    shatter?.registerEffect(rippleOut);',
        '  }, [shatter]);',
        '  return null;',
        '}',
      ].join('\n')
    : '';
  return [
    imports.join('\n'),
    '',
    adapter.where,
    'export function Shatter({ children }) {',
    '  return (',
    '    <ShatterProvider',
    '      options={{',
    options,
    '      }}',
    '    >',
    children,
    '    </ShatterProvider>',
    '  );',
    `}${register}`,
    '',
  ].join('\n');
}

/** The option lines of the config, each indented by two spaces. */
function optionLines(config: PlaygroundConfig): string[] {
  const effect = effectOf(config);
  const parts: string[] = [];
  if (typeof effect !== 'string') {
    parts.push(`motion: '${effect.motion}'`);
    if (effect.pattern) parts.push(`pattern: '${effect.pattern}'`);
    const stagger = effect.stagger;
    if (stagger !== undefined) {
      parts.push(
        `stagger: ${typeof stagger === 'string' ? `'${stagger}'` : `{ type: 'linear', angle: ${String(stagger.angle)} }`}`,
      );
    }
    if (effect.timing) parts.push(`timing: { easing: '${effect.timing.easing}' }`);
  }
  // A pattern or stagger makes the effect a composition of parts (ADR-048).
  const lines: string[] = [
    typeof effect === 'string' ? `  effect: '${effect}',` : `  effect: { ${parts.join(', ')} },`,
  ];
  if (config.material !== DEFAULTS.material) lines.push(`  material: '${config.material}',`);
  if (config.shards !== DEFAULTS.shards) lines.push(`  shards: ${String(config.shards)},`);
  if (config.duration !== DEFAULTS.duration) lines.push(`  duration: ${String(config.duration)},`);
  if (config.gravity !== DEFAULTS.gravity) lines.push(`  gravity: ${String(config.gravity)},`);
  if (config.impulse !== DEFAULTS.impulse) lines.push(`  impulse: ${String(config.impulse)},`);
  if (config.thickness !== DEFAULTS.thickness) {
    lines.push(`  thickness: ${String(config.thickness)},`);
  }
  if (config.glassTint.toLowerCase() !== DEFAULTS.glassTint) {
    lines.push(`  glassTint: '${config.glassTint.toLowerCase()}',`);
  }
  if (!config.chromatic) lines.push('  chromatic: false,');
  if (config.physics === 'rapier') {
    lines.push(`  physics: rapier(${config.floor ? '{ floor: true }' : ''}),`);
  }
  if (config.seed !== DEFAULTS.seed) lines.push(`  seed: ${String(config.seed)},`);
  if (config.debug) lines.push('  debug: true,');
  return lines;
}
