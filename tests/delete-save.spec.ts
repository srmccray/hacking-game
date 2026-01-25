import { test, expect, Page } from '@playwright/test';

/**
 * E2E tests for the delete save confirmation dialog.
 *
 * These tests verify that:
 * 1. The delete confirmation dialog shows a default selection
 * 2. Arrow keys work to navigate between options
 * 3. The delete flow works correctly
 */

// Helper to wait for the game to fully load
async function waitForGameLoad(page: Page): Promise<void> {
  const canvas = page.locator('#game-container canvas');
  await expect(canvas).toBeVisible({ timeout: 10000 });

  const loading = page.locator('#loading');
  await expect(loading).toHaveClass(/hidden/, { timeout: 10000 });
}

// Helper to create a save slot that can be deleted
async function createSaveSlot(page: Page): Promise<void> {
  // Navigate to first empty slot and create a new game
  await page.keyboard.press('Enter');
  // Wait a moment for the name input dialog
  await page.waitForTimeout(300);
  // Enter a name
  await page.keyboard.type('TestPlayer');
  await page.keyboard.press('Enter');
  // Wait for game to load
  await page.waitForTimeout(1000);
}

// Helper to return to main menu (via reload for simplicity)
async function returnToMainMenu(page: Page): Promise<void> {
  await page.reload();
  await waitForGameLoad(page);
}

test.describe('Delete Save Confirmation Dialog', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForGameLoad(page);
  });

  test('confirm dialog shows default selection when opened', async ({ page }) => {
    // First, create a save to delete
    await createSaveSlot(page);
    await returnToMainMenu(page);

    // Select the first slot (which now has our save)
    // The first slot should already be selected by default

    // Press Delete to open the confirm dialog
    await page.keyboard.press('Delete');

    // Wait for the dialog to appear
    await page.waitForTimeout(300);

    // Take a screenshot to visually verify the dialog shows with selection
    // The "No, Cancel" option (index 1) should be highlighted by default
    await expect(page).toHaveScreenshot('delete-confirm-dialog-default-selection.png', {
      maxDiffPixels: 100,
    });
  });

  test('arrow keys change selection in confirm dialog', async ({ page }) => {
    // Create a save first
    await createSaveSlot(page);
    await returnToMainMenu(page);

    // Open delete confirmation
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Take initial screenshot (No should be selected)
    const initialScreenshot = await page.screenshot();

    // Press left arrow to select "Yes"
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);

    // Take screenshot after pressing left (Yes should be selected)
    const afterLeftScreenshot = await page.screenshot();

    // Press right arrow to select "No" again
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    // Take screenshot after pressing right (No should be selected again)
    const afterRightScreenshot = await page.screenshot();

    // The screenshots should be different after pressing arrows
    // (Visual indication that selection changed)
    expect(Buffer.compare(initialScreenshot, afterLeftScreenshot)).not.toBe(0);
    expect(Buffer.compare(afterLeftScreenshot, afterRightScreenshot)).not.toBe(0);
  });

  test('up/down arrows also work in confirm dialog', async ({ page }) => {
    // Create a save first
    await createSaveSlot(page);
    await returnToMainMenu(page);

    // Open delete confirmation
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Take initial screenshot
    const initialScreenshot = await page.screenshot();

    // Press down arrow (should change selection)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Take screenshot after down
    const afterDownScreenshot = await page.screenshot();

    // Press up arrow (should change selection back)
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);

    // Take screenshot after up
    const afterUpScreenshot = await page.screenshot();

    // Screenshots should differ indicating selection changed
    expect(Buffer.compare(initialScreenshot, afterDownScreenshot)).not.toBe(0);
    expect(Buffer.compare(afterDownScreenshot, afterUpScreenshot)).not.toBe(0);
  });

  test('escape cancels delete dialog', async ({ page }) => {
    // Create a save first
    await createSaveSlot(page);
    await returnToMainMenu(page);

    // Open delete confirmation
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Press Escape to cancel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // The dialog should be closed, we should be back at menu
    // Try pressing Delete again - if it works, we're back at the menu
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Take screenshot to verify dialog re-opened (proving first one was closed)
    await expect(page).toHaveScreenshot('delete-dialog-after-cancel-reopen.png', {
      maxDiffPixels: 100,
    });
  });

  test('selecting No cancels delete', async ({ page }) => {
    // Create a save first
    await createSaveSlot(page);
    await returnToMainMenu(page);

    // Open delete confirmation
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // No should be selected by default, press Enter to confirm "No"
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Dialog should close, save should still exist
    // Try to delete again - if dialog opens, save still exists
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Should be able to open the confirm dialog again
    await expect(page).toHaveScreenshot('delete-dialog-save-preserved.png', {
      maxDiffPixels: 100,
    });
  });

  test('selecting Yes deletes the save', async ({ page }) => {
    // Create a save first
    await createSaveSlot(page);
    await returnToMainMenu(page);

    // Open delete confirmation
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Navigate to Yes (press left)
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);

    // Press Enter to confirm deletion
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Save should be deleted, trying to delete should do nothing
    // (empty slots can't be deleted)
    // Take screenshot to verify we're back at menu with empty slot
    await expect(page).toHaveScreenshot('after-save-deleted.png', {
      maxDiffPixels: 100,
    });
  });
});
