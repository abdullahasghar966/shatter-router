import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { vi } from 'vitest';
import type { Shatter, TransitionRequest } from '../../src/core/types';

// Tells React that updates are wrapped in act() in this environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A Shatter stand-in that records requests and commits them at once. */
export interface FakeShatter extends Shatter {
  readonly requests: TransitionRequest[];
  /** Resolves with the request once its commit() has settled. */
  readonly committed: TransitionRequest[];
  destroyCount: number;
}

export function fakeShatter(): FakeShatter {
  const requests: TransitionRequest[] = [];
  const committed: TransitionRequest[] = [];
  const fake: FakeShatter = {
    requests,
    committed,
    destroyCount: 0,
    state: 'idle',
    transition: vi.fn(async (request: TransitionRequest) => {
      requests.push(request);
      await request.commit();
      committed.push(request);
    }),
    on: () => () => undefined,
    scrollBreak: () => Promise.resolve(() => undefined),
    setMaterial: () => undefined,
    setSound: () => undefined,
    registerEffect: () => undefined,
    destroy: () => {
      fake.destroyCount += 1;
    },
  };
  return fake;
}

export interface Mounted {
  readonly container: HTMLElement;
  readonly root: Root;
  unmount(): Promise<void>;
}

export async function mount(node: ReactNode): Promise<Mounted> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
    await Promise.resolve();
  });
  return {
    container,
    root,
    unmount: async () => {
      await act(async () => {
        root.unmount();
        await Promise.resolve();
      });
      container.remove();
    },
  };
}

/**
 * Clicks `element` and reports whether the click was intercepted
 * (`defaultPrevented`). A document listener stops happy-dom from following
 * links the library left alone.
 */
export async function click(element: Element, init: MouseEventInit = {}): Promise<boolean> {
  let prevented = false;
  const record = (event: Event): void => {
    prevented = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', record);
  try {
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          composed: true,
          button: 0,
          detail: 1,
          ...init,
        }),
      );
      await Promise.resolve();
    });
  } finally {
    document.removeEventListener('click', record);
  }
  return prevented;
}

/** Lets pending promises, timers and React work run inside act(). */
export async function settle(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

export function anchor(container: HTMLElement, text: string): HTMLAnchorElement {
  const found = [...container.querySelectorAll('a')].find((a) => a.textContent === text);
  if (!found) throw new Error(`No link "${text}"`);
  return found;
}
