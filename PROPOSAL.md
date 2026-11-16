# Cycal — a private cycle-tracking PWA

Proposal v0.1 · 13 Nov 2026 · implemented 16 Nov 2026 · single user, single device, no account

> **Built.** See [README.md](README.md) for run/test instructions and [PLAN.md](PLAN.md) for the final decisions and build report.

**The job, in the user's words:** *"Check where I am in my cycle, and note what happened today."*

Everything below serves that sentence. One screen to answer it, one calendar to record into, one settings page for backup and erasure. No backend, no accounts, no telemetry — the data never leaves the device.

## 1. Scope

**v1 does:**
- Record a period start, daily "still bleeding" confirmations, an explicit end, and dated events (symptom with severity, mood, flow, intimacy, note, custom label).
- Show six dashboard values: cycle day, next period, fertile window, ovulation, PMS window, last period.
- Estimate dates from the median of recent cycles, with ranges when cycles vary, manual defaults, and auto / irregular / paused modes.
- Month calendar with backdated entry, month/year jump, and keyboard navigation.
- Local-only storage, JSON export/import, `.ics` prediction export, erase-all.
- Cycle history, dark mode, and a stale-backup nudge.
- Installable to the home screen, fully offline.
- English UI, system fonts, light and dark themes, one accent colour.

**v1 explicitly does not:** accounts or sync, multiple profiles, push notifications, wearables, AI "insights", symptom charts, contraception or medical guidance, sharing, social features. Each is a v2 question, not a v1 omission.

## 2. Screens

Three surfaces. Home is one scrolling page: the dashboard, the calendar, then the backup nudge — no nav chrome, because there is nowhere else to go. A fixed bottom bar holds the one primary action.

```
┌──────────────────────────────────────┐
│ Cycal                            ⚙   │
│                                      │
│ CYCLE DAY 14                         │
│ Fertile window · ovulation tomorrow  │
│                                      │
│ Next period    Mon 7 Dec · in 15 d   │
│ Fertile        Wed 18 – Tue 24 Nov   │
│ Ovulation      Sun 23 Nov            │
│ PMS window     2–6 Dec               │
│ Last period    Mon 9 – Fri 13 Nov · 5 days
│                                      │
│ ◀  November 2026  ▶                  │
│ Mo Tu We Th Fr Sa Su                 │
│                    1  2              │
│  3  4  5  6  7  8  9                 │
│  ...                                 │
│ ● recorded  ◌ predicted  ▤ fertile  • logged
└──────────────────────────────────────┘
```

- **Day sheet** (native `<dialog>`, bottom sheet on phones): period actions, the day's events with delete + undo, and add chips for symptom, mood, flow, intimacy, note and custom.
- **Settings**: prediction mode, cycle/period defaults, cycle history, backup export/import, `.ics` export, erase all, privacy note.
- **States designed, not defaulted:** first run with no data; too little data for an estimate; irregular cycles; paused predictions; storage blocked; import conflict; zero-event day; future date with period actions disabled.

## 3. Data model

One timeline of dated events; cycles are *derived*, never stored. This keeps state small and makes every edit undoable by deleting one row.

```ts
type DayKey = string; // "YYYY-MM-DD", a civil date, no time or zone

type EventKind =
  | 'period-start' | 'period-day' | 'period-end'
  | 'symptom' | 'mood' | 'flow' | 'intimacy' | 'note' | 'custom';

type Severity = 1 | 2 | 3;

type DayEvent = {
  id: string;                    // crypto.randomUUID()
  date: DayKey;
  kind: EventKind;
  label?: string;                // symptom name, custom label
  value?: number | string;       // mood 1–5; flow light/medium/heavy
  severity?: Severity;           // symptoms only
  note?: string;
  createdAt: string;
};

type Settings = {
  cycleLengthDefault: number;    // 21–45, default 28
  periodLengthDefault: number;   // 2–10, default 5
  predictionMode: 'auto' | 'irregular' | 'paused';
  lastExportAt?: string;
  backupNudgeDismissedAt?: string;
};
```

IndexedDB `cycal`, versioned: store `events` (keyPath `id`, index `by_date`), store `meta` (settings and export timestamps). No cycle table, no derived cache.

