import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig, type Options } from 'tsup';
import { minifyGlslTemplates } from './build/glsl';

type EsbuildPlugin = NonNullable<Options['esbuildPlugins']>[number];

/** Strips comments and indentation from `/* glsl *\/` templates (ADR-039). */
const glslMinify: EsbuildPlugin = {
  name: 'glsl-minify',
  setup(build) {
    build.onLoad({ filter: /[\\/]src[\\/].*\.ts$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      if (!source.includes('/* glsl */')) return undefined;
      return { contents: minifyGlslTemplates(source), loader: 'ts' };
    });
  },
};

/**
 * Entries that export React components. esbuild drops module directives when
 * bundling, so `"use client"` is added to the built files afterwards (ADR-034):
 * Next.js needs it to treat them as client modules. Prepended on the first line
 * so the source map stays aligned.
 */
const CLIENT_ENTRIES = ['dist/react.js', 'dist/react-router.js', 'dist/next.js'];
const USE_CLIENT = '"use client";';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react/index.ts',
    'react-router': 'src/react-router/index.ts',
    next: 'src/next/index.ts',
    rapier: 'src/rapier/index.ts',
    // Internal lazy chunks. They are entries only so their file names are
    // stable (the core loads them with dynamic import, size-limit budgets
    // them separately); they are not part of the package's public exports.
    runtime: 'src/runtime/index.ts',
    engine: 'src/engine/index.ts',
    capture: 'src/capture/index.ts',
    'rapier-backend': 'src/rapier/backend.ts',
    debug: 'src/debug/index.ts',
    // Effect parts, one chunk each, loaded on first use (ADR-048).
    'effects/shatter': 'src/engine/effects/shatter.ts',
    'effects/explode': 'src/engine/effects/explode.ts',
    'effects/implode': 'src/engine/effects/implode.ts',
    'effects/flip': 'src/engine/effects/flip.ts',
    'effects/assemble': 'src/engine/effects/assemble.ts',
    'patterns/impact': 'src/engine/patterns/impact.ts',
    'patterns/radial': 'src/engine/patterns/radial.ts',
    'patterns/triangles': 'src/engine/patterns/triangles.ts',
    'patterns/hex': 'src/engine/patterns/hex.ts',
    'patterns/grid': 'src/engine/patterns/grid.ts',
  },
  // Optional peers stay external. tsup's automatic peer handling missed this
  // scoped one and inlined 4.2 MB of Rapier (LEARNINGS).
  external: ['@dimforge/rapier3d-compat'],
  esbuildPlugins: [glslMinify],
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  dts: {
    entry: {
      index: 'src/index.ts',
      react: 'src/react/index.ts',
      'react-router': 'src/react-router/index.ts',
      next: 'src/next/index.ts',
      rapier: 'src/rapier/index.ts',
    },
  },
  splitting: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
  async onSuccess() {
    for (const file of CLIENT_ENTRIES) {
      const code = await readFile(file, 'utf8');
      if (!code.startsWith(USE_CLIENT)) await writeFile(file, USE_CLIENT + code);
    }
  },
});
