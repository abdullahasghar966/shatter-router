# Hand-off

- **Last updated:** 2026-11-15 (session 2, after the example + e2e sub-task)
- **Session:** 2
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 5 — React + React Router adapter
- **Current branch:** `milestone/05-react-router` (from `main` at `17b79cc`)
- **Last commit:** see `git log -1` (`feat(react-router): example app, e2e, popstate gate`)
- **Latest tag:** `m04-shatter-effect` (on `17b79cc`)

## Done so far

- Milestones 0–4 merged and tagged (see `PROGRESS.md`; ADR-001..025).
- Milestone 5, sub-task 1 (this session): React 19.3.1 + React Router 8.5.1 installed as dev + optional peer deps; APIs verified from `node_modules` (LEARNINGS, "react-router 8.5.1").
  - `src/react/` → `shatter-router/react`: `ShatterProvider` (router-agnostic, `navigate` prop, `instance` prop), `ShatterLink`, `useShatter`, `useShatterNavigate`. Shared internals in `src/react/shared.ts` (`useShatterClick`, `useShatterInstance`, `boundedCommit`).
  - `src/react-router/` → `shatter-router/react-router`: `ShatterProvider` (inside the router), `ShatterLink`, `ShatterNavLink`, `useShatterNavigate`, `useShatter`, `ShatterRouteSignal`. `bridge.ts` (`RouteBridge`) resolves commits on render and holds the router's popstate for back/forward (ADR-026, ADR-027).
  - Exports, tsup entries, size-limit entries (react 2.46 kB, react-router 3.35 kB, budget 6 KB each).
  - Unit tests: `test/react.test.tsx` (24), `test/react-router.test.tsx` (11: declarative, data-mode loader wait, timeout, NavLink, modifier clicks, back/forward hold, hash-only). Total 253 unit tests, green.

- Milestone 5, sub-task 2: `examples/react-router` (Vite 8.3.8 + `@vitejs/plugin-react` 6.3.0, data mode via `createShatterBrowserRouter`, `?mode=declarative`, `?mode=data-plain`; port 4174, in `playwright.config.ts`). E2E `e2e/react-router/navigation.spec.ts` (9) and `transitions.spec.ts` (7). Back/forward bug found and fixed: popstate gate before the router (`src/react-router/pop-gate.ts`, `createShatterBrowserRouter`, ADR-028). Local full suite Chromium + WebKit: 105 passed, 9 skipped. Visual check done with headless screenshots (PROGRESS).

- PR [#5](https://github.com/abdullahasghar966/shatter-router/pull/5) open. First PR CI run: Chromium green; WebKit failed the React Router first-frame seam (button font, fixed by ADR-029); Firefox failed the deep-link test (aborted prefetch warnings, test fixed) and the back/forward test (scrollY 243.9 instead of 0 after forward). The scroll log printed by the test showed Firefox scrolling the held old page (entry in `auto` scroll restoration): ADR-030 (bridge keeps entries `manual`, restores positions itself) was not enough: Firefox scrolls after the real popstate, while it is held; ADR-031 holds the page still and starts the capture a frame later. Firefox went green with ADR-031. WebKit (Linux) still had the serif button after ADR-029: the computed font is `-webkit-standard`; ADR-032 resolves it to the matching generic family. Waiting for the PR CI run.

## Next 3 steps

1. **Check PR #5 CI** (`gh pr checks 5`). If Firefox is green, remove the `[scroll-log]` diagnostics from `e2e/react-router/transitions.spec.ts` in a small `test:` commit. If not, read `gh run view <id> --log | grep -A30 "scroll-log] firefox"`.
2. **Finish the ritual (A.5):** PR checks green on all three engines, `gh pr merge 5 --merge`, tag `m05-react-router` on main, record PR/merge/tag in PROGRESS as the first commit of `milestone/06-nextjs`.
3. **Start Milestone 6 (Next.js App Router):** see the master prompt section 7; read the installed `next` types first.

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
