# Shatter Router

Glass-shatter page transitions for single-page apps, rendered in WebGL2.

> **Status: early development.** The library is being built milestone by milestone
> (see [`context/PROGRESS.md`](context/PROGRESS.md)). Nothing is published to npm yet.

## Repository layout

| Path                      | What it is                                                                 |
| ------------------------- | -------------------------------------------------------------------------- |
| `packages/shatter-router` | The library (framework-agnostic core; adapters arrive in later milestones) |
| `examples/vanilla`        | A plain `history.pushState` example app                                    |
| `e2e`                     | Playwright end-to-end tests that run against the example apps              |
| `context`                 | Living project notes: hand-off, progress, decisions, learnings             |

## Development

Requires Node 20.19+ and pnpm 12. All commands work in PowerShell and bash.

```bash
pnpm install
pnpm build            # build the library
pnpm build:examples   # build the example apps (needs the library build)
pnpm typecheck
pnpm lint
pnpm test             # unit tests (Vitest)
pnpm test:e2e         # end-to-end tests (Playwright; run `pnpm exec playwright install` once)
pnpm size             # bundle-size budgets (size-limit)
```

## License

[MIT](LICENSE)
