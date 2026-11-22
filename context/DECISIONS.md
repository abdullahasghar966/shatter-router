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

## ADR-006 — `createShatter` arrives in Milestone 2 with a cover → commit → reveal pipeline

- **Date:** 2026-11-14
- **Status:** accepted (the pipeline is replaced by the full state machine in Milestone 4)
- **Context:** Milestone 2 needs a way to put the intact page on the overlay and to run the first-frame seam test. The spec's full state machine, interruption rules and fallback chain are Milestone 4.
- **Decision:** Ship the real `createShatter()` now with the part of the pipeline that exists: capture → cover (intact quad) → `commit()` → two frames → reveal. Options so far: `captureBudget`, `debug`. Events: `start`, `covered`, `committed`, `end`, `fallback`, `error`. A second `transition()` while one runs commits immediately with fallback reason `busy`. Any failure falls back to a plain `commit()`. `window.__SHATTER_TEST__` (debug only) can pause at `covered`.
- **Alternatives considered:** a test-only harness page driving internal modules (would not exercise the public API and would be thrown away).
- **Consequences:** Until Milestone 4 a transition is visually an instant swap under cover. Interruption rules, focus handling, reduced motion, scroll lock and pre-capture are not implemented yet and are listed in `HANDOFF.md`.

## ADR-007 — The overlay covers the scrollbar-free visual viewport

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** Section 3.1 says to capture `[scrollX, scrollY, innerWidth, innerHeight]`. `innerWidth` includes a classic vertical scrollbar, which a fixed-position overlay can never cover, and it is an integer even under fractional browser zoom.
- **Decision:** Capture and cover `visualViewport.width × visualViewport.height` (scrollbar-free, fractional), falling back to `documentElement.clientWidth/Height`. When `visualViewport.scale ≠ 1` the effect is skipped (fallback reason `pinch-zoom`, section 3.8). The backing store is `round(size × min(dpr, 2))`, reduced uniformly if it exceeds `MAX_TEXTURE_SIZE`.
- **Alternatives considered:** `innerWidth/innerHeight` (overlay and texture would be one scrollbar wider than the area they cover, shifting every pixel).
- **Consequences:** The scrollbar stays live next to the overlay; apps should set `scrollbar-gutter: stable` (to be documented in the README, section 3.7).

## ADR-008 — How the viewport is captured with modern-screenshot

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** modern-screenshot 4.7.0 clones a node into an SVG `<foreignObject>`. A static clone has no scroll position, treats `position: fixed/sticky` wrongly, and paints the page background on a box instead of the canvas.
- **Decision:**
  1. Clone `document.documentElement` at its live size and **shift it with negative margins** equal to its live bounding-box offset (`margin-left/top = rootRect.left/top`). The SVG is exactly viewport-sized with no `viewBox` offset, so the SVG viewport stands in for the real one and `position: fixed` elements need no correction.
  2. `position: sticky` elements are pinned (`position: fixed` at their live rect) and an invisible shallow copy keeps their place in the flow.
  3. Scrolled inner containers: children get `translate(-scrollLeft, -scrollTop)`; fixed/sticky descendants are corrected relative to the ancestor that becomes their containing block.
  4. The page background is rebuilt on the cloned root (body background moves to the root when `<html>` has none); `Canvas` is used when neither has one.
  5. Images and background images further than 128 px outside the viewport are not fetched.
  6. `view-transition-name` is stripped from every clone.
  7. Originals are paired with clones by treating the library's `filter` (called before a child is cloned) and `onCloneEachNode` (called after its subtree) as push/pop. If the pairing goes out of step the capture throws and the transition falls back.
  8. One library context is reused for the capturer's lifetime (caches default styles, fetched assets, fonts). We rasterise the SVG ourselves instead of using `domToCanvas`.
- **Alternatives considered:** SVG `viewBox` offset (works in Chromium; WebKit ignored it once an element carried `view-transition-name`, a 65 % seam diff); CSS `transform` on the root (makes the root the containing block of every fixed element); the library's `restoreScrollPosition` (would shift `<body>` for the window scroll and applies to text nodes inconsistently); a hand-written capturer (large, and the spec names modern-screenshot).
- **Consequences:** The pairing relies on modern-screenshot's traversal order, so the dependency must be bumped deliberately with the seam tests as the guard. Known gaps, to be handled with hard-to-capture content in Milestone 4: `background-attachment: fixed`, background images on pages shorter than the viewport, sticky elements that also have a transform, fixed elements that are direct children of a scrolled container.

## ADR-009 — The capture canvas is opaque and CPU-backed

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** On Windows, live Chromium draws small text with ClearType (LCD sub-pixel) antialiasing. A capture drawn onto a canvas with an alpha channel used grayscale antialiasing: 0.54–0.70 % of pixels differed and text visibly changed weight at the swap.
- **Decision:** Create the 2D capture canvas with `{ alpha: false, willReadFrequently: true }`. An opaque destination lets the engine keep LCD antialiasing when it rasterises the SVG; CPU backing avoids a GPU read-back when the canvas is uploaded with `texImage2D`. The canvas is pre-filled with the page background colour.
- **Alternatives considered:** accepting the difference and loosening the seam threshold (the spec says to investigate first); fading the overlay in (hides, not fixes).
- **Consequences:** Seam diff on Windows Chromium dropped to 0.06–0.22 %. The snapshot is always opaque, which matches a page capture.

## ADR-010 — The copy's layout grid is chosen per engine

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** At device pixel ratio 2, WebKit drew everything below a fractional-height element one device pixel lower in the overlay than in the live page. Laying the copy out in device pixels (CSS `zoom: <scale>` on the cloned root, SVG sized in device pixels) fixed WebKit (0.12–0.24 %) but moved text lines by one device pixel in Chromium (0.06 % → 0.59 %). A canvas probe cannot tell the engines apart: both snap boxes to whole CSS pixels inside an SVG image; they differ in how the *live page* rounds, which cannot be read back.
- **Decision:** `layoutGrid = navigator.vendor.startsWith('Apple') ? 'device' : 'css'`. `device` applies `zoom`; `css` lays out in CSS pixels and lets `drawImage` scale.
- **Alternatives considered:** `zoom` everywhere (breaks Chromium); none anywhere (breaks WebKit); user-agent string parsing (Chrome on iOS is WebKit but says CriOS; `vendor` is `Apple Computer, Inc.` on every WebKit browser).
- **Consequences:** An engine check lives in the capturer. Firefox uses `css` until CI shows otherwise. The value is visible in debug mode as `__SHATTER_TEST__.layoutGrid()`.

## ADR-011 — Lazy chunks are build entries with stable names; bundle budgets

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** size-limit bundles an entry with everything it imports, dynamic imports included, so the 6 KB core check counted the renderer and modern-screenshot.
- **Decision:** `src/engine/index.ts` and `src/capture/index.ts` are tsup entries (`dist/engine.js`, `dist/capture.js`), loaded by the core with `import('./engine.js')` / `import('./capture.js')`. They are not in the package `exports`. size-limit (gzip): core ≤ 6 KB with the two lazy files ignored, engine ≤ 22 KB (spec), capture ≤ 16 KB. The spec sets no number for the capture chunk; 16 KB is our own ceiling above the measured 10.74 KB (modern-screenshot included).
- **Alternatives considered:** `@size-limit/file` on the built files (would not count external dependencies such as d3-delaunay inside the engine budget).
- **Consequences:** Three file names in `dist/` are part of the internal contract between chunks.

