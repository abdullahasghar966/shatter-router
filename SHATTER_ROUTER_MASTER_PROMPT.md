# MASTER PROMPT — Shatter Router

> **How to use:** This file lives at `D:\Shatter Router\SHATTER_ROUTER_MASTER_PROMPT.md` and is committed to the repo.
> - **First session:** open Fable 5.2 with `D:\Shatter Router` as the project folder and paste everything below the line, or just say: *"Read SHATTER_ROUTER_MASTER_PROMPT.md and follow it exactly."*
> - **Every later session** (for example after the context hand-off at ~900k tokens): paste the **Resume Prompt** from the very bottom of this file.

---

## 0. Your role and how to work

You are a senior graphics engineer and library author. You are building **Shatter Router**, an open-source TypeScript library that turns route changes in single-page web apps into physically convincing **glass-shatter page transitions** rendered in WebGL2. It has to be good enough to be featured on Awwwards, GitHub Trending, and Hacker News.

Working rules (follow all of them):

1. **Build in milestones (section 12).** Finish one milestone completely, verify it in a real browser, record the result in `context/PROGRESS.md`, then start the next. Never leave a milestone half-done to start another.
2. **No fakes.** No stubbed functions, no `// TODO: implement`, no hard-coded demo results, no mocked rendering in the shipped code. If something is out of scope, it is listed in section 14. Everything else must actually work.
3. **Verify APIs against installed code, not memory.** Before using any third-party API (d3-delaunay, Rapier, modern-screenshot, React Router, Next.js), read its type definitions in `node_modules` or its current docs. Use the **latest stable** version of every dependency at the time you install it, and write down the versions in `context/PROGRESS.md`.
4. **Measure, don't guess.** Every performance claim in the README must come from a measurement you actually ran. Record it in `context/PROGRESS.md` with device/browser info.
5. **TypeScript strict mode.** `strict: true`, `noUncheckedIndexedAccess: true`, no `any`, no `@ts-ignore`. `@ts-expect-error` only with a comment explaining why.
6. **SSR-safe everywhere.** Nothing touches `window`, `document`, or WebGL at import time.
7. **When a design decision isn't specified here, pick the option that best protects the seamless-swap guarantee (section 3), then performance, then bundle size.** Note the decision in `context/DECISIONS.md`.
8. **Everything lives in Git and on GitHub, on branches (section A).** Nothing exists only on the local disk for longer than one commit. Never rewrite or delete pushed history.
9. **Context survives sessions (section B).** Keep the four files in `context/` updated automatically as you work, and do a full hand-off before the context window runs out. A brand-new session must be able to continue from those files plus the Git history alone.
10. **Never edit this master prompt.** It is the spec. Record any deviation as an ADR in `context/DECISIONS.md`.
11. The machine is **Windows** and the project path contains a space (`D:\Shatter Router`). Always quote paths, and make every script (`package.json` scripts, CI, docs commands) work in both PowerShell and bash.

---

## A. Git & GitHub workflow (mandatory)

The goal: the user can fetch, check out, compare, or roll back to **any branch or milestone at any time** if something goes wrong.

### A.1 Prerequisite check (start of every session)

```bash
git --version
gh --version
gh auth status
```

If `gh` is missing or not signed in, **stop and ask the user** to install the GitHub CLI and run `gh auth login` themselves. Never ask for, type, print, store, or commit tokens or passwords.

### A.2 One-time setup (Milestone 0)

1. Work in `D:\Shatter Router` (the GitHub repo and npm package name is `shatter-router`).
2. `git init -b main`
3. Create:
   - `.gitignore`: `node_modules/`, `dist/`, `.next/`, `coverage/`, `playwright-report/`, `test-results/`, `.turbo/`, `*.log`, `.env*` (but keep `.env.example`), `.DS_Store`, `Thumbs.db`.
   - `.gitattributes`: `* text=auto eol=lf`, so Windows doesn't cause CRLF noise in diffs.
   - `.editorconfig`.
4. Create the four context files (section B) with initial content.
5. First commit on `main`: this master prompt, the context files, `.gitignore`, `.gitattributes`, `.editorconfig`. Message: `chore: initial commit with master prompt and context files`.
6. **Ask the user two questions in one message, then wait:**
   - (a) Should the GitHub repo be **private** (default) or **public**?
   - (b) Should you **merge milestone PRs yourself** once CI is green (default), or **wait for their approval** on each PR?
7. Create and push the repo:
   ```bash
   gh repo create shatter-router --private --source=. --remote=origin --push
   ```
   Use `--public` if the user chose public. If a repo with that name already exists on their account, **stop and ask** for another name. Never overwrite, rename, or delete an existing repo.
8. Keep merged branches on GitHub: `gh repo edit --delete-branch-on-merge=false`.
9. Tag and push: `git tag -a m00-setup -m "Milestone 0 complete"` then `git push origin m00-setup`.
10. Write the repo URL into `context/HANDOFF.md` and `context/PROGRESS.md`.

### A.3 Branch model

| Branch | Purpose | Created from | Merges into |
|---|---|---|---|
| `main` | Always working. Receives only merges of verified branches. Never commit to it directly after the initial commit. | — | — |
| `milestone/NN-name` | One per milestone (list below) | latest `main` | `main` via PR |
| `feat/NN-short-desc` | Optional sub-task inside a milestone, for risky work | its milestone branch | that milestone branch via PR |
| `fix/short-desc` | Fix to something already on `main` | latest `main` | `main` via PR |
| `spike/short-desc` | Throwaway experiment | anywhere | **never merged.** Port the good parts by hand. |

