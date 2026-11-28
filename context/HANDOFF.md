# Hand-off

- **Last updated:** 2026-11-22 (session 6: M20 features built and committed; full local run, Lighthouse and the A.5 ritual in progress)
- **Session:** 6
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Live docs site:** https://shatter-router.vercel.app (Vercel project `shatter-router`, ADR-045; pushes to `main` deploy production, branches get previews)

## Where we are

- **Current milestone:** 18 (planning, ADR-063) — Site features (`context/PLAN-PRODUCTION.md` section 5, scope in ADR-061).
- **Current branch:** `milestone/20-site-features` (from `main` at `1e7c826`). Latest tag `m17-interaction`. Order after this: M18 (regions), then M21 (production, 1.0).

## Done in M20 (all on the branch, pushed)

- **ADR-061 scope.** Region-dependent items (live card stages, compare mode, specimen strip, scroll-driven breaking, timeline scrubber) wait for M18; showcase and Studio recording are out.
- **Library** (`apps/docs/app/effects/library.tsx`, data `lib/effects.ts` with `family`, `pattern`, `durationMs`; helpers `lib/break-with.ts`): 17 effects in families, family chips, "break with" pattern and material; `?family=&pattern=&material=` via replaceState; cards navigate with a composition; Back reverses it.
- **Effect page** (`app/effects/[effect]/stage.tsx`): hero click and Replay break in place, slow motion ×4 (`timing.duration`), pattern/material/easing selects, code for the current settings, "Open in Studio" (playground query; duration limit raised to 6000).
- **Studio** (`app/playground/`, nav label "Studio", URL unchanged): 6 presets, Randomise, Undo (50 steps, button and Ctrl/Cmd+Z), export for Next.js / React Router / React / vanilla in framework tabs (`app/framework-tabs.tsx`, `lib/frameworks.ts`; choice in localStorage `docs-framework`, applied before paint by the layout script).
- **Docs:** Shiki 4.6.0 at build in the server `Code` (`app/code.tsx`: keywords, strings, comments only; CSS-variable colours), copy buttons (`app/copy-button.tsx`), Getting started in framework tabs, search (`app/search.tsx`, `lib/search.ts`, index `lib/search-index.json` from `scripts/search-index.mjs`, run by the docs build, `--check` in `pnpm lint`), changelog page `/docs/changelog` (`lib/markdown.tsx`, CHANGELOG.md + pending changesets; changesets for M16, M17 and ADR-062 added).
- **Benchmark** `/benchmark` (`app/benchmark/`): 5 measured breaks with fixed settings, reference from this laptop in `lib/measurements.ts` (PROGRESS M20).
- **Library change (ADR-062):** the capture leaves `display: none` HTML elements out of the copy (not inside a select, not when holding an SVG). Unit tests `test/not-rendered.test.ts`.
- **Found and fixed:** the sticky docs sidebar broke the Chromium/Windows first-frame seam on scrolled docs pages (grayscale text in overlap layers, 0.59 %): the sidebar is static now (LEARNINGS). Stale size claims (1.8 kB) corrected to 2.35 kB on the site and README.

## Next steps

1. Read the full local run (`coverage/m20/full-run.log`, Chromium + WebKit) and fix anything red. Then Lighthouse 12.6.0 mobile on a local production build for `/effects`, `/effects/shatter`, `/playground`, `/docs/getting-started`, `/docs/changelog`, `/benchmark` (target ≥ 95 / 100); record in PROGRESS.
2. A.5 ritual: update PROGRESS (M20 row, test counts), open the PR (`gh pr create --base main --head milestone/20-site-features --title "Milestone 20: Site features"`), watch three-engine CI, merge with `--merge`, tag `m20-site-features` on `main`, production Lighthouse after the Vercel deploy.
3. **M18 region transitions** (`transition({ target })`, plan 3.7): plan the bytes first (engine core 13.95 of 15 kB, runtime 9.93 of 10 kB): move data to a lazy chunk or write a budget ADR. M18 also unlocks the ADR-061 deferrals.

## Open problems / blockers

- **Firefox CI white frame (unexplained):** `flip`'s fractured first frame was fully white in 2 of 5 Firefox CI runs before; failed seams log `describeOverlay`. Read the `[overlay]` line in the CI log first if it recurs.
- Budgets close to their limits: runtime 9.93 / 10 kB, engine core 13.95 / 15 kB.
- Local Firefox only through WSL (`coverage/wsl/run-repro.sh`); real-GPU runs use installed Chrome 157 with `--force_high_performance_gpu`.
- Windows WebKit crashes on a View Transition right after a CSP-blocked image: that test is `fixme` on win32 only.
- The Claude desktop browser pane throttles frames (captures there exceed the budget): use headless Playwright for checks and numbers.
- Capture times drift 2–3× as the laptop warms up: compare interleaved (`coverage/m20/code-capture-ab.mjs`).
- Stop stale servers on ports 4173–4176 before e2e after a rebuild (a stale `next start` serves the old build: new pages 404).

## Questions waiting on the user

- None.

## Working tree

- Clean, everything pushed after the commit that carries this file. `.env.local` and `.vercel/` are local and git-ignored. `coverage/m20/` (git-ignored) holds this session's probes: `shots.mjs`, `code-capture-ab.mjs`, `layers.mjs`, `seam-variants.mjs`, `crop.mjs`, `diffspots.mjs`, `bench-gpu.mjs`.

## Resume commands (PowerShell)

```powershell
cd "D:\Shatter Router"
git fetch --all --tags
git status
git switch milestone/20-site-features
pnpm install
pnpm build
$env:NEXT_TELEMETRY_DISABLED=1; pnpm build:examples
pnpm typecheck
pnpm lint            # includes the search index check
pnpm format:check
pnpm test
pnpm size
# e2e (stop stale servers on 4173-4176 first; Firefox only in CI or WSL):
pnpm test:e2e --project=chromium --project=webkit --workers=2
# real-GPU budgets (installed Chrome, headed, discrete GPU forced in the spec):
# $env:SHATTER_PERF=1; npx playwright test e2e/vanilla/performance.spec.ts --project=chromium --workers=1
# Lighthouse (target >= 95 performance / 100 accessibility):
# npx --yes lighthouse@12.6.0 https://shatter-router.vercel.app/ --only-categories=performance,accessibility --chrome-flags="--headless=new"
```

## Read first

- `SHATTER_ROUTER_MASTER_PROMPT.md` (rules, A.5, B.3/B.4), `context/PLAN-PRODUCTION.md` sections 3.7, 5 and 9
- `context/DECISIONS.md` ADR-042, ADR-048, ADR-060, ADR-061, ADR-062
- `apps/docs/app/` (pages), `apps/docs/lib/`, `e2e/docs/*.spec.ts`
