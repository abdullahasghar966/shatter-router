# Hand-off

- **Last updated:** 2026-11-15 00:10 PKT (UTC+5)
- **Session:** 1
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 3 — Fracture + crack propagation (code complete, local checks green, PR being opened)
- **Current branch:** `milestone/03-fracture-crack`
- **Last commit:** see `git log -1` (this file is committed with the code it describes)
- **Latest tag:** `m02-renderer-seam` (on `ca25842`)

## Done in this milestone

- `src/engine/fracture.ts`: impact-biased blue-noise seeds (mulberry32), d3-delaunay Voronoi via `renderCell`, centroid fans, back faces, side quads; 12-float interleaved vertices; shard count `'auto'` by device tier (40/90/160) or a number clamped to [12, 400]. 23 unit tests (area within 0.01 %, UVs, determinism, slivers, null cells).
- `src/engine/crack.ts` + `SHARD_FRAGMENT` in `src/engine/shaders.ts`: crack front 140 ms + 40 ms hold, 1.3 px lines from `edgeDistance`, refraction band, impact flash, debug wireframe + impact dot. 7 unit tests.
- `Engine.fracture()`, `crack()`, `setCrack()`, `measureFracture()`, `resolveShardCount()`; pipeline in `src/core/shatter.ts`: cover → fracture → commit → 2 frames → crack → reveal (ADR-018). New options `shards`, `seed`, `thickness`; `TransitionRequest.origin`; event `fractured`; pause points `fractured`, `cracked`; hook `wireframe`, `lastFracture`, `setCrack`, `measureFracture`.
- Capture fix: single-line text stays single-line (`keepSingleLines`, ADR-019). Seam test gained a worst-block structural check (limit 8 %).
- Measurements recorded in `PROGRESS.md` (fracture 0.6 ms at 160 shards in Chromium; no Worker, ADR-017).

## In progress

- Milestone end ritual (A.5): PR `Milestone 03: Fracture + crack propagation`, three-engine CI, merge, tag `m03-fracture-crack`.

## Next 3 steps

1. Open the PR, `gh pr checks 3 --watch`. New in CI: the worst-block check and the fractured/cracked tests on Linux Chromium, Firefox (xvfb) and WebKit. If a worst-block value fails on Linux, look at the `[seam]` log lines and the diff image before touching the 8 % limit.
2. Merge with `gh pr merge --merge`, tag `m03-fracture-crack`, record PR/merge/tag in `PROGRESS.md` as the first commit of `milestone/04-shatter-effect`.
3. Milestone 4: the `ShatterEffect` interface and the `shatter` effect (procedural vertex-shader motion, section 5.3), the full state machine (section 4) with interruption rules and unit tests at every state, fallbacks (View Transition crossfade, instant), reduced motion, focus management + `aria-live` title announcement, scroll lock, pre-capture on pointerdown, hard-to-capture content (iframes, video, canvas, CORS images, `data-shatter-ignore`).

## Open problems / blockers

- Local Firefox cannot launch (LEARNINGS, Environment); CI runs Firefox headed under xvfb.
- ~80 ms between capture and overlay in headless Chromium (texture upload, software GL); look at it in Milestone 10.
- The Claude desktop browser pane throttles frames: use it only for visual checks.

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

- `SHATTER_ROUTER_MASTER_PROMPT.md` sections 4–6, 9 for Milestone 4 (the spec, never edit)
- `context/PROGRESS.md`, `context/DECISIONS.md` (ADR-006 to ADR-019), `context/LEARNINGS.md`
- `packages/shatter-router/src/core/shatter.ts`, `src/engine/index.ts`, `src/engine/fracture.ts`, `src/engine/shaders.ts`, `src/capture/clone-session.ts`
- `e2e/seam.ts`, `e2e/vanilla/seam.spec.ts`
