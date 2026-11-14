import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

/** Ports of the example apps the e2e suite runs against. */
export const APPS = {
  vanilla: 'http://localhost:4173',
  reactRouter: 'http://localhost:4174',
} as const;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    // CI runs Firefox headed under xvfb (PW_HEADED=1): only then does it get a
    // software OpenGL driver for WebGL on a GPU-less runner (ADR-015).
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
        // Firefox blocks WebGL2 on GPU-less machines (AllowWebgl2:false) unless
        // forced; with Mesa's software driver it then renders normally.
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
    {
      command: 'pnpm --filter @shatter-router/example-react-router preview',
      url: APPS.reactRouter,
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
  ],
});
