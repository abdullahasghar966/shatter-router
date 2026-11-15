# Hand-off

- **Last updated:** 2026-11-15 (session 2, Milestone 9 merged, Milestone 10 branch created)
- **Session:** 2
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 10 — Performance pass (branch created, no code yet)
- **Current branch:** `milestone/10-performance` (from `main` at `48476d2`)
- **Last commit:** see `git log -1` (`docs(context): record milestone 9 merge and start milestone 10`)
- **Latest tag:** `m09-glass-shading` (on `48476d2`)

## Done so far

- Milestones 0–9 merged and tagged (see `PROGRESS.md`; ADR-001..038). Latest: M9 Glass shading polish (PR #9, `48476d2`, `m09-glass-shading`): rim light, glint, chromatic aberration (`glassSample`), tinted sides, `glassTint`/`chromatic` options, all exactly zero at rest (ADR-038); seams unchanged on all three engines.
- What works: core + `shatter-router/react`, `/react-router` (`createShatterBrowserRouter` in data mode), `/next` (`waitFor`, `data-shatter-pending`), `/rapier`; five effects with first- and last-frame seam tests; back/forward effects with scroll restoration; Rapier physics with procedural fallback; glass shading. Examples: vanilla (4173: `/effects`, `?physics=rapier&floor`, `csp.html`, `csp-wasm.html`), react-router (4174), next (4175; `NEXT_TELEMETRY_DISABLED=1` locally). Review scripts belong in `coverage/` (Playwright wipes `test-results/`).

## Next 3 steps (Milestone 10: performance pass, master prompt section 8)

1. **Regain engine headroom first:** the engine chunk is 21.58 of 22 KB. Strip GLSL comments and collapse whitespace in the shader template strings at build time (an esbuild plugin in `tsup.config.ts` that rewrites `/* glsl */` templates, or minify the strings in `src/engine/shaders.ts` and the effect chunks through a small build-time function), verify the shaders still compile (e2e) and record the new size.
2. **Measure every section 8 budget on a real GPU** (headed Chrome on the RTX 4050 through Playwright, not the throttled app pane): 60 fps at 1440x900 with 160 shards for each effect; one draw call per frame; no per-frame allocations (Chrome DevTools Protocol `HeapProfiler` sampling or a Performance trace via `page.context().tracing` / CDP `Tracing`); no long task > 50 ms outside the capture step (PerformanceObserver `longtask`); textures freed after `end` (already: `textureCount` 0); capture time on the example pages (the docs landing page arrives in M11, re-measure there). Record device, browser and numbers in PROGRESS.
3. **Debug panel (section 10, ADR-025):** shadow-DOM panel when `debug: true`: state machine state and phase timings, shard count, device tier, FPS, draw calls, wireframe toggle and impact point, and a "seam check" button that captures the live DOM and the overlay frame and shows a diff heatmap with the % of differing pixels. Lazy (debug only), its own size budget. Then the ritual and tag `m10-performance`.

## Deferred (tracked, not forgotten)

- Debug panel (section 10) → Milestone 10 (ADR-025).
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
