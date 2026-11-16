import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173';
const OUT = 'screenshots';

function fmt(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function offsetKey(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return fmt(date);
}

function addDays(key, days) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return fmt(date);
}

let sequence = 0;
function event(kind, date, extra = {}) {
  sequence += 1;
  return {
    id: `seed-${sequence}`,
    date,
    kind,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

const starts = [offsetKey(-70), offsetKey(-42), offsetKey(-14)];
const events = [];
for (const start of starts) {
  events.push(event('period-start', start));
  events.push(event('period-end', addDays(start, 4)));
}
events.push(event('flow', addDays(starts[2], 1), { value: 'medium' }));
events.push(event('symptom', offsetKey(-2), { label: 'Pilvo skausmai', severity: 2 }));
events.push(event('mood', offsetKey(-1), { value: 4 }));
events.push(event('note', offsetKey(-6), { note: 'Ilgas pasivaikščiojimas, jaučiausi gerai' }));
events.push(event('intimacy', offsetKey(-3)));

async function seed(page) {
  await page.goto(BASE);
  await page.evaluate(async (list) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('cycal');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction('events', 'readwrite');
    for (const item of list) transaction.objectStore('events').put(item);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, events);
  await page.reload();
  await page.locator('.cal-day').first().waitFor();
}

async function metrics(page) {
  return page.evaluate(() => {
    const day = document.querySelector('.cal-day');
    const box = day ? day.getBoundingClientRect() : null;
    const buttons = [...document.querySelectorAll('button')];
    const small = buttons
      .map((button) => button.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && (rect.width < 44 || rect.height < 44)).length;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      dayCell: box ? { width: Math.round(box.width), height: Math.round(box.height) } : null,
      visibleButtonsUnder44: small,
      theme: getComputedStyle(document.documentElement).colorScheme,
    };
  });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const report = {};

const light = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  colorScheme: 'light',
});
const page = await light.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await seed(page);
await page.screenshot({ path: `${OUT}/home-light-390.png`, fullPage: true });
report.home390 = await metrics(page);

await page.locator(`.cal-day[data-value="${offsetKey(-2)}"]`).click();
await page.getByRole('dialog').waitFor();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/day-sheet-390.png` });
await page.getByRole('button', { name: 'Gerai' }).click();

await page.getByRole('button', { name: 'Nustatymai' }).click();
await page.screenshot({ path: `${OUT}/settings-390.png`, fullPage: true });
await page.getByRole('button', { name: 'Ciklų istorija' }).click();
await page.screenshot({ path: `${OUT}/history-390.png`, fullPage: true });
report.errors = errors;
await light.close();

const dark = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  colorScheme: 'dark',
});
const darkPage = await dark.newPage();
await seed(darkPage);
await darkPage.screenshot({ path: `${OUT}/home-dark-390.png`, fullPage: true });
report.homeDark390 = await metrics(darkPage);
await dark.close();

const narrow = await browser.newContext({
  viewport: { width: 320, height: 700 },
  hasTouch: true,
  colorScheme: 'light',
});
const narrowPage = await narrow.newPage();
await seed(narrowPage);
await narrowPage.screenshot({ path: `${OUT}/home-light-320.png`, fullPage: true });
report.home320 = await metrics(narrowPage);
await narrow.close();

await browser.close();
await writeFile(`${OUT}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
