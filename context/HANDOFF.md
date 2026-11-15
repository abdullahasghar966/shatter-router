# Hand-off

- **Last updated:** 2026-11-15 (session 2, Milestone 8 merged, Milestone 9 branch created)
- **Session:** 2
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 9 — Glass shading polish (branch created, no code yet)
- **Current branch:** `milestone/09-glass-shading` (from `main` at `13d4fb6`)
- **Last commit:** see `git log -1` (`docs(context): record milestone 8 merge and start milestone 9`)
- **Latest tag:** `m08-rapier` (on `13d4fb6`)

## Done so far

- Milestones 0–8 merged and tagged (see `PROGRESS.md`; ADR-001..037). Latest: M8 Rapier mode (PR #8, `13d4fb6`, `m08-rapier`): `physics: rapier({ floor })` from `shatter-router/rapier` (ADR-037), all three engines green.
- What works: core + `shatter-router/react`, `/react-router` (`createShatterBrowserRouter` in data mode), `/next` (`waitFor`, `data-shatter-pending`), `/rapier`; five effects with first- and last-frame seam tests; back/forward effects with scroll restoration; Rapier physics for `shatter`/`explode` with procedural fallback. Examples: vanilla (4173: `/effects`, `?physics=rapier&floor`, `csp.html`, `csp-wasm.html`), react-router (4174), next (4175; `NEXT_TELEMETRY_DISABLED=1` locally).

## Next 3 steps (Milestone 9: glass shading polish, master prompt 5.5)

1. **Before screenshots first:** headless Playwright frames of `shatter`, `explode` and `flip` at fixed motion times (`?seed=7`, `setMotionTime`), saved to `test-results/shots` and recorded (paths, what they show) in PROGRESS; the after set uses the same frames.
2. **Shading in `src/engine/shaders.ts`** (engine-level, applies to every effect; options `glassTint`, `chromatic` in `ShatterOptions` and uniforms): edge highlight from `vEdge` brighter when the rotated normal faces a fixed virtual light; Blinn-Phong glint with `vNormal`; side faces darker with `glassTint` (default `#cfe8ff` at 12 %); chromatic aberration ∝ shard speed (needs a per-vertex speed varying; max 1.5 px) when `chromatic: true`; every term multiplied by a fade-in uniform that is exactly 0 at `t = 0` and reaches 1 after 60 ms of motion. Keep the incoming-page faces of `flip`/`assemble` at rest unlit (last-frame seam) and the at-rest frames untouched (first-frame seam).
3. Unit tests (option parsing, tint parsing, fade-in function), e2e seams unchanged and green, after screenshots, then the ritual and tag `m09-glass-shading`.

## Deferred (tracked, not forgotten)

- Debug panel (section 10) → Milestone 10 (ADR-025).
- `glassTint`, `chromatic`, lighting fade-in → M9. README items (`scrollbar-gutter: stable`, CSP, browser support incl. ADR-016, popstate note from ADR-026) → M12.

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
