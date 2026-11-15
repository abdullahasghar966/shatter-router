# Hand-off

- **Last updated:** 2026-11-15 (session 3, Milestone 10 steps 1–3 done; ritual next)
- **Session:** 3
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 10 — Performance pass (in progress)
- **Current branch:** `milestone/10-performance` (from `main` at `48476d2`)
- **Last commit:** see `git log -1` (`feat(debug): debug panel with seam check`)
- **Latest tag:** `m09-glass-shading` (on `48476d2`)

## Done so far

- Milestones 0–9 merged and tagged (see `PROGRESS.md`; ADR-001..041). Latest: M9 Glass shading polish (PR #9, `48476d2`, `m09-glass-shading`): rim light, glint, chromatic aberration (`glassSample`), tinted sides, `glassTint`/`chromatic` options, all exactly zero at rest (ADR-038); seams unchanged on all three engines.
- What works: core + `shatter-router/react`, `/react-router` (`createShatterBrowserRouter` in data mode), `/next` (`waitFor`, `data-shatter-pending`), `/rapier`; five effects with first- and last-frame seam tests; back/forward effects with scroll restoration; Rapier physics with procedural fallback; glass shading. Examples: vanilla (4173: `/effects`, `?physics=rapier&floor`, `csp.html`, `csp-wasm.html`), react-router (4174), next (4175; `NEXT_TELEMETRY_DISABLED=1` locally). Review scripts belong in `coverage/` (Playwright wipes `test-results/`).

## Next 3 steps (Milestone 10: performance pass, master prompt section 8)

1. ~~Regain engine headroom~~ **done** (ADR-039): `build/glsl.ts` esbuild plugin; engine 21.58 → 19.74 kB, seams unchanged.
2. ~~Measure section 8 budgets~~ **done** (ADR-040, PROGRESS "Performance budgets"): `e2e/vanilla/performance.spec.ts`; on the RTX 4050 every effect runs at 60.0 fps, worst frame ≤ 17.1 ms, 1 draw call per frame, no per-frame allocations, no long tasks, capture ~22 ms. Real-GPU rerun: `SHATTER_PERF=1 npx playwright test e2e/vanilla/performance.spec.ts --project=chromium --workers=1` (system Chrome).
3. ~~Debug panel~~ **done** (ADR-041): `src/debug/index.ts` → lazy `dist/debug.js` (3.44 kB); `debug: true | { panel: false }`; examples `?debug&panel`; seam check by tab capture, or capture vs overlay. Screenshot `context/screenshots/m10-debug-panel.jpg`. **Remaining: the milestone ritual** (A.5): full local e2e green, PR "Milestone 10: Performance pass", three-engine CI, merge `--merge`, tag `m10-performance`, record in PROGRESS, branch `milestone/11-docs-site`.

## Deferred (tracked, not forgotten)

- README items (M12): document `debug: { panel: false }`, the seam check's tab-capture prompt, and `SHATTER_PERF=1` for contributors.
- README items (`scrollbar-gutter: stable`, CSP, browser support incl. ADR-016, popstate note from ADR-026) → M12.

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
git switch milestone/10-performance
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

- `SHATTER_ROUTER_MASTER_PROMPT.md` sections 8, 10, 11 and A.5
- `context/DECISIONS.md` ADR-025 (debug panel deferred here), ADR-038, ADR-039
- `packages/shatter-router/src/engine/index.ts` (frame loop, draw calls, textures), `src/runtime/index.ts` (phases, debug hook), `src/core/types.ts` (`ShatterTestHook`), `tsup.config.ts`, `build/glsl.ts`
- `e2e/hook.ts`, `e2e/seam.ts`, `e2e/vanilla/memory.spec.ts` (CDP pattern for measurements)
