# Hand-off

- **Last updated:** 2026-11-15 00:40 PKT (UTC+5)
- **Session:** 1
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 4 — `shatter` effect (procedural), state machine, fallbacks, accessibility
- **Current branch:** `milestone/04-shatter-effect` (from `main` at `5523bfc`)
- **Last commit:** see `git log -1` (this file is committed with the code it describes)
- **Latest tag:** `m03-fracture-crack` (on `5523bfc`)

## Done in Milestone 3 (merged: PR #3, `5523bfc`, tag `m03-fracture-crack`)

- `src/engine/fracture.ts`: impact-biased blue-noise seeds (mulberry32), d3-delaunay Voronoi via `renderCell`, centroid fans, back faces, side quads; 12-float interleaved vertices; shard count `'auto'` by device tier (40/90/160) or a number clamped to [12, 400]. 23 unit tests (area within 0.01 %, UVs, determinism, slivers, null cells).
- `src/engine/crack.ts` + `SHARD_FRAGMENT` in `src/engine/shaders.ts`: crack front 140 ms + 40 ms hold, 1.3 px lines from `edgeDistance`, refraction band, impact flash, debug wireframe + impact dot. 7 unit tests.
- `Engine.fracture()`, `crack()`, `setCrack()`, `measureFracture()`, `resolveShardCount()`; pipeline in `src/core/shatter.ts`: cover → fracture → commit → 2 frames → crack → reveal (ADR-018). New options `shards`, `seed`, `thickness`; `TransitionRequest.origin`; event `fractured`; pause points `fractured`, `cracked`; hook `wireframe`, `lastFracture`, `setCrack`, `measureFracture`.
- Capture fix: single-line text stays single-line (`keepSingleLines`, ADR-019). Seam test gained a worst-block structural check (limit 8 %).
- Measurements recorded in `PROGRESS.md` (fracture 0.6 ms at 160 shards in Chromium; no Worker, ADR-017).

## In progress

- Milestone 4 has just started; no code yet.

## Next 3 steps

1. **Effect + motion:** define the public `ShatterEffect` interface (section 6: `name`, `needsIncomingSnapshot`, `crack`, `duration`, `seedPoints`, `shardAttributes`, `vertexChunk`, `fragmentChunk`, `isComplete`) and a documented GLSL hook in `SHARD_VERTEX`. Write the `shatter` effect against only that interface: per-shard attributes (velocity, axis, angular velocity, delay) in a second vertex buffer or texture, closed-form motion in the vertex shader (section 5.3, z clamped below `camera.maxZ`), alpha fade, completion when every shard is off-screen or transparent. Draw full mesh (front, back, sides) with depth test during motion; still one draw call.
2. **State machine:** replace the linear `run()` in `src/core/shatter.ts` with an explicit typed FSM `idle → capturing → covering → committing → waiting → animating → revealing → idle` plus `fallback`. Waiting phase per section 4.6 (commit promise, `document.fonts.ready`, `img.decode()` for in-viewport images, two rAFs, scroll handling, `readyTimeout` 1500 ms). Interruption rules (section 4) and unit tests for every state × interruption, idempotent `destroy()`. Escape/click skips, `visibilitychange` finishes instantly.
3. **Robustness + a11y:** fallback chain (View Transition crossfade ≤ 200 ms → instant), `reducedMotion` option, focus move (`[data-shatter-focus]` → `main h1` → `main`) + `aria-live` title announcement, layout-neutral scroll lock (+ `scrollLock` option), `precapture` on pointerdown/hover with a MutationObserver dirty flag, `data-shatter-ignore`, iframe/video/canvas/CORS-image handling. E2E for each; then the milestone ritual.

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
