/** The playground's settings: every option, with the library's defaults. */
export interface PlaygroundConfig {
  effect: string;
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

export const DEFAULTS: PlaygroundConfig = {
  effect: 'shatter',
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

export const EFFECT_NAMES = ['shatter', 'explode', 'implode', 'flip', 'assemble', 'ripple-out'];

/**
 * The `createShatter({...})` call that matches the settings. Options left at
 * their defaults are omitted (the effect is always shown).
 */
export function configCode(config: PlaygroundConfig): string {
  const lines: string[] = [`  effect: '${config.effect}',`];
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

  const imports = [`import { createShatter } from 'shatter-router';`];
  if (config.physics === 'rapier') imports.push(`import { rapier } from 'shatter-router/rapier';`);
  if (config.effect === 'ripple-out') {
    imports.push(
      `import { rippleOut } from './effects/ripple-out'; // see “Writing a custom effect”`,
    );
  }
  const register = config.effect === 'ripple-out' ? '\nshatter.registerEffect(rippleOut);' : '';
  return `${imports.join('\n')}\n\nconst shatter = createShatter({\n${lines.join('\n')}\n});${register}\n`;
}
