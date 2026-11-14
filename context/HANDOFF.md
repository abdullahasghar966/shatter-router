# Hand-off

- **Last updated:** 2026-11-15 (session 2, Milestone 5 merged, Milestone 6 branch created)
- **Session:** 2
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 6 — Next.js App Router adapter (branch created, no code yet)
- **Current branch:** `milestone/06-nextjs` (from `main` at `0d4d85f`)
- **Last commit:** see `git log -1` (`docs(context): record milestone 5 merge and start milestone 6`)
- **Latest tag:** `m05-react-router` (on `0d4d85f`)

## Done so far

- Milestones 0–4 merged and tagged (see `PROGRESS.md`; ADR-001..025).
- Milestone 5 merged: PR [#5](https://github.com/abdullahasghar966/shatter-router/pull/5), merge `0d4d85f`, tag `m05-react-router`, all three engines green:
  - `shatter-router/react` (router-agnostic provider, link, hooks) and `shatter-router/react-router` (provider inside the router, `ShatterLink`, `ShatterNavLink`, `useShatterNavigate`, `ShatterRouteSignal`, `createShatterBrowserRouter`). ADR-026..028, 030, 031.
  - Capture fixes found by the React Router example on CI: form-control fonts (ADR-029, 032, 033).
  - `examples/react-router` (port 4174) with e2e `e2e/react-router/*` (16 per engine).
  - Unit 257 tests. Measurements in PROGRESS.

## Next 3 steps (Milestone 6)

1. **Read the installed APIs first (rule 3):** `npm view next version` (latest stable) and add `next` as a dev + optional peer dependency of `packages/shatter-router` (`peerDependenciesMeta`). Read `node_modules/next/dist/client/components/navigation.d.ts` (`useRouter`, `usePathname`, `useSearchParams`), `next/link` props (`prefetch`, `scroll`, `replace`, `onNavigate`), and how the App Router handles `popstate` (who registers first, whether the update renders synchronously in React 19): the same questions ADR-026/028/030/031 answered for React Router. Record facts in LEARNINGS.
2. **Build `src/next/`** → `shatter-router/next` with `'use client'` preserved in the built file (check tsup/esbuild keeps or strips the directive; add a banner if needed): `ShatterProvider` (root layout), `ShatterLink` (wraps `next/link`, keeps prefetch), `useShatterNavigate`, commit = `router.push(href, { scroll: false })` resolving when `usePathname()` + `useSearchParams()` (inside `<Suspense>`) change, plus two rAFs; `waitFor: 'commit' | 'settled'` (`[data-shatter-pending]` / Suspense fallback marker, bounded by `readyTimeout`). Reuse `src/react/shared.ts`, `context.ts`, the bridge and pop-gate ideas. Exports, tsup entry, size-limit entry (≤ 6 KB incl. core). ADRs for every deviation.
3. **`examples/next`** (App Router, same pages/look, a `loading.tsx` route, port 4175) + e2e `e2e/next/*` mirroring `e2e/react-router/*` (links, modifier clicks, loading boundary, back/forward with scroll, seams, interruption). Then the ritual (A.5).

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
