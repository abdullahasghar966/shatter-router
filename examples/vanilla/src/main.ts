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
const shatter = createShatter({
  debug: params.has('debug'),
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

function navigate(url: URL): Promise<void> {
  return shatter.transition({
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
  void navigate(decision.url);
});

window.addEventListener('popstate', () => {
  // Fragment navigations fire popstate too; only re-render when the route changed.
  const url = new URL(location.href);
  if (url.pathname !== renderedRoute) render(url);
});

render(new URL(location.href));
