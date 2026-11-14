# Learnings

Grouped by topic. Append, de-duplicate. Facts must cite package versions or commit SHAs.

## Environment (Windows)

- Machine: Windows 11, project path `D:\Shatter Router` contains a space: always quote paths in scripts and docs.
- Toolchain at session 1: git 2.55.0.windows.3, gh 2.96.0, Node v24.21.0, npm 11.19.0, pnpm 12.8.1 (global), corepack 0.36.0.
- No global git identity on this machine; the repo uses a repo-local identity (ADR-002).
- `pnpm exec playwright install chromium firefox webkit` took more than 10 minutes on this connection. Browsers land in `%LOCALAPPDATA%\ms-playwright`. While the install is still running, launching an already-listed browser can fail with `browserType.launch: spawn UNKNOWN`; wait for the install to finish.

## Tooling

- **pnpm 12.8.1** blocks dependency build scripts by default and fails `pnpm add` with `ERR_PNPM_IGNORED_BUILDS`. Approve per package with `pnpm approve-builds <pkg>`; it writes `allowBuilds: { <pkg>: true }` into `pnpm-workspace.yaml` (currently only `esbuild`).
- **pnpm 12.8.1** has a minimum-release-age supply-chain policy. Installing a version younger than the threshold adds it to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` automatically (non-strict mode). Those entries are expected, not noise.
- **typescript 7.0.2** has no classic JS compiler API (exports only `./lib/version.cjs` and `unstable/*`). typescript-eslint 8.72.2 requires `<6.1.0`. See ADR-003.
- **typescript-eslint 8.72.2:** `tseslint.config()` is deprecated; use `defineConfig` from `eslint/config` (ESLint 10.15.0) and pass `tseslint.configs.strictTypeChecked` without spreading.
- **typescript-eslint projectService:** a file listed in `allowDefaultProject` that is also covered by a tsconfig is a hard parsing error. Only `*.js` (the ESLint config itself) is in `allowDefaultProject`; `playwright.config.ts` and `e2e/` are covered by the root `tsconfig.json`.
- **size-limit 14.3.0** (`@size-limit/preset-small-lib`, bundles with rolldown) reports **brotli** by default. The spec's budgets are gzip, so every check sets `"gzip": true`.
- **Vitest 5.1.0 + happy-dom 21.0.4:** the document URL defaults to `about:blank`; set `environmentOptions.happyDOM.url` so relative `href`s resolve to an http(s) origin.
- Bash heredocs containing TypeScript with template literals and nested quotes failed once with `unexpected EOF while looking for matching '` in this harness. Write source files with the file tool instead of heredocs.

## API facts (verified from installed type definitions)

- `size-limit@14.3.0` `Check`: `gzip?: boolean` ("use Gzip and disable Brotli"), `brotli?: boolean`, `import?: string | Record<string, string>`, `path`, `limit`, `ignore?: string[]`.

## Bugs found

- **Example re-rendered on in-page anchor clicks.** Symptom: e2e "same-page hash links do not re-render the route" failed (the marked `<h1>` was replaced). Root cause: browsers fire `popstate` for fragment navigations too, and the example's `popstate` handler always re-rendered. Fix: remember the rendered `pathname + search` and re-render only when it changes (`examples/vanilla/src/main.ts`). The adapters must apply the same rule: a hash-only `popstate` is not a route change.

## Approaches that did not work

_(none yet)_

## Browser / OS quirks

- `popstate` fires on same-document fragment navigation (clicking `<a href="#id">`) in Chromium, not only on history traversal.
