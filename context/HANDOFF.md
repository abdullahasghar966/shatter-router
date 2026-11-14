# Hand-off

- **Last updated:** 2026-11-14 23:30 PKT (UTC+5)
- **Session:** 1
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 3 — Fracture + crack propagation
- **Current branch:** `milestone/03-fracture-crack` (from `main` at `ca25842`)
- **Last commit:** see `git log -1` (this file is committed with the code it describes)
- **Latest tag:** `m02-renderer-seam` (on `ca25842`)

## Done so far

- Milestones 0–2 merged and tagged (PR #1, PR #2). First-frame seam passes on Chromium, Firefox and WebKit in CI (numbers in `PROGRESS.md`).
- `spike/linux-layout-grid` stays on GitHub as a record (never merge it).

## In progress

- Milestone 3 has just started; no code yet.

## Next 3 steps

1. `pnpm add d3-delaunay` (latest) in `packages/shatter-router`, read its `.d.ts` / source for `Delaunay.from`, `voronoi([x0,y0,x1,y1])`, `cellPolygon(i)` (closed ring, may be null) and record facts in `LEARNINGS.md`. Write `src/engine/fracture.ts`: impact-biased polar seeds `r = maxR * u^k` with blue-noise minimum distance and mulberry32 (`src/core/random.ts`), Voronoi cells clipped to the viewport, centroid fan triangulation, extruded side faces (`thickness`), per-vertex `position, uv, shardId, centroid, edgeDistance, normal`, one interleaved buffer. Shard count `'auto' | number`, tiers 40/90/160, clamp [12, 400].
2. Unit tests (section 11): area sums to `w × h` within 0.01 %, ≥ 3 vertices per cell, UVs in [0,1], determinism with a seed, sliver rejection, null-cell handling. Measure fracture time at 160 shards (decide on a Worker only if > 4 ms) and record it.
3. Crack shader (section 5.2) in the engine: fractured mesh drawn with `uCrackRadius` growing over 140 ms + 40 ms hold, bright 1–1.5 px lines from `edgeDistance`, refraction offset, impact flash; at radius 0 the frame must equal the intact page (keep the first-frame seam green). Debug wireframe + impact point toggle. Then the milestone ritual (A.5).

## Open problems / blockers

- Local Firefox cannot launch (LEARNINGS, Environment); CI runs Firefox headed under xvfb.
- Not built yet, by design (Milestone 4): state machine, interruption, pre-capture, scroll lock, focus, reduced motion, hard-to-capture content, `data-shatter-ignore`.

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

- `SHATTER_ROUTER_MASTER_PROMPT.md` sections 5.1–5.2 (the spec, never edit)
- `context/PROGRESS.md`, `context/DECISIONS.md` (ADR-006 to ADR-016), `context/LEARNINGS.md`
- `packages/shatter-router/src/engine/index.ts`, `src/engine/shaders.ts`, `src/engine/camera.ts`, `src/core/random.ts`
