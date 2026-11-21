# Hand-off

- **Last updated:** 2026-11-20 (session 4 end: M16 part 1 merged; part 2 next)
- **Session:** 4
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Live docs site:** https://shatter-router.vercel.app (Vercel project `shatter-router`, ADR-045; pushes to `main` deploy production, branches get previews)

## Where we are

- **Current milestone:** 16 — Motions and materials, part 2 (`context/PLAN-PRODUCTION.md` sections 3.3–3.4)
- **Current branch:** `milestone/16-motions-2` (from `main` at `91b83d4`)
- **Latest tag:** `m15-patterns` (on `fad5e63`). M16 is tagged `m16-motions` only when all its parts are merged.

## Done so far

- Milestones 0–15 and 19 merged and tagged; M16 part 1 merged ([PR #19](https://github.com/abdullahasghar966/shatter-router/pull/19), `91b83d4`): `shatter` falls, `explode` blasts (ADR-054), `crackDuration`, web patterns aim at the requested count, `crackAt` allocation-free. Live: https://shatter-router.vercel.app.

## Next steps (M16 parts 2–3)

1. **ADR-055, motion families** (plan 3.3), each motion a lazy chunk in `src/engine/effects/` registered in `plugins.ts` `MOTIONS`, with a size budget (2 kB) in `package.json`:
   - gravity: `crumble` (bottom-up collapse), `rain` (columns drop; pairs with `strips`);
   - force: `vortex` (spiral around the impact), `wind` (sweep with turbulence);
   - order: `blinds` (strips rotate like shutters; pairs with `strips`), `domino` (cascade by order), `slide` (tiles slide out by stagger), `fold`;
   - matter: `melt` (vertical drip), `ripple` (promote the docs' `ripple-out`), `glitch` (row offsets and RGB split).
   Rules for each: the pose is exactly at rest at t = 0 (and every fragment term is 0); `isComplete` allocation-free; the shard data layout is 8 floats; delays from `ctx.order` so every stagger works; the time reverse ends on the page (ADR-047 wrapper); unit tests (attributes, t = 0 guards); e2e (plays and lands; first-frame seam; reverse last frame) — follow `e2e/vanilla/patterns.spec.ts` and `test/distinct.test.ts`.
2. **ADR-056, materials** (plan 3.4): glass (today), ice, mirror, obsidian, paper, metal, holo as shading parameters (tint, rim, glint, chromatic, edge style) passed per transition (composition `material`), all lighting exactly 0 at rest (ADR-038). Then the site's material switcher (ADR-050) sets the transition material too.
3. Stagger/easing controls in the playground (motion and material selects), docs tables, gallery entries per motion; production Lighthouse check; tag `m16-motions`.

## Deferred patterns (ADR-053)

- `dom`, `text` (need layout boxes in the pattern input), `mask` (image input), `pixels` (with the `dust` motion, beyond 400 pieces).

## Deferred (tracked, not forgotten)

- npm publish: at 1.0 (M21), with the user's npm login.
## Open problems / blockers

- Local Firefox and Playwright's full Chromium cannot launch on this machine (side-by-side error, LEARNINGS); CI runs Firefox headed under xvfb (ADR-015). For headed or real-GPU runs, use installed Chrome 157 (`channel: 'chrome'`).
- Windows WebKit crashes on a View Transition right after a CSP-blocked image: that test is `fixme` on win32 only.
- The Claude desktop browser pane throttles frames: use Playwright for visual checks and numbers.
- Local e2e: `--workers=2`. Don't measure captures while the e2e suite is running (it doubled them).
- `pnpm` is not on the PATH of PowerShell terminal tabs; use `npx` there.

## Questions waiting on the user

- None (the plan's decisions are recorded in its section 9).

## Working tree

- Clean, everything pushed after the commit that carries this file. `.env.local` (Vercel OIDC token) and `.vercel/` exist locally and are git-ignored.

## Resume commands (PowerShell)

```powershell
cd "D:\Shatter Router"
git fetch --all --tags
git status
git switch milestone/13-navigation-memory
pnpm install
pnpm build
pnpm build:examples
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e --project=chromium --project=webkit --workers=2   # Firefox cannot launch on this machine
pnpm size
# real-GPU budgets (installed Chrome, headed):
# $env:SHATTER_PERF=1; npx playwright test e2e/vanilla/performance.spec.ts e2e/docs/landing.spec.ts --project=chromium --workers=1
# deploy the docs site (from the repo root):
# npx --yes vercel@62.1.0 deploy --prod --yes
# a fresh clone needs a repo-local identity (ADR-002):
# git config user.name "Abdullah Asghar"; git config user.email "203540047+abdullahasghar966@users.noreply.github.com"
```

## Read first

- `SHATTER_ROUTER_MASTER_PROMPT.md` sections 12, 15 and A.5
- `context/PROGRESS.md` (Definition of done table, Release readiness), `context/DECISIONS.md` ADR-042..045
- `README.md`, `CONTRIBUTING.md`, `.vercelignore`
