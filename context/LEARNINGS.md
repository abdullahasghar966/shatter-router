# Learnings

Grouped by topic. Append, de-duplicate. Facts must cite package versions or commit SHAs.

## Environment (Windows)

- Machine: Windows 11, project path `D:\Shatter Router` contains a space: always quote paths in scripts and docs.
- Toolchain at session 1: git 2.55.0.windows.3, gh 2.96.0, Node v24.21.0, npm 11.19.0, pnpm 12.8.1 (global), corepack 0.36.0.
- GPU on the dev machine: NVIDIA GeForce RTX 4050 Laptop GPU (Chrome uses ANGLE D3D11).
- The local clock is PKT (UTC+5); `date` prints the zone as `PST`, which is Pakistan Standard Time here, not Pacific.
- No global git identity on this machine; the repo uses a repo-local identity (ADR-002).
- `pnpm exec playwright install chromium firefox webkit` took more than 10 minutes on this connection. Browsers land in `%LOCALAPPDATA%\ms-playwright`.
- **Playwright Firefox (build 1572, Firefox 159) does not launch on this machine.** Symptom: `browserType.launch: spawn UNKNOWN`; from cmd/PowerShell: "side-by-side configuration is incorrect"; Application event log (SideBySide): `Dependent Assembly mozglue ... could not be found` although `mozglue.dll` is present with an embedded manifest. `playwright install --force firefox` did not fix it; Smart App Control is off. Not diagnosed further (sxstrace needs admin). **Firefox e2e is verified on CI (Linux) only**; run local e2e with `--project=chromium --project=webkit`.

## Tooling

