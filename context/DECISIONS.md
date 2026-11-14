# Architecture Decision Records

Append only. Never edit an old ADR's decision; supersede it with a new ADR.

---

## ADR-001 — Repository visibility and PR merge policy

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** Master prompt A.2 step 6 asks the user (a) private or public repo, (b) auto-merge milestone PRs once CI is green, or wait for approval.
- **Decision:** (a) **Public** repo (`shatter-router`), as the user explicitly requested. (b) **Auto-merge** milestone PRs with `gh pr merge --merge` once CI is green. The user said they are not familiar with PRs/branches and asked us to "do what's best", so the default from the spec applies.
- **Alternatives considered:** private repo (spec default; overridden by the user); wait for approval on every PR (would block progress on a user who asked us to decide).
- **Consequences:** CI minutes are not limited on a public repo, but the spec's CI split (Chromium-only on branch pushes, full matrix on PRs into `main`) is still followed to keep feedback fast. Everything pushed is world-readable from the first push: never commit secrets or personal data.

## ADR-002 — Git commit identity

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** The machine had no global git `user.name` / `user.email`.
- **Decision:** Set a **repo-local** identity using the GitHub account's display name and its `users.noreply.github.com` address, so the user's real e-mail is never published in a public repo. The global git config is left untouched.
- **Alternatives considered:** setting a global identity (changes the user's machine-wide config without being asked); using the real e-mail (publishes personal data).
- **Consequences:** A fresh clone needs `git config user.name/user.email` set again before committing (documented in `HANDOFF.md`).
