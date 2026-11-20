# shatter-router

## 0.1.0

### Minor Changes

- First release. WebGL2 glass-shatter page transitions for single-page apps.

  - Core (`shatter-router`): `createShatter()`, `transition({ commit })`, events, link rules; 1.8 kB until first use, with the runtime, renderer and DOM capture loaded on idle.
  - Effects: `shatter`, `explode`, `implode`, `flip`, `assemble`, and a public effect interface for custom ones.
  - Adapters: `shatter-router/react`, `shatter-router/react-router` (React Router 7) and `shatter-router/next` (App Router), with back/forward and scroll restoration.
  - Optional Rapier physics (`shatter-router/rapier`), glass shading (rim light, glint, chromatic aberration, tint) and a debug panel with a seam check.
  - Fallbacks for no WebGL2, reduced motion, slow captures, strict CSP and errors: navigation always completes.
