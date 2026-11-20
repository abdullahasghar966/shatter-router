# Production-grade plan: Shatter Router and its site

Written 2026-11-20 after the user's review of https://shatter-router.vercel.app. Status: **proposal, waiting for the user's decisions (section 9)**. Nothing here is built yet.

## 1. What the review said, and what the code shows

| # | The review | What the code shows | Root cause |
| --- | --- | --- | --- |
| 1 | "Color theme is not good", "AI slop" | Near-black `#0a0b0d`, one orange accent, a big serif headline, gradient cards with three diagonal lines, uniform grids. | It is the default "dark editorial" look of countless generated sites. There's no point of view: nothing about the theme comes from glass or from what the library does. |
| 2 | "Shatter and Explode are the same" | Both throw the same Voronoi shards radially from the click, tumble them and fade them. Explode is only a faster throw (2.4× impulse) with drag and 0.25 s of delayed gravity (`engine/effects/explode.ts`). | Same fracture pattern, same direction field, same tumble, same fade. At 1 s the eye reads "pieces fly away" for both. Five effects, two of them nearly identical. |
| 3 | "If we go back it should be the same, but it's set to default" | `backForward: 'reverse'` maps `shatter`, `explode` and `implode` to `assemble` (`REVERSED` in `runtime/index.ts`). Back never remembers which effect brought you there. The playground keeps its settings in `useState(DEFAULTS)`, so they reset when you come back. | No per-history-entry memory of the effect or the UI state. No true reverse of each effect, only one fixed substitute. |
| 4 | "No scrolling bar animations" (screenshot: the native scrollbar) | The site uses the browser's scrollbar, kept stable with `scrollbar-gutter: stable` (ADR-007). | Never designed. |
| 5 | "Features are very little: animation types, cursor types, shapes, movement types…" | One fracture pattern (impact-biased Voronoi), five motion models, one material (glass), no cursor features, no interaction beyond click. | v1 scope (master prompt sections 5 and 14) was deliberately narrow. |
| 6 | "Full-fledged production-grade site" | 19 static pages, no search, no syntax highlighting, no social images, no analytics or monitoring, no security headers, playground without presets or sharing. | v1 built the minimum the spec asked for. |

## 2. Product vision

**Shatter Router becomes a page-transition engine with a material system, and the site becomes its studio.**

- The library breaks the page with a choice of **fracture patterns** (how it cracks), **motion models** (how pieces move), **materials** (what it is made of) and **interactions** (what the user does: click, hold, drag, hover, scroll). These are combinable, not a fixed list of five.
- The site is not a brochure about the library; **it is made of the library**. The theme is a material you choose, the cursor is a tool that can crack, the scrollbar is a glass rail, and changing the theme is itself a transition.

## 3. Library roadmap (the engine)

### 3.1 Architecture change first: effects as lazy plugins

The engine chunk is 19.81 of its 22 KB budget (section 8). Twenty new patterns and motions cannot live in it.

- Split into: **engine core** (renderer, camera, mesh, shading, frame loop, ≤ 15 KB) + **one lazy chunk per pattern, motion and material** (1–3 KB each), loaded on first use and prefetched on hover of a link that names them.
- Effects become **compositions**: `effect = { pattern, motion, material, stagger, timing }`. The five current effects become presets of this (`shatter = { pattern: 'impact', motion: 'fall', material: 'glass', stagger: 'radial' }`).
- The public effect interface (ADR-021) stays, so custom effects like `ripple-out` keep working.
- Size budgets per chunk in size-limit; CI fails if one grows.

### 3.2 Fracture patterns ("shapes")

| Pattern | Look | Notes |
| --- | --- | --- |
| `impact` (today) | Voronoi, denser near the click | Existing |
| `radial` | Spider-web: rays from the click plus concentric rings, like a real windscreen | Seeds on polar grid with jitter |
| `triangles` | Low-poly Delaunay | Cheap, crisp |
| `hex` | Honeycomb | Regular grid |
| `bricks` / `tiles` | Rows of offset rectangles / square tiles | Good for "slide" motions |
| `strips` | Vertical or horizontal blinds | For venetian-blind turns |
| `rings` | Concentric bands around the click | For ripple motions |
| `dom` | One piece per layout block (cards, paragraphs, images) | Uses element rects from the capture; the most "content-aware" |
| `text` | One piece per word or letter in headings | Typographic explosions |
| `pixels` | Square micro-tiles (thousands) | Instanced; dissolve-to-dust |
| `mask` | Shapes from an SVG/image the user supplies | Brand shapes |

