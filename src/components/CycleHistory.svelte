<script lang="ts">
  import { tick } from 'svelte';
  import { app } from '../lib/store.svelte';
  import { addDays, formatDay, formatRange, isDayKey } from '../lib/date';
  import { COPY } from '../lib/strings';
  import type { HistoryCycle } from '../lib/types';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import Icon from './Icon.svelte';

  let {
    onBack,
    startAdding = false,
  }: { onBack: () => void; startAdding?: boolean } = $props();

  const history = $derived(app.history);
  const lengths = $derived(
    history
      .map((cycle) => cycle.cycleLength)
      .filter((length): length is number => typeof length === 'number'),
  );
  const average = $derived(
    lengths.length
      ? Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length)
      : null,
  );
  const low = $derived(lengths.length ? Math.min(...lengths) : null);
  const high = $derived(lengths.length ? Math.max(...lengths) : null);

  // svelte-ignore state_referenced_locally
  let addOpen = $state(startAdding);
  let addStart = $state('');
  let addEnd = $state('');
  let addStartInput = $state<HTMLInputElement>();
  let addError = $state<string | null>(null);
  let editingStart = $state<string | null>(null);
  let editStart = $state('');
  let editEnd = $state('');
  let editError = $state<string | null>(null);
  let deleting = $state<HistoryCycle | null>(null);
  let status = $state<string | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  function fail(cause: unknown): void {
    error = cause instanceof Error ? cause.message : COPY.errors.save;
  }

  function cycleLabel(cycle: HistoryCycle): string {
    return cycle.end ? formatRange(cycle.start, cycle.end) : formatDay(cycle.start);
  }

  function onAddStart(event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value;
    if (!isDayKey(value) || addEnd) return;
    const suggested = addDays(value, app.settings.periodLengthDefault - 1);
    addEnd = suggested > app.today ? app.today : suggested;
  }

  function toggleAdd(): void {
    addOpen = !addOpen;
    addError = null;
    if (addOpen) {
      void tick().then(() => addStartInput?.focus());
    }
  }

  function cancelAdd(): void {
    addOpen = false;
    addError = null;
    addStart = '';
    addEnd = '';
    status = null;
  }

  async function saveAdd(): Promise<void> {
    if (busy) return;
    addError = null;
    status = null;
    error = null;
    if (!isDayKey(addStart)) {
      addError = COPY.errors.periodInvalid;
      return;
    }
    if (!isDayKey(addEnd)) {
      addError = COPY.history.endRequired;
      return;
    }
    busy = true;
    try {
      await app.addPeriodRange(addStart, addEnd);
      addStart = '';
      addEnd = '';
      status = COPY.history.added;
      await tick();
      addStartInput?.focus();
    } catch (cause) {
      addError = cause instanceof Error ? cause.message : COPY.errors.save;
    } finally {
      busy = false;
    }
  }

  function startEdit(cycle: HistoryCycle): void {
    editingStart = cycle.start;
    editStart = cycle.start;
    editEnd = cycle.end ?? '';
    editError = null;
    error = null;
    status = null;
  }

  function cancelEdit(): void {
    editingStart = null;
    editError = null;
  }

  async function saveEdit(cycle: HistoryCycle): Promise<void> {
    if (busy) return;
    editError = null;
    status = null;
    error = null;
    if (!isDayKey(editStart)) {
      editError = COPY.errors.periodInvalid;
      return;
    }
    if (editEnd && !isDayKey(editEnd)) {
      editError = COPY.errors.periodInvalid;
      return;
    }
    busy = true;
    try {
      await app.updatePeriodRange(cycle.start, editStart, editEnd || null);
      editingStart = null;
      status = COPY.history.updated;
    } catch (cause) {
      editError = cause instanceof Error ? cause.message : COPY.errors.save;
    } finally {
      busy = false;
    }
  }

  function askDelete(cycle: HistoryCycle): void {
    deleting = cycle;
    error = null;
    status = null;
  }

  async function deleteNow(): Promise<void> {
    if (!deleting || busy) return;
    const cycle = deleting;
    busy = true;
    try {
      await app.deletePeriodRange(cycle.start);
      deleting = null;
      status = COPY.history.deleted;
    } catch (cause) {
      deleting = null;
      fail(cause);
    } finally {
      busy = false;
    }
  }
</script>

