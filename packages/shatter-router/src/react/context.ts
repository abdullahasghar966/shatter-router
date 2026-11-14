import { createContext } from 'react';
import type { Shatter, TransitionRequest } from '../core/types';

/** What a router does with a navigation request. */
export interface RouterNavigateInfo {
  /** Replace the current history entry instead of pushing a new one. */
  readonly replace: boolean;
  /** History state to store with the entry. */
  readonly state: unknown;
}

/** The value adapters put into context for links and hooks. */
export interface ShatterContextValue {
  /** The instance, or null until the provider has mounted (SSR, first render). */
  readonly shatter: Shatter | null;
  /** Runs a transition. Adapters wrap `shatter.transition` for their own bookkeeping. */
  readonly transition: ((request: TransitionRequest) => Promise<void>) | null;
  /**
   * Shows `href` through the app's router and resolves once the new route has
   * rendered (bounded by `readyTimeout`). Null when no router is connected.
   */
  readonly commitTo: ((href: string, info: RouterNavigateInfo) => Promise<void>) | null;
}

export const ShatterContext = createContext<ShatterContextValue | null>(null);
ShatterContext.displayName = 'ShatterContext';
