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

## ADR-003 — TypeScript 6.0.x instead of the latest (7.0.x)

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** Working rule 3 asks for the latest stable version of every dependency. `typescript@latest` is 7.0.2 (the native compiler). Its package only exports `./lib/version.cjs` plus `unstable/*` APIs: the classic JavaScript compiler API (`ts.createProgram` etc.) is gone. `typescript-eslint@8.72.2` declares `typescript >=4.8.4 <6.1.0`, and `tsup`'s `dts` build and Next.js type checking also use the classic API.
- **Decision:** Pin `typescript@6.0.3`, the newest release every tool in the required stack supports.
- **Alternatives considered:** TS 7 for `tsc` plus TS 6 only for tools (two compilers that can disagree); dropping type-aware lint (weakens rule 5).
- **Consequences:** Revisit when typescript-eslint and tsup support TS 7. `tsconfig.base.json` sets `types: []` explicitly and each project opts into the ambient types it needs.

## ADR-004 — Subpath exports are added in the milestone that implements them

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** Milestone 1 asks for a "package with subpath exports", but rule 2 forbids stubs. `shatter-router/react`, `/next`, `/react-router` and `/rapier` have no implementation until milestones 5, 6 and 8.
- **Decision:** Milestone 1 ships the `exports` map, tsup multi-entry build and size-limit wiring with the core entry (`.`) only. Each further subpath is added to `exports`, `tsup.config.ts` and `size-limit` in the milestone that implements it, never as an empty module.
- **Alternatives considered:** shipping empty or throwing placeholder entries (violates rule 2).
- **Consequences:** Until milestone 8 the `exports` map is a subset of section 6.

## ADR-005 — Link interception rules are public core API

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** Vanilla apps and future adapters all need the same answer to "may this click be shattered?" (section 11 lists the rules).
- **Decision:** Export `classifyLinkClick`, `findAnchor` and `getLinkEffect` from the core entry. `classifyLinkClick` returns a typed decision with a skip reason. `data-shatter="off"` and `data-shatter-effect` are also honoured on ancestors (a superset of the spec, so a whole nav can opt out). A click on a link to the exact current URL is intercepted; only links that differ from the current URL by hash alone (or equal it with a hash) are left to the browser.
- **Alternatives considered:** keeping the rules internal (every vanilla integration would re-implement them, usually wrongly).
- **Consequences:** These three functions are part of the semver surface and count against the 6 KB core budget (823 B gzip for the whole core at this point).
