import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import {
  Link,
  NavLink,
  UNSAFE_DataRouterNavigationContext,
  createBrowserRouter,
  createPath,
  useLocation,
  useNavigate,
  useResolvedPath,
  type LinkProps,
  type NavigateFunction,
  type NavigateOptions,
  type NavLinkProps,
  type To,
} from 'react-router';
import type { ShatterEffect } from '../core/effect';
import type { Point, Shatter, ShatterOptions, TransitionRequest } from '../core/types';
import { ShatterContext, type ShatterContextValue } from '../react/context';
import {
  DEFAULT_READY_TIMEOUT,
  reportNavigationError,
  useShatterClick,
  useShatterInstance,
  type LinkStart,
} from '../react/shared';
import { RouteBridge } from './bridge';
import { installPopGate, setPopHolder } from './pop-gate';

/**
 * React Router's `createBrowserRouter`, with Shatter's back/forward gate
 * installed first. A data router listens to `popstate` from the moment it is
 * created; Shatter can capture the outgoing page on back/forward only if its
 * gate was there before (ADR-028). With the plain `createBrowserRouter`,
 * back/forward still work, without an effect in Chromium.
 */
export function createShatterBrowserRouter(
  ...args: Parameters<typeof createBrowserRouter>
): ReturnType<typeof createBrowserRouter> {
  installPopGate();
  return createBrowserRouter(...args);
}

const BridgeContext = createContext<RouteBridge | null>(null);
BridgeContext.displayName = 'ShatterRouteBridge';

/**
 * Tells the provider when the router has rendered a new location: on every
 * location key change, in a layout effect (the new route is in the DOM) and,
 * with a data router, once its navigation is idle (loaders done).
 *
 * `<ShatterProvider>` renders one for you. Render it yourself (with
 * `signal={false}` on the provider) to mark a later point, for example inside
 * a Suspense boundary around the route content.
 */
export function ShatterRouteSignal(): null {
  const bridge = useContext(BridgeContext);
  const { key } = useLocation();
  const navigation = useContext(UNSAFE_DataRouterNavigationContext);
  const idle = navigation === null || navigation.navigation.state === 'idle';
  useLayoutEffect(() => {
    bridge?.rendered(key, idle);
  }, [bridge, key, idle]);
  return null;
}

export interface ShatterProviderProps {
  /** Options for the instance the provider creates (read once, on mount). */
  options?: ShatterOptions;
  /** Use this instance instead of creating one. It is not destroyed on unmount. */
  instance?: Shatter;
  /** Render a `<ShatterRouteSignal>` here. Default true. */
  signal?: boolean;
  children?: ReactNode;
}

/** Keeps the latest value in a ref, for callbacks that must stay stable. */
function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * Shatter for React Router (declarative or data mode). Render it **inside**
 * the router: in data mode, in the root route's element.
 *
 * Shatter links shatter on click; back/forward shatter too (the outgoing
 * page is captured before the router renders the new one).
 */
export function ShatterProvider({
  options,
  instance,
  signal = true,
  children,
}: ShatterProviderProps): ReactNode {
  const shatter = useShatterInstance(options, instance);
  const timeout = options?.readyTimeout ?? DEFAULT_READY_TIMEOUT;
  const [bridge] = useState(() => new RouteBridge(timeout));
  bridge.timeout = timeout;
  const navigate = useLatest(useNavigate());

  useEffect(
    () => () => {
      bridge.dispose();
    },
    [bridge],
  );

  // Back/forward: hold the router's popstate until the old page is captured.
  // The gate must be on window before the router's listener (ADR-028): a
  // layout effect of this child runs before <BrowserRouter>'s own; data
  // routers need createShatterBrowserRouter(), which installs it earlier.
  useLayoutEffect(() => {
    installPopGate();
  }, []);
  useEffect(() => {
    if (!shatter) return undefined;
    setPopHolder(() => {
      if (!bridge.holdPop()) return false;
      bridge
        .run(shatter, { direction: 'back', commit: () => bridge.commitPop() })
        .catch(reportNavigationError);
      return true;
    });
    return () => {
      setPopHolder(null);
      bridge.releasePop();
    };
  }, [shatter, bridge]);

  const value = useMemo<ShatterContextValue>(
    () => ({
      shatter,
      transition: shatter ? (request: TransitionRequest) => bridge.run(shatter, request) : null,
      commitTo: (href, info) =>
        bridge.commit(() => navigate.current(href, { replace: info.replace, state: info.state })),
    }),
    [shatter, bridge, navigate],
  );

  return (
    <BridgeContext.Provider value={bridge}>
      <ShatterContext.Provider value={value}>
        {signal ? <ShatterRouteSignal /> : null}
        {children}
      </ShatterContext.Provider>
    </BridgeContext.Provider>
  );
}

