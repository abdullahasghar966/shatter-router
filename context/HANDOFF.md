# Hand-off

- **Last updated:** 2026-11-20 (session 3, all 13 milestones merged and tagged; the project is complete)
- **Session:** 3
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Live docs site:** https://shatter-router.vercel.app (Vercel project `shatter-router`, ADR-045)

## Where we are

- **Current milestone:** none. M12 Release readiness merged (PR #12, `9e2777a`, tag `m12-release`); this record goes in through `docs/context-12`.
- **Current branch:** `main` once `docs/context-12` is merged.
- **Latest tag:** `m12-release` (on `9e2777a`)

## Done so far

- Milestones 0–11 merged and tagged (see `PROGRESS.md`; ADR-001..045). M11: the docs site `apps/docs` (PR #11, `ecb969c`), the priming capture (ADR-043) and the Firefox history fix for modern-screenshot's sandbox frame (ADR-044).
- M12 on its branch: README (demo GIF `media/shatter-demo.gif` from `scripts/record-demo.mjs`, quick start, features, measured numbers, browser support, roadmap), package README, `CHANGELOG.md` and version 0.1.0 (Changesets), CONTRIBUTING, issue forms, `npm pack --dry-run` (49 files, 187.4 kB), final full run green, Definition of done checked in PROGRESS, docs site deployed to Vercel (Lighthouse live 99–100 / 100).
- What works: everything in the master prompt; see the Definition of done table in `PROGRESS.md`.

## Next steps

1. ~~Ritual for M12~~ **done**: PR #12 merged (`9e2777a`), tag `m12-release`, recorded in PROGRESS; every Definition-of-done item is met.
2. **Deploys are automatic** (2026-11-20, at the user's request): the GitHub repository is connected to the Vercel project `shatter-router`. A push to `main` (every merged PR) deploys https://shatter-router.vercel.app; other branches and PRs get preview deployments. A manual redeploy still works: `npx --yes vercel@62.1.0 deploy --prod --yes` from the repo root.
3. **For the user to decide (not done on purpose):** publish to npm (`pnpm release` runs `pnpm build && changeset publish`; needs the user's npm login).
4. After any change to the site: re-run Lighthouse and the landing capture (`e2e/docs/landing.spec.ts` with `SHATTER_PERF=1`) and update `apps/docs/lib/measurements.ts` and PROGRESS.

## Open problems / blockers

- Local Firefox and Playwright's full Chromium cannot launch on this machine (side-by-side error, LEARNINGS); CI runs Firefox headed under xvfb (ADR-015). For headed or real-GPU runs, use installed Chrome 157 (`channel: 'chrome'`).
- Windows WebKit crashes on a View Transition right after a CSP-blocked image: that test is `fixme` on win32 only.
- The Claude desktop browser pane throttles frames: use Playwright for visual checks and numbers.
- Local e2e: `--workers=2`. Don't measure captures while the e2e suite is running (it doubled them).
- `pnpm` is not on the PATH of PowerShell terminal tabs; use `npx` there.

## Questions waiting on the user

- Publish `shatter-router@0.1.0` to npm?

## Working tree

- Clean, everything pushed after the commit that carries this file. `.env.local` (Vercel OIDC token) and `.vercel/` exist locally and are git-ignored.

## Resume commands (PowerShell)

```powershell
cd "D:\Shatter Router"
git fetch --all --tags
git status
git switch main
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
