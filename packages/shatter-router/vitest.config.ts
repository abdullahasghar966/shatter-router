import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: { url: 'https://app.example/work?tab=1' },
    },
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
