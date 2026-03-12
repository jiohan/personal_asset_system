const fs = require('fs');
const path = require('path');
const { test, expect } = require('playwright/test');

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const screenshotsDir = path.join(__dirname, '..', 'test-results', 'runtime-rebuild');

function uniqueEmail() {
  return `runtime-rebuild-${Date.now()}@example.com`;
}

function appUrl(pathname) {
  return `${baseUrl}/#${pathname}`;
}

test('runtime rebuild flow covers P1 and P2 screens', async ({ page }) => {
  fs.mkdirSync(screenshotsDir, { recursive: true });

  await page.goto(baseUrl);
  await page.getByRole('tab', { name: 'Sign up' }).click();
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByLabel('Password').fill('demo-password');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Control Center' })).toBeVisible();
  await page.screenshot({ path: path.join(screenshotsDir, 'dashboard-desktop.png'), fullPage: true });

  await page.goto(appUrl('/accounts'));
  await expect(page.getByRole('heading', { name: 'Ledger Accounts' })).toBeVisible();
  await page.getByRole('button', { name: 'New Row' }).click();
  await page.getByLabel('Account name').fill('Main Checking');
  await page.getByLabel('Account type').selectOption('CHECKING');
  await page.getByLabel('Opening balance (KRW)').fill('100000');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText('Account row added to the library.')).toBeVisible();
  await page.screenshot({ path: path.join(screenshotsDir, 'accounts-desktop.png'), fullPage: true });

  await page.goto(appUrl('/categories'));
  await expect(page.getByRole('heading', { name: 'Category Library' })).toBeVisible();
  await page.getByLabel('Category name').fill('Food');
  await page.getByRole('button', { name: 'Create Category' }).click();
  await expect(page.getByText('Category row added.')).toBeVisible();
  await page.screenshot({ path: path.join(screenshotsDir, 'categories-desktop.png'), fullPage: true });

  await page.goto(appUrl('/transactions'));
  await expect(page.getByRole('heading', { name: 'TRANSACTIONS' })).toBeVisible();
  await page.getByLabel('Quick Entry Amount').fill('12500');
  await page.getByLabel('Quick Entry Merchant').fill('Coffee');
  await page.getByLabel('Quick Entry Category').selectOption({ label: 'Food' });
  await page.getByRole('button', { name: 'Save Quick Entry' }).click();
  await expect(page.getByText('Coffee')).toBeVisible();
  await page.screenshot({ path: path.join(screenshotsDir, 'transactions-desktop.png'), fullPage: true });

  await page.goto(appUrl('/reports'));
  await expect(page.getByRole('heading', { name: 'Trends & Balance' })).toBeVisible();
  await expect(page.getByText('Food')).toBeVisible();
  await expect(page.getByText('12,500 KRW').first()).toBeVisible();
  await page.screenshot({ path: path.join(screenshotsDir, 'reports-desktop.png'), fullPage: true });

  await page.goto(appUrl('/imports'));
  await expect(page.getByRole('heading', { name: 'CSV Import' })).toBeVisible();
  await expect(page.getByText('Three steps: load file, map columns, review then import atomically.')).toBeVisible();
  await expect(page.getByText('Load CSV')).toBeVisible();
  await page.screenshot({ path: path.join(screenshotsDir, 'imports-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(appUrl('/dashboard'));
  await expect(page.getByRole('heading', { name: 'Control Center' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'More' })).toBeVisible();
  await page.screenshot({ path: path.join(screenshotsDir, 'dashboard-mobile.png'), fullPage: true });
});
