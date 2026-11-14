# Hand-off

- **Last updated:** 2026-11-14 15:15 PKT (UTC+5)
- **Session:** 1 (stopped early: the user's usage limit was reached)
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 2 — Renderer + seam (code complete locally, PR not opened yet)
- **Current branch:** `milestone/02-renderer-seam`
- **Last commit:** see `git log -1` (this file is committed with the code it describes)
- **Latest tag:** `m01-scaffold` (on `18f25c1`)

## Done in this milestone

- `src/engine/`: WebGL2 device (one context, loss tracking, texture counter), pixel-exact perspective camera, top-layer overlay (`popover="manual"` with fixed fallback), intact page quad.
- `src/capture/`: `DomCapturer` (modern-screenshot 4.7.0 behind the `Capturer` interface) and `CloneSession` (scroll via negative root margin, fixed/sticky repair, scrolled containers, page background, off-screen image skipping). See ADR-008, ADR-009, ADR-010.
- `src/core/shatter.ts`: `createShatter()` with capture → cover → commit → reveal, events, fallback to plain commit, idle warm-up, debug hook `window.__SHATTER_TEST__` (ADR-006).
- Lazy chunks `dist/engine.js` and `dist/capture.js` with size budgets (ADR-011): core 2.32 kB, engine 3.33 kB, capture 10.74 kB (gzip).
- Tests: 68 unit; e2e 10 per engine. First-frame seam: Chromium 0.06–0.22 %, WebKit 0.12–0.24 % (target ≤ 0.5 %). Verified in real Chrome (RTX 4050): three transitions, captures 60/42/31 ms, clean console.

## In progress

- Milestone end ritual (A.5) for Milestone 2.

## Next 3 steps

1. Check the push CI run on `milestone/02-renderer-seam` (`gh run list --branch milestone/02-renderer-seam`). **Firefox has never run this code** (it cannot launch locally): it only runs on the PR.
2. Open the PR `Milestone 02: Renderer + seam` into `main`. If Firefox fails the seam tests, read the `[seam] firefox …` lines in the job log and the uploaded `test-results` artifact; the first thing to try for a DPR-2-only failure is the `device` layout grid for Firefox (`layoutGridFor` in `src/capture/index.ts`, ADR-010).
3. When all checks are green: `gh pr merge --merge`, tag `m02-renderer-seam` on `main`, record PR/merge SHA/tag in `context/PROGRESS.md` as the first commit of `milestone/03-fracture-crack`, then start Milestone 3 (fracture geometry with d3-delaunay, crack shader, debug wireframe).

## Open problems / blockers

- Local Firefox cannot launch (LEARNINGS, Environment). CI is the only Firefox signal.
- Not built yet, by design (Milestone 4): interruption rules, pre-capture on pointerdown, scroll lock, focus management, reduced motion, View Transition fallback, hard-to-capture content (iframes, video, canvas, CORS images), `data-shatter-ignore`.
- Known capture gaps listed in ADR-008 (consequences).

## Questions waiting on the user

- None.

## Working tree

- Clean, everything pushed.

## Resume commands (PowerShell)

```powershell
cd "D:\Shatter Router"
git fetch --all --tags
git status
pnpm install
pnpm build
pnpm build:examples
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install   # once per machine
pnpm test:e2e --project=chromium --project=webkit   # Firefox cannot launch on this machine
pnpm size
# a fresh clone needs a repo-local identity (ADR-002):
# git config user.name "Abdullah Asghar"; git config user.email "203540047+abdullahasghar966@users.noreply.github.com"
```

## Read first

- `SHATTER_ROUTER_MASTER_PROMPT.md` (the spec, never edit)
- `context/PROGRESS.md`, `context/DECISIONS.md` (ADR-006 to ADR-013), `context/LEARNINGS.md`
- `packages/shatter-router/src/core/shatter.ts`, `src/engine/index.ts`, `src/capture/index.ts`, `src/capture/clone-session.ts`
- `e2e/seam.ts`, `e2e/vanilla/seam.spec.ts`, `e2e/fixtures.ts`
