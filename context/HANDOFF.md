# Hand-off

- **Last updated:** 2026-11-15 (session 2, after the adapter sub-task)
- **Session:** 2
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 5 — React + React Router adapter
- **Current branch:** `milestone/05-react-router` (from `main` at `17b79cc`)
- **Last commit:** see `git log -1` (`feat(react): React and React Router adapters`)
- **Latest tag:** `m04-shatter-effect` (on `17b79cc`)

## Done so far

- Milestones 0–4 merged and tagged (see `PROGRESS.md`; ADR-001..025).
- Milestone 5, sub-task 1 (this session): React 19.3.1 + React Router 8.5.1 installed as dev + optional peer deps; APIs verified from `node_modules` (LEARNINGS, "react-router 8.5.1").
  - `src/react/` → `shatter-router/react`: `ShatterProvider` (router-agnostic, `navigate` prop, `instance` prop), `ShatterLink`, `useShatter`, `useShatterNavigate`. Shared internals in `src/react/shared.ts` (`useShatterClick`, `useShatterInstance`, `boundedCommit`).
  - `src/react-router/` → `shatter-router/react-router`: `ShatterProvider` (inside the router), `ShatterLink`, `ShatterNavLink`, `useShatterNavigate`, `useShatter`, `ShatterRouteSignal`. `bridge.ts` (`RouteBridge`) resolves commits on render and holds the router's popstate for back/forward (ADR-026, ADR-027).
  - Exports, tsup entries, size-limit entries (react 2.46 kB, react-router 3.35 kB, budget 6 KB each).
  - Unit tests: `test/react.test.tsx` (24), `test/react-router.test.tsx` (11: declarative, data-mode loader wait, timeout, NavLink, modifier clicks, back/forward hold, hash-only). Total 253 unit tests, green.

## Next 3 steps

1. **`examples/react-router`** (new workspace package `@shatter-router/example-react-router`): Vite 8.3.8 + `@vitejs/plugin-react` (latest, check `npm view`), React 19.3.1, React Router 8.5.1. Data mode (`createBrowserRouter` + `RouterProvider` from `react-router/dom`), root route element = `<ShatterProvider options={…}>` + header nav with `ShatterNavLink`s + `<Outlet/>` + `<ScrollRestoration/>`. Same pages and look as `examples/vanilla` (reuse its `style.css` content; pages: `/`, `/work`, `/about`, plus `/slow` with a ~400 ms loader). Query params like vanilla (`?debug`, `?seed`, `?shards`, `?budget`, `?duration`). `?mode=declarative` renders the same routes under `BrowserRouter` instead. A button using `useShatterNavigate`. Port 4174 (`vite preview --port 4174 --strictPort`), add to `APPS` and `webServer` in `playwright.config.ts`, and to `build:examples` (it already builds `./examples/*`).
2. **E2E `e2e/react-router/*.spec.ts`** reusing `e2e/fixtures.ts`, `e2e/hook.ts`, `e2e/seam.ts`: each route via ShatterLink ends on the right route with the effect (`end` without fallback), modifier-click (new page not opened in same tab; `ctrl+click` → popup) and middle click not intercepted, `useShatterNavigate`, loader route waits (overlay covers until the slow page is in the DOM), back/forward shatters and lands on the right route + scroll restored, first-frame seam (≤ 0.5 %), declarative mode smoke test, no console errors. Run locally: `pnpm build; pnpm build:examples; pnpm test:e2e --project=chromium --project=webkit --workers=2`.
3. **Milestone ritual (A.5):** browser-verify with headless Playwright screenshots, update all four context files, PR `Milestone 05: React + React Router adapter`, `gh pr checks --watch`, merge `--merge`, tag `m05-react-router`, then start `milestone/06-nextjs`.

## Deferred (tracked, not forgotten)

- `backForward: 'reverse'` → Milestone 7 with `assemble` (ADR-025).
- Debug panel (section 10) → Milestone 10 (ADR-025).
- `physics: 'rapier'` → M8. `glassTint`, `chromatic`, lighting fade-in → M9. README items (`scrollbar-gutter: stable`, CSP, browser support incl. ADR-016, popstate note from ADR-026) → M12.
- `'use client'` for the React entries is handled with the Next.js adapter (M6).

## Open problems / blockers

- Local Firefox cannot launch on this machine (LEARNINGS, Environment); CI runs Firefox headed under xvfb (ADR-015).
- Windows WebKit crashes on a View Transition right after a CSP-blocked image: that test is `fixme` on win32 only.
- The Claude desktop browser pane throttles frames: use headless Playwright for visual checks and numbers.
- Local e2e: `--workers=2` (software GL is slow with more).

## Questions waiting on the user

- None.

## Working tree

- Clean, everything pushed after the commit that carries this file.

## Resume commands (PowerShell)

```powershell
cd "D:\Shatter Router"
git fetch --all --tags
git status
git switch milestone/05-react-router
pnpm install
pnpm build
pnpm build:examples
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e --project=chromium --project=webkit --workers=2   # Firefox cannot launch on this machine
pnpm size
# a fresh clone needs a repo-local identity (ADR-002):
# git config user.name "Abdullah Asghar"; git config user.email "203540047+abdullahasghar966@users.noreply.github.com"
```

## Read first

- `SHATTER_ROUTER_MASTER_PROMPT.md` sections 6–7, 11 and A.5
- `context/DECISIONS.md` ADR-026, ADR-027 (this milestone), ADR-020, ADR-022
- `packages/shatter-router/src/react-router/components.tsx`, `bridge.ts`; `src/react/components.tsx`, `shared.ts`
- `examples/vanilla/` (pages, styles, query params to mirror), `playwright.config.ts`, `e2e/fixtures.ts`, `e2e/hook.ts`, `e2e/seam.ts`, `e2e/vanilla/*.spec.ts`
