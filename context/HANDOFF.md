# Hand-off

- **Last updated:** 2026-11-15 (end of session 1, full hand-off B.3)
- **Session:** 1 (the next session is 2)
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 5 — React + React Router adapter (branch created, no code yet)
- **Current branch:** `milestone/05-react-router` (from `main` at `17b79cc`)
- **Last commit:** see `git log -1` (`docs(context): session 1 handoff`)
- **Latest tag:** `m04-shatter-effect` (on `17b79cc`)

## Done so far (milestones 0–4, all merged with green three-engine CI and tagged)

- M0 setup (`m00-setup`), M1 scaffold (PR #1), M2 renderer + first-frame seam (PR #2), M3 fracture + crack (PR #3), M4 `shatter` effect + state machine + fallbacks + a11y (PR #4). Details, numbers and versions: `PROGRESS.md`; reasoning: ADR-001..025.
- What works today, in `examples/vanilla`: a click captures the viewport (pixel-matched), cracks from the click point, shards tumble and fall over the live new page, focus moves and the title is announced; reduced motion crossfades; every failure path still navigates; back/forward shatter too.

## Next 3 steps (Milestone 5)

1. **Read the installed APIs first (rule 3):** `pnpm add react react-dom react-router` (latest stable; React Router's peer range needs React ≥ 19.2.7) and `@types/react @types/react-dom` in `packages/shatter-router` as dev + optional peer deps (`peerDependenciesMeta`). Read `node_modules/react-router/dist/**/index.d.ts` for `Link`, `useNavigate`, `useLocation`, `useNavigationType`, `useNavigation` (data mode only), `NavigationType`. Record facts in `LEARNINGS.md`.
2. **Build `src/react/index.ts`** (`'use client'` not needed here; Next gets its own entry in M6): `ShatterProvider` (creates one `createShatter(options)`, destroys on unmount, context), `useShatter()`, `useShatterNavigate()` (`navigate(to, { effect, origin })`), `ShatterLink` (renders a real `<a href>`; uses `classifyLinkClick` so modifier/middle clicks, `target`, `download`, external links keep native behaviour; origin from the pointer or the link centre for keyboard). Then **`src/react-router/index.ts`**: `ShatterLink` wrapping React Router's `Link`, `ShatterRouteSignal` (inside the router: resolves the pending commit when `useLocation().key` changes in `useLayoutEffect` and, in data mode, `useNavigation().state === 'idle'`), a provider that includes the signal, and POP handling: listen to the Navigation API `navigate` event (feature-detected) to capture before React Router re-renders; without it, no effect on POP. Treat a resolved-but-not-committed `transition()` as superseded (ADR-022). Add subpath exports, tsup entries, size-limit entries (ADR-004).
3. **`examples/react-router`** (Vite + React Router, same pages/styling as vanilla, port 4174 in `playwright.config.ts` APPS) + e2e: each route via ShatterLink, modifier-click and middle-click not intercepted, `useShatterNavigate`, a loader-delayed route (data mode) waits for idle, back/forward, seam test reuse (`e2e/seam.ts`). Unit tests for ShatterLink click rules with `@testing-library/react` or plain `react-dom/client` + happy-dom. Then the milestone ritual (A.5).

## Deferred (tracked, not forgotten)

- `backForward: 'reverse'` → Milestone 7 with `assemble` (ADR-025).
- Debug panel (section 10) → Milestone 10 (ADR-025); its data is already on the debug hook.
- `physics: 'rapier'` → M8. `glassTint`, `chromatic`, lighting fade-in → M9. README items (`scrollbar-gutter: stable`, CSP directives, browser support incl. ADR-016) → M12.

## Open problems / blockers

- Local Firefox cannot launch on this machine (LEARNINGS, Environment); CI runs Firefox headed under xvfb with Mesa (ADR-015).
- Playwright's Windows WebKit build crashes on a View Transition right after a CSP-blocked image: that one test is `fixme` on win32 only; it passes on Linux CI.
- The Claude desktop browser pane throttles frames and stops painting when the app window is behind others: use headless Playwright scripts for visual checks and numbers.
- Running Chromium + WebKit e2e together locally (4 workers) is slow under software GL; use `--workers=2` if a timing-sensitive test flakes.

## Questions waiting on the user

- None.

## Working tree

- Clean, everything pushed (verified with `git status` and `git rev-parse HEAD` = `git rev-parse @{u}` before ending the session).

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
pnpm exec playwright install   # once per machine
pnpm test:e2e --project=chromium --project=webkit --workers=2   # Firefox cannot launch on this machine
pnpm size
# a fresh clone needs a repo-local identity (ADR-002):
# git config user.name "Abdullah Asghar"; git config user.email "203540047+abdullahasghar966@users.noreply.github.com"
```

## Read first

- `SHATTER_ROUTER_MASTER_PROMPT.md` sections 6–7 (React and React Router APIs) and A.5 (milestone ritual)
- `context/PROGRESS.md`, `context/DECISIONS.md` (ADR-020 facade/runtime split, ADR-022 interruption semantics are the most relevant), `context/LEARNINGS.md`
- `packages/shatter-router/src/core/shatter.ts` (facade), `src/core/types.ts` (public options/events/request), `src/core/links.ts` (click rules to reuse in `ShatterLink`)
- `examples/vanilla/src/main.ts` (how a router integrates: commit, origin, direction, scroll)
- `playwright.config.ts`, `e2e/fixtures.ts`, `e2e/seam.ts`, `e2e/hook.ts` (test helpers to reuse)
