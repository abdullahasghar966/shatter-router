# Hand-off

- **Last updated:** 2026-11-15 (session 2, Milestone 6 merged, Milestone 7 branch created)
- **Session:** 2
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 7 — Remaining effects (complete; PR #7 green, merge next)
- **Current branch:** `milestone/07-effects` (from `main` at `99f7e26`)
- **Last commit:** see `git log -1` (`docs(context): milestone 7 complete`)
- **Latest tag:** `m06-nextjs` (on `99f7e26`)

## Done so far

- Milestones 0–6 merged and tagged (see `PROGRESS.md`; ADR-001..035). Latest: M5 React + React Router (PR #5, `0d4d85f`, `m05-react-router`), M6 Next.js App Router (PR #6, `99f7e26`, `m06-nextjs`), all three engines green.
- What works: `shatter-router` (core), `shatter-router/react`, `shatter-router/react-router` (use `createShatterBrowserRouter` in data mode), `shatter-router/next` (`waitFor`, `data-shatter-pending`). Examples: `examples/vanilla` (4173), `examples/react-router` (4174), `examples/next` (4175, build needs `NEXT_TELEMETRY_DISABLED=1` locally). Back/forward shatter in all of them; the adapters take over scroll restoration for history moves (ADR-030, 031, 035).

- Follow-up fixes (start of Milestone 7): the vanilla back/forward test now checks the lifecycle events of each history move (`window.__shatterEvents` in the vanilla example, shared helpers `lifecycleEvents`/`clearLifecycleEvents`/`FULL_EFFECT` in `e2e/hook.ts`) instead of the hook's last values; `test/route-bridge.test.ts` covers the ADR-035 clamp rule (mutation-checked), an app scroll winning, the same-URL fast path and fragment scrolling; `shatter-router/react` links and `useShatterNavigate` scroll to a `#fragment` like the router adapters (`scrollToFragment` moved to `src/react/shared.ts`). 272 unit tests; local e2e 139 passed, 9 skipped.

- Milestone 7 implemented on this branch: `explode`, `implode`, `flip`, `assemble` (`src/engine/effects/`), `core/spring.ts` (`settle`), interface refinements (layers, `uThickness`, `uIncoming`, `settle()`, fragment hook on all faces), incoming capture with `shatter` as substitute, final rest frame + `settled` pause, `backForward` (ADR-036). Vanilla example `/effects` page. 301 unit tests; local e2e 165 passed, 9 skipped. Visual check done.

- PR [#7](https://github.com/abdullahasghar966/shatter-router/pull/7) green on all three engines on the first run (numbers in PROGRESS).

## Next 3 steps

1. **Merge PR #7** once the last push is green: `gh pr merge 7 --merge`; tag `m07-effects` on main and push it.
2. Create `milestone/08-rapier` from main; first commit records PR #7, merge SHA and tag in PROGRESS and refreshes HANDOFF.
3. **Milestone 8:** `physics: 'rapier'` as an optional lazy chunk (`shatter-router/rapier`), `@dimforge/rapier3d-compat` optional peer loaded with dynamic `import()` and `await RAPIER.init()`, convex-hull colliders from the extruded cells (cuboid when `convexHull()` returns null), `floor: true`, 100 px = 1 m, fixed 1/60 s step with an accumulator, per-shard mat4 written to a float texture read with `texelFetch` (one draw call), initial impulses from the procedural formula. Read the installed rapier types first.

## Deferred (tracked, not forgotten)

- Debug panel (section 10) → Milestone 10 (ADR-025).
- `physics: 'rapier'` → M8. `glassTint`, `chromatic`, lighting fade-in → M9. README items (`scrollbar-gutter: stable`, CSP, browser support incl. ADR-016, popstate note from ADR-026) → M12.

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
