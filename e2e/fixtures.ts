import { test as base, expect } from '@playwright/test';

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
        if (type === 'error' || type === 'warning') {
          problems.push(`[console.${type}] ${message.text()}`);
        }
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
