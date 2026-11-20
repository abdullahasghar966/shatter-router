# Hand-off

- **Last updated:** 2026-11-20 (session 4, M14 implemented; ritual next)
- **Session:** 4
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Live docs site:** https://shatter-router.vercel.app (Vercel project `shatter-router`, ADR-045; pushes to `main` deploy production, branches get previews)

## Where we are

- **Current milestone:** 14 — Effect architecture (`context/PLAN-PRODUCTION.md`; order M14 → M19 → M15 → M16 → M17 → M20 → M18 → M21, ADR-046)
- **Current branch:** `milestone/14-effect-architecture` (from `main` at `6040c4d`)
- **Latest tag:** `m13-navigation-memory` (on `6040c4d`)

## Done so far

- Milestones 0–13 merged and tagged (`PROGRESS.md`; ADR-001..047). The docs site is live and deploys from `main` automatically.
- M13 (PR #15): Back plays the true reverse of the arriving effect from the same point, Forward replays it (`backForward: 'mirror'`, default); the playground keeps its settings in the URL (ADR-047).

## Next steps (M14: effect architecture)

**Status (session 4):** implemented per ADR-048 and committed: patterns and motions as lazy chunks (`src/engine/plugins.ts`, `patterns/impact.ts`, per-chunk budgets), async `engine.loadEffect`, prefetching, stagger order (`src/engine/stagger.ts`, `ctx.order`, GLSL `shard.order`), compositions (`src/core/compose.ts`, `src/engine/compose.ts`), adapters and docs updated, playground stagger control. Unit 386 passing; e2e full suite green on the plugin build plus the new composition tests. **Left:** final local checks, the ritual (PR, three-engine CI, merge, tag `m14-effect-architecture`), then M19 (site redesign) per the plan order.

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