**Period model:** a `period-start` opens a period. Each daily "still bleeding" adds a `period-day`; an explicit `period-end` closes it. The block runs from start to end (or to the last confirmed day while open). Confirming after a gap fills the gap in the display — a period is continuous — and no confirmation means no invented days.

**Cycle math** (`src/lib/cycle.ts`, pure functions, no DOM):

- Cycle starts = sorted `period-start` dates. A cycle's length = days to the next start.
- Prediction uses the **median** of the last six lengths, not the mean — one unusual cycle must not move the answer much.
- With one recorded start, the next period uses the **manual default (28 days)**, labelled as a default; with two or more, the median.
- If recent lengths diverge by more than 4 days, show a **range** and suppress fertility/PMS; the `irregular` mode forces this, `paused` hides all predictions.
- Ovulation ≈ 14 days before the next predicted start; fertile window ≈ 5 days before to 1 day after; PMS = the 5 days before.
- Period length comes from start/end pairs; the default 5 days is used only when none are known, and labelled.

## 4. Technical decisions

**At a glance:** Svelte 5 + Vite + strict TypeScript · Bits UI Calendar + `@internationalized/date` at that boundary only · IndexedDB via `idb` · plain CSS custom properties (light + dark) · `vite-plugin-pwa` · Vitest + Playwright.

| Concern | Decision | Why |
|---|---|---|
| Language | TypeScript, `strict` | Date and cycle math is where silent off-by-one bugs live; types are cheap insurance. |
| Framework | Svelte 5 (runes) + Vite | Compiles away, no virtual DOM, scoped styles. Three screens do not justify a 45 KB React runtime. |
| Dates | `YYYY-MM-DD` day strings + a small helper module for all app logic. `@internationalized/date` appears **only inside `MonthCalendar`**. | Cycle calculations are whole-day integer arithmetic. Day strings sidestep DST, time zones and month lengths; ADT is a required peer of Bits UI and converts at one boundary. |
| Storage | IndexedDB, wrapped by `idb` | Async, structured, versionable. If IndexedDB is unavailable, fall back to in-memory with a visible "changes won't be saved" warning — never silent loss. |
| State | Runes + one `store.svelte.ts`; stats are pure functions | No Redux/Zustand. Derived values cannot drift out of sync if they are never stored. |
| Styling | Plain CSS + custom properties, one token file, light and dark palettes | No Tailwind or UI kit. Tokens make the dark palette a swap, not a redesign. |
| Calendar | **Bits UI Calendar** (headless, Svelte 5), styled with our tokens | Accessible grid semantics, roving keyboard focus, month paging and custom day content for free; every pixel stays ours. |
| Icons | A handful of inline SVGs | No icon package for a gear, chevrons and a close. |
| PWA | `vite-plugin-pwa` (Workbox), manual SW registration, build-only CSP | Offline shell; no inline script, so `script-src 'self'` stays valid. |
| Tests | Vitest for logic; Playwright for nine end-to-end flows | Math gets table-driven edge cases; the browser suite covers persistence, period flow, backdating, import/export, offline and CSP. |
| Tooling | pnpm, Prettier, `svelte-check`; TypeScript pinned to 6 | `svelte-check` 4.7 rejects TypeScript 7; Vite transpiles without tsc, so the pin costs nothing at runtime. |
| Hosting | Any static host over HTTPS, served from the domain root | No server exists. `connect-src 'none'` in the page CSP makes that structural. |

**Measured build:** 55.7 KB gzip JS + 2.2 KB gzip service-worker bridge; 3.7 KB gzip CSS. The 50 KB JS target was missed by ~7 KB; the app ships at ~58 KB total gzip. The number is recorded rather than hidden.

## 5. Visual and interaction rules

