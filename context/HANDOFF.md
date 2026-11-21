# Hand-off

- **Last updated:** 2026-11-20 (session 4, M19 implemented; PR, CI and production Lighthouse next)
- **Session:** 4
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Live docs site:** https://shatter-router.vercel.app (Vercel project `shatter-router`, ADR-045; pushes to `main` deploy production, branches get previews)

## Where we are

- **Current milestone:** 19 — Site redesign, art direction A "Material lab" (`context/PLAN-PRODUCTION.md` sections 4, 9; order M19 → M15 → M16 → M17 → M20 → M18 → M21)
- **Current branch:** `milestone/19-redesign` (from `main` at `ddbb660`)
- **Latest tag:** `m14-effect-architecture` (on `ddbb660`)

## Done so far

- Milestones 0–14 merged and tagged (`PROGRESS.md`; ADR-001..049). The docs site deploys from `main`.
- M14 (PR #16): effects as lazy plugins and compositions (ADR-048); Firefox first frame at fractional scroll positions fixed (ADR-049).

## Next steps (M19: site redesign)

**Status (session 4):** implemented and committed on `milestone/19-redesign`: the "Material lab" design system (ADR-050), capture speed-ups in the library (ADR-051 fonts and custom properties, ADR-052 below-the-fold pruning), Lighthouse fixes (contrast, reveal, header shift). **Left:** PR and three-engine CI, merge; then Lighthouse on production (`https://shatter-router.vercel.app`, Lighthouse 12.6.0 mobile, the pages in `apps/docs/lib/measurements.ts`): target ≥ 95 performance / 100 accessibility. If a page misses, fix forward before tagging `m19-redesign` (suspects: the docs pages' later first paint, from the larger stylesheet that Next ships twice). Update `LIGHTHOUSE` in `apps/docs/lib/measurements.ts` with the production numbers. Then M15 (patterns).

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
