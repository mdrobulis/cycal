import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { formatRange } from '../src/lib/date';
import { COPY, ltCount } from '../src/lib/strings';
import { FLOWS, PROTECTIONS, SYMPTOMS } from '../src/lib/vocab';

const SYMPTOM = SYMPTOMS[0]!;
const MEDIUM = FLOWS.find((flow) => flow.value === 'medium')!.label;
const HEAVY = FLOWS.find((flow) => flow.value === 'heavy')!.label;
const LIGHT = FLOWS.find((flow) => flow.value === 'light')!.label;
const PROTECTED = PROTECTIONS.find((entry) => entry.value === 'protected')!.label;
const UNPROTECTED = PROTECTIONS.find((entry) => entry.value === 'unprotected')!.label;
const OLD_STILL = 'Dar kraujuoji';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

function currentDayKey(): string {
  return offsetDayKey(0);
}

function offsetDayKey(days: number): string {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  now.setDate(now.getDate() + days);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function tab(page: Page, which: 'today' | 'calendar') {
  return page.getByRole('tab', { name: COPY.tabs[which] });
}

async function openPeriodToday(page: Page): Promise<void> {
  await openCalendar(page);
  await page.locator('.cal-day[data-today]').click();
  await page.locator('.day-panel').waitFor();
  await page
    .locator('.day-panel')
    .getByRole('button', { name: COPY.period.started })
    .click();
  await closePanel(page);
  await tab(page, 'today').click();
}

async function dragDays(
  page: Page,
  start: string,
  end: string,
  expectStatus = true,
): Promise<void> {
  const startCell = page.locator(`.cal-day[data-value="${start}"]`);
  const endCell = page.locator(`.cal-day[data-value="${end}"]`);
  await startCell.scrollIntoViewIfNeeded();
  const from = await startCell.boundingBox();
  const to = await endCell.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 8 });
  await page.mouse.up();
  if (expectStatus) await expect(page.locator('.drag-status')).toBeVisible();
}

async function openCalendar(page: Page): Promise<void> {
  await tab(page, 'calendar').click();
  await expect(page.locator('#calendar-panel')).toBeVisible();
}

async function closePanel(page: Page): Promise<void> {
  await page.locator('.day-panel').getByRole('button', { name: COPY.common.close }).click();
  await expect(page.locator('.day-panel')).toHaveCount(0);
}

async function storedEvents(
  page: Page,
): Promise<Array<{ date: string; kind: string; value?: string }>> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cycal');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const events = await new Promise<Array<{ date: string; kind: string; value?: string }>>(
      (resolve, reject) => {
        const transaction = db.transaction('events', 'readonly');
        const request = transaction.objectStore('events').getAll();
        request.onsuccess = () =>
          resolve(request.result as Array<{ date: string; kind: string; value?: string }>);
        request.onerror = () => reject(request.error);
      },
    );
    db.close();
    return events;
  });
}

