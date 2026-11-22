import {
  BUILT_IN_MATERIAL_NAMES,
  type BuiltInMaterialName,
  type Easing,
  type EffectComposition,
} from 'shatter-router';

/**
 * How the Library and the effect pages break: a pattern, a material and an
 * easing over an effect's own (ADR-061). Any motion takes any pattern and any
 * material, so these choose how a card breaks, not which cards show.
 */
export interface BreakWith {
  /** `'own'`: the effect's own pattern. */
  pattern: PatternChoice;
  /** `'site'`: the material picked in the header (every transition on the site uses it). */
  material: BuiltInMaterialName | 'site';
  easing: Easing;
  /** Four times the effect's own duration. */
  slow: boolean;
}

export const PATTERN_CHOICES = [
  'own',
  'impact',
  'radial',
  'rings',
  'triangles',
  'hex',
  'bricks',
  'tiles',
  'strips',
] as const;
export type PatternChoice = (typeof PATTERN_CHOICES)[number];

export const MATERIAL_CHOICES: readonly (BuiltInMaterialName | 'site')[] = [
  'site',
  ...BUILT_IN_MATERIAL_NAMES,
];

export const EASING_CHOICES: readonly Easing[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];

export const PLAIN: BreakWith = { pattern: 'own', material: 'site', easing: 'linear', slow: false };

/** Slow motion stretches the effect's own duration this many times. */
export const SLOW_FACTOR = 4;

/** The settings in a query string; anything missing or unknown keeps its plain value. */
export function breakWithFrom(search: string): BreakWith {
  const params = new URLSearchParams(search);
  const pattern = PATTERN_CHOICES.find((choice) => choice === params.get('pattern'));
  const material = MATERIAL_CHOICES.find((choice) => choice === params.get('material'));
  const easing = EASING_CHOICES.find((choice) => choice === params.get('easing'));
  return {
    pattern: pattern ?? PLAIN.pattern,
    material: material ?? PLAIN.material,
    easing: easing ?? PLAIN.easing,
    slow: params.get('slow') === '1',
  };
}

/**
 * The query parameters for the settings, merged into `current`: only the
 * ones that differ from plain, so a plain view keeps a clean URL. `keys`
 * limits which settings a page writes (the Library has no easing or slow).
 */
export function breakWithSearch(
  settings: BreakWith,
  current = '',
  keys: readonly (keyof BreakWith)[] = ['pattern', 'material', 'easing', 'slow'],
): string {
  const params = new URLSearchParams(current);
  for (const key of keys) {
    params.delete(key);
    const value = settings[key];
    if (value === PLAIN[key]) continue;
    params.set(key, typeof value === 'boolean' ? '1' : value);
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

/** The effect to play: the name itself, or a composition when anything is set. */
export function effectFor(
  name: string,
  durationMs: number,
  settings: BreakWith,
): string | EffectComposition {
  const pattern = settings.pattern === 'own' ? undefined : settings.pattern;
  const material = settings.material === 'site' ? undefined : settings.material;
  const easing = settings.easing === 'linear' ? undefined : settings.easing;
  const duration = settings.slow ? durationMs * SLOW_FACTOR : undefined;
  if (!pattern && !material && !easing && duration === undefined) return name;
  const timing = {
    ...(duration === undefined ? {} : { duration }),
    ...(easing ? { easing } : {}),
  };
  return {
    motion: name,
    ...(pattern ? { pattern } : {}),
    ...(material ? { material } : {}),
    ...(easing || duration !== undefined ? { timing } : {}),
  };
}

/** An effect as it is written in code: `'shatter'` or `{ motion: 'shatter', pattern: 'hex' }`. */
export function effectLiteral(effect: string | EffectComposition): string {
  if (typeof effect === 'string') return `'${effect}'`;
  const parts = [`motion: '${effect.motion}'`];
  if (effect.pattern) parts.push(`pattern: '${effect.pattern}'`);
  if (typeof effect.material === 'string') parts.push(`material: '${effect.material}'`);
  const timing: string[] = [];
  if (effect.timing?.duration !== undefined) {
    timing.push(`duration: ${String(effect.timing.duration)}`);
  }
  if (effect.timing?.easing) timing.push(`easing: '${effect.timing.easing}'`);
  if (timing.length > 0) parts.push(`timing: { ${timing.join(', ')} }`);
  return `{ ${parts.join(', ')} }`;
}

/** The Studio (playground) URL with the same settings (its query, ADR-047). */
export function studioHref(name: string, durationMs: number, settings: BreakWith): string {
  const params = new URLSearchParams({ effect: name });
  if (settings.pattern !== 'own') params.set('pattern', settings.pattern);
  if (settings.material !== 'site') params.set('material', settings.material);
  if (settings.easing !== 'linear') params.set('easing', settings.easing);
  if (settings.slow) params.set('duration', String(durationMs * SLOW_FACTOR));
  return `/playground?${params.toString()}`;
}

/** Keeps a page's settings in the address bar, without a history entry (ADR-047). */
export function replaceSearch(next: string): void {
  const { pathname, search, hash } = window.location;
  if (next === search) return;
  window.history.replaceState(window.history.state, '', `${pathname}${next}${hash}`);
}
