# Hand-off

- **Last updated:** 2026-11-20 (session 4, M13 implemented, e2e and ritual in progress)
- **Session:** 4
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Live docs site:** https://shatter-router.vercel.app (Vercel project `shatter-router`, ADR-045; pushes to `main` deploy production, branches get previews)

## Where we are

- **Current milestone:** 13 — Navigation memory (first of M13–M21 in `context/PLAN-PRODUCTION.md`, ADR-046)
- **Current branch:** `milestone/13-navigation-memory` (from `main` at `a7b980c`, with `plan/production-grade` merged in)
- **Latest tag:** `m12-release` (on `9e2777a`)

## Done so far

- Milestones 0–12 merged and tagged (`PROGRESS.md`; ADR-001..045). The master prompt's Definition of done is met (PROGRESS table). The docs site is live and deploys from `main` automatically.
- The user then asked for a production-grade library and site. `context/PLAN-PRODUCTION.md` holds the analysis and the plan, which the user approved (art direction A "Material lab", sound wherever it suits, text and button animations; the rest decided as recorded in its section 9 and ADR-046).

## Next steps (M13: navigation memory, plan 3.6)
**Status (session 4):** implementation done and committed (`8c7bd22`, `…adapters`, `8840a31`): memory + mirror planning + reverse wrapper with unit tests (361 passing), adapters pass `replace`, playground settings in the URL, the memory matches by pathname when a page rewrote its query, ADR-047, runtime budget 9 kB (8.68 kB). E2E written for vanilla, React Router, Next and the docs playground. **Left:** run those e2e locally (Chromium + WebKit), record measurements in PROGRESS, then the ritual (PR, three-engine CI, merge, tag `m13-navigation-memory`). The live site is unchanged until the merge.

1. **History memory in the runtime:** remember, per visited URL (pathname + search), the effect and impact point that brought you there, as a stack with a position (sessionStorage, capped). On a popstate transition, compare the arriving URL with the entries before and after the position to tell Back from Forward. Back plays the reverse of the effect that brought you to the page you are leaving, from the stored origin; Forward replays the effect. `backForward: 'mirror'` becomes the default; `'reverse' | 'same' | 'none'` stay. `TransitionRequest.replace` lets adapters replace the current entry.
2. **True reverse for every effect** without its own incoming snapshot (`shatter`, `explode`, `implode`, custom ones like `ripple-out`): an engine-side wrapper effect `<name>:reverse` with `layers: 2` and `needsIncomingSnapshot`. Layer 0 is the outgoing page at rest; layer 1 is the incoming page running the effect's `shardMotion` at `uDuration - uTime` (`uTime` is a writable global, ADR-038). The first frame is the outgoing page and the last frame is the incoming page at rest (both seams testable). `flip` keeps turning the other way, and `assemble`'s reverse stays `shatter`.
3. **Docs site:** the playground keeps its settings in the URL (read on mount, `history.replaceState` on change), so Back and shared links restore them.
4. Tests: unit (memory, direction detection, mirror mapping, reverse wrapper GLSL), e2e on vanilla, React Router and Next (Back plays the reverse of the forward effect, Forward replays it; first- and last-frame seams of the reverse). Then the ritual and tag `m13-navigation-memory`.

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
