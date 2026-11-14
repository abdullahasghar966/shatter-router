# Hand-off

- **Last updated:** 2026-11-14 06:55 PST
- **Session:** 1
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 1 — Scaffold
- **Current branch:** `milestone/01-scaffold`
- **Last commit:** see `git log -1` (this file is committed with the code it describes)
- **Latest tag:** `m00-setup` (on `81d68e1`)

## Done in this milestone

- pnpm 12 workspace: `packages/shatter-router` (library), `examples/vanilla` (Vite 8 pushState SPA).
- Library: tsup ESM + d.ts build, `exports` map (core entry only, ADR-004), Vitest + happy-dom, size-limit (gzip, 6 KB budget on the core, currently 823 B).
- Real core code: `src/core/links.ts` (link interception rules), `src/core/random.ts` (mulberry32), `src/core/env.ts`. 39 unit tests.
- Root: ESLint 10 flat config (type-checked strict), Prettier, Changesets, Playwright config (3 engines) with a console-error fixture (`e2e/fixtures.ts`), 6 navigation e2e tests.
- CI workflow `.github/workflows/ci.yml`: check job (build, typecheck, lint, format, unit), e2e matrix (Chromium on pushes, all three on PRs into `main`), size job on PRs.
- LICENSE (MIT) and a short development README.

## In progress

- Getting CI green on GitHub for the first time, then the milestone end ritual (A.5).

## Next 3 steps

1. `gh run watch` the push run on `milestone/01-scaffold`; fix anything red on this branch.
2. Local Firefox: Playwright's `firefox-1572` failed to launch from Node (`spawn UNKNOWN`, Windows side-by-side error); a `playwright install --force firefox` was started. Re-run `pnpm test:e2e --project=firefox`. Chromium and WebKit pass locally (12/12).
3. Run ritual A.5: update the four context files, open the PR `Milestone 01: Scaffold`, `gh pr checks --watch`, `gh pr merge --merge`, tag `m01-scaffold`, then branch `milestone/02-renderer-seam`.

## Open problems / blockers

- Local Firefox launch (see step 2). Not a blocker for CI, which installs its own browsers on Linux.

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
pnpm test:e2e
# a fresh clone needs a repo-local identity (ADR-002):
# git config user.name "Abdullah Asghar"; git config user.email "203540047+abdullahasghar966@users.noreply.github.com"
```

## Read first

- `SHATTER_ROUTER_MASTER_PROMPT.md` (the spec, never edit)
- `context/PROGRESS.md`, `context/DECISIONS.md`, `context/LEARNINGS.md`
- `packages/shatter-router/src/index.ts`, `packages/shatter-router/tsup.config.ts`
- `playwright.config.ts`, `e2e/fixtures.ts`, `.github/workflows/ci.yml`