- **Quiet utility.** Rams restraint, warmed: paper neutrals, one accent (`#7a3b5c` light, `#c98fa8` dark), no decoration, system fonts, four type sizes, 12 px surfaces, circular day cells. Dark follows the system.
- **Recorded vs predicted vs fertile is a shape difference, not only a colour difference:** recorded period = filled circle; predicted period = dashed outline; fertile window = warm tint plus a dotted underline; ovulation = a ring around the number; logged events = dots below. Colour never carries meaning alone.
- **One primary action per screen**, fixed in a bottom bar within thumb reach: "Mark period start", or "Still bleeding" / "Ended" while a period is open. Everything else is quiet.
- **Mobile-only:** designed at 360 and 390, works 320–480, single column. 44 px targets (40 px day cells at 320), 16 px inputs, bottom-sheet day details, month navigation under the grid.
- Undo (6 s) for deleting an event; a confirmation dialog only for erase-all and backup replacement. Never lose typed input — the sheet keeps its draft through a failed save.
- Motion 160 ms ease-out, only as feedback, `prefers-reduced-motion` honoured. Nothing animates after load, no modal on open.
- Empty and error copy is written, not generated: *"No cycles yet. Mark your period start below, or tap any day on the calendar to add history."*

## 6. Privacy and safety

The reason this is a PWA and not a website with an account.

- **No runtime network.** No analytics, no crash reporting, no CDN fonts, no third-party scripts. The production page carries `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'`. The page is structurally unable to send data anywhere; the SW registration is a module import, not an inline script. Verified in a real browser: zero cross-origin requests after load.
- **Threat model, stated honestly:** the device being lost or inspected, a cloud backup, someone glancing at the screen. Not a state actor and not a compromised OS. Protection at rest is the OS passcode plus disk encryption; the app does not pretend to add encryption it does not have.
- **Export is plaintext.** JSON backups and `.ics` prediction files are readable by anyone who gets them; the buttons say so. Import merges by `id` or replaces everything.
- **Delete all** is immediate and reversible only by an exported backup — the one place a confirmation is correct.
- **Health data is special-category under GDPR Art. 9.** Local-only processing is the simplest lawful position; adding sync later reopens consent, encryption and processor questions, which is exactly why it is out of v1.
- **Safety copy:** "Predictions are estimates, not contraception." Predictions de-emphasise or hide when data is thin or cycles are irregular; no green/red "safe day" language, ever.
- **iOS risk:** Safari can evict site data for unused sites. Mitigation: install to the home screen, and show "last backup: N days ago" with an export nudge after 10 events or 60 days. Must be verified on a real iPhone — it has not been.

## 7. Build order

Implemented in the order planned in [PLAN.md](PLAN.md) §6: scaffold and tokens → date/cycle/period math with tests → storage and store → dashboard → Bits UI calendar → day sheet → settings, history and `.ics` → PWA and CSP → verification. Roughly 45 focused hours, plus a browser-test pass.

## 8. Decisions taken

1. **Event vocabulary** — six user-facing kinds (symptom, mood, flow, intimacy, note, custom), plus internal period start/day/end.
2. **One person, one phone** — no profiles, no sharing, no account.
3. **No app lock** — the phone passcode is the boundary; a PIN or encryption was declined.
4. **Calendar under the dashboard**, single scrolling page.
5. **Name** — Cycal.
6. **Mobile-only**, 320–480 px, bottom bar and sheet; desktop renders a centred phone-width column.

## 9. Risks and honest limits

- **Predictions read as certainty.** Ranges, the "using your default" label and the estimate line are the mitigation; the copy matters more than the model.
- **Irregular cycles are the normal case for many users** (PCOS, perimenopause, postpartum). Median plus a range degrades gracefully; the irregular mode hides fertility and PMS rather than guessing.
- **Bundle is over target** — 55.3 KB gzip JS plus 2.2 KB SW bridge against a 50 KB goal. It was measured and recorded, not hidden.
- **PWA platform quirks on iOS** are real and untested on hardware. Data eviction remains a risk; the backup nudge is the mitigation.
- **Not verified here:** a real iOS install, real screen-reader output, and importing the `.ics` file into Apple/Google Calendar. These are listed as untested, not claimed.
- **No notifications, no lock, no sync** — deliberate. `.ics` export is the reminder path; the phone passcode is the lock; a file backup is the sync.
- **Scope creep toward charts and "insights."** v1 records; it does not interpret. That is the line.