<header class="topbar page-head">
  <button class="icon-btn" aria-label={COPY.common.back} onclick={onBack}>
    <Icon name="back" />
  </button>
  <h1 class="page-title">{COPY.history.title}</h1>
  {#if history.length > 0 || addOpen}
    <button class="secondary add-toggle" onclick={toggleAdd}>
      {addOpen ? COPY.common.cancel : COPY.history.addShort}
    </button>
  {/if}
</header>

{#if status}
  <p class="status" role="status">{status}</p>
{/if}
{#if error}
  <p class="error" role="alert">{error}</p>
{/if}

{#if addOpen}
  <section class="form-card" aria-labelledby="add-title">
    <h2 id="add-title" class="form-title">{COPY.history.addTitle}</h2>
    <div class="form-grid">
      <label class="field">
        <span>{COPY.history.start}</span>
        <input
          bind:this={addStartInput}
          bind:value={addStart}
          type="date"
          max={app.today}
          onchange={onAddStart}
        />
      </label>
      <label class="field">
        <span>{COPY.history.end}</span>
        <input bind:value={addEnd} type="date" max={app.today} />
      </label>
    </div>
    {#if addError}
      <p class="form-error" role="alert">{addError}</p>
    {/if}
    <div class="form-actions">
      <button class="primary form-save" disabled={busy} onclick={saveAdd}>
        {COPY.history.save}
      </button>
      <button class="secondary" onclick={cancelAdd}>{COPY.common.cancel}</button>
    </div>
  </section>
{/if}

{#if history.length === 0}
  {#if !addOpen}
    <div class="empty">
      <p>{COPY.history.empty}</p>
      <button class="secondary" onclick={toggleAdd}>{COPY.history.add}</button>
    </div>
  {/if}
{:else}
  <p class="summary">
    {#if average !== null}
      <strong>{COPY.history.average(average)}</strong>
      {#if low !== null && high !== null && low !== high}
        <span class="dot">·</span>
        {COPY.history.range(low, high)}
      {/if}
      <span class="dot">·</span>
      {COPY.history.count(lengths.length)}
    {:else}
      {COPY.history.needAverage}
    {/if}
  </p>

  <div class="list-head">
    <span>{COPY.history.columns.cycle}</span>
    <span>{COPY.history.columns.period}</span>
  </div>

  <div class="list">
    {#each history as cycle (cycle.start)}
      <div class="cycle-row">
        <div class="cycle">
          <div class="main">
            <p class="dates">
              {#if cycle.end}
                {formatRange(cycle.start, cycle.end)}
              {:else if cycle.current}
                {COPY.history.from(formatDay(cycle.start))} · {COPY.history.ongoing}
              {:else}
                {COPY.history.from(formatDay(cycle.start))} · {COPY.history.noEnd}
              {/if}
            </p>
            <p class="meta">
              {#if cycle.current}
                {COPY.history.current}
              {:else if cycle.cycleLength}
                {COPY.history.cycleLength(cycle.cycleLength)}
              {:else}
                —
              {/if}
            </p>
          </div>
          <p class="period">
            {cycle.periodLength ? COPY.history.periodLength(cycle.periodLength) : '—'}
          </p>
          <div class="row-actions">
            <button
              class="icon-btn"
              aria-label={COPY.history.editAria(cycleLabel(cycle))}
              onclick={() => startEdit(cycle)}
            >
              <Icon name="pencil" size={18} />
            </button>
            <button
              class="icon-btn"
              aria-label={COPY.history.deleteAria(cycleLabel(cycle))}
              onclick={() => askDelete(cycle)}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        </div>

        {#if editingStart === cycle.start}
          <div class="edit-form">
            <div class="form-grid">
              <label class="field">
                <span>{COPY.history.start}</span>
                <input bind:value={editStart} type="date" max={app.today} />
              </label>
              <label class="field">
                <span>{COPY.history.end}</span>
                <input bind:value={editEnd} type="date" max={app.today} />
              </label>
            </div>
            {#if cycle.current}
              <p class="form-hint">{COPY.history.endHint}</p>
            {/if}
            {#if editError}
              <p class="form-error" role="alert">{editError}</p>
            {/if}
            <div class="form-actions">
              <button class="primary form-save" disabled={busy} onclick={() => saveEdit(cycle)}>
                {COPY.history.save}
              </button>
              <button class="secondary" onclick={cancelEdit}>{COPY.common.cancel}</button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <p class="note">{COPY.history.note}</p>
{/if}

<ConfirmDialog
  open={Boolean(deleting)}
  title={COPY.history.deleteTitle}
  message={COPY.history.deleteMessage}
  confirmLabel={COPY.history.deleteConfirm}
  onConfirm={deleteNow}
  onCancel={() => (deleting = null)}
/>

<style>
  .page-head {
    justify-content: flex-start;
    gap: 0;
  }

  .add-toggle {
    margin-left: auto;
    min-width: 44px;
    padding: 0 12px;
    font-size: 14px;
  }

  .status,
  .error {
    margin: 10px 0 0;
    font-size: 14px;
  }

  .status {
    color: var(--muted);
  }

  .error,
  .form-error {
    color: var(--danger);
  }

  .form-card,
  .edit-form {
    margin-top: 14px;
    padding: 14px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .form-title {
    margin: 0 0 10px;
    font-size: 16px;
    font-weight: 600;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
    color: var(--muted);
    font-size: 13px;
  }

  .field input {
    width: 100%;
  }

  .form-hint {
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 12.5px;
  }

  .form-error {
    margin: 8px 0 0;
    font-size: 13px;
  }

  .form-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
  }

  .form-save {
    width: auto;
    min-width: 44px;
    padding: 0 16px;
  }

  .summary {
    margin: 14px 0 20px;
    color: var(--muted);
    font-size: 14px;
  }

  .summary strong {
    color: var(--ink);
    font-weight: 600;
  }

  .dot {
    padding: 0 2px;
  }

  .list-head {
    display: flex;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .cycle-row {
    border-bottom: 1px solid var(--line);
  }

  .cycle {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
  }

  .dates {
    margin: 0;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }

  .meta {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 13px;
  }

  .period {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }

  .row-actions {
    display: flex;
    gap: 0;
  }

  .row-actions .icon-btn {
    width: 44px;
    height: 44px;
    flex-basis: 44px;
  }

  .edit-form {
    margin: 0 0 12px;
    background: var(--bg);
  }

  .empty {
    margin-top: 24px;
  }

  .empty p {
    margin: 0 0 12px;
    color: var(--muted);
    font-size: 15px;
  }

  .note {
    margin: 18px 0 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.5;
  }
</style>
