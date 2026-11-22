# Hand-off

- **Last updated:** 2026-11-22 (session 5: M16 merged and tagged `m16-motions`; M17 started)
- **Session:** 5
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Live docs site:** https://shatter-router.vercel.app (Vercel project `shatter-router`, ADR-045; pushes to `main` deploy production, branches get previews)

## Where we are

- **Current milestone:** 17 — Interaction, cursor, sound (`context/PLAN-PRODUCTION.md` 3.5, 3.8)
- **Current branch:** `milestone/17-interaction` (from `main` at `3382b96`)
- **Latest tag:** `m16-motions` (on `3382b96`)

## Done so far

- Milestones 0–16 and 19 merged and tagged. M16: PRs #19–#21 (motions ADR-054/055, long-task budget ADR-056, materials ADR-057, last-visible completion ADR-058, easing ADR-059).
- M17 (ADR-060), committed on this branch: interaction and sound chunks, gestures remembered by the core and merged by the runtime (`intensity` scales the impulse, a tear `path` reaches the `impact` seeds, piece distances and the crack shader), sound loaded after the first gesture, `setSound()`. 576 unit tests. Not yet: e2e, the docs site (cursor kit, sound toggle, hero charge), docs pages.
- `fix/playground-panel-tasks` (PR #22): the playground's Tweakpane panel built in steps (Lighthouse TBT), the WebKit prefetch race in `lab.spec.ts`, overlay diagnostics; merge it into this branch after it merges.

## Next steps

1. Merge PR #22 (green CI), then `git merge origin/main` into this branch.
2. E2E (cursor follows and is not captured, hold charges, drag tears with a seam at rest, keyboard and reduced-motion paths, no long tasks), docs site: cursor kit, sound toggle (remembered), hero hold-to-charge; docs pages.
3. Full ritual: PR, three-engine CI, merge, tag `m17-interaction`; production Lighthouse. Then M20, M18, M21.

## Deferred (tracked, not forgotten)

- A cheaper capture of the incoming page (it is one 70–100 ms task on a warm machine, ADR-056).
- Engine core budget: 13.36 of 15 kB after materials; M18 (regions) adds engine code, so measure early and move data (e.g. the material table) to a lazy chunk if needed.

- Patterns `dom`, `text`, `mask`, `pixels` (ADR-053); motions `magnet` (M17), `peel`, `dust` (with `pixels`) (ADR-055).
- npm publish: at 1.0 (M21), with the user's npm login.

## Open problems / blockers

- Local Firefox and Playwright's full Chromium cannot launch on this machine (LEARNINGS); CI runs Firefox headed under xvfb (ADR-015). For headed or real-GPU runs, use installed Chrome 157 (`channel: 'chrome'`), which may pick the Intel iGPU unless forced.
- Windows WebKit crashes on a View Transition right after a CSP-blocked image: that test is `fixme` on win32 only.
- The Claude desktop browser pane throttles frames: use headless Playwright for visual checks and numbers.
- Local e2e: `--workers=2`; stop stale servers on ports 4173–4176 first. Don't measure captures while the e2e suite is running.
- `pnpm` is not on the PATH of PowerShell terminal tabs; use `npx` there.

## Questions waiting on the user

- None.

## Working tree

- Clean, everything pushed after the commit that carries this file. `.env.local` (Vercel OIDC token) and `.vercel/` exist locally and are git-ignored.

## Resume commands (PowerShell)

```powershell
cd "D:\Shatter Router"
git fetch --all --tags
git status
git switch milestone/17-interaction
pnpm install
pnpm build
pnpm build:examples
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e --project=chromium --project=webkit --workers=2   # Firefox cannot launch on this machine
pnpm size
# real-GPU budgets (installed Chrome, headed, discrete GPU forced in the spec):
# $env:SHATTER_PERF=1; npx playwright test e2e/vanilla/performance.spec.ts --project=chromium --workers=1
# frozen frames of every motion (contact sheets in coverage/m16/):
# node coverage/m16/motion-shots.mjs coverage/m16
```

## Read first

- `context/DECISIONS.md` ADR-047, ADR-048, ADR-055–059; `context/PLAN-PRODUCTION.md` 3.3–3.5
- `packages/shatter-router/src/core/effect.ts` (the interface), `src/engine/effects/reverse.ts`, `src/engine/plugins.ts`
- `e2e/vanilla/motions.spec.ts`, `e2e/vanilla/performance.spec.ts`
