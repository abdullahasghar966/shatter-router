import type { CDPSession } from '@playwright/test';

/**
 * Exact allocation counting with the Chrome DevTools Protocol (ADR-040):
 * `HeapProfiler.startTrackingHeapObjects({ trackAllocations: true })` records
 * the stack of every allocation; stopping it takes a heap snapshot whose
 * `trace_tree` holds, per call-tree node, how many objects were allocated
 * there (freed ones included). The sampling profiler is no use here: a
 * planted 44 B allocation per frame showed up in 2 of 22 frames.
 */

/** Lazy chunks that hold the render loop (the core is bundled into the app's main chunk). */
const LOOP_CHUNKS = /\/assets\/(engine|runtime|rapier-backend)-[\w-]+\.js$/;

/** `RapierSimulation` methods that run every frame (src/rapier/simulation.ts). */
const SIMULATION_METHODS = new Set(['advance', 'release', 'write', 'get finished', 'finished']);

/**
 * Engine functions that run inside the loop but once per run or per effect,
 * never per frame: `FrameLoop.stop` builds the run's stats object, and
 * `ensureEffectProgram` compiles an effect's program on its first draw (in CI
 * a warm-up `flip` can fall back to `shatter`, leaving `flip` uncompiled).
 */
const ONCE_PER_RUN = new Set(['stop', 'ensureEffectProgram']);

/**
 * V8 HeapNumber with pointer compression: a map word and a double. With
 * allocation tracking on, V8 runs the loop unoptimised and boxes every double
 * it stores or passes on: a stream of 12 B objects that optimised code avoids
 * (and that is no garbage worth the name). Anything else costs more than 12 B
 * per object, so `size - 12 × count` measures real objects.
 */
export const HEAP_NUMBER_BYTES = 12;

export interface LoopAllocations {
  /** Objects allocated with the engine's `FrameLoop.tick` on the stack, by our code. */
  readonly ours: number;
  /** Their bytes beyond 12 per object: 0 when they are all boxed numbers. */
  readonly oursExcessBytes: number;
  /** Objects allocated inside Rapier (getters, `World.step`, wasm-bindgen glue). */
  readonly rapier: number;
  /** The busiest allocation sites, for the log. */
  readonly sites: readonly string[];
}

interface Snapshot {
  snapshot: {
    meta: { trace_function_info_fields: string[]; trace_node_fields: string[] };
  };
  trace_function_infos: number[];
  trace_tree: unknown[];
  strings: string[];
}

/** Runs `work` with allocation tracking on and counts the frame loop's allocations. */
export async function trackLoopAllocations(
  cdp: CDPSession,
  work: () => Promise<void>,
): Promise<LoopAllocations> {
  const chunks: string[] = [];
  const onChunk = (event: { chunk: string }): void => {
    chunks.push(event.chunk);
  };
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.startTrackingHeapObjects', { trackAllocations: true });
  try {
    await work();
  } finally {
    await cdp.send('HeapProfiler.stopTrackingHeapObjects', { reportProgress: false });
    cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
    await cdp.send('HeapProfiler.disable');
  }
  return countLoopAllocations(JSON.parse(chunks.join('')) as Snapshot);
}

function countLoopAllocations(heap: Snapshot): LoopAllocations {
  const { trace_function_info_fields: infoFields, trace_node_fields: nodeFields } =
    heap.snapshot.meta;
  const infoSize = infoFields.length;
  const nameField = infoFields.indexOf('name');
  const scriptField = infoFields.indexOf('script_name');
  const lineField = infoFields.indexOf('line');
  const infoIndexField = nodeFields.indexOf('function_info_index');
  const countField = nodeFields.indexOf('count');
  const sizeField = nodeFields.indexOf('size');
  const childrenField = nodeFields.indexOf('children');
  const nodeSize = nodeFields.length;
  const text = (index: number | undefined): string => heap.strings[index ?? -1] ?? '';

  let ours = 0;
  let oursExcessBytes = 0;
  let rapier = 0;
  const sites = new Map<string, { count: number; bytes: number }>();
  const walk = (
    nodes: unknown[],
    site: string | null,
    inLoop: boolean,
    inRapier: boolean,
  ): void => {
    for (let n = 0; n < nodes.length; n += nodeSize) {
      const info = (nodes[n + infoIndexField] as number) * infoSize;
      const name = text(heap.trace_function_infos[info + nameField]);
      const script = text(heap.trace_function_infos[info + scriptField]);
      const line = heap.trace_function_infos[info + lineField] ?? 0;
      const count = nodes[n + countField] as number;
      const bytes = nodes[n + sizeField] as number;
      const children = nodes[n + childrenField] as unknown[];
      const isOurs = LOOP_CHUNKS.test(script);
      if (isOurs && ONCE_PER_RUN.has(name)) continue;
      const loop = inLoop || (isOurs && name === 'tick');
      const inRapierNow =
        inRapier || (script.includes('/rapier-backend-') && !SIMULATION_METHODS.has(name));
      const here = isOurs
        ? `${name || '(anonymous)'}@${script.split('/').pop() ?? ''}:${String(line + 1)}`
        : site;
      if (loop && here && count > 0) {
        if (inRapierNow) {
          rapier += count;
        } else {
          ours += count;
          oursExcessBytes += Math.max(0, bytes - HEAP_NUMBER_BYTES * count);
        }
        const key = inRapierNow ? `Rapier ${here}` : here;
        const entry = sites.get(key) ?? { count: 0, bytes: 0 };
        entry.count += count;
        entry.bytes += bytes;
        sites.set(key, entry);
      }
      walk(children, here, loop, inRapierNow);
    }
  };
  walk(heap.trace_tree, null, false, false);
  const ranked = [...sites.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 6);
  return {
    ours,
    oursExcessBytes,
    rapier,
    sites: ranked.map(([site, { count, bytes }]) => `${site} ${String(count)}× ${String(bytes)} B`),
  };
}
