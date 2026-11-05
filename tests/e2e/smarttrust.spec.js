const { test, expect } = require('@playwright/test');

test.describe('SmartTrust End-to-End Operational Workflow', () => {

  test('Employee records energy, cleaning, and waste data', async ({ page }) => {
    // 1. Employee Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'employee@smarttrust.demo');
    await page.fill('input[type="password"]', 'Demo@1234');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    // 2. Submit Energy Reading
    await page.goto('/energy-records/new');
    await page.selectOption('select[name="machine_id"]', { label: 'HTST Pasteuriser 01' });
    await page.selectOption('select[name="shift"]', 'MORNING');
    await page.fill('input[name="reading_start_kwh"]', '16000.0');
    await page.fill('input[name="reading_end_kwh"]', '16300.0');
    await page.fill('input[name="runtime_hours"]', '8.0');
    await page.click('button[type="submit"]');
    await expect(page.locator('.toast, .alert-success')).toContainText(/submitted|pending/i);

    // 3. Submit Cleaning Log
    await page.goto('/hygiene-records/new');
    await page.selectOption('select[name="area_id"]', { index: 1 });
    await page.fill('input[name="chemical_used"]', 'Caustic Soda 2%');
    await page.fill('input[name="concentration_percent"]', '2.0');
    await page.fill('input[name="contact_minutes"]', '30');
    await page.click('button[type="submit"]');
    await expect(page.locator('.toast, .alert-success')).toBeVisible();

    // 4. Verify Unauthorized URL Blocking for Employee
    await page.goto('/users');
    // Employee must be redirected or shown 403 Access Denied
    await expect(page.locator('body')).toContainText(/denied|forbidden|unauthorized|dashboard/i);
  });

  test('Manager reviews pending queue, requests correction, approves, and confirms alert', async ({ page }) => {
    // 1. Manager Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'manager@smarttrust.demo');
    await page.fill('input[type="password"]', 'Demo@1234');
    await page.click('button[type="submit"]');

    // 2. Inspect Pending Approvals Queue
    await page.goto('/approvals/pending');
    await expect(page.locator('table, .pending-list')).toBeVisible();

    // 3. Request Correction on Item
    const firstRow = page.locator('tbody tr').first();
    await firstRow.locator('button:has-text("Correction"), button:has-text("Fix")').click();
    await page.fill('textarea[name="comment"]', 'Please verify meter reading photo');
    await page.click('button:has-text("Submit")');

    // 4. Approve another pending record
    const secondRow = page.locator('tbody tr').nth(1);
    await secondRow.locator('button:has-text("Approve")').click();

    // 5. Navigate to Alerts and Confirm Anomaly
    await page.goto('/alerts');
    await page.locator('.alert-card, tbody tr').first().click();
    await page.click('button:has-text("Review Alert")');
    await page.check('input[value="CONFIRMED"]');
    await page.fill('textarea[name="review_comment"]', 'Confirmed by manager after maintenance check');
    await page.click('button:has-text("Save")');
    await expect(page.locator('.badge')).toContainText('CONFIRMED');
  });

});
