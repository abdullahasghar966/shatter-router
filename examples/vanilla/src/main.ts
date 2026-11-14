import { classifyLinkClick, findAnchor } from 'shatter-router';
import { notFound, pages } from './pages';

const app = document.getElementById('app');
if (!app) throw new Error('#app is missing from index.html');
const outlet: HTMLElement = app;

let renderedRoute = '';

function render(url: URL): void {
  renderedRoute = url.pathname + url.search;
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

function navigate(url: URL): void {
  history.pushState(null, '', url);
  render(url);
  if (!url.hash) window.scrollTo(0, 0);
}

document.addEventListener('click', (event) => {
  const anchor = findAnchor(event);
  if (!anchor) return;
  const decision = classifyLinkClick(event, anchor);
  if (!decision.intercept) return;
  event.preventDefault();
  navigate(decision.url);
});

window.addEventListener('popstate', () => {
  // Fragment navigations fire popstate too; only re-render when the route changed.
  const url = new URL(location.href);
  if (url.pathname + url.search !== renderedRoute) render(url);
});

render(new URL(location.href));