Each needs: area conservation and UV tests (like `fracture.ts` today), a seam test at rest, a fracture-time budget (≤ 4 ms for 400 pieces or move to a worker).

### 3.3 Motion models ("movement types")

Grouped so each family looks clearly different:

- **Gravity family:** `fall` (pane collapses: almost no outward speed, pieces drop and tumble), `crumble` (bottom-up collapse), `rain` (pieces drop in columns).
- **Force family:** `blast` (explode, rebuilt: flash, shockwave ring that distorts the page, camera shake, pieces stretched toward the camera, debris), `vortex` (spiral around the click), `wind` (sweep in one direction with turbulence), `magnet` (pieces chase the cursor), `implode` (existing).
- **Order family:** `flip` (existing), `blinds` (strips rotate like shutters), `domino` (cascade from the click), `slide` (tiles slide out on a stagger), `peel` (pieces curl away like paper), `fold` (origami folds toward the click).
- **Matter family:** `dust` (pixels disintegrate, drift up), `melt` (vertical drip displacement), `ripple` (the docs' ripple-out, promoted), `glitch` (row offsets and RGB split, then gone).
- **Assembly family** (end on the new page, last-frame seam): `assemble` (existing), plus the true reverse of every motion above (3.6).

Shared controls: `stagger: 'radial' | 'linear' | 'spiral' | 'random' | 'reading-order'`, `direction`, `intensity`, `easing`, `duration`.

**Shatter vs Explode, made unmistakable:**

- `shatter` = `impact` cracks + `fall`: a long, visible crack phase (cracks branch and race), then the pane **drops** with gravity. Pieces fall more than they fly.
- `explode` = no crack, `radial` pattern, `blast`: a white flash on the impact frame, a shockwave ring that bends the page outward before it breaks, pieces flung **at the camera** with motion stretch, camera shake, small debris particles, then gravity.

### 3.4 Materials

`glass` (today, refined), `ice` (frosted, cloudy refraction, white edges), `mirror` (reflective, environment highlight), `obsidian` (dark volcanic glass, sharp specular), `paper` (no specular, soft shadow, slight curl), `metal` (brushed, sparks on impact), `neon/holo` (iridescent edges). A material = shading parameters + edge style + optional particles + optional sound. All lighting stays zero at rest (ADR-038).

### 3.5 Interaction and cursor

- **Cursor kits** (opt-in, separate tiny chunk): `reticle`, `hammer`, `glass-cutter`, `ring`, `none`. Over links they show where the glass will break.
- **Hover pre-crack:** a hairline crack grows under the cursor while it rests on a link; it becomes the actual crack on click.
- **Press and hold to charge:** the longer the press, the stronger the impulse (shown on the cursor). Release breaks.
- **Drag to tear:** drag across a link or region; the fracture follows the drag line.
- **Scroll-driven:** scrub a fracture with scroll position (sections that break as you scroll past them).
- **Touch:** long-press charge, swipe-to-tear; haptic tick (`navigator.vibrate`) where allowed.

### 3.6 Navigation correctness (fixes review item 3)

- **Effect memory per history entry:** the adapters store `{ effect, origin }` in `history.state` (vanilla, React Router) or alongside Next's entry key. Back plays the **reverse of the effect that brought you there**, from the same impact point; Forward replays it.
- **True reverse for every motion:** play the motion model backwards on the incoming page (pieces come back together exactly where they left). This is `assemble` generalised: every motion family member gets a reverse that ends exactly at rest (last-frame seam test).
- `backForward` gains `'mirror'` (the new default: the reverse of the same effect); `'reverse'`, `'same'` and `'none'` stay.
- **UI state survives navigation:** the site keeps playground state in the URL (`?effect=…&shards=…`), so Back and Forward restore it, and links can be shared.

### 3.7 Region transitions (from ADR-042)

`shatter.transition({ target: element })`: capture and fracture one element, with the rest of the page live. Needed for card hovers, modals, tab panels and "click a card, it breaks into the next page". Requires a cropped capture, a scissored overlay and a camera per region. Big but high-value; its own milestone.

### 3.8 Sound and haptics (opt-in)

Procedural WebAudio (no files): crack ticks, shatter burst, tinkling falls, scaled by impulse and piece count; material-specific. Muted by default, `sound: true` to enable. Never plays under reduced motion or before a user gesture.

## 4. The site: art direction (fixes items 1 and 4)

### 4.1 Three directions to choose from (see section 9)

**A. "Material lab" (recommended).** A clean, light, precise laboratory for breaking things. Warm off-white "bench" background, ink-black type, specimen labels, hairline rules, measurement annotations (live fps, shard count, capture ms shown as instrument readouts), one signal colour (safety orange-red) used only for impact points and active states. A neo-grotesk display face with a technical mono. It feels like a materials-science instrument, not a template.

**B. "Glass gallery."** Museum lighting: deep warm grey walls, objects under spotlights, a real WebGL glass pane floating over the hero that refracts the page beneath it and throws caustics that follow the cursor. Quiet, premium, slow.

**C. "Foundry."** Dark, but mineral rather than black: obsidian, quartz, copper and slate. Heavy display type, molten-orange impacts, sparks. Loud and physical.

Whichever direction: **the theme is interactive**. A material switcher (glass, ice, obsidian, paper…) changes the UI palette, the cursor, the scrollbar, the sound and the transition material together, and switching itself plays a transition. The choice is remembered (localStorage), with light and dark variants and `prefers-color-scheme` respected.

### 4.2 Signature details (the opposite of "AI slop")

- **Scrollbar:** native scrollbar hidden (`scrollbar-width: none`; WebKit pseudo-elements), replaced by a **glass rail**: a thin pane whose thumb is a shard. It stretches with scroll velocity (spring), shows section markers you can click, cracks briefly on very fast flicks and heals. Draggable, keyboard scrolling untouched. A reduced-motion variant without stretch. It is part of the page, so it is captured and shatters with everything else.
- **Cursor:** the cursor kit from 3.5, with a magnetic pull to links and the pre-crack preview.
- **Micro-interactions:** buttons crack on press and heal, cards tilt under a glass sheen that follows the pointer, code blocks "etch" in.
- **Motion language:** one set of springs and durations across the site, all under reduced-motion control.
- **Typography:** a distinctive display face (e.g. a sharp grotesk or a variable "ink trap" face), not a generic serif. Self-hosted, subset, one weight axis, budgeted (lessons from ADR-043: every capture inlines the fonts).
- **Imagery:** no stock gradients. Specimen photography-style renders made by the engine itself (frozen frames of real fractures) as card art.

## 5. The site: information architecture and features (fixes items 5 and 6)

| Page | What it becomes |
| --- | --- |
| Home | Interactive hero (hold to charge, release to break; drag to tear). A strip of live "specimens" you can break in place (needs region transitions). Proof numbers as live instrument readouts. |
| Effects → **Library** | Browse by family (gravity, force, order, matter, assembly), by pattern and by material. Every card is a live mini stage that breaks on hover-hold. A **compare mode**: two stages side by side, the same click, two effects. |
| Effect page | A large live stage with replay, slow-motion (0.25×), a timeline scrubber (pause at any moment, `setMotionTime` already exists), wireframe and pattern overlays, its parameters, the code, and "open in Studio". |
| Playground → **Studio** | Pattern × motion × material × stagger × timing composer; presets; randomise; **state in the URL** (shareable, survives Back); undo; export config (vanilla, React, React Router, Next); record a GIF/WebM of the stage; performance readout. |
| Docs | MDX content, sidebar plus on-page table of contents, **Cmd-K search** (prebuilt index), **syntax highlighting** at build (Shiki), copy buttons, versioned (0.x), framework tabs (vanilla / React / RR / Next) that remember your choice, "edit this page", changelog page, migration guides. |
| Showcase | Real sites using it, with videos. |
| Benchmarks | Live in-browser benchmark: fps, capture ms, fracture ms on the visitor's own device, compared with the reference machine. |

## 6. Production-grade foundations

- **SEO and sharing:** per-page metadata, canonical URLs, `sitemap.xml`, `robots.txt`, generated Open Graph images per page and per effect (a frozen fracture frame), JSON-LD for the software package.
- **Security:** security headers on Vercel (CSP with the documented directives, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS), dependency audit in CI.
- **Observability:** Vercel Speed Insights and Web Analytics (privacy-friendly, no cookies), error tracking for client errors, uptime check.
- **Accessibility:** axe checks in CI for every page, keyboard paths for every interaction (hold-to-charge has a key equivalent), focus styles designed, reduced-motion versions of every animation, screen-reader descriptions for live stages.
- **Performance budgets as CI gates:** Lighthouse CI on every PR (Performance ≥ 95, Accessibility 100 on mobile), size-limit per chunk, the real-GPU suite run before releases.
- **Quality:** visual regression screenshots of every page and theme (Playwright), seam tests for every pattern × motion × material combination that ends at rest, cross-browser on the three engines plus a real iOS Safari and Android Chrome pass (BrowserStack or devices).
- **Release engineering:** npm publishing through Changesets in CI with provenance, preview deployments per PR (now in place), a custom domain if wanted.

## 7. Milestones (each with the A.5 ritual: tests, PR, three-engine CI, merge, tag)

| M | Name | Contents | Acceptance |
| --- | --- | --- | --- |
| 13 | Navigation memory | Effect per history entry, `backForward: 'mirror'`, true reverse for the 5 current effects, playground state in the URL | Back replays the reverse of the forward effect on all adapters and engines; last-frame seams for every reverse; playground survives Back |
| 14 | Effect architecture | Engine core + lazy pattern/motion/material chunks, effect composition API, current effects as presets, per-chunk budgets | Engine core ≤ 15 KB; no seam or fps regression; existing API unchanged |
| 15 | Patterns | radial, triangles, hex, bricks/tiles, strips, rings, dom, text, pixels, mask | Tests per pattern (area, UVs, seam, fracture time) |
| 16 | Motions and materials | The four families in 3.3, rebuilt `explode` (blast), 7 materials, stagger/easing controls | Each effect visually distinct (side-by-side review), 60 fps at 160 pieces, 0 B/frame allocations |
| 17 | Interaction and cursor | Cursor kits, hover pre-crack, hold to charge, drag to tear, scroll-driven, touch, sound (opt-in), haptics | Keyboard and reduced-motion equivalents; no long tasks |
| 18 | Region transitions | `transition({ target })` | Seam tests for regions; works inside scroll containers |
| 19 | Site redesign | Chosen art direction, material theme switcher, glass scrollbar, cursor, micro-interactions, new type, light/dark | Design review with you; Lighthouse ≥ 95 / 100; visual regression baseline |
| 20 | Site features | Library with families and compare mode, effect pages with timeline and slow-mo, Studio (composer, presets, URL state, export, recording), MDX docs with search and highlighting, showcase, live benchmark | Every feature with e2e tests; docs complete for every new API |
| 21 | Production foundations | SEO/OG, security headers, analytics, monitoring, axe + Lighthouse CI + visual regression in CI, real-device pass, npm release pipeline | All gates green; v1.0.0 published (your call) |

Order matters: 13 fixes the bug you saw first; 14 must come before 15–17 or the budget breaks; 19 can start in parallel with 15–17 once you pick a direction, because the site redesign does not depend on new engine features until 20.

## 8. Risks

- **Budget and complexity:** dozens of combinations multiply the seam and performance tests. Mitigation: combinations are composed from tested parts; the e2e suite tests each part and a sampled matrix.
- **Region transitions** touch capture, camera and engine at once (the reason ADR-042 deferred them). Mitigation: own milestone, spike first.
- **Custom scrollbar and cursor** can hurt accessibility and feel gimmicky. Mitigation: native scrolling stays intact, opt-out switch, reduced-motion variants, user testing.
- **Mobile GPUs:** many pieces plus particles. Mitigation: device tiers (exists), per-pattern piece caps, automatic quality scaling.
- **Effort:** this is roughly as much work again as M0–M12. Each milestone ships on its own, so the site improves step by step.

## 9. Decisions needed from you

1. **Art direction:** A "Material lab" (recommended), B "Glass gallery", or C "Foundry"? Or describe or link sites you like.
2. **Order:** start with M13 (the Back bug) and the redesign (M19) in parallel, or features first?
3. **Sound:** include opt-in procedural sound (M17), or leave it out?
4. **Scope of v1.0:** all of M13–M21, or a subset (for example 13, 14, 16, 19, 20, 21 first)?
5. **Domain:** keep `shatter-router.vercel.app` or use a custom domain?
6. **npm:** publish 0.1.0 now, or wait for 1.0?