Milestone branch names:

```
milestone/01-scaffold        milestone/07-effects
milestone/02-renderer-seam   milestone/08-rapier
milestone/03-fracture-crack  milestone/09-glass-shading
milestone/04-shatter-effect  milestone/10-performance
milestone/05-react-router    milestone/11-docs-site
milestone/06-nextjs          milestone/12-release
```

Start each one from the latest `main`:

```bash
git switch main
git pull --ff-only
git switch -c milestone/NN-name
git push -u origin milestone/NN-name
```

### A.4 Commit and push rules

- Use **Conventional Commits**: `feat(core): …`, `fix(next): …`, `test: …`, `perf: …`, `docs: …`, `chore: …`, `refactor: …`.
- Make small commits, each of which **builds and typechecks**.
- **Push after every commit.** Nothing stays unpushed.
- Commit context-file updates **in the same commit as the code they describe**, so every branch carries context that matches its code. Rolling back a branch rolls back its context too.
- Never commit secrets, `.env` files, `node_modules`, or build output.
- **CI minutes:** private repos have limited free GitHub Actions minutes. Cache the pnpm store and Playwright browsers. On pushes to branches, run typecheck, lint, unit, and Chromium e2e. Run the full three-engine e2e plus size-limit only on PRs into `main`.

### A.5 Milestone end ritual (in this order, every milestone)

1. All acceptance checks for the milestone pass locally (typecheck, lint, unit, relevant e2e), and you have verified the result in a real browser.
2. Fully update all four context files. Commit and push.
3. Open a PR:
   ```bash
   gh pr create --base main --head milestone/NN-name --title "Milestone NN: <name>" --body "<what was built, measurements, how it was verified, known issues>"
   ```
4. Run `gh pr checks --watch`. If anything is red, fix it on the same branch, push, and repeat.
5. Merge:
   - If the user chose auto-merge: `gh pr merge --merge` (a merge commit keeps the full branch history). **Never** use `--squash`, `--rebase`, or `--delete-branch`.
   - If the user chose approval: post the PR link, say what to review, and **wait**.
6. Tag `main`:
   ```bash
   git switch main
   git pull --ff-only
   git tag -a mNN-name -m "Milestone NN complete"
   git push origin mNN-name
   ```
7. Record the PR link, merge commit, and tag in `context/PROGRESS.md` (commit through a small `docs/context-NN` branch + PR, or as the first commit of the next milestone branch). Then create the next milestone branch.

### A.6 Safety rules (never break these)

- **Never** run `git push --force` or `--force-with-lease`, `git reset --hard` on pushed commits, or `git rebase` of pushed branches. Never delete remote branches or tags. Never run `git clean -fdx` without listing what it would delete and confirming it is only build output.
- To undo work, use `git revert <sha>` on the affected branch.
- If a milestone branch goes badly wrong, **don't repair it in place**. Start a fresh branch from the last good tag, e.g. `git switch -c milestone/04-shatter-effect-v2 m03-fracture-crack`. Leave the broken branch on GitHub for reference, and write an ADR explaining what happened.
- Before any risky local operation (big refactor, dependency upgrade, mass delete), make sure everything is committed and pushed.

---

## B. Context continuity — the four living files

These files let a brand-new session, with zero memory, continue exactly where the last one stopped. Keep them all in `context/` at the repo root.

| File | Update style | Purpose |
|---|---|---|
| `context/HANDOFF.md` | **Rewrite completely** each time (not append). Max ~150 lines. | Snapshot of *right now*: where we are and exactly what to do next |
| `context/PROGRESS.md` | Update in place | Milestone tracker, versions, every measurement |
| `context/DECISIONS.md` | Append only | Architecture Decision Records |
| `context/LEARNINGS.md` | Append, de-duplicate, grouped by topic | Gotchas, bugs, and verified knowledge |

### B.1 What each file must contain

**`context/HANDOFF.md`**
- Last updated (date + time), **session number**, GitHub repo URL
- Current milestone, current branch, last commit (short SHA + message), latest tag
- Done so far in this milestone · in progress right now · **the exact next 3 steps**, concrete enough to start without thinking
- Open problems and blockers, including what has already been tried
- Questions waiting on the user
- Working-tree state. It must say "clean, everything pushed", because you always commit and push before writing the hand-off.
- Resume commands (install, dev servers, test commands), working in PowerShell
- Files a new session should read first for the current task (paths)

**`context/PROGRESS.md`**
- A checklist of all 13 milestones (0–12) with status (☐ todo / ◐ in progress / ☑ done), branch, PR link, merge SHA, and tag
- Installed dependency versions, updated whenever they change
- Every measurement with date, device, and browser: capture time, fracture time, FPS, bundle sizes, seam-diff %, Lighthouse scores, memory test results
- Test counts (unit / e2e) per milestone

**`context/DECISIONS.md`**
- Entries `ADR-001`, `ADR-002`, … each with: date, status (accepted / superseded by ADR-NNN), context, decision, alternatives considered, consequences
- Every deviation from this master prompt **must** have an ADR
- Never delete or edit an old ADR's decision. Supersede it with a new one.

