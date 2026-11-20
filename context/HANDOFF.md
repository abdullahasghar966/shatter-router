# Hand-off

- **Last updated:** 2026-11-15 (session 3, Milestone 11 built and verified locally; ritual next)
- **Session:** 3
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 11 — Docs site (complete locally; PR, CI, merge and tag next)
- **Current branch:** `milestone/11-docs-site` (from `main` at `c3175ef`)
- **Last commit:** see `git log -1` (`feat(docs): the docs site`)
- **Latest tag:** `m10-performance` (on `c3175ef`)

## Done so far

- Milestones 0–10 merged and tagged (see `PROGRESS.md`; ADR-001..043). Latest: M10 Performance pass (PR #10, `c3175ef`, `m10-performance`):
  - GLSL minified at build (ADR-039): engine 19.76 of 22 KB.
  - Section 8 budgets measured and enforced by `e2e/vanilla/performance.spec.ts` (ADR-040). RTX 4050: 60 fps for every effect at 1440x900 with 160 shards, 1 draw call per frame, no long tasks, capture ~22 ms. Exact allocation tracking (`e2e/alloc.ts`) shows 0 B per frame beyond boxed numbers, after fixing the array destructuring in `draw()` and `for...of` in `isComplete`.
  - Debug panel (ADR-041): lazy `dist/debug.js` 3.44 kB, `debug: true | { panel: false }`, seam check by tab capture.
- What works: core + `shatter-router/react`, `/react-router` (`createShatterBrowserRouter` in data mode), `/next` (`waitFor`, `data-shatter-pending`), `/rapier`; five effects with first- and last-frame seam tests; back/forward effects with scroll restoration; Rapier physics with procedural fallback; glass shading; debug panel. Examples: vanilla (4173: `/effects`, `?physics=rapier&floor`, `?debug&panel`, `csp.html`, `csp-wasm.html`), react-router (4174), next (4175; `NEXT_TELEMETRY_DISABLED=1` locally). Review scripts belong in `coverage/` (git-ignored; Playwright wipes `test-results/`).

## Milestone 11 (docs site, section 13): what was built

- `apps/docs` (Next 16 App Router, port 4176 for e2e, built by `pnpm build:examples`): landing hero (a click breaks the whole page in place with `assemble`, ADR-042), effects gallery and detail pages (each card navigates with its own effect, the custom `ripple-out` included: `apps/docs/effects/ripple-out.ts`, registered in `app/providers.tsx`), playground (Tweakpane 4.0.5, its own instance, "Copy config"), and 9 docs pages. Measurements live in `apps/docs/lib/measurements.ts`, copied from PROGRESS.
- Library: priming capture on first intent (ADR-043; runtime 7.76 kB). Landing capture on GPU: median 82 ms (48–88, 2 outliers of 129 and 156 in 12). Lighthouse mobile: 97–99 / 100 on every main page.

## Next 3 steps

1. **Ritual for M11:** PR "Milestone 11: Docs site", three-engine CI (`e2e/docs/*` runs on all three; Firefox has not run the docs suite yet, so watch for Firefox-only issues such as console warnings), merge `--merge`, tag `m11-docs-site`, record in PROGRESS, branch `milestone/12-release`.
2. **Milestone 12 (release readiness, section 12):** README that opens with a GIF/video of `shatter` on the docs site (record with Playwright video in installed Chrome), a 3-line quick start, a feature list, real performance numbers, browser support, roadmap (section 14 + region support from ADR-042); CHANGELOG via Changesets, LICENSE (exists in the package), CONTRIBUTING (incl. `SHATTER_PERF=1`, local Firefox caveat), issue templates, `npm pack --dry-run`, final full test run.
3. Check the Definition of done (section 15) item by item and record it in PROGRESS.

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

- `SHATTER_ROUTER_MASTER_PROMPT.md` sections 12, 14, 15 and A.5
- `context/DECISIONS.md` ADR-042, ADR-043; `context/PROGRESS.md` (all measurements for the README)
- `apps/docs/` (the site the README GIF shows), `packages/shatter-router/package.json` (`files`, exports), `.changeset/`
