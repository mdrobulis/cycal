# Cycal

A private, offline menstrual-cycle tracker. One person, one phone, no account, no server. All data stays in the browser's IndexedDB on the device. The interface is in Lithuanian.

**Live:** [https://mdrobulis.github.io/cycal/](https://mdrobulis.github.io/cycal/)

<p align="center">
  <a href="https://mdrobulis.github.io/cycal/">
    <img src="qr/cycal-install.png" alt="Scan to open Cycal" width="260" />
  </a>
</p>

Built from [PROPOSAL.md](PROPOSAL.md); the decisions and build report live in [PLAN.md](PLAN.md).

## What it does

- **Tabs:** `Šiandien` and `Kalendorius` switch in one tap; the tab bar stays reachable while scrolling.
- **Today:** a countdown board. Cycle day and phase are compact context; four tiles show the days left to the next period, fertile window, ovulation and PMS as the large numbers, with dates as small muted notes. Last period is a small footer. No prose status lines.
- **Period logging:** `Mēnesinės` opens a draft range picker on the Calendar. Tap a start and end — or drag across days — and the selected band shows exactly those dates; `Išsaugoti` writes that range, `Be pabaigos` saves an open start, and `Atšaukti` discards it. Tap a day to open its records. Change an existing period through `Keisti intervalą`; the end can be moved by tapping or dragging a new day. Direct dragging on the grid remains a shortcut. An open start is never painted through today; a start older than 10 days is incomplete, shows only confirmed days, and must be given an end. Bleed levels remain optional per day via the single `Lengvas` / `Vidutinis` / `Stiprus` control. The active card shows today's level, `Keisti`, and `Baigėsi`.
- **Calendar:** hotel-style range bands: dark start/end caps with a continuous tinted span. The draft picker and saved periods use the same visual grammar. Direct drag and edge grips remain; taps open the inline record panel **below** the calendar, never a modal. Dashed predicted days, fertile tint with a dotted underline, ovulation ring, and small event-type icons (symptom, mood, flow, intimacy, note, custom) with a compact legend. Month/year selects and previous/next/today controls sit in the calendar header; keyboard navigation works.
- **Day panel:** the single bleeding-intensity control, symptoms (with mild/moderate/severe), mood, intimacy (protected or unprotected), notes and custom labels, all with delete + undo. Notes and custom entries can be edited in place on past days.
- **History editor:** add completed past periods with start/end dates, edit a cycle's dates, or delete it. Non-period records on those days are preserved; predictions and cycle stats update immediately. Entry is offered from the empty Today screen and Settings → Ciklų istorija.
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
pnpm test         # Vitest: dates, Lithuanian plural, periods/history ranges, phase countdowns, backup, intimacy labels, ICS
```

The browser suite needs Chromium. It is kept inside the workspace so it does not touch global caches:

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers" pnpm exec playwright install chromium
PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers" pnpm exec playwright test
```

The twenty-six flows cover first run and persistence, countdown tiles, tabs and tab-state preservation, the single bleeding-intensity control, active-day edge case, the draft range picker (11–13 exact), end movement, open starts, direct create, adjacent-month and touch drags, start/end edge edits, stale start handling, flow trimming, undo, future refusal, inline day panel, event icons/legend, note editing, intimacy protection, keyboard operation, backdating, pause mode, history add/edit/delete, ICS download, export → erase → import, strict CSP and offline reload. All selectors use the same Lithuanian copy as the app.

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
├─ App.svelte               shell, tabs, views, fixed action bar, inline day panel
├─ app.css                  light/dark tokens, tabs, calendar, panel, legend
├─ lib/
│  ├─ date.ts               DayKey arithmetic and formatting
│  ├─ periods.ts            blocks, confirmations, active period
│  ├─ cycle.ts              median prediction, ranges, modes, history, projection
│  ├─ cycle-view.ts         dashboard phase and phase countdowns
│  ├─ icon-names.ts         line-icon names and event-kind mapping
│  ├─ db.ts                 IndexedDB via idb
│  ├─ store.svelte.ts       runes store, write-through persistence, undo
│  ├─ backup.ts             JSON validation, merge, download
│  └─ ics.ts                all-day calendar export
└─ components/              Dashboard, MonthCalendar, DayPanel, CycleHistory, Settings, …
```

The canonical date is a `YYYY-MM-DD` string everywhere except inside `MonthCalendar`, where `@internationalized/date` converts to and from `CalendarDate` for Bits UI's headless calendar.

## Verification snapshot

- 95 unit tests in 8 files and 26 Playwright flows pass; `svelte-check` is clean.
- Production build: **65.8 KB gzip JS**, 5.0 KB gzip CSS, 15 precached files (≈235 KB).
- 390 px and 320 px: no horizontal overflow; the 2×2 countdown grid, hotel-style range bands, day cells 46×46/40×40 and all tabs/controls are finger-sized. The picker, full month and day panel fit above the fixed action area.
- All key text/background pairs pass 4.5:1 in both palettes; control borders are at least 3.16:1.
- Screenshots: [`screenshots/`](screenshots/).

**Not verified:** a real iOS install and storage-eviction behaviour, real screen-reader output, and importing the `.ics` file into Apple/Google Calendar. Those are untested, not claimed.

## Known constraints

- Mobile-only by design: on a desktop it renders as a centred phone-width column.
- TypeScript is pinned to 6.0.3 because this `svelte-check` release does not support TypeScript 7.
- The JS bundle is about 16 KB gzip over the original 50 KB target.
- The UI is Lithuanian only; there is no language switch.
- No notifications, sync or app lock, by decision.