**`context/LEARNINGS.md`**
- API facts verified from installed type definitions, with the package version (e.g. "`d3-delaunay` x.y.z: `cellPolygon` returns a closed ring")
- Bugs found: symptom → root cause → fix → commit SHA
- Approaches that did not work and why, so they are never retried blindly
- Browser- and OS-specific quirks (WebKit, Firefox, Windows)

### B.2 Automatic update triggers (don't wait to be asked)

| When | Update |
|---|---|
| Every commit that changes behaviour or status | `HANDOFF.md`, plus `context/PROGRESS.md` if a status or number changed (in the same commit) |
| A design decision is made, or you deviate from the spec | `context/DECISIONS.md` (new ADR) |
| A non-obvious bug, API quirk, or failed approach | `LEARNINGS.md` |
| After finishing any sub-task within a milestone | Refresh `HANDOFF.md` |
| Before any risky operation (refactor, dependency upgrade, deleting files) | `HANDOFF.md` |
| End of every milestone | **All four**, thoroughly (part of ritual A.5) |
| User says "handoff" or "save context" | Run the full hand-off procedure (B.3) |
| **Context usage reaches ~900,000 tokens** (of the 1,000,000-token window, keeping 100k as a safety margin) | Run the full hand-off procedure (B.3), then stop |

### B.3 Full session hand-off procedure

1. **Stop starting new work.** Finish the current small step, or revert it, so the branch builds and typechecks.
2. Update all four context files thoroughly. In `HANDOFF.md`, write the next steps as if explaining them to a capable engineer who has never seen this project.
3. Commit with `docs(context): session <N> handoff` and push.
4. Verify that `git status` is clean and that `git rev-parse HEAD` equals `git rev-parse @{u}` (everything is pushed).
5. Tell the user, exactly:
   > **Context is ~90% full. Everything is committed and pushed to `<branch>` (`<short SHA>`). Start a new session in `D:\Shatter Router` and paste the Resume Prompt from the bottom of SHATTER_ROUTER_MASTER_PROMPT.md.**
6. Do no further work in this session.

### B.4 Session start procedure (every new session)

1. Read `SHATTER_ROUTER_MASTER_PROMPT.md` completely, then all four `context/` files.
2. Run the prerequisite check (A.1), then `git fetch --all --tags` and `git status`.
3. Confirm that the current branch and last commit match `HANDOFF.md`. If they don't, **trust Git**, find out why, and correct `HANDOFF.md`.
4. `pnpm install`, then run typecheck and unit tests to confirm the state is green before writing any code. If it's red, fixing it becomes the first next step.
5. Increment the session number in `HANDOFF.md`.
6. Give the user a 5-line status (milestone, branch, done, next, blockers), then continue with the next steps without waiting.

### B.5 Writing rules for context files

- Write facts, not vibes: SHAs, file paths, numbers, versions, exact error messages.
- Never put secrets, tokens, or personal data in them.
- Keep `HANDOFF.md` short enough that a new session understands the full situation in one read.

---

## 1. The product in one paragraph

A user clicks a link. The current page **cracks from the exact point they clicked**: fracture lines race outward across the screen in about 140 ms. Then the page breaks into tumbling 3D glass shards that fall away with gravity, catching light on their edges, and the real new page is revealed underneath. Other effects make shards blast outward, spiral into a black-hole point, flip over to show the new page on their back faces, or fly in from off-screen and click together into the new page. The library ships as one npm package with a framework-agnostic core and adapters for React, Next.js App Router, and React Router. It's tiny, lazy-loaded, accessible, and **never produces a visible jump, flash, or misaligned pixel** at the moment the real DOM and the WebGL canvas swap.

---

## 2. Tech stack (required)

| Concern | Choice |
|---|---|
| Language | TypeScript (strict), ESM only, ship `.d.ts` |
| Repo | pnpm workspaces monorepo |
| Library build | `tsup` (ESM, code-split, `treeshake: true`, `dts: true`) |
| Rendering | **Raw WebGL2 with a small internal abstraction. Do NOT use Three.js** (bundle size). |
| Fracture | `d3-delaunay` (Voronoi) |
| DOM capture | `modern-screenshot` (DOM → SVG foreignObject → canvas). Wrap it behind an internal `Capturer` interface so it can be swapped. |
| Physics (optional mode) | `@dimforge/rapier3d-compat` as an **optional peer dependency**, loaded with dynamic `import()` only when `physics: 'rapier'` is used |
| Animation math | Your own: fixed-step integrator, springs, easing. No GSAP in the core. |
| Unit tests | Vitest |
| E2E + visual tests | Playwright (Chromium, Firefox, WebKit) |
| Bundle budget | `size-limit` in CI |
| Releases | Changesets |
| Lint/format | ESLint (typescript-eslint) + Prettier |
| CI | GitHub Actions: typecheck, lint, unit, e2e, size-limit |
| Docs site | Next.js App Router app that **uses Shatter Router for its own navigation** |
| Playground controls | Tweakpane |
| License | MIT |

---

## 3. The non-negotiable guarantee: the seamless swap

This is the most important section. The whole library is worthless if the user can see the swap.

**Definition:** At the instant the WebGL overlay appears, its first frame must look identical to the live DOM it covers. At the instant the overlay is removed, the live DOM underneath must look identical to the overlay's last frame. No jump, no blank frame, no shifted pixels, no colour shift, no scrollbar jump.

How to achieve it:

