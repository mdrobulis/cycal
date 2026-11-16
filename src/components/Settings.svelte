<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { backupAgeDays, downloadText, parseBackup, type BackupFile } from '../lib/backup';
  import { buildPredictionICS } from '../lib/ics';
  import { formatDay, isDayKey } from '../lib/date';
  import { COPY, ltCount } from '../lib/strings';
  import type { PredictionMode, Settings as SettingsType } from '../lib/types';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import Icon from './Icon.svelte';

  let {
    onBack,
    onHistory,
    onExport,
  }: { onBack: () => void; onHistory: () => void; onExport: () => void } = $props();

  const MODES: ReadonlyArray<{ value: PredictionMode; label: string; hint: string }> = [
    { value: 'auto', ...COPY.settings.modes.auto },
    { value: 'irregular', ...COPY.settings.modes.irregular },
    { value: 'paused', ...COPY.settings.modes.paused },
  ];

  let fileInput = $state<HTMLInputElement>();
  let pending = $state<BackupFile | null>(null);
  let error = $state<string | null>(null);
  let status = $state<string | null>(null);
  let confirmErase = $state(false);
  let confirmReplace = $state(false);

  const modeHint = $derived(
    MODES.find((mode) => mode.value === app.settings.predictionMode)?.hint ?? '',
  );
  const backupAge = $derived(backupAgeDays(app.settings.lastExportAt, app.today));

  function fail(cause: unknown): void {
    error = cause instanceof Error ? cause.message : COPY.errors.generic;
  }

  async function setMode(value: PredictionMode): Promise<void> {
    error = null;
    try {
      await app.saveSettings({ predictionMode: value });
    } catch (cause) {
      fail(cause);
    }
  }

  async function saveNumber(
    key: 'cycleLengthDefault' | 'periodLengthDefault',
    raw: string,
  ): Promise<void> {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    error = null;
    try {
      await app.saveSettings({ [key]: value } as Partial<SettingsType>);
    } catch (cause) {
      fail(cause);
    }
  }

  function exportNow(): void {
    error = null;
    try {
      onExport();
      status = COPY.settings.statuses.backupSaved;
    } catch (cause) {
      fail(cause);
    }
  }

  function exportICS(): void {
    error = null;
    try {
      const text = buildPredictionICS(app.events, app.settings, app.today);
      downloadText(`cycal-predictions-${app.today}.ics`, text, 'text/calendar');
      status = COPY.settings.statuses.calendarSaved;
    } catch (cause) {
      fail(cause);
    }
  }

  async function onFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    error = null;
    status = null;
    pending = null;
    try {
      pending = parseBackup(await file.text());
    } catch (cause) {
      fail(cause);
    }
  }

  async function merge(): Promise<void> {
    if (!pending) return;
    const backup = pending;
    const countText = ltCount(backup.events.length, 'įrašas', 'įrašai', 'įrašų');
    error = null;
    try {
      await app.importMerge(backup.events);
      pending = null;
      status = COPY.settings.statuses.merged(countText);
    } catch (cause) {
      fail(cause);
    }
  }

  async function replace(): Promise<void> {
    if (!pending) return;
    const backup = pending;
    confirmReplace = false;
    error = null;
    try {
      await app.importReplace(backup.events, backup.settings);
      pending = null;
      status = COPY.settings.statuses.restored;
    } catch (cause) {
      fail(cause);
    }
  }

  async function erase(): Promise<void> {
    confirmErase = false;
    error = null;
    try {
      await app.eraseAll();
      status = COPY.settings.statuses.erased;
    } catch (cause) {
      fail(cause);
    }
  }

  function exportDate(file: BackupFile): string {
    const key = file.exportedAt.slice(0, 10);
    return isDayKey(key) ? formatDay(key) : 'nežinoma data';
  }
</script>

<header class="topbar page-head">
  <button class="icon-btn" aria-label={COPY.common.back} onclick={onBack}>
    <Icon name="back" />
  </button>
  <h1 class="page-title">{COPY.settings.title}</h1>
</header>

