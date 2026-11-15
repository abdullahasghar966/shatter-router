# Hand-off

- **Last updated:** 2026-11-15 (session 3, Milestone 10 merged, Milestone 11 branch created)
- **Session:** 3
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 11 — Docs site (branch created, no code yet)
- **Current branch:** `milestone/11-docs-site` (from `main` at `c3175ef`)
- **Last commit:** see `git log -1` (`docs(context): record milestone 10 merge and start milestone 11`)
- **Latest tag:** `m10-performance` (on `c3175ef`)

## Done so far

- Milestones 0–10 merged and tagged (see `PROGRESS.md`; ADR-001..041). Latest: M10 Performance pass (PR #10, `c3175ef`, `m10-performance`):
  - GLSL minified at build (ADR-039): engine 19.76 of 22 KB.
  - Section 8 budgets measured and enforced by `e2e/vanilla/performance.spec.ts` (ADR-040). RTX 4050: 60 fps for every effect at 1440x900 with 160 shards, 1 draw call per frame, no long tasks, capture ~22 ms. Exact allocation tracking (`e2e/alloc.ts`) shows 0 B per frame beyond boxed numbers, after fixing the array destructuring in `draw()` and `for...of` in `isComplete`.
  - Debug panel (ADR-041): lazy `dist/debug.js` 3.44 kB, `debug: true | { panel: false }`, seam check by tab capture.
- What works: core + `shatter-router/react`, `/react-router` (`createShatterBrowserRouter` in data mode), `/next` (`waitFor`, `data-shatter-pending`), `/rapier`; five effects with first- and last-frame seam tests; back/forward effects with scroll restoration; Rapier physics with procedural fallback; glass shading; debug panel. Examples: vanilla (4173: `/effects`, `?physics=rapier&floor`, `?debug&panel`, `csp.html`, `csp-wasm.html`), react-router (4174), next (4175; `NEXT_TELEMETRY_DISABLED=1` locally). Review scripts belong in `coverage/` (git-ignored; Playwright wipes `test-results/`).

## Next 3 steps (Milestone 11: docs site, master prompt section 13)

1. **Scaffold `apps/docs`** (or `site/`): a Next.js App Router app in the pnpm workspace (mirror `examples/next`: `next` version, `ShatterProvider` from `shatter-router/next`, `transpilePackages`/workspace dependency). Dark, editorial design with one display typeface and one mono (self-hosted via `next/font`). Every internal link is a `ShatterLink`. Add it to `playwright.config.ts` (port 4176) and to CI's build. Decide early whether hero region shattering (`transition({ target })`) fits the architecture (the engine draws a full-viewport overlay; a region would need a cropped snapshot and camera). If it doesn't fit cleanly, do the full-page version and write an ADR.
2. **Pages:** landing hero ("Break the page." / "Click anywhere."); effects gallery (one card per effect, navigating with that effect via `data-shatter-effect`); playground with Tweakpane (verify its API in `node_modules`) for every option plus "Copy config"; docs pages: getting started ×4, API reference, custom effect with a full `ripple-out` example effect, performance (numbers from PROGRESS), accessibility, CSP, troubleshooting, browser support.
3. **Measure and verify:** capture time on the landing page at 1440x900 (section 8: ≤ 120 ms, report the real number); Lighthouse mobile Performance and Accessibility ≥ 95 (record the scores); e2e for the docs site (navigation, gallery effect per card, playground copy). Then the ritual, tag `m11-docs-site`.

## Deferred (tracked, not forgotten)

- README items (M12): document `debug: { panel: false }`, the seam check's tab-capture prompt, `SHATTER_PERF=1` for contributors, `scrollbar-gutter: stable`, CSP, browser support incl. ADR-016, the popstate note from ADR-026.

## Open problems / blockers

- Local Firefox and Playwright's full Chromium cannot launch on this machine (side-by-side error, LEARNINGS); CI runs Firefox headed under xvfb (ADR-015). For headed or real-GPU runs, use installed Chrome (`channel: 'chrome'`).
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
git switch milestone/11-docs-site
pnpm install
pnpm build
pnpm build:examples
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e --project=chromium --project=webkit --workers=2   # Firefox cannot launch on this machine
pnpm size
# real-GPU budgets (installed Chrome, headed):
# $env:SHATTER_PERF=1; npx playwright test e2e/vanilla/performance.spec.ts --project=chromium --workers=1
# a fresh clone needs a repo-local identity (ADR-002):
# git config user.name "Abdullah Asghar"; git config user.email "203540047+abdullahasghar966@users.noreply.github.com"
```

## Read first

- `SHATTER_ROUTER_MASTER_PROMPT.md` sections 6, 8, 13 and A.5
- `context/DECISIONS.md` ADR-034/035 (Next adapter), ADR-040, ADR-041
- `examples/next/` (app layout, providers, `next.config`), `packages/shatter-router/src/next/`, `src/core/effect.ts` (plugin interface for `ripple-out`), `playwright.config.ts`, `.github/workflows/ci.yml`
