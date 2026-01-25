import { test, expect } from '@playwright/test';

test('game loads successfully', async ({ page }) => {
  await page.goto('/');

  // Check page title
  await expect(page).toHaveTitle('Hacker Incremental');

  // Wait for the game canvas to appear (PixiJS creates this)
  const canvas = page.locator('#game-container canvas');
  await expect(canvas).toBeVisible({ timeout: 10000 });

  // Loading indicator should be hidden after game initializes
  const loading = page.locator('#loading');
  await expect(loading).toHaveClass(/hidden/, { timeout: 10000 });
});
