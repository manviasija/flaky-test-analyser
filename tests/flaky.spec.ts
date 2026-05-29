import { test, expect } from '@playwright/test';

test('example page loads successfully', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example Domain/);
});