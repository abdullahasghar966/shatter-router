# Hand-off

- **Last updated:** 2026-11-15 (session 2, Milestone 7 merged, Milestone 8 branch created)
- **Session:** 2
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 8 — Rapier mode (complete; PR #8 green, merge next)
- **Current branch:** `milestone/08-rapier` (from `main` at `d6054ae`)
- **Last commit:** see `git log -1` (`docs(context): milestone 8 complete`)
- **Latest tag:** `m07-effects` (on `d6054ae`)

## Done so far

- Milestones 0–7 merged and tagged (see `PROGRESS.md`; ADR-001..036). Latest: M7 Remaining effects (PR #7, `d6054ae`, `m07-effects`): `explode`, `implode`, `flip`, `assemble`, the incoming-page capture, `backForward`, all three engines green.
- What works: core + `shatter-router/react`, `/react-router` (`createShatterBrowserRouter` in data mode), `/next` (`waitFor`, `data-shatter-pending`); five effects with first- and last-frame seam tests; back/forward effects with scroll restoration. Examples: vanilla (4173, `/effects` page), react-router (4174), next (4175; `NEXT_TELEMETRY_DISABLED=1` locally).

- Milestone 8 implemented on this branch: `shatter-router/rapier` (`rapier({ floor })`), `src/core/physics.ts` (public plugin interface), `src/rapier/simulation.ts` + `backend.ts`, engine transforms texture path, runtime plugin loading (ADR-037). Vanilla example: `?physics=rapier`, `&floor`; `csp-wasm.html`. 311 unit tests; local e2e 173 passed, 9 skipped. Visual check done.

- PR [#8](https://github.com/abdullahasghar966/shatter-router/pull/8) green on all three engines on the first run (numbers in PROGRESS).

## Next 3 steps

1. **Merge PR #8** once the last push is green: `gh pr merge 8 --merge`; tag `m08-rapier` on main and push it.
2. Create `milestone/09-glass-shading` from main; first commit records PR #8, merge SHA and tag in PROGRESS and refreshes HANDOFF.
3. **Milestone 9 (glass shading polish):** edge highlight from `edgeDistance` (brighter when the rotated normal faces a fixed virtual light), Blinn-Phong glint with the rotated normal, `chromatic: true` aberration proportional to shard speed (max 1.5 px), darker sides with `glassTint` (default `#cfe8ff` at 12 %), every lighting term exactly zero at `t = 0` and faded in over the first 60 ms of motion; first/last-frame seam tests must stay green; before/after screenshots recorded in PROGRESS.

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
