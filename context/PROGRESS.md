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
| 3   | Fracture + crack propagation  | ☑      | `milestone/03-fracture-crack` | [#3](https://github.com/abdullahasghar966/shatter-router/pull/3) | `5523bfc` | `m03-fracture-crack` |
| 4   | `shatter` effect (procedural) | ☑      | `milestone/04-shatter-effect` | [#4](https://github.com/abdullahasghar966/shatter-router/pull/4) | `17b79cc` | `m04-shatter-effect` |
| 5   | React + React Router adapter  | ☑      | `milestone/05-react-router`   | [#5](https://github.com/abdullahasghar966/shatter-router/pull/5) | `0d4d85f` | `m05-react-router` |
| 6   | Next.js App Router adapter    | ◐      | `milestone/06-nextjs`         |     |           |             |
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
| d3-delaunay / @types/d3-delaunay | 6.0.6 / 6.0.4 | packages/shatter-router (dependency / dev) |
| tsup | 9.0.0 (esbuild 0.28.2) | packages/shatter-router |
| vitest | 5.1.0 | packages/shatter-router |
| happy-dom | 21.0.4 | packages/shatter-router |
| size-limit, @size-limit/preset-small-lib | 14.3.0 | packages/shatter-router |
| vite | 8.3.8 | examples/vanilla |
| react / react-dom | 19.3.1 | packages/shatter-router (dev; optional peer `>=19.0.0`), recorded 2026-11-15 |
| react-router | 8.5.1 | packages/shatter-router (dev; optional peer `>=8.0.0`) |
| @types/react / @types/react-dom | 19.3.0 | packages/shatter-router (dev) |

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
| 2026-11-14 | core `dist/index.js` | 2.66 kB | 6 KB | Milestone 3: + fracture/crack options, debug hook |
| 2026-11-14 | engine `dist/engine.js` (lazy) | 13.92 kB | 22 KB | Milestone 3: + d3-delaunay 6.0.6, fracture, crack shader |
| 2026-11-14 | capture `dist/capture.js` (lazy) | 11.06 kB | 16 KB | Milestone 3: + single-line text guard |
| 2026-11-15 | core `dist/index.js` | 1.77 kB | 6 KB | Milestone 4: facade only (ADR-020); was 6.45 kB before the split |
| 2026-11-15 | runtime `dist/runtime.js` (lazy) | 6.56 kB | 8 KB (own) | Milestone 4: state machine, fallbacks, a11y, scroll lock, pre-capture |
| 2026-11-15 | engine `dist/engine.js` (lazy) | 16.82 kB | 22 KB | Milestone 4: + effect programs, shard data texture, frame loop, `shatter` effect |
| 2026-11-15 | capture `dist/capture.js` (lazy) | 11.94 kB | 16 KB | Milestone 4: + substitutes for iframe/video/ignored, CORS image rule |
| 2026-11-15 | `shatter-router/react` (`dist/react.js`, incl. core) | 2.46 kB | 6 KB (ADR-027) | Milestone 5; react, react-dom excluded (peers) |
| 2026-11-15 | `shatter-router/react-router` (`dist/react-router.js`, incl. core) | 3.35 kB | 6 KB (ADR-027) | Milestone 5; react-router excluded (peer) |

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

Milestone 3, local Windows 11 (with the single-line text guard and the worst-block check, ADR-019):

| Date | Browser | Case | DPR | Diff | Worst block |
|---|---|---|---|---|---|
| 2026-11-14 | Chromium 1255 headless | intact quad, top / scrolled / 2x | 1 / 1 / 2 | 0.1066 / 0.2160 / 0.0568 % | 4.0 / 4.2 / 3.4 % |
| 2026-11-14 | Chromium 1255 headless | **fractured mesh at rest**, 1x / 2x | 1 / 2 | 0.1056 / 0.0556 % | 4.0 / 3.3 % |
| 2026-11-14 | WebKit 2388 | intact quad top / scrolled; fractured mesh | 2 | 0.0021 / 0.0000 / 0.0021 % (raw 0.0975 / 0.2358 / 0.0975 %) | 0.0 % |
| 2026-11-14 | Chromium / WebKit | fully cracked frame (expected to differ: lines) | 1 / 2 | 4.81 % / 3.92 % | 12.2 % / 25.3 % |

Milestone 3, **PR #3 CI (GitHub Actions ubuntu-latest)**, diff / worst block:

| Date | Browser | top | scrolled | 2x | fractured 1x | fractured 2x |
|---|---|---|---|---|---|---|
| 2026-11-14 | Chromium headless | 0.1401 % / 4.0 % | 0.2240 % / 4.2 % | 0.5247 % (raw 0.8217) / 5.8 % | 0.1398 % / 4.0 % | 0.5275 % (raw 0.8230) / 5.8 % |
| 2026-11-14 | Firefox headed (xvfb, Mesa) | 0.0000 % / 0.0 % | 0.0000 % / 0.0 % | 0.0000 % / 0.0 % | 0.0000 % / 0.0 % | 0.0000 % / 0.0 % |
| 2026-11-14 | WebKit (all at 2x) | 0.1495 % (raw 0.3157) / 0.0 % | 0.0023 % / 0.0 % | 0.1495 % / 0.0 % | 0.1495 % / 0.0 % | 0.1495 % / 0.0 % |

History of the same cases while fixing them (so the causes are on record): Chromium DPR 1 with an alpha canvas 0.54 % / 0.70 % (ClearType lost, ADR-009); WebKit scrolled with a `viewBox` offset 65.4 % (ADR-008); WebKit without `zoom` 0.55 % / 0.68 % (ADR-010); Chromium DPR 2 with `zoom` 0.59 % (ADR-010).

Milestone 5, React Router example (`e2e/react-router/transitions.spec.ts`), local Windows 11, 2026-11-15:

| Browser | Case | DPR | Diff | Worst block |
|---|---|---|---|---|
| Chromium 1255 headless | first frame, top of `/` (data mode) | 1 | 0.1131 % | 4.0 % |
| Chromium 1255 headless | back: overlay at `covered` vs the outgoing page | 1 | 0.1026 % | |
| WebKit 2388 | first frame, top of `/` | 2 | 0.0021 % (raw 0.1095 %) | 0.0 % |
| WebKit 2388 | back: overlay at `covered` vs the outgoing page | 2 | 0.2822 % (raw 0.6291 %) | |

Milestone 5, **PR #5 CI (GitHub Actions ubuntu-latest)**, React Router example, 2026-11-15:

| Browser | First frame, top of `/` | Back: overlay vs outgoing page | Committing with a 400 ms loader |
|---|---|---|---|
| Chromium headless (1x) | 0.1566 % / worst block 4.0 % | 0.1347 % | 407 ms |
| Firefox headed (xvfb, Mesa) | 0.0000 % / 0.0 % | 0.0000 % | 407 ms |
| WebKit (2x) | 0.1335 % (raw 0.3096 %) / 2.4 % | 0.0345 % (raw 0.1834 %) | 416 ms |

Before ADR-033 the WebKit first frame had a worst block of 15.3 % (button drawn serif in the copy).

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

### Fracture time (CPU, geometry only; ADR-017)

| Date | Runtime | Viewport | 40 | 90 | 160 | 400 shards |
|---|---|---|---|---|---|---|
| 2026-11-14 | Node 24, RTX 4050 / 12-core laptop (Vitest, after optimisation) | 1440x900 | | | 0.75 ms (seeds 0.06, Voronoi 0.32, mesh 0.37) | |
| 2026-11-14 | Node 24, same, before optimisation | 1440x900 | | | 0.92 ms median, p95 1.41 ms | |
| 2026-11-14 | Headless Chromium 1255, same machine | 1440x900 | 0.20 ms | 0.40 ms | **0.60 ms** (p95 1.00) | 1.40 ms (p95 2.20) |
| 2026-11-14 | Playwright WebKit 2388, same machine (1 ms timer) | 1440x900 | 0–1 ms | 0–1 ms | ≤ 1 ms | 1 ms (p95 2) |
| 2026-11-14 | Claude desktop browser pane (throttled, not representative) | 1024x768 | 0.6 ms | | 3.4–3.6 ms (p95 5.5) | 8.0 ms |
| 2026-11-14 | GitHub Actions ubuntu-latest, headless Chromium (PR #3) | 1440x900 | 0.20 ms | 0.50 ms | 0.90 ms (p95 2.30) | 2.20 ms (p95 4.10) |
| 2026-11-14 | GitHub Actions, Firefox headed (1 ms timer) | 1440x900 | 0 ms | 1 ms | 1 ms (p95 2) | 3 ms (p95 4) |
| 2026-11-14 | GitHub Actions, WebKit (1 ms timer) | 1440x900 | 0 ms | 0 ms | 1 ms (p95 1) | 2 ms (p95 3) |

Decision: below the 4 ms Worker threshold, stays on the main thread. Re-measure on a mid-range laptop in Milestone 10.

### Transition timing (vanilla example, headless Chromium 1255, 1440x900, same machine)

| Date | Click → overlay up | Click → overlay gone | Capture | Notes |
|---|---|---|---|---|
| 2026-11-14 | 112–141 ms | 338–404 ms | 32–57 ms | Milestone 3 pipeline (no shard motion yet); 60 fps frames; ~80 ms between capture and overlay = texture upload under software GL |

### Shard motion (Milestone 4, vanilla example, 160 shards, 1000 ms motion)

| Date | Runtime | Viewport | Frames / duration | FPS | Worst frame | Notes |
|---|---|---|---|---|---|---|
| 2026-11-15 | Headless Chromium, single run, same laptop | 1280x720 | 56 frames / 1004 ms | 54.8 | 37.6 ms | software GL; one draw call per frame |
| 2026-11-15 | Headless Chromium, 4 parallel workers | 1280x720 | 12 / 1042 ms | 10.6 | 258 ms | CPU contention, not representative |
| 2026-11-15 | Playwright WebKit, single run | 1280x720 | 17 / 1053 ms | 15.2 | 70 ms | software GL |
| 2026-11-15 | PR #4 CI ubuntu-latest, headless Chromium | 1280x720 | 21 / 1009 ms | 19.8 | 142 ms | parallel workers, software GL; capture 76 ms |
| 2026-11-15 | PR #4 CI, Firefox headed (xvfb, Mesa) | 1280x720 | 26 / 1020 ms | 24.5 | 214 ms | capture 173 ms |
| 2026-11-15 | PR #4 CI, WebKit | 1280x720 | 10 / 1104 ms | 8.2 | 256 ms | capture 214 ms |

Real-GPU FPS (60 fps target at 1440x900, section 8) is measured in Milestone 10.

### React Router adapter (Milestone 5)

| Date | Runtime | Measurement |
|---|---|---|
| 2026-11-15 | Headless Chromium 1255, local, 2 workers | `/slow` (400 ms loader): committing phase 410–413 ms; overlay stays up until the loaded page rendered |
| 2026-11-15 | Playwright WebKit 2388, local | same: committing 449–450 ms |
| 2026-11-15 | Headless Chromium, local | capture on the React Router home page: 51–124 ms (1x, parallel workers) |

Visual check (headless Chromium screenshots, 1280x720, motion frozen at 450 ms): forward Home → Work shatters the Home page from the click point over the live Work page; back Work → Home shatters the Work page from the viewport centre over the live Home page. No console errors or warnings.

### Memory (section 9: 100 consecutive transitions)

| Date | Runtime | Result |
|---|---|---|
| 2026-11-15 | Headless Chromium (CDP heap after forced GC), 40 shards, 60 ms motion | heap 3.02 MB → 3.14 MB (+119 kB) after 100 transitions (10 warm-up first); live GPU textures after every transition: 0 |
| 2026-11-15 | PR #4 CI (ubuntu-latest), same test | heap 3.02 MB → 3.13 MB (+117 kB); textures 0 |

### Not measured yet

Real-GPU FPS, draw calls traced in a Performance profile, Lighthouse: later milestones.

## Test counts

| Milestone | Unit | E2E |
| --- | --- | --- |
| 1 | 39 tests in 4 files | 6 tests per engine (vanilla navigation). PR #1 CI: Chromium, Firefox, WebKit all green (Linux). Local Windows 11: Chromium + WebKit green, Firefox cannot launch (see LEARNINGS) |
| 2 | 68 tests in 7 files | 10 tests per engine (6 navigation + 4 seam/overlay) + 4 seam-metric tests (Chromium project). Local: Chromium + WebKit 20/20 + 4/4. PR #2 CI: all three engines green |
| 3 | 99 tests in 10 files (+ fracture 23, crack 7, fracture timing 1) | 15 tests per engine (6 navigation, 7 seam/crack/wireframe, 1 fracture timing, 1 cleanup) + 6 seam-metric tests. Local: Chromium + WebKit 36/36 |
| 4 | 218 tests in 13 files (state machine 47 incl. every interruption, machine table 70, effect 7, frame loop 6) | per engine: effect 7, interruptions 6, fallbacks 4 (reduced motion, budget, strict CSP, no WebGL), history 1, lab 1, memory 1 (Chromium) + earlier suites. Local: Chromium + WebKit 73 passed, 9 skipped (engine-specific), CSP fixme on Windows WebKit. PR #4 CI: all three engines green (strict-CSP test passes on Linux WebKit) |
| 5 | 257 tests in 16 files (+ `react.test.tsx` 24, `react-router.test.tsx` 13, `standard-font.test.ts` 2) | React Router example: 9 navigation + 7 transitions/seam per engine. Local: Chromium + WebKit, full suite 105 passed, 9 skipped. PR #5 CI: Chromium 57 passed, Firefox 49 passed, WebKit 49 passed (engine-specific skips) |
