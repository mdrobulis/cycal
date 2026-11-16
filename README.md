# Cycal

A private, offline menstrual-cycle tracker. One person, one phone, no account, no server. All data stays in the browser's IndexedDB on the device.

**Live:** [https://mdrobulis.github.io/cycal/](https://mdrobulis.github.io/cycal/)

<p align="center">
  <a href="https://mdrobulis.github.io/cycal/">
    <img src="qr/cycal-install.png" alt="Scan to open Cycal" width="260" />
  </a>
</p>

Built from [PROPOSAL.md](PROPOSAL.md); the decisions and build report live in [PLAN.md](PLAN.md).

## What it does

- **Dashboard:** cycle day, next period, fertile window, ovulation, PMS window, last period.
- **Period logging:** mark a start, confirm "still bleeding" on later days, end it when it stops. A period can be entered on any past day.
- **Calendar:** recorded period days, predicted period days (dashed), fertile window, ovulation and logged events. Month and year can be jumped directly; keyboard navigation works.
- **Day sheet:** symptoms (with mild/moderate/severe), mood, flow, intimacy, notes and custom labels, all with delete + undo.
- **Predictions:** median of recent cycles, a 28-day default until two cycles exist, ranges when cycles vary, and Auto / Irregular / Paused modes.
- **Data:** cycle history, JSON backup and restore, `.ics` prediction export, erase-all, and a backup nudge.
- **Offline PWA:** installable, dark mode follows the system, no network access at runtime.

It deliberately does **not** do notifications, sync, an app lock, wearables, accounts, medical advice, or contraception claims.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # production build in dist/
pnpm preview      # serve dist/ at http://localhost:4173
```

Requires Node 22+ and pnpm.

## Test it

```bash
pnpm check        # svelte-check: 0 errors, 0 warnings
pnpm test         # Vitest: date math, periods, cycle prediction, backup, ICS
```

The browser suite needs Chromium. It is kept inside the workspace so it does not touch global caches:

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers" pnpm exec playwright install chromium
PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers" pnpm exec playwright test
```

The nine flows cover first run and persistence, undo, still-bleeding/ended, keyboard operation, backdating and future refusal, pause mode, ICS download, export → erase → import, strict CSP and offline reload.

## Install as a PWA

The repo includes [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): a push to `main` builds with `VITE_BASE=/cycal/` and deploys `dist/` to GitHub Pages. The live URL is [https://mdrobulis.github.io/cycal/](https://mdrobulis.github.io/cycal/); the QR above opens it.

To test the Pages build locally, build with the subpath and serve `dist/` under `/cycal/`:

```bash
VITE_BASE=/cycal/ pnpm build
```

On iOS open the link in **Safari**, tap Share → **Add to Home Screen**, then Add. On Android open it in Chrome and choose **Install app** (or Add to Home screen). Open it once while online so the service worker can cache the app; after that it works offline. Notifications are not implemented: use the `.ics` export to put predicted dates in the phone's calendar.

## Privacy model

- **No account, no sync, no analytics, no third-party assets.** A strict CSP makes the page unable to send data anywhere; the shipped app makes zero cross-origin requests.
- **The data is not encrypted by the app.** Protection at rest is the phone passcode and disk encryption. JSON backups and `.ics` files are plaintext — the UI says so.
- **Export before clearing browser data.** iOS can evict site data for unused sites; the backup nudge appears after 10 events or 60 days.

## Structure

```
src/
├─ App.svelte               shell, views, fixed action bar, day sheet
├─ app.css                  light/dark tokens, base, calendar, sheet
├─ lib/
│  ├─ date.ts               DayKey arithmetic and formatting
│  ├─ periods.ts            blocks, confirmations, active period
│  ├─ cycle.ts              median prediction, ranges, modes, history, projection
│  ├─ db.ts                 IndexedDB via idb
│  ├─ store.svelte.ts       runes store, write-through persistence, undo
│  ├─ backup.ts             JSON validation, merge, download
│  └─ ics.ts                all-day calendar export
└─ components/              Dashboard, MonthCalendar, DaySheet, Settings, …
```

The canonical date is a `YYYY-MM-DD` string everywhere except inside `MonthCalendar`, where `@internationalized/date` converts to and from `CalendarDate` for Bits UI's headless calendar.

## Verification snapshot

- 55 unit tests and 9 Playwright flows pass; `svelte-check` is clean.
- Production build: **54.7 KB gzip JS**, 3.7 KB gzip CSS, 15 precached files (≈190 KB).
- 390 px and 320 px: no horizontal overflow; day cells 46×46 and 40×40; no visible control below 44 px.
- All key text/background pairs pass 4.5:1 in both palettes.
- Screenshots: [`screenshots/`](screenshots/).

**Not verified:** a real iOS install and storage-eviction behaviour, real screen-reader output, and importing the `.ics` file into Apple/Google Calendar. Those are untested, not claimed.

## Known constraints

- Mobile-only by design: on a desktop it renders as a centred phone-width column.
- TypeScript is pinned to 6.0.3 because this `svelte-check` release does not support TypeScript 7.
- The JS bundle is about 5 KB gzip over the original 50 KB target.
- No notifications, sync or app lock, by decision.
