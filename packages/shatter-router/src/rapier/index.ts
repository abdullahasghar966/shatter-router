import type { PhysicsPlugin } from '../core/physics';

export interface RapierOptions {
  /** A floor along the bottom edge of the viewport: shards pile up and slide before fading. Default false. */
  floor?: boolean;
}

/**
 * Rigid-body physics for `shatter` and `explode` with Rapier
 * (`@dimforge/rapier3d-compat`, an optional peer dependency):
 *
 * ```ts
 * import { createShatter } from 'shatter-router';
 * import { rapier } from 'shatter-router/rapier';
 * const shatter = createShatter({ physics: rapier({ floor: true }), duration: 2000 });
 * ```
 *
 * Rapier (4.3 MB, 1.65 MB gzip: WebAssembly inlined as base64, measured for
 * 0.21.0) is loaded with a dynamic `import()`
 * when the browser is idle, never before `createShatter` runs. Under a
 * Content-Security-Policy it needs `script-src 'wasm-unsafe-eval'`; if it
 * cannot load, transitions use the procedural motion.
 */
export function rapier(options: RapierOptions = {}): PhysicsPlugin {
  const floor = options.floor ?? false;
  return {
    name: 'rapier',
    load: async () => (await import('./backend')).createRapierBackend({ floor }),
  };
}