- **pnpm 12.8.1** blocks dependency build scripts by default and fails `pnpm add` with `ERR_PNPM_IGNORED_BUILDS`. Approve per package with `pnpm approve-builds <pkg>`; it writes `allowBuilds: { <pkg>: true }` into `pnpm-workspace.yaml` (currently only `esbuild`).
- **pnpm 12.8.1** has a minimum-release-age supply-chain policy. Installing a version younger than the threshold adds it to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` automatically (non-strict mode). Those entries are expected, not noise.
- **typescript 7.0.2** has no classic JS compiler API (exports only `./lib/version.cjs` and `unstable/*`). typescript-eslint 8.72.2 requires `<6.1.0`. See ADR-003.
- **typescript-eslint 8.72.2:** `tseslint.config()` is deprecated; use `defineConfig` from `eslint/config` (ESLint 10.15.0) and pass `tseslint.configs.strictTypeChecked` without spreading.
- **typescript-eslint projectService:** a file listed in `allowDefaultProject` that is also covered by a tsconfig is a hard parsing error. Only `*.js` (the ESLint config itself) is in `allowDefaultProject`; `playwright.config.ts` and `e2e/` are covered by the root `tsconfig.json`.
- **typescript-eslint `no-unnecessary-condition`** flags a second read of a getter after an `await` (TypeScript keeps the narrowing from the first read) and a `let` flag that is only assigned inside a callback. Use a method call, or a field on an object, for state that changes across awaits.
- **size-limit 14.3.0** (`@size-limit/preset-small-lib`, bundles with rolldown) reports **brotli** by default. The spec's budgets are gzip, so every check sets `"gzip": true`. It bundles dynamic imports into the measured entry; see ADR-011 for how the lazy chunks are budgeted separately.
- **tsup 9.0.0:** an entry that another entry loads with dynamic `import()` is emitted under its entry name (`dist/engine.js`) and referenced as `import('./engine.js')`. `dts: { entry: { index: 'src/index.ts' } }` limits declaration output to the public entry.
- **Vitest 5.1.0 + happy-dom 21.0.4:** the document URL defaults to `about:blank`; set `environmentOptions.happyDOM.url` so relative `href`s resolve to an http(s) origin. happy-dom has no WebGL2, so `createShatter` tests exercise the fallback path.
- **Shell quoting:** heredocs and `node -e "…"` strings that contain apostrophes, backticks or nested quotes have failed several times in this harness (`unexpected EOF while looking for matching`). Write files with the file tool; keep inline scripts free of apostrophes.
- **React `act()` + a commit that waits for a render deadlocks in tests:** inside `act(async () => { await navigate() })` React holds the render until the callback returns, while the commit waits for that render (it resolved only at the 1500 ms timeout). Start the navigation inside `act` and await it after `act`.
- **happy-dom 21.0.4** `history.back()` fires `popstate` (through its browser frame); unit tests can exercise back/forward.
- `@types/react 19.3.0`: `ref` is a plain prop for function components (React 19), no `forwardRef` needed.
- **Prettier** rewrites Markdown tables with padding; `context/` is in `.prettierignore` so the context files stay easy to edit.

## API facts (verified from installed type definitions and source)

- `size-limit@14.3.0` `Check`: `gzip?: boolean` ("use Gzip and disable Brotli"), `brotli?: boolean`, `import?: string | Record<string, string>`, `path`, `limit`, `ignore?: string[]`. `ignore: ["./engine.js", "./capture.js"]` on the core check excludes the lazy chunks (passed to the bundler as externals).
- **modern-screenshot 4.7.0** (read from `dist/index.d.ts` and `dist/index.mjs`):
  - `createContext(node, options)` resolves only after `waitUntilLoad` (every `<img>`/`<video>` under the node loaded, or `timeout` ms, default 30000). With `autoDestruct: false` the context can be passed to `domToForeignObjectSvg(context)` repeatedly; before each reuse `svgStyleElement` and `svgDefsElement` must be replaced and `svgStyles` cleared (`domToCanvas` does that internally; `createStyleElement` is not exported).
  - `context.width/height` size the cloned root (with `!important`) and the SVG; they are plain mutable fields.
  - Hooks: `filter(node)` is called for each child (text nodes too; never for `<style>`, `<script>` or comments) right before it is cloned. `onCloneEachNode(cloned)` runs after the node and its subtree are cloned (not for text nodes, and before the clone is attached to its parent). `onCloneNode(root)` runs once the tree is complete, before fonts and images are embedded. `onCreateForeignObjectSvg(svg)` runs last. Hooks receive only the clone, never the original.
  - A same-origin `<iframe>` is replaced by a clone of its document, and `onCloneEachNode` fires twice with that same clone.
  - Computed styles are inlined as a diff against per-tag defaults measured in a sandbox `<iframe id="__SANDBOX__…">` that the library appends to `document.body` (a DOM mutation: filter it out of captures and mutation tracking). `width` and `height` are always inlined as computed values.
  - `embedImageElement` fetches `currentSrc || src` unless it is a `data:` URL. An `<img>` with an empty `src` makes it fetch the page itself: give skipped images a tiny data URL instead of removing `src`.
  - `features.restoreScrollPosition` (default off) translates the children of any scrolled element, including `<body>` for the window scroll.
  - Its own rasteriser (`domToCanvas`) redraws the image up to N times, 100 ms apart, in Safari and Firefox (`drawImageCount`). We rasterise ourselves and have not needed that in Playwright WebKit so far.
- **d3-delaunay 6.0.6** (read from `dist/d3-delaunay.mjs` and `@types/d3-delaunay` 6.0.4):
  - `new Delaunay(flatFloat64Array)` avoids the `[x, y]` arrays `Delaunay.from` needs. `voronoi([xmin, ymin, xmax, ymax])` takes **bounds**, although the `Bounds` type comment says "[x, y, width, height]".
  - `cellPolygon(i)` returns a **closed** ring (first vertex repeated) and **`null`** for coincident points or cells clipped away, although the type says `Polygon`. `renderCell(i, context)` (public) draws nothing in those cases and avoids the allocation; it calls `moveTo` once, `lineTo` per vertex, `closePath` at the end.
  - Rings are counter-clockwise in y-up maths, so **clockwise on a y-down screen** (positive shoelace sum). We reverse them.
  - A single seed yields the whole bounds rectangle.
- **react-router 8.5.1** (read from `dist/development/lib/*.js` and `dist/production/lib/*.d.ts`):
  - `<Link>` calls the app's `onClick` first and its own handler only `if (!event.defaultPrevented)`; with `reloadDocument` the app's `onClick` is passed straight to the `<a>`.
  - Router state updates (declarative `BrowserRouter`/`MemoryRouter` and data `RouterProvider`) are wrapped in `React.startTransition` unless `useTransitions === false` or the navigation passes `flushSync: true`, so `flushSync(() => navigate(to))` does **not** render synchronously. Detect "rendered" with a layout effect on `useLocation().key`.
  - `useNavigation()` throws outside a data router (`useDataRouterNavigation` invariant). It reads `UNSAFE_DataRouterNavigationContext` (`{ navigation, revalidation }`), which is `null` in declarative mode.
  - Declarative `useNavigate()` returns `void`; data-mode `useNavigate()` returns a promise that resolves when the router's navigation completes (before React has rendered it). The navigate function is a no-op until its component's layout effect ran.
  - The browser history listens with `window.addEventListener('popstate', handlePop)` (bubbling); `handlePop` reads the index from `window.history.state.idx`, so a later, re-dispatched popstate is handled correctly.
  - The location key lives in `history.state.key` (`getHistoryState` in `lib/router/history.js`: `{ usr, key, idx }`); the first entry has no key and its location key is `'default'`.
  - Peer dependencies: `react >=19.2.7`, `react-dom >=19.2.7`.
- **next 16.4.6** (read from `dist/client/components/app-router.js`, `dist/client/app-dir/link.js`, `dist/shared/lib/*.d.ts`):
  - `AppRouterInstance`: `push(href, { scroll?, transitionTypes? })`, `replace`, `back`, `forward`, `refresh`, `prefetch`, plus a required `bfcacheId: string` (test stubs need it).
  - The App Router listens with `window.addEventListener('popstate', onPopState)` inside a passive `useEffect` (no capture); `handlePopState(state)` reloads the page when `state.__NA` is missing and ignores a null state. It patches `history.pushState/replaceState` to copy its internal state. It never sets `history.scrollRestoration`.
  - App-dir `<Link>`: the app's `onClick` runs first, then `if (e.defaultPrevented) return`; modified clicks and `download` are left to the browser; `onNavigate({ preventDefault })` can cancel.
  - `useRouter`/`usePathname`/`useSearchParams` read `AppRouterContext` (`next/dist/shared/lib/app-router-context.shared-runtime`) and `PathnameContext`/`SearchParamsContext` (`next/dist/shared/lib/hooks-client-context.shared-runtime`): unit tests can provide them directly, and `next/link` then renders in happy-dom.
  - Peer dependencies: `react`/`react-dom` `^18.2.0 || ^19.0.0`.
- **esbuild (tsup 9.0.0) drops `"use client"`** when bundling; it is added to the built client entries afterwards (ADR-034).
- **WebGL2 upload settings that keep the capture bit-identical:** `UNPACK_FLIP_Y_WEBGL=false`, `UNPACK_PREMULTIPLY_ALPHA_WEBGL=true`, `UNPACK_COLORSPACE_CONVERSION_WEBGL=NONE`, internal format `RGBA8` (not `SRGB8_ALPHA8`), `LINEAR` filtering, `CLAMP_TO_EDGE`, context `premultipliedAlpha: true`.

## Bugs found

- **Example re-rendered on in-page anchor clicks.** Symptom: e2e "same-page hash links do not re-render the route" failed (the marked `<h1>` was replaced). Root cause: browsers fire `popstate` for fragment navigations too, and the example's `popstate` handler always re-rendered. Fix: remember the rendered route and re-render only when it changes (`examples/vanilla/src/main.ts`, commit `14966aa`). The adapters must apply the same rule: a hash-only `popstate` is not a route change.
- **WebKit drew the copy unscrolled (65 % seam diff).** Root cause: WebKit reports `view-transition-name: root` as a computed style of `<html>`; inlined on the clone it creates a layer, and WebKit positions layered HTML inside an SVG image without the SVG `viewBox` offset. Fix: strip `view-transition-name` from clones and shift the root with negative margins instead of a `viewBox` offset (ADR-008).
- **ClearType text turned grayscale in the overlay (Windows Chromium, 0.54–0.70 % seam diff).** Root cause: an SVG rasterised onto a canvas with an alpha channel cannot use LCD antialiasing. Fix: `getContext('2d', { alpha: false })` (ADR-009).
- **WebKit at 2x: content below a fractional-height box sat one device pixel low (0.55–0.68 %).** Root cause: WebKit snaps to whole CSS pixels inside an SVG image but to device pixels in the live page. Fix: lay the copy out in device pixels with CSS `zoom`, on WebKit only (ADR-010).
- **Transitions hung in an unpainted browser pane.** Root cause: `requestAnimationFrame` does not fire while the page is not being painted. Fix: `nextFrame()` races rAF against a 120 ms timer (`src/core/frame.ts`).

- **Linux CI Chromium at 2x: 0.82 % seam diff on text only.** Glyphs a fraction of a device pixel apart between live paint and the SVG copy. Neither layout grid fixes it (spike/linux-layout-grid: css 0.82 %, device 0.97 %). Handled in the metric (ADR-014).
- **Firefox on Linux CI had no WebGL2.** Headless: `AllowWebgl2:false`; with `webgl.force-enabled`: `FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS`, even with Mesa installed. Headed under `xvfb-run` with Mesa: works, 0.0000 % seam (ADR-015).
- **Linux CI Chromium at 2x after the shift-tolerant metric: 0.5247 %.** Remaining pixels are text lines one device pixel lower in the copy on fractional line heights; `text-rendering: geometricPrecision` did not help (0.80 % / 0.98 %). Measured ceiling 0.6 % (ADR-016).

- **WebKit copy wrapped a button's last word** ("See the work"), invisible to the whole-screen seam number (0.03 %). Root cause: glyphs a hair wider in the zoomed copy, box width inlined at the live text width. Fix: `keepSingleLines` nowrap spans; plus a local "worst block" seam check (ADR-019).
- **Impact flash lingered** (a third of its peak at 60 ms). Squared the pulse (crack.ts); caught by the unit test.

- **`centroid` is a reserved word in GLSL ES 3.00** (interpolation qualifier). A struct field named `centroid` failed to compile ("'centroid' : syntax error") and every transition fell back. Renamed to `center`; the debug-mode log of pipeline errors (`[shatter-router] transition failed`) found it.
- **`window.visualViewport` is `undefined` (not `null`) where it is missing** (happy-dom, older browsers). `readViewport` checked `!== null` and crashed. Fixed with `?? null`.
- **`document.images` is not iterable in happy-dom 21**; `document.fonts` and `img.decode` may be missing. `ready.ts` uses `querySelectorAll('img')` and guards both.
- **Pre-capture was always "dirty"**: modern-screenshot sets `srcdoc` on its sandbox iframe after inserting it, an attribute mutation our observer counted. Mutations inside `#__SANDBOX__*` now count as our own.
- **View Transition `ready` rejects when the transition is skipped** (hidden tab, "Transition was aborted because of timeout in DOM update"); unhandled, it shows up as an uncaught promise rejection. `crossfade.ts` attaches a catch.

- **Firefox: setting an <img> clone's `src` does not update `currentSrc` synchronously.** modern-screenshot reads `currentSrc || src`, so it fetched the original cross-origin URL (and it succeeded only because Vite preview sends CORS headers by default; the fixture now sets `preview.cors: false`). Unfetchable images are now fresh substitute elements (ADR-023).
- **Playwright WebKit on Linux has `captureStream` but the canvas-stream video never reaches readyState 2**; the lab test accepts the background colour when no frame arrives within 5 s.

- **React Router back/forward played no effect in Chromium** (data mode). Symptom: `page.goBack()` with `pauseAt('covered')` never paused; an earlier back test passed only because it read the hook's last values, which came from the forward transition. Root cause: listener order (see Browser quirks) plus React's synchronous popstate render. Fix: popstate gate installed before the router, `createShatterBrowserRouter` (ADR-028). Lesson: assert on the lifecycle events of the navigation under test, not on "last" values.
- **Playwright WebKit on Windows follows a Ctrl-click on a link in the same tab** (no new tab). Tests of "modifier clicks are not intercepted" check `event.defaultPrevented` at the document instead of the resulting URL.

- **A `<button>` without an app `font-family` was serif in the copy on Linux WebKit** (PR #5 CI, worst block 15.3 %). Root cause: the platform font of form controls is not inlined by modern-screenshot (equal to its sandbox default), and an SVG image resolves the control default differently. Fix: pin the computed font longhands on form controls (ADR-029). Windows WebKit did not show it: check CI diff images, not only local numbers.
- **Firefox warns "Loading failed for the module with source …"** when a document unload (a second `page.goto`) aborts the idle prefetch of the lazy chunks. Tests that navigate away wait for `waitForShatterReady` first.

- **Firefox scrolled the held old page on back** (PR #5 CI): with the entry's `history.scrollRestoration` = `auto`, Firefox applies the target entry's scroll position before `popstate`, onto whatever page is shown. Firefox reported `auto` on the first entry although React Router's `<ScrollRestoration>` had set `manual` at mount. Fix: the bridge keeps every entry `manual` and restores positions itself (ADR-030). Diagnosed with a scroll log printed from the CI test, since Firefox cannot run locally.

## Approaches that did not work

- **CSS `zoom` on the cloned root in Chromium** (to lay out at device resolution): moves text lines by one device pixel at DPR 2 (seam 0.06 % → 0.59 %). Chromium needs the copy laid out in CSS pixels.
- **A canvas probe to choose the layout grid** (a 1px bar at `top: 0.5px` in a 4x4 SVG drawn at 2x): Chromium and WebKit return identical pixels (`255 255 0 0 255 255 255 255` down the column), because both snap boxes to CSS pixels inside SVG images. They differ in the live page, which cannot be read back.
- **`--use-angle=swiftshader --enable-unsafe-swiftshader`** for headless Chromium: the GL driver warning stayed and captures slowed enough to trip the 250 ms budget.
- **CSS `zoom` (device layout grid) for Linux Chromium:** 0.97 % at 2x vs 0.82 % without; Linux Chromium needs the css grid too.
- **A local seam check on colour differences:** Windows Chromium's ClearType-vs-grayscale header text scored 15 %, the wrapped-word bug 18 %: no margin. Luminance-based structural pixels separate them (4 % vs 16.5 %).
- **SVG `viewBox` offset to emulate scroll:** fine in Chromium, wrong in WebKit as soon as a clone is layered (see Bugs).

- **Capture-phase `popstate` listener on `window` to run before React Router's** (ADR-026 as first written): works in WebKit/Firefox, not in Chromium (registration order wins at the target).

- **Pinning or resolving the computed font of form controls** (ADR-029, ADR-032) did not fix the serif button on Linux WebKit: the computed family is not what is painted.

## Browser / OS quirks

- **Headless Chromium** logs `GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels` as a console warning for any page that presents a WebGL canvas (software compositor read-back). Chrome on a real GPU does not print it. Filtered in `e2e/fixtures.ts` (ADR-013).
- **Headless Chromium has WebGL2** out of the box (software). Playwright WebKit on Windows has WebGL2 and the Popover API too.
- **`position: fixed` inside `<foreignObject>`** is positioned relative to the foreignObject (the SVG viewport when it starts at 0,0) in Chromium and WebKit, and is not moved by margins on the cloned root.
- **Playwright WebKit on Linux CI** with the device layout grid: 0.04–0.45 % raw at 2x (spike run), confirming ADR-010 on a second OS.
- **Playwright `devices['Desktop Safari']`** has `deviceScaleFactor: 2`, so every WebKit e2e test runs at 2x.
- On Windows, live Chromium uses LCD (ClearType) antialiasing for small text on opaque layers and grayscale for text in layers with `backdrop-filter`.
- At DPR 2, Blink places text lines on whole CSS pixels (live and in SVG images); WebKit uses device pixels live and CSS pixels in SVG images (ADR-010).
- **The Claude desktop app's browser pane** is not a benchmark: plain JavaScript ran ~5× slower than Node on the same machine (fracture 3.5 ms vs 0.6 ms in headless Chromium) and animation frames are throttled (a 350 ms transition took ~900 ms). Use it for visual checks; take numbers from Playwright or a real browser.
- **Headless Chromium (software GL):** ~80 ms between the capture finishing and the overlay showing at 1440x900, mostly the 5 MB texture upload. Re-measure on a real GPU in Milestone 10.
- **Playwright WebKit on Windows has no `HTMLCanvasElement.prototype.captureStream`**, so a canvas-stream video never gets a frame there.
- **Playwright WebKit on Windows crashes the page** when a View Transition starts right after a CSP-blocked data: image (strict-CSP fallback). Plain View Transitions, and the same fallback without CSP, do not crash. Test marked `fixme` on win32 WebKit; check CI (Linux).
- **Playwright `test.use({ option: [a, b] })`** treats an array as a fixture tuple `[value, options]`; pass a single value (we use one RegExp).
- **Software-GL parallel runs are slow**: with 4 workers on this laptop, headless Chromium animated at ~11 fps and WebKit ~15 fps; a single worker gives ~55 fps. Functional tests must not gate on frame rate.
- **Listener order at the `window` target differs by engine** (Playwright 1.65.1, measured with a bubble listener added before a capture listener, then a synthetic `popstate`): Chromium runs them in **registration order** (bubble first); WebKit runs the **capture listener first**. Do not rely on `capture: true` to get ahead of a listener on `window` (ADR-028).
- **React 19.3.1 renders a transition update made during a `popstate` event synchronously** (`shouldAttemptEagerTransition` in `react-dom-client`): React Router's route is committed inside its own `popstate` listener, before later listeners run.
- **WebKit's computed font of a `<button>` on Linux is `600 16px -webkit-standard`** (PR #5 CI); on Windows WebKit `13px MS Shell Dlg`, Chromium `13.3333px Arial`, Firefox (Linux) `13.3333px Sans`. `-webkit-standard` is also WebKit's `<html>` default. A 2D canvas accepts it (`ctx.font` reads back `72px standard`) and measures it with the live settings (ADR-032).
- **`getComputedStyle` does not tell which font a WebKit form control is painted in** (Linux CI): computed `600 16px -webkit-standard` (which is serif there: 763.8 px probe width, same as `serif`), painted in the system sans (743.9 px, same as `sans-serif`/`system-ui`). Measure the rendered text run instead (ADR-033). Chromium on Linux: `-webkit-standard` = serif (646.3 px), `system-ui` 743.9 px; Firefox: button computed `Sans`.
- `popstate` fires on same-document fragment navigation (clicking `<a href="#id">`) in Chromium, not only on history traversal.
