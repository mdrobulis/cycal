# Cycal v1 — implementation plan

Status: v4 · implemented and verified 16 Nov 2026

> **v1.1 UI pass (16 Nov 2026):** the shipped UI is now Lithuanian, the palette and calendar marks were reworked for contrast, and the calendar gained a dated summary of the visible month. The original "English UI" decision and §11 build numbers are historical; see §12.

A local-only **Vite + Svelte 5 SPA PWA** for one person, with the month grid built on **Bits UI Calendar** and styled entirely from our own tokens. No account, no backend, no telemetry.

## Confirmed decisions

- Svelte 5 SPA (no SvelteKit); TypeScript strict.
- One user; **iPhone and Android**; free static host over HTTPS.
- **No app lock** — the phone passcode is the boundary.
- **Mobile-only UI:** designed at 360 and 390 px, works 320–480; one column, no desktop layout; 44 px targets; bottom action bar; bottom sheet.
- **Visual style: quiet utility** — Rams restraint, warmed: paper neutrals, one accent, no decoration, honest states.
- **Non-restrictive entry:** any past date, no minimum, month/year jump; future notes allowed, future period events blocked with copy; no forced sequences; everything editable.
- **Dashboard six values:** cycle day, next period, fertile window, ovulation, PMS window, last period.
- **Period logging is start + daily "still bleeding"**; the end is the last confirmed bleeding day.
- **Event types:** symptom (with severity), mood, flow, intimacy, note, custom label — plus period start/end.
- **No forced onboarding.** Empty dashboard on first launch; history can be added at any time.
- **Also in v1:** `.ics` prediction export, symptom severity, cycle history, irregular/paused prediction modes, manual cycle defaults, dark mode, backup nudge.
- Fertility dates are estimates, clearly labeled, never contraception.
- English UI, light and dark, one accent, calendar under the dashboard.

## 1. Dependencies

| Where | Packages |
|---|---|
| Runtime | `svelte` (^5), `bits-ui`, `@internationalized/date`, `idb` |
| Build / dev (M0) | `vite`, `@sveltejs/vite-plugin-svelte`, `typescript`, `svelte-check`, `vitest`, `jsdom`, `@testing-library/svelte`, `prettier` |
| Added later | `vite-plugin-pwa`, `@vite-pwa/assets-generator` (M7); `@playwright/test` (M8) |
| Deliberately absent | Tailwind, UI kits, icon packages, a date library for app logic, an ICS library (hand-built, ~80 lines) |

`@internationalized/date` is a peer dependency of Bits UI. **It is used only inside `MonthCalendar`** — the canonical date everywhere else is the `DayKey` string.

## 2. File tree

```
src/
├─ main.ts                  mount + manual SW registration
├─ App.svelte               view = 'home' | 'settings' | 'history'
├─ app.css                  tokens (light + dark), reset, base
├─ lib/
│  ├─ types.ts              DayKey, DayEvent, EventKind, Settings, CycleStats
│  ├─ vocab.ts              symptom list, mood scale, flow values, severity labels
│  ├─ date.ts               DayKey parse/add/diff/format  (+ date.test.ts)
│  ├─ cycle.ts              pure stats/prediction/modes   (+ cycle.test.ts)
│  ├─ periods.ts            active period, ranges, confirmation rules (+ test)
│  ├─ ics.ts                prediction calendar export     (+ ics.test.ts)
│  ├─ db.ts                 idb schema, events + meta
│  ├─ store.svelte.ts       $state store, settings, add/update/remove/restore
│  ├─ backup.ts             JSON export/import/validate   (+ backup.test.ts)
│  └─ strings.ts            all user-facing copy
└─ components/
   ├─ Dashboard.svelte      six stats, empty/irregular/paused states
   ├─ ActivePeriodCard.svelte  "Still bleeding?" confirmation
   ├─ MonthCalendar.svelte  Bits UI wrapper + marks
   ├─ DaySheet.svelte       native <dialog> bottom sheet
   ├─ CycleHistory.svelte   last 12 cycles, average, variation
   ├─ BackupNudge.svelte    stale-backup line
   ├─ UndoToast.svelte
   ├─ Settings.svelte
   └─ ConfirmDialog.svelte
```