## ADR-012 — Cover order and frame waits

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** Section 4.4 says to draw the intact quad, wait one animation frame, then show the overlay. A canvas inside a closed popover is `display: none`, and whether its drawing buffer survives until it is first composited differs between engines.
- **Decision:** Show the (still transparent) overlay, draw, wait a frame, draw again, wait a frame, then report `covered`. A transparent overlay is harmless because the DOM beneath is the very page the snapshot shows; nothing may change in the DOM until `covered`. Every frame wait races `requestAnimationFrame` against a 120 ms timer, because hidden tabs and unpainted panes stop producing frames and navigation must never hang.
- **Alternatives considered:** the literal order from the spec (risk of one blank frame on engines that drop an undisplayed canvas' buffer).
- **Consequences:** `covered` arrives two frames (about 33 ms at 60 Hz) after the capture finishes.

## ADR-013 — E2E ignores one headless GL driver message

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** Section 11 requires no console errors or warnings in any test. Headless Chromium has no GPU compositor and reads each WebGL frame back from its software GL driver, which logs `GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels` as a console warning, even in tests where the page never calls `readPixels`. Chrome on a real GPU (RTX 4050, ANGLE D3D11) prints nothing.
- **Decision:** `e2e/fixtures.ts` filters exactly that message (regex in `ENVIRONMENT_NOISE`). Everything else still fails the test.
- **Alternatives considered:** `--use-angle=swiftshader --enable-unsafe-swiftshader` (the message stayed and captures got slower, tripping the capture budget); dropping the rule.
- **Consequences:** One narrowly scoped exception, documented next to the pattern.

## ADR-014 — Seam metric forgives sub-CSS-pixel glyph shifts at 2x

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** On Linux CI, headless Chromium at device pixel ratio 2 measured 0.82 % on the first-frame seam (Windows: 0.06 %). The diff image shows every text edge, and the crops show glyphs a fraction of a device pixel apart: Linux Blink positions glyphs differently when it rasterises the SVG copy than when it paints the live page. A spike branch (`spike/linux-layout-grid`, never merged) measured both layout grids on CI: `css` 0.82 %, `device` 0.97 %, so the layout grid is not the cause. Section 11 allows a "small tolerance" and says to investigate before loosening.
- **Decision:** `compareScreenshots` takes a `shiftRadius` in device pixels. A differing pixel is forgiven when its colour (±24 per channel) appears within that radius in the other image, checked in both directions. The seam tests pass `round(min(dpr, 2)) - 1`: 0 at 1x (nothing forgiven), 1 at 2x (half a CSS pixel). The threshold (≤ 0.5 %) is unchanged and applies to the forgiving number; the raw number is printed and recorded too. `e2e/seam-metric.spec.ts` proves a one-CSS-pixel shift at 2x still fails.
- **Alternatives considered:** raising the threshold (would hide real regressions everywhere); excluding text (would hide real layout bugs); per-platform thresholds (opaque).
- **Consequences:** At 2x, glyph placement differences below half a CSS pixel are not counted. Raw numbers stay visible in CI logs and `context/PROGRESS.md`.

## ADR-015 — Firefox e2e forces WebGL on

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** Headless Firefox on GPU-less Linux CI refuses WebGL2: `Failed to create WebGL context: WebGL creation failed: * AllowWebgl2:false restricts context creation on this system.` Every transition fell back, and the browser's own console warning failed every test.
- **Decision:** The Firefox Playwright project sets the user pref `webgl.force-enabled: true`. On CI, Firefox runs **headed under `xvfb-run`** with Mesa installed (`libgl1-mesa-dri libegl1 libegl-mesa0 libglx-mesa0 xvfb`), selected by `PW_HEADED=1`. Measured on `spike/linux-layout-grid`: headless Firefox with the pref and Mesa still failed (`FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS`); headed under xvfb it rendered, with a 0.0000 % first-frame seam in every case.
- **Alternatives considered:** filtering the warning (the seam would never be measured in Firefox); headless Firefox with the pref only (no driver).
- **Consequences:** Firefox CI renders WebGL in software through Mesa. Firefox also warns about layout read before load for Playwright's injected helpers (`{file: "debugger eval code"}`); that exact message is filtered as environment noise. The no-WebGL path is tested explicitly in Milestone 4 (launch flag), where this browser warning must be expected rather than forbidden.

## ADR-016 — Measured seam ceiling for Chromium on Linux at 2x

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** After ADR-014, Chromium on GitHub's `ubuntu-latest` at device pixel ratio 2 still measured 0.5247 % (raw 0.8217 %) on the vanilla home page. Every other configuration measures 0.00–0.29 %. Analysis of the CI images (a shift-distance histogram over the diff): the remaining pixels are paragraph text whose lines land one device pixel lower in the copy, on lines with a fractional line height (18.4 px × 1.6). Live Linux Chromium snaps those lines to device pixels; the SVG copy snaps them to CSS pixels. Tried on `spike/linux-layout-grid` (never merged): device layout grid (`zoom`) 0.97 %, unhinted text (`text-rendering: geometricPrecision`) 0.80 % (css grid) / 0.98 % (device grid).
- **Decision:** Keep 0.5 % for every configuration except Chromium on Linux at DPR ≥ 2, whose ceiling is 0.6 % (`seamLimit()` in `e2e/seam.ts`), set just above the measured value so a regression still fails. The number and its cause are recorded here and in `context/PROGRESS.md`, and will be listed under browser support in the README.
- **Alternatives considered:** a global 0.6 % (would weaken every other engine); allowing a one-CSS-pixel shift (hides real layout bugs); per-line rounding fixes in the copy (needs the live line boxes, which are not exposed).
- **Consequences:** On Linux HiDPI Chrome some paragraph lines can move by half a CSS pixel at the instant the overlay appears. Revisit when the effect is running: during the crack phase this is covered by motion, but the first frame is still static.

## ADR-017 — Fracture stays on the main thread

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** Section 5.1: move fracture to a Worker only if it exceeds 4 ms at 160 shards on a mid-range laptop. Measured on an RTX 4050 / 12-core laptop: Node 0.75 ms; headless Chromium 0.6 ms median (p95 1.0 ms) at 1440x900, 1.4 ms at 400 shards; Playwright WebKit ≤ 1 ms (1 ms timer). The Claude desktop app's embedded browser pane measured 3.4–3.6 ms, but it also runs plain JavaScript about 5× slower than Node and throttles animation frames, so it is not representative.
- **Decision:** No Worker. Fracture runs synchronously after `covered` and before `commit()`. Seeds use a typed-array linked-list grid; Voronoi rings are read through d3's public `renderCell(i, context)` without per-vertex arrays.
- **Alternatives considered:** an inline Worker (adds a `worker-src blob:` CSP requirement and a message round trip for ~1 ms of work).
- **Consequences:** Re-measure on a mid-range laptop in Milestone 10; `__SHATTER_TEST__.measureFracture(shards, runs)` and `e2e/vanilla/fracture-timing.spec.ts` produce the numbers.

## ADR-018 — Crack runs after commit; shards are drawn from one merged mesh

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** Section 4 orders covering → committing → waiting → animating, and 5.2 says the crack plays before any shard moves.
- **Decision:** Pipeline in Milestone 3: capture → cover (intact quad) → fracture (the mesh at rest replaces the quad; identical pixels, seam-tested) → `commit()` → two frames → crack (140 ms + 40 ms hold) → reveal. The mesh holds front faces (z = 0), back faces (z = −thickness, reversed) and side quads, interleaved as position·uv·shardId·centroid·edgeDistance·normal (12 floats). While shards lie flat only the front faces are drawn. One draw call per frame. Pause points `covered`, `fractured`, `cracked` exist in debug mode.
- **Alternatives considered:** a separate line geometry for cracks (spec forbids); cracking before `commit()` (would delay the router by 180 ms).
- **Consequences:** Milestone 4 adds shard motion through the vertex shader, the state machine's waiting phase and the reveal timing.

## ADR-019 — Single-line text stays single-line in the copy; local seam check

- **Date:** 2026-11-14
- **Status:** accepted
- **Context:** In WebKit's device-grid copy (ADR-010) the "See the work" button wrapped its last word: glyphs measure a hair wider in the copy and the button's inlined width is exactly its text width. The whole-screen seam number did not catch it (0.03 %; a word is ~0.1 % of the screen).
- **Decision:** (1) `CloneSession.keepSingleLines`: every text run that lies on one line in the live page (all client rects share a top) is wrapped in a `white-space: nowrap` span in the copy, unless the element is already `nowrap`/`pre`. (2) The seam test also checks the worst 24×24 CSS-pixel block for "structural" pixels: luminance off by ≥ 80/255 with no match within the shift radius. Limit 8 %. Measured: healthy seams 0–4.2 % (Windows Chromium's grayscale-vs-ClearType header text is 4 %); the wrap bug 16.5 %.
- **Alternatives considered:** padding inlined widths (moves centred content); a block check on colour differences (ClearType vs grayscale text scored 15 %, the wrap bug 18 %: no margin).
- **Consequences:** One `Range.getClientRects()` per text node during capture. Text that wraps live is not forced to wrap the same way in the copy (not seen so far).

## ADR-020 — Core facade + lazy runtime chunk

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** With the full state machine, fallbacks, accessibility, scroll lock and pre-capture, the core entry measured 6.45 kB gzip, over the 6 KB budget (section 8: "the core entry, including the listeners that detect intent, is ≤ 6 KB").
- **Decision:** The core entry (`src/core/shatter.ts`, `ShatterFacade`) holds options, events, the effect registry and the intent listeners (pointerdown/hover pre-capture triggers), plus a plain-navigation path. The transition runtime (`src/runtime/index.ts`: state machine, waiting phase, fallback chain, focus/announce, scroll lock, pre-capture) is a lazy chunk `dist/runtime.js`, prefetched on idle together with the engine and capture chunks. If the runtime chunk cannot load, `transition()` emits `fallback: unsupported` and commits plainly.
- **Alternatives considered:** squeezing the code (not enough headroom for later milestones); putting the runtime into the engine chunk (reduced-motion users would then download WebGL code).
- **Consequences:** Core 1.77 kB, runtime 6.56 kB (own budget 8 KB), engine 16.82 kB, capture 11.94 kB. The debug hook appears once the runtime has loaded.

## ADR-021 — Effect plugin data model and GLSL hook

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 6 sketches `ShatterEffect` (`shardAttributes`, `vertexChunk`, `isComplete(t, ctx)`), asking to refine the details.
- **Decision:** `shardAttributes(ctx)` returns exactly 8 floats per shard (two vec4, `Shard.a` and `Shard.b`), uploaded as an RGBA32F texture (2 × shardCount, NEAREST) read with `texelFetch` by shard id. `vertexChunk` defines `void shardMotion(Shard shard, inout Pose pose)`; `Pose` = translate, rotate (mat3), scale, alpha about the shard centre. `fragmentChunk` optionally defines `void shardFragment(inout vec4 color)`. `isComplete(t, state)` receives `EffectState` = the context plus the generated attributes. Uniforms `uTime`, `uDuration`, `uOrigin`, `uViewport`, `uMaxRadius`, `uGravity`, `uImpulse`, `uDirection`; helper `axisAngle`. The struct field is `center`, not `centroid` (reserved word in GLSL ES 3.00, found when the first program failed to compile). One program per effect, compiled on first use; still one draw call per frame. Documented in `src/core/effect.ts`.
- **Alternatives considered:** per-vertex duplicated attributes (2× buffer size per effect); uniform arrays (limit ~256 vec4 on some GPUs, too few for 400 shards).
- **Consequences:** Rapier mode (Milestone 8) can reuse the texture approach for per-shard matrices.

## ADR-022 — Interruption semantics and transition() promise

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 4 interruption rules; the spec does not say what the superseded navigation's promise does.
- **Decision:** A new `transition()` before the old one has called `commit()` cancels the old one: its promise resolves without committing (the newest navigation wins; several rapid ones collapse to the last). After `commit()` was called, the old one is fast-forwarded (crack and motion jump to their end within one frame, the waiting phase stops) and revealed, then the new one starts. Escape, a pointerdown on the overlay, or the page becoming hidden skip from the waiting phase on. Errors thrown by `commit()` are passed to the caller and never trigger a second commit.
- **Consequences:** Routers must treat a resolved-but-not-committed promise as "superseded" (adapters in Milestones 5–6).

## ADR-023 — Hard-to-capture content is substituted, all iframes included

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 9 lists iframes, video, canvas, CORS images and `data-shatter-ignore`. The capture library re-downloads videos (slow, network), clones same-origin iframe documents in a way our original/clone pairing had to special-case, and its fetch of a non-CORS cross-origin image logs a browser CORS error.
- **Decision:** `IFRAME`, `VIDEO`, `OBJECT`, `EMBED` and `[data-shatter-ignore]` are filtered out of the clone and a substitute box takes their place, with ~60 copied layout properties: iframes/plugins/ignored → their computed background colour; videos → current frame via `drawImage` + `toDataURL` (null on taint), else a same-origin/data poster, else the background. Same-origin iframes are also substituted (not captured) in v1. Off-screen `<img>`s and cross-origin `<img>`s without a `crossorigin` attribute are substituted by a fresh transparent image (the library's placeholder behaviour, without a fetch). Rewriting the clone's `src` was not enough: Firefox keeps the old `currentSrc`, which the library reads first, and fetched the original (found on CI). Canvas keeps the library's `toDataURL` copy.
- **Alternatives considered:** letting the library handle video (slow, network, may exceed budget); capturing same-origin iframe content (fragile pairing; nested scroll/fixed handling).
- **Consequences:** Verified per case in `e2e/vanilla/lab.spec.ts` (Chromium and WebKit).

## ADR-024 — Capture budget applies to pre-captures too

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** In WebKit a pre-capture finished before the click although it took longer than the budget, so `captureBudget: 1` did not fall back.
- **Decision:** A pre-capture whose own duration exceeds `captureBudget` is discarded and the transition falls back with `capture-budget`, exactly as a slow capture on click would.
- **Consequences:** Behaviour does not depend on whether the user pressed long enough for the pre-capture to finish.

## ADR-025 — Deferred: debug panel and `backForward`

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 10's debug panel and section 6's `backForward: 'reverse'` are not tied to a milestone. `'reverse'` maps `shatter` back to `assemble`, which arrives in Milestone 7; the panel's FPS/seam-check tools belong with the performance pass.
- **Decision:** `backForward` is implemented in Milestone 7 with `assemble`; until then `direction: 'back'` plays the same effect (the uniform `uDirection` is already passed). The debug panel (shadow DOM, timings, FPS, wireframe toggle, seam-check heatmap) is built in Milestone 10. The data it needs is already exposed on the debug hook (`state`, `timings`, `lastAnimation`, `lastFracture`, `wireframe`, `setMotionTime`).
- **Consequences:** Listed in `HANDOFF.md` so it is not forgotten.

## ADR-026 — Back/forward in React Router: hold the router's popstate, not the Navigation API

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 7 says to capture the outgoing page before React Router re-renders on POP, using the Navigation API's `navigate` event where available and playing no effect elsewhere. A capture takes 30–250 ms and is asynchronous, while React Router 8.5.1 handles `popstate` immediately (`window.addEventListener('popstate', handlePop)` in `lib/router/history.js`, both declarative and data mode). Starting the capture in the `navigate` event, a few microseconds before `popstate`, cannot finish before the router renders the new route, so the overlay would show the *new* page shattering.
- **Decision:** `<ShatterProvider>` (react-router) adds a **capture-phase `popstate` listener on `window`**. When the route (`pathname + search`) differs from the one last rendered, it calls `stopImmediatePropagation()` and starts a `direction: 'back'` transition; the commit dispatches a new `PopStateEvent` with `history.state`, which the router handles as usual, and resolves when `<ShatterRouteSignal>` reports the new location. The browser history (URL, entry, `history.state`) moves at once and is never blocked; only the router's reaction is postponed until the overlay covers the page (≤ capture budget + 2 frames). A held popstate is always released: by the next commit, when the last in-flight transition settles (`RouteBridge.run`), or when the provider unmounts. Fragment-only moves are not held. Works in every engine; the Navigation API is not needed.
- **Alternatives considered:** Navigation API `navigate` event only (cannot capture in time, see above); `navigate` event + `intercept()` (does not stop the router's popstate listener; Firefox/Safari support is recent); no effect on POP (loses a spec'd feature that is achievable).
- **Consequences:** Other `popstate` listeners on the page also receive the event late, and as a synthetic (`isTrusted: false`) event. A capture listener is relied on to run before React Router's bubble listener at the window target (DOM spec: capture listeners at the target run first, implemented in Chromium, Firefox, WebKit); verified in all three engines by e2e.

## ADR-027 — React adapter shape

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 6 names `ShatterProvider`, `ShatterLink`, `useShatter`, `useShatterNavigate` for `shatter-router/react`, but plain React has no router, and section 7 needs the React Router adapter to know when a route has rendered.
- **Decision:**
  1. `shatter-router/react` is router-agnostic: `<ShatterProvider navigate={(href, { replace, state }) => …}>` connects any router; a synchronous state update inside it is flushed with `flushSync`, and a returned promise is awaited. Without `navigate`, `<ShatterLink>` is a plain `<a>` and `useShatterNavigate()` uses `location.assign`.
  2. `shatter-router/react-router` exports its own `ShatterProvider` (rendered **inside** the router; in data mode in the root route element), `ShatterLink` (wraps `<Link>`), `ShatterNavLink` (wraps `<NavLink>`), `useShatterNavigate` (takes `To` + `NavigateOptions`), `useShatter`, `ShatterRouteSignal`. Both providers share one context, so the generic hooks also work under the React Router provider.
  3. The instance is created in an effect after mount (SSR and the first render never touch the DOM), destroyed on unmount, re-created on a StrictMode remount. `options` are read once. `instance` lets the app pass its own (never destroyed by the provider). `useShatter()` returns `Shatter | null`.
  4. Every router commit is bounded by `readyTimeout` (default 1500 ms), since the runtime awaits `commit()` without a timeout and a blocked or slow navigation must not keep the overlay up.
  5. Data-mode idleness is read from `UNSAFE_DataRouterNavigationContext` (the context `useNavigation()` reads; `useNavigation()` itself throws outside a data router). It is null in declarative mode.
  6. Links: the app's `onClick` runs first; `classifyLinkClick` decides; `reloadDocument` links are never intercepted; a link to the current location replaces the entry (same rule as `<Link>`). `viewTransition` is omitted from the props (the overlay is the transition).
  7. Size budgets: each adapter entry including the core ≤ 6 KB gzip (the core's own budget); react, react-dom and react-router are peers and excluded.
- **Alternatives considered:** `useNavigation()` behind a mode prop (users must say which mode they use); creating the instance during render (StrictMode double render leaks listeners of the discarded instance); a separate React Router provider outside the router (cannot call router hooks).
- **Consequences:** `UNSAFE_DataRouterNavigationContext` is a React Router export marked unsafe; an upgrade must be checked against the unit tests (`test/react-router.test.tsx` covers data mode).

## ADR-028 — The popstate gate must be registered before the router (supersedes the listener-order assumption in ADR-026)

- **Date:** 2026-11-15
- **Status:** accepted (refines ADR-026; its decision to hold the router's popstate stands)
- **Context:** ADR-026 relied on "capture listeners at the `window` target run before bubble listeners". Measured in Playwright: **WebKit** runs the capture listener first, **Chromium** runs listeners at the target in registration order, capture or not. In data mode `createBrowserRouter()` calls `router.initialize()` immediately, which adds React Router's `popstate` listener before any component mounts. React 19 renders a transition started inside a `popstate` event synchronously (`shouldAttemptEagerTransition` in react-dom 19.3.1), so the new route was in the DOM before our listener ran: in Chromium back/forward silently played no effect (the e2e caught it once it checked the lifecycle events of the back navigation itself, not the hook's last values).
- **Decision:** One page-lifetime gate listener (`src/react-router/pop-gate.ts`, capture phase on `window`, added once) asks the mounted provider whether to hold each popstate and calls `stopImmediatePropagation()` when it does. It is installed:
  1. by `<ShatterProvider>` in a layout effect with no dependencies: a child's layout effect runs before `<BrowserRouter>`'s own `useLayoutEffect(() => history.listen(...))`, so declarative mode is covered;
  2. by the new export **`createShatterBrowserRouter(routes, opts)`** (calls `installPopGate()` then React Router's `createBrowserRouter`), the documented way to create a data router. With the plain `createBrowserRouter`, back/forward still complete; the gate runs after the router, sees the route already rendered (`pathname + search` equals the rendered one) and lets the move play without an effect (Chromium), or holds it (WebKit, Firefox).
- **Alternatives considered:** Navigation API `navigate` event (fires before `popstate` but a capture cannot finish in that tick; React Router does not use it); reordering the router's listener with `router.dispose()` + `initialize()` (aborts navigations, re-runs initialisation); a `window` Proxy passed as `createBrowserRouter`'s `window` option (fragile: bound functions, `instanceof`); registering at import time (rule 6, and `sideEffects: false` would let bundlers drop it).
- **Consequences:** Data-mode apps should use `createShatterBrowserRouter`; documented in the README in M12. One extra export (+0.1 kB). e2e covers all three modes: data with the gate (effect on back and forward), declarative (effect), data with the plain router (lands on the right route).

## ADR-029 — Form controls keep their live font in the copy

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** PR #5 CI, WebKit on Linux: the React Router home page's first-frame seam had a worst block of 15.3 % (limit 8 %). The diff showed a `<button>` (no `font-family` in the app CSS) drawn in a serif font in the overlay and a sans font live. A form control's font comes from the platform (Chromium computes `Arial`, Windows WebKit `MS Shell Dlg`); modern-screenshot inlines only computed styles that differ from its sandbox's defaults, so the font is never inlined, and inside an SVG image Linux WebKit resolves the control default differently (serif). Windows WebKit measured 0.0 %, so only CI showed it.
- **Decision:** The clone session copies the computed `font-family`, `font-size`, `font-weight`, `font-style`, `font-stretch`, `line-height` and `letter-spacing` onto every cloned `button`, `input`, `select`, `textarea`, `option` and `optgroup`.
- **Alternatives considered:** `font: inherit` on buttons in the example's CSS (hides a defect apps would hit); inlining fonts on every element (larger SVG, slower capture for no gain).
- **Consequences:** Seven extra inline properties per form control in the copy. Verified by the React Router first-frame seam test on CI WebKit.

## ADR-030 — The React Router adapter takes over scroll restoration for back/forward

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** PR #5 CI, Firefox: after back then forward, `/about` ended at `scrollY` 243.9 instead of 0. The scroll log printed by the test showed Firefox applying the target entry's saved position (Work's 300) to the still-displayed About page **before** `popstate`, because that entry's `history.scrollRestoration` was `auto` (Firefox reported `auto` on the first entry even though React Router's `<ScrollRestoration>` had set `manual` at mount). While the popstate is held (ADR-026/028) the old page therefore jumps (clamped to its own height, 243.9) before it is captured, and React Router then saves that wrong value as the outgoing entry's position.
- **Decision:** `RouteBridge.attach()` (provider mount) sets `history.scrollRestoration = 'manual'` and sets it again on every entry `<ShatterRouteSignal>` reports; the previous value is put back on unmount. The bridge records each entry's scroll position by React Router location key (on scroll, before a forward commit, and when a popstate is held). After a back/forward render it restores the incoming entry's recorded position (looked up by `history.state.key`, `'default'` for the first entry), **only if nothing scrolled during the render**, so React Router's `<ScrollRestoration>` or the app's own handling wins when present.
- **Alternatives considered:** undoing the browser's scroll on the held page (the browser's value is already clamped to the wrong page); not holding popstate in Firefox (loses the effect); leaving declarative apps without restoration (the browser's automatic restoration no longer applies once `manual` is set, so the adapter must do it).
- **Consequences:** Back/forward restores scroll positions in declarative mode too (previously left to the browser). Relies on React Router keeping the location key in `history.state.key` (8.5.1, `lib/router/history.js` `getHistoryState`); listed in LEARNINGS.

## ADR-031 — Keep the held page still; start back/forward captures one frame late

- **Date:** 2026-11-15
- **Status:** accepted (refines ADR-030)
- **Context:** With ADR-030 in place, PR #5 CI Firefox still ended forward navigation at 243.9 px. The scroll log showed the test's own `popstate` listeners only ever see the *released* (synthetic) event; the real one is stopped by the gate. Firefox applies its scroll restoration to the page a few ms **after** the real `popstate` (still reporting `scrollRestoration === 'auto'` for the first entry, whatever was set on it), i.e. while the popstate is held. React Router then saved that position for the outgoing entry.
- **Decision:** While a popstate is held, the bridge's scroll listener scrolls the page back to the position it had when the popstate arrived (scroll events run before the next paint, so the jump is not painted). Back/forward transitions start one frame after the popstate (`nextFrame`, rAF raced with a 120 ms timer), so the capture never reads a page the browser has just scrolled.
- **Alternatives considered:** Navigation API `navigate` + `intercept({ scroll: 'manual' })` (changes focus and popstate semantics, availability differs per engine); not holding popstate in Firefox (no effect on back/forward).
- **Consequences:** Back/forward capture starts ≈ 16 ms later. User scrolling (already blocked by the scroll lock for wheel, touch and keys) is also held still during that time.

## ADR-032 — Resolve WebKit's `-webkit-standard` font in the copy

- **Date:** 2026-11-15
- **Status:** accepted (refines ADR-029)
- **Context:** ADR-029 pinned the computed font of form controls, but CI WebKit (Linux) still drew the button serif. The diagnostic log showed the computed font: `600 16px -webkit-standard`. It is WebKit's "standard font" setting keyword (also the `<html>` default): the live page resolves it from browser settings (sans on the Linux runner), an SVG image document from default settings (serif). Pinning the keyword itself changes nothing.
- **Decision:** The clone session measures, once per capture, which generic family (`sans-serif`, `serif`, `monospace`) has exactly the width of `-webkit-standard` for a probe string, with a detached 2D canvas (a canvas accepts the keyword and resolves it with the live settings; no DOM mutation). Every `-webkit-standard` entry in the `font-family` of the cloned root and of form controls is replaced with that generic. If no single generic matches, nothing changes.
- **Alternatives considered:** a hidden measuring element (a DOM mutation that dirties pre-captures); hard-coding `sans-serif` on Linux (wrong where the setting differs).
- **Consequences:** Pages without an author font, and unstyled form controls, keep their face in the WebKit copy. Capture chunk 11.96 → 12.31 kB. Measured on Windows WebKit: `-webkit-standard` = `serif` (646.3 px for the probe at 72 px), so nothing changes there.

## ADR-033 — Form controls: copy the font their text is painted in

- **Date:** 2026-11-15
- **Status:** accepted (refines ADR-029 and ADR-032)
- **Context:** CI measurements (canvas and layout agree): on Linux WebKit `-webkit-standard` = `serif` (763.8 px for the probe at 72 px), `sans-serif` = `system-ui` = 743.9 px. The button's computed font is `600 16px -webkit-standard`, yet it is painted sans: WebKit's control theme draws the text in the system font without changing the computed style. ADR-032 therefore correctly replaced the keyword with `serif`, and the copy stayed serif.
- **Decision:** For a form control with a single line of text and `letter-spacing: normal`, the clone session measures the live text run (`Range.getBoundingClientRect()` over its contents) and compares it with the same text drawn on a detached 2D canvas in the control's style, weight and size: first in the computed family (match → keep it), then `sans-serif`, `serif`, `monospace`, `system-ui`. The first family within max(0.5 px, 1 %) becomes the clone's `font-family`. No match → keep the computed family (ADR-029/032 still apply).
- **Alternatives considered:** trusting `getComputedStyle` (it does not describe what is painted here); forcing `system-ui` on controls (inside an SVG image it may not resolve either, and it is wrong where the theme uses the author font).
- **Consequences:** One `Range` and up to five `measureText` calls per text-bearing form control per capture. Capture chunk 12.31 → 12.53 kB. Inputs (value text is not in the DOM) are not measured.

## ADR-034 — Next.js App Router adapter shape

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 7 (Next.js): provider in the root layout, `<ShatterLink>` wrapping `next/link` with prefetch kept, `commit` = `router.push(href, { scroll: false })` resolving when `usePathname()` + `useSearchParams()` change (inside `<Suspense>`), two rAFs, `waitFor: 'commit' | 'settled'` with a documented marker contract, Navigation-API back/forward like React Router. Verified in next 16.4.6 (`dist/client/components/app-router.js`, `dist/client/app-dir/link.js`).
- **Decision:**
  1. The render-detection and back/forward machinery (`RouteBridge`, popstate gate) moved from `src/react-router/` to `src/react/` and is shared. The bridge takes an `entryKey()` function: React Router uses `history.state.key`; Next.js uses the Navigation API's `navigation.currentEntry.key`, else `pathname + search`. Render tokens: React Router location key; Next.js `pathname?search`.
  2. The App Router adds its `popstate` listener in a passive `useEffect` of a parent component, so the provider's layout effect installs the gate first: no router factory is needed (unlike React Router data mode, ADR-028). The App Router leaves `history.scrollRestoration` alone; the bridge's takeover (ADR-030/031) applies.
  3. A navigation to the current path + search (same URL, or only a different hash) does not change the render token: the commit resolves after two frames instead of waiting for the timeout. A target with a `#fragment` scrolls that element into view after the render (`scroll: 'none'` for the runtime); this now also applies to React Router links and `useShatterNavigate`.
  4. `waitFor` defaults to `'settled'`. Marker contract: any element with `data-shatter-pending` means "still loading"; the commit waits until none is left (MutationObserver), bounded by `readyTimeout`. React gives client-side Suspense fallbacks no DOM marker of their own, so the attribute (on `loading.tsx` UIs, skeletons) is the whole contract.
  5. `<ShatterLink href>` accepts a string only (no `UrlObject`): the adapter needs the exact href Next.js would push, and Next's formatter is internal. `onNavigate` is honoured (called before the transition; `preventDefault()` cancels it); `replace` and `scroll` behave as on `next/link` (`scroll={false}` keeps the scroll position).
  6. `"use client"` is prepended to `dist/react.js`, `dist/react-router.js` and `dist/next.js` by tsup's `onSuccess` hook, because esbuild drops module directives when bundling. It goes on the first line so source maps stay aligned.
  7. Size budget: the `next` entry including the core ≤ 6 KB gzip (`next`, `react` are peers).
- **Alternatives considered:** detecting renders through Next's internal history state (`__PRIVATE_NEXTJS_INTERNALS_TREE`, internal); a separate tsup config with a banner for client entries (duplicates the shared chunks and the lazy-chunk graph).
- **Consequences:** `shatter-router/next` 4.20 kB; `react-router` 4.07 kB (the shared bridge now carries the hash scrolling). `next` is an optional peer `>=16.0.0`.

## ADR-035 — A scroll position clamped by a shorter page is not an app scroll

- **Date:** 2026-11-15
- **Status:** accepted (refines ADR-030)
- **Context:** Next.js e2e: Work scrolled to 300, About, back (Work at 300), forward: About ended at 90 instead of 0. The App Router does not restore scroll on traversal, so the bridge should have restored About's recorded 0. It skipped it because the position changed during the render (300 to 90), which ADR-030 treats as "the app scrolled". In fact the browser had only clamped 300 to the shorter About page's maximum.
- **Decision:** After a back/forward render the bridge treats the page as untouched when the position equals the previous one clamped to the new page's maximum scroll (`scrollHeight - clientHeight`, ±1 px), and then restores the recorded position.
- **Consequences:** React Router's `<ScrollRestoration>` and app code that really scroll still win; plain App Router and declarative React Router apps get the entry's position back.

## ADR-036 — Remaining effects, the incoming page and `backForward`

- **Date:** 2026-11-15
- **Status:** accepted (supersedes the `backForward` part of ADR-025)
- **Context:** Section 5.4 asks for `explode`, `implode`, `flip` and `assemble`, written only against the public `ShatterEffect` interface, with pixel-exact last frames for `flip`/`assemble` (critically damped settle, no overshoot) and one draw call per transition. Section 4.7: capture the incoming page under the overlay. Section 6: `backForward: 'reverse' | 'same' | 'none'`.
- **Decision:**
  1. **Interface refinements** (shape kept, documented in `src/core/effect.ts`): optional `layers?: 1 | 2`; `Shard.layer`; uniform `uThickness`; GLSL helper `settle(t, T)` (twin of `core/spring.ts`); the chunk may read `aPosition`, `aUv`, `aNormal`; `Pose.rotate` may be any 3x3 matrix (stretch, mirror); the fragment hook runs for every face and may `discard`; varyings `vFace`, `vLayer`; sampler `uIncoming`.
  2. **`shardMotion` only runs during the motion phase** (`uMoving`); cover, fracture and crack frames are drawn at the exact rest pose by the engine. Found when `flip` drew turned shards at the `fractured` pause: before `prepareMotion` the shard data is all zero, so its flip time was 0 and `settle()` returned 1.
  3. **`flip`:** a Voronoi cell mirrored across a line is a different polygon, so the back face is mirrored across the flip axis in the vertex chunk first; after the half turn (a second mirror) it covers its own cell exactly. It is pulled back by the thickness so it ends at z = 0; side faces (twisted by the mirroring) are discarded; the back face samples `uIncoming`. Angle = π·`settle()`, staggered by distance, all done by `uDuration`.
  4. **`assemble`:** the mesh is drawn twice in the same draw call (`drawArraysInstanced`, 2 instances): layer 0 is the outgoing page falling as in `shatter` and is scaled to nothing once faded (a transparent shard would still write depth); layer 1 is the incoming page flying in from beyond the corners and settling with `settle()`.
  5. **`explode`** (radial blast with drag, gravity after 0.25 s, stretch along the velocity through `Pose.rotate`) and **`implode`** (spiral into the impact point, shrinking, with a lensing pull in the fragment chunk) need no incoming page.
  6. **Last frame:** for effects with `needsIncomingSnapshot` the engine draws one frame at `uTime = duration` (the rest pose) when `isComplete` turns true and removes the overlay on the next frame, so the last picture equals the live page. Pause point `'settled'` (debug) holds it for the last-frame seam tests.
  7. **Incoming capture:** after the waiting phase, within `captureBudget`; on failure or timeout the fractured page plays `shatter` instead (`replaceEffect`), navigation unaffected. Debug hook: `lastEffect`, `lastIncomingCaptureMs`.
  8. **`backForward`** (default `'reverse'`): built-in names map `shatter`/`explode`/`implode` to `assemble` and `assemble` to `shatter`; `flip` turns the other way (`uDirection = -1`); user-registered effects and effect objects are never mapped. `'same'` keeps the effect; `'none'` swaps instantly with the new fallback reason `'disabled'`.
- **Alternatives considered:** a second draw call for `assemble` (spec: one draw call); flipping without mirroring (gaps and overlaps on the last frame); trusting effects to be at rest with zero data (fragile for user effects).
- **Consequences:** Engine chunk 16.82 → 19.45 kB, runtime 6.56 → 6.84 kB. Effects that end on the incoming page cost one more capture (Chromium 45–181 ms locally) between the waiting phase and the crack.

## ADR-037 — Rapier physics as a plugin object, not `physics: 'rapier'`

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 5.3/6 asks for `physics: 'procedural' | 'rapier'`, with `@dimforge/rapier3d-compat` an optional peer loaded with dynamic `import()` only in rapier mode, and a `shatter-router/rapier` subpath. Measured for 0.21.0: 4.3 MB (1.65 MB gzip; the WebAssembly is inlined as base64). If the core or its lazy chunks contained `import('@dimforge/rapier3d-compat')`, every app bundler (Vite, webpack, Next) would have to resolve it at build time, and apps without the optional peer would fail to build.
- **Decision:**
  1. `physics?: 'procedural' | PhysicsPlugin`. `shatter-router/rapier` exports `rapier({ floor?: boolean })`, a 263 B plugin descriptor whose `load()` dynamic-imports the internal `dist/rapier-backend.js` (1.42 kB gzip: the simulation), which imports the peer. Only apps that import `shatter-router/rapier` reference Rapier, and their bundlers split it into a lazy chunk. The public plugin interface (`PhysicsPlugin`, `PhysicsBackend`, `PhysicsSetup`, `PhysicsShard`, `PhysicsSimulation`, `PHYSICS_TRANSFORM_FLOATS`) lets other engines plug in.
  2. The runtime loads the plugin together with the engine and capture chunks (prefetched on idle; the first transition waits for it). If it fails (offline, a CSP without `'wasm-unsafe-eval'`), the motion stays procedural; nothing falls back. Debug hook: `lastPhysics`.
  3. Physics drives the falling built-in effects only (`shatter`, `explode` with linear damping 3); their per-shard data already holds the procedural initial velocity, spin and stagger delay, so both modes start alike. Other effects keep their own motion.
  4. Simulation: 100 px = 1 m; fixed 1/60 s steps with an accumulator, at most 6 steps per frame (a stalled tab drops time); bodies start disabled and are released at their delay; convex hulls of the extruded cells scaled by 0.92 (cuboid when the hull is null); optional floor slab under the viewport. Unreleased shards are written as an exact identity (reading a body back costs ~1e-5 px). `write()` reuses its vectors (no per-frame allocation).
  5. Engine: one mat4 per shard (4 RGBA32F texels per row) in a texture updated with `texSubImage2D` each frame and read with `texelFetch` (`uPhysics`, `uTransforms`); still one draw call. Completion: the motion duration or `simulation.finished` (all shards below the viewport, asleep, or resting on the floor). Fade starts at 70 % of the duration.
- **Alternatives considered:** a `'rapier'` string resolved by the core (breaks builds without the peer); registering the plugin through an import side effect (`sideEffects: false` lets bundlers drop it); the `-simd-compat` build (not supported everywhere).
- **Consequences:** Users write `physics: rapier()` instead of `physics: 'rapier'` (README in M12). With a floor, a longer `duration` (2–3 s) shows the pile. CSP: `script-src 'wasm-unsafe-eval'` for rapier mode, tested with `examples/vanilla/csp-wasm.html`.

## ADR-038 — Glass shading: engine-level, gated by a fade-in and the rest pose

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 5.5: edge highlight from `edgeDistance` brighter toward a fixed light, a Blinn-Phong glint with the rotated normal, chromatic aberration proportional to shard speed (max 1.5 px, `chromatic: true`), darker tinted sides (`glassTint`, default `#cfe8ff` at 12 %), all lighting exactly zero at `t = 0` and faded in over 60 ms. Milestone 7 added effects whose *last* frame must equal the live page (`flip`, `assemble`), so lighting must also vanish at the final rest pose.
- **Decision:**
  1. The shading lives in the engine's fragment shader and applies to every effect after the effect's `shardFragment` hook: `glassLight()` = rim (`1 - smoothstep(0, 2 px, vEdge)` × (0.15 + 0.55·facing)) + 0.55 × glint (`pow(N·H, 60)`), added to the premultiplied colour. Fixed light from the top left toward the viewer; side faces get a weaker rim from their own normal.
  2. Two gates multiply every term: `uLight = lightFade(t)` (smoothstep from 0 at t = 0 to 1 at 60 ms, `core/shading.ts`, 0 whenever nothing moves) and a per-vertex `vMotion` (0 at the rest pose: in-plane translation, deviation of the rotation's xy block from identity, scale; 1 beyond 2 px). The `flip` back face at 180° and the settled `assemble` layer have an identity xy block, so they are unlit. Measured: every first- and last-frame seam number is unchanged from Milestone 7.
  3. Chromatic aberration: `glassSample(tex, uv)` (public helper for effect chunks; `flip`/`assemble` use it for `uIncoming`) shifts red ahead and blue behind along the vertex's screen velocity, `min(1.5, speed × 1.5 / 1200)` px, also gated by `uLight × vMotion`. Velocity: procedural effects evaluate `shardMotion` a second time 1/60 s earlier (to make that possible `uTime` is now a global set from the `uTimeValue` uniform; effect chunks still read `uTime`); physics writes the body's linear velocity into the spare fourth row of its mat4.
  4. Sides: `mix(page × 0.55, tint, 0.12)`. Options `glassTint` (`#rgb`/`#rrggbb`; anything else falls back to the default with a debug warning) and `chromatic` (default true), passed once to the engine (`setShading`).
- **Alternatives considered:** lighting inside each effect chunk (every effect would have to repeat the seam rules); a fade only in time (would light the settled last frame of `flip`/`assemble`); a previous-frame transform texture for velocities (an extra upload per frame).
- **Consequences:** The vertex shader runs `shardMotion` twice (cheap on the GPU). Engine chunk 20.1 → 21.58 kB of its 22 KB budget: Milestone 10 should strip GLSL comments from the shader strings at build time (comments inside template strings survive minification).

## ADR-039 — Minify GLSL template literals at build time

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** The engine chunk was 21.58 of its 22 KB budget after Milestone 9, and the debug panel and performance work still had to fit. JavaScript minifiers keep template-literal text, so every GLSL comment and indentation run in the shader strings shipped to users.
- **Decision:** An esbuild plugin in `tsup.config.ts` (`build/glsl.ts`) rewrites the static parts of every template literal tagged `/* glsl */` in `src/`: it removes comments, trims lines, drops empty lines, collapses blanks, and removes blanks next to punctuation that cannot join tokens (`{}()[];,=*/<>!&|?:`). Blanks next to `+`/`-` are kept (`a - -b`), as are preprocessor lines (`#define F (x)` vs `F(x)`) and newlines (directives need their own line). It never trims at a `${}` boundary, so `float ${name}` keeps its space. Interpolations, nested templates included, are copied unchanged. The removed newlines are appended after the closing backtick, so line numbers after a template, and the source map, stay right. It throws on anything it can't rewrite safely: a backslash, or a comment that reaches an interpolation. Unit tests compare the GLSL token stream of every built-in shader before and after, and check that each source file keeps its line count. E2E confirms the shaders compile, with every seam unchanged.
- **Alternatives considered:** writing the shaders without comments (loses the documentation), a GLSL minifier dependency (renames identifiers, which breaks the public effect-chunk contract `Shard`/`Pose`/`uTime`/`glassSample`), and post-processing `dist` (no source-map control).
- **Consequences:** Engine 21.58 → 19.74 kB. Vitest imports `src` directly, so the unit tests see the commented sources. Third-party effects' own chunks are not minified.

## ADR-040 — How the section 8 budgets are measured and enforced

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 8 asks for 60 fps at 1440x900 with 160 shards on a mid-range laptop, one draw call, no per-frame allocations in the render loop, no long task over 50 ms outside capture, and textures freed after `end`. CI runners and headless Playwright use software GL (SwiftShader or Mesa), where frame rate and long tasks measure the rasteriser rather than our code. On the dev machine, Playwright's own full Chromium build does not start (side-by-side error, as with Firefox), and only the headless shell runs.
- **Decision:**
  1. `e2e/vanilla/performance.spec.ts` runs in the normal suite and enforces the structural budgets on every engine. **Draw calls:** WebGL2 prototype wrappers count draw calls between consecutive `clear`s (the engine clears once per drawn frame), and each must be exactly 1. **Allocations** (Chromium, `e2e/alloc.ts`; amended after PR #10 CI): exact tracking via CDP `HeapProfiler.startTrackingHeapObjects({ trackAllocations: true })` over the measured motion, after a warm-up in the same document. The snapshot's `trace_tree` gives the count and bytes allocated per call-tree node. We count nodes under the engine's `FrameLoop.tick`, excluding `stop` (one stats object per run) and `ensureEffectProgram` (one compile per effect). While tracking, V8 runs the loop unoptimised and boxes every double into a 12 B HeapNumber, so the test measures the excess bytes `size − 12 × count`. The limit is under 20 B per frame, with a 400 B floor. Calibration: a planted 8-field object per frame added 31–32 B per frame and fails; clean runs measure 0 B, except intermittent padding noise in `explode` (≤ 15 B per frame) and one-offs ≤ 120 B. The sampling profiler, tried first, was useless here: with `samplingInterval` 16 B, the planted object appeared in 2 of 22 frames. This method found two real per-frame allocations in unoptimised code, now fixed: `const [r, g, b] = tint` in `draw()` (an array iterator, 35 B per frame) and `for...of` in the effects' `isComplete` (an iterator per call), plus a returned `[dx, dy]` tuple per shard in `explode`. **Textures:** 0 after `end`.
  2. Frame rate (≥ 58 fps) and long tasks (none over 50 ms between `covered` and `end`) are enforced only with `SHATTER_PERF=1`, which runs installed Google Chrome headed on the GPU. Without it they are printed. The event timestamps come from the example's debug log (`__shatterEventTimes`).
  3. Rapier mode: our simulation's per-frame methods use indexed loops (no closures), but Rapier 0.21's getters and `World.step` allocate (wasm-bindgen boxes the numbers it writes back into JS). The optimising compiler inlines those getters into `write()`, so the profile can't separate them. The Rapier case is report-only, and a Node probe gives the split (PROGRESS).
- **Alternatives considered:** a Performance trace with GC events (counts every allocation on the page, including Playwright's polling), and enforcing fps in CI (software GL runs at 6–34 fps).
- **Consequences:** Real-GPU numbers come from a manual run, recorded in PROGRESS with device and browser. Rapier mode makes roughly 19 kB of small, short-lived garbage per frame at 160 shards. That's a scavenge every few seconds, which we accept for an optional mode.

## ADR-041 — Debug panel: a lazy chunk, opt-out with `{ panel: false }`, seam check by tab capture

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 10 asks for a shadow-DOM panel when `debug: true`. It shows the state and phase timings, shard count, device tier, FPS, draw calls, a wireframe and impact-point toggle, and a seam check that compares the live DOM with the overlay's frame as a diff heatmap. The e2e suite runs every example with `?debug` (for the test hook) and compares screenshots, so a panel in those pages would change them. A page cannot read its own live pixels without screen capture.
- **Decision:**
  1. `debug?: boolean | { panel?: boolean }`. `true` means panel, hook and warnings; `{ panel: false }` keeps everything but the panel. The examples map `?debug` to `{ panel: false }` and `?debug&panel` to the panel. This deviates from the spec's plain boolean: `true` still behaves as specified.
  2. The panel is the lazy `dist/debug.js` chunk (3.44 kB gzip, budget 5 KB), imported by the runtime only in debug mode. The runtime adds about 0.3 kB (now 7.55 of 8 KB). The panel's host element carries `data-shatter-ignore`, so it is not captured. It is a manual popover, shown again on `covered` so it stays above the overlay, and its shadow root keeps app CSS out. The runtime forwards every lifecycle event to `panel.update()`. A 100 ms timer runs only during a transition, and FPS is counted live with requestAnimationFrame only while animating. The hook's `lastAnimation` gains `drawCallsPerFrame`: the engine's draw calls divided by its drawn frames over the motion phase.
  3. **Seam check:** `getDisplayMedia({ preferCurrentTab: true, cursor: 'never' })`, after the browser asks the user. It waits until the viewport is stable and the stream's aspect ratio matches it, because the sharing infobar shrinks the viewport (that first measured 13.8 % and 15.4 %). Then it hides the panel and grabs a live frame. It captures the page, covers it and fractures it at rest (wireframe off), and grabs the overlay frame. Pixels count as different when a channel differs by more than 26/255, and the heatmap shows them in red. Without screen capture (refused, unsupported, headless), it compares the capture with `engine.readPixels()`, which checks the GL pipeline but not the capture, and labels the result. Transitions wait for a running check (`exclusive()`).
- **Alternatives considered:** a separate `debugPanel` option (two options for one feature); always showing the panel and hiding it in e2e through the hook (every test would have to know); html2canvas-style capture of the live page (it is the capture itself, so it cannot test it).
- **Consequences:** Measured: capture vs overlay 0.000 % (headless Chromium and WebKit). Tab capture in headed Chrome on Windows: 1.13 %, all on text edges: ClearType text in the live tab vs grayscale in the capture (ADR-009), plus the stream's 1.24× scaling. The panel makes this known difference visible, which is its purpose.

## ADR-042 — Docs site: the hero breaks the whole page, no region support

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 13 asks that a click anywhere on the landing hero "shatters the hero section in place and reassembles it, using the core API on a region", with `transition({ target })` added only if it fits the architecture cleanly. The engine draws one full-viewport overlay with a pixel-exact camera, and the fracture tiles the whole viewport with Voronoi cells.
- **Decision:** No region support. A region would need a cropped snapshot and camera, plus a mesh that is fractured inside the region and intact around it (or a second, intact quad), which touches the capture, the camera, fracture and every effect's assumptions. The hero fills the first viewport (`min-height: calc(100svh - 5rem)`), so it uses the core API as it is: `transition({ commit: () => undefined, effect: 'assemble', origin, scroll: 'none' })`. The outgoing shards fall while the same page's shards fly back in. A visible "Break it" button does the same for keyboard users.
- **Alternatives considered:** a cropped overlay over the hero only (new camera and capture paths for one demo); `flip` (it doesn't read as breaking).
- **Consequences:** On a short viewport the header and the top of the next section break too. Region support stays a possible later feature; the README roadmap will list it (M12).

## ADR-043 — A priming capture on the first sign of intent; light web fonts on the docs site

- **Date:** 2026-11-15
- **Status:** accepted
- **Context:** Section 8: capture ≤ 120 ms on the docs landing page at 1440x900. Measured in installed Chrome on the RTX 4050: the first capture after a page load takes 160–185 ms, and the following ones 50–110 ms. A CPU profile shows mostly native work (style resolution, rasterising the SVG) plus first-run JIT; blocking the web fonts saved only about 15 ms. On top of that, each capture inlines the page's web fonts into its SVG, and Newsreader with its optical-size axis was 132 KB (roman) plus 147 KB (italic).
- **Decision:**
  1. **Runtime:** once the chunks have loaded, the runtime listens for the first `pointermove`, `keydown`, `wheel`, `touchstart` or `scroll` (capture, passive). When one arrives and nothing is capturing (no transition, pre-capture or debug check), it runs one throwaway capture at idle (`requestIdleCallback`, 500 ms timeout) and disposes it. It skips this when the tab is hidden, the context is lost, the page is pinch-zoomed or reduced motion means no effect will play. A transition's own capture counts as primed. The listeners are removed after priming and on `destroy`. It doesn't prime at load, because that would put a long task into every page load (and into Lighthouse's TBT). Runtime 7.55 → 7.76 kB of 8 KB.
  2. **Docs site:** Newsreader without the `opsz` axis (roman 58 KB, italic 64 KB). Only the roman face is preloaded; the italic (its own `next/font` family, `--font-display-italic`) and JetBrains Mono load without preload, and no italic text sits above the fold. CSS is inlined (`experimental.inlineCss`).
- **Alternatives considered:** a priming capture at idle after load (a 150 ms long task on every visit); priming inside the capturer's `warmUp` (same problem); `font-display: optional` (first visits would show the fallback face).
- **Consequences:** Measured (12 captures, 4 runs, after one pointer move and 1 s): 48–88 ms, median 82 ms; 2 outliers of 129 and 156 ms in one run (cause not isolated; the capture is wall-clock time across async image decoding). The e2e assertion uses each run's median. If a visitor clicks within a few ms of their very first pointer move, the click's capture is still the cold one. Lighthouse mobile: 97–99 Performance, 100 Accessibility on every main page.

## ADR-044 — The capturer makes modern-screenshot's sandbox frame itself

- **Date:** 2026-11-20
- **Status:** accepted
- **Context:** PR #11 CI, Firefox: the Next example's "same-page hash link" test found `page.goBack()` still on `#links`. The retry logged "This page is in Quirks Mode" from `about:blank`. modern-screenshot 4.7.0 (`getSandBox`, `dist/index.mjs` lines 660–679) creates its hidden default-styles iframe on the first capture by appending it to `<body>` and only then setting `srcdoc`. Navigating a frame that is already in the document adds a joint session-history entry in Firefox: the next Back press goes "back" inside the invisible frame. This always happened on the first capture of a page; the priming capture (ADR-043) moved that capture to an idle moment, right before the test pressed Back.
- **Decision:** `DomCapturer` creates the frame itself as soon as the library context exists: same attributes (0×0, hidden, `position: fixed`) plus `aria-hidden` and `tabindex=-1`, with `srcdoc` set **before** insertion, so it loads as the frame's initial navigation (no history entry). It's handed to the library as `context.sandbox`, which the library uses when present and removes in `destroyContext`.
- **Alternatives considered:** filtering the warning and the URL in the test (it is a real Back-button bug); a patched modern-screenshot (a fork to maintain); creating the frame lazily on the first capture (same timing as before).
- **Consequences:** E2E `history.spec.ts` checks on every engine that a capture leaves `history.length` unchanged and that Back leaves the page at once. Bumping modern-screenshot needs a look at `getSandBox`.

## ADR-045 — The docs site is deployed to Vercel from the monorepo root

- **Date:** 2026-11-20
- **Status:** accepted
- **Context:** The user asked for the docs site to be deployed (Vercel or the best option). It's a Next.js 16 App Router app in a pnpm 12 workspace (`apps/docs` depends on `shatter-router` via `workspace:*`). Every route is static apart from Next's not-found handling.
- **Decision:** Vercel project `shatter-router` (scope `abdullah-asghar-s-projects`, owned by the user's account), production URL https://shatter-router.vercel.app. Settings via `vercel project update`: root directory `apps/docs`, framework `nextjs`, Node 24.x, install `cd ../.. && npx --yes pnpm@12.8.1 install --frozen-lockfile`, build `cd ../.. && npx --yes pnpm@12.8.1 build && npx --yes pnpm@12.8.1 --filter @shatter-router/docs build`. pnpm is pinned because Vercel's image may not ship pnpm 12. The deploy runs from the repo root with Vercel CLI 62.1.0 (`vercel deploy --prod --yes`) so the whole workspace is uploaded. A root `.vercelignore` leaves out `node_modules`, build output, test artefacts, `media`, `context/screenshots`, `.vercel` and `.env*`. The CLI's `vercel link` wrote an OIDC token to `.env.local`, which is git-ignored and never uploaded.
- **Alternatives considered:** GitHub Pages with `output: 'export'` (needs a `basePath`, loses `inlineCss`, and the user named Vercel); a prebuilt deploy (`vercel build` on Windows, with known symlink problems); connecting the Git repository for automatic deploys (a step for the user to choose: `vercel git connect`).
- **Consequences:** Measured on the live site: Lighthouse mobile 99–100 Performance and 100 Accessibility (`/`, `/effects`, `/docs/getting-started`, `/playground`). In installed Chrome on the GPU: captures about 80 ms, 136–144 fps on the 144 Hz display, no console problems. One of three cold runs reported a `capture-budget` fallback, probably the first visit while fonts were still uncached at the CDN edge (not reproduced). **Update 2026-11-20:** at the user's request the GitHub repository is connected (`vercel git connect`): every push to `main` deploys production, other branches and PRs get preview deployments. A manual `deploy --prod --yes` from the root still works.

## ADR-046 — Beyond v1: the production-grade plan, milestones M13–M21

- **Date:** 2026-11-20
- **Status:** accepted
- **Context:** After M12 the user reviewed the live site and found it not production-grade: a generic theme, `shatter` and `explode` looking the same, Back always playing the same default effect and the playground resetting, a native scrollbar, too few features. The master prompt's v1 scope ends at M12, so everything after it is beyond the spec.
- **Decision:** `context/PLAN-PRODUCTION.md` is the spec for M13–M21: lazy effect plugins and a composition API, about 11 fracture patterns, about 20 motions in four families, 7 materials, cursor kits and interactions, region transitions, navigation memory with a true reverse per effect, a site redesign ("Material lab"), Studio and docs features, and production foundations. The user chose art direction A and sound wherever it suits, and added text and button animations. Section 9 of the plan records the order, scope, domain and npm decisions made on the user's instruction to do "whatever is best". Every milestone keeps the A.5 ritual and the precautions of the master prompt.
- **Consequences:** The master prompt's out-of-scope list (section 14) is superseded where the plan says so: region transitions and non-fracture effects (melt, dust, glitch) are in. Multi-page apps and the Vue/Svelte/Solid adapters stay out. PROGRESS gets rows 13–21.


## ADR-047 — Navigation memory: Back plays the true reverse of the arriving effect

- **Date:** 2026-11-20
- **Status:** accepted
- **Context:** The user found that Back always played the same default effect (`backForward: 'reverse'` only mapped the default effect through a fixed table, shatter → assemble), and that the docs playground forgot its settings on Back. Plan section 3.6 (M13).
- **Decision:**
  1. **Memory** (`src/runtime/history.ts`): per tab, a list of `{ key: pathname + search, effect name, origin }` with a position, mirroring the session history, in `sessionStorage` (`shatter-router:history`, at most 50 entries). A forward transition records an entry after the position (dropping later ones, as browsers do) or, with `TransitionRequest.replace`, overwrites the current one. A `direction: 'back'` transition looks the arriving URL up before the position (Back), after it (Forward), then anywhere (`history.go(n)`, nearest), then next to the position by pathname only (a page that rewrote its own query with `replaceState`, like the playground; the entry takes the new key). Not found: the memory starts over. The memory is keyed to the URL when `createShatter` ran (`RuntimeHost.startKey`), because the lazy runtime may first load for a Back, after the URL has changed.
  2. **`backForward: 'mirror'`** is the new default. Back plays the reverse of the effect that brought the user to the page being left, from the same impact point; Forward replays that effect from its point. The reverse of `flip` is `flip` with `uDirection = -1`, of `assemble` is `shatter`; a custom effect with `needsIncomingSnapshot` runs as itself backwards; every other effect (shatter, explode, implode, custom falling effects) gets `<name>:reverse`. Without a memory (the landing page) Back reverses the default effect. `'reverse' | 'same' | 'none'` are unchanged.
  3. **`<name>:reverse`** (`src/engine/effects/reverse.ts`, resolved and cached by `engine.resolveEffect`): two layers in one draw call. Layer 0 is the outgoing page at rest; layer 1 is the incoming page running the base effect's `shardMotion` (renamed `forwardMotion`) at `uTime = uDuration - uTime` (ADR-038), with the base fragment chunk applied. At rest only layer 0 is drawn (first-frame seam); every falling effect ends at alpha 0, so the first moving frame is unchanged; the last frame (`uTime >= uDuration`) draws layer 1 exactly at the rest pose (last-frame seam), whatever the base effect does at its own t = 0. `explode`'s motion stretch was already 0.6 × the speed ratio at t = 0 (forward it only popped in on the first moving frame; reversed, the last frame was 10 % off): it now ramps in over 50 ms. Physics never drives a reverse (it is keyed by effect object).
  4. **Adapters** pass `replace` for replace navigations (`useShatterNavigate`, React Router links to the current location, Next `router.replace`).
  5. **Docs playground** keeps every non-default setting in the query string (`configToSearch` / `configFromSearch`, values validated and clamped), written with `history.replaceState` at the end of a drag and debounced 250 ms during one (browsers rate-limit `replaceState`; Safari throws). Other query parameters are kept.
  6. **Size:** the runtime chunk grows from 7.76 to 8.68 kB gzip; its budget goes from 8 to 9 kB. It is lazy and loads at idle; the core entry stays at 1.83 kB.
- **Alternatives considered:** a fixed reverse table per effect (cannot cover custom effects or the impact point); playing the forward effect with `uDirection = -1` (falling effects have no reverse built in, and the last frame would not be the incoming page); `history.state` for the memory (adapters and routers own it, and Next rewrites it); keying by pathname only (a search-only navigation would look like Back).
- **Consequences:** Unit tests: `test/history.test.ts` (memory, reverse wrapper) and the mirror block in `test/effects.test.ts`. E2E: vanilla (every falling effect reversed and replayed; first- and last-frame seams of `shatter:reverse` and `explode:reverse`), React Router and Next (reverse, last-frame seam, replay), docs (playground state through Back and reload). A navigation the runtime never saw (a router navigation without a transition) is not in the memory; Back from it reverses the default effect.

## ADR-048 — Effects as lazy plugins and a composition API

- **Date:** 2026-11-20
- **Status:** accepted
- **Context:** M14 (plan 3.1). The engine chunk is 20.05 of 22 kB gzip. An esbuild analysis (minified, before the GLSL minifier) shows d3-delaunay at 30 % of it, only used by the Voronoi fracture, and the five effects at 15 %. M15–M16 add about 10 fracture patterns, 20 motions and 7 materials, which cannot all live in one chunk. Acceptance: engine core ≤ 15 kB, current effects as presets, existing API unchanged, no seam or fps regression.
- **Decision:**
  1. **Patterns** (`FracturePattern { name, cells(input) → Shard[] }`): the fracture splits into a generic part in the engine core (`buildMesh`, polygon helpers, shard count tiers) and lazily loaded patterns. `impact` (seed sampling + Voronoi via d3-delaunay) is the first pattern and its own chunk. `ShatterEffect.pattern` names the pattern (default `'impact'`); `seedPoints` stays an `impact` feature.
  2. **Motions:** the built-in effects (`shatter`, `explode`, `implode`, `flip`, `assemble`) each become their own lazy chunk. The `ShatterEffect` interface (ADR-021) is the motion interface, so custom effects keep working and can be used as motions.
  3. **Stagger** is engine-side: before `shardAttributes`, the engine computes a per-shard `order` in [0, 1] from `effect.stagger` (`'radial'` default, `'linear'` with an angle, `'spiral'`, `'random'`, `'reading-order'`). Effects read it as `ctx.order[i]` and in GLSL as `shard.order` (a third texel per shard; the 8 effect floats are unchanged). The built-in motions use `order` for their start delays; `'radial'` is exactly the `r` they used before, so the presets render as before.
  4. **Composition:** `EffectComposition { name?, motion, pattern?, material?, stagger?, timing?: { duration? } }` can be passed wherever an effect is (`effect` option, `transition({ effect })`, `registerEffect`). The engine loads the motion and the pattern, then wraps the motion with the composition's name, pattern, stagger and duration. A built-in effect name is a preset composition of its own motion.
  5. **Loading:** `engine.loadEffect(effect, registry): Promise<ShatterEffect>` replaces the synchronous `resolveEffect`. The runtime starts it in parallel with the capture. Chunks are prefetched: the default effect and the `shatter` substitute when the engine warms up, and a link's own `data-shatter-effect` / `effect` on hover or pointerdown (with the precapture).
  6. **Materials:** the composition accepts `material`; only `'glass'` exists in M14 and it is the shader the core already has. M16 adds material variants with their own chunks when they bring shader code.
  7. **Physics** finds the built-in motions it can drive through a weak map filled as their chunks load (a composition of such a motion keeps it), not by object identity with statically imported effects.
  8. **Build:** every pattern and motion is a tsup entry under `dist/patterns/` and `dist/effects/` so size-limit can budget each one. The engine imports them dynamically.
- **Alternatives considered:** one chunk with every effect (the budget breaks in M15); pattern and motion selection compiled into one big shader with branches (larger shader, slower compile, no lazy loading); a composition helper returning a synchronous `ShatterEffect` (cannot be lazy); stagger as a time offset in the shader's `main` (changes the meaning of every effect's time and breaks their completion checks).
- **Consequences:** The first transition with an effect waits for its chunk (a few hundred bytes to ~7 kB gzip), usually already prefetched. The engine API is async where it resolves effects. `EffectContext` gains `order`; GLSL `Shard` gains `order`. Size budgets per chunk. Measured: engine core 11.45 kB (budget 15), motions 0.87–1.35 kB (budget 2 each), `impact` 8.19 kB with d3-delaunay (budget 9). The runtime chunk grew to 9.0 kB (composition-aware memory, prefetching) and its budget goes from 9 to 10 kB. Every seam, draw-call count and allocation result is unchanged from M13.

## ADR-049 — Before a capture, a fractional scroll is settled to the whole device pixel below

- **Date:** 2026-11-21
- **Status:** accepted (Firefox CI on `3066a9a`: every fractional-scroll seam 0.0000 %)
- **Context:** PR #16 CI: the `sweep` first-frame seam measured 0.81 % and 1.17 % on Firefox after `hover()` scrolled the page, while every unscrolled Firefox seam was 0.0000 %. The capture copies the unscrolled DOM and pulls the copy up by the root's live offset. Firefox keeps fractional scroll positions (CI: `scrollY` 240.25 / 240.5 / 240.75); Chromium and WebKit round `scrollTo()` to whole pixels. Reproduced on purpose (`seam.spec.ts`, fractional offsets): Firefox 1.30 % / 1.04 % / 0.13 % (worst block 10.4 %); 0.0000 % at 240.
- **Measured (`e2e/vanilla/scroll-snap.spec.ts`, Firefox CI):** on a plain page the scrolled content is drawn at the whole pixel below at all three offsets (0 differing pixels against a scroll of 240). With a fixed badge or a sticky header the content still sits there but those elements are drawn at other sub-pixel positions (275–442 pixels differ). So no single shift of the copy can match a fractionally scrolled Firefox page.
- **Attempts that failed, kept for the record:** shifting the copy by the offset rounded to nearest (my inference from the seam percentages: passed .25, failed .5 with 2.31 % and .75); rounded down (passed .25, failed .5 and .75 with 2.31 % on the real `/work` page). Earlier still, the e2e test was changed to avoid scrolling twice; that hid the problem.
- **Decision:** `settleScroll(window)` runs at the start of every capture: a fractional scroll position is moved to the whole device pixel below (`floor(scroll × ratio) / ratio`, `behavior: 'instant'`). The scrolled content does not move (Firefox already draws it there); fixed and sticky elements settle by under a pixel. At a whole-pixel offset page and copy match exactly. The copy's shift and nested scrollers keep `snapScroll` (the same rounding). On Chromium and WebKit nothing happens.
- **Alternatives considered:** a larger seam tolerance for Firefox (hides a visible jump); keeping tests off scrolled pages (hid it); emulating Firefox's per-layer snapping in the copy (undocumented and layer-dependent).
- **Consequences:** a capture may change `scrollY` by under one device pixel (a `scroll` event fires). The diagnostic stays as a guard; the seam suite checks 240.25 / 240.5 / 240.75 px at DPR 1 and 2.

## ADR-050 — The "Material lab" design system for the docs site

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** M19 (plan section 4, art direction A chosen by the user, ADR-046). The site was a dark editorial page with a serif; the review asked for a production-grade, interactive theme that is not generic. Constraints: every capture inlines the site's fonts (ADR-043), every visual must survive the DOM capture so first- and last-frame seams hold, Lighthouse ≥ 95 / 100 on mobile, and every motion needs a reduced-motion variant.
- **Decision:**
  1. **Palette as tokens.** Light by default ("bench": warm off-white, ink-black text, hairline rules) and a dark variant ("lab at night"), from `prefers-color-scheme` unless the visitor picks one; one signal colour (safety orange-red) only for impact points, active states and readouts. Tokens live on `:root` / `[data-theme]`.
  2. **Materials.** A switcher in the header picks glass, ice, obsidian or paper: each retints the surfaces, the scrollbar shard, the cursor ring and the readouts (`[data-material]`). Switching plays a real transition (`flip`, whose back face shows the page in the new material). Theme and material are remembered (`localStorage`) and applied by an inline script before first paint (no flash). Tying the shards' own tint to the material needs engine materials (M16): until then the glass tint stays the default.
  3. **Type.** Bricolage Grotesque (display and text, weight axis only) and Martian Mono (labels, readouts, code), self-hosted by `next/font`; only the display face is preloaded. Sizes are measured in PROGRESS (captures inline them).
  4. **Glass scrollbar.** The native scrollbar is hidden (`scrollbar-width: none`, WebKit pseudo-element); a fixed rail with a shard-shaped thumb shows position, stretches with scroll velocity (spring), can be dragged and clicked. Native scrolling (wheel, keys, touch, screen readers) is untouched; the rail is `aria-hidden` and hidden on coarse pointers. It is part of the page, so captures include it.
  5. **Micro-interactions.** Buttons crack on press and heal; cards tilt under a sheen that follows the pointer; nav labels split along a crack on hover; a cursor ring follows the pointer and grows over links (native cursor kept; hidden on touch and reduced motion). Instrument readouts show the last transition's capture ms, shard count and fracture ms from the library's events.
  6. **Entrances only on first load.** Headline reveals run on the first page load only. On client navigations the transition is the entrance; an animation running under the overlay would be frozen half-way into the incoming capture of `flip`/`assemble` and break the last-frame seam.
  7. **Reduced motion:** every animation and the scrollbar stretch are off; the cursor ring is not shown.
- **Alternatives considered:** a dark default (the review called the dark theme generic; the plan's direction is light); a serif text face (the direction asks for a technical grotesk); a WebGL-rendered scrollbar (would not be captured, needs a second context); hiding the cursor (an accessibility cost for no gain).
- **Consequences:** e2e: theme and material persist across reloads and navigations, the switch plays a transition, the rail tracks and drags, reduced motion turns animations off, first-frame seam of the landing page in both themes, Lighthouse. Sound (plan 3.8, ADR-046) comes with M17's interaction work.

## ADR-051 — Captures copy only real properties and only the font files the page draws

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** M19's redesign made the docs landing capture slower: 154–193 ms against 79–116 ms for the old site (headless Chromium, 3 warm captures). Measured by removing one thing at a time (7 warm captures each): web fonts, then the design tokens, then pseudo-elements and decorative elements. Read in modern-screenshot 4.7.0 (`dist/index.mjs`): `embedWebFont` inlines every `@font-face` of every used family whatever its `unicode-range` (it records the characters each family draws but does not use them for that); `getDiffStyle` copies every property of each element's computed style that differs from the sandbox default, and custom properties (all of a design system's tokens, inherited by every element) always differ.
- **Decision:**
  1. After the copy is built, `pruneFontFaces` drops the inlined `@font-face` rules whose `unicode-range` contains none of the characters the capture draws in that family (`context.fontFamilies`), keeping a face whenever in doubt (no or unreadable range, unknown family).
  2. The capturer sets the library's `includeStyleProperties` to the browser's computed property names without custom properties: computed values are already resolved, so tokens are dead weight on every element of the copy.
  3. The docs site keeps its decoration but avoids pseudo-elements and per-letter spans, which cost about 1 ms and 0.4 ms per instance per capture (backgrounds, two clipped copies per cracked label, numbers as text).
- **Measurements (headless Chromium, docs landing 1440×900, median of 7 warm captures):** old site on the old library 70–91 ms; redesign on the old library 184 ms; with font pruning 147 ms; with custom properties excluded 109–121 ms; with the site's pseudo-elements and letter spans reworked 69–78 ms. The old site on the new library: 46 ms.
- **Alternatives considered:** passing `font.cssText` to the library (it then skips its own URL-to-data conversion); fewer subsets in `next/font` (other sites would not benefit; a library fix helps everyone); keeping the custom properties and stripping them afterwards (they are already in the shared class rules by then).
- **Consequences:** unit tests for the range parser and the pruning rules; first-frame seams unchanged or better (docs landing 0.0096 % light, 0.0094 % dark in Chromium). A page that draws characters only through CSS `content` in a subset no text uses would lose that subset in captures (kept whenever the family's record is missing).

## ADR-052 — The copy leaves out what is below the fold

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** After ADR-051 the redesigned docs landing still captured in 98–122 ms on the GPU (3 captures per run, one run over the 120 ms budget). Profiling on the GPU by removing one thing at a time: removing the content below the hero cut the median of 7 warm captures from 91 to 52 ms. The capture copies the whole document with every element's computed style, although only the viewport is drawn; long pages are mostly below the fold.
- **Decision:** `CloneSession.filter` leaves an element out of the copy when it starts below the viewport (plus the 128 px visibility margin), its parent lays children out in block flow (`block`, `flow-root`, `list-item`: a later child cannot move an earlier one), it is statically or relatively positioned, and nothing inside it is fixed, sticky or on screen. The parent's copy keeps its live `height`, so the parent and everything after it lay out exactly as on the page. Elements scrolled off the top are kept (leaving them out would move what follows).
- **Alternatives considered:** substituting same-size empty boxes (margins that collapse through a child would change); a smaller copy area for the whole document (the library lays out the root at full size); skipping elements above the viewport too (shifts the visible content).
- **Consequences:** Every seam in the suite is unchanged to four decimals (vanilla first/last frames, scrolled and fractional offsets, React Router, Next, docs landing light and dark). GPU, installed Chrome, docs landing 1440×900: 3-capture medians 75.9 / 74.9 / 78.6 ms (old site on the old library: 82 ms); 7 warm captures median 51 ms. The first capture after load stays the slowest (103–123 ms).

## ADR-053 — Geometric fracture patterns, each its own chunk

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** M15 (plan 3.2). ADR-048 made patterns lazy plugins with one pattern, `impact` (Voronoi, d3-delaunay). A pattern returns convex cells that tile the viewport exactly; the mesh, the crack and every motion work on any such cells.
- **Decision:**
  1. Seven geometric patterns in four lazily loaded chunks by family (they share most of their code within a family), each chunk with its own budget, none depending on d3 — `grid` (tiles, bricks, strips), `web` (radial, rings), `hex`, `triangles`: `radial` (a spider web: jittered rays from the impact point crossed by jittered rings, sharing vertices so cells meet exactly), `rings` (clean concentric bands cut into short arcs, for ripple motions), `triangles` (a jittered grid split into triangles), `hex` (a honeycomb), `bricks` (offset rows), `tiles` (a square grid) and `strips` (vertical blinds). Cells that cross the viewport edge are clipped to it (Sutherland–Hodgman on a convex polygon stays convex); cells entirely outside are dropped.
  2. Each aims at the requested shard count (`shards`, already clamped to 12–400) except `strips`, which uses fewer, wider pieces (blinds read as blinds).
  3. Deterministic for a `seed` like `impact`; the jitter keeps the look hand-made, not a CAD drawing.
  4. Used through compositions (`{ motion, pattern }`) or `ShatterEffect.pattern`; the playground gets a pattern control.
  5. **Not in this milestone:** `dom` and `text` need the page's layout boxes in the pattern input (the capture would hand them over), `mask` needs an image input, and `pixels` needs thousands of pieces (beyond the 400-piece mesh; it belongs with the `dust` motion in M16). They stay in the plan, tracked in HANDOFF.
- **Alternatives considered:** one chunk with every pattern (they are small, but the budget per part is the point of ADR-048); Delaunay for `triangles` (would pull d3 into another chunk); true circular arcs for rings (not convex; short straight arcs are).
- **Consequences:** unit tests per pattern (cells tile the viewport: area sum and no point uncovered, every cell convex and inside, count range, determinism, fracture time ≤ 4 ms at 400 pieces), first-frame seams per pattern on all engines.

## ADR-054 — `shatter` falls, `explode` blasts

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** The user's review: "Shatter and Explode are same". `explode` differed only by a stronger impulse, drag and a gravity delay; both cracked first and both used the Voronoi `impact` pattern. Plan 3.3 defines them as two different events.
- **Decision:**
  1. `ShatterEffect.crackDuration` (ms, default 140) sets how long the crack takes to reach the farthest corner.
  2. `shatter` is a falling pane: a long, visible crack (380 ms), then pieces drop under gravity near the impact first (stagger 0.22 s), with an outward speed of 0.32 × the impulse, no upward kick, a slight lean toward the viewer and a slow tumble.
  3. `explode` is a blast: no crack, the `radial` pattern by default, a white flash around the impact (fragment chunk, peaking at 35 ms, gone by 220 ms), a shockwave that lifts each piece toward the viewer as the front reaches it (front from impact to farthest corner in 0.16 s, the pieces' start delays), a decaying camera shake (all pieces move together), then the existing drag-and-stretch flight and gravity. Every addition is exactly zero at t = 0 (guarded by `smoothstep(0, …, uTime)` or `sin`), so the first frame is the page; the reverse ends on the page because the reverse wrapper draws the rest pose at its end (ADR-047).
  4. The per-shard data layout is unchanged (`a = (v0, delay)`, `b = (axis, ω)`), so Rapier physics still drives both.
  5. The web patterns (`radial`, `rings`) aim at the requested piece count on the page: the web reaches past the corners, so they rebuild with a scaled count (up to three times) when fewer than 90 % of the pieces landed on the page (`explode` had 101 of 160 pieces before).
  6. `crackAt` writes into a frame object the engine reuses: a longer crack made its per-frame result object show up in the allocation test (640 B > 400 B).
- **Consequences:** unit tests pin the difference (crack, pattern, speeds ≥ 5× apart, no upward kick, t = 0 guards); side-by-side frozen frames reviewed (`PROGRESS`); seams, reverses, allocations (0 B beyond boxed numbers for both) and draw calls unchanged.

## ADR-055 — Motion families: eleven motions, each its own chunk; the reverse keeps its parts

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** M16 part 2 (plan 3.3): motions in four families that each look clearly different, usable with any pattern and stagger, reversible on Back (ADR-047), within the per-chunk budgets of ADR-048.
- **Decision:**
  1. Eleven motions, one lazy chunk each under `dist/effects/` with a 2 kB gzip budget, registered in `plugins.ts` `MOTIONS`: gravity — `crumble` (bottom-up collapse: default stagger `linear` at 270°, `shatter`'s closed form so Rapier drives it, `PHYSICS_DAMPING.crumble = 0`), `rain` (straight drops that streak, `tiles` + `random`); force — `vortex` (a twister: whirls outward and up, inner pieces faster; the opposite of `implode`), `wind` (a gust away from the click's side, turbulence and flutter; each piece's push is solved so it clears the edge); order — `blinds` (`strips` turning edge-on, `linear`), `domino` (tips over its bottom edge toward the viewer, cascading, then drops), `slide` (`tiles` dealt out sideways, alternate rows opposite, back-in easing, earlier pieces ride 4 px higher), `fold` (origami: folds 180° over its edge facing the click, later folds on top); matter — `melt` (top held, stretched into drips whose speed varies across the page), `ripple` (the docs' `ripple-out` promoted: `rings` bobbing on a growing swell, tilting with the slope), `glitch` (`bricks` jumping in 24 fps steps, red/blue split and scanlines, rows dropping out).
  2. Rules every motion meets: the pose is the rest pose at t = 0 and every fragment term is 0 there; start delays come from `ctx.order`, so every stagger works; every piece is gone (alpha 0 or past the edge) by the end of the phase, so the reverse wrapper reverses it; `isComplete` allocates nothing; 8 floats per piece.
  3. `reach(shard, dx, dy)` (support distance of the outline) in `effects/common.ts` places hinges on a piece's edge (domino, fold, melt) and exit distances (slide).
  4. **The reverse wrapper (ADR-047) is fixed in three ways** found while testing these: it keeps the base effect's `pattern` and `stagger` (before, `explode:reverse` came back as Voronoi cells and a composition lost its stagger); the base fragment chunk reads `uIncoming` where it read `uPage` (it draws the incoming layer; `implode`'s lens bent the wrong page); and that chunk runs at the reversed time and never on the last frame (`glitch:reverse` ended with its split over the page, 8.99 %; `explode:reverse` flashed at the start instead of on arrival).
  5. Deferred, tracked in HANDOFF: `magnet` (pieces chase the pointer: needs pointer input during the motion, M17), `peel` (needs bending pieces, not rigid ones), `dust` (with the `pixels` pattern, beyond 400 pieces).
- **Alternatives considered:** one chunk per family (shared code is tiny; a per-motion budget is the point of ADR-048); a `pixels`-based `dust` now (the mesh caps at 400 pieces); a per-motion reverse table (the wrapper covers every motion that ends off the page).
- **Consequences:** chunks 0.54–1.09 kB; engine core 11.78 kB. E2E `motions.spec.ts`: every motion plays and lands, its motion frozen at t = 0 is the page (a check the fractured-still seam does not make; the v1 effects are included), and Back's reverse ends on the page. Unit tests in `test/motions.test.ts`. The vanilla example's `/effects` lists the families and reads `?motion=`.

## ADR-056 — The long-task budget leaves out the incoming page's capture

- **Date:** 2026-11-22
- **Status:** accepted (refines ADR-040)
- **Context:** Session 5, real-GPU run (RTX 4050, installed Chrome 157): `flip` and `assemble` failed the "no long task over 50 ms outside capture" check with one 68–139 ms task, where M10 reported none. Measured, not inferred: (1) an interleaved A/B of the `m15-patterns` build against this branch on the same machine shows the same tasks on both once the machine is warm, and none on either while it is cool; with this branch's extra example links removed the two are indistinguishable (captures 40–72 ms both). (2) A timeline of every long task against the phases (`[timeline]` in `performance.spec.ts`) puts them all inside the capture of the incoming page: one task starts 1 ms before the recorded capture start (it also finishes the ready-wait), one ends it (rasterising and uploading the texture). ADR-040's window (`covered` to `end`) counted that capture; it passed in M10 only because that capture was then split into tasks under 50 ms.
- **Decision:** the debug hook records `lastIncomingCaptureStart` (with the existing `lastIncomingCaptureMs`); the performance spec leaves out long tasks that overlap the incoming capture, as master prompt section 8 leaves out the capture step, and prints them separately with a timeline. Everything else in the window still counts.
- **Alternatives considered:** a larger long-task limit (would hide jank in the motion itself); keeping the old window and calling the failures noise (they repeat once the machine is warm); a time slack before `animating` (the measured tasks start before the capture's recorded start and end after it).
- **Consequences:** all 16 effects pass on the GPU (143–144 fps on the 144 Hz display, no long tasks outside capture); `flip`/`assemble` report 74–76 ms inside their incoming capture. Making that capture cheaper (the capture of a hidden page under the overlay) stays a possible later improvement, recorded in HANDOFF.

## ADR-058 — Falling effects decide completion from a last-visible time found once

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** PR #20's push CI run failed `shatter`'s allocation check with 640 B beyond boxed numbers (limit 400 B), on both tries; the PR run passed. The site's numbers: 6,255 boxed numbers in 75,700 B, against 75,060 B at 12 B each, so the excess is exactly 160 × 4 B: one batch of 160 numbers (one per piece) padded to 16 B, the V8 noise LEARNINGS records for `explode` (whose limit had been raised to 1000 B for it). The cause of the numbers: `isComplete` of `shatter`, `explode`, `crumble` and `rain` re-ran every piece's closed-form motion on every frame.
- **Decision:** while building its per-piece data (in `shardAttributes`, outside the frame loop), each of these effects scans every piece back from the end of the phase in 1/120 s steps for the last moment it is still on screen (the same test `isComplete` used), and remembers the latest of them per transition (`WeakMap` keyed by the data). `isComplete` compares the time with that one number (`finished()` in `effects/common.ts`); data built elsewhere is still checked piece by piece. `explode`'s 1000 B allocation allowance goes back to the 400 B every effect has.
- **Alternatives considered:** a higher allocation limit for `shatter` too (weakens a test that catches real per-frame objects); re-running the check fewer times (still per-frame work); solving each piece's exit time in closed form (perspective and the depth clamp make it piecewise; the scan is exact to a step and costs well under a millisecond once).
- **Consequences:** completion is decided at most one step (8.3 ms) later than before, never earlier (unit test). Local allocation runs: 0 B beyond boxed numbers in 12 of 12 for the four effects; boxed numbers per run fell from 5,000–6,700 to about 1,000 for `explode`. Less work per frame for every falling effect.

## ADR-057 — Materials are shading parameters; the sides of a piece at rest are not drawn

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** M16 part 3 (plan 3.4): glass, ice, mirror, obsidian, paper, metal, holo, combinable with every motion and pattern, all light exactly zero at rest (ADR-038); the docs site's material switcher (ADR-050) should make the transitions themselves of that material.
- **Decision:**
  1. A material is a set of numbers for the one shader, not shader code: `tint`, `tintStrength`, `sideShade`, `rim`, `rimWidth`, `glint`, `shininess`, `chromatic` (scale), `frost` (a 4-tap blur of moving faces), `reflect` (a soft studio sky on tilted faces), `iridescence` (thin-film colours on rims and glints), `brushed` (streaks across the glint), `diffuse` (faces turned from the light darken). Three `vec4` uniforms. Every term is multiplied by the existing gate `uLight × vMotion`, so it is exactly 0 at rest. Glass's values reproduce the M9 shading exactly.
  2. The table of seven built-ins and the resolver live in the engine core (`engine/materials.ts`, about 0.5 kB gzip with its shader): small data, no lazy chunk needed. Public types in `core/material.ts`; `BUILT_IN_MATERIAL_NAMES` exported.
  3. API: `material` option (name or object; an object fills in from glass, or from the built-in whose name it reuses), `transition({ material })`, a composition's or effect's `material`, `shatter.setMaterial()`. Precedence: the call's, the effect's own, `setMaterial`/option, glass. An unknown name throws before the capture, so the transition falls back and navigation completes. `glassTint` becomes an override of the material's tint, applied only when set.
  4. **Side faces of a piece at its rest pose are not drawn** (moved outside the clip volume in the vertex shader). Found by this work, measured: at motion t = 0, paper and metal differed from the live page by 0.78 % (glass 0.096 %) because, once moving, the engine draws every face and the sides of still pieces tie their neighbours in depth along every cut edge; glass's dark sides hid it on dark pages. After: 0.0830 % for every material, glass included. This also removes the faint web over the page being left during every Back (its pieces stay at rest for the whole reverse).
  5. The docs site calls `setMaterial` with the chosen material, and the switch's own flip runs in the new material.
- **Alternatives considered:** a lazy chunk of shader code per material (seven programs per motion, compile stalls, more bytes); materials as separate render passes (more draw calls); keeping `glassTint` as an always-on tint (every material would be glass-tinted).
- **Consequences:** engine core 13.36 kB (budget 15; 1.64 kB left for M17–M18). Unit tests `test/materials.test.ts`; e2e: every material's t = 0 frame is the page and Back's reverse ends on the page (Chromium 0.1051 / 0.1010 %, WebKit 0.0021 %); the docs switcher sets the transition material; every material 136–144 fps on the RTX 4050.

## ADR-059 — Easing of the motion's time, applied by the engine

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** Plan 3.3's shared controls: stagger (ADR-048), direction, intensity, easing, duration. Easing was missing.
- **Decision:** `timing.easing` on compositions and `easing` on effects: `'linear'` (default), `'ease-in'`, `'ease-out'`, `'ease-in-out'`. The engine maps the motion time before every frame and every `isComplete` call, `eased = D · f(t / D)`, with `f(0) = 0`, `f(1) = 1` and the time unchanged outside the phase, so the first and last frames (and the seams) are the motion's own, and an eased motion completes when its eased time says so. No shader change: the eased time is the `uTimeValue` uniform. The reverse of an eased effect uses the mirrored easing (`ease-in` ↔ `ease-out`), which retraces it exactly (`D − f′(t) = f(D − t)`, unit-tested). Intensity is the existing `impulse` and `gravity` options; direction is the linear stagger's angle.
- **Alternatives considered:** easing in GLSL (a uniform per effect and a branch per vertex for the same result); easing per motion constant (not shared).
- **Consequences:** `test/easing.test.ts`; the docs playground offers an easing select and writes `timing: { easing }` into the copied config.

## ADR-060 — Interaction and sound as opt-in options with lazy chunks; gestures reach any router

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** M17 (plan 3.5, 3.8): cursor kits, hover pre-crack, hold to charge, drag to tear, touch and haptics, procedural sound. Every adapter (vanilla, React, React Router, Next) starts transitions from its own click handler; the features must work through all of them, cost nothing when off, never break navigation, keep keyboard and reduced-motion equivalents and stay out of captures.
- **Decision:**
  1. Two options, `interaction: true | { cursor, charge, tear, preCrack, haptics }` and `sound: true | { volume }`, each served by a lazy chunk with its own budget (`dist/interaction.js` 2.3 kB, `dist/sound.js` 1.83 kB, 3 kB each). Off by default. No new package entry points.
  2. **Gestures:** the interaction chunk listens to pointer events on the document. A hold on a link (`charge`: 120 ms delay, full after 800 ms) or a drag across one (`tear`: mouse and pen, 2–8 points, ≥ 24 px) ends with a gesture `{ origin, intensity, path? }` that the core remembers for 1.5 s; the runtime takes it for the next forward transition. A tear released off the link clicks the link itself, so the app's own handler navigates. Requests may also pass `intensity` and `path` directly.
  3. **Intensity** scales the impulse by `0.5 + intensity` (a click is 0.5: unchanged). **A tear path** reaches the fracture: `impact` seeds cluster along it (46 % of seeds within 60 px of the path against 31 % without), each piece's distance (hence the stagger order) and `maxRadius` are measured to the path, and the crack front grows out from it (`uPath[8]`, `uPathCount` in the crack shader).
  4. **Cursor:** decorative (the native cursor stays), `aria-hidden`, `data-shatter-ignore` (never frozen into a capture), `pointer-events: none`, styled through the CSSOM only (allowed under a strict style CSP), shown for fine pointers only, its frame loop running only while it moves or charges. A pre-crack grows under it over links.
  5. **Touch:** long-press charge with haptic ticks (`navigator.vibrate`, 4 steps) and a buzz on the break; the context menu is held back while charging. Swipe-to-tear on touch is left out: it would need `touch-action: none` on links, which breaks scrolling that starts on a link.
  6. **Sound:** one `AudioContext` created after the first pointer or key press (browsers refuse audio before a gesture), then resumed; never under reduced motion. Each transition schedules at most about 40 WebAudio events at `animating`: crack ticks, a burst or a family-specific voice (thump, whoosh, wind, gurgle, glitch blips, water drops), pings in the material's range (paper rustles instead), tinkling falls; a reverse gathers instead. `shatter.setSound(on)` for a site toggle. A failure to load or play is silent and never touches the transition.
  7. **Keyboard and reduced motion:** keyboard activation plays the default intensity (charge is a pointer refinement, not required to navigate); under reduced motion the interaction chunk does not load and no sound plays. **Scroll-driven breaking** (plan 3.5) needs region transitions and moves to M18.
- **Alternatives considered:** subpath plugins like `rapier()` (more surface for the same lazy loading); per-adapter gesture plumbing (four implementations; a remembered gesture needs none); a `<style>` element for the cursor (blocked by strict CSPs); audio files (bytes and licences for what a few oscillators do).
- **Consequences:** core entry 2.32 kB (budget 6), runtime 9.82 of 10 kB (the next runtime feature needs its own chunk or a budget ADR), engine core 13.95 of 15 kB. Unit tests `test/interaction.test.ts` (path geometry, torn fracture, impulse scaling, sound gating, the kit's charge, tear and busy rules, the cursor's attributes).

## ADR-061 — Milestone 20 scope: what the site gets now, what waits for regions

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** Plan section 5 lists the site features: a Library browsable by family, pattern and material with live mini stages and a compare mode; effect pages with replay, slow motion, a timeline scrubber and the code; a Studio with presets, randomise, undo, URL state, export per framework and recording; docs with search, highlighting, copy buttons, framework tabs and a changelog; a showcase; a live benchmark. The engine always covers the whole viewport (ADR-042), so anything that breaks one card or one stage while the rest of the page stays live needs region transitions (M18). Master prompt rule 2 forbids invented content.
- **Decision:**
  1. **Waits for M18 (regions):** live mini stages on Library cards that break on hover-hold, the compare mode (two stages, one click), the strip of breakable specimens on the home page, scroll-driven breaking, and a timeline scrubber (pausing and seeking a motion is only possible through the debug hook's `setMotionTime`, which is test-only; a public seek API belongs with stages that are regions).
  2. **Out:** a showcase (no real sites use the library before 1.0; none will be invented); recording a GIF/WebM in the Studio (the overlay canvas holds only the glass: the page under it is DOM, so a canvas recording would show shards over nothing, and tab capture needs a permission prompt and a 1080p cap, ADR-041).
  3. **Library** (`/effects`): the 16 built-in motions grouped by family (gravity, force, order, matter, assembly) plus the docs' custom effect; a family filter; "break with" controls for the pattern and the material, which every card then uses (a composition `{ motion, pattern, material }`), because any motion takes any pattern and any material, so they choose how a card breaks rather than which cards show. All three live in the query string (`?family=&pattern=&material=`), so Back returns to the same view, and the cards pass them on to the effect page.
  4. **Effect page:** a client stage that replays the effect in place (a transition whose commit changes nothing, like the hero, ADR-042), slow motion (4× the effect's own duration through `timing.duration`), pattern, material and easing selects, the code for the current settings, and "Open in Studio" with the same settings in the playground's query.
  5. **Studio** (the `/playground` page, labelled Studio; the URL stays so shared links keep working): presets (named compositions), randomise, undo (a history of settings; button and Ctrl/Cmd+Z outside text fields), and the config exported for vanilla, React, React Router and Next.
  6. **Docs:** syntax highlighting at build with Shiki in the server `Code` component (CSS-variable theme mapped to the site's tokens, so light, dark and materials apply; code that changes on the client stays plain); a copy button on every block; framework tabs (vanilla, React, React Router, Next) that remember the choice in `localStorage`, applied before first paint like the theme (no layout shift); search on Ctrl/Cmd-K and `/` over an index generated from the pages' TSX source by a script (TypeScript compiler API), committed and checked in CI so it cannot go stale, loaded only when the dialog first opens; a changelog page rendered at build from `packages/shatter-router/CHANGELOG.md` plus the pending changesets as "Unreleased".
  7. **Benchmark page** (`/benchmark`): runs a fixed set of in-place breaks on the visitor's device with its own instance (160 pieces, seed 7, `shatter`), from the public events only (`covered.captureMs`, `fractured.fractureMs`, frames painted between `animating` and `end`), next to the reference machine's numbers from PROGRESS.
  8. No library API changes in M20, so no bundle budget moves.
- **Alternatives considered:** filtering cards by their default pattern (most motions default to `impact`, so the filter would show nearly all or one); hand-written search keywords (they drift from the pages); client-side highlighting (a highlighter in every page's JavaScript); a Studio recorder through `getDisplayMedia` (prompt, 1080p cap, the visitor's whole tab).
- **Consequences:** e2e for each feature; Lighthouse ≥ 95 / 100 on the new and changed pages; the capture cost of highlighted code (each token is an element, about 0.4 ms per capture, LEARNINGS) is measured on the docs pages.

## ADR-062 — The capture leaves out elements with `display: none`

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** M20's framework tabs keep every panel in the DOM and hide the unselected ones with `display: none` (ADR-061). LEARNINGS already recorded that `display: none` does not take an element out of a capture's cost: modern-screenshot 4.7.0 still clones and styles it, and the below-the-fold rule (ADR-052) cannot drop it because a hidden element reports a zero rect at the top of the page. Measured on `/docs/getting-started` (headless Chromium, 1440×900, interleaved, median of 18 warm captures): 228 ms with highlighted code in three hidden panels against 108 ms with the code as plain text.
- **Decision:** `CloneSession.filter` leaves an HTML element with computed `display: none` out of the copy, with no substitute and no height pin (it takes no space). Kept anyway: `<body>`, anything inside a `<select>` (a select shows its selected option even when that option is hidden, e.g. a "Choose…" placeholder), and a hidden element that contains an `<svg>` (a sprite sheet that `<use>` elements elsewhere point into). SVG-namespace elements are never left out by this rule.
- **Alternatives considered:** rendering only the selected tab panel (every app with hidden menus, dialogs or panels would still pay); removing hidden elements from the copy after cloning (the cost is in the cloning).
- **Consequences:** unit tests `test/not-rendered.test.ts`; every vanilla, React Router and Next seam unchanged (local Chromium + WebKit, 141 passed). Measured afterwards on the same page: hidden panels present 199 ms against removed from the DOM 194 ms (same within noise). Capture chunk 13.86 of 16 kB.
