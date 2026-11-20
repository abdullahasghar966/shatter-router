import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type Ref,
} from 'react';
import type { ShatterEffect } from '../core/effect';
import type { Point, Shatter, ShatterOptions, TransitionRequest } from '../core/types';
import { ShatterContext, type ShatterContextValue } from '../react/context';
import { installPopGate, setPopHolder } from '../react/pop-gate';
import { RouteBridge } from '../react/route-bridge';
import {
  DEFAULT_READY_TIMEOUT,
  reportNavigationError,
  useLatest,
  useShatterClick,
  useShatterInstance,
  type LinkStart,
} from '../react/shared';
import { waitForSettled } from './settled';

/**
 * When the new route counts as ready:
 * - `'commit'`: as soon as Next.js has rendered the new URL (a `loading.tsx`
 *   fallback may still be showing);
 * - `'settled'` (default): additionally until no `[data-shatter-pending]`
 *   element is left in the document (put it on your loading UI), bounded by
 *   `readyTimeout`.
 */
export type WaitFor = 'commit' | 'settled';

interface NextAdapter {
  readonly bridge: RouteBridge;
  /** Navigates through the App Router under the overlay and resolves once ready. */
  commit(href: string, replace: boolean): Promise<void>;
}

const AdapterContext = createContext<NextAdapter | null>(null);
AdapterContext.displayName = 'ShatterNextAdapter';

/**
 * The history entry the browser is on: the Navigation API entry key where
 * available, else the URL (entries with the same URL then share a scroll position).
 */
function entryKey(): string {
  const navigation = (window as { navigation?: Navigation }).navigation;
  return navigation?.currentEntry?.key ?? window.location.pathname + window.location.search;
}

/** Reports every rendered URL to the bridge, in a layout effect. */
function RouteSignal({ bridge }: { bridge: RouteBridge }): null {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useLayoutEffect(() => {
    bridge.rendered(`${pathname}?${search}`, true);
  }, [bridge, pathname, search]);
  return null;
}

export interface ShatterProviderProps {
  /** Options for the instance the provider creates (read once, on mount). */
  options?: ShatterOptions;
  /** Use this instance instead of creating one. It is not destroyed on unmount. */
  instance?: Shatter;
  /** When the new route counts as ready. Default `'settled'`. */
  waitFor?: WaitFor;
  children?: ReactNode;
}

/**
 * Shatter for the Next.js App Router. Render it in the root layout, around
 * the page content: `<ShatterProvider><Header />{children}</ShatterProvider>`.
 *
 * Shatter links shatter on click; back/forward shatter too (the outgoing
 * page is captured before the App Router renders the new one).
 */
export function ShatterProvider({
  options,
  instance,
  waitFor = 'settled',
  children,
}: ShatterProviderProps): ReactNode {
  const shatter = useShatterInstance(options, instance);
  const timeout = options?.readyTimeout ?? DEFAULT_READY_TIMEOUT;
  const [bridge] = useState(() => new RouteBridge(timeout, entryKey));
  bridge.timeout = timeout;
  const router = useLatest(useRouter());
  const settle = useLatest(
    waitFor === 'settled' ? () => waitForSettled(document, bridge.timeout) : undefined,
  );

  // The App Router adds its popstate listener in a passive effect of a parent
  // component: this child's layout effect runs earlier, so the gate is first
  // (ADR-028, ADR-034).
  useLayoutEffect(() => {
    installPopGate();
    const detach = bridge.attach();
    return () => {
      bridge.dispose();
      detach();
    };
  }, [bridge]);

  useEffect(() => {
    if (!shatter) return undefined;
    setPopHolder(() => {
      if (!bridge.holdPop()) return false;
      bridge
        .runPop(shatter, () => settle.current?.() ?? Promise.resolve())
        .catch(reportNavigationError);
      return true;
    });
    return () => {
      setPopHolder(null);
      bridge.releasePop();
    };
  }, [shatter, bridge, settle]);

  const adapter = useMemo<NextAdapter>(
    () => ({
      bridge,
      commit: (href, replace) => {
        const url = new URL(href, window.location.href);
        const changesRoute =
          url.pathname + url.search !== window.location.pathname + window.location.search;
        const afterRender = settle.current;
        return bridge.commit(
          () => {
            // The library scrolls under the overlay itself (master prompt §7).
            if (replace) router.current.replace(href, { scroll: false });
            else router.current.push(href, { scroll: false });
          },
          {
            changesRoute,
            ...(url.hash ? { hash: url.hash } : {}),
            ...(afterRender ? { afterRender } : {}),
          },
        );
      },
    }),
    [bridge, router, settle],
  );

  const value = useMemo<ShatterContextValue>(
    () => ({
      shatter,
      transition: shatter ? (request: TransitionRequest) => bridge.run(shatter, request) : null,
      commitTo: (href, info) => adapter.commit(href, info.replace),
    }),
    [shatter, bridge, adapter],
  );

  return (
    <AdapterContext.Provider value={adapter}>
      <ShatterContext.Provider value={value}>
        {/* useSearchParams() must sit under a Suspense boundary in Next.js. */}
        <Suspense fallback={null}>
          <RouteSignal bridge={bridge} />
        </Suspense>
        {children}
      </ShatterContext.Provider>
    </AdapterContext.Provider>
  );
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
  /** Scroll the new page to the top (or to its `#fragment`). Default true. */
  scroll?: boolean;
}