## 3. Bits UI boundary (do this early — it's the risky part)

Canonical date stays `DayKey` (`"YYYY-MM-DD"`). Inside `MonthCalendar` only:

```ts
const toADT = (k: DayKey) => parseDate(k);        // "2026-11-22" → CalendarDate
const toKey = (d: DateValue) => d.toString();    // CalendarDate → "2026-11-22"
```

Confirmed against the API reference:

- `Calendar.Root` needs `type="single"`; `value` is bindable; `onValueChange` fires for mouse **and** keyboard activation.
- Children snippet gives `{ months, weekdays }`; `month.weeks` is `DateValue[][]`; `Calendar.Cell` takes `{date}` + `month={month.value}`; `Calendar.Day` accepts children — day number and dots are ours.
- Day state attributes: `data-today`, `data-selected`, `data-focused`, `data-outside-month`, `data-value`.
- Props: `weekStartsOn={1}`, `weekdayFormat="short"`, `fixedWeeks`, `locale="en-GB"`, `calendarLabel="Cycle calendar"`, `initialFocus={false}`.

**Selection → sheet flow:** `onValueChange={(v) => v && openSheet(toKey(v))}`. On sheet close, clear `value` so tapping the *same* day again re-opens it. `preventDeselect` stays false; test re-click, Enter, Space, arrow focus.

**Accessibility:** Bits renders each day as `div role="button"` inside a real `<table>` — the library's tested keyboard/ARIA implementation. Keep it, screen-reader check it, and only switch to a native `<button>` via the `child` snippet if that check fails.

**Budget check at M4:** `vite build` + gzip report. ADT is the likely overrun against the 50 KB target; report the real number before deciding.

## 4. Data model and logic

### 4.1 Events and settings

```ts
type EventKind =
  | 'period-start' | 'period-day' | 'period-end'
  | 'symptom' | 'mood' | 'flow' | 'intimacy' | 'note' | 'custom';

type Severity = 1 | 2 | 3; // mild | moderate | severe

type DayEvent = {
  id: string;
  date: DayKey;
  kind: EventKind;
  label?: string;          // symptom name, custom label
  value?: number | string; // mood 1–5; flow 'light' | 'medium' | 'heavy'
  severity?: Severity;     // symptoms only
  note?: string;
  createdAt: string;
};

type PredictionMode = 'auto' | 'irregular' | 'paused';

type Settings = {
  cycleLengthDefault: number;   // 21–45, default 28
  periodLengthDefault: number;  // 2–10, default 5
  predictionMode: PredictionMode;
  lastExportAt?: string;
  backupNudgeDismissedAt?: string;
};
```

Settings live in IndexedDB `meta` and in the store; they are part of the JSON backup.

### 4.2 Period model — start, daily confirmation, explicit end

- `period-start` opens a period.
- **"Still bleeding" adds a `period-day`** for that date and keeps the period open.
- **"Ended" adds a `period-end`** set to the last confirmed `period-day`; with no confirmation, yesterday; if the period began today, today.
- The block is `start…end` when closed, or `start…last period-day` while open. Confirming after a gap fills the block — a period is continuous — and no confirmation means no invented days.
- A period open for more than 10 days keeps its controls, labelled "Period still open — day N". It never silently ends or guesses.
- Starting a new period on a later date closes the previous one at its last confirmed day.
- Deleting the end reopens the period; deleting the start removes the block.

### 4.3 Cycle math

Inputs: events, `Settings`, today.

