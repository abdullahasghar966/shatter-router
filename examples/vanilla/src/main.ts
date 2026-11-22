import { classifyLinkClick, createShatter, findAnchor, getLinkEffect } from 'shatter-router';
import { rapier } from 'shatter-router/rapier';
import { lab } from './lab';
import { effectsPage, notFound, pages } from './pages';

const app = document.getElementById('app');
if (!app) throw new Error('#app is missing from index.html');
const outlet: HTMLElement = app;

// `?debug` on the first load turns on debug mode (and the e2e test hook);
// `&panel` also shows the debug panel (left out so e2e screenshots stay clean).
// `?budget=<ms>` overrides the capture budget; the e2e suite uses it so slow CI
// machines measure the seam instead of tripping the fallback.
// `?seed=<n>` makes the fracture deterministic; `?shards=<n>` fixes the count;
// `?duration=<ms>` sets the motion length. `?physics=rapier` (with `&floor`)
// drives falling shards with Rapier, loaded lazily. `?backForward=<mode>`
// picks the back/forward behaviour ('mirror' by default). `?pattern=<name>`
// breaks the page with that fracture pattern (ADR-053); `?motion=<name>` makes
// that motion the default effect (ADR-055); `?material=<name>` sets the material (ADR-057).
// `?interaction` (or `?interaction=<cursor kit>`) turns on the cursor, hold to
// charge and drag to tear; `?sound` turns on procedural sound (ADR-060).
const params = new URLSearchParams(location.search);
const number = (name: string): number | undefined => {
  const value = Number(params.get(name));
  return params.has(name) && Number.isFinite(value) ? value : undefined;
};
const seed = number('seed');
const shards = number('shards');
const budget = number('budget');
const duration = number('duration');
const physics =
  params.get('physics') === 'rapier' ? rapier({ floor: params.has('floor') }) : undefined;
const BACK_FORWARD = ['mirror', 'reverse', 'same', 'none'] as const;
const backForward = BACK_FORWARD.find((mode) => mode === params.get('backForward'));
const pattern = params.get('pattern');
const motion = params.get('motion');
const material = params.get('material');
const CURSORS = ['ring', 'reticle', 'hammer', 'glass-cutter', 'none'] as const;
const cursor = CURSORS.find((kit) => kit === params.get('interaction'));
const shatter = createShatter({
  ...(pattern
    ? { effect: { motion: motion ?? 'shatter', pattern } }
    : motion
      ? { effect: motion }
      : {}),
  ...(physics ? { physics } : {}),
  ...(material ? { material } : {}),
  ...(params.has('interaction') ? { interaction: cursor ? { cursor } : true } : {}),
  ...(params.has('sound') ? { sound: true } : {}),
  ...(backForward ? { backForward } : {}),
  debug: params.has('debug') ? { panel: params.has('panel') } : false,
  ...(seed === undefined ? {} : { seed }),
  ...(shards === undefined ? {} : { shards }),
  ...(budget === undefined ? {} : { captureBudget: budget }),
  ...(duration === undefined ? {} : { duration }),
});

// A composition of parts (ADR-048): shatter's motion with a left-to-right stagger.
shatter.registerEffect({ name: 'sweep', motion: 'shatter', stagger: 'linear' });

// Debug mode: lifecycle events go to `window.__shatterEvents` for the e2e
// suite, so a test can check what one navigation did (not the hook's last values).
// `__shatterEventTimes` holds each event's `performance.now()` (the performance
// suite places long tasks in phases with it).
if (params.has('debug')) {
  const events: string[] = [];
  const times: number[] = [];
  const log = window as unknown as { __shatterEvents: string[]; __shatterEventTimes: number[] };
  log.__shatterEvents = events;
  log.__shatterEventTimes = times;
  for (const name of ['start', 'covered', 'committed', 'animating', 'end', 'fallback'] as const) {
    shatter.on(name, () => {
      events.push(name);
      times.push(performance.now());
    });
  }
}

// The example restores scroll positions itself, under the overlay.
history.scrollRestoration = 'manual';

interface HistoryState {
  readonly scrollY: number;
}

let renderedRoute = '';

function render(url: URL): void {
  renderedRoute = url.pathname;
  const page =
    (url.pathname === '/lab'
      ? lab
      : url.pathname === '/effects'
        ? effectsPage
        : pages[url.pathname]) ?? notFound;
  outlet.innerHTML = page.render();
  page.mount?.(outlet);
  document.title = `${page.title} — Shatter Router vanilla example`;
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.site-header nav a')) {
    const active = new URL(link.href).pathname === url.pathname;
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

/** Remembers where the current entry was scrolled to, for back/forward. */
function saveScroll(): void {
  const state: HistoryState = { scrollY: window.scrollY };
  history.replaceState(state, '');
}

function navigate(url: URL, origin: { x: number; y: number }, effect?: string): Promise<void> {
  saveScroll();
  return shatter.transition({
    origin,
    ...(effect ? { effect } : {}),
    // In-page anchors scroll themselves; everything else starts at the top.
    scroll: url.hash ? 'none' : 'top',
    commit: () => {
      const state: HistoryState = { scrollY: 0 };
      history.pushState(state, '', url);
      render(url);
      if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView();
    },
  });
}

document.addEventListener('click', (event) => {
  const anchor = findAnchor(event);
  if (!anchor) return;
  const decision = classifyLinkClick(event, anchor);
  if (!decision.intercept) return;
  event.preventDefault();
  // Keyboard activation (Enter) reports 0,0: break from the link's centre instead.
  const fromPointer = event.detail > 0;
  const rect = anchor.getBoundingClientRect();
  const origin = fromPointer
    ? { x: event.clientX, y: event.clientY }
    : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  void navigate(decision.url, origin, getLinkEffect(anchor));
});

window.addEventListener('popstate', (event) => {
  // Fragment navigations fire popstate too; only re-render when the route changed.
  const url = new URL(location.href);
  if (url.pathname === renderedRoute) return;
  const state = event.state as Partial<HistoryState> | null;
  // The DOM still shows the old page here, so it can be captured and shattered.
  void shatter.transition({
    direction: 'back',
    scroll: { x: 0, y: state?.scrollY ?? 0 },
    commit: () => {
      render(url);
    },
  });
});

render(new URL(location.href));