<section class="group first">
  <h2 class="group-title">{COPY.settings.predictions}</h2>
  <div class="seg" role="group" aria-label={COPY.settings.modeAria}>
    {#each MODES as mode (mode.value)}
      <button
        aria-pressed={app.settings.predictionMode === mode.value}
        class:on={app.settings.predictionMode === mode.value}
        onclick={() => setMode(mode.value)}
      >
        {mode.label}
      </button>
    {/each}
  </div>
  <p class="hint">{modeHint}</p>

  <div class="fields">
    <label class="field">
      {COPY.settings.cycleLength}
      <span class="unit">
        <input
          type="number"
          min="21"
          max="45"
          inputmode="numeric"
          value={app.settings.cycleLengthDefault}
          onchange={(event) => saveNumber('cycleLengthDefault', event.currentTarget.value)}
        />
        <span class="muted">{COPY.settings.days}</span>
      </span>
    </label>
    <label class="field">
      {COPY.settings.periodLength}
      <span class="unit">
        <input
          type="number"
          min="2"
          max="10"
          inputmode="numeric"
          value={app.settings.periodLengthDefault}
          onchange={(event) => saveNumber('periodLengthDefault', event.currentTarget.value)}
        />
        <span class="muted">{COPY.settings.days}</span>
      </span>
    </label>
  </div>
  <p class="hint">{COPY.settings.defaultsHint}</p>

  <button class="secondary wide" onclick={onHistory}>{COPY.settings.history}</button>
</section>

<section class="group">
  <h2 class="group-title">{COPY.settings.backup}</h2>
  <p class="hint">
    {backupAge === null ? COPY.settings.noBackup : COPY.settings.lastBackup(backupAge)}
  </p>
  <button class="secondary wide" onclick={exportNow}>{COPY.settings.export}</button>
  <p class="hint">{COPY.settings.backupHint}</p>
</section>

<section class="group">
  <h2 class="group-title">{COPY.settings.data}</h2>
  <div class="stack">
    <button class="secondary wide" onclick={() => fileInput?.click()}>{COPY.settings.import}</button>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json,.json"
      onchange={onFile}
      hidden
    />
    <button class="secondary wide" onclick={exportICS}>{COPY.settings.ics}</button>
    <button class="secondary wide danger-text" onclick={() => (confirmErase = true)}>
      {COPY.settings.erase}
    </button>
  </div>

  {#if pending}
    <div class="notice">
      <p>{COPY.settings.importTitle(ltCount(pending.events.length, 'įrašas', 'įrašai', 'įrašų'), exportDate(pending))}</p>
      <p>{COPY.settings.importQuestion}</p>
      <div class="notice-actions">
        <button class="secondary" onclick={merge}>{COPY.settings.merge}</button>
        <button class="danger-button" onclick={() => (confirmReplace = true)}>{COPY.settings.replace}</button>
        <button class="link-button" onclick={() => (pending = null)}>{COPY.settings.cancel}</button>
      </div>
    </div>
  {/if}

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
  {#if status}
    <p class="status" role="status">{status}</p>
  {/if}
</section>

<section class="group">
  <h2 class="group-title">{COPY.settings.privacy}</h2>
  <p class="body">{COPY.app.privacyNote}</p>
  <p class="hint">{COPY.app.version}</p>
</section>

<ConfirmDialog
  open={confirmErase}
  title={COPY.settings.eraseTitle}
  message={COPY.settings.eraseMessage}
  confirmLabel={COPY.settings.eraseConfirm}
  onConfirm={erase}
  onCancel={() => (confirmErase = false)}
/>

<ConfirmDialog
  open={confirmReplace}
  title={COPY.settings.replaceTitle}
  message={COPY.settings.replaceMessage}
  confirmLabel={COPY.settings.replaceConfirm}
  onConfirm={replace}
  onCancel={() => (confirmReplace = false)}
/>

<style>
  .page-head {
    justify-content: flex-start;
    gap: 0;
  }

  .group {
    margin-top: 26px;
    padding-top: 22px;
    border-top: 1px solid var(--line);
  }

  .group.first {
    margin-top: 10px;
    padding-top: 0;
    border-top: 0;
  }

  .group-title {
    margin: 0 0 10px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .seg {
    display: flex;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
  }

  .seg button {
    flex: 1 1 0;
    min-height: 44px;
    font-size: 14px;
  }

  .seg button + button {
    border-left: 1px solid var(--line-strong);
  }

  .seg button.on {
    background: var(--accent-soft);
    font-weight: 600;
  }

  .fields {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 16px;
  }

  .unit {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .unit input {
    width: 84px;
    text-align: right;
  }

  .hint {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.4;
  }

  .body {
    margin: 0;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.5;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .wide {
    width: 100%;
  }

  .notice {
    margin-top: 12px;
    padding: 12px;
    border-radius: var(--radius);
    background: var(--accent-soft);
  }

  .notice p {
    margin: 0 0 6px;
    font-size: 14px;
    line-height: 1.4;
  }

  .notice p:last-of-type {
    margin-bottom: 0;
  }

  .notice-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .error {
    margin: 12px 0 0;
    color: var(--danger);
    font-size: 14px;
  }

  .status {
    margin: 12px 0 0;
    color: var(--muted);
    font-size: 13px;
  }
</style>