- Cycle starts = unique `period-start` dates, sorted.
- Cycle lengths = consecutive diffs; **median of the last 6** (even count → mean of the middle two).
- **`auto`:** 1 start → next period = last + `cycleLengthDefault`, labeled "using your 28-day default"; 2+ → median; spread > 4 days → range instead of a date.
- **`irregular`:** 2+ starts → always a range, and **fertile window, ovulation and PMS are suppressed** ("not estimated while cycles are irregular"); 1 start → no next-period estimate either.
- **`paused`:** no predictions at all. Cycle day and last period still show; the calendar still records; the bleeding card still works.
- Predicted period block = next start … + `periodLengthDefault − 1`, or the median recorded period length when known. With a range, the whole range is dashed and no block length is implied.
- Ovulation ≈ next start − 14; fertile window ≈ −5 to +1; PMS = 5 days before.
- Cycle day = `diff(lastStart, today) + 1`; once past the expected date, "late" copy, never silently rolled forward.
- Period length from start/end pairs; default used only when unknown, labeled.
- **History:** last 12 cycles with start, end, cycle length, period length; average and min–max variation computed from recorded lengths.

### 4.4 Storage and backup

- `date.ts`: `isDayKey`, `todayKey()`, `addDays`, `diffDays`, `dayKeyToUTC`, `formatDay`; no `new Date("YYYY-MM-DD")` in math.
- `db.ts`: DB `cycal` v1; `events` (keyPath `id`, index `by_date`), `meta`. IDB unavailable → in-memory fallback with a visible banner.
- `store.svelte.ts`: `$state` events + settings; `load`, `add`, `update`, `remove`, `restore`, `saveSettings`. Write-through: persist first, then update UI; failed write keeps the sheet open with an inline error.
- `backup.ts`: `{ app: "cycal", schema: 1, exportedAt, events, settings }`; validate on import; merge (union by id) or replace; erase-all clears both stores.
- `ics.ts`: hand-built VCALENDAR with all-day VEVENTs (`DTSTART;VALUE=DATE`), CRLF and 75-octet line folding. Exports the **next 3 predicted cycles**: period block, fertile window, PMS; ovulation named in the fertile event's description. Every summary carries "(estimate)"; description carries "Cycal estimate — not contraception." No alarms — the user's calendar app sets those.
- **Backup nudge:** Settings always shows "last backup: N days ago". Under the calendar, a quiet line appears when there is no backup and ≥ 10 events, or the last one is > 60 days old; dismissing hides it for 30 days.

### 4.5 Dates and editability (non-restrictive)

- **Any past date is editable.** No minimum, no locked history, no cutoff. Year jump reaches back a century.
- **Period start/end on any past day** from the day sheet; the dashboard button is a shortcut for today.
- **Future dates:** notes allowed; period start/end disabled with visible copy ("A period can't start in the future").
- **Multiple events per day**, any kind; no sequence enforcement; an orphan end is stored and excluded from math, and still listed so it can be deleted.
- **Delete anything**, undo restores it. Only erase-all confirms.
- **A start without an end is valid**, not an error.

## 5. UI

### 5.0 Visual style — quiet utility

Rams-style restraint, deliberately warmed. The app is a tool used for ten seconds at a time, often one-handed and in low light; the data — not the interface — should be the only thing with presence.

- **One accent, paper neutrals, no decoration.** No gradients, illustrations, badges, streaks or drop shadows. Space separates; hairlines only where space cannot.
- **Warm, not clinical.** Near-black on warm off-white; no pure black or blue-white. Adult, neutral language; no pink clichés, baby imagery or "girlboss" copy.
- **Discreet by design.** "Cycle day 14", not a billboard; no period content on a lock screen; nothing that reads as a diagnosis.
- **Honest states.** Solid = recorded, dashed = predicted, labelled = estimated. The visual language carries the product's safety claim.
- **Feedback, not reward.** Motion only confirms an action; no confetti, screenshake or gamification.

