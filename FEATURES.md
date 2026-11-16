# Cycal — feature scan and suggestions

Status: proposal supplement · 16 Nov 2026

What Flo, Clue, Natural Cycles, Apple Health, drip, Euki, Periodical and Stardust actually ship — and which of it belongs in a private, mobile-only tracker.

**Method:** read the vendors' own help centres and product pages plus two independent privacy comparisons (sources at the end), focusing on feature descriptions rather than screenshots. No affiliate links.

## 1. The feature landscape

| Area | What the mainstream apps do | Cycal decision |
|---|---|---|
| Period logging | Start/end dates, flow intensity, backdated edits, spotting | **Adopt:** start + daily confirmation, full backdating |
| Symptoms | Flo "more than 80"; Clue "200+ factors"; severity, timing | **Adopt small:** ~10 presets + custom, severity in v1.1 |
| Body & lifestyle | Mood, energy, sleep, skin, digestion, sex drive, weight, water | **Mostly no:** mood only, custom tags for the rest |
| Fertility | Calendar estimates, BBT, ovulation tests, cervical mucus, wearables | **Partial:** calendar estimates only, clearly labeled |
| Predictions | Next period, fertile window, ovulation, PMS, late alerts, irregular handling | **Adopt:** all six dashboard values, ranges when irregular |
| Insights | Graphs, reports, symptom anticipation, cycle trends, sleep insights | **Later:** simple patterns only, no diagnosis |
| Modes | Conceive, pregnancy, postpartum, perimenopause, no period, birth control | **One:** "irregular / no cycle right now" in v1.1 |
| Reminders | Period, pill, daily log, notifications | **Workaround:** `.ics` export in v1.1 |
| Privacy | Cloud accounts (Flo, Clue, Stardust), on-device (drip, Euki), PIN + auto-wipe (Euki) | **Structural:** no account, no network |
| Sharing | Partner view, doctor reports | **No sharing; export only** |
| Integrations | Wearables, HealthKit, Health Connect | **No — a PWA cannot** |
| Content | Articles, AI assistant, community | **No** |

## 2. What each app is worth learning from

