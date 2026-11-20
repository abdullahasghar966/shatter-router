import {
  useCallback,
  useContext,
  useMemo,
  type AnchorHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { flushSync } from 'react-dom';
import type { ShatterEffect } from '../core/effect';
import type { Point, Shatter, ShatterOptions, TransitionRequest } from '../core/types';
import { ShatterContext, type RouterNavigateInfo, type ShatterContextValue } from './context';
import {
  DEFAULT_READY_TIMEOUT,
  boundedCommit,
  reportNavigationError,
  scrollToFragment,
  useShatterClick,
  useShatterInstance,
  type LinkStart,
} from './shared';

/**
 * Shows `href` in the app. Called while the overlay covers the page. Return a
 * promise that resolves once the new route has rendered; a plain state update
 * is flushed synchronously for you.
 */
export type RouterNavigate = (href: string, info: RouterNavigateInfo) => void | Promise<void>;

export interface ShatterProviderProps {
  /** Options for the instance the provider creates (read once, on mount). */
  options?: ShatterOptions;
  /** Use this instance instead of creating one. It is not destroyed on unmount. */
  instance?: Shatter;
  /**
   * Connects your router. Without it, `<ShatterLink>` is a plain link and
   * `useShatterNavigate()` loads the page normally. The React Router and
   * Next.js adapters connect their router for you.
   */
  navigate?: RouterNavigate;
  children?: ReactNode;
}

/**
 * Creates one Shatter instance for the app and makes it available to
 * `<ShatterLink>`, `useShatter()` and `useShatterNavigate()`.
 */
export function ShatterProvider({
  options,
  instance,
  navigate,
  children,
}: ShatterProviderProps): ReactNode {
  const shatter = useShatterInstance(options, instance);
  const timeout = options?.readyTimeout ?? DEFAULT_READY_TIMEOUT;
  const value = useMemo<ShatterContextValue>(
    () => ({
      shatter,
      transition: shatter ? (request: TransitionRequest) => shatter.transition(request) : null,
      commitTo: navigate
        ? (href, info) =>
            boundedCommit(() => {
              let result: void | Promise<void> = undefined;
              flushSync(() => {
                result = navigate(href, info);
              });
              return result;
            }, timeout)
        : null,
    }),
    [shatter, navigate, timeout],
  );
  return <ShatterContext.Provider value={value}>{children}</ShatterContext.Provider>;
}

/** The Shatter instance from the nearest provider, or null before it has mounted. */
export function useShatter(): Shatter | null {
  return useContext(ShatterContext)?.shatter ?? null;
}

export interface ShatterNavigateOptions {
  /** Effect for this navigation. */
  effect?: string | ShatterEffect;
  /** Impact point in viewport coordinates. Default: the viewport centre. */
  origin?: Point;
  /** Replace the current history entry. Default false. */
  replace?: boolean;
  /** History state for the new entry. */
  state?: unknown;
}

export type ShatterNavigateFunction = (
  href: string,
  options?: ShatterNavigateOptions,
) => Promise<void>;

/**
 * Programmatic navigation with a transition. Without a connected router or
 * before the provider has mounted, it navigates without an effect.
 */
export function useShatterNavigate(): ShatterNavigateFunction {
  const context = useContext(ShatterContext);
  return useCallback(
    async (href: string, options: ShatterNavigateOptions = {}) => {
      const commitTo = context?.commitTo;
      if (!commitTo) {
        window.location.assign(href);
        return;
      }
      const info: RouterNavigateInfo = {
        replace: options.replace ?? false,
        state: options.state,
      };
      // A target with a #fragment scrolls to it once rendered, not to the top.
      const { hash } = new URL(href, window.location.href);
      const commit = async (): Promise<void> => {
        await commitTo(href, info);
        if (hash) scrollToFragment(hash);
      };
      if (!context.transition) {
        await commit();
        return;
      }
      await context.transition({
        commit,
        ...(info.replace ? { replace: true } : {}),
        ...(hash ? { scroll: 'none' as const } : {}),
        ...(options.origin ? { origin: options.origin } : {}),
        ...(options.effect ? { effect: options.effect } : {}),
      });
    },
    [context],
  );
}

export interface ShatterLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** A real URL: rendered as is, so the link works without JavaScript. */
  href: string;
  /** Effect for this link. Default: `data-shatter-effect` on the link or an ancestor, else the provider's. */
  effect?: string | ShatterEffect;
  /** Replace the current history entry. */
  replace?: boolean;
  /** History state for the new entry. */
  state?: unknown;
  ref?: Ref<HTMLAnchorElement>;
}

/**
 * A normal `<a href>` that shatters the page on a plain primary click.
 * Modifier and middle clicks, `target`, `download` and external links keep
 * their native behaviour.
 */
export function ShatterLink({
  href,
  effect,
  replace,
  state,
  onClick,
  ref,
  ...rest
}: ShatterLinkProps): ReactNode {
  const context = useContext(ShatterContext);
  const navigate = useShatterNavigate();
  const enabled = Boolean(context?.commitTo);
  const start = useMemo<LinkStart | null>(
    () =>
      enabled
        ? (origin, chosen) => {
            navigate(href, {
              origin,
              ...(chosen ? { effect: chosen } : {}),
              ...(replace === undefined ? {} : { replace }),
              state,
            }).catch(reportNavigationError);
          }
        : null,
    [enabled, navigate, href, replace, state],
  );
  const handleClick = useShatterClick(onClick, effect, start);
  return <a {...rest} ref={ref} href={href} onClick={handleClick} />;
}
