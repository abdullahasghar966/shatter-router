import { describe, expect, it } from 'vitest';
import {
  InvalidTransition,
  StateMachine,
  TRANSITIONS,
  type TransitionState,
} from '../src/core/machine';

const ALL: TransitionState[] = [
  'idle',
  'capturing',
  'covering',
  'committing',
  'waiting',
  'animating',
  'revealing',
  'fallback',
];

describe('StateMachine', () => {
  it('starts idle', () => {
    expect(new StateMachine(() => 0).state).toBe('idle');
  });

  it('follows the happy path of section 4', () => {
    const machine = new StateMachine(() => 0);
    for (const state of [
      'capturing',
      'covering',
      'committing',
      'waiting',
      'animating',
      'revealing',
      'idle',
    ] as const) {
      machine.enter(state);
      expect(machine.state).toBe(state);
    }
  });

  it.each(ALL.flatMap((from) => ALL.map((to) => [from, to] as const)))(
    '%s → %s is allowed exactly when the table says so',
    (from, to) => {
      const machine = new StateMachine(() => 0);
      // Walk to `from` along allowed moves.
      const path: Record<TransitionState, TransitionState[]> = {
        idle: [],
        capturing: ['capturing'],
        covering: ['capturing', 'covering'],
        committing: ['capturing', 'covering', 'committing'],
        waiting: ['capturing', 'covering', 'committing', 'waiting'],
        animating: ['capturing', 'covering', 'committing', 'waiting', 'animating'],
        revealing: ['capturing', 'covering', 'committing', 'waiting', 'animating', 'revealing'],
        fallback: ['fallback'],
      };
      for (const step of path[from]) machine.enter(step);
      const allowed = from === to || TRANSITIONS[from].includes(to);
      if (allowed) {
        expect(() => {
          machine.enter(to);
        }).not.toThrow();
      } else {
        expect(() => {
          machine.enter(to);
        }).toThrow(InvalidTransition);
        expect(machine.state).toBe(from);
      }
    },
  );

  it('lets every active state fall back, and fallback always ends idle', () => {
    for (const state of ALL) {
      if (state === 'idle' || state === 'fallback') continue;
      expect(TRANSITIONS[state]).toContain('fallback');
    }
    expect(TRANSITIONS.fallback).toEqual(['idle']);
  });

  it('only allows cancelling (→ idle) before the commit', () => {
    const cancellable = ALL.filter((s) => s !== 'idle' && TRANSITIONS[s].includes('idle'));
    expect(cancellable.sort()).toEqual(['capturing', 'covering', 'fallback', 'revealing'].sort());
  });

  it('records how long each phase took and resets per transition', () => {
    let now = 0;
    const machine = new StateMachine(() => now);
    machine.enter('capturing');
    now = 40;
    machine.enter('covering');
    now = 75;
    machine.enter('committing');
    now = 80;
    machine.enter('fallback');
    now = 81;
    machine.enter('idle');
    expect(machine.phaseTimings).toEqual({
      capturing: 40,
      covering: 35,
      committing: 5,
      fallback: 1,
    });
    machine.enter('capturing');
    expect(machine.phaseTimings).toEqual({});
  });

  it('reports every change', () => {
    const changes: string[] = [];
    const machine = new StateMachine(
      () => 0,
      (next, previous) => changes.push(`${previous}>${next}`),
    );
    machine.enter('capturing');
    machine.enter('capturing');
    machine.enter('idle');
    expect(changes).toEqual(['idle>capturing', 'capturing>idle']);
  });
});
