# Hand-off

- **Last updated:** 2026-11-22 (session 5: M16 part 2 merged; part 3 materials and easing on its branch)
- **Session:** 5
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Live docs site:** https://shatter-router.vercel.app (Vercel project `shatter-router`, ADR-045; pushes to `main` deploy production, branches get previews)

## Where we are

- **Current milestone:** 16 — Motions and materials, part 3 (`context/PLAN-PRODUCTION.md` 3.3–3.4)
- **Current branch:** `milestone/16-materials` (from `main` at `44a7544`, the PR #20 merge)
- **Latest tag:** `m15-patterns`. M16 is tagged `m16-motions` once this part merges.

## Done so far

- Milestones 0–15 and 19 merged and tagged. M16 part 1 (PR #19, `91b83d4`) and part 2 (PR #20, `44a7544`: 11 motions ADR-055, long-task budget ADR-056, last-visible completion ADR-058) merged; CI green on all three engines.
- **Part 3 (this branch):** materials (ADR-057: glass, ice, mirror, obsidian, paper, metal, holo; `material` option, per-call, per-effect, `setMaterial()`; side faces of resting pieces not drawn), easing (ADR-059), docs site: switcher sets the transition material, playground motion/material/easing selects, gallery pages for the 11 motions, API reference and README. Local: 564 unit tests, materials e2e, docs e2e 48 + playground, GPU 136–144 fps per material.

## Next steps

1. Full local e2e done: 442 passed, 26 skipped, 0 failed (Chromium + WebKit).
2. PR "Milestone 16 part 3: materials and easing", three-engine CI green, merge with `--merge`, tag `m16-motions` on `main`, record PR/merge/tag in PROGRESS (first commit of the next branch).
3. Production: check https://shatter-router.vercel.app after the deploy (new gallery pages, switcher material, playground), Lighthouse 12.6.0 mobile on `/`, `/effects`, an effect page, `/playground`, `/docs/api` (≥ 95 / 100); then M17 (interaction, cursor, sound; plan 3.5, 3.8), then M20, M18, M21.

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
git switch milestone/16-materials
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