| Token | Light | Dark |
|---|---|---|
| `--bg` / `--surface` | `#FAF9F7` / `#FFFFFF` | `#141312` / `#1C1A18` |
| `--ink` / `--muted` | `#1C1A19` / `#6F6862` | `#EDE9E3` / `#A8A099` |
| `--line` | `#E8E2DA` | `#2B2825` |
| `--accent` / `--accent-soft` | `#7A3B5C` / `#F2E6EC` | `#C98FA8` / `#33222B` |

Type: system sans; 12–14 meta, 17 body, 24 section, 44 hero; tabular numerals for every date and stat. Space: 4 px base with 8/12/16/24/32/48 steps. Shape: 12 px surfaces, circular day cells. Motion: 160 ms ease-out, feedback only, `prefers-reduced-motion` respected.

**Borrowed sparingly:** Tufte discipline belongs to the History screen only (direct labels, no chartjunk, text before charts). Juice belongs to micro-feedback only (a day filling on save, the undo toast). Neither styles the core logging flow.

### Layout rules (mobile-only)

- Design width **360 and 390 px**; works **320–480**; centered single column, max 480 px. No desktop layout, sidebars or tables.
- **Primary action in a fixed bottom bar** with `env(safe-area-inset-bottom)`.
- Targets **44×44 minimum, 48 for primary**; calendar cells 40×40 at 320, 44+ from 360; **16 px inputs**.
- Day details as a **bottom sheet** (max 85 `dvh`, sticky footer).
- **Month navigation under the grid** (Prev · Today · Next); heading opens native month/year selects.
- **No hover-only, long-press-only or swipe-only actions**; hover styles behind `@media (hover: hover)`.
- One column, no horizontal scroll at 320; `dvh`; safe-area; `prefers-reduced-motion`.

### 5.1 Dashboard

```
CYCLE DAY 14
Fertile window · ovulation tomorrow

Next period    Mon 7 Dec · in 15 days
Fertile        Wed 18 – Tue 24 Nov
Ovulation      Sun 23 Nov
PMS window     2–6 Dec
Last period    Mon 9 – Fri 13 Nov · 5 days
```

- Six values, hero plus four rows. No average (that lives in History).
- `paused`: prediction rows are replaced by one line — "Predictions paused in Settings" — while cycle day and last period remain.
- `irregular`: next period shows a range; fertile/ovulation/PMS rows show "not estimated while cycles are irregular".
- One start: next period carries "using your 28-day default".
- Bottom bar holds **Mark period start**, or the two confirmation buttons while a period is active.
- Empty state: "No cycles yet", primary Mark period start, secondary Add a past period. No wizard.
- Backup nudge sits below the calendar, not above it.

### 5.2 Calendar marks

- Recorded period: soft accent fill.
- Predicted period: dashed outline — a block of default/median period length, or the whole range when uncertain.
- Fertile window: very light tint; ovulation: small ring on the number.
- Other events: up to three dots; severity is shown in the sheet, not the grid.
- Today: underline; sheet-open day: focus ring.
- Legend under the grid; recorded vs predicted never differs by colour alone.
- Navigation: Prev · Today · Next under the grid; heading opens month/year selects. Cells 40 px at 320, 44+ from 360.
- Both palettes: every mark re-checked in dark mode, not just inverted.

### 5.3 Day sheet

Native `<dialog>` as a bottom sheet (max 85 `dvh`, sticky footer, 16 px inputs, 44 px chips), full date heading. Opens for any date, including years back.

| Row | Buttons |
|---|---|
| Period | Period started / Still bleeding / Period ended (contextual) |
| Common | Symptom · Mood · Flow |
| Other | Intimacy · Note · Custom |

- Symptom opens the preset list + "Other…", then optional **Mild / Moderate / Severe**.
- Mood: five levels. Flow: three levels, only on days a period covers.
- Existing events listed compactly with delete (undo, not confirm). Escape closes and returns focus; failed save keeps the sheet open.

### 5.4 Settings, history, backup

