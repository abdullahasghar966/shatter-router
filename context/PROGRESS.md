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
| 6   | Next.js App Router adapter    | ☑      | `milestone/06-nextjs`         | [#6](https://github.com/abdullahasghar966/shatter-router/pull/6) | `99f7e26` | `m06-nextjs` |
| 7   | Remaining effects             | ☑      | `milestone/07-effects`        | [#7](https://github.com/abdullahasghar966/shatter-router/pull/7) | `d6054ae` | `m07-effects` |
| 8   | Rapier mode                   | ☑      | `milestone/08-rapier`         | [#8](https://github.com/abdullahasghar966/shatter-router/pull/8) | `13d4fb6` | `m08-rapier` |
| 9   | Glass shading polish          | ☑      | `milestone/09-glass-shading`  | [#9](https://github.com/abdullahasghar966/shatter-router/pull/9) | `48476d2` | `m09-glass-shading` |
| 10  | Performance pass              | ☑      | `milestone/10-performance`    | [#10](https://github.com/abdullahasghar966/shatter-router/pull/10) | `c3175ef` | `m10-performance` |
| 11  | Docs site                     | ☑      | `milestone/11-docs-site`      | [#11](https://github.com/abdullahasghar966/shatter-router/pull/11) | `ecb969c` | `m11-docs-site` |
| 12  | Release readiness             | ☑      | `milestone/12-release`        | [#12](https://github.com/abdullahasghar966/shatter-router/pull/12) | `9e2777a` | `m12-release` |
| 13  | Navigation memory             | ☑      | `milestone/13-navigation-memory` | [#15](https://github.com/abdullahasghar966/shatter-router/pull/15) | `6040c4d` | `m13-navigation-memory` |
| 14  | Effect architecture           | ☑      | `milestone/14-effect-architecture` | [#16](https://github.com/abdullahasghar966/shatter-router/pull/16) | `ddbb660` | `m14-effect-architecture` |
| 15  | Fracture patterns             | ☑      | `milestone/15-patterns`        | [#18](https://github.com/abdullahasghar966/shatter-router/pull/18) | `fad5e63` | `m15-patterns` |
| 16  | Motions and materials         | ◐      | `milestone/16-motions` (part 1, [#19](https://github.com/abdullahasghar966/shatter-router/pull/19), `91b83d4`), `milestone/16-motions-2` (part 2, [#20](https://github.com/abdullahasghar966/shatter-router/pull/20), `44a7544`), `milestone/16-materials` (part 3) |     |           |             |
| 17  | Interaction, cursor, sound    | ☐      | `milestone/17-interaction`     |     |           |             |
| 18  | Region transitions            | ☐      | `milestone/18-regions`         |     |           |             |
| 19  | Site redesign (Material lab)  | ☑      | `milestone/19-redesign`        | [#17](https://github.com/abdullahasghar966/shatter-router/pull/17) | `0091427` | `m19-redesign` |
| 20  | Site features                 | ☐      | `milestone/20-site-features`   |     |           |             |
| 21  | Production foundations, 1.0   | ☐      | `milestone/21-production`      |     |           |             |

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
| next | 16.4.6 | packages/shatter-router (dev; optional peer `>=16.0.0`), recorded 2026-11-15 |
| @dimforge/rapier3d-compat | 0.21.0 | packages/shatter-router (dev; optional peer `>=0.21.0`), examples/vanilla |

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
| 2026-11-15 | engine `dist/engine.js` (lazy) | 19.74 kB | 22 KB | Milestone 10: GLSL comments and indentation stripped at build (ADR-039); was 21.58 kB after M9. Runtime 7.23 kB, capture 12.53 kB, core 1.8 kB unchanged |
| 2026-11-15 | runtime `dist/runtime.js` (lazy) | 7.76 kB | 8 KB | Milestone 11: + priming capture on first intent (ADR-043) |
| 2026-11-20 | runtime `dist/runtime.js` (lazy) | 8.68 kB | 9 KB | Milestone 13: + navigation memory, mirror planning (ADR-047; budget raised from 8 KB). Engine 20.05 kB of 22 KB (+0.24: reverse wrapper); core 1.83 kB |
| 2026-11-20 | engine core `dist/engine.js` (lazy) | 11.45 kB | 15 KB | Milestone 14: effects as lazy plugins (ADR-048). Motions `dist/effects/*.js`: shatter 1.01, explode 1.35, implode 1.29, flip 0.87, assemble 1.26 kB (2 KB each); pattern `impact` 8.19 kB incl. d3-delaunay (9 KB). Runtime 9.0 kB (budget raised to 10 KB); core 1.84 kB |
| 2026-11-15 | debug `dist/debug.js` (lazy, debug mode only) | 3.44 kB | 5 KB (own) | Milestone 10: debug panel and seam check (ADR-041). Runtime 7.55 kB of 8 KB (+0.32: panel loading, `exclusive()`, draw stats); engine 19.76 kB |

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

Milestone 6, Next.js example (`e2e/next/transitions.spec.ts`), local Windows 11, 2026-11-15:

| Browser | First frame, top of `/` | Back: overlay vs outgoing page | Committing, `/slow` (400 ms server) with `waitFor: 'settled'` |
|---|---|---|---|
| Chromium 1255 headless (1x) | 0.1147 % / worst block 4.0 % | 0.1025 % | 412 ms |
| WebKit 2388 (2x) | 0.0021 % (raw 0.1095 %) / 0.0 % | 0.2777 % (raw 0.6243 %) | 525 ms |

Visual check (headless Chromium screenshots, motion frozen at 450 ms): Home to `/slow` breaks the Home page over the loaded Slow page (not its `loading.tsx` UI); back from `/slow` breaks the Slow page over Home. No console errors.

Milestone 6, **PR #6 CI (GitHub Actions ubuntu-latest)**, Next.js example, 2026-11-15:

| Browser | First frame, top of `/` | Back: overlay vs outgoing page | Committing, `/slow` with `waitFor: 'settled'` |
|---|---|---|---|
| Chromium headless (1x) | 0.1566 % / worst block 4.0 % | 0.1347 % | 424 ms |
| Firefox headed (xvfb, Mesa) | 0.0000 % / 0.0 % | 0.0000 % | 435 ms |
| WebKit (2x) | 0.1453 % (raw 0.3166 %) / 0.9 % | 0.0311 % (raw 0.1314 %) | 418 ms |

Milestone 7, every effect (`e2e/vanilla/effects.spec.ts`, `/effects` page of the vanilla example, 400 ms motion), local Windows 11, 2026-11-15:

| Browser | Fractured page at rest (first frame), each of shatter / explode / implode / flip / assemble | Last frame vs live page: flip / assemble |
|---|---|---|
| Chromium 1255 headless (1x) | 0.0936 / 0.0898 / 0.0843 / 0.0901 / 0.0868 %, worst block 0.0 % | 0.1647 % / 0.2615 % (worst block 4.2 %) |
| WebKit 2388 (2x) | 0.0225 % each (raw 0.3952 %, worst block 6.1 %) | 0.0000 % / 0.0001 % (raw 0.1281 %) |

Incoming-page capture (Chromium, local, parallel workers): flip 45 ms, assemble 181 ms. Visual check: headless screenshots of each effect at 250 and 550 ms (explode stretch and blast, implode spiral, flip backs showing the new page, assemble fly-in), no console errors.

Milestone 7, **PR #7 CI (GitHub Actions ubuntu-latest)**, every effect, 2026-11-15:

| Browser | Fractured first frame (shatter / explode / implode / flip / assemble) | Last frame: flip / assemble |
|---|---|---|
| Chromium headless (1x) | 0.1176 / 0.1187 / 0.1194 / 0.1185 / 0.1176 %, worst block 0.0 % | 0.1824 % / 0.2387 % (worst block 4.2 %) |
| Firefox headed (xvfb, Mesa) | 0.0000 % each | 0.0000 % / 0.0000 % |
| WebKit (2x) | 0.0187 % each (raw 0.2735 %, worst block 4.2 %) | 0.0023 % / 0.0023 % (raw 0.0419 %) |

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

### Debug panel (Milestone 10, section 10, ADR-041)

Screenshot: `context/screenshots/m10-debug-panel.jpg` (installed Chrome headed, RTX 4050, after a `shatter` transition with 160 shards and a tab-capture seam check). The panel showed capture 9 ms, cover 78 ms, wait 25 ms, animate 1201 ms, 160 shards (5.3 ms), tier high, 60.0 fps (worst 17 ms), draw calls 1.00 per frame, textures 0.

| Seam check mode | Where | Result |
|---|---|---|
| capture vs overlay (no screen capture) | headless Chromium, WebKit (e2e) | 0.000 % |
| tab capture (`getDisplayMedia`, auto-accepted with `--auto-accept-this-tab-capture`) | Chrome headed, Windows 11, window 1440x870 after the sharing bar, stream 1788x1080 | 1.131 %, all on text edges (ClearType live vs grayscale capture, ADR-009, plus the stream's scaling) |

### Glass shading review (Milestone 9)

Same frames before (commit `f7a764d`) and after, headless Chromium 1255, 1280x720, `/effects?seed=7&shards=90&duration=1000`, same click point, motion frozen with `setMotionTime` (script `coverage/m9/shading-shots.mjs`, not in the repo):

- `context/screenshots/m09-shatter-before-after.jpg` (260 ms): before, flat dark shards; after, a bright rim along every cut edge, tinted side faces, a soft glint on shards turning toward the light, and red/blue fringing on fast-moving text.
- `context/screenshots/m09-explode-before-after.jpg` (200 ms): the same, with stronger fringing (faster shards).
- `context/screenshots/m09-flip-before-after.jpg` (380 ms): turning shards show lit edges and a glint; the edges fade to nothing as each shard settles (the last-frame seam is unchanged).
- `context/screenshots/m09-before-after-sheet.jpg`: all three, full frame.

PR #9 CI seams after the shading are identical to the PR #7 CI values (Chromium first 0.1176–0.1194 %, last flip 0.1824 % / assemble 0.2387 %; Firefox 0.0000 % everywhere; WebKit first 0.0187 %, last 0.0023 %). Seams after the shading (local Windows 11), identical to Milestone 7: Chromium first frames 0.0843–0.0936 %, last frames flip 0.1647 % / assemble 0.2615 %; WebKit first 0.0225 %, last 0.0000 % / 0.0001 %.

### Physics (Milestone 8, Rapier 0.21.0)

| Date | Runtime | Measurement |
|---|---|---|
| 2026-11-15 | Node 24.21.0, RTX 4050 / 12-core laptop (`test/rapier.bench.test.ts`) | one frame (step + transform write), 160 shards: no floor median 0.49 ms (p95 1.93), floor median 1.40 ms (p95 2.64) |
| 2026-11-15 | Headless Chromium 1255, local, 2 workers | `shatter` with Rapier, 160 shards, 800 ms: 20 frames, 23.2 fps (software GL, not the 60 fps target device) |
| 2026-11-15 | Playwright WebKit 2388, local | same: 10 frames, 11.0 fps |
| 2026-11-15 | Vite build of `examples/vanilla` | Rapier chunk 4,335.5 kB (1,670.6 kB gzip), lazy; the example's main chunk 13.7 kB |
| 2026-11-15 | **PR #8 CI**, GitHub Actions ubuntu-latest, Node 24.22.2 | one frame, 160 shards: no floor median 0.70 ms (p95 6.98), floor median 1.91 ms (p95 4.32) |
| 2026-11-15 | PR #8 CI, e2e Rapier `shatter` (CI tier: 40 shards, 800 ms, software GL, parallel workers) | Chromium 6 frames (6.1 fps), Firefox 26 frames (30.9 fps), WebKit 7 frames (6.9 fps) |

Visual check (headless Chromium): without a floor, shards tumble and collide while falling; with `floor: true` they pile along the bottom edge (0.9 s) and lie there (2.0 s) before fading.

### Memory (section 9: 100 consecutive transitions)

| Date | Runtime | Result |
|---|---|---|
| 2026-11-15 | Headless Chromium (CDP heap after forced GC), 40 shards, 60 ms motion | heap 3.02 MB → 3.14 MB (+119 kB) after 100 transitions (10 warm-up first); live GPU textures after every transition: 0 |
| 2026-11-15 | PR #4 CI (ubuntu-latest), same test | heap 3.02 MB → 3.13 MB (+117 kB); textures 0 |

### Performance budgets (Milestone 10, section 8; `e2e/vanilla/performance.spec.ts`, ADR-040)

Real GPU: `SHATTER_PERF=1 npx playwright test e2e/vanilla/performance.spec.ts --project=chromium --workers=1` runs installed Google Chrome headed (`channel: 'chrome'`). Renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 4050 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)`, Windows 11, 1440x900, `/effects`, 160 shards, `seed=7`, second run after an in-document warm-up (2026-11-15):

| Effect | Frames / ms | fps | Worst frame | Capture | start→covered | covered→animating | Draw calls per frame | Long tasks outside capture |
|---|---|---|---|---|---|---|---|---|
| shatter | 62 / 1016 | 60.0 | 17.1 ms | 22.7 ms | 55 ms | 34 ms | 1 (76 frames) | none |
| explode | 68 / 1116 | 60.0 | 17.1 ms | 22.0 ms | 55 ms | 33 ms | 1 (82 frames) | none |
| implode | 61 / 1000 | 60.0 | 17.0 ms | 23.5 ms | 55 ms | 33 ms | 1 (75 frames) | none |
| flip | 63 / 1033 | 60.0 | 17.0 ms | 21.4 ms | 55 ms | 91 ms (incoming capture) | 1 (79 frames) | none |
| assemble | 75 / 1233 | 60.0 | 17.0 ms | 20.7 ms | 53 ms | 88 ms (incoming capture) | 1 (90 frames) | none |

- **Draw calls:** every `clear` is followed by exactly one draw call, from the intact quad and the crack to the last shard frame, on Chromium, WebKit (and Firefox in CI).
- **Allocations per frame** (exact CDP allocation tracking, `e2e/alloc.ts`, ADR-040; headless Chromium, 3 runs × 5 effects, 3 s motion): **0 B beyond boxed numbers** for `shatter`, `implode`, `flip`, `assemble` in every run. `explode` measured 0, 176 and 576 B over 31–57 frames (padding noise in its offset maths, ≤ 15 B per frame). A planted 44 B object per frame measured 1072–1664 B (31–32 B per frame) and failed. The first attempt, the sampling profiler, had reported 0 samples while two per-frame allocations existed in unoptimised code. Both are fixed: the array destructuring in `draw()` (35 B per frame) and `for...of` plus a tuple per shard in the effects' `isComplete`. Rapier mode: our simulation allocates nothing (indexed loops since M10), but Rapier 0.21's getters and `World.step` do: Node probe, 160 shards: 20 000 `write()` calls → 25 scavenges, the same as the 3.2 M `translation`/`rotation`/`linvel` calls they make (9 + 12 + 6); 2 000 `world.step()` → 12.
- **Textures:** `textureCount()` 0 after every `end` (also the 100-transition memory test).
- **Capture:** 20.7–23.5 ms on `/effects` at 1440x900 (budget 120 ms on the docs landing page: re-measure in M11).
- Headless Chromium (SwiftShader) for comparison: 31–34 fps for the falling effects, 13–15 fps for `flip`/`assemble`, long tasks 51–108 ms (software rasterising), draw calls still 1 per frame. Headless WebKit: 10.6–11.1 fps, no long tasks reported. These are environment limits, so CI prints the numbers without enforcing them.

### Docs site (Milestone 11, `apps/docs`, ADR-042/043)

**Capture on the docs landing page**, 1440x900, installed Chrome 157 headed on the RTX 4050 (`SHATTER_PERF=1 npx playwright test e2e/docs/landing.spec.ts --project=chromium --workers=1`; one pointer move, 1 s, then three hero clicks), 2026-11-15:

| Build | Captures (ms) | Notes |
|---|---|---|
| First version (Newsreader with `opsz`, no priming) | 164.4 / 91.5 / 51.3; 170.5 / 92.6 / 51.2 | cold first capture over budget |
| + priming capture on first intent (ADR-043) | 98.4 / 95.9 / 54.8; 118.4 / 205.7 / 134.2; 102.1 / 161.5 / 112.3 | heavy fonts still inlined into every capture |
| + Newsreader without `opsz`, light preloads (final) | 82.3 / 83.7 / 50.6; 86.3 / 78.6 / 52.7; 87.9 / **156.2** / **129.1**; 86.0 / 81.3 / 50.5 | 10 of 12 ≤ 120 ms, median 82 ms |

Probe (`coverage/capture-probe.mjs`, before the font change): with web fonts blocked, captures took 146.6 / 61.2 / 47.5 ms, against 163.2 / 100.3 / 53.5 ms with them. A CPU profile of the cold capture: 133 ms "(program)" (native style and SVG raster), 24 ms `getPropertyValue`, 21 ms `texImage2D`.

Headless (software GL), first-frame seam on the landing page: Chromium 0.0008 %, WebKit 0.0000 % (raw 0.1168 %). Captures: Chromium 105–199 ms, WebKit 74–221 ms (before priming, software).

**Lighthouse 12.6.0, mobile** (simulated slow 4G, 4× CPU), production build on localhost, installed Chrome 157:

| Page | Performance | Accessibility | LCP | TBT | CLS |
|---|---|---|---|---|---|
| `/` | 97 (97) | 100 | 2.5 s | 20–30 ms | 0.001 |
| `/effects` | 97 (97) | 100 | 2.5 s | 70–80 ms | 0 |
| `/effects/flip` | 97 | 100 | 2.5 s | 30 ms | 0 |
| `/playground` | 97 | 100 | 2.5 s | 90 ms | 0.002 |
| `/docs` | 97 | 100 | 2.5 s | 30 ms | 0 |
| `/docs/getting-started` | 97 | 100 | 2.5 s | 40 ms | 0.004 |
| `/docs/api` | 97 | 100 | 2.5 s | 30 ms | 0.002 |
| `/docs/custom-effects` | 97 | 100 | 2.5 s | 20 ms | 0 |
| `/docs/performance` | 99 | 100 | 2.0 s | 30 ms | 0.002 |

The way there: the first run scored 96/94 Performance, with Accessibility 86 on the playground (Tweakpane's inputs had no names). Splitting the italic and dropping its preload made pages with italic above the fold score 94 (LCP 3.0 s against 2.5 s). Inlining CSS changed little. Removing italic text above the fold gave 97 everywhere.

### Navigation memory (Milestone 13, 2026-11-20)

Seams of the reversed effects (Back, `backForward: 'mirror'`), local Windows 11, headless, % of pixels differing (target ≤ 0.5 %):

| Test | Chromium | WebKit |
| --- | --- | --- |
| vanilla `shatter:reverse` first frame (page being left) | 0.1706 | 0.0000 (raw 0.1281) |
| vanilla `shatter:reverse` last frame (page returned to) | 0.1082 | 0.0225 (raw 0.3952) |
| vanilla `explode:reverse` first frame | 0.1667 | 0.0000 (raw 0.1281) |
| vanilla `explode:reverse` last frame | 0.1006 (10.1113 before the stretch ramp) | 0.0225 (raw 0.3952) |
| React Router `shatter:reverse` last frame | 0.1313 | 0.0021 (0.5316 with WebKit's focus ring, see LEARNINGS) |
| Next `shatter:reverse` last frame | 0.1318 | 0.0021 |

Every falling effect (`shatter`, `explode`, `implode`) plays reversed on Back and replays on Forward with no fallback; the docs playground keeps its settings through Back and a reload.

### Effect architecture (Milestone 14, 2026-11-20)

- **Sizes:** the engine chunk went from 20.05 kB to an 11.45 kB core plus lazy parts (table above). A page that only plays `shatter` loads 11.45 + 1.01 + 8.19 = 20.65 kB of engine code, the same as before; each further effect adds about 1 kB instead of all five being in the first load.
- **No regression (local, Chromium + WebKit, full suite 245 passed / 15 skipped before the new tests):** every first- and last-frame seam is identical to M13 to four decimals (e.g. Chromium first-shatter 0.0936 %, last-flip 0.1647 %, last-explode-reverse 0.1006 %); draw calls per frame 1 for every effect; allocations beyond boxed numbers 0–16 B per run; fracture 160 shards median 0.80 ms.
- **Compositions:** the vanilla example's `sweep` (shatter's motion, linear stagger) plays, lands and reverses on Back; first-frame seam 0.0831 % Chromium, 0.0272 % WebKit. The docs playground's stagger control plays `shatter stagger=linear`.

### Firefox at fractional scroll positions (Milestone 14, ADR-049, 2026-11-21)

Found by PR #16 CI. First-frame seam, Firefox CI (Linux), vanilla `/work` scrolled to a fractional offset:

| Offset | Before (copy shifted by the exact offset) | Round to nearest (attempt) | Round down (attempt) | Settle scroll first (fix, `3066a9a`) |
| --- | --- | --- | --- | --- |
| 240.25 px | 1.2982 % | 0.0534 % | 0.0304 % | 0.0000 % |
| 240.5 px | 1.0407 % | 2.3102 % | 2.3102 % | 0.0000 % |
| 240.75 px | 0.1301 % (worst block 10.4 %) | 0.0809 % (worst block 10.4 %) | 2.3102 % | 0.0000 % |
| DPR 2, 240.25 / 240.75 | 0.0000 % (shift radius 1) | — | 0.0000 % | 0.0000 % |

Chromium and WebKit report whole-pixel scroll offsets (`scrollTo(0, 240.5)` gives 240 or 241), so the fix does nothing there; their seams are unchanged. Local full suite (Chromium + WebKit) on the fix: 271 passed, 15 skipped; Chromium alone 143 passed.

### Shatter vs explode (Milestone 16 part 1, 2026-11-22, ADR-054; PR #19 merged `91b83d4`, CI green on all three engines, local 321 passed)

- **Side by side (frozen frames at 40 / 180 / 420 ms, vanilla example, Chromium):** `shatter` shows the full crack web over the intact page, then pieces dropping near the impact, then a cascade of falling glass; `explode` shows a white flash and a spider web bursting toward the viewer, then pieces flung past the camera with motion stretch, then almost nothing left.
- **Unit:** blast vs fall speeds ≥ 5× apart in the screen plane and in depth; `shatter` has no upward kick.
- **E2E (local):** seams unchanged (Chromium first-explode 0.0905 %, last-explode-reverse 0.0951 %, first-shatter 0.0936 %); allocations 0 B beyond boxed numbers for both (shatter was 640 B before reusing the crack frame); `explode` 159 of 160 pieces with the radial web (101 before the count aiming); one draw call per frame.
- **Radial/rings fracture time with count aiming:** 2.43 / 1.84 ms at 400 pieces (budget 4 ms).

### Materials and easing (Milestone 16 part 3, 2026-11-22, ADR-057, ADR-059)

- **Sizes:** engine core 13.36 kB (was 11.78; budget 15): material table, resolver, material shader, easing; core entry 1.95 kB (budget 6); motion chunks 0.54–1.74 kB.
- **Motion at t = 0 per material** (`zero-probe`, headless Chromium, 960×600, `explode`): before hiding resting side faces glass 0.0958 %, paper 0.7807 %, metal 0.7774 %; after, every material 0.0830 %.
- **E2E per material** (`motions.spec.ts`): t = 0 vs live page Chromium 0.1051 %, WebKit 0.0021 %; Back's reverse last frame Chromium 0.1010 %, WebKit 0.0021 %; all seven land with no fallback.
- **Real GPU** (RTX 4050 forced, installed Chrome 157, 1440×900, 161 pieces, `explode`): glass 144.4, ice 144.1, mirror 135.9, obsidian 143.4, paper 142.8, metal 144.5, holo 139.8 fps; no long tasks outside capture.
- **Review:** frozen frames of every material at 0 / 160 / 300 ms (`coverage/m16/material-shots.mjs`): ice clouds the faces, mirror reflects a sky, obsidian darkens with a hard glint, paper has white edges and no shine, metal shows brushed streaks, holo has thin-film colours.

### Motion families (Milestone 16 part 2, 2026-11-22, ADR-055)

- **Chunks (gzip, budget 2 kB each):** crumble 953 B, rain 892 B, vortex 1.09 kB, wind 916 B, blinds 538 B, domino 743 B, slide 757 B, fold 802 B, melt 812 B, ripple 772 B, glitch 979 B; engine core 11.78 kB (budget 15).
- **Motion frozen at t = 0 vs the live page** (`motions.spec.ts`, local): Chromium 0.0991–0.1507 % for all 16 effects (worst block ≤ 4.0 %); WebKit 0.0021–0.0023 %.
- **Back's reverse, last frame vs the page returned to:** Chromium 0.1147–0.1494 %, WebKit 0.0021–0.0024 % for all 14 reversible motions. `glitch:reverse` was 8.9908 % (Chromium) / 8.4958 % (WebKit) before the wrapper ran fragment chunks at the reversed time.
- **Draw calls and allocations** (headless Chromium, `performance.spec.ts`): 1 draw call per frame for all 16 effects; 0 B beyond boxed numbers in the frame loop for every motion (28–90 frames per run, 3 s motion).
- **Real GPU** (installed Chrome 157 headed, RTX 4050 forced with `--force_high_performance_gpu`, 1440×900, 160 pieces, 144 Hz display): crumble 144.1, rain 141.6, vortex 142.6, wind 135.0, blinds 129.4 (25 strips), domino 141.7, slide 143.1, fold 144.1, melt 142.7, ripple 144.1 (152 pieces), glitch 144.0 fps (168 pieces); no long tasks outside capture for any new motion. On the Intel UHD iGPU (Chrome's own pick that run): 50.8–88.4 fps.
- **Completion from a remembered last-visible time (ADR-058):** PR #20's push CI measured `shatter` 640 B beyond boxed numbers (160 × 4 B of padding); after the change, local Chromium 12 of 12 runs at 0 B for shatter/explode/crumble/rain, `explode` 1,000–1,057 boxed numbers per run (was 5,000–6,700); every effect's allocation limit is 400 B again.
- **All 16 effects on the RTX 4050 (after ADR-056):** 143.0–144.3 fps, no long tasks outside capture; `flip`/`assemble` have one 74–76 ms task inside their incoming capture (83 ms).
- **Capture drift, interleaved A/B (`coverage/m16/ab-perf.sh`, same spec, same machine):** `m15-patterns` build: round 1 captures 21–29 ms with no long tasks, later rounds 40–72 ms with 50–139 ms tasks in the incoming capture; this branch: 47–88 ms, the same tasks. With this branch's 11 extra example links removed both builds measure alike, so the motion code does not change capture time; the machine warms up (ADR-056).

### Fracture patterns (Milestone 15, 2026-11-22, ADR-053)

- **Chunks (gzip):** radial + rings 1.40 kB, triangles 1.26 kB, hex 1.05 kB, tiles + bricks + strips 1.36 kB (budget 2 kB each); engine core 11.55 kB.
- **Fracture time, 400 pieces at 1440×900 (Node, median of 15):** impact 1.69 ms, radial 0.99, rings 1.20, triangles 0.90, hex 1.74, bricks 1.05, tiles 0.95, strips 0.10 ms (budget 4 ms: no worker needed).
- **Pieces at the mid tier (90 requested, 960×600 example):** radial 80, rings 72, triangles 154, hex 186, bricks 168, strips 25.
- **First-frame seams per pattern (vanilla, fractured at rest):** Chromium 0.0991–0.1069 %, WebKit 0.0021 % for every pattern.

### Site redesign "Material lab" (Milestone 19, 2026-11-21/22, ADR-050–052)

- **Capture of the docs landing (1440×900).** Headless Chromium, median of 7 warm captures: old site on the old library 70–91 ms; redesign on the old library 184 ms; + font pruning 147; + no custom properties 109–121; + decoration without pseudo-elements or letter spans 69–78; old site on the new library 46 ms. GPU (installed Chrome, RTX 4050), after the below-the-fold pruning: 3-capture medians 75.9 / 74.9 / 78.6 ms (old site 82 ms, budget 120); 7 warm captures median 51 ms; the first capture after load 103–123 ms.
- **Seams:** docs landing first frame light 0.0099 % / dark 0.0063 % (Chromium), 0.0024 / 0.0023 % (WebKit), no bad block (before M19: 0.0239 %). Every vanilla, React Router and Next seam unchanged to four decimals.
- **Fonts:** Bricolage Grotesque latin 41 kB (preloaded) and Martian Mono latin 23.5 kB, against Newsreader 58 kB plus a 64 kB italic before.
- **Lighthouse 12.6.0 mobile, local production build, interleaved with the old site under the same (noisy) machine load:** accessibility 100 on every page (after raising `--faint` to 4.5:1). Performance comparable to the old site on the home page (old 90–92, new 85–93); the long docs pages paint later (`/docs/api` simulated LCP 2.7 s against 1.9 s; observed first paint 400–540 ms against 230–300 ms), from the larger stylesheet, which Next ships twice (inline `<style>` and the RSC payload: 22.6 kB against 14.5 kB). The machine's load made absolute scores unreliable (the old site, published at 97, scored 69–94); the definitive run is on production after the merge.
- **Lighthouse 12.6.0 mobile on production after the merge (`0091427`, quiet machine):** `/` 98/100, `/effects` 96/100, `/effects/flip` 96/100, `/playground` 97/100, `/docs` 100/100, `/docs/getting-started` 96/100, `/docs/api` 99/100, `/docs/custom-effects` 97/100, `/docs/performance` 97/100 (performance/accessibility); LCP 1.4–2.6 s, TBT 20–170 ms, CLS 0. Acceptance (≥ 95 / 100) met.
- **PR #17 CI** found two Firefox console warnings on the docs site: the capture sandbox's layout forced while it loaded (fixed: the sandbox is `display: none`, every seam unchanged) and the glass rail's "scroll-linked positioning effect" note (inherent; allowed for the docs origin). Final CI on `b61c4e4`: Chromium, Firefox and WebKit green.
- **Found and fixed during M19:** a zero-sized button crack layer drawn in captures (worst block 6.1 %), a headline reveal that delayed the largest paint by 3.1 s, a layout shift from the mono font (CLS 0.279 → ≤ 0.02), contrast of faint labels (3.85:1 → ≥ 4.71:1), captures taken while the first-load entrance or a font was still loading.

### Release readiness (Milestone 12, 2026-11-20)

- **Package:** `shatter-router@0.1.0` (Changesets: first-release changeset → `CHANGELOG.md`). `npm pack --dry-run`: 49 files, 187.4 kB packed, 705.7 kB unpacked (`dist` with source maps, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json`). Not published to npm: publishing is the user's call (`pnpm release`).
- **README demo:** `media/shatter-demo.gif`, 640x400, 33 frames at ~30 fps, 2.05 MB (`scripts/record-demo.mjs`: installed Chrome on the GPU, DevTools screencast, `gifenc`).
- **Final full run (local, Windows 11):** build, typecheck, lint, format, 335 unit tests, every size budget (core 1.8, react 2.57, react-router 4.14, next 4.28, rapier 0.263, rapier-backend 1.44, runtime 7.76, debug 3.44, engine 19.81, capture 12.6 kB), e2e Chromium + WebKit 225 passed, 15 skipped.
- **Deployment (ADR-045):** https://shatter-router.vercel.app (Vercel project `shatter-router`, built remotely from the monorepo root). All routes 200 (unknown → 404 page). Live in installed Chrome 157 on the GPU (`coverage/live-check.mjs`): hero `assemble`, navigation `shatter` and the custom `ripple-out` played; captures 79.1–80.9 ms; 136–144 fps (144 Hz display); no console errors. One of three cold runs reported a `capture-budget` fallback (not reproduced). **Lighthouse 12.6.0 mobile on the live site:** `/` 99 / 100 (LCP 1.1 s, TBT 120 ms), `/effects` 100 / 100, `/docs/getting-started` 99 / 100, `/playground` 100 / 100 (Performance / Accessibility).

### Definition of done (section 15), checked 2026-11-20

| Item | State |
| --- | --- |
| All 13 milestones complete, with measured numbers | Yes: M0–M12 merged and tagged (`m12-release` on `9e2777a`, PR #12, 2026-11-20) |
| A merged PR and a pushed tag per milestone, every branch kept | PRs #1–#12 merged with `--merge`, tags `m00-setup` … `m12-release`; no branch deleted |
| Context files current, a fresh session could continue from them | Yes (HANDOFF, PROGRESS, DECISIONS ADR-001..045, LEARNINGS) |
| CI green: typecheck, lint, unit, e2e on three engines, size-limit | Yes on every merged PR (PR #11 final run: Chromium, Firefox, WebKit) |
| Seam tests pass for every effect | Yes: first frame for all five built-ins, last frame for `flip`/`assemble`, the docs landing page |
| Every effect works in the vanilla, React Router and Next.js examples | Yes (`e2e/vanilla/effects.spec.ts`, `e2e/react-router/transitions.spec.ts`, `e2e/next/transitions.spec.ts`) |
| Navigation always completes when every optional feature fails | Yes (`e2e/vanilla/fallbacks.spec.ts`: no WebGL, reduced motion, capture over budget, strict CSP; unit tests for every fallback reason) |
| README: GIF of `shatter` on the docs site, 3-line quick start, features, real numbers, browser support, roadmap | Yes |
| Nothing stubbed, mocked in production code, or marked TODO | Checked with `git grep -nE "TODO|FIXME|XXX"` over `packages apps examples` (no hits) |

### Not measured yet

Nothing from sections 8 and 13 is left. Re-run Lighthouse and the landing capture when the site changes.

## Test counts

| Milestone | Unit | E2E |
| --- | --- | --- |
| 1 | 39 tests in 4 files | 6 tests per engine (vanilla navigation). PR #1 CI: Chromium, Firefox, WebKit all green (Linux). Local Windows 11: Chromium + WebKit green, Firefox cannot launch (see LEARNINGS) |
| 2 | 68 tests in 7 files | 10 tests per engine (6 navigation + 4 seam/overlay) + 4 seam-metric tests (Chromium project). Local: Chromium + WebKit 20/20 + 4/4. PR #2 CI: all three engines green |
| 3 | 99 tests in 10 files (+ fracture 23, crack 7, fracture timing 1) | 15 tests per engine (6 navigation, 7 seam/crack/wireframe, 1 fracture timing, 1 cleanup) + 6 seam-metric tests. Local: Chromium + WebKit 36/36 |
| 4 | 218 tests in 13 files (state machine 47 incl. every interruption, machine table 70, effect 7, frame loop 6) | per engine: effect 7, interruptions 6, fallbacks 4 (reduced motion, budget, strict CSP, no WebGL), history 1, lab 1, memory 1 (Chromium) + earlier suites. Local: Chromium + WebKit 73 passed, 9 skipped (engine-specific), CSP fixme on Windows WebKit. PR #4 CI: all three engines green (strict-CSP test passes on Linux WebKit) |
| 5 | 257 tests in 16 files (+ `react.test.tsx` 24, `react-router.test.tsx` 13, `standard-font.test.ts` 2) | React Router example: 9 navigation + 7 transitions/seam per engine. Local: Chromium + WebKit, full suite 105 passed, 9 skipped. PR #5 CI: Chromium 57 passed, Firefox 49 passed, WebKit 49 passed (engine-specific skips) |
| 6 | 266 tests in 17 files (+ `next.test.tsx` 9); after the M6 follow-up fixes on `milestone/07-effects`: 272 in 18 (+ `route-bridge.test.ts` 6) | Next.js example: 11 navigation + 6 transitions/seam per engine. Local: Chromium + WebKit, full suite 139 passed, 9 skipped. PR #6 CI: Chromium 74 passed, Firefox 66 passed, WebKit 66 passed |
| 7 | 301 tests in 20 files (+ `effects.test.ts` 29: spring, every effect, incoming capture and substitution, `settled` pause, backForward) | + `e2e/vanilla/effects.spec.ts` 13 per engine (each effect plays, fractured first frame per effect, last-frame seams for flip/assemble, back = assemble). Local: Chromium + WebKit, full suite 165 passed, 9 skipped. PR #7 CI: Chromium 87 passed, Firefox 79, WebKit 79 |
| 8 | 311 tests in 22 files (+ `rapier.test.ts` 8 with the real Rapier WASM, `rapier.bench.test.ts` 2) | + `e2e/vanilla/rapier.spec.ts` 4 per engine (Rapier shatter, floor pile, flip stays procedural, CSP without wasm-unsafe-eval stays procedural). Local: Chromium + WebKit, full suite 173 passed, 9 skipped. PR #8 CI: Chromium 91 passed, Firefox 83, WebKit 83 |
| 9 | 318 tests in 23 files (+ `shading.test.ts` 7: tint parsing, fade-in, aberration, shader gates, options) | unchanged suites; every first/last-frame seam identical to M7. Local: Chromium + WebKit, full suite 173 passed, 9 skipped. PR #9 CI: Chromium 91 passed, Firefox 83, WebKit 83 |
| 10 | 331 tests in 25 files (+ `glsl-minify.test.ts` 6: token streams of every built-in shader, interpolation boundaries, line counts; `debug.test.ts` 7: diff, panel on/off, rows, wireframe, seam check, transitions waiting) | + `performance.spec.ts` (draw calls per frame for each effect on every engine; allocations for each effect plus Rapier report-only, Chromium) and `debug-panel.spec.ts` (4). Local: Chromium + WebKit 197 passed, 15 skipped; every seam unchanged. PR #10 CI (final run): Chromium 106 passed, Firefox 92 (14 skipped), WebKit 92 (14 skipped); CI allocations beyond boxed numbers: 0 B for shatter, implode, flip, assemble and 96 B for explode over 18–34 frames |
| 11 | 335 tests in 26 files (+ `prime.test.ts` 4: one priming capture on the first intent and disposed, none after a transition, none with reduced motion, none after destroy) | + `e2e/docs/site.spec.ts` (every page with no console errors, header navigation with focus, every gallery card with its own effect incl. the custom `ripple-out`, the hero breaking in place, the playground panel/stage/copy, the 404 page) and `e2e/docs/landing.spec.ts` (landing seam, landing capture time). Local: Chromium + WebKit 223 passed, 15 skipped. PR #11 CI (final run, after the sandbox fix ADR-044): green on Chromium, Firefox (105 passed, 14 skipped) and WebKit |
| 12 | 335 tests in 26 files (unchanged) | + `history.spec.ts`: a capture adds no history entry (ADR-044). Final local run: Chromium + WebKit 225 passed, 15 skipped |
| 13 | 361 tests in 26 files (+ `history.test.ts` 16: memory, Back/Forward/`go(n)`, replace, cap, reload, storage failures, query rewrites, reverse wrapper GLSL; + 9 mirror tests in `effects.test.ts`; adapter tests assert `replace`) | + vanilla: each falling effect reversed and replayed, first- and last-frame seams of `shatter:reverse` and `explode:reverse`; React Router and Next: reverse, last-frame seam, replay (`e2e/mirror.ts`); docs: playground settings through Back and reload. Local: Chromium + WebKit 245 passed, 15 skipped (4 WebKit tests that hit a 26–53 min machine stall passed on rerun). PR #15 CI: Chromium, Firefox and WebKit green |
| 14 | 394 tests in 29 files (+ `composition.test.ts` 25: stagger orders, compositions, lazy part loaders, runtime handling; `snap-scroll.test.ts` 8) | + vanilla: `sweep` composition plays, lands, reverses, first-frame seam; first-frame seams at fractional scroll offsets (240.25/.5/.75, DPR 1 and 2); `scroll-snap.spec.ts` paint diagnostic (5 page variants); docs: playground stagger plays a composition. Local Chromium + WebKit 271 passed, 15 skipped. PR #16 CI (final, `3968e70`): Chromium, Firefox (129 passed, 14 skipped) and WebKit green |
| 19 | 405 tests in 31 files (+ `fonts.test.ts` 9: unicode-range parsing, subset pruning, pending faces; `sandbox.test.ts` 2) | + `e2e/docs/lab.spec.ts` (material switch plays a flip and persists, theme toggle persists, system dark followed, glass rail tracks/drags and keyboard scrolling works, entrances only on first load, a press ends the entrance, reduced motion) and landing seams in light and dark. Local Chromium + WebKit: docs 46 passed; seams/effects across all apps 112 passed |
| 15 | 454 tests in 32 files (+ `patterns.test.ts` 49: each pattern tiles exactly — convex cells, area, sample-point coverage over 400 seeded layouts — determinism, timing; clipper) | + `e2e/vanilla/patterns.spec.ts` (16 per engine: every pattern plays and lands, first-frame seam at rest); docs playground pattern test. Local Chromium + WebKit 320 passed, 15 skipped (1 load-sensitive Next timing test passed 5/5 alone). PR #18 CI: Chromium, Firefox and WebKit green |
| 16 (part 2) | 537 tests in 33 files (+ `motions.test.ts` 63: interface, layout, delays from order, gone by the end, wind/slide exits, hinges, reverse wrapper keeps pattern/stagger and reverses fragment time) | + `e2e/vanilla/motions.spec.ts` (60 per engine pair: motion at t = 0 for 16 effects, play + Back reverse last frame for 14); performance suite covers all 16. Full local run (Chromium + WebKit, 2 workers): 413 passed, 26 skipped, 1 failed: the load-sensitive Next `waitFor 'commit'` test (LEARNINGS), 5/5 passed alone |
| 16 (part 3) | 564 tests in 35 files (+ `materials.test.ts` 12, `easing.test.ts` 11, last-visible completion 4 in `motions.test.ts`) | + materials in `motions.spec.ts` (t = 0 and Back's last frame per material), docs: switcher sets the transition material, playground motion/easing/material. Full local run (Chromium + WebKit, 2 workers): 442 passed, 26 skipped, 0 failed |
