# Hand-off

- **Last updated:** 2026-11-15 (session 1)
- **Session:** 1
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 4 — `shatter` effect, state machine, fallbacks, accessibility (code complete, local checks green, PR being opened)
- **Current branch:** `milestone/04-shatter-effect`
- **Last commit:** see `git log -1` (this file is committed with the code it describes)
- **Latest tag:** `m03-fracture-crack` (on `5523bfc`)

## Done in this milestone

- Public effect interface `src/core/effect.ts` (ADR-021) and the `shatter` effect `src/engine/effects/shatter.ts` (closed-form motion in GLSL, early completion when all shards are off-screen).
- Engine: per-effect programs, RGBA32F shard-data texture, allocation-free `FrameLoop` with a watchdog timer, blended motion over the live page, `setMotionTime` debug freeze.
- Core split (ADR-020): `src/core/shatter.ts` facade (options, events, effect registry, intent listeners) + lazy `src/runtime/index.ts` (typed FSM `src/core/machine.ts`, interruption rules ADR-022, waiting phase `ready.ts`, fallback chain `crossfade.ts`, focus/announce `a11y.ts`, scroll lock, pre-capture `precapture.ts`).
- Capture: substitutes for iframe/video/object/embed/`data-shatter-ignore`, CORS image rule (ADR-023); pre-capture budget rule (ADR-024).
- Example: `/lab` page (hard content), `csp.html` (strict CSP), back/forward with scroll restoration, `?duration=`/`?shards=`/`?seed=`/`?budget=`.
- Tests: 218 unit; e2e effect, interruptions, fallbacks, history, lab, memory (100 transitions: +119 kB heap, 0 textures).

## In progress

- Milestone end ritual (A.5): PR `Milestone 04: shatter effect, state machine, fallbacks`, three-engine CI, merge, tag `m04-shatter-effect`.

## Next 3 steps

1. Open the PR and watch CI. New risks on Linux CI: the strict-CSP WebKit test (marked `fixme` only on Windows; if Linux WebKit also crashes, mark it on Linux too and record it), Firefox (headed/xvfb) on the motion and lab tests, the history test under load.
2. Merge with `gh pr merge --merge`, tag `m04-shatter-effect`, record PR/merge/tag in `PROGRESS.md` as the first commit of `milestone/05-react-router`.
3. Milestone 5: `shatter-router/react` (`ShatterProvider`, `ShatterLink`, `useShatter`, `useShatterNavigate`) and `shatter-router/react-router` (`ShatterRouteSignal`, POP handling via the Navigation API `navigate` event, data-mode `useNavigation` idle), React Router example app under `examples/react-router`, e2e. Read React Router's installed types first (rule 3). Add the subpath exports, tsup entries and size-limit checks (ADR-004).

## Deferred (tracked, not forgotten)

- `backForward: 'reverse'` → Milestone 7 with `assemble` (ADR-025).
- Debug panel (section 10) → Milestone 10 (ADR-025); all data already on the debug hook.
- `physics: 'rapier'` → Milestone 8. `glassTint`, `chromatic`, lighting fade-in → Milestone 9.
- README: document `scrollbar-gutter: stable`, CSP directives → Milestone 12.

## Open problems / blockers

- Local Firefox cannot launch (LEARNINGS, Environment); CI runs Firefox headed under xvfb.
- Playwright WebKit on Windows crashes on a View Transition right after a CSP-blocked image (strict-CSP test `fixme` there).
- Under heavy parallel load (Chromium + WebKit together locally) the history test once timed out; passes alone and with WebKit only.
- The Claude desktop browser pane does not paint when the app window is behind others: use headless Playwright for visual checks.

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

- `SHATTER_ROUTER_MASTER_PROMPT.md` sections 6–7 for Milestone 5 (the spec, never edit)
- `context/PROGRESS.md`, `context/DECISIONS.md` (ADR-020 to ADR-025 for this milestone), `context/LEARNINGS.md`
- `packages/shatter-router/src/core/shatter.ts`, `src/runtime/index.ts`, `src/core/types.ts`, `src/core/effect.ts`
- `examples/vanilla/src/main.ts` (how a router integrates: commit, origin, direction, scroll)