- **Predictions:** mode (Auto / Irregular / Paused), cycle default (21–45), period default (2–10), with copy that these are used only until real cycles exist.
- **Cycle history:** last 12 cycles, average and min–max variation; back link.
- **Data:** export JSON, import (merge/replace), export `.ics` predictions, erase-all (confirm).
- **Backup:** last backup age, export button, privacy note.
- Undo toast: 6 s, `role="status"`, one at a time.
- "Today" refreshes on `visibilitychange` and a 60 s tick.

### 5.5 Dark mode

- Follows `prefers-color-scheme` — no manual toggle in v1.
- Both palettes defined as tokens in `app.css`; dark is not an inversion: text at ~90 %, surfaces lifted, accent desaturated.
- Contrast and focus rings checked in both; the accent-soft period fill needs a dark variant, not the same hex with opacity.

## 6. Milestones

| # | Work | Done when |
|---|---|---|
| M0 | Scaffold, the §5.0 token set (both palettes), mobile shell with bottom bar and safe-area; update `PROPOSAL.md` §4 (Bits UI + ADT) and §3 (period model) | `pnpm dev`, `pnpm check` clean; 320 and 390 px no horizontal scroll; 44 px targets; both palettes legible |
| M1 | `date.ts`, `cycle.ts`, `periods.ts` + tests, including modes and defaults | Leap day, month/year boundary, DST weeks, 0/1/2/6+ starts, irregular/paused, default lengths, confirm/extend/end |
| M2 | `db.ts`, store, settings persistence, backup core, `vocab.ts` | Events + settings persist; fallback banner; export/import roundtrip test |
| M3 | Dashboard six values, empty/irregular/paused states, active-period card, backup nudge | All states correct; double-tap doesn't duplicate; confirm/end updates block |
| M4 | `MonthCalendar` with Bits UI, marks, block/range predictions, bottom nav, month/year jump, keyboard → sheet | 42 cells, correct marks, year jump to 2019, same-day reopen, bundle measured |
| M5 | `DaySheet` bottom sheet: all kinds, severity, past-date entry, period controls, delete + undo, errors | Every kind saves on a past date; severity round-trips; Escape returns focus |
| M6 | Settings, cycle history, `.ics` export, backup age/nudge | Export imports into Apple/Google Calendar; history lengths match; nudge appears and dismisses |
| M7 | PWA: manifest, icons, Workbox precache, build-only CSP | Installs, offline reload, zero page network requests, CSP in `dist/index.html` |
| M8 | Polish and verification pass | Checklist green; `pnpm test`, `pnpm check`, `pnpm build` pass |

Roughly **42–46 focused hours** (about six working days). M4 and M5 remain the pressure points; M6 is now larger than a settings page.

**CSP (build-only injection, so HMR is unaffected):**
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'`

Keep it valid with `injectRegister: null` and manual SW registration from `main.ts`.

## 7. Verification checklist

- First run, no data: six stats show designed empty values, no fake predictions.
- Mark period start → block appears; "Still bleeding" extends; "No, ended" sets yesterday; ignoring it does not grow the block.
- Add each of the six kinds → saved, listed, dotted; severity round-trips; delete → undo restores.
- Flow only on days a period covers.
- 1 cycle → default-length estimate labeled; 2+ → median; irregular mode → range and suppressed fertility/PMS; paused → no predictions, logging still works.
- Backdate a start 18 months ago via the year jump → predictions recompute; editable and deletable.
- Future period start refused with copy; future note accepted.
- `.ics` imports into Apple Calendar and Google Calendar: all-day, correct dates, "(estimate)" labels, no broken lines.
- Cycle history: lengths, average, variation match fixtures.
- Backup nudge appears when stale, dismisses, reappears after 30 days.
- Dark mode: system toggle, contrast and marks legible in both palettes.
- Style audit: every colour from a token; one accent; no pure black or white; no decoration beyond hairlines; the primary action is unmistakable.
- 320 and 390 px, 44 px targets, bottom bar one-handed, no horizontal scroll.
- Keyboard: tab into grid, arrows, Enter opens sheet, Esc closes, focus returns.
- 200 % zoom, offline reload, install on iPhone and Android (manual).
- Contrast ≥ 4.5:1, focus visible, reduced motion honoured.
- Export → erase → import restores data.
- Production build: CSP present, zero third-party requests, no console errors.

