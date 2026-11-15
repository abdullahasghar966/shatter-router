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