export type ShatterNavigateFunction = (
  href: string,
  options?: ShatterNavigateOptions,
) => Promise<void>;

/** Starts a transition whose commit is an App Router navigation. */
function useNextTransition(): ShatterNavigateFunction {
  const context = useContext(ShatterContext);
  const adapter = useContext(AdapterContext);
  const router = useLatest(useRouter());
  return useCallback(
    async (href, options = {}) => {
      const replace = options.replace ?? false;
      if (!adapter || !context?.transition) {
        if (replace) router.current.replace(href);
        else router.current.push(href);
        return;
      }
      const url = new URL(href, window.location.href);
      const keepScroll = options.scroll === false || url.hash !== '';
      await context.transition({
        commit: () => adapter.commit(href, replace),
        ...(replace ? { replace: true } : {}),
        ...(keepScroll ? { scroll: 'none' as const } : {}),
        ...(options.origin ? { origin: options.origin } : {}),
        ...(options.effect ? { effect: options.effect } : {}),
      });
    },
    [context, adapter, router],
  );
}

/**
 * Programmatic navigation with a transition:
 * `navigate('/work', { effect: 'implode', origin: { x, y } })`.
 */
export function useShatterNavigate(): ShatterNavigateFunction {
  return useNextTransition();
}

type NextLinkProps = ComponentPropsWithoutRef<typeof Link>;

export interface ShatterLinkProps extends Omit<
  NextLinkProps,
  'href' | 'legacyBehavior' | 'passHref' | 'as'
> {
  /** The target URL (a string; `UrlObject` hrefs are not supported, ADR-034). */
  href: string;
  /** Effect for this link. Default: `data-shatter-effect` on the link or an ancestor, else the provider's. */
  effect?: string | ShatterEffect;
  ref?: Ref<HTMLAnchorElement>;
}

/**
 * `next/link` with a shatter transition on a plain primary click. Prefetching
 * and everything else `<Link>` does are kept; modifier and middle clicks,
 * `target`, `download` and external links keep native behaviour.
 */
export function ShatterLink({
  href,
  effect,
  onClick,
  onNavigate,
  replace,
  scroll,
  ref,
  ...props
}: ShatterLinkProps): ReactNode {
  const context = useContext(ShatterContext);
  const navigate = useNextTransition();
  const enabled = Boolean(context?.transition);
  const start = useMemo<LinkStart | null>(
    () =>
      enabled
        ? (origin, chosen) => {
            // Same contract as next/link: onNavigate can cancel the navigation.
            const decision = { cancelled: false };
            onNavigate?.({
              preventDefault: () => {
                decision.cancelled = true;
              },
            });
            if (decision.cancelled) return;
            navigate(href, {
              origin,
              ...(chosen ? { effect: chosen } : {}),
              ...(replace === undefined ? {} : { replace }),
              ...(scroll === undefined ? {} : { scroll }),
            }).catch(reportNavigationError);
          }
        : null,
    [enabled, navigate, href, replace, scroll, onNavigate],
  );
  const handleClick = useShatterClick(onClick, effect, start);
  return (
    <Link
      {...props}
      ref={ref}
      href={href}
      onClick={handleClick}
      {...(onNavigate ? { onNavigate } : {})}
      {...(replace === undefined ? {} : { replace })}
      {...(scroll === undefined ? {} : { scroll })}
    />
  );
}
