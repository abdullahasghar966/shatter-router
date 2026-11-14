# Hand-off

- **Last updated:** 2026-11-14 06:30 PST
- **Session:** 1
- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)

## Where we are

- **Current milestone:** 0 — Git, GitHub and context setup
- **Current branch:** `main`
- **Last commit:** see `git log -1` (initial commit)
- **Latest tag:** none yet (`m00-setup` pending)

## Done in this milestone

- Prerequisites checked (git, gh signed in, Node 24, pnpm 12).
- `git init -b main`, repo-local identity (ADR-002), `.gitignore`, `.gitattributes`, `.editorconfig`, four context files.
- User answered the setup questions: **public** repo, **auto-merge** PRs once CI is green (ADR-001).

## In progress

- Creating the GitHub repo and tagging `m00-setup`.

## Next 3 steps

1. Create branch `milestone/01-scaffold` from `main` and push it.
2. Scaffold the pnpm monorepo (`packages/shatter-router`, `examples/vanilla`), tsup, Vitest, Playwright, ESLint, Prettier, size-limit, Changesets, GitHub Actions CI.
3. Get CI green, verify the vanilla example in a browser, run the milestone end ritual (A.5).

## Open problems / blockers

- None.

## Questions waiting on the user

- None.

## Working tree

- Clean, everything pushed (verified before writing this file).

## Resume commands (PowerShell)

```powershell
cd "D:\Shatter Router"
git fetch --all --tags
git status
# a fresh clone needs a repo-local identity (ADR-002):
# git config user.name "Abdullah Asghar"; git config user.email "203540047+abdullahasghar966@users.noreply.github.com"
```

## Read first

- `SHATTER_ROUTER_MASTER_PROMPT.md` (the spec, never edit)
- `context/PROGRESS.md`, `context/DECISIONS.md`, `context/LEARNINGS.md`