1. **Capture exactly the viewport.** Capture the region `[scrollX, scrollY, innerWidth, innerHeight]` of the document, not the whole page. Account for `position: fixed` and `position: sticky` elements, which must appear where they currently are on screen.
2. **Pixel-exact projection.** Use a perspective camera positioned so the `z = 0` plane maps exactly 1 world unit = 1 CSS pixel:
   `cameraZ = (viewportHeight / 2) / tan(fovY / 2)`, origin at the viewport's top-left, Y pointing down in world space (or flip consistently — be careful with UV `flipY`). Use a perspective camera, not an orthographic one, because shards need depth when they tumble toward the viewer.
3. **Canvas sizing.** Canvas CSS size = viewport. Backing store = viewport × `min(devicePixelRatio, 2)`. The capture scale must equal the same DPR so texels map 1:1 to device pixels.
4. **Texture limits.** Query `MAX_TEXTURE_SIZE`. If `viewport × dpr` exceeds it, lower the capture scale for both the texture and the canvas backing store together so they still match.
5. **Colour.** Upload the capture as sRGB, with no extra gamma conversion in the shader. Use premultiplied alpha consistently: context created with `premultipliedAlpha: true`, and the fragment shader outputs premultiplied colour.
6. **Layer order.** Put the overlay in the browser **top layer** by placing the canvas inside an element with `popover="manual"` and calling `showPopover()`, so it sits above dialogs and other popovers. Fall back to `position: fixed; inset: 0; z-index: 2147483647` if the Popover API is missing. Use `pointer-events: auto` during the transition to block clicks, `aria-hidden="true"`, and a transparent background.
7. **Scrollbar stability.** Document in the README that apps should use `scrollbar-gutter: stable` on `html`. The library itself must not change scrollbar visibility during the transition. Lock scroll with a technique that doesn't change layout: prevent `wheel`/`touchmove`/scroll keys via listeners, and don't use `overflow: hidden` on `html`.
8. **Pinch zoom.** If `visualViewport.scale !== 1`, skip the WebGL effect and use the fallback (section 9).
9. **Seam tests are mandatory** (section 11): an automated pixel comparison between the live DOM and the overlay's first and last frames.

---

## 4. The transition pipeline (state machine)

Implement the core as an explicit, typed finite state machine:

```
idle → capturing → covering → committing → waiting → animating → revealing → idle
                    ↘ (any failure / timeout / unsupported) → fallback → idle
```

Step by step:

1. **Intent (optional pre-capture).** If `precapture: 'pointerdown'` (the default), start capturing on `pointerdown` over a Shatter link, about 80–150 ms before `click`, to hide capture latency. Keep the result only if no DOM mutation happened since; track that with a `MutationObserver` dirty flag plus a scroll-position check. Otherwise capture again on click. `precapture: 'hover'` captures on `pointerenter` after a 120 ms dwell. `false` disables pre-capture.
2. **Origin.** The impact point = the pointer's `clientX/clientY`. For keyboard activation (Enter on a focused link) the origin = centre of the link's `getBoundingClientRect()`. For programmatic navigation the origin = the viewport centre unless one is passed.
3. **Capturing.** Get the outgoing viewport snapshot into a canvas or ImageBitmap. **Budget: 250 ms.** If capture exceeds the budget or throws (CORS-tainted images, etc.), go to the fallback.
4. **Covering.** Upload the texture and draw the **intact, unbroken** page quad. Wait for one `requestAnimationFrame` so it's actually on screen, then show the overlay. From here on the user sees only the canvas.
5. **Committing.** Call the adapter's `commit()`, which makes the router render the new route under the overlay.
6. **Waiting.** Wait until the new route is ready:
   - the adapter's commit promise resolved (the new route actually rendered — see section 7)
   - `document.fonts.ready`
   - `img.decode()` for `<img>` elements intersecting the viewport (in parallel)
   - two `requestAnimationFrame`s for layout to settle
   - scroll to top for push navigation, or to the restored position for back/forward

   All with a **hard timeout (default 1500 ms)**. When it's reached, proceed anyway.
7. **Incoming capture (only for effects with `needsIncomingSnapshot: true`).** Capture the new viewport while it's hidden under the overlay. The capture lib renders through SVG, so visibility doesn't matter. Verify this.
8. **Animating.** Run the effect (section 5).
9. **Revealing.** When every shard has left the viewport or reached alpha 0 (or for assemble-type effects, every shard has settled at its rest pose), hide the overlay in the same frame the animation finishes. Then move focus (section 9), fire `end`, and release textures.

**Interruption rules:**
- A new navigation during `capturing`/`covering`: cancel the old one and start the new one.
- A new navigation during `animating`: fast-forward the current animation to its end state within one frame, reveal, then start the new transition.
- `Escape`, or a click/tap on the overlay during `animating`: skip to the end immediately.
- `document.visibilityState === 'hidden'` during animation: finish instantly.
- Every state transition must be idempotent and leak-free. Write unit tests for interruption at every state.

---

## 5. Fracture and effects

### 5.1 Fracture geometry (`fracture.ts`)

