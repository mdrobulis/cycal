import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

function collectErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

function currentDayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

test('first run: mark a period, add a symptom, and persist', async ({ page }) => {
  const errors = collectErrors(page);
  const cell = page.locator(`.cal-day[data-value="${currentDayKey()}"]`);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No cycles yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark period start' }).click();
  await expect(page.getByRole('button', { name: 'Still bleeding' })).toBeVisible();
  await expect(page.getByText('Day 1 of your period')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Still bleeding' })).toBeVisible();

  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Symptom', exact: true }).click();
  await page.getByRole('button', { name: 'Cramps', exact: true }).click();
  await expect(page.locator('.event-label').filter({ hasText: 'Cramps' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete Cramps' }).click();
  await expect(page.getByText('Event deleted')).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.event-label').filter({ hasText: 'Cramps' })).toBeVisible();

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await cell.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.reload();
  await expect(cell.locator('.dot')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('ships a strict CSP and loads nothing external', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4173') external.push(request.url());
  });

  await page.goto('/');
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(csp).toContain("connect-src 'none'");
  expect(csp).toContain("script-src 'self'");
  await expect(page.getByRole('heading', { name: 'No cycles yet' })).toBeVisible();
  await page.waitForTimeout(400);
  expect(external).toEqual([]);
});

test('reloads offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 10_000,
  });
  await expect(page.getByRole('heading', { name: 'No cycles yet' })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No cycles yet' })).toBeVisible();
  await context.setOffline(false);
});

test('prediction mode can be paused and survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Paused', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText('Predictions paused')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Predictions paused')).toBeVisible();
});

test('exports predictions as an ics file', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mark period start' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Add predictions to calendar (.ics)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cycal-predictions-\d{4}-\d{2}-\d{2}\.ics$/);

  const path = await download.path();
  expect(path).toBeTruthy();
  const text = await readFile(path!, 'utf8');
  expect(text).toContain('BEGIN:VCALENDAR');
  expect(text).toContain('Period (estimate)');
  expect(text).not.toContain('undefined');
});

test('still bleeding keeps the period open and ended closes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mark period start' }).click();
  await page.getByRole('button', { name: 'Still bleeding' }).click();
  await expect(page.getByRole('button', { name: 'Still bleeding' })).toBeVisible();

  await page.getByRole('button', { name: 'Ended' }).click();
  await expect(page.getByRole('button', { name: 'Mark period start' })).toBeVisible();
  await expect(page.getByText('1 day', { exact: true })).toBeVisible();
});

test('opens the day sheet from the keyboard and closes with Escape', async ({ page }) => {
  await page.goto('/');
  const cell = page.locator(`.cal-day[data-value="${currentDayKey()}"]`);
  await cell.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('backdates a period start and refuses a future one', async ({ page }) => {
  await page.goto('/');
  const year = page.getByRole('combobox', { name: 'Year' });
  const month = page.getByRole('combobox', { name: 'Month' });

  await year.selectOption({ label: '2024' });
  await month.selectOption({ label: 'October' });
  await page.locator('.cal-day[data-value="2024-10-15"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Period started' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cycal');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const events = await new Promise<Array<{ date: string; kind: string }>>(
      (resolve, reject) => {
        const transaction = db.transaction('events', 'readonly');
        const request = transaction.objectStore('events').getAll();
        request.onsuccess = () => resolve(request.result as Array<{ date: string; kind: string }>);
        request.onerror = () => reject(request.error);
      },
    );
    db.close();
    return events;
  });
  expect(
    stored.some((event) => event.date === '2024-10-15' && event.kind === 'period-start'),
  ).toBe(true);

  await year.selectOption({ label: '2027' });
  await month.selectOption({ label: 'January' });
  await page.locator('.cal-day[data-value="2027-01-15"]').click();
  await expect(
    page.getByText("Period events can't be logged in the future."),
  ).toBeVisible();
});

test('exports, erases and restores a backup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mark period start' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();

  await page.getByRole('button', { name: 'Erase all data' }).click();
  const confirm = page.getByRole('dialog', { name: 'Erase everything?' });
  await confirm.getByRole('button', { name: 'Erase everything' }).click();
  await expect(page.getByText('All data erased.')).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(path!);
  await expect(page.getByText(/This backup has 1 event,/)).toBeVisible();
  await page.getByRole('button', { name: 'Merge', exact: true }).click();
  await expect(page.getByText('Merged 1 event.')).toBeVisible();

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Still bleeding' })).toBeVisible();
});
