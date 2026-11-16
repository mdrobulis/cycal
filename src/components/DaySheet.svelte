<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../lib/store.svelte';
  import { formatLongDay } from '../lib/date';
  import {
    FLOWS,
    MOODS,
    SEVERITIES,
    SYMPTOMS,
    eventDetail,
    eventLabel,
  } from '../lib/vocab';
  import type { DayKey, Severity } from '../lib/types';
  import Icon from './Icon.svelte';

  let { date, onClose }: { date: DayKey; onClose: () => void } = $props();

  let dialog = $state<HTMLDialogElement>();
  let panel = $state<null | 'symptom' | 'symptomOther' | 'mood' | 'flow' | 'note' | 'custom'>(
    null,
  );
  let note = $state('');
  let customText = $state('');
  let symptomText = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);
  let noteInput = $state<HTMLTextAreaElement>();
  let customInput = $state<HTMLInputElement>();
  let symptomInput = $state<HTMLInputElement>();

  const events = $derived(app.eventsForDay(date));
  const active = $derived(app.activePeriod);
  const hasStart = $derived(app.hasEvent(date, 'period-start'));
  const covers = $derived(app.coversPeriod(date));
  const canBleed = $derived(Boolean(active && date >= active.start && date <= app.today));
  const future = $derived(date > app.today);
  const intimacy = $derived(events.some((event) => event.kind === 'intimacy'));
  const currentMood = $derived(events.find((event) => event.kind === 'mood'));
  const currentFlow = $derived(events.find((event) => event.kind === 'flow'));

  onMount(() => {
    if (dialog && !dialog.open) dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  });

  $effect(() => {
    if (panel === 'note') noteInput?.focus();
    else if (panel === 'custom') customInput?.focus();
    else if (panel === 'symptomOther') symptomInput?.focus();
  });

  function close(): void {
    dialog?.close();
  }

  async function run(task: () => Promise<unknown>): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    try {
      await task();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Could not save that.';
    } finally {
      busy = false;
    }
  }

  function togglePanel(next: typeof panel): void {
    error = null;
    panel = panel === next ? null : next;
  }

  function addSymptom(label: string): void {
    void run(async () => {
      await app.addSymptom(date, label);
      panel = null;
    });
  }

  function saveSymptomOther(): void {
    const value = symptomText;
    void run(async () => {
      await app.addSymptom(date, value);
      symptomText = '';
      panel = null;
    });
  }

  function chooseMood(value: number): void {
    void run(async () => {
      await app.setMood(date, value);
      panel = null;
    });
  }

  function chooseFlow(value: 'light' | 'medium' | 'heavy'): void {
    void run(async () => {
      await app.setFlow(date, value);
      panel = null;
    });
  }

  function saveNote(): void {
    const value = note;
    void run(async () => {
      await app.addNote(date, value);
      note = '';
      panel = null;
    });
  }

  function saveCustom(): void {
    const value = customText;
    void run(async () => {
      await app.addCustom(date, value);
      customText = '';
      panel = null;
    });
  }

  function setSeverity(eventId: string, severity: Severity): void {
    const event = events.find((candidate) => candidate.id === eventId);
    if (event) void run(() => app.updateSeverity(event, severity));
  }
</script>

<dialog
  class="sheet"
  bind:this={dialog}
  onclose={onClose}
  onclick={(event) => {
    if (event.target === dialog) close();
  }}
  aria-labelledby="day-title"
