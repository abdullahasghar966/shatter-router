import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

/** Ports of the example apps the e2e suite runs against. */
export const APPS = {
  vanilla: 'http://localhost:4173',
} as const;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    headless: !process.env.PW_HEADED,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      // Serves the already-built example (`pnpm build` then `pnpm build:examples`).
      command: 'pnpm --filter @shatter-router/example-vanilla preview',
      url: APPS.vanilla,
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
  ],
});