## 8. Risks

1. **Scope** — six dashboard values, six event kinds, daily confirmation, ICS, history, modes, dark mode. ~45 hours; M4/M5/M6 can each slip.
2. **Gap-filling on confirmation** infers bleeding days between confirmations; stated in copy and editable.
3. **ADT bundle weight** — measured at M4; may exceed 50 KB.
4. **`div role="button"` day cells** — screen-reader check; native-button fallback only if needed.
5. **ICS correctness** — line folding, exclusive `DTEND`, escaping; test against real calendar apps, not just string assertions.
6. **Defaults can mislead** — the 28/5-day defaults must always be labeled as defaults, never as measured.
7. **Paused/irregular edge cases** — no predictions must not mean broken layout or dead ends.
8. **Dark mode contrast** — two palettes, two rounds of checks; no colour-only marks.
9. **iOS storage eviction / PWA quirks** — needs a real-device check; backup nudge mitigates.
10. **Bits UI under jsdom** — calendar behaviour via Playwright, pure logic via Vitest.
11. **Mobile-only on desktop** — intentional; renders as a centered phone-width column.
12. **Future-date policy** — notes yes, period events no; refusal copy must explain itself.

**What I can't verify here:** real iOS Safari install, real screen-reader output, real calendar-app import, and how it feels on your phone. Those will be reported as untested, not claimed.

## 9. Working agreements

- `git init`, commit per milestone (M0–M8).
- Update `PROPOSAL.md` where this plan changes it: §4 calendar row, §3 period model, §1 scope.
- Stop after M4 for a look at the calendar and sheet before settings/PWA work.
- If M4 shows the ADT cost breaking the budget badly, stop and bring numbers.

## 10. Defaults I've chosen (flag any you dislike)

- **Mood:** five levels — Awful, Low, Okay, Good, Great.
- **Symptoms:** short preset list + "Other…" text; optional severity.
- **Flow:** Light / Medium / Heavy, only on days a period covers.
- **PMS:** five days before the predicted period; suppressed when irregular or paused.
- **Custom labels:** typed per event, no management screen.
- **Cycle defaults:** 28-day cycle, 5-day period, editable in Settings.
- **Prediction mode:** Auto.
- **ICS export:** next 3 predicted cycles, no alarms.
- **Dark mode:** follows the system; no manual toggle.
- **Backup nudge:** ≥ 10 events or 60 days since export; dismiss for 30 days.
- **Notifications:** none in v1 — `.ics` is the reminder path.

## 11. Build report — 16 Nov 2026

All confirmed v1 scope is implemented in `src/`.

| Check | Result |
|---|---|
| `pnpm check` | 0 errors, 0 warnings |
| `pnpm test` | 55 tests in 5 files, all passing |
| `pnpm build` | success; 16 precache entries (≈199 KiB) |
| Playwright (Chromium, 390×844) | 9/9 flows, including offline reload, CSP, backdating, keyboard, export→erase→import |
| Layout | no horizontal overflow at 320 or 390; day cells 46×46 at 390, 40×40 at 320; no visible control under 44 px |
| Contrast | body 16.5:1 (light) / 15.4:1 (dark); muted 5.21:1 / 7.20:1; all key pairs ≥ 4.5:1 |
| CSP | present in `dist/index.html`; no inline script; zero cross-origin requests after load |
| Screenshots | `screenshots/` — light/dark 390, 320, day sheet, settings, history |

**Bundle:** 169.8 KB JS → **54.7 KB gzip**, CSS 15.1 KB → 3.7 KB gzip, 15 precached files. This misses the 50 KB JS goal by about 5 KB; the real number is recorded rather than hidden. The service-worker bridge was removed when registration moved to a small base-aware `main.ts` handler.

