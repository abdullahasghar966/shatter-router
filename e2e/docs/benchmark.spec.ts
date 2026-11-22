import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';

/** The live benchmark page (ADR-061). */

const BASE = APPS.docs;

test.describe('benchmark', () => {
  test('breaks the page five times and reports what this device measured', async ({ page }) => {
    // Software GL is slow: give captures the room the e2e suite always gives.
    await page.goto(`${BASE}/benchmark?budget=5000`);
    await expect(page.locator('h1')).toHaveText('Measure it here.');
    await expect(page.getByText(/^This device: \d+×\d+ CSS px/)).toBeVisible();
    await page.getByRole('button', { name: 'Run the benchmark' }).click();
    await expect(page.getByRole('button', { name: 'Run again' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('status').filter({ hasText: 'Done' })).toHaveText('Done: 5 runs.');
    const runs = page.getByTestId('bench-runs').locator('tbody tr');
    await expect(runs).toHaveCount(5);
    // Every run measured all four numbers, with no fallback.
    for (const row of await runs.allInnerTexts()) {
      expect(row).not.toContain('—');
      expect(row).not.toContain('fallback');
    }
    const summary = page.getByTestId('bench-summary');
    await expect(summary.getByRole('row', { name: /Fracture \(\d+ pieces\)/ })).toBeVisible();
    await expect(summary.getByRole('row', { name: /^Capture/ })).toContainText(/\d+\.\d ms/);
    await expect(summary.getByRole('row', { name: /^Frame rate/ })).toContainText(/\d+\.\d fps/);
    // The reference column holds the measured reference, never a placeholder.
    await expect(summary).toContainText('76–109 ms');
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('says the effect did not play unless the visitor asks for it', async ({ page }) => {
      await page.goto(`${BASE}/benchmark?budget=5000`);
      const consent = page.getByRole('checkbox', { name: /reduced motion/ });
      await expect(consent).not.toBeChecked();
      await page.getByRole('button', { name: 'Run the benchmark' }).click();
      await expect(page.getByRole('button', { name: 'Run again' })).toBeVisible({
        timeout: 90_000,
      });
      await expect(page.getByRole('status').filter({ hasText: 'Done' })).toContainText(
        'did not play (reduced-motion)',
      );
      await consent.check();
      await page.getByRole('button', { name: 'Run again' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Done' })).toHaveText(
        'Done: 5 runs.',
        { timeout: 90_000 },
      );
    });
  });
});
