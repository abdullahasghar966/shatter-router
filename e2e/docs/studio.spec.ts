import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';

/** The Studio (the playground page): presets, randomise, undo, export tabs (ADR-061). */

const BASE = APPS.docs;

test.describe('studio', () => {
  test('a preset sets its composition, and Undo goes back step by step', async ({ page }) => {
    await page.goto(`${BASE}/playground`);
    const code = page.getByTestId('config-code');
    const effect = page.locator('.pane-host select').first();
    await expect(effect).toBeVisible();
    const undo = page.getByRole('button', { name: /^Undo/ });
    await expect(undo).toBeDisabled();

    await effect.selectOption('flip');
    await expect(code).toContainText("effect: 'flip',");
    await expect(undo).toHaveText('Undo (1)');

    await page.getByRole('button', { name: 'Obsidian vortex' }).click();
    await expect(code).toContainText(
      "effect: { motion: 'vortex', pattern: 'triangles', stagger: 'spiral' },",
    );
    await expect(code).toContainText("material: 'obsidian',");
    await expect(effect).toHaveValue('vortex');
    await expect.poll(() => new URL(page.url()).searchParams.get('material')).toBe('obsidian');
    await expect(undo).toHaveText('Undo (2)');

    // Ctrl+Z outside a field, then the button.
    await page.locator('h1').click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(code).toContainText("effect: 'flip',");
    await expect(code).not.toContainText('material:');
    await expect.poll(() => new URL(page.url()).searchParams.has('material')).toBe(false);
    await undo.click();
    await expect(code).toContainText("effect: 'shatter',");
    await expect(effect).toHaveValue('shatter');
    await expect(undo).toBeDisabled();
    await page.waitForLoadState('networkidle');
  });

  test('randomise draws new settings that can be undone', async ({ page }) => {
    await page.goto(`${BASE}/playground`);
    const code = page.getByTestId('config-code');
    await expect(page.locator('.pane-host select').first()).toBeVisible();
    const before = await code.textContent();
    // A random draw can repeat a setting, but not all of them at once.
    await page.getByRole('button', { name: 'Randomise' }).click();
    await expect(code).not.toHaveText(before ?? '');
    await expect(code).toContainText('shards:');
    await expect.poll(() => new URL(page.url()).searchParams.has('shards')).toBe(true);
    await page.getByRole('button', { name: 'Undo (1)' }).click();
    await expect(code).toHaveText(before ?? '');
    await page.waitForLoadState('networkidle');
  });

  test('exports for every framework, and the choice is remembered', async ({ page }) => {
    await page.goto(`${BASE}/playground`);
    await expect(page.locator('.pane-host select').first()).toBeVisible();
    const tabs = page.getByRole('tablist', { name: 'Framework' });
    // Next.js until the visitor picks another.
    await expect(tabs.getByRole('tab', { name: 'Next.js' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const next = page.getByTestId('config-code-next');
    await expect(next).toBeVisible();
    await expect(next).toContainText("import { ShatterProvider } from 'shatter-router/next';");
    await expect(next).toContainText("effect: 'shatter',");
    await expect(page.getByTestId('config-code')).toBeHidden();

    // Arrow keys move between tabs.
    await tabs.getByRole('tab', { name: 'Next.js' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: 'React Router' })).toBeFocused();
    await expect(page.getByTestId('config-code-react-router')).toContainText(
      "from 'shatter-router/react-router'",
    );
    await tabs.getByRole('tab', { name: 'React', exact: true }).click();
    await expect(page.getByTestId('config-code-react')).toBeVisible();

    await page.reload();
    await expect(
      page
        .getByRole('tablist', { name: 'Framework' })
        .getByRole('tab', { name: 'React', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    // Shown before hydration: the layout's script set the attribute.
    expect(await page.evaluate(() => document.documentElement.dataset.framework)).toBe('react');
    await expect(page.getByTestId('config-code-react')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });
});
