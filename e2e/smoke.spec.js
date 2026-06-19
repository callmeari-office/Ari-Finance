// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Smoke tests — yêu cầu dev server chạy trên localhost:3000.
 * Chạy: npx playwright test (hoặc thêm script "test:e2e": "playwright test" vào package.json)
 * Tài khoản: owner / Ari@123456789
 */

async function login(page) {
  await page.goto('/login');
  await page.fill('#email', 'owner');
  await page.fill('#password', 'Ari@123456789');
  await page.click('button[type="submit"]');
  // Chờ redirect về dashboard
  await page.waitForURL('/', { timeout: 15_000 });
}

test.describe('Smoke — authenticated owner', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Dashboard loads and shows heading', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('/de-xuat loads', async ({ page }) => {
    await page.goto('/de-xuat');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('/thu-chi loads', async ({ page }) => {
    await page.goto('/thu-chi');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('/de-xuat/duyet loads', async ({ page }) => {
    await page.goto('/de-xuat/duyet');
    await expect(page.locator('h1').first()).toBeVisible();
  });
});