>
  <div class="sheet-head">
    <h2 id="day-title" class="sheet-title">{formatLongDay(date)}</h2>
    <button class="icon-btn" aria-label="Close" onclick={close}>
      <Icon name="close" />
    </button>
  </div>

  <div class="sheet-body">
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    {#if future}
      <p class="future-note">
        Notes and symptoms can be added here. Period events can't be logged in the future.
      </p>
    {/if}

    {#if !future && (!hasStart || canBleed)}
      <div class="period-row">
        {#if !hasStart && !canBleed}
          <button class="chip" onclick={() => run(() => app.markPeriodStart(date))}>
            Period started
          </button>
        {/if}
        {#if canBleed}
          <button class="chip" onclick={() => run(() => app.addPeriodDay(date))}>
            Still bleeding
          </button>
          <button class="chip" onclick={() => run(() => app.markPeriodEnd(date))}>
            Period ended
          </button>
        {/if}
      </div>
    {/if}

    {#if events.length === 0}
      <p class="empty">Nothing logged on this day.</p>
    {:else}
      {#each events as event (event.id)}
        {@const detail = eventDetail(event)}
        <div class="event">
          <div class="event-main">
            <p class="event-label">{eventLabel(event)}</p>
            {#if detail}
              <p class="event-detail">{detail}</p>
            {/if}
          </div>
          <button
            class="icon-btn"
            aria-label={`Delete ${eventLabel(event)}`}
            onclick={() => run(() => app.removeEvent(event.id))}
          >
            <Icon name="trash" size={18} />
          </button>
        </div>
        {#if event.kind === 'symptom'}
          <div class="severity" role="group" aria-label={`Severity for ${eventLabel(event)}`}>
            {#each SEVERITIES as option (option.value)}
              <button
                class:on={event.severity === option.value}
                aria-pressed={event.severity === option.value}
                onclick={() => setSeverity(event.id, option.value)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        {/if}
      {/each}
    {/if}

    {#if app.undo}
      <div class="undo-row">
        <span>{app.undo.message}</span>
        <button onclick={() => app.undoLast()}>Undo</button>
      </div>
    {/if}

    <div class="section">
      <p class="section-title">Add</p>
      <div class="add-grid">
        <button class="add" onclick={() => togglePanel('symptom')}>Symptom</button>
        <button class="add" onclick={() => togglePanel('mood')}>Mood</button>
        {#if covers}
          <button class="add" onclick={() => togglePanel('flow')}>Flow</button>
        {/if}
        <button
          class="add"
          class:on={intimacy}
          aria-pressed={intimacy}
          onclick={() => run(() => app.toggleIntimacy(date))}
        >
          {#if intimacy}<Icon name="check" size={14} />{/if}
          Intimacy
        </button>
        <button class="add" onclick={() => togglePanel('note')}>Note</button>
        <button class="add" onclick={() => togglePanel('custom')}>Custom</button>
      </div>

      {#if panel === 'symptom'}
        <div class="panel">
          <p class="panel-title">Symptom</p>
          <div class="chips">
            {#each SYMPTOMS as symptom (symptom)}
              <button class="chip" onclick={() => addSymptom(symptom)}>{symptom}</button>
            {/each}
            <button class="chip" onclick={() => (panel = 'symptomOther')}>Other…</button>
          </div>
        </div>
      {:else if panel === 'symptomOther'}
        <div class="panel">
          <label class="field-label" for="symptom-text">Symptom</label>
          <input
            id="symptom-text"
            bind:this={symptomInput}
            bind:value={symptomText}
            placeholder="Name it"
          />
          <button class="secondary" onclick={saveSymptomOther}>Add symptom</button>
        </div>
      {:else if panel === 'mood'}
        <div class="panel">
          <p class="panel-title">Mood</p>
          <div class="chips">
            {#each MOODS as mood, index (mood)}
              <button
                class="chip"
                class:on={currentMood?.value === index + 1}
                onclick={() => chooseMood(index + 1)}
              >
                {mood}
              </button>
            {/each}
          </div>
        </div>
      {:else if panel === 'flow'}
        <div class="panel">
          <p class="panel-title">Flow</p>
          <div class="chips">
            {#each FLOWS as flow (flow.value)}
              <button
                class="chip"
                class:on={currentFlow?.value === flow.value}
                onclick={() => chooseFlow(flow.value)}
              >
                {flow.label}
              </button>
            {/each}
          </div>
        </div>
      {:else if panel === 'note'}
        <div class="panel">
          <label class="field-label" for="note-text">Note</label>
          <textarea
            id="note-text"
            bind:this={noteInput}
            bind:value={note}
            placeholder="Anything you want to remember"
          ></textarea>
          <button class="secondary" onclick={saveNote}>Add note</button>
        </div>
      {:else if panel === 'custom'}
        <div class="panel">
          <label class="field-label" for="custom-text">Custom event</label>
          <input
            id="custom-text"
            bind:this={customInput}
            bind:value={customText}
            placeholder="e.g. Started a new pack"
          />
          <button class="secondary" onclick={saveCustom}>Add event</button>
        </div>
      {/if}
    </div>
  </div>

  <div class="sheet-foot">
    <button class="primary" onclick={close}>Done</button>
  </div>
</dialog>

<style>
  .period-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .chip {
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    font-size: 14px;
  }

  .chip.on {
    background: var(--accent-soft);
    border-color: var(--accent);
  }

  .event {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 0;
    border-bottom: 1px solid var(--line);
  }

  .event:last-of-type {
    border-bottom: 0;
  }

  .event-label {
    margin: 0;
    font-size: 15px;
  }

  .event-detail {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 13px;
    white-space: pre-wrap;
  }

  .severity {
    display: flex;
    gap: 6px;
    margin: 0 0 8px;
  }

  .severity button {
    min-height: 40px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 10px;
    font-size: 12px;
  }

  .severity button.on {
    background: var(--accent-soft);
    border-color: var(--accent);
  }

  .empty {
    margin: 8px 0 14px;
    color: var(--muted);
    font-size: 14px;
  }

  .section {
    margin-top: 18px;
  }

  .section-title {
    margin: 0 0 8px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }

  .add-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 44px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    font-size: 14px;
  }

  .add.on {
    background: var(--accent-soft);
    border-color: var(--accent);
  }

  .panel {
    margin-top: 10px;
    padding: 12px;
    border-radius: var(--radius);
    background: var(--bg);
  }

  .panel-title {
    margin: 0 0 8px;
    color: var(--muted);
    font-size: 13px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .field-label {
    display: block;
    margin-bottom: 6px;
    color: var(--muted);
    font-size: 13px;
  }

  .panel textarea,
  .panel input {
    width: 100%;
  }

  .panel .secondary {
    width: 100%;
    margin-top: 8px;
  }

  .error {
    margin: 0 0 10px;
    color: var(--danger);
    font-size: 14px;
  }

  .future-note {
    margin: 10px 0;
    color: var(--muted);
    font-size: 13px;
  }
</style>