test('pirmas paleidimas: vienas kraujavimo valdiklis ir dienos įrašai išlieka', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const day = currentDayKey();
  const cell = page.locator(`.cal-day[data-value="${day}"]`);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: COPY.dashboard.emptyTitle })).toBeVisible();
  await expect(tab(page, 'today')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#calendar-panel')).toBeHidden();

  await openPeriodToday(page);
  await expect(page.getByText(COPY.period.day(1), { exact: true })).toBeVisible();
  await expect(page.locator('.count')).toHaveCount(4);
  await expect(page.locator('.count-value').first()).toContainText('28');
  await expect(page.locator('.count-date').first()).toBeVisible();
  await expect(page.getByRole('button', { name: OLD_STILL })).toHaveCount(0);
  await expect(page.getByText(COPY.bleeding.unmarked, { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: COPY.bleeding.aria })).toHaveCount(0);

  await page.getByRole('button', { name: COPY.bleeding.change }).click();
  await expect(tab(page, 'calendar')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.day-panel')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('group', { name: COPY.bleeding.aria })).toHaveCount(1);

  await expect
    .poll(async () => {
      const calendarBox = await page.locator('.calendar').boundingBox();
      const panelBox = await page.locator('.day-panel').boundingBox();
      return panelBox!.y >= calendarBox!.y + calendarBox!.height - 1;
    })
    .toBe(true);

  const bleeding = page.getByRole('group', { name: COPY.bleeding.aria });
  await bleeding.getByRole('button', { name: MEDIUM, exact: true }).click();
  await expect(
    bleeding.getByRole('button', { name: MEDIUM, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.event-detail')).toHaveText(MEDIUM);
  await expect(page.locator('.active-period')).toContainText(MEDIUM);
  await expect(page.getByRole('button', { name: COPY.sheet.flow, exact: true })).toHaveCount(0);

  await bleeding.getByRole('button', { name: HEAVY, exact: true }).click();
  await expect(
    bleeding.getByRole('button', { name: HEAVY, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    bleeding.getByRole('button', { name: MEDIUM, exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.event-detail')).toHaveText(HEAVY);
  await expect(page.locator('.event-label').filter({ hasText: COPY.sheet.flow })).toHaveCount(1);
  await bleeding.getByRole('button', { name: MEDIUM, exact: true }).click();
  await expect(page.locator('.event-detail')).toHaveText(MEDIUM);

  await tab(page, 'today').click();
  await expect(page.locator('.day-panel')).toBeHidden();
  await tab(page, 'calendar').click();
  await expect(page.locator('.day-panel')).toBeVisible();

  await page.getByRole('button', { name: COPY.sheet.symptom, exact: true }).click();
  await page.getByRole('button', { name: SYMPTOM, exact: true }).click();
  await expect(page.locator('.event-label').filter({ hasText: SYMPTOM })).toBeVisible();
  await expect(cell.locator('.event-icons svg')).toHaveCount(2);
  await expect(page.locator('.cal-legend')).toContainText(COPY.sheet.symptom);
  await expect(page.locator('.cal-legend')).toContainText(COPY.sheet.flow);

  await page.getByRole('button', { name: COPY.sheet.deleteAria(SYMPTOM) }).click();
  await expect(page.getByText(COPY.sheet.undoMessage)).toBeVisible();
  await page.getByRole('button', { name: COPY.common.undo, exact: true }).click();
  await expect(page.locator('.event-label').filter({ hasText: SYMPTOM })).toBeVisible();

  await closePanel(page);
  await expect(cell).toBeFocused();
  await expect(page.getByRole('group', { name: COPY.bleeding.aria })).toHaveCount(0);
  await cell.click();
  await expect(page.locator('.day-panel')).toBeVisible();
  await closePanel(page);

  await page.reload();
  await expect(tab(page, 'today')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.active-period')).toContainText(MEDIUM);
  await openCalendar(page);
  await expect(cell.locator('.event-icons svg')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('aktyvią dieną be patvirtinimo galima pažymėti intensyvumu', async ({ page }) => {
  const yesterday = offsetDayKey(-1);
  const today = currentDayKey();
  await page.goto('/');
  await page.evaluate(async (date) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cycal');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction('events', 'readwrite');
    transaction.objectStore('events').put({
      id: 'seed-open-period',
      date,
      kind: 'period-start',
      createdAt: new Date().toISOString(),
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, yesterday);
  await page.reload();

  await expect(page.locator('.active-period')).toBeVisible();
  await expect(page.getByText(COPY.bleeding.unmarked, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: COPY.bleeding.change }).click();
  const bleeding = page.getByRole('group', { name: COPY.bleeding.aria });
  await bleeding.getByRole('button', { name: MEDIUM, exact: true }).click();
  await expect(
    bleeding.getByRole('button', { name: MEDIUM, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cycal');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const events = await new Promise<Array<{ date: string; kind: string; value?: string }>>(
      (resolve, reject) => {
        const transaction = db.transaction('events', 'readonly');
        const request = transaction.objectStore('events').getAll();
        request.onsuccess = () =>
          resolve(request.result as Array<{ date: string; kind: string; value?: string }>);
        request.onerror = () => reject(request.error);
      },
    );
    db.close();
    return events;
  });

  expect(
    stored.some((event) => event.date === today && event.kind === 'period-day'),
  ).toBe(true);
  expect(
    stored.some(
      (event) =>
        event.date === today && event.kind === 'flow' && event.value === 'medium',
    ),
  ).toBe(true);
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

test('intymumas turi apsaugos detalę', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await openCalendar(page);
  await page.locator('.cal-day[data-today]').click();

  await page.getByRole('button', { name: COPY.sheet.intimacy, exact: true }).click();
  const protection = page.getByRole('group', { name: COPY.sheet.protection });
  await expect(protection).toBeVisible();
  await protection.getByRole('button', { name: PROTECTED, exact: true }).click();
  await expect(page.locator('.event-detail')).toHaveText(PROTECTED);
  await expect(
    page.locator('.event-label').filter({ hasText: COPY.sheet.intimacy }),
  ).toHaveCount(1);

  await page.getByRole('button', { name: COPY.sheet.intimacy, exact: true }).click();
  await expect(
    protection.getByRole('button', { name: PROTECTED, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await protection.getByRole('button', { name: UNPROTECTED, exact: true }).click();
  await expect(page.locator('.event-detail')).toHaveText(UNPROTECTED);
  await expect(
    page.locator('.event-label').filter({ hasText: COPY.sheet.intimacy }),
  ).toHaveCount(1);

  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cycal');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const events = await new Promise<Array<{ kind: string; value?: string }>>(
      (resolve, reject) => {
        const transaction = db.transaction('events', 'readonly');
        const request = transaction.objectStore('events').getAll();
        request.onsuccess = () =>
          resolve(request.result as Array<{ kind: string; value?: string }>);
        request.onerror = () => reject(request.error);
      },
    );
    db.close();
    return events;
  });
  expect(
    stored.some((event) => event.kind === 'intimacy' && event.value === 'unprotected'),
  ).toBe(true);

  await page.reload();
  await openCalendar(page);
  await page.locator('.cal-day[data-today]').click();
  await expect(page.locator('.event-detail')).toHaveText(UNPROTECTED);
  expect(errors).toEqual([]);
});

test('intervalų rinkiklis 11–13 išsaugo tiksliai ir leidžia perkelti pabaigą', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: COPY.app.periodsAria }).click();
  await expect(page.locator('.picker-bar')).toBeVisible();
  const start = offsetDayKey(-5);
  const end = offsetDayKey(-3);
  await page.locator(`.cal-day[data-value="${start}"]`).click();
  await page.locator(`.cal-day[data-value="${end}"]`).click();
  await expect(page.locator('.picker-dates')).toContainText(COPY.calendar.pickerStart);
  await page.getByRole('button', { name: COPY.common.save, exact: true }).click();
  await expect(page.locator('.drag-status')).toContainText(COPY.calendar.created);
  await expect(page.locator('.cal-cell.is-period')).toHaveCount(3);
  let events = await storedEvents(page);
  expect(events.some((event) => event.date === start && event.kind === 'period-start')).toBe(
    true,
  );
  expect(events.some((event) => event.date === end && event.kind === 'period-end')).toBe(true);

  await page.locator(`.cal-day[data-value="${end}"]`).click();
  await page.locator('.day-panel').getByRole('button', { name: COPY.calendar.editInterval }).click();
  await expect(page.locator('.picker-dates')).toContainText('lapkr.');
  const movedEnd = offsetDayKey(-1);
  await page.locator(`.cal-day[data-value="${movedEnd}"]`).click();
  await page.getByRole('button', { name: COPY.common.save, exact: true }).click();
  await expect(page.locator('.drag-status')).toContainText(COPY.calendar.updated);
  events = await storedEvents(page);
  expect(events.some((event) => event.date === movedEnd && event.kind === 'period-end')).toBe(
    true,
  );
  expect(events.some((event) => event.date === end && event.kind === 'period-end')).toBe(false);
});

test('atvirą periodą galima išsaugoti be pabaigos', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: COPY.app.periodsAria }).click();
  const start = offsetDayKey(-4);
  await page.locator(`.cal-day[data-value="${start}"]`).click();
  await page.getByRole('button', { name: COPY.calendar.pickerOpen }).click();
  await expect(page.locator('.active-period')).toBeVisible();
  await expect(page.locator('.cal-cell.is-period')).toHaveCount(1);
});

test('periodas kuriamas braukiant kalendoriuje', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('.actionbar')).toContainText(COPY.app.periods);
  await openCalendar(page);
  await expect(page.locator('.cal-hint')).toHaveText(COPY.calendar.dragHint);

  const start = offsetDayKey(-10);
  const end = offsetDayKey(-6);
  await dragDays(page, start, end);
  await expect(page.locator('.drag-status')).toContainText(COPY.calendar.created);
  await expect(page.locator('.day-panel')).toHaveCount(0);

  const events = await storedEvents(page);
  expect(events.some((event) => event.date === start && event.kind === 'period-start')).toBe(
    true,
  );
  expect(events.some((event) => event.date === end && event.kind === 'period-end')).toBe(true);
  expect(errors).toEqual([]);
});

test('periodą galima braukti ir matomomis gretimo mėnesio dienomis', async ({ page }) => {
  await page.goto('/');
  await openCalendar(page);
  const start = offsetDayKey(-21);
  const end = offsetDayKey(-17);
  await dragDays(page, start, end);
  const events = await storedEvents(page);
  expect(events.some((event) => event.date === start && event.kind === 'period-start')).toBe(
    true,
  );
  expect(events.some((event) => event.date === end && event.kind === 'period-end')).toBe(true);
});

test('periodą galima braukti prisilietimu', async ({ page }) => {
  await page.goto('/');
  await openCalendar(page);
  const start = offsetDayKey(-10);
  const end = offsetDayKey(-6);
  const startCell = page.locator(`.cal-day[data-value="${start}"]`);
  const endCell = page.locator(`.cal-day[data-value="${end}"]`);
  await startCell.scrollIntoViewIfNeeded();
  const from = await startCell.boundingBox();
  const to = await endCell.boundingBox();
  const client = await page.context().newCDPSession(page);
  const point = (x: number, y: number) => ({
    x,
    y,
    radiusX: 1,
    radiusY: 1,
    force: 1,
    id: 1,
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point(from!.x + from!.width / 2, from!.y + from!.height / 2)],
  });
  for (let index = 1; index <= 8; index += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        point(
          from!.x + from!.width / 2 + ((to!.x - from!.x) * index) / 8,
          from!.y + from!.height / 2 + ((to!.y - from!.y) * index) / 8,
        ),
      ],
    });
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.locator('.drag-status')).toContainText(COPY.calendar.created);
  const events = await storedEvents(page);
  expect(events.some((event) => event.date === start && event.kind === 'period-start')).toBe(
    true,
  );
  expect(events.some((event) => event.date === end && event.kind === 'period-end')).toBe(true);
});

test('susiaurinus periodą pašalinamas išorinis kraujavimas', async ({ page }) => {
  await page.goto('/');
  await openCalendar(page);
  const start = offsetDayKey(-10);
  const end = offsetDayKey(-6);
  await dragDays(page, start, end);

  await page.locator(`.cal-day[data-value="${end}"]`).click();
  await page.locator('.day-panel').waitFor();
  await page
    .getByRole('group', { name: COPY.bleeding.aria })
    .getByRole('button', { name: MEDIUM, exact: true })
    .click();
  await closePanel(page);

  await dragDays(page, end, offsetDayKey(-8));
  await expect(page.locator('.drag-status')).toContainText(formatRange(start, offsetDayKey(-8)));
  const events = await storedEvents(page);
  expect(events.some((event) => event.date === end && event.kind === 'flow')).toBe(false);
});

test('periodą galima sukurti ir šiandien', async ({ page }) => {
  await page.goto('/');
  await openCalendar(page);
  const start = offsetDayKey(-2);
  const end = currentDayKey();
  await dragDays(page, start, end);
  const events = await storedEvents(page);
  expect(events.some((event) => event.date === start && event.kind === 'period-start')).toBe(
    true,
  );
  expect(events.some((event) => event.date === end && event.kind === 'period-end')).toBe(true);
  await expect(page.locator('.active-period')).toHaveCount(0);
});

test('periodo pradžią ir pabaigą galima tempti', async ({ page }) => {
  await page.goto('/');
  await openCalendar(page);
  const start = offsetDayKey(-10);
  const end = offsetDayKey(-6);
  await dragDays(page, start, end);

  const newStart = offsetDayKey(-12);
  await dragDays(page, start, newStart);
  await expect(page.locator('.drag-status')).toContainText(COPY.calendar.updated);
  let events = await storedEvents(page);
  expect(
    events.some((event) => event.date === newStart && event.kind === 'period-start'),
  ).toBe(true);
  expect(events.some((event) => event.date === start && event.kind === 'period-start')).toBe(
    false,
  );

  const newEnd = offsetDayKey(-4);
  await dragDays(page, end, newEnd);
  await expect(page.locator('.drag-status')).toContainText(formatRange(newStart, newEnd));
  events = await storedEvents(page);
  expect(events.some((event) => event.date === newEnd && event.kind === 'period-end')).toBe(
    true,
  );
  expect(events.some((event) => event.date === end && event.kind === 'period-end')).toBe(false);
});

test('atvirą periodą galima uždaryti tempus jo galą', async ({ page }) => {
  await page.goto('/');
  await openCalendar(page);
  const start = offsetDayKey(-3);
  await page.locator(`.cal-day[data-value="${start}"]`).click();
  await page.locator('.day-panel').waitFor();
  await page.getByRole('button', { name: COPY.period.started }).click();
  await closePanel(page);
  await expect(page.locator('.active-period')).toBeVisible();

  const end = offsetDayKey(-1);
  await dragDays(page, start, end);
  await expect(page.locator('.active-period')).toHaveCount(0);
  const events = await storedEvents(page);
  expect(events.some((event) => event.date === start && event.kind === 'period-start')).toBe(
    true,
  );
  expect(events.some((event) => event.date === end && event.kind === 'period-end')).toBe(true);
});

test('bakstelėjimas atidaro dieną, o ne kuria periodą', async ({ page }) => {
  await page.goto('/');
  await openCalendar(page);
  const day = offsetDayKey(-8);
  await page.locator(`.cal-day[data-value="${day}"]`).click();
  await expect(page.locator('.day-panel')).toBeVisible();
  expect(await storedEvents(page)).toEqual([]);
  await closePanel(page);
});

test('ateities intervalas parodo klaidą ir nieko neįrašo', async ({ page }) => {
  await page.goto('/');
  await openCalendar(page);
  const start = offsetDayKey(-2);
  const end = offsetDayKey(2);
  await dragDays(page, start, end, false);
  await expect(page.locator('.drag-error')).toContainText(COPY.errors.periodEndFuture);
  expect(await storedEvents(page)).toEqual([]);
});

test('periodo įrašą galima atšaukti', async ({ page }) => {
  await page.goto('/');
  await openCalendar(page);
  await dragDays(page, offsetDayKey(-10), offsetDayKey(-6));
  await page.getByRole('button', { name: COPY.common.undo }).click();
  await expect(page.locator('.drag-status')).toHaveCount(0);
  expect(await storedEvents(page)).toEqual([]);
});

test('senas startas be pabaigos nėra aktyvus ir neapima savaitės', async ({ page }) => {
  const old = offsetDayKey(-21);
  await page.goto('/');
  await page.evaluate(async (date) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cycal');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction('events', 'readwrite');
    transaction.objectStore('events').put({
      id: 'seed-stale-period',
      date,
      kind: 'period-start',
      createdAt: new Date().toISOString(),
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, old);
  await page.reload();
  await openCalendar(page);
  await expect(page.locator('.active-period')).toHaveCount(0);
  await expect(page.locator('.cal-cell.is-period')).toHaveCount(1);
  await expect(page.locator('.cal-cell.is-period-incomplete')).toHaveCount(1);
  await expect(page.locator('.cal-note')).toContainText(COPY.calendar.needsEnd);

  await page.locator(`.cal-day[data-value="${old}"]`).click();
  await expect(page.locator('.day-panel')).toBeVisible();
  await expect(
    page.locator('.day-panel').getByRole('button', {
      name: COPY.period.started,
      exact: true,
    }),
  ).toHaveCount(0);
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
  await openPeriodToday(page);
  await page.getByRole('button', { name: COPY.period.ended, exact: true }).click();
  await page.getByRole('button', { name: COPY.common.settings }).click();
  await page.getByRole('button', { name: COPY.settings.modes.paused.label, exact: true }).click();
  await page.getByRole('button', { name: COPY.common.back, exact: true }).click();
  await expect(page.getByText(COPY.dashboard.phase.paused, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(COPY.dashboard.phase.paused, { exact: true })).toBeVisible();
});

test('eksportuoja prognozes į .ics failą', async ({ page }) => {
  await page.goto('/');
  await openPeriodToday(page);
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

test('intensyvumas pažymi kraujavimą, o „Baigėsi“ uždaro mėnesines', async ({ page }) => {
  await page.goto('/');
  await openPeriodToday(page);
  await expect(page.getByRole('button', { name: OLD_STILL })).toHaveCount(0);
  await page.getByRole('button', { name: COPY.bleeding.change }).click();

  const bleeding = page.getByRole('group', { name: COPY.bleeding.aria });
  await bleeding.getByRole('button', { name: HEAVY, exact: true }).click();
  await expect(
    bleeding.getByRole('button', { name: HEAVY, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.event-detail')).toHaveText(HEAVY);

  await page.getByRole('button', { name: COPY.period.ended, exact: true }).click();
  await expect(page.locator('.actionbar')).toContainText(COPY.app.periods);
  await expect(page.locator('.event-detail')).toHaveText(HEAVY);
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
  await dragDays(page, '2024-10-15', '2024-10-19');

  await page.locator('.cal-day[data-value="2024-10-15"]').click();
  await expect(page.locator('.day-panel')).toBeVisible();
  const bleeding = page.getByRole('group', { name: COPY.bleeding.aria });
  await bleeding.getByRole('button', { name: LIGHT, exact: true }).click();
  await expect(
    bleeding.getByRole('button', { name: LIGHT, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await closePanel(page);

  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cycal');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const events = await new Promise<Array<{ date: string; kind: string; value?: string }>>(
      (resolve, reject) => {
        const transaction = db.transaction('events', 'readonly');
        const request = transaction.objectStore('events').getAll();
        request.onsuccess = () =>
          resolve(request.result as Array<{ date: string; kind: string; value?: string }>);
        request.onerror = () => reject(request.error);
      },
    );
    db.close();
    return events;
  });
  expect(
    stored.some((event) => event.date === '2024-10-15' && event.kind === 'period-start'),
  ).toBe(true);
  expect(
    stored.some((event) => event.date === '2024-10-19' && event.kind === 'period-end'),
  ).toBe(true);
  expect(
    stored.some(
      (event) =>
        event.date === '2024-10-15' && event.kind === 'flow' && event.value === 'light',
    ),
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
  await openPeriodToday(page);
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
  await expect(page.getByRole('button', { name: COPY.bleeding.change })).toBeVisible();
});
