# Contributing

Thanks for helping. This file explains how the repository works, how to run everything, and what a pull request needs.

## Setup

Node 20.19+ and pnpm 12. Every command works in PowerShell and bash.

```bash
pnpm install
pnpm exec playwright install chromium firefox webkit   # once, for the e2e suite
pnpm build             # the library (packages/shatter-router)
pnpm build:examples    # the example apps and the docs site (need the library build)
```

Set `NEXT_TELEMETRY_DISABLED=1` in your shell before building the Next.js apps if you don't want Next's telemetry.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test              # unit tests (Vitest, happy-dom)
pnpm test:e2e          # end-to-end (Playwright) against the built examples and docs site
pnpm size              # bundle budgets (size-limit)
```

The e2e suite starts the example servers itself (ports 4173–4176). Locally, `--workers=2` keeps software-rendered WebGL fast enough; CI runs all three engines on every pull request into `main`.

### Real-GPU measurements

Headless browsers render WebGL in software, so frame rate, long tasks and capture time are only printed there. To enforce them on a real GPU, run headed with your installed Chrome:

```bash
SHATTER_PERF=1 npx playwright test e2e/vanilla/performance.spec.ts e2e/docs/landing.spec.ts --project=chromium --workers=1
```

In PowerShell, set `$env:SHATTER_PERF=1` first.

## How the code is organised

- `src/core`: the 1.8 kB facade (options, events, link rules) and shared types. It must stay small.
- `src/runtime`: the lazily loaded state machine, fallbacks, focus and announcements.
- `src/engine`: the WebGL2 renderer, fracture and the built-in effects (one draw call per frame).
- `src/capture`: the DOM capture (modern-screenshot, with our own clone session).
- `src/react`, `src/react-router`, `src/next`, `src/rapier`, `src/debug`: adapters and optional chunks.

Two rules hold everywhere:

1. **Navigation always completes.** Any failure in Shatter must fall back to a plain navigation and emit `fallback`/`error`.
2. **The seam guarantee.** The first frame of every effect (and the last frame of `flip`/`assemble`) must match the live page. The seam tests in `e2e/vanilla/seam.spec.ts` and `e2e/vanilla/effects.spec.ts` measure it.

## Decisions and notes

`context/` is the project's memory: `DECISIONS.md` (one ADR per decision or deviation), `PROGRESS.md` (milestones, every measurement), `LEARNINGS.md` (bugs, browser quirks, failed approaches) and `HANDOFF.md`. If your change makes a decision, add an ADR. If you measure something, record it with the device and browser.

## Pull requests

- Conventional Commits (`feat(engine): …`, `fix(capture): …`, `docs: …`).
- Add a changeset for user-visible changes: `pnpm changeset`.
- Keep the checks green: typecheck, lint, format, unit, e2e on all three engines, size.
- New behaviour needs a test. Visual changes need seam numbers, and they must not get worse.

## The README demo

`media/shatter-demo.gif` is recorded from the docs site with `scripts/record-demo.mjs`. The steps are in that file.
