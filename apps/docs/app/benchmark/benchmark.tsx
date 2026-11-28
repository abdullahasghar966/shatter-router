'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createShatter, type Shatter } from 'shatter-router';
import { BENCHMARK_REFERENCE } from '../../lib/measurements';

/** The fixed settings every visitor's run uses, so runs compare. */
const SETTINGS = { effect: 'shatter', shards: 160, seed: 7 } as const;
const RUNS = 5;

export interface Run {
  captureMs: number | null;
  fractureMs: number | null;
  pieces: number | null;
  fps: number | null;
  worstFrameMs: number | null;
  fallback: string | null;
}

interface Device {
  viewport: string;
  dpr: number;
  cores: number | null;
  memory: number | null;
}

function median(values: readonly (number | null)[]): number | null {
  const sorted = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

const fmt = (value: number | null, digits = 1): string =>
  value === null ? '—' : value.toFixed(digits);

/** The site's `?budget=<ms>` test switch, as the playground reads it. */
function captureBudget(): { captureBudget?: number } {
  const raw = new URLSearchParams(window.location.search).get('budget');
  const value = Number(raw);
  return raw !== null && Number.isFinite(value) ? { captureBudget: value } : {};
}

/** One break in place, measured from the public events and painted frames. */
async function measure(shatter: Shatter): Promise<Run> {
  const run: Run = {
    captureMs: null,
    fractureMs: null,
    pieces: null,
    fps: null,
    worstFrameMs: null,
    fallback: null,
  };
  const frames: number[] = [];
  let counting = false;
  const tick = (time: number): void => {
    if (!counting) return;
    frames.push(time);
    requestAnimationFrame(tick);
  };
  const offs = [
    shatter.on('covered', ({ captureMs }) => {
      run.captureMs = captureMs;
    }),
    shatter.on('fractured', ({ fractureMs, shardCount }) => {
      run.fractureMs = fractureMs;
      run.pieces = shardCount;
    }),
    shatter.on('animating', () => {
      counting = true;
      requestAnimationFrame(tick);
    }),
    shatter.on('end', () => {
      counting = false;
    }),
    shatter.on('fallback', ({ reason }) => {
      run.fallback = reason;
    }),
  ];
  try {
    await shatter.transition({
      commit: () => undefined,
      origin: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      scroll: 'none',
    });
  } finally {
    counting = false;
    for (const off of offs) off();
  }
  const first = frames[0];
  const last = frames.at(-1);
  if (first !== undefined && last !== undefined && frames.length > 1) {
    run.fps = ((frames.length - 1) * 1000) / (last - first);
    let worst = 0;
    for (let i = 1; i < frames.length; i++) {
      worst = Math.max(worst, (frames[i] ?? 0) - (frames[i - 1] ?? 0));
    }
    run.worstFrameMs = worst;
  }
  return run;
}

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/**
 * The live benchmark (ADR-061): breaks this page in place a few times with
 * fixed settings and shows what this device measured, next to the
 * reference machine. Uses its own instance, like the Studio.
 */
export function Benchmark(): ReactNode {
  const instance = useRef<Shatter | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle');
  const [device, setDevice] = useState<Device | null>(null);
  const [reduced, setReduced] = useState(false);
  const [ignoreReduced, setIgnoreReduced] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    setDevice({
      viewport: `${String(window.innerWidth)}×${String(window.innerHeight)}`,
      dpr: window.devicePixelRatio,
      cores: nav.hardwareConcurrency || null,
      memory: nav.deviceMemory ?? null,
    });
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    return () => {
      instance.current?.destroy();
      instance.current = null;
    };
  }, []);

  const start = async (): Promise<void> => {
    setState('running');
    setRuns([]);
    instance.current?.destroy();
    const shatter = createShatter({
      ...SETTINGS,
      // Only when the visitor asked for it, in spite of reduced motion.
      ...(ignoreReduced ? { reducedMotion: 'ignore' as const } : {}),
      ...captureBudget(),
    });
    instance.current = shatter;
    // A first break warms the capture and compiles the effect; not counted.
    await measure(shatter);
    for (let i = 0; i < RUNS; i++) {
      await pause(300);
      const run = await measure(shatter);
      setRuns((current) => [...current, run]);
    }
    setState('done');
  };

  const summary: Run = {
    captureMs: median(runs.map((r) => r.captureMs)),
    fractureMs: median(runs.map((r) => r.fractureMs)),
    pieces: median(runs.map((r) => r.pieces)),
    fps: median(runs.map((r) => r.fps)),
    worstFrameMs: median(runs.map((r) => r.worstFrameMs)),
    fallback: runs.find((r) => r.fallback !== null)?.fallback ?? null,
  };

  return (
    <div className="bench">
      <div className="bench-controls">
        <button
          type="button"
          className="button"
          disabled={state === 'running'}
          onClick={() => {
            void start();
          }}
        >
          {state === 'running' ? 'Running…' : state === 'done' ? 'Run again' : 'Run the benchmark'}
        </button>
        {reduced ? (
          <label className="bench-reduced">
            <input
              type="checkbox"
              checked={ignoreReduced}
              onChange={(event) => {
                setIgnoreReduced(event.target.checked);
              }}
            />{' '}
            Your system asks for reduced motion, so the page would only cross-fade. Play the full
            effect for this benchmark.
          </label>
        ) : null}
        <p className="bench-device">
          {device
            ? `This device: ${device.viewport} CSS px at ${String(device.dpr)}×${device.cores ? `, ${String(device.cores)} cores` : ''}${device.memory ? `, ${String(device.memory)} GB` : ''}`
            : ' '}
        </p>
      </div>
      <table className="bench-table" data-testid="bench-summary">
        <caption className="sr-only">This device against the reference machine</caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">This device (median)</th>
            <th scope="col">Reference</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Capture</th>
            <td>{fmt(summary.captureMs)} ms</td>
            <td>{BENCHMARK_REFERENCE.captureMs}</td>
          </tr>
          <tr>
            <th scope="row">Fracture ({summary.pieces ?? SETTINGS.shards} pieces)</th>
            <td>{fmt(summary.fractureMs, 2)} ms</td>
            <td>{BENCHMARK_REFERENCE.fractureMs}</td>
          </tr>
          <tr>
            <th scope="row">Frame rate while breaking</th>
            <td>{fmt(summary.fps)} fps</td>
            <td>{BENCHMARK_REFERENCE.fps}</td>
          </tr>
          <tr>
            <th scope="row">Longest frame</th>
            <td>{fmt(summary.worstFrameMs)} ms</td>
            <td>{BENCHMARK_REFERENCE.worstFrameMs}</td>
          </tr>
        </tbody>
      </table>
      <p className="bench-status" role="status">
        {state === 'running'
          ? `Breaking the page: ${String(runs.length)} of ${String(RUNS)} measured runs done.`
          : state === 'done'
            ? summary.fallback
              ? `Done, but the effect did not play (${summary.fallback}): the numbers above are incomplete.`
              : `Done: ${String(runs.length)} runs.`
            : ''}
      </p>
      {runs.length > 0 ? (
        <table className="bench-table bench-runs" data-testid="bench-runs">
          <caption className="sr-only">Each measured run</caption>
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Capture</th>
              <th scope="col">Fracture</th>
              <th scope="col">fps</th>
              <th scope="col">Longest frame</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, i) => (
              <tr key={i}>
                <th scope="row">{i + 1}</th>
                <td>{fmt(run.captureMs)} ms</td>
                <td>{fmt(run.fractureMs, 2)} ms</td>
                <td>{run.fallback ? `fallback: ${run.fallback}` : fmt(run.fps)}</td>
                <td>{fmt(run.worstFrameMs)} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p className="bench-note">
        Reference: {BENCHMARK_REFERENCE.where}. Every run breaks this page with{' '}
        <code>{`createShatter({ effect: 'shatter', shards: 160, seed: 7 })`}</code>; the first break
        warms up and is not counted.
      </p>
    </div>
  );
}
