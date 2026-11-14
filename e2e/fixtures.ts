import { test as base, expect } from '@playwright/test';

/**
 * Console noise that comes from the test environment, not from the page.
 *
 * Headless Chromium has no GPU compositor, so it reads every WebGL frame back
 * from the software GL driver and that driver logs a performance note. Chrome
 * on a real GPU does not print it (checked on an RTX 4050, ANGLE D3D11).
 */
const ENVIRONMENT_NOISE = [
  /GL Driver Message \(OpenGL, Performance, [^)]*\): GPU stall due to ReadPixels/,
];

/**
 * Shared test fixture: every test fails if the page logs a console error or
 * warning, or throws an uncaught exception (master prompt, section 11).
 */
export const test = base.extend<{ consoleProblems: string[] }>({
  consoleProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        const type = message.type();
        if (type !== 'error' && type !== 'warning') return;
        const text = message.text();
        if (ENVIRONMENT_NOISE.some((pattern) => pattern.test(text))) return;
        problems.push(`[console.${type}] ${text}`);
      });
      page.on('pageerror', (error) => {
        problems.push(`[pageerror] ${error.message}`);
      });
      await use(problems);
      expect(problems, 'no console errors or warnings').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