/** The Shatter instance from the nearest provider, or null before it has mounted. */
export function useShatter(): Shatter | null {
  return useContext(ShatterContext)?.shatter ?? null;
}

export interface ShatterNavigateOptions extends Omit<
  NavigateOptions,
  'flushSync' | 'viewTransition'
> {
  /** Effect for this navigation. */
  effect?: string | ShatterEffect;
  /** Impact point in viewport coordinates. Default: the viewport centre. */
  origin?: Point;
}

export type ShatterNavigateFunction = (to: To, options?: ShatterNavigateOptions) => Promise<void>;

type RouterNavigateOptions = Omit<NavigateOptions, 'flushSync' | 'viewTransition'>;

/** Starts a transition whose commit is a React Router navigation. */
function useRouterTransition(): (
  to: To,
  navigateOptions: RouterNavigateOptions,
  origin: Point | undefined,
  effect: string | ShatterEffect | undefined,
) => Promise<void> {
  const context = useContext(ShatterContext);
  const bridge = useContext(BridgeContext);
  const navigate: NavigateFunction = useNavigate();
  const latest = useLatest(navigate);
  return useCallback(
    async (to, navigateOptions, origin, effect) => {
      const go = (): unknown => latest.current(to, navigateOptions);
      if (!bridge || !context?.transition) {
        await go();
        return;
      }
      await context.transition({
        commit: () => bridge.commit(go),
        ...(origin ? { origin } : {}),
        ...(effect ? { effect } : {}),
      });
    },
    [context, bridge, latest],
  );
}

/**
 * Programmatic navigation with a transition, React Router style:
 * `navigate('/work', { effect: 'implode', origin: { x, y } })`.
 */
export function useShatterNavigate(): ShatterNavigateFunction {
  const run = useRouterTransition();
  return useCallback(
    (to: To, options: ShatterNavigateOptions = {}) => {
      const { effect, origin, ...navigateOptions } = options;
      return run(to, navigateOptions, origin, effect);
    },
    [run],
  );
}

/** Builds the link start function shared by `ShatterLink` and `ShatterNavLink`. */
function useLinkStart(
  props: Pick<
    LinkProps,
    'to' | 'replace' | 'state' | 'relative' | 'preventScrollReset' | 'reloadDocument'
  >,
): LinkStart | null {
  const context = useContext(ShatterContext);
  const run = useRouterTransition();
  const location = useLocation();
  const path = useResolvedPath(props.to, props.relative ? { relative: props.relative } : {});
  const { to, replace, relative, preventScrollReset, reloadDocument } = props;
  // React Router types link state as `any`.
  const state = props.state as unknown;
  const enabled = Boolean(context?.transition) && !reloadDocument;
  return useMemo<LinkStart | null>(
    () =>
      enabled
        ? (origin, effect) => {
            // Same rule as React Router's <Link>: a link to the current
            // location replaces the entry instead of pushing a duplicate.
            const shouldReplace = replace ?? createPath(location) === createPath(path);
            run(
              to,
              {
                replace: shouldReplace,
                state,
                ...(relative ? { relative } : {}),
                ...(preventScrollReset === undefined ? {} : { preventScrollReset }),
              },
              origin,
              effect,
            ).catch(reportNavigationError);
          }
        : null,
    [enabled, run, location, path, to, replace, state, relative, preventScrollReset],
  );
}

export interface ShatterLinkProps extends Omit<LinkProps, 'viewTransition'> {
  /** Effect for this link. Default: `data-shatter-effect` on the link or an ancestor, else the provider's. */
  effect?: string | ShatterEffect;
  ref?: Ref<HTMLAnchorElement>;
}

/**
 * React Router's `<Link>` with a shatter transition on a plain primary click.
 * Renders a real `<a href>`; modifier and middle clicks, `target`,
 * `download`, `reloadDocument` and external links keep native behaviour.
 */
export function ShatterLink({ effect, onClick, ref, ...props }: ShatterLinkProps): ReactNode {
  const start = useLinkStart(props);
  const handleClick = useShatterClick(onClick, effect, start);
  return <Link {...props} ref={ref} onClick={handleClick} />;
}

export interface ShatterNavLinkProps extends Omit<NavLinkProps, 'viewTransition'> {
  /** Effect for this link. Default: `data-shatter-effect` on the link or an ancestor, else the provider's. */
  effect?: string | ShatterEffect;
  ref?: Ref<HTMLAnchorElement>;
}

/** React Router's `<NavLink>` (active/pending styling) with a shatter transition. */
export function ShatterNavLink({ effect, onClick, ref, ...props }: ShatterNavLinkProps): ReactNode {
  const start = useLinkStart(props);
  const handleClick = useShatterClick(onClick, effect, start);
  return <NavLink {...props} ref={ref} onClick={handleClick} />;
}
