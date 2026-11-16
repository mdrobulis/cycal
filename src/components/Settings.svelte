<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { backupAgeDays, downloadText, parseBackup, type BackupFile } from '../lib/backup';
  import { buildPredictionICS } from '../lib/ics';
  import { formatDay, isDayKey } from '../lib/date';
  import { PRIVACY_NOTE } from '../lib/strings';
  import type { PredictionMode, Settings as SettingsType } from '../lib/types';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import Icon from './Icon.svelte';

  let {
    onBack,
    onHistory,
    onExport,
  }: { onBack: () => void; onHistory: () => void; onExport: () => void } = $props();

  const MODES: ReadonlyArray<{ value: PredictionMode; label: string; hint: string }> = [
    {
      value: 'auto',
      label: 'Auto',
      hint: 'Uses your median cycle length, and switches to a range when cycles vary.',
    },
    {
      value: 'irregular',
      label: 'Irregular',
      hint: 'Shows ranges and hides fertile, ovulation and PMS estimates.',
    },
    {
      value: 'paused',
      label: 'Paused',
      hint: 'Hides all predictions. Logging still works.',
    },
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
    error = cause instanceof Error ? cause.message : 'Something went wrong.';
  }

  function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
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
      status = 'Backup saved.';
    } catch (cause) {
      fail(cause);
    }
  }

  function exportICS(): void {
    error = null;
    try {
      const text = buildPredictionICS(app.events, app.settings, app.today);
      downloadText(`cycal-predictions-${app.today}.ics`, text, 'text/calendar');
      status = 'Calendar file saved.';
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
    const count = backup.events.length;
    error = null;
    try {
      await app.importMerge(backup.events);
      pending = null;
      status = `Merged ${plural(count, 'event', 'events')}.`;
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
      status = 'Backup restored.';
    } catch (cause) {
      fail(cause);
    }
  }

  async function erase(): Promise<void> {
    confirmErase = false;
    error = null;
    try {
      await app.eraseAll();
      status = 'All data erased.';
    } catch (cause) {
      fail(cause);
    }
  }

  function exportDate(file: BackupFile): string {
    const key = file.exportedAt.slice(0, 10);
    return isDayKey(key) ? formatDay(key) : 'an unknown date';
  }
</script>

<header class="topbar page-head">
  <button class="icon-btn" aria-label="Back" onclick={onBack}>
    <Icon name="back" />
  </button>
  <h1 class="page-title">Settings</h1>
</header>

<section class="group first">
  <h2 class="group-title">Predictions</h2>
  <div class="seg" role="group" aria-label="Prediction mode">
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
      Cycle length
      <span class="unit">
        <input
          type="number"
          min="21"
          max="45"
          inputmode="numeric"
          value={app.settings.cycleLengthDefault}
          onchange={(event) => saveNumber('cycleLengthDefault', event.currentTarget.value)}
        />
        <span class="muted">days</span>
      </span>
    </label>
    <label class="field">
      Period length
      <span class="unit">
        <input
          type="number"
          min="2"
          max="10"
          inputmode="numeric"
          value={app.settings.periodLengthDefault}
          onchange={(event) => saveNumber('periodLengthDefault', event.currentTarget.value)}
        />
        <span class="muted">days</span>
      </span>
    </label>
  </div>
  <p class="hint">Used only until you have recorded two cycles.</p>

  <button class="secondary wide" onclick={onHistory}>Cycle history</button>
</section>

<section class="group">
  <h2 class="group-title">Backup</h2>
  <p class="hint">
    {backupAge === null ? 'No backup yet.' : `Last backup: ${backupAge} days ago.`}
  </p>
  <button class="secondary wide" onclick={exportNow}>Export backup</button>
  <p class="hint">
    iOS can clear site data for unused sites. Keep an exported copy you can restore.
  </p>
</section>

<section class="group">
  <h2 class="group-title">Data</h2>
  <div class="stack">
    <button class="secondary wide" onclick={() => fileInput?.click()}>Import backup</button>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json,.json"
      onchange={onFile}
      hidden
    />
    <button class="secondary wide" onclick={exportICS}>Add predictions to calendar (.ics)</button>
    <button class="secondary wide danger-text" onclick={() => (confirmErase = true)}>
      Erase all data
    </button>
  </div>

  {#if pending}
    <div class="notice">
      <p>
        This backup has {plural(pending.events.length, 'event', 'events')}, exported
        {exportDate(pending)}. Merge it with what is here, or replace everything?
      </p>
      <div class="notice-actions">
        <button class="secondary" onclick={merge}>Merge</button>
        <button class="danger-button" onclick={() => (confirmReplace = true)}>Replace</button>
        <button class="link-button" onclick={() => (pending = null)}>Cancel</button>
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
  <h2 class="group-title">Privacy</h2>
  <p class="body">{PRIVACY_NOTE}</p>
  <p class="hint">Cycal 0.1.0 · local only · no network</p>
</section>

<ConfirmDialog
  open={confirmErase}
  title="Erase everything?"
  message="This removes every cycle and event from this device. There is no undo. Export a backup first if you might want it back."
  confirmLabel="Erase everything"
  onConfirm={erase}
  onCancel={() => (confirmErase = false)}
/>

<ConfirmDialog
  open={confirmReplace}
  title="Replace all data?"
  message="The current cycles and events will be deleted and replaced by the backup. There is no undo."
  confirmLabel="Replace everything"
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
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }

  .seg button {
    flex: 1 1 0;
    min-height: 44px;
    font-size: 13px;
  }

  .seg button + button {
    border-left: 1px solid var(--line);
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
    font-size: 15px;
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
    font-size: 12px;
    line-height: 1.4;
  }

  .body {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
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
    margin: 0;
    font-size: 14px;
    line-height: 1.4;
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
