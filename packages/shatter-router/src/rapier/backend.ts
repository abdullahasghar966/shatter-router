import RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsBackend } from '../core/physics';
import { RapierSimulation, type RapierSimulationOptions } from './simulation';

let ready: Promise<void> | null = null;

/**
 * Initialises Rapier's WebAssembly once (it needs `script-src
 * 'wasm-unsafe-eval'` under a Content-Security-Policy) and returns the backend.
 */
export async function createRapierBackend(
  options: RapierSimulationOptions,
): Promise<PhysicsBackend> {
  ready ??= RAPIER.init().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  await ready;
  return {
    createSimulation: (setup) => new RapierSimulation(RAPIER, setup, options),
  };
}
