# Hand-off

- **Last updated:** 2026-11-20 (session 4, M15 merged and tagged; M16 starting)
- **Session:** 4
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Live docs site:** https://shatter-router.vercel.app (Vercel project `shatter-router`, ADR-045; pushes to `main` deploy production, branches get previews)

## Where we are

- **Current milestone:** 16 — Motions and materials (`context/PLAN-PRODUCTION.md` sections 3.3–3.4; order M16 → M17 → M20 → M18 → M21)
- **Current branch:** `milestone/16-motions` (from `main` at `fad5e63`)
- **Latest tag:** `m15-patterns` (on `fad5e63`)

## Done so far

- Milestones 0–15 and 19 merged and tagged (`PROGRESS.md`; ADR-001..053). Live: https://shatter-router.vercel.app (Material lab redesign; eight fracture patterns).

## Next steps (M16: motions and materials)

1. **Shatter vs explode, unmistakable** (plan 3.3, the review's first complaint): `shatter` = `impact` cracks + `fall` (a long, visible crack phase, then the pane drops with little outward speed); `explode` = no crack, `radial` pattern, `blast` (white flash on impact, a shockwave ring bending the page outward, pieces flung at the camera with motion stretch, camera shake, then gravity). Side-by-side review of frozen frames.
2. New motions in families (gravity: fall, crumble, rain; force: blast, vortex, wind, magnet; order: blinds, domino, slide, peel, fold; matter: dust, melt, ripple, glitch), each a lazy chunk with budget, true reverse (ADR-047) and seams; 0 B/frame allocations; 60 fps at 160 pieces on the GPU.
3. Materials (glass, ice, mirror, obsidian, paper, metal, holo): shading parameters per material, zero lighting at rest (ADR-038); the site's material switcher then sets the transition's material too (ADR-050 left this to M16).
4. Stagger/easing controls; docs and playground; ritual, tag `m16-motions`.

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