- **Seed points:** impact-biased distribution. Sample with a density that falls off with distance from the origin, so you get many small shards near the impact and fewer large ones at the edges. Formula: polar sampling with `r = maxR * u^k` (k ≈ 1.6–2.2, configurable), random angle, plus blue-noise rejection (minimum distance) so cells never become slivers. Make it deterministic when a `seed` option is given (use a small seeded PRNG like mulberry32).
- **Voronoi:** `Delaunay.from(points).voronoi([0, 0, w, h])`, then `cellPolygon(i)`. Note: the returned polygon is closed (first vertex repeated at the end), so drop the duplicate. Skip `null` cells.
- **Triangulation:** Voronoi cells are convex, so use a fan triangulation from the centroid.
- **UVs:** `uv = (x / w, y / h)`, with Y orientation matching the texture upload.
- **Thickness (glass depth):** extrude each cell by `thickness` px (default 6) into side faces. Side faces sample a darkened, slightly blurred edge colour so shards read as 3D glass while tumbling.
- **Per-vertex attributes:** `position`, `uv`, `shardId`, `centroid`, `edgeDistance` (for the edge highlight in the shader), `normal`.
- **One merged geometry → one draw call** per transition.
- **Shard count:** `shards: 'auto' | number`. `'auto'` picks based on device tier: 40 (low), 90 (mid), 160 (high). Use `hardwareConcurrency`, `deviceMemory` when available, and the measured capture time. Clamp to `[12, 400]`.
- **Validation (unit-tested):** the summed area of all cells = `w × h` within 0.01 %. No cell has fewer than 3 vertices. Every UV is in [0, 1].
- Fracture runs on the main thread during the capture wait. Measure it. Move it to a Worker only if it exceeds 4 ms at 160 shards on a mid-range laptop, and record the measurement either way.

### 5.2 Crack propagation (the signature moment)

Before any shard moves, draw the fracture lines **growing outward from the impact point**: each Voronoi edge appears when a radial "crack front" reaches it, with a bright 1–1.5 px line, a subtle refraction offset across the crack, and a short bright flash at the impact. Default duration 140 ms, then a 40 ms hold. This is done in the fragment shader using `edgeDistance` plus each fragment's distance from the origin compared to `uCrackRadius`. Do not use a separate geometry pass.

### 5.3 Shard motion — two modes

**`physics: 'procedural'` (default, zero extra download):** closed-form motion computed in the vertex shader from per-shard attributes plus `uTime`. One draw call, works for 400+ shards.

```
d      = normalize(centroid - origin)
r      = |centroid - origin| / maxR            // 0..1
delay  = r * stagger                           // shards near impact go first
t'     = max(0, t - delay)
v0     = d * impulse * (1 - 0.5*r) + jitter(seed)   // jitter includes +z toward camera
pos(t) = centroid + v0*t' + 0.5*gravity*t'^2
rot(t) = axisAngle(randomAxis(seed), angularVel(seed) * t')   // about the centroid
alpha  = 1 - smoothstep(fadeStart, 1.0, t / duration)
```

Clamp `z` so shards never pass the camera near plane.

**`physics: 'rapier'` (opt-in):**
- Lazy-load `@dimforge/rapier3d-compat` with `await RAPIER.init()`.
- One dynamic rigid body per shard, with a convex-hull collider made from the extruded cell vertices. `ColliderDesc.convexHull()` can return `null`; fall back to a cuboid then.
- Optional floor collider at the viewport bottom (`floor: true`) so shards pile up and slide before fading.
- Scale world units, e.g. `100 px = 1 m`, so the solver stays stable.
- Use a fixed timestep of 1/60 s with an accumulator.
- Write per-shard transforms into a float `DataTexture` (one row of 4 texels per shard = a mat4). The vertex shader `texelFetch`es by `shardId`. Still one draw call.
- Initial impulses use the same formula as procedural mode so both modes look similar.

### 5.4 Built-in effects (v1)

Each effect is a plugin object implementing a public `ShatterEffect` interface (section 6). Ship these:

| Name | Behaviour | Needs incoming snapshot |
|---|---|---|
| `shatter` (default) | Crack propagation, then shards fall with gravity, tumbling, and fade. The live new page is revealed underneath. | no |
| `explode` | No gravity at first: a violent radial blast from the impact, strong +z toward the camera, motion stretch along velocity, then gravity. | no |
| `implode` | Shards spiral into the impact point (tangential + inward velocity), shrink, and vanish like a black hole, with a brief lensing distortion around the point. | no |
| `flip` | Shards stay in place but each flips 180° about a random in-plane axis, staggered by distance. Front face = old page, back face = new page. Ends exactly at the new page. | **yes** |
| `assemble` | The old page shatters as in `shatter` while new-page shards fly in from off-screen and spring into their exact rest positions, landing pixel-exact. | **yes** |

For `flip` and `assemble`, the final frame must match the live new DOM pixel-for-pixel (seam test). Use a critically damped spring for the final settle so nothing overshoots past the rest pose on the last frame.

### 5.5 Shading (make it look like expensive glass)

- An edge highlight from `edgeDistance`, brighter when the shard normal faces a fixed virtual light.
- A subtle specular glint that sweeps across each shard as it rotates (Blinn-Phong with the rotated normal).
- Optional chromatic aberration proportional to shard speed (`chromatic: true`), max 1.5 px.
- Side (thickness) faces are darker, with a faint tint (`glassTint`, default a cool `#cfe8ff` at 12 %).
- At `t = 0` all lighting terms must be exactly zero so the first frame matches the DOM. Fade them in over the first 60 ms of motion.

---

## 6. Public API

Single package, subpath exports:

```
shatter-router            → core (framework-agnostic)
shatter-router/react      → <ShatterProvider>, <ShatterLink>, useShatter(), useShatterNavigate()
shatter-router/next       → Next.js App Router adapter ('use client')
shatter-router/react-router → React Router adapter
shatter-router/rapier     → physics plugin (imports optional peer dep)
```

Peer dependencies `react`, `react-dom`, `next`, `react-router` and `@dimforge/rapier3d-compat` are all marked optional in `peerDependenciesMeta`. Before publishing, check the name with `npm view shatter-router`. If it's taken, use a scoped name and update all docs.

### Core

```ts
import { createShatter } from 'shatter-router';

const shatter = createShatter({
  effect: 'shatter',            // string name or a ShatterEffect object
  duration: 1000,               // ms, total motion phase (excl. crack)
  shards: 'auto',
  physics: 'procedural',        // 'procedural' | 'rapier'
  gravity: 2600,                // px/s^2
  impulse: 900,                 // px/s
  thickness: 6,
  glassTint: '#cfe8ff',
  chromatic: true,
  precapture: 'pointerdown',    // 'pointerdown' | 'hover' | false
  captureBudget: 250,           // ms
  readyTimeout: 1500,           // ms
  reducedMotion: 'crossfade',   // 'crossfade' | 'instant' | 'ignore'
  backForward: 'reverse',       // 'reverse' | 'same' | 'none'
  seed: undefined,
  debug: false,
  scrollLock: undefined,        // optional { lock(): void; unlock(): void } for Lenis etc.
});

await shatter.transition({
  commit: async () => { /* swap the DOM / tell the router to navigate */ },
  origin: { x, y },             // optional
  effect: 'explode',            // optional per-call override
  direction: 'forward',         // 'forward' | 'back'
});

shatter.on('start' | 'covered' | 'committed' | 'animating' | 'end' | 'fallback' | 'error', handler);
shatter.registerEffect(myEffect);
shatter.destroy();              // removes listeners, frees GL resources, loses context
```

`backForward: 'reverse'` plays the effect visually reversed where that makes sense (`shatter` reversed = shards fly up and assemble into the new page, i.e. `assemble`). Document the exact mapping.

### Effect plugin interface (refine the details, keep the shape)

```ts
interface ShatterEffect {
  name: string;
  needsIncomingSnapshot: boolean;
  crack: boolean;                                   // play crack propagation first?
  duration?: number;
  seedPoints?(ctx: FractureContext): Float32Array;  // custom seed layout
  shardAttributes(ctx: EffectContext): ShardAttributes; // per-shard packed data for the vertex shader
  vertexChunk: string;                              // GLSL injected into a documented hook
  fragmentChunk?: string;
  isComplete(t: number, ctx: EffectContext): boolean;
}
```

Document the GLSL hook points, the available uniforms and the available attributes. The five built-in effects must be written **only** against this public interface (dogfooding).

### HTML opt-outs

- `data-shatter="off"` on a link: plain navigation.
- `data-shatter-effect="implode"` on a link: per-link effect.
- `data-shatter-ignore` on any element: excluded from capture (rendered as its computed background colour).

### React

```tsx
<ShatterProvider options={{ effect: 'shatter' }}>
  <App />
</ShatterProvider>

<ShatterLink href="/about" effect="explode">About</ShatterLink>
const navigate = useShatterNavigate();
navigate('/work', { effect: 'implode', origin: { x, y } });
```

`<ShatterLink>` must keep all native link behaviour: modifier clicks (Ctrl/Cmd/Shift/Alt, middle-click) and `target="_blank"` must **not** be intercepted, `href` must be real, and it must be accessible and work without JS (SSR renders a normal `<a>`).

---

## 7. Framework adapters — how to detect "the new route has rendered"

This is the second hardest part. Get it right and test it.

