# Hand-off

- **Last updated:** 2026-11-15 (session 2, Milestone 5 merged, Milestone 6 branch created)
- **Session:** 2
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 6 — Next.js App Router adapter (adapter, example and e2e done; PR next)
- **Current branch:** `milestone/06-nextjs` (from `main` at `0d4d85f`)
- **Last commit:** see `git log -1` (`feat(next): example app and e2e`)
- **Latest tag:** `m05-react-router` (on `0d4d85f`)

## Done so far

- Milestones 0–4 merged and tagged (see `PROGRESS.md`; ADR-001..025).
- Milestone 5 merged: PR [#5](https://github.com/abdullahasghar966/shatter-router/pull/5), merge `0d4d85f`, tag `m05-react-router`, all three engines green:
  - `shatter-router/react` (router-agnostic provider, link, hooks) and `shatter-router/react-router` (provider inside the router, `ShatterLink`, `ShatterNavLink`, `useShatterNavigate`, `ShatterRouteSignal`, `createShatterBrowserRouter`). ADR-026..028, 030, 031.
  - Capture fixes found by the React Router example on CI: form-control fonts (ADR-029, 032, 033).
  - `examples/react-router` (port 4174) with e2e `e2e/react-router/*` (16 per engine).
  - Unit 257 tests. Measurements in PROGRESS.

- Milestone 6, sub-task 1: next 16.4.6 installed and read (LEARNINGS); `src/next/` builds `shatter-router/next` (`ShatterProvider` with `waitFor`, `ShatterLink`, `useShatterNavigate`, `useShatter`, `PENDING_ATTRIBUTE`); bridge and pop gate moved to `src/react/` and shared (ADR-034); `"use client"` added to built client entries; 9 unit tests in `test/next.test.tsx` (266 total).

- Milestone 6, sub-task 2: `examples/next` (next 16.4.6, port 4175: root layout + client `Providers`, header of `ShatterLink`s, `/`, `/work`, `/about`, `/slow` with a 400 ms server component and `loading.tsx` marked `data-shatter-pending`, not-found, "Navigate in code"); e2e `e2e/next/navigation.spec.ts` (11) and `transitions.spec.ts` (6); ADR-035 (clamped scroll is not an app scroll). Local full suite Chromium + WebKit: 139 passed, 9 skipped. Visual check done (PROGRESS).

## Next 3 steps (Milestone 6)

1. **Ritual (A.5):** open PR "Milestone 06: Next.js App Router adapter" (body: what was built, measurements from PROGRESS, verification, known issues: `UrlObject` hrefs unsupported, ADR-034), `gh pr checks --watch` until Chromium, Firefox, WebKit and size are green. Firefox and Linux WebKit have only run on CI: read the `[seam]` and `[next]` lines in the logs and record them in PROGRESS.
2. Merge with `gh pr merge <n> --merge`, tag `m06-nextjs` on main, push the tag.
3. Create `milestone/07-effects` from main; first commit records PR/merge/tag in PROGRESS and refreshes HANDOFF. Milestone 7: `explode`, `implode`, `flip`, `assemble` against the public `ShatterEffect` interface, plugin docs, last-frame seam tests for `flip`/`assemble`, `backForward: 'reverse'` (ADR-025).

## Deferred (tracked, not forgotten)

- `backForward: 'reverse'` → Milestone 7 with `assemble` (ADR-025).
- Debug panel (section 10) → Milestone 10 (ADR-025).
- `physics: 'rapier'` → M8. `glassTint`, `chromatic`, lighting fade-in → M9. README items (`scrollbar-gutter: stable`, CSP, browser support incl. ADR-016, popstate note from ADR-026) → M12.
- `'use client'` for the React entries is handled with the Next.js adapter (M6).

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
