import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react/index.ts',
    'react-router': 'src/react-router/index.ts',
    // Internal lazy chunks. They are entries only so their file names are
    // stable (the core loads them with dynamic import, size-limit budgets
    // them separately); they are not part of the package's public exports.
    runtime: 'src/runtime/index.ts',
    engine: 'src/engine/index.ts',
    capture: 'src/capture/index.ts',
  },
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  dts: {
    entry: {
      index: 'src/index.ts',
      react: 'src/react/index.ts',
      'react-router': 'src/react-router/index.ts',
    },
  },
  splitting: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
});
