import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import type { ShatterOptions } from 'shatter-router';
import { createShatterBrowserRouter } from 'shatter-router/react-router';
import { DeclarativeApp, dataRoutes } from './app';

// Same query parameters as the vanilla example, read on the first load:
// `?debug` (debug mode and the e2e hook; add `&panel` for the debug panel),
// `?budget=<ms>` (capture budget),
// `?seed=<n>`, `?shards=<n>`, `?duration=<ms>`. `?mode=declarative` renders
// the routes under <BrowserRouter> instead of a data router; `?mode=data-plain`
// uses React Router's own createBrowserRouter (no back/forward gate, ADR-028).
const params = new URLSearchParams(location.search);
const number = (name: string): number | undefined => {
  const value = Number(params.get(name));
  return params.has(name) && Number.isFinite(value) ? value : undefined;
};
const seed = number('seed');
const shards = number('shards');
const budget = number('budget');
const duration = number('duration');
const options: ShatterOptions = {
  debug: params.has('debug') ? { panel: params.has('panel') } : false,
  ...(seed === undefined ? {} : { seed }),
  ...(shards === undefined ? {} : { shards }),
  ...(budget === undefined ? {} : { captureBudget: budget }),
  ...(duration === undefined ? {} : { duration }),
};

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

const mode = params.get('mode');
const createRouter = mode === 'data-plain' ? createBrowserRouter : createShatterBrowserRouter;

createRoot(container).render(
  <StrictMode>
    {mode === 'declarative' ? (
      <BrowserRouter>
        <DeclarativeApp options={options} />
      </BrowserRouter>
    ) : (
      <RouterProvider router={createRouter(dataRoutes(options))} />
    )}
  </StrictMode>,
);
