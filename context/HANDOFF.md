# Hand-off

- **Last updated:** 2026-11-15 (session 2, Milestone 8 merged, Milestone 9 branch created)
- **Session:** 2
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 9 — Glass shading polish (complete; PR #9 green, merge next)
- **Current branch:** `milestone/09-glass-shading` (from `main` at `13d4fb6`)
- **Last commit:** see `git log -1` (`docs(context): milestone 9 complete`)
- **Latest tag:** `m08-rapier` (on `13d4fb6`)

## Done so far

- Milestones 0–8 merged and tagged (see `PROGRESS.md`; ADR-001..037). Latest: M8 Rapier mode (PR #8, `13d4fb6`, `m08-rapier`): `physics: rapier({ floor })` from `shatter-router/rapier` (ADR-037), all three engines green.
- What works: core + `shatter-router/react`, `/react-router` (`createShatterBrowserRouter` in data mode), `/next` (`waitFor`, `data-shatter-pending`), `/rapier`; five effects with first- and last-frame seam tests; back/forward effects with scroll restoration; Rapier physics for `shatter`/`explode` with procedural fallback. Examples: vanilla (4173: `/effects`, `?physics=rapier&floor`, `csp.html`, `csp-wasm.html`), react-router (4174), next (4175; `NEXT_TELEMETRY_DISABLED=1` locally).

- Milestone 9 implemented on this branch: glass lighting (rim, glint), chromatic aberration (`glassSample`), tinted sides, options `glassTint` and `chromatic`, all gated by the 60 ms fade-in and the rest pose (ADR-038). Before/after screenshots in `context/screenshots/` (PROGRESS). 318 unit tests; local e2e 173 passed, 9 skipped; seams unchanged.

## Next 3 steps (Milestone 9)

1. **Merge PR [#9](https://github.com/abdullahasghar966/shatter-router/pull/9)** (green on all three engines on the first run, CI seams identical to M7): `gh pr merge 9 --merge`.
2. Merge with `--merge`, tag `m09-glass-shading`, push the tag.
3. Create `milestone/10-performance` from main (first commit records PR/merge/tag). Milestone 10 (section 8): measure and meet every budget on a real GPU (60 fps at 1440x900 with 160 shards, one draw call and no per-frame allocations from a Performance trace, capture ≤ 120 ms on the docs landing page once it exists, no long task > 50 ms outside capture, textures freed after `end`); strip GLSL comments from shader strings at build to regain engine headroom; build the debug panel (section 10, ADR-025).

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
