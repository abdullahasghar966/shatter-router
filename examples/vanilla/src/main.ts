import { classifyLinkClick, createShatter, findAnchor } from 'shatter-router';
import { notFound, pages } from './pages';

const app = document.getElementById('app');
if (!app) throw new Error('#app is missing from index.html');
const outlet: HTMLElement = app;

// `?debug` on the first load turns on debug mode (and the e2e test hook).
// `?budget=<ms>` overrides the capture budget; the e2e suite uses it so slow CI
// machines measure the seam instead of tripping the fallback.
const params = new URLSearchParams(location.search);
const budget = Number(params.get('budget'));
const seed = Number(params.get('seed'));
const shatter = createShatter({
  debug: params.has('debug'),
  ...(params.has('seed') && Number.isFinite(seed) ? { seed } : {}),
  ...(budget > 0 ? { captureBudget: budget } : {}),
});

let renderedRoute = '';

function render(url: URL): void {
  renderedRoute = url.pathname;
  const page = pages[url.pathname] ?? notFound;
  outlet.innerHTML = page.render();
  document.title = `${page.title} — Shatter Router vanilla example`;
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.site-header nav a')) {
    const active = new URL(link.href).pathname === url.pathname;
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView();
}

function navigate(url: URL, origin?: { x: number; y: number }): Promise<void> {
  return shatter.transition({
    ...(origin ? { origin } : {}),
    commit: () => {
      history.pushState(null, '', url);
      render(url);
      if (!url.hash) window.scrollTo(0, 0);
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
  void navigate(decision.url, origin);
});

window.addEventListener('popstate', () => {
  // Fragment navigations fire popstate too; only re-render when the route changed.
  const url = new URL(location.href);
  if (url.pathname !== renderedRoute) render(url);
});

render(new URL(location.href));
