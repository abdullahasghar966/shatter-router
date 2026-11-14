# Hand-off

- **Last updated:** 2026-11-15 (session 2, Milestone 5 ready to merge)
- **Session:** 2
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 5 — React + React Router adapter
- **Current branch:** `milestone/05-react-router` (from `main` at `17b79cc`)
- **Last commit:** see `git log -1` (`docs(context): milestone 5 complete`)
- **Latest tag:** `m04-shatter-effect` (on `17b79cc`)

## Done so far

- Milestones 0–4 merged and tagged (see `PROGRESS.md`; ADR-001..025).
- Milestone 5 complete on this branch, PR [#5](https://github.com/abdullahasghar966/shatter-router/pull/5) green on all three engines:
  - `shatter-router/react` (router-agnostic provider, link, hooks) and `shatter-router/react-router` (provider inside the router, `ShatterLink`, `ShatterNavLink`, `useShatterNavigate`, `ShatterRouteSignal`, `createShatterBrowserRouter`). ADR-026..028, 030, 031.
  - Capture fixes found by the React Router example on CI: form-control fonts (ADR-029, 032, 033).
  - `examples/react-router` (port 4174) with e2e `e2e/react-router/*` (16 per engine).
  - Unit 257 tests. Measurements in PROGRESS.

## Next 3 steps

1. **Merge PR #5** once `gh pr checks 5` is green for the last push: `gh pr merge 5 --merge` (never squash/rebase/delete-branch). Then `git switch main; git pull --ff-only; git tag -a m05-react-router -m "Milestone 05 complete"; git push origin m05-react-router`.
2. **Start `milestone/06-nextjs`** from `main` and, as its first commit, record PR #5, the merge SHA and the tag in PROGRESS (row 5 ☑) and refresh HANDOFF.
3. **Milestone 6 (Next.js App Router):** `npm view next version`; read the installed `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`) and `next/link` types; plan `src/next/` reusing `src/react/shared.ts`, `src/react/context.ts`, and the `RouteBridge` / pop-gate ideas (Next's own popstate handling must be checked the same way: who registers first, does React render it synchronously); handle `'use client'` in built entries; `loading.tsx` with `waitFor: 'settled'`.

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
