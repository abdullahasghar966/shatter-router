# Progress

- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Merge policy:** auto-merge milestone PRs with a merge commit once CI is green (ADR-001)

## Milestones

Status: ☐ todo · ◐ in progress · ☑ done

| #   | Milestone                     | Status | Branch                        | PR  | Merge SHA | Tag         |
| --- | ----------------------------- | ------ | ----------------------------- | --- | --------- | ----------- |
| 0   | Git, GitHub and context setup | ☑      | `main`                        | — (initial commit, no PR) | `81d68e1` | `m00-setup` |
| 1   | Scaffold                      | ◐      | `milestone/01-scaffold`       |     |           |             |
| 2   | Renderer + seam               | ☐      | `milestone/02-renderer-seam`  |     |           |             |
| 3   | Fracture + crack propagation  | ☐      | `milestone/03-fracture-crack` |     |           |             |
| 4   | `shatter` effect (procedural) | ☐      | `milestone/04-shatter-effect` |     |           |             |
| 5   | React + React Router adapter  | ☐      | `milestone/05-react-router`   |     |           |             |
| 6   | Next.js App Router adapter    | ☐      | `milestone/06-nextjs`         |     |           |             |
| 7   | Remaining effects             | ☐      | `milestone/07-effects`        |     |           |             |
| 8   | Rapier mode                   | ☐      | `milestone/08-rapier`         |     |           |             |
| 9   | Glass shading polish          | ☐      | `milestone/09-glass-shading`  |     |           |             |
| 10  | Performance pass              | ☐      | `milestone/10-performance`    |     |           |             |
| 11  | Docs site                     | ☐      | `milestone/11-docs-site`      |     |           |             |
| 12  | Release readiness             | ☐      | `milestone/12-release`        |     |           |             |

## Installed dependency versions

Recorded 2026-11-14 (session 1). Node v24.21.0, pnpm 12.8.1.

| Package | Version | Where |
|---|---|---|
| typescript | 6.0.3 (pinned below latest 7.0.2, see ADR-003) | root |
| eslint | 10.15.0 | root |
| @eslint/js | 10.0.1 | root |
| typescript-eslint | 8.72.2 | root |
| eslint-config-prettier | 10.1.8 | root |
| globals | 17.14.0 | root |
| prettier | 3.10.1 | root |
| @playwright/test | 1.65.1 | root |
| @changesets/cli | 3.0.3 | root |
| @types/node | 26.6.6 | root |
| tsup | 9.0.0 (esbuild 0.28.2) | packages/shatter-router |
| vitest | 5.1.0 | packages/shatter-router |
| happy-dom | 21.0.4 | packages/shatter-router |
| size-limit, @size-limit/preset-small-lib | 14.3.0 | packages/shatter-router |
| vite | 8.3.8 | examples/vanilla |

GitHub Actions: actions/checkout v7, actions/setup-node v7, pnpm/action-setup v6, actions/cache v6, actions/upload-artifact v7.

## Measurements

Every number here comes from a run, with date, device and browser.

### Bundle size (size-limit, min+gzip)

| Date | Entry | Size | Budget | Notes |
|---|---|---|---|---|
| 2026-11-14 | core `dist/index.js` | 823 B | 6 KB | Milestone 1: link rules + env helpers only |

## Test counts

| Milestone | Unit | E2E |
| --- | --- | --- |
| 1 (in progress) | 39 tests in 4 files | 6 tests x 3 engines (vanilla navigation) |
