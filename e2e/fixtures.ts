import { test as base, expect } from '@playwright/test';

/**
 * Console noise that comes from the test environment, not from the page.
 *
 * Headless Chromium has no GPU compositor, so it reads every WebGL frame back
 * from the software GL driver and that driver logs a performance note. Chrome
 * on a real GPU does not print it (checked on an RTX 4050, ANGLE D3D11).
 *
 * Firefox warns when a script reads layout before the load event. Playwright's
 * own injected helpers do that while waiting for the page; Firefox attributes
 * those to "debugger eval code", never to a page script.
 */
const ENVIRONMENT_NOISE = [
  /GL Driver Message \(OpenGL, Performance, [^)]*\): GPU stall due to ReadPixels/,
  /Layout was forced before the page was fully loaded\..*\{file: "debugger eval code"/,
];

/**
 * Known notes from the docs site itself, allowed by origin.
 *
 * The glass rail (ADR-050) is a scroll position indicator: it moves its thumb
 * as the page scrolls, which Firefox reports as a "scroll-linked positioning
 * effect" (it may lag a frame behind asynchronous panning). Firefox has no
 * scroll-driven animations by default, so the rail cannot avoid it there.
 */
const SITE_NOTES = [/scroll-linked positioning effect.*\{file: "http:\/\/localhost:4176\//];

/**
 * Shared test fixture: every test fails if the page logs a console error or
 * warning, or throws an uncaught exception (master prompt, section 11).
 */
export const test = base.extend<{ consoleProblems: string[]; expectedConsole: RegExp | null }>({
  /**
   * Console messages a specific test expects (for example the CSP violation
   * a strict-CSP test provokes on purpose). Set with test.use(); none by default.
   * A single RegExp: Playwright would read an array as a fixture tuple.
   */
  expectedConsole: [null, { option: true }],
  consoleProblems: [
    async ({ page, expectedConsole }, use) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        const type = message.type();
        if (type !== 'error' && type !== 'warning') return;
        const text = message.text();
        if (ENVIRONMENT_NOISE.some((pattern) => pattern.test(text))) return;
        if (SITE_NOTES.some((pattern) => pattern.test(text))) return;
        if (expectedConsole?.test(text)) return;
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
