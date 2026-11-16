import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { COPY, ltCount } from '../src/lib/strings';
import { SYMPTOMS } from '../src/lib/vocab';

const SYMPTOM = SYMPTOMS[0]!;

function collectErrors(page: Page): string[] {
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

function tab(page: Page, which: 'today' | 'calendar') {
  return page.getByRole('tab', { name: COPY.tabs[which] });
}

async function openCalendar(page: Page): Promise<void> {
  await tab(page, 'calendar').click();
  await expect(page.locator('#calendar-panel')).toBeVisible();
}

async function closePanel(page: Page): Promise<void> {
  await page.locator('.day-panel').getByRole('button', { name: COPY.common.close }).click();
  await expect(page.locator('.day-panel')).toHaveCount(0);
}

test('pirmas paleidimas: mėnesinės, skirtukai ir dienos įrašai išlieka', async ({ page }) => {
  const errors = collectErrors(page);
  const day = currentDayKey();
  const cell = page.locator(`.cal-day[data-value="${day}"]`);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: COPY.dashboard.emptyTitle })).toBeVisible();
  await expect(tab(page, 'today')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#calendar-panel')).toBeHidden();

  await page.getByRole('button', { name: COPY.app.markPeriod }).click();
  await expect(page.getByRole('button', { name: COPY.period.still })).toBeVisible();
  await expect(page.getByText(COPY.period.day(1), { exact: true })).toBeVisible();

  await openCalendar(page);
  await expect(tab(page, 'calendar')).toHaveAttribute('aria-selected', 'true');
  await cell.click();
  await expect(page.locator('.day-panel')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const calendarBox = await page.locator('.calendar').boundingBox();
  const panelBox = await page.locator('.day-panel').boundingBox();
  expect(panelBox!.y).toBeGreaterThanOrEqual(calendarBox!.y + calendarBox!.height - 1);

  await tab(page, 'today').click();
  await expect(page.locator('.day-panel')).toBeHidden();
  await tab(page, 'calendar').click();
  await expect(page.locator('.day-panel')).toBeVisible();

  await page.getByRole('button', { name: COPY.sheet.symptom, exact: true }).click();
  await page.getByRole('button', { name: SYMPTOM, exact: true }).click();
  await expect(page.locator('.event-label').filter({ hasText: SYMPTOM })).toBeVisible();
  await expect(cell.locator('.event-icons svg')).toHaveCount(1);
  await expect(page.locator('.cal-legend')).toContainText(COPY.sheet.symptom);

  await page.getByRole('button', { name: COPY.sheet.deleteAria(SYMPTOM) }).click();
  await expect(page.getByText(COPY.sheet.undoMessage)).toBeVisible();
  await page.getByRole('button', { name: COPY.common.undo, exact: true }).click();
  await expect(page.locator('.event-label').filter({ hasText: SYMPTOM })).toBeVisible();

  await closePanel(page);
  await expect(cell).toBeFocused();
  await cell.click();
  await expect(page.locator('.day-panel')).toBeVisible();
  await closePanel(page);

  await page.reload();
  await expect(tab(page, 'today')).toHaveAttribute('aria-selected', 'true');
  await openCalendar(page);
  await expect(cell.locator('.event-icons svg')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('dienos panelė leidžia redaguoti pastabą, o kalendorius lieka matomas', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await openCalendar(page);
  await page.locator('.cal-day[data-today]').click();

  await page.getByRole('button', { name: COPY.sheet.note, exact: true }).click();
  await page.getByLabel(COPY.sheet.noteLabel).fill('Pirmas tekstas');
  await page.getByRole('button', { name: COPY.sheet.addNote }).click();
  await expect(page.locator('.event-detail')).toHaveText('Pirmas tekstas');

  await page.getByRole('button', { name: COPY.sheet.editAria(COPY.sheet.note) }).click();
  await page.getByRole('textbox', { name: COPY.sheet.noteLabel }).fill('Pataisytas tekstas');
  await page.getByRole('button', { name: COPY.sheet.save }).click();
  await expect(page.locator('.event-detail')).toHaveText('Pataisytas tekstas');

  await expect(page.locator('.calendar')).toBeVisible();
  await expect(page.locator('.day-panel')).toBeVisible();
  await expect(page.locator('.cal-legend')).toContainText(COPY.sheet.note);
  await closePanel(page);
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
  await page.getByRole('button', { name: COPY.app.markPeriod }).click();
  await page.getByRole('button', { name: COPY.period.ended }).click();
  await page.getByRole('button', { name: COPY.common.settings }).click();
  await page.getByRole('button', { name: COPY.settings.modes.paused.label, exact: true }).click();
  await page.getByRole('button', { name: COPY.common.back, exact: true }).click();
  await expect(page.getByText(COPY.dashboard.phase.paused, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(COPY.dashboard.phase.paused, { exact: true })).toBeVisible();
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
  await expect(page.getByRole('button', { name: COPY.period.still })).toHaveCount(0);
});

test('skirtukus galima perjungti klaviatūra, o dienos panelę atidaryti ir uždaryti Escape', async ({
  page,
}) => {
  await page.goto('/');
  await tab(page, 'today').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'calendar')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'calendar')).toBeFocused();

  const cell = page.locator('.cal-day[data-today]');
  await cell.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.day-panel')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.day-panel')).toHaveCount(0);
  await expect(cell).toBeFocused();
});

