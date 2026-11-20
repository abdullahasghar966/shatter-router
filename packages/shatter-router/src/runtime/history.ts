import type { Point } from '../core/types';

/**
 * Navigation memory (ADR-047): which effect, and from which point, brought
 * the user to each page, so Back can play the reverse of it and Forward can
 * replay it.
 *
 * Pages are keyed by `pathname + search`. The memory mirrors the tab's
 * history as a list with a current position: a forward navigation adds an
 * entry after the position (dropping the ones after it, as browsers do); a
 * replace overwrites the current one. On `popstate` the arriving page is
 * looked for just before the position (Back) or just after it (Forward),
 * then further away (`history.go(n)`). It is kept in `sessionStorage`, so it
 * survives reloads within the tab, and capped at `MAX_ENTRIES`.
 */

export interface MemoryEntry {
  readonly key: string;
  /** Name of the effect that brought the user here; null for the landing page. */
  readonly effect: string | null;
  readonly origin: Point | null;
}

export interface PopResult {
  readonly direction: 'back' | 'forward' | 'unknown';
  /** Back: the page being left. Forward: the page arrived at. */
  readonly entry: MemoryEntry | null;
}

const STORAGE_KEY = 'shatter-router:history';
export const MAX_ENTRIES = 50;

interface Saved {
  entries: MemoryEntry[];
  position: number;
}

export class HistoryMemory {
  private entries: MemoryEntry[];
  private position: number;

  constructor(
    currentKey: string,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  ) {
    const saved = this.read();
    // A reload keeps the memory when it still describes this page.
    if (saved?.entries[saved.position]?.key === currentKey) {
      this.entries = saved.entries;
      this.position = saved.position;
    } else {
      this.entries = [{ key: currentKey, effect: null, origin: null }];
      this.position = 0;
      this.write();
    }
  }

  /** A forward navigation (or a replace) arrived at `key` with `effect`. */
  record(key: string, effect: string | null, origin: Point | null, replace = false): void {
    const entry: MemoryEntry = { key, effect, origin };
    if (replace) {
      this.entries[this.position] = entry;
    } else {
      this.entries = this.entries.slice(0, this.position + 1);
      this.entries.push(entry);
      this.position = this.entries.length - 1;
      if (this.entries.length > MAX_ENTRIES) {
        const drop = this.entries.length - MAX_ENTRIES;
        this.entries = this.entries.slice(drop);
        this.position -= drop;
      }
    }
    this.write();
  }

  /** A history traversal arrived at `key`: Back, Forward, or unknown. */
  pop(key: string): PopResult {
    const here = this.entries[this.position] ?? null;
    let found = -1;
    if (this.entries[this.position - 1]?.key === key) found = this.position - 1;
    else if (this.entries[this.position + 1]?.key === key) found = this.position + 1;
    else {
      // history.go(n): the nearest matching entry.
      let best = Infinity;
      this.entries.forEach((entry, index) => {
        const distance = Math.abs(index - this.position);
        if (entry.key === key && index !== this.position && distance < best) {
          best = distance;
          found = index;
        }
      });
    }
    if (found < 0) {
      // A navigation Shatter never saw: start over from here.
      this.entries = [{ key, effect: null, origin: null }];
      this.position = 0;
      this.write();
      return { direction: 'unknown', entry: here };
    }
    const back = found < this.position;
    // Going back several steps reverses the most recent arrival only.
    const result: PopResult = back
      ? { direction: 'back', entry: here }
      : { direction: 'forward', entry: this.entries[found] ?? null };
    this.position = found;
    this.write();
    return result;
  }

  /** For tests and the debug panel. */
  snapshot(): { readonly entries: readonly MemoryEntry[]; readonly position: number } {
    return { entries: [...this.entries], position: this.position };
  }

  private read(): Saved | null {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw) as Saved;
      if (!Array.isArray(saved.entries) || typeof saved.position !== 'number') return null;
      return saved;
    } catch {
      return null;
    }
  }

  private write(): void {
    try {
      this.storage?.setItem(
        STORAGE_KEY,
        JSON.stringify({ entries: this.entries, position: this.position }),
      );
    } catch {
      // Storage full or blocked: the memory still works for this page's life.
    }
  }
}

/** The memory key of the current location. */
export function locationKey(location: Pick<Location, 'pathname' | 'search'>): string {
  return `${location.pathname}${location.search}`;
}
