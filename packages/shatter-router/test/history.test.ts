import { describe, expect, it } from 'vitest';
import { assembleEffect } from '../src/engine/effects/assemble';
import { explodeEffect } from '../src/engine/effects/explode';
import { reverseEffect, REVERSE_SUFFIX } from '../src/engine/effects/reverse';
import { shatterEffect } from '../src/engine/effects/shatter';
import { HistoryMemory, locationKey, MAX_ENTRIES } from '../src/runtime/history';

class MemoryStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

describe('HistoryMemory (ADR-047)', () => {
  it('starts with the current page, arrived at without an effect', () => {
    const memory = new HistoryMemory('/', new MemoryStorage());
    expect(memory.snapshot()).toEqual({
      entries: [{ key: '/', effect: null, origin: null }],
      position: 0,
    });
  });

  it('tells Back from Forward and returns the entry to reverse or replay', () => {
    const memory = new HistoryMemory('/', new MemoryStorage());
    memory.record('/a', 'explode', { x: 1, y: 2 });
    memory.record('/b', 'flip', null);
    expect(memory.pop('/a')).toEqual({
      direction: 'back',
      entry: { key: '/b', effect: 'flip', origin: null },
    });
    expect(memory.pop('/b')).toEqual({
      direction: 'forward',
      entry: { key: '/b', effect: 'flip', origin: null },
    });
  });

  it('a navigation after Back drops the entries after the position', () => {
    const memory = new HistoryMemory('/', new MemoryStorage());
    memory.record('/a', 'explode', null);
    memory.pop('/');
    memory.record('/c', 'implode', null);
    expect(memory.snapshot().entries.map((entry) => entry.key)).toEqual(['/', '/c']);
  });

  it('history.go(n) finds the nearest matching entry', () => {
    const memory = new HistoryMemory('/', new MemoryStorage());
    memory.record('/a', 'explode', null);
    memory.record('/b', 'flip', null);
    memory.record('/c', 'implode', null);
    const result = memory.pop('/');
    expect(result.direction).toBe('back');
    // Several steps back reverse the most recent arrival only.
    expect(result.entry?.key).toBe('/c');
    expect(memory.snapshot().position).toBe(0);
  });

  it('an unknown page starts the memory over', () => {
    const memory = new HistoryMemory('/', new MemoryStorage());
    memory.record('/a', 'explode', null);
    expect(memory.pop('/elsewhere').direction).toBe('unknown');
    expect(memory.snapshot()).toEqual({
      entries: [{ key: '/elsewhere', effect: null, origin: null }],
      position: 0,
    });
  });

  it('finds a neighbour whose page rewrote its own query', () => {
    const memory = new HistoryMemory('/playground', new MemoryStorage());
    memory.record('/docs', 'explode', null);
    expect(memory.pop('/playground?effect=flip')).toEqual({
      direction: 'back',
      entry: { key: '/docs', effect: 'explode', origin: null },
    });
    // The entry takes the page's current key.
    expect(memory.snapshot().entries[0]?.key).toBe('/playground?effect=flip');
    expect(memory.pop('/docs').direction).toBe('forward');
  });

  it('a replace overwrites the current entry', () => {
    const memory = new HistoryMemory('/', new MemoryStorage());
    memory.record('/a', 'explode', null);
    memory.record('/a?x=1', 'implode', null, true);
    expect(memory.snapshot()).toEqual({
      entries: [
        { key: '/', effect: null, origin: null },
        { key: '/a?x=1', effect: 'implode', origin: null },
      ],
      position: 1,
    });
  });

  it(`keeps at most ${String(MAX_ENTRIES)} entries`, () => {
    const memory = new HistoryMemory('/', new MemoryStorage());
    for (let index = 0; index < MAX_ENTRIES + 10; index++)
      memory.record(`/${String(index)}`, 'shatter', null);
    const { entries, position } = memory.snapshot();
    expect(entries).toHaveLength(MAX_ENTRIES);
    expect(position).toBe(MAX_ENTRIES - 1);
    expect(entries.at(-1)?.key).toBe(`/${String(MAX_ENTRIES + 9)}`);
  });

  it('survives a reload of the same page, and only of it', () => {
    const storage = new MemoryStorage();
    new HistoryMemory('/', storage).record('/a', 'explode', null);
    expect(new HistoryMemory('/a', storage).snapshot().position).toBe(1);
    expect(new HistoryMemory('/z', storage).snapshot().entries).toHaveLength(1);
  });

  it('ignores corrupt storage and works without storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('shatter-router:history', '{not json');
    expect(new HistoryMemory('/', storage).snapshot().position).toBe(0);
    const memory = new HistoryMemory('/', null);
    memory.record('/a', 'explode', null);
    expect(memory.pop('/').direction).toBe('back');
  });

  it('survives a storage that throws', () => {
    const throwing = {
      getItem: (): string | null => {
        throw new Error('blocked');
      },
      setItem: (): void => {
        throw new Error('full');
      },
    };
    const memory = new HistoryMemory('/', throwing);
    memory.record('/a', 'explode', null);
    expect(memory.pop('/').direction).toBe('back');
  });

  it('keys pages by pathname and search, not hash', () => {
    expect(locationKey({ pathname: '/docs', search: '?q=1' })).toBe('/docs?q=1');
  });
});

describe('reverseEffect (ADR-047)', () => {
  it.each([shatterEffect, explodeEffect])(
    'wraps $name as a two-layer effect on the new page',
    (base) => {
      const reversed = reverseEffect(base);
      expect(reversed.name).toBe(`${base.name}${REVERSE_SUFFIX}`);
      expect(reversed.needsIncomingSnapshot).toBe(true);
      expect(reversed.layers).toBe(2);
      expect(reversed.crack).toBe(false);
    },
  );

  it('renames the base motion and runs it at uDuration - uTime on layer 1', () => {
    const glsl = reverseEffect(explodeEffect).vertexChunk;
    expect(glsl).toContain('void forwardMotion(');
    expect(glsl.match(/void shardMotion\(/g)).toHaveLength(1);
    expect(glsl).toContain('if (shard.layer == 0) return;');
    expect(glsl).toContain('uTime = max(0.0, uDuration - now);');
    // uTime is restored for anything that runs after the motion.
    expect(glsl).toContain('uTime = now;');
  });

  it('samples the incoming page on layer 1 and keeps the base fragment', () => {
    const base = {
      ...shatterEffect,
      fragmentChunk: 'void shardFragment(inout vec4 color) { color.a *= 0.5; }',
    };
    const fragment = reverseEffect(base).fragmentChunk ?? '';
    expect(fragment).toContain('void forwardFragment(');
    expect(fragment).toContain('glassSample(uIncoming, vUv)');
    expect(fragment).toContain('forwardFragment(color);');
    expect(reverseEffect(shatterEffect).fragmentChunk).not.toContain('forwardFragment');
  });

  it('keeps the base duration, attributes and seed points', () => {
    const base = { ...assembleEffect, name: 'slow', duration: 1234, needsIncomingSnapshot: false };
    const reversed = reverseEffect(base);
    expect(reversed.duration).toBe(1234);
    expect(reversed.seedPoints === undefined).toBe(base.seedPoints === undefined);
    expect(reversed.isComplete(1234, { duration: 1234 } as never)).toBe(true);
    expect(reversed.isComplete(1000, { duration: 1234 } as never)).toBe(false);
  });
});