test('leidžia įrašyti praeityje ir neleidžia mėnesinių ateityje', async ({ page }) => {
  await page.goto('/');
  await openCalendar(page);
  const year = page.getByRole('combobox', { name: COPY.calendar.year });
  const month = page.getByRole('combobox', { name: COPY.calendar.month });

  await year.selectOption({ label: '2024' });
  await month.selectOption({ index: 9 });
  await tab(page, 'today').click();
  await tab(page, 'calendar').click();
  await page.locator('.cal-day[data-value="2024-10-15"]').click();
  await expect(page.locator('.day-panel')).toBeVisible();
  await page.getByRole('button', { name: COPY.period.started }).click();
  await closePanel(page);

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

test('istoriją galima įrašyti, redaguoti ir ištrinti', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: COPY.dashboard.historyCta }).click();

  const addForm = page.locator('.form-card');
  await expect(addForm).toBeVisible();
  await addForm.getByLabel(COPY.history.start).fill('2026-09-01');
  await addForm.getByLabel(COPY.history.end).fill('2026-09-05');
  await addForm.getByRole('button', { name: COPY.history.save }).click();
  await expect(page.getByText(COPY.history.added)).toBeVisible();

  await addForm.getByLabel(COPY.history.start).fill('2026-10-01');
  await addForm.getByLabel(COPY.history.end).fill('2026-10-05');
  await addForm.getByRole('button', { name: COPY.history.save }).click();
  await expect(page.locator('.cycle-row')).toHaveCount(2);
  await expect(page.locator('.summary')).toContainText('1 ciklas');

  const first = page.locator('.cycle-row').first();
  await first.getByRole('button', { name: /Redaguoti/ }).click();
  const edit = page.locator('.edit-form').first();
  await edit.getByLabel(COPY.history.end).fill('2026-09-06');
  await edit.getByRole('button', { name: COPY.history.save }).click();
  await expect(page.getByText(COPY.history.updated)).toBeVisible();
  await expect(page.locator('.cycle-row').first()).toContainText('rugs. 1–6 d.');

  await page.locator('.cycle-row').first().getByRole('button', { name: /Redaguoti/ }).click();
  const badEdit = page.locator('.edit-form').first();
  await badEdit.getByLabel(COPY.history.end).fill('2026-10-02');
  await badEdit.getByRole('button', { name: COPY.history.save }).click();
  await expect(page.locator('.edit-form .form-error')).toContainText(
    /Pabaiga turi būti prieš kitas mėnesines|Persidengia/,
  );
  await badEdit.getByRole('button', { name: COPY.common.cancel }).click();

  const second = page.locator('.cycle-row').last();
  await second.getByRole('button', { name: /Ištrinti/ }).click();
  const confirm = page.getByRole('dialog', { name: COPY.history.deleteTitle });
  await confirm.getByRole('button', { name: COPY.history.deleteConfirm }).click();
  await expect(page.getByText(COPY.history.deleted)).toBeVisible();
  await expect(page.locator('.cycle-row')).toHaveCount(1);
  expect(errors).toEqual([]);
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
