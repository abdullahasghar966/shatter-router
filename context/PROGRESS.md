# Progress

- **Repo:** https://github.com/abdullahasghar966/shatter-router (public)
- **Merge policy:** auto-merge milestone PRs with a merge commit once CI is green (ADR-001)

## Milestones

Status: ☐ todo · ◐ in progress · ☑ done

| #   | Milestone                     | Status | Branch                        | PR  | Merge SHA | Tag         |
| --- | ----------------------------- | ------ | ----------------------------- | --- | --------- | ----------- |
| 0   | Git, GitHub and context setup | ☑      | `main`                        | — (initial commit, no PR) | `81d68e1` | `m00-setup` |
| 1   | Scaffold                      | ☑      | `milestone/01-scaffold`       | [#1](https://github.com/abdullahasghar966/shatter-router/pull/1) | `18f25c1` | `m01-scaffold` |
| 2   | Renderer + seam               | ☑      | `milestone/02-renderer-seam`  | [#2](https://github.com/abdullahasghar966/shatter-router/pull/2) | `ca25842` | `m02-renderer-seam` |
| 3   | Fracture + crack propagation  | ◐      | `milestone/03-fracture-crack` |     |           |             |
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
| pngjs / @types/pngjs | 7.0.0 / 6.0.5 | root (seam tests) |
| pixelmatch | 8.0.0 | root (seam tests) |
| @changesets/cli | 3.0.3 | root |
| @types/node | 26.6.6 | root |
| modern-screenshot | 4.7.0 | packages/shatter-router (dependency) |
| tsup | 9.0.0 (esbuild 0.28.2) | packages/shatter-router |
| vitest | 5.1.0 | packages/shatter-router |
| happy-dom | 21.0.4 | packages/shatter-router |
| size-limit, @size-limit/preset-small-lib | 14.3.0 | packages/shatter-router |
| vite | 8.3.8 | examples/vanilla |

GitHub Actions: actions/checkout v7, actions/setup-node v7, pnpm/action-setup v6, actions/cache v6, actions/upload-artifact v7.

Playwright browsers (1.65.1): chromium-1255 (headless shell), firefox-1572 (Firefox 159), webkit-2388.

## Measurements

Every number here comes from a run, with date, device and browser.

Dev machine: Windows 11, NVIDIA GeForce RTX 4050 Laptop GPU.

### Bundle size (size-limit, min+gzip)

| Date | Entry | Size | Budget | Notes |
|---|---|---|---|---|
| 2026-11-14 | core `dist/index.js` | 823 B | 6 KB | Milestone 1: link rules + env helpers only |
| 2026-11-14 | core `dist/index.js` | 2.32 kB | 6 KB | Milestone 2: + `createShatter`, viewport, events, lazy loader |
| 2026-11-14 | engine `dist/engine.js` (lazy) | 3.33 kB | 22 KB | Milestone 2: GL device, camera, overlay, intact quad |
| 2026-11-14 | capture `dist/capture.js` (lazy) | 10.74 kB | 16 KB (own ceiling, ADR-011) | Milestone 2: includes modern-screenshot 4.7.0 |

### First-frame seam (share of pixels differing beyond pixelmatch threshold 0.1, anti-aliased pixels counted)

Target: ≤ 0.5 %. From ADR-014 on, the threshold applies to the number that forgives sub-half-CSS-pixel glyph shifts at 2x; raw numbers are kept alongside. Page: vanilla example. Measured with `e2e/vanilla/seam.spec.ts`.

| Date | Browser | Case | Viewport | DPR | Diff | Notes |
|---|---|---|---|---|---|---|
| 2026-11-14 | Chromium 1255 headless, Windows 11 | top of `/` | 1280x720 | 1 | 0.1066 % | |
| 2026-11-14 | Chromium 1255 headless, Windows 11 | `/work` scrolled 240 px (sticky header, fixed note) | 1280x720 | 1 | 0.2160 % | |
| 2026-11-14 | Chromium 1255 headless, Windows 11 | top of `/` | 1280x720 | 2 | 0.0585 % | |
| 2026-11-14 | WebKit 2388, Windows 11 | top of `/` | 1280x720 | 2 | 0.1210 % | layout grid `device` |
| 2026-11-14 | WebKit 2388, Windows 11 | `/work` scrolled 240 px | 1280x720 | 2 | 0.2358 % | layout grid `device` |
| 2026-11-14 | Chromium headless, Linux CI (spike run) | top / scrolled at 1x; `/` at 2x | 1280x720 | 1 / 2 | 0.1401 % / 0.2240 %; 2x: 0.8217 % raw | 2x before ADR-014; see the PR #2 run for the forgiving number |
| 2026-11-14 | WebKit, Linux CI (spike run) | top / scrolled | 1280x720 | 2 | 0.4519 % / 0.0435 % raw | layout grid `device` |
| 2026-11-14 | **PR #2 CI (ubuntu-latest), final** Chromium | top / scrolled / `/` at 2x | 1280x720 | 1 / 1 / 2 | 0.1401 % / 0.2240 % / 0.5247 % (raw 0.8217 %) | 2x ceiling 0.6 % (ADR-016) |
| 2026-11-14 | **PR #2 CI, final** Firefox (headed, xvfb, Mesa) | top / scrolled / `/` at 2x | 1280x720 | 1 / 1 / 2 | 0.0000 % / 0.0000 % / 0.0000 % | layout grid `css` |
| 2026-11-14 | **PR #2 CI, final** WebKit | top / scrolled / `/` at 2x | 1280x720 | 2 | 0.2858 % / 0.0023 % / 0.2858 % (raw 0.4519 / 0.0435 / 0.4522 %) | layout grid `device` |
| 2026-11-14 | Chromium 1255 headless, Windows 11, metric with shift radius (ADR-014) | `/` at 2x | 1280x720 | 2 | 0.0568 % (raw 0.0585 %) | |
| 2026-11-14 | WebKit 2388, Windows 11, metric with shift radius | top / scrolled | 1280x720 | 2 | 0.0255 % / 0.0000 % (raw 0.1210 % / 0.2358 %) | |

History of the same cases while fixing them (so the causes are on record): Chromium DPR 1 with an alpha canvas 0.54 % / 0.70 % (ClearType lost, ADR-009); WebKit scrolled with a `viewBox` offset 65.4 % (ADR-008); WebKit without `zoom` 0.55 % / 0.68 % (ADR-010); Chromium DPR 2 with `zoom` 0.59 % (ADR-010).

### Capture time (viewport capture of the vanilla example, capturer warm)

| Date | Device / browser | Viewport | DPR | Time | Notes |
|---|---|---|---|---|---|
| 2026-11-14 | RTX 4050 laptop, Chrome (Claude desktop browser pane, ANGLE D3D11) | 1024x768 | 1 | 60 ms, 42 ms, 31 ms | three consecutive navigations |
| 2026-11-14 | same | 1024x768 | 1 | 77–93 ms | first capture after load, earlier build |
| 2026-11-14 | same machine, headless Chromium, 4 parallel workers | 1280x720 | 1 | 131–174 ms | software GL, CPU shared between tests |
| 2026-11-14 | same machine, headless Chromium | 1280x720 | 2 | 128–209 ms | |
| 2026-11-14 | same machine, Playwright WebKit | 1280x720 | 2 | 66–185 ms | |
| 2026-11-14 | GitHub Actions ubuntu-latest, headless Chromium (PR #2) | 1280x720 | 1 / 2 | 74–76 ms / 74 ms | |
| 2026-11-14 | GitHub Actions ubuntu-latest, Firefox headed (xvfb, Mesa) | 1280x720 | 1 / 2 | 123–131 ms / 161 ms | |
| 2026-11-14 | GitHub Actions ubuntu-latest, WebKit | 1280x720 | 2 | 192–243 ms | |

The section 8 target (≤ 120 ms on the docs landing page at 1440x900) is measured in Milestone 10; the docs site does not exist yet.

### Not measured yet

Fracture time, FPS, draw calls during animation, Lighthouse, 100-transition memory test: later milestones.

## Test counts

| Milestone | Unit | E2E |
| --- | --- | --- |
| 1 | 39 tests in 4 files | 6 tests per engine (vanilla navigation). PR #1 CI: Chromium, Firefox, WebKit all green (Linux). Local Windows 11: Chromium + WebKit green, Firefox cannot launch (see LEARNINGS) |
| 2 | 68 tests in 7 files | 10 tests per engine (6 navigation + 4 seam/overlay) + 4 seam-metric tests (Chromium project). Local: Chromium + WebKit 20/20 + 4/4. PR #2 CI: all three engines green |