- **Flo** — the closest to what a first-time tracker expects. Logging the last period first, backdated symptoms, predictions colour-coded (red dotted period, teal fertile, dotted ovulation), a "Graphs & reports" section, reminders, goal-based modes. Its help centre explicitly says to log your last period first, which matches our optional "Add a past period". Flo's 2021 FTC settlement over data sharing is the reason "private" has to be structural, not a toggle. [Flo help](https://help.flo.health/hc/en-us/articles/360014347632-How-do-I-use-the-app) · [privacy comparison](https://unstore.io/discover/best-privacy-period-tracker-apps-android-2026)
- **Clue** — 200+ factors, mode switching (conceive, pregnancy, perimenopause, **no period**), partner sharing, wearables. The "no period" mode is the best idea here: a cycle app must not assume everyone is bleeding monthly. [Clue](https://helloclue.com/)
- **Natural Cycles** — the only FDA-cleared contraceptive app; basal body temperature plus wearables, red/green days, irregular-cycle support, partner view, perimenopause and postpartum modes, sleep insights. A useful contrast, not a model: **Cycal must never imply this level of assurance.** [Natural Cycles](https://www.naturalcycles.com/how-does-natural-cycles-work)
- **Apple Health** — on-device by default, no account, optional end-to-end-encrypted iCloud; Apple Watch wrist temperature gives after-the-fact ovulation estimates; Apple itself says it should not be used as birth control. Its restraint is the closest to our tone. [Apple Health](https://www.apple.com/health/) · [summary](https://allthingsn.com/best/best-private-period-tracker-apps/)
- **drip** — open source, on-device, symptothermal method (temperature and cervical mucus), deliberately no wearables. Proof that "private" and "useful" coexist. [drip](https://dripapp.org/)
- **Euki** — the strongest privacy posture: no account, PIN, scheduled data sweep and panic wipe. The PIN and wipe are interesting, but the user declined a lock for Cycal and scheduled deletion is too destructive for a health record. [Euki via comparison](https://unstore.io/discover/best-privacy-period-tracker-apps-android-2026)
- **Periodical** — the minimal counter-example: log periods, predict the next, encrypted backups, nothing else. A reminder that scope is a feature. [Periodical via comparison](https://unstore.io/discover/best-privacy-period-tracker-apps-android-2026)
- **Stardust** — polished, cloud-encrypted, partner sharing, astrology/moon overlays, pregnancy mode. The astrology and cloud storage are exactly what to leave out. [Stardust via comparison](https://unstore.io/discover/best-privacy-period-tracker-apps-android-2026)

## 3. Roadmap

### v1 — all seven adopted

The plan was updated: v1 now ships the base tracker **plus** all seven ideas from this scan — `.ics` prediction export, symptom severity, cycle history, irregular/paused prediction modes, manual cycle defaults, dark mode and the backup nudge. See [PLAN.md](PLAN.md) §§4–6 for how each is specified.

### v1.1 — after v1 ships

1. **Doctor summary.** A one-page, on-device summary: last six cycles, period lengths, symptom frequency. Printable or shareable as text/PDF. Euki and Ember Log show there is demand; it must be generated locally.
2. **Simple patterns.** Cycle-length trend and symptom frequency by phase, in plain language ("headaches were logged most often in the days before your period"). No diagnosis, no risk scores.
3. **BBT, ovulation tests and cervical mucus** as optional logged data. Data only — no "safe day" output. If interpretation is ever added, it needs a different accuracy model and explicit disclaimers.
4. **Import from Flo/Clue CSV** so migration does not mean losing history.
5. **Optional PIN.** If the shared-phone concern changes, Euki's PIN-gate pattern is the model. It is a gate, not encryption.

### v2 — only if the product changes

- End-to-end-encrypted sync (new backend; breaks "no network").
- Pregnancy/postpartum/perimenopause modes.
- Localisation.
- PWA shortcuts (not home-screen widgets — the platform does not offer them).

## 4. What not to copy, and why

| Feature | Who does it | Why Cycal should not |
|---|---|---|
| 80–200 item symptom taxonomies | Flo, Clue | Cognitive load; 10 presets + custom covers what people actually log |
| Accounts, cloud sync, "anonymous mode" | Flo, Clue, Stardust | Defeats the product; with no account, anonymous mode is redundant |
| Partner view | Natural Cycles, Clue, Stardust | Deliberate exclusion — the data is one person's |
| Content feeds, community, AI assistant | Flo, Clue | Bloat, moderation, and medical risk without a clinician |
| Avatars, astrology, moon phases | Stardust, Blood | Tone and evidence |
| Contraception claims or "safe days" | Natural Cycles | They are FDA-cleared; Cycal is not, and will not imply it |
| Wearables, HealthKit, Health Connect | Clue, Natural Cycles | A PWA cannot use them |
| Push reminders, home-screen widgets | Mainstream apps | PWA limits; use `.ics` export and in-app state instead |
| PIN with scheduled/panic wipe | Euki | The lock was declined; scheduled deletion of health data is too dangerous |
| Multiple profiles | Some trackers | One person, one device — scope without benefit |

## 5. Mobile-only design rules

Now in [PLAN.md](PLAN.md) §5, summarised:

- Designed at 360 and 390 px; works 320–480; single column; **no desktop layout** — on a laptop it is a centered phone-width column.
- Primary action in a **fixed bottom bar** with safe-area insets, not at the top.
- **44×44 px minimum**, 48 px for the primary action; calendar cells 40 px at 320, 44+ from 360; inputs 16 px to stop iOS zoom.
- Day details as a **bottom sheet**; month navigation **under the grid**; heading opens month/year selects.
- No hover-only, long-press-only or swipe-only actions. Every gesture has a visible button.
- `dvh`, safe-area insets, `prefers-reduced-motion`.

## 6. Non-restrictive data rules

Now in [PLAN.md](PLAN.md) §4.5, summarised:

- Any past date, no minimum, year jump back a century.
- Period start/end on any past day; the dashboard button is a shortcut, not the only path.
- No limit on events per day; no enforced sequence; an orphan end is stored and flagged.
- A start without an end is valid; the app asks, never blocks.
- Delete anything; undo restores. Only erase-all confirms.
- Future dates: notes yes; period start/end no, with visible copy.

## 7. Safety and honesty

- Predictions are estimates, shown as dates **or ranges**, with the number of cycles they are based on.
- No "safe day" wording, no contraception claims, no diagnosis. Natural Cycles is a regulated device; this is not.
- If BBT or mucus logging arrives, it is data-only until a proper method and disclaimers exist.
- The privacy claim stays structural: no network capability at runtime, not a policy promise. Flo's history is the argument for that.

## 8. Sources

- [Flo — How do I use the app?](https://help.flo.health/hc/en-us/articles/360014347632-How-do-I-use-the-app)
- [Clue](https://helloclue.com/)
- [Natural Cycles — how it works](https://www.naturalcycles.com/how-does-natural-cycles-work)
- [Apple Health](https://www.apple.com/health/)
- [drip](https://dripapp.org/)
- [Best private, offline period tracker apps (2026), All Things AI](https://allthingsn.com/best/best-private-period-tracker-apps/)
- [Best privacy-focused period tracker apps for Android (2026), Unstore](https://unstore.io/discover/best-privacy-period-tracker-apps-android-2026)