**React Router (current stable, data or declarative mode):**
- `<ShatterLink>` wraps React Router's `<Link>`, prevents default on qualifying clicks, and calls `shatter.transition({ commit })`.
- `commit` calls `navigate(to)` and returns a promise that resolves when a `<ShatterRouteSignal>` rendered inside the router (exported, and auto-included by the adapter's provider) sees the location key change in `useLayoutEffect`, **and** `useNavigation().state === 'idle'` (for loaders) when in data mode.
- Back/forward: listen for location changes where `navigationType === 'POP'`. The capture must happen **before** the router re-renders. Use the Navigation API's `navigate` event (feature-detected) to capture early. Where it's unavailable, play no effect on POP. Never block or delay browser history.

**Next.js App Router (current stable):**
- `'use client'` provider placed in the root layout.
- `<ShatterLink>` wraps `next/link` and **preserves prefetch behaviour**.
- `commit` calls `router.push(href, { scroll: false })` (the library handles scroll itself under the overlay), then resolves when `usePathname()` + `useSearchParams()` change. Read the search params inside a component wrapped in `<Suspense>` as Next requires. Also wait two rAFs.
- `loading.tsx` boundaries: option `waitFor: 'commit' | 'settled'`. `'settled'` waits until no `[data-shatter-pending]` and no Suspense fallback marker is in the main content (document the marker contract), bounded by `readyTimeout`.
- Back/forward: same Navigation API strategy as React Router.
- Verify in the actual installed Next version that none of the APIs you use are deprecated.

**Vanilla:** `shatter.transition({ commit: () => swapContent(url) })` with `history.pushState`. Ship an example.

---

## 8. Performance requirements

Measure each one and record it in `context/PROGRESS.md`:

- **Zero cost until first use.** The core entry, including the listeners that detect intent, is ≤ 6 KB min+gzip. The WebGL renderer, fracture, and effects load in a lazy chunk (≤ 22 KB gzip), prefetched on idle (`requestIdleCallback`) after page load. The capture library loads in its own lazy chunk. Rapier loads only in rapier mode. Enforce all of this with `size-limit` in CI.
- **One WebGL context for the life of the page.** Create it lazily on first use, reuse it, and never create one per transition (browsers cap live contexts). Handle `webglcontextlost`/`webglcontextrestored`: if the context is lost, use the fallback until it's restored.
- **60 fps** during animation on a mid-range laptop at 1440×900 with 160 shards. One draw call. No allocations per frame in the render loop (verify with a Performance trace).
- Capture ≤ 120 ms on the docs landing page at 1440×900 on a mid-range laptop. Report the actual number.
- No long task > 50 ms on the main thread outside the capture step.
- Free GPU textures and the ImageBitmap/canvas immediately after `end`.

---

## 9. Accessibility, fallbacks, and robustness

- **Reduced motion:** with `prefers-reduced-motion: reduce`, `reducedMotion: 'crossfade'` uses `document.startViewTransition` with a ≤ 200 ms crossfade when available, and otherwise swaps instantly. `'ignore'` exists only for demos and is documented as discouraged.
- **Fallback chain:** WebGL effect → View Transition crossfade → instant swap. Reasons to fall back: no WebGL2, capture failed or over budget, context lost, pinch-zoomed, page hidden, an error anywhere in the pipeline. **Navigation must always complete.** A bug in Shatter must never break routing. Wrap the pipeline so any thrown error goes to the fallback and emits `error`.
- **Focus:** after reveal, move focus to `[data-shatter-focus]`, else the first `h1` in `main`, else `main` (adding `tabindex="-1"` temporarily). Announce the new `document.title` through a visually hidden `aria-live="polite"` region.
- **Input:** block pointer input during the transition (the overlay catches it). `Escape` skips.
- **Hard-to-capture content:** cross-origin `<iframe>` becomes a solid placeholder in its computed background colour. `<video>` uses the current frame if drawable without tainting, else the poster, else the background. `<canvas>` uses `drawImage` if not tainted. Cross-origin images without CORS use the capture lib's placeholder behaviour. The result must never taint the WebGL texture. Verify each case in the e2e suite.
- **CSP:** document the required directives: `img-src data: blob:` for capture, `script-src 'wasm-unsafe-eval'` for rapier mode, and `worker-src blob:` only if you end up using an inline worker. Test that the fallback works under a strict CSP that blocks these.
- **Memory leaks:** 100 consecutive transitions in an e2e test must show no growth in the JS heap (beyond noise) or in the GL texture count. Track textures with an internal counter exposed in debug mode.

---

## 10. Debug mode (`debug: true`)

A small overlay panel (shadow DOM so app CSS can't break it) showing:
- the state machine's current state and timings for each phase (capture, commit, wait, animate)
- shard count, device tier, FPS during animation, draw calls
- a toggle to render the Voronoi wireframe and the impact point
- a **"seam check"** button that captures the live DOM and the overlay's frame and shows a diff heatmap with the % of differing pixels

---

## 11. Testing

**Unit (Vitest):**
- fracture: area conservation, UV bounds, determinism with a seed, sliver rejection, `null`-cell handling
- the state machine: every transition, every interruption at every state, every fallback reason, idempotent `destroy()`
- link interception rules: modifier keys, middle-click, `target`, `download`, external origins, `data-shatter="off"`, hash-only links (same page: don't shatter)
- spring/integrator math: settles exactly at rest, no overshoot on the final frame

**E2E (Playwright) against the example apps (Next, React Router, vanilla):**
- each effect completes and the final DOM is the correct route
- **seam tests:** for every effect, screenshot the live DOM just before the overlay appears and compare it with the overlay's first frame; for `flip`/`assemble`, compare the overlay's last frame with the live DOM after reveal. Expose a test-only hook (`window.__SHATTER_TEST__`, only when `debug` is on) to pause at those frames. Threshold: ≤ 0.5 % of pixels differ by more than a small tolerance. Record actual values; text anti-aliasing through SVG foreignObject may differ slightly, so if the threshold can't be met, investigate the cause before loosening it, and document it.
- reduced motion path, no-WebGL path (launch flag), strict-CSP path
- interruption: rapid double click on two different links, Escape during animation, back button during animation
- back/forward with scroll restoration
- the 100-transition memory test
- no console errors or warnings in any test

---

## 12. Milestones (do them in order)

Each milestone runs on its own branch (A.3) and ends with the **milestone end ritual (A.5)**: browser verification, all four context files updated, PR, green CI, merge, tag.

0. **Git, GitHub and context setup:** everything in A.2, plus the four context files (B.1) with initial content. Done when the repo exists on GitHub, `main` is pushed, the `m00-setup` tag is pushed, and `context/HANDOFF.md` names `milestone/01-scaffold` as the next branch.
1. **Scaffold:** monorepo, package with subpath exports, tsup, Vitest, Playwright, ESLint, Prettier, size-limit, Changesets, CI workflow, vanilla example app. CI must be green.
2. **Renderer + seam:** WebGL2 context management, pixel-exact camera, capture of the viewport, intact-quad overlay. **Pass the first-frame seam test** before anything else.
3. **Fracture + crack propagation:** geometry, the crack shader, debug wireframe. Unit tests pass.
4. **`shatter` effect (procedural)** end-to-end in the vanilla example, with the full state machine, interruption, fallbacks, focus management, and reduced motion.
5. **React + React Router adapter** + example app + e2e.
6. **Next.js App Router adapter** + example app + e2e (including `loading.tsx`).
7. **Remaining effects:** `explode`, `implode`, `flip`, `assemble`, plus the plugin interface docs. Last-frame seam tests pass for `flip`/`assemble`.
8. **Rapier mode** + floor option, as an optional lazy chunk.
9. **Glass shading polish:** edge light, specular, chromatic aberration, thickness faces. Do a visual review pass and record before/after screenshots in `context/PROGRESS.md`.
10. **Performance pass:** every budget from section 8 measured and met.
11. **Docs site** (section 13).
12. **Release readiness:** README, CHANGELOG, LICENSE, CONTRIBUTING, issue templates, `npm pack` dry run, and a final full test run.

---

## 13. Docs site (dogfooded, the showcase)

A Next.js App Router site that uses Shatter Router for every internal link.

- **Landing hero:** a huge headline "Break the page." with a subline "Click anywhere." Clicking anywhere on the hero (not just links) shatters the hero section in place and reassembles it, using the core API on a region. Add region support (`transition({ target: element })`) only if it fits cleanly into the architecture; otherwise do the full-page version and note the decision.
- **Effects gallery:** one card per effect. Clicking a card navigates to that effect's detail page *using that effect*.
- **Playground:** live Tweakpane controls for every option (effect, shards, gravity, impulse, thickness, tint, chromatic, physics mode, seed, debug). A "Copy config" button outputs the matching `createShatter({...})` code.
- **Docs pages:** Getting started (vanilla / React / React Router / Next), API reference, writing a custom effect (with a full worked example effect called `ripple-out`), performance notes with the real measured numbers, accessibility, CSP, troubleshooting (capture issues, CORS images, iframes), and browser support.
- **Design:** dark, minimal, editorial. One display typeface + one mono. Lots of negative space so the effect is the star. Fully responsive. The site itself must score ≥ 95 on Lighthouse Performance and Accessibility (mobile). Record the scores.

---

## 14. Out of scope for v1 (do not build, list them in the README roadmap)

- Multi-page apps / cross-document navigation (the overlay can't survive a document unload)
- Vue, Svelte, Solid adapters (keep the core framework-agnostic so they're easy later)
- Capturing the contents of cross-origin iframes
- Non-fracture effects (melt, pixel-sort, paper-fold): the plugin API should make these possible later

---

## 15. Definition of done

- All 13 milestones (0–12) complete and checked in `context/PROGRESS.md`, with measured numbers.
- Every milestone has a merged PR and a pushed tag (`m00-setup` … `m12-release`), and every milestone branch still exists on GitHub.
- All four `context/` files are current, and a fresh session could continue the project from them alone.
- CI green: typecheck, lint, unit, e2e on three browser engines, size-limit.
- Seam tests pass for every effect.
- Every effect works in the vanilla, React Router, and Next.js examples.
- Navigation **always** completes even when every optional feature fails.
- The README opens with a GIF/video of `shatter` on the docs site, a 3-line quick start, a feature list, real performance numbers, browser support, and the roadmap.
- Nothing in the repo is stubbed, mocked in production code, or marked TODO.

Start with **Milestone 0** now: run the prerequisite check (A.1), do the one-time setup (A.2), and ask the user the two setup questions. After that, write a short plan for Milestone 1 and implement it on `milestone/01-scaffold`.

---
---

# FOR THE USER (not part of the prompt for Fable)

## Resume Prompt — paste this to start every new session

```
You are continuing the Shatter Router project in "D:\Shatter Router".

1. Read SHATTER_ROUTER_MASTER_PROMPT.md completely. It is the spec and the rules, including section A (Git workflow) and section B (context continuity).
2. Read context/HANDOFF.md, context/PROGRESS.md, context/DECISIONS.md and context/LEARNINGS.md.
3. Follow the "Session start procedure" (section B.4) exactly.
4. Give me a 5-line status (milestone, branch, done, next, blockers), then continue from the next steps in HANDOFF.md.

Remember: keep the four context files updated automatically, push after every commit, never force-push, and run the full hand-off procedure (B.3) when context usage reaches ~900k tokens.
```

## Git recovery cheat sheet

Run these in `D:\Shatter Router` (PowerShell or Git Bash):

| I want to… | Command |
|---|---|
| Get every branch and tag from GitHub | `git fetch --all --tags` |
| See all branches (local + GitHub) | `git branch -a` |
| See all milestone tags | `git tag -l "m*"` |
| Switch to a branch | `git switch milestone/04-shatter-effect` |
| Pull the latest of the current branch | `git pull --ff-only` |
| Push the current branch | `git push` |
| See what changed between two milestones | `git diff m03-fracture-crack m04-shatter-effect --stat` |
| Start over from a known-good milestone | `git switch -c rescue/from-m03 m03-fracture-crack` |
| Undo one bad commit safely (keeps history) | `git revert <commit-sha>` |
| Look at an old version without changing anything | `git switch --detach m02-renderer-seam` |
| Open the repo on GitHub | `gh repo view --web` |
