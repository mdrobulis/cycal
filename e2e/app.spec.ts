import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { COPY, ltCount } from '../src/lib/strings';
import { SYMPTOMS } from '../src/lib/vocab';

const SYMPTOM = SYMPTOMS[0]!;

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

test('pirmas paleidimas: pažymi mėnesines, prideda simptomą ir išsaugo', async ({ page }) => {
  const errors = collectErrors(page);
  const cell = page.locator(`.cal-day[data-value="${currentDayKey()}"]`);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: COPY.dashboard.emptyTitle })).toBeVisible();
  await page.getByRole('button', { name: COPY.app.markPeriod }).click();
  await expect(page.getByRole('button', { name: COPY.period.still })).toBeVisible();
  await expect(page.getByText(COPY.period.day(1), { exact: true })).toBeVisible();
  await expect(page.locator('.cal-summary')).toContainText(COPY.calendar.summary.period);

  await page.reload();
  await expect(page.getByRole('button', { name: COPY.period.still })).toBeVisible();

  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: COPY.sheet.symptom, exact: true }).click();
  await page.getByRole('button', { name: SYMPTOM, exact: true }).click();
  await expect(page.locator('.event-label').filter({ hasText: SYMPTOM })).toBeVisible();

  await page.getByRole('button', { name: COPY.sheet.deleteAria(SYMPTOM) }).click();
  await expect(page.getByText(COPY.sheet.undoMessage)).toBeVisible();
  await page.getByRole('button', { name: COPY.common.undo, exact: true }).click();
  await expect(page.locator('.event-label').filter({ hasText: SYMPTOM })).toBeVisible();

  await page.getByRole('button', { name: COPY.common.done }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await cell.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: COPY.common.done }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.reload();
  await expect(cell.locator('.dot')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('turi griežtą CSP ir neįkelia nieko iš išorės', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: COPY.dashboard.emptyTitle })).toBeVisible();
  await page.waitForTimeout(400);
  expect(external).toEqual([]);
});

test('veikia neprisijungus po pirmo apsilankymo', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 10_000,
  });
  await expect(page.getByRole('heading', { name: COPY.dashboard.emptyTitle })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: COPY.dashboard.emptyTitle })).toBeVisible();
  await context.setOffline(false);
});

test('prognozių režimą galima pristabdyti, ir tai išlieka po perkrovimo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: COPY.common.settings }).click();
  await page.getByRole('button', { name: COPY.settings.modes.paused.label, exact: true }).click();
  await page.getByRole('button', { name: COPY.common.back, exact: true }).click();
  await expect(page.getByText(COPY.dashboard.status.paused, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(COPY.dashboard.status.paused, { exact: true })).toBeVisible();
});

test('eksportuoja prognozes į .ics failą', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: COPY.app.markPeriod }).click();
  await page.getByRole('button', { name: COPY.common.settings }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: COPY.settings.ics }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cycal-predictions-\d{4}-\d{2}-\d{2}\.ics$/);

  const path = await download.path();
  expect(path).toBeTruthy();
  const text = await readFile(path!, 'utf8');
  expect(text).toContain('BEGIN:VCALENDAR');
  expect(text).toContain(COPY.ics.period);
  expect(text).not.toContain('undefined');
});

test('„Dar kraujuoji“ palieka mėnesines atviras, „Baigėsi“ uždaro', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: COPY.app.markPeriod }).click();
  await page.getByRole('button', { name: COPY.period.still }).click();
  await expect(page.getByRole('button', { name: COPY.period.still })).toBeVisible();

  await page.getByRole('button', { name: COPY.period.ended }).click();
  await expect(page.getByRole('button', { name: COPY.app.markPeriod })).toBeVisible();
  await expect(page.getByText('1 d.', { exact: true })).toBeVisible();
});

test('dienos kortelę galima atidaryti klaviatūra ir uždaryti Escape', async ({ page }) => {
  await page.goto('/');
  const cell = page.locator(`.cal-day[data-value="${currentDayKey()}"]`);
  await cell.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('leidžia įrašyti praeityje ir neleidžia mėnesinių ateityje', async ({ page }) => {
  await page.goto('/');
  const year = page.getByRole('combobox', { name: COPY.calendar.year });
  const month = page.getByRole('combobox', { name: COPY.calendar.month });

  await year.selectOption({ label: '2024' });
  await month.selectOption({ index: 9 });
  await page.locator('.cal-day[data-value="2024-10-15"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: COPY.period.started }).click();
  await page.getByRole('button', { name: COPY.common.done }).click();

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
        request.onsuccess = () =>
          resolve(request.result as Array<{ date: string; kind: string }>);
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
  await month.selectOption({ index: 0 });
  await page.locator('.cal-day[data-value="2027-01-15"]').click();
  await expect(page.getByText(COPY.sheet.futureNote)).toBeVisible();
});

test('eksportuoja, ištrina ir atkuria atsarginę kopiją', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: COPY.app.markPeriod }).click();
  await page.getByRole('button', { name: COPY.common.settings }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: COPY.settings.export }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();

  await page.getByRole('button', { name: COPY.settings.erase }).click();
  const confirm = page.getByRole('dialog', { name: COPY.settings.eraseTitle });
  await confirm.getByRole('button', { name: COPY.settings.eraseConfirm }).click();
  await expect(page.getByText(COPY.settings.statuses.erased)).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(path!);
  await expect(page.getByText(/Kopijoje: 1 įrašas/)).toBeVisible();
  await page.getByRole('button', { name: COPY.settings.merge, exact: true }).click();
  await expect(
    page.getByText(COPY.settings.statuses.merged(ltCount(1, 'įrašas', 'įrašai', 'įrašų'))),
  ).toBeVisible();

  await page.getByRole('button', { name: COPY.common.back, exact: true }).click();
  await expect(page.getByRole('button', { name: COPY.period.still })).toBeVisible();
});
