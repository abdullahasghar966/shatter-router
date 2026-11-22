# Hand-off

- **Last updated:** 2026-11-22 (session 6 start: M20 in progress, ADR-061 written)
- **Session:** 6
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Live docs site:** https://shatter-router.vercel.app (Vercel project `shatter-router`, ADR-045; pushes to `main` deploy production, branches get previews)

## Where we are

- **Current milestone:** 20 — Site features (`context/PLAN-PRODUCTION.md` section 5), not started beyond this branch.
- **Current branch:** `milestone/20-site-features` (from `main` at `1e7c826`, the PR #23 merge). Its first commit is this hand-off.
- **Latest tag:** `m17-interaction` (on `1e7c826`). Order still to do (plan section 9): M20, then M18, then M21.

## Done in session 5

- **M16** (tag `m16-motions`, PRs #19–#21): 11 motions in four families (ADR-055), the long-task budget leaves out the incoming capture (ADR-056), materials glass/ice/mirror/obsidian/paper/metal/holo (ADR-057), falling effects complete from a remembered last-visible time (ADR-058), easing (ADR-059). Side faces of resting pieces are no longer drawn (a web over the page during every Back).
- **PR #22** (`09a431b`): playground panel built in steps (Lighthouse TBT), WebKit prefetch race in `e2e/docs/lab.spec.ts`, overlay diagnostics on failed seams (`describeOverlay` in `e2e/seam.ts`).
- **M17** (tag `m17-interaction`, PR #23, ADR-060): `interaction` (cursor kits, pre-crack, hold to charge, drag to tear, haptics) and `sound` (procedural WebAudio, `setSound()`) as lazy chunks; gestures remembered by the core, merged by the runtime (`intensity`, `path`); docs site uses the library cursor and has a sound toggle.
- Production Lighthouse after M17: 96–99 performance, 100 accessibility on `/`, `/effects`, `/effects/vortex`, `/playground`, `/docs/api`.

## Next steps (M20, plan section 5)

1. **ADR-061 (M20 scope) is written.** Region-dependent items wait for M18 (live mini stages that break on hover-hold, compare mode with two stages, the strip of breakable specimens, scroll-driven breaking): the engine always covers the whole viewport (ADR-042). A showcase needs real sites using the library: not before 1.0 (no invented entries, master prompt rule 2). Everything else is in scope:
   - **Library** (`apps/docs/app/effects/page.tsx`, data in `apps/docs/lib/effects.ts`): group the 16 motions by family (gravity, force, order, matter, assembly), filters by pattern and material (query string, so Back keeps them), each card still navigates with its own effect.
   - **Effect page** (`apps/docs/app/effects/[effect]/page.tsx`): replay button (break in place like the hero, `transition({ commit: () => undefined, effect })`), slow motion (×4 duration), pattern/material/easing selects, the code for the current settings, "open in Studio" (playground URL with the same query).
   - **Studio** (`apps/docs/app/playground/`): presets (a few named compositions), randomise, undo (history of configs), export tabs for vanilla / React / React Router / Next (extend `configCode`). Recording a GIF/WebM is out: the overlay canvas holds only the glass, not the page under it (ADR-061 should say so).
   - **Docs:** search (Cmd-K, a prebuilt index generated at build from the docs pages' text), syntax highlighting at build (Shiki; check the Lighthouse cost), copy buttons, framework tabs that remember the choice (localStorage), a changelog page from `packages/shatter-router/CHANGELOG.md`.
   - **Benchmark page:** live in-browser numbers from the library's public events (`covered.captureMs`, `fractured.fractureMs`, frames during `animating`) next to the reference machine's (PROGRESS).
   - E2E for every feature; Lighthouse ≥ 95 / 100 on new pages; docs complete for every new API.
2. M20 ritual: PR, three-engine CI, merge `--merge`, tag `m20-site-features`, production Lighthouse.
3. **M18 region transitions** (`transition({ target })`, plan 3.7): plan the bytes first. Engine core is 13.95 of 15 kB, runtime 9.82 of 10 kB; move data (the material table) to a lazy chunk or write a budget ADR. Then M21 (production foundations, npm 1.0 with the user's login).

## Open problems / blockers

- **Firefox CI white frame (unexplained):** `flip`'s fractured first frame was a fully white overlay (97.0018 %) in 2 of 5 Firefox CI runs (PR #21 first run, PR #22 first run), never locally (WSL Linux Firefox 1572 on llvmpipe, 5 of 5 at 0.0000 %). Failed seams now log `describeOverlay` (the pixel the shader draws, the top element, styles, context lost). If it recurs, read the `[overlay]` line in the CI log before anything else.
- Budgets close to their limits: runtime 9.82 / 10 kB, engine core 13.95 / 15 kB.
- Local Firefox: only through WSL (`coverage/wsl/run-repro.sh`, see LEARNINGS); Windows Firefox and Playwright's full Chromium cannot launch. Real-GPU runs use installed Chrome 157 with `--force_high_performance_gpu` (Chrome picked the Intel iGPU once).
- Windows WebKit crashes on a View Transition right after a CSP-blocked image: that test is `fixme` on win32 only.
- The Claude desktop browser pane throttles frames: use headless Playwright for visual checks and numbers.
- This laptop's capture times drift 2–3× as it warms up: compare builds interleaved (`coverage/m16/ab-perf.sh`).

## Questions waiting on the user

- None.

## Working tree

- Clean, everything pushed after the commit that carries this file. `.env.local` (Vercel OIDC token) and `.vercel/` exist locally and are git-ignored. `coverage/` (git-ignored) holds the review and probe scripts of sessions 1–5.

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
pnpm lint
pnpm format:check
pnpm test
pnpm size
# e2e (stop stale servers on 4173-4176 first; Firefox only in CI or WSL):
pnpm test:e2e --project=chromium --project=webkit --workers=2
# real-GPU budgets (installed Chrome, headed, discrete GPU forced in the spec):
# $env:SHATTER_PERF=1; npx playwright test e2e/vanilla/performance.spec.ts --project=chromium --workers=1
# Lighthouse on production (target >= 95 performance / 100 accessibility):
# npx --yes lighthouse@12.6.0 https://shatter-router.vercel.app/ --only-categories=performance,accessibility --chrome-flags="--headless=new"
```

## Read first

- `SHATTER_ROUTER_MASTER_PROMPT.md` (rules, A.5 ritual, B.3/B.4), `context/PLAN-PRODUCTION.md` sections 5 and 9
- `context/DECISIONS.md` ADR-042, ADR-050, ADR-055–060
- `apps/docs/app/` (pages), `apps/docs/lib/effects.ts`, `apps/docs/app/playground/config.ts`
- `e2e/docs/site.spec.ts`, `e2e/docs/lab.spec.ts`
