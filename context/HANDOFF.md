# Hand-off

- **Last updated:** 2026-11-15 (session 2, Milestone 7 merged, Milestone 8 branch created)
- **Session:** 2
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 8 — Rapier mode (branch created, no code yet)
- **Current branch:** `milestone/08-rapier` (from `main` at `d6054ae`)
- **Last commit:** see `git log -1` (`docs(context): record milestone 7 merge and start milestone 8`)
- **Latest tag:** `m07-effects` (on `d6054ae`)

## Done so far

- Milestones 0–7 merged and tagged (see `PROGRESS.md`; ADR-001..036). Latest: M7 Remaining effects (PR #7, `d6054ae`, `m07-effects`): `explode`, `implode`, `flip`, `assemble`, the incoming-page capture, `backForward`, all three engines green.
- What works: core + `shatter-router/react`, `/react-router` (`createShatterBrowserRouter` in data mode), `/next` (`waitFor`, `data-shatter-pending`); five effects with first- and last-frame seam tests; back/forward effects with scroll restoration. Examples: vanilla (4173, `/effects` page), react-router (4174), next (4175; `NEXT_TELEMETRY_DISABLED=1` locally).

## Next 3 steps (Milestone 8)

1. **Read the installed APIs first (rule 3):** `npm view @dimforge/rapier3d-compat version`; add it as a dev + optional peer dependency; read its `.d.ts` for `init()`, `World`, `RigidBodyDesc.dynamic()`, `ColliderDesc.convexHull()` (may return null), `ColliderDesc.cuboid()`, `world.step()`, `world.timestep`, body `translation()`/`rotation()`, `applyImpulse`/`setLinvel`/`setAngvel`, `free()`. Check the WASM loading under CSP (`'wasm-unsafe-eval'`, section 9). Record in LEARNINGS.
2. **Design (ADR):** `shatter-router/rapier` exports a physics plugin (e.g. `rapierPhysics()`), passed in options (`physics: 'rapier'` resolves it lazily with `import()`), so the core never imports rapier. Engine: a second motion path where per-shard transforms (mat4 = 4 RGBA32F texels per shard) come from a texture updated each frame, read with `texelFetch` in the vertex shader; still one draw call; procedural initial impulses (same formula as `shatter`); 100 px = 1 m; fixed 1/60 s step with accumulator; optional floor collider at the viewport bottom (`floor: true`); fade; free the world after `end`. Size budget for the rapier chunk (rapier itself is a peer).
3. Example toggle (`?physics=rapier`, `?floor`), unit tests (integrator/accumulator, transform packing), e2e (rapier transition completes, no console errors, strict CSP falls back), measurements (step time per frame at 160 shards). Then the ritual and tag `m08-rapier`.

## Deferred (tracked, not forgotten)

- Debug panel (section 10) → Milestone 10 (ADR-025).
- `physics: 'rapier'` → M8. `glassTint`, `chromatic`, lighting fade-in → M9. README items (`scrollbar-gutter: stable`, CSP, browser support incl. ADR-016, popstate note from ADR-026) → M12.

## Open problems / blockers

- Local Firefox cannot launch on this machine (LEARNINGS, Environment); CI runs Firefox headed under xvfb (ADR-015).
- Windows WebKit crashes on a View Transition right after a CSP-blocked image: that test is `fixme` on win32 only.
- The Claude desktop browser pane throttles frames: use headless Playwright for visual checks and numbers.
- Local e2e: `--workers=2` (software GL is slow with more).

## Questions waiting on the user

- None.

## Working tree

- Clean, everything pushed after the commit that carries this file.

## Resume commands (PowerShell)

```powershell
cd "D:\Shatter Router"
git fetch --all --tags
git status
git switch milestone/05-react-router
pnpm install
pnpm build
pnpm build:examples
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e --project=chromium --project=webkit --workers=2   # Firefox cannot launch on this machine
pnpm size
# a fresh clone needs a repo-local identity (ADR-002):
# git config user.name "Abdullah Asghar"; git config user.email "203540047+abdullahasghar966@users.noreply.github.com"
```

## Read first

- `SHATTER_ROUTER_MASTER_PROMPT.md` sections 6–7, 11 and A.5
- `context/DECISIONS.md` ADR-026, ADR-027 (this milestone), ADR-020, ADR-022
- `packages/shatter-router/src/react-router/components.tsx`, `bridge.ts`; `src/react/components.tsx`, `shared.ts`
- `examples/vanilla/` (pages, styles, query params to mirror), `playwright.config.ts`, `e2e/fixtures.ts`, `e2e/hook.ts`, `e2e/seam.ts`, `e2e/vanilla/*.spec.ts`
