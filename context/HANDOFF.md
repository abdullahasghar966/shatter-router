# Hand-off

- **Last updated:** 2026-11-15 (session 2, Milestone 6 merged, Milestone 7 branch created)
- **Session:** 2
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 7 — Remaining effects (branch created, no code yet)
- **Current branch:** `milestone/07-effects` (from `main` at `99f7e26`)
- **Last commit:** see `git log -1` (`docs(context): record milestone 6 merge and start milestone 7`)
- **Latest tag:** `m06-nextjs` (on `99f7e26`)

## Done so far

- Milestones 0–6 merged and tagged (see `PROGRESS.md`; ADR-001..035). Latest: M5 React + React Router (PR #5, `0d4d85f`, `m05-react-router`), M6 Next.js App Router (PR #6, `99f7e26`, `m06-nextjs`), all three engines green.
- What works: `shatter-router` (core), `shatter-router/react`, `shatter-router/react-router` (use `createShatterBrowserRouter` in data mode), `shatter-router/next` (`waitFor`, `data-shatter-pending`). Examples: `examples/vanilla` (4173), `examples/react-router` (4174), `examples/next` (4175, build needs `NEXT_TELEMETRY_DISABLED=1` locally). Back/forward shatter in all of them; the adapters take over scroll restoration for history moves (ADR-030, 031, 035).

## Next 3 steps (Milestone 7)

1. **Read the effect plumbing first:** `packages/shatter-router/src/core/effect.ts` (public `ShatterEffect`, `EffectContext`, `ShardAttributes`, GLSL hook docs), `src/engine/effects/` (the `shatter` effect written against it), `src/engine/index.ts` (`resolveEffect`, `prepareMotion`, `animate`), `src/runtime/index.ts` (pipeline; `needsIncomingSnapshot` is not wired yet: capture the new viewport under the overlay after the waiting phase, section 4.7). ADR-018, 021, 025.
2. **Implement `explode` and `implode`** (no incoming snapshot) as plugin objects against the public interface only, with unit tests like `test/effect-shatter.test.ts` and e2e in `e2e/vanilla/effect.spec.ts` (per-link `data-shatter-effect`). Then **`flip` and `assemble`**: incoming snapshot, second texture, back faces / fly-in, critically damped spring settle that never overshoots on the last frame, last-frame seam tests (live DOM after reveal vs overlay's last frame). Then `backForward: 'reverse' | 'same' | 'none'` (`shatter` reversed = `assemble`), documented mapping.
3. Plugin interface docs (GLSL hook points, uniforms, attributes) in the code docs now, README in M12. Then the ritual (A.5) and tag `m07-effects`.

## Deferred (tracked, not forgotten)

- `backForward: 'reverse'` → Milestone 7 with `assemble` (ADR-025).
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
