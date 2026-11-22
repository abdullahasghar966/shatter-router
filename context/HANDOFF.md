# Hand-off

- **Last updated:** 2026-11-22 (session 5: M16 part 2 motions committed; long-task budget refined, ADR-056)
- **Session:** 5
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Live docs site:** https://shatter-router.vercel.app (Vercel project `shatter-router`, ADR-045; pushes to `main` deploy production, branches get previews)

## Where we are

- **Current milestone:** 16 — Motions and materials, part 2 (`context/PLAN-PRODUCTION.md` sections 3.3–3.4)
- **Current branch:** `milestone/16-motions-2` (from `main` at `91b83d4`)
- **Latest tag:** `m15-patterns` (on `fad5e63`). M16 is tagged `m16-motions` only when all its parts are merged.

## Done so far

- Milestones 0–15 and 19 merged and tagged; M16 part 1 merged (PR #19, `91b83d4`).
- **M16 part 2 (ADR-055), on this branch:** 11 motions in `packages/shatter-router/src/engine/effects/` (crumble, rain, vortex, wind, blinds, domino, slide, fold, melt, ripple, glitch), each a lazy chunk with a 2 kB budget; reverse wrapper fixed (keeps pattern/stagger, reads `uIncoming`, fragment at reversed time); `reach()` helper; vanilla example `?motion=` and the families on `/effects` (h1 now "Sixteen ways to break."); `test/motions.test.ts`; `e2e/vanilla/motions.spec.ts`; performance suite covers all 16 effects and forces the discrete GPU.
- Checks green locally: build, typecheck, lint, format, 537 unit tests, size, e2e motions 60/60, effects/patterns/history 80/80 (Chromium + WebKit), draw calls 1/frame and 0 B allocations for all 16, every new motion 129–144 fps on the RTX 4050.

## In progress right now

- PR #20 open; the push run's Chromium allocation failure is fixed by ADR-058 (falling effects remember their last-visible time). Uncommitted in the working tree: M16 part 3 materials (ADR-057) in progress, to be committed on a new branch from `main` after PR #20 merges (engine `materials.ts`, `core/material.ts`, shader `materialLight`, runtime `setMaterial`, side faces at rest not drawn, docs switcher, `test/materials.test.ts`, materials e2e).
- Nothing else half-done. The `flip`/`assemble` long-task question is settled (ADR-056: they lie inside the incoming capture; no regression, measured by an interleaved A/B against `m15-patterns`).

## Next steps

1. Full local e2e done (413 passed, 26 skipped, the known load-sensitive Next test passed 5/5 alone); PR "Milestone 16 part 2: motion families", three-engine CI green, merge with `--merge` (no tag yet).
2. **ADR-057, materials** (plan 3.4), new branch from `main`: glass (today), ice, mirror, obsidian, paper, metal, holo as shading parameters (tint, rim, glint, chromatic, edge style) passed per transition (composition `material`, today only `'glass'` in `plugins.ts` `MATERIALS` and `engine.setShading`), all lighting exactly 0 at rest (ADR-038). Then the docs site's material switcher (ADR-050) sets the transition material too.
3. Playground: motion select with the new motions, material select; docs tables and gallery entries per motion (`apps/docs/lib/effects.ts`, `apps/docs/app/playground/config.ts`); production Lighthouse 12.6.0 mobile (≥ 95 / 100); tag `m16-motions`. Then M17, M20, M18, M21 (plan section 9).

## Deferred (tracked, not forgotten)

- A cheaper capture of the incoming page (it is one 70–100 ms task on a warm machine, ADR-056).

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
git switch milestone/16-motions-2
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

- `context/DECISIONS.md` ADR-047, ADR-048, ADR-054, ADR-055; `context/PLAN-PRODUCTION.md` 3.3–3.4
- `packages/shatter-router/src/core/effect.ts` (the interface), `src/engine/effects/reverse.ts`, `src/engine/plugins.ts`
- `e2e/vanilla/motions.spec.ts`, `e2e/vanilla/performance.spec.ts`