**Fixed during verification:** Svelte `$state` proxies could not be structured-cloned into IndexedDB (snapshotted at the store boundary); the fertile tint was effectively invisible (warm tint plus dotted underline plus a legend entry); the backup nudge sat above the calendar instead of below; singular day/event copy; the same-day "Period started" action competed with an open period.

**Not verified:** iOS Safari install and storage eviction, real screen-reader output, and importing the `.ics` file into Apple or Google Calendar. No notifications, sync or app lock by design.

**Tooling notes:** TypeScript is pinned to 6.0.3 because `svelte-check` 4.7 rejects TypeScript 7; Playwright's Chromium lives in the gitignored `.playwright-browsers/`. The Pages build uses `VITE_BASE=/cycal/` and registers the service worker from that base; a local `/cycal/` static-server test covers manifest scope and offline reload.


## 12. v1.1 UI pass — 16 Nov 2026

The v1 mechanics, schema, URLs and QR stayed unchanged. This pass changed presentation and copy only.

**Language and dates.** All visible strings, error messages, ARIA labels and calendar labels are Lithuanian. Dates use deterministic arrays rather than `Intl` short months (lt-LT returns numeric months): `lapkr. 16 d.`, `lapkr. 18–24 d.`, `2026 m. lapkričio 16 d.`, `pirmadienis`. A Lithuanian plural helper covers `įrašas/įrašai/įrašų` and `ciklas/ciklai/ciklų`. The `.ics` export is Lithuanian and folds at 75 UTF-8 bytes, not 75 characters. `lang="lt"` is set on the document and manifest.

**Palette.** Light: ink `#12100F` (18.0:1), muted `#4F4944` (8.4:1), accent `#6A2C4A` (9.6:1), control border `#8F8577` (3.45:1), period fill `#6A2C4A` with white (10.1:1), fertile `#E4DCCB` (ink 13.9:1). Dark: ink `#F5F1EB` (16.8:1), muted `#C3BBB1` (9.9:1), accent `#E3A9C2` (9.6:1), control border `#6B6259` (3.16:1), period fill `#8E4E6B` with white (6.1:1), fertile `#3A332A` (ink 11.1:1). All text pairs pass AA; control borders pass 3:1.

**Calendar.** Recorded period = solid fill; predicted = 2 px dashed accent + tint; fertile = warm tint + 2 px dotted underline; ovulation = 2 px ring around the number; logged events = up to three 4 px dots; today = 2 px inset ring; selected = 2 px outer accent ring. The dated summary above the grid clips each range to the visible month and doubles as the legend. Previous/next/today moved into the calendar header; the bottom nav was removed.

**Dashboard.** Two-column stat grid with a wide next-period cell; the hero and status share one row. At 390×844 the today cell ends at 775.9 px and the action bar starts at 779 px, so today is fully visible. The active-period card is one row at 390 and wraps at 320.

**Verification.** `pnpm check` clean; 64 unit tests in 6 files; 9 Playwright flows; build 57.8 KB gzip JS, 4.0 KB gzip CSS, 15 precached files (202 KiB). No horizontal overflow at 390 or 320; day cells 46×46 and 40×40; zero visible controls below 44 px. All accessible labels checked: prev/next are Lithuanian, day names are full Lithuanian dates.

**Fixed during this pass.** Bits UI's prev/next buttons overrode the Lithuanian `aria-label` with “Previous/Next” — replaced with custom buttons. The year select truncated at 320 — narrow-width header widths. The today cell sat under the action bar — compact hero/active bar and spacing. Sheet chips and severity buttons were 40 px — raised to 44 px. The duplicate irregular-cycle note moved to the calendar summary only.

**Still not verified:** real iOS install/storage eviction, real screen-reader output, and importing the `.ics` into Apple/Google Calendar. The live URL and QR are unchanged.
