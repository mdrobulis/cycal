<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '../lib/store.svelte';
  import { formatLongDay, weekdayName } from '../lib/date';
  import { eventIcon } from '../lib/icon-names';
  import {
    MOODS,
    SEVERITIES,
    SYMPTOMS,
    eventDetail,
    eventLabel,
  } from '../lib/vocab';
  import { COPY } from '../lib/strings';
  import type { DayEvent, DayKey, Severity } from '../lib/types';
  import BleedingControl from './BleedingControl.svelte';
  import Icon from './Icon.svelte';

  let { date, onClose }: { date: DayKey; onClose: () => void } = $props();

  let panel = $state<HTMLElement>();
  let panelOpen = $state<null | 'symptom' | 'symptomOther' | 'mood' | 'note' | 'custom'>(
    null,
  );
  let note = $state('');
  let customText = $state('');
  let symptomText = $state('');
  let editingId = $state<string | null>(null);
  let editDraft = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);
  let noteInput = $state<HTMLTextAreaElement>();
  let customInput = $state<HTMLInputElement>();
  let symptomInput = $state<HTMLInputElement>();
  let editInput = $state<HTMLTextAreaElement | HTMLInputElement>();

  const events = $derived(app.eventsForDay(date));
  const visibleEvents = $derived(events.filter((event) => event.kind !== 'period-day'));
  const active = $derived(app.activePeriod);
  const hasStart = $derived(app.hasEvent(date, 'period-start'));
  const covers = $derived(app.coversPeriod(date));
  const canBleed = $derived(Boolean(active && date >= active.start && date <= app.today));
  const future = $derived(date > app.today);
  const intimacy = $derived(events.some((event) => event.kind === 'intimacy'));
  const currentMood = $derived(events.find((event) => event.kind === 'mood'));
  const currentFlow = $derived(app.flowForDay(date));
  const canMarkBleeding = $derived(!future && (canBleed || covers));

  onMount(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel?.focus({ preventScroll: true });
    panel?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  });

  $effect(() => {
    if (panelOpen === 'note') noteInput?.focus();
    else if (panelOpen === 'custom') customInput?.focus();
    else if (panelOpen === 'symptomOther') symptomInput?.focus();
  });

  $effect(() => {
    if (editingId) editInput?.focus();
  });

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  }

  function close(): void {
    onClose();
  }

  async function run(task: () => Promise<unknown>): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    try {
      await task();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : COPY.sheet.saveError;
    } finally {
      busy = false;
    }
  }

  function togglePanel(next: typeof panelOpen): void {
    error = null;
    panelOpen = panelOpen === next ? null : next;
  }

  function addSymptom(label: string): void {
    void run(async () => {
      await app.addSymptom(date, label);
      panelOpen = null;
    });
  }

  function saveSymptomOther(): void {
    const value = symptomText;
    void run(async () => {
      await app.addSymptom(date, value);
      symptomText = '';
      panelOpen = null;
    });
  }

  function chooseMood(value: number): void {
    void run(async () => {
      await app.setMood(date, value);
      panelOpen = null;
    });
  }

  function saveNote(): void {
    const value = note;
    void run(async () => {
      await app.addNote(date, value);
      note = '';
      panelOpen = null;
    });
  }

  function saveCustom(): void {
    const value = customText;
    void run(async () => {
      await app.addCustom(date, value);
      customText = '';
      panelOpen = null;
    });
  }

  function setSeverity(eventId: string, severity: Severity): void {
    const event = events.find((candidate) => candidate.id === eventId);
    if (event) void run(() => app.updateSeverity(event, severity));
  }

  function startEdit(event: DayEvent): void {
    error = null;
    editingId = event.id;
    editDraft = event.kind === 'note' ? event.note ?? '' : event.label ?? '';
  }

  function cancelEdit(): void {
    editingId = null;
    editDraft = '';
    error = null;
  }

  function saveEdit(event: DayEvent): void {
    const value = editDraft.trim();
    if (!value) {
      error = event.kind === 'note' ? COPY.errors.writeText : COPY.errors.nameEvent;
      return;
    }
    void run(async () => {
      if (event.kind === 'note') {
        await app.updateEvent({ ...event, note: value });
      } else if (event.kind === 'custom') {
        await app.updateEvent({ ...event, label: value });
      }
      editingId = null;
      editDraft = '';
    });
  }
</script>

<svelte:window onkeydown={onKeydown} />

<section
  class="day-panel"
  bind:this={panel}
  aria-labelledby="day-panel-title"
  tabindex="-1"
>
  <div class="panel-head">
    <div>
      <h2 id="day-panel-title" class="panel-title">{formatLongDay(date)}</h2>
      <p class="weekday">{weekdayName(date)}</p>
    </div>
    <button class="icon-btn" aria-label={COPY.common.close} onclick={close}>
      <Icon name="close" />
    </button>
  </div>

  <div class="panel-body">
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    {#if future}
      <p class="future-note">{COPY.sheet.futureNote}</p>
    {/if}

    {#if canMarkBleeding}
      <div class="bleeding">
        <p class="bleeding-title">{COPY.sheet.flow}</p>
        <BleedingControl
          value={currentFlow}
          onChange={(value) => run(() => app.markBleeding(date, value))}
        />
      </div>
    {/if}

    {#if !future && ((!hasStart && !covers && !canBleed) || canBleed)}
      <div class="period-row">
        {#if !hasStart && !covers && !canBleed}
          <button class="chip" onclick={() => run(() => app.markPeriodStart(date))}>
            {COPY.period.started}
          </button>
        {/if}
        {#if canBleed}
          <button class="chip" onclick={() => run(() => app.markPeriodEnd(date))}>
            {COPY.period.finished}
          </button>
        {/if}
      </div>
    {/if}

    {#if visibleEvents.length === 0}
      <p class="empty">{COPY.sheet.empty}</p>
    {:else}
      {#each visibleEvents as event (event.id)}
        {@const detail = eventDetail(event)}
        {@const icon = eventIcon(event.kind)}
        <div class="event">
          <div class="event-main">
            <p class="event-label">
              {#if icon}<Icon name={icon} size={16} />{/if}
              <span>{eventLabel(event)}</span>
            </p>
            {#if detail}
              <p class="event-detail">{detail}</p>
            {/if}
          </div>
          <div class="event-actions">
            {#if event.kind === 'note' || event.kind === 'custom'}
              <button
                class="icon-btn"
                aria-label={COPY.sheet.editAria(eventLabel(event))}
                onclick={() => startEdit(event)}
              >
                <Icon name="pencil" size={18} />
              </button>
            {/if}
            <button
              class="icon-btn"
              aria-label={COPY.sheet.deleteAria(eventLabel(event))}
              onclick={() => run(() => app.removeEvent(event.id))}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        </div>

        {#if editingId === event.id}
          <div class="edit-box">
            {#if event.kind === 'note'}
              <label class="field-label" for="edit-text">{COPY.sheet.noteLabel}</label>
              <textarea
                id="edit-text"
                bind:this={editInput}
                bind:value={editDraft}
                placeholder={COPY.sheet.notePlaceholder}
              ></textarea>
            {:else}
              <label class="field-label" for="edit-text">{COPY.sheet.customLabel}</label>
              <input
                id="edit-text"
                bind:this={editInput}
                bind:value={editDraft}
                placeholder={COPY.sheet.customPlaceholder}
              />
            {/if}
            <div class="edit-actions">
              <button class="secondary" onclick={() => saveEdit(event)}>
                {COPY.sheet.save}
              </button>
              <button class="link-button" onclick={cancelEdit}>{COPY.common.cancel}</button>
            </div>
          </div>
        {/if}

        {#if event.kind === 'symptom'}
          <div class="severity" role="group" aria-label={COPY.sheet.severityAria(eventLabel(event))}>
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
        <button onclick={() => app.undoLast()}>{COPY.common.undo}</button>
      </div>
    {/if}

    <div class="section">
      <p class="section-title">{COPY.sheet.addTitle}</p>
      <div class="add-grid">
        <button class="add" onclick={() => togglePanel('symptom')}>{COPY.sheet.symptom}</button>
        <button class="add" onclick={() => togglePanel('mood')}>{COPY.sheet.mood}</button>
        <button
          class="add"
          class:on={intimacy}
          aria-pressed={intimacy}
          onclick={() => run(() => app.toggleIntimacy(date))}
        >
          {#if intimacy}<Icon name="check" size={14} />{/if}
          {COPY.sheet.intimacy}
        </button>
        <button class="add" onclick={() => togglePanel('note')}>{COPY.sheet.note}</button>
        <button class="add" onclick={() => togglePanel('custom')}>{COPY.sheet.custom}</button>
      </div>

      {#if panelOpen === 'symptom'}
        <div class="panel">
          <p class="panel-subtitle">{COPY.sheet.symptomLabel}</p>
          <div class="chips">
            {#each SYMPTOMS as symptom (symptom)}
              <button class="chip" onclick={() => addSymptom(symptom)}>{symptom}</button>
            {/each}
            <button class="chip" onclick={() => (panelOpen = 'symptomOther')}>
              {COPY.sheet.symptomOther}
            </button>
          </div>
        </div>
      {:else if panelOpen === 'symptomOther'}
        <div class="panel">
          <label class="field-label" for="symptom-text">{COPY.sheet.symptomLabel}</label>
          <input
            id="symptom-text"
            bind:this={symptomInput}
            bind:value={symptomText}
            placeholder={COPY.sheet.symptomPlaceholder}
          />
          <button class="secondary" onclick={saveSymptomOther}>{COPY.sheet.addSymptom}</button>
        </div>
      {:else if panelOpen === 'mood'}
        <div class="panel">
          <p class="panel-subtitle">{COPY.sheet.mood}</p>
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
      {:else if panelOpen === 'note'}
        <div class="panel">
          <label class="field-label" for="note-text">{COPY.sheet.noteLabel}</label>
          <textarea
            id="note-text"
            bind:this={noteInput}
            bind:value={note}
            placeholder={COPY.sheet.notePlaceholder}
          ></textarea>
          <button class="secondary" onclick={saveNote}>{COPY.sheet.addNote}</button>
        </div>
      {:else if panelOpen === 'custom'}
        <div class="panel">
          <label class="field-label" for="custom-text">{COPY.sheet.customLabel}</label>
          <input
            id="custom-text"
            bind:this={customInput}
            bind:value={customText}
            placeholder={COPY.sheet.customPlaceholder}
          />
          <button class="secondary" onclick={saveCustom}>{COPY.sheet.addCustom}</button>
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .day-panel {
    margin-top: 14px;
    padding: 14px 16px 18px;
    border: 1px solid var(--line-strong);
    border-radius: 16px;
    background: var(--surface);
    scroll-margin-top: calc(68px + var(--safe-top));
    scroll-margin-bottom: calc(104px + var(--safe-bottom));
  }

  .day-panel:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
  }

  .panel-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .weekday {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 13px;
  }

  .panel-body {
    min-width: 0;
  }

  .period-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .chip {
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    font-size: 15px;
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

  .event-main {
    min-width: 0;
  }

  .event-label {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0;
    font-size: 16px;
  }

  .event-label :global(svg) {
    flex: 0 0 auto;
    color: var(--muted);
  }

  .event-detail {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 14px;
    white-space: pre-wrap;
  }

  .event-actions {
    display: flex;
    flex: 0 0 auto;
    gap: 0;
  }

  .event-actions .icon-btn {
    width: 44px;
    height: 44px;
    flex-basis: 44px;
  }

  .edit-box {
    margin: 0 0 10px;
    padding: 12px;
    border-radius: var(--radius);
    background: var(--bg);
  }

  .edit-box textarea,
  .edit-box input {
    width: 100%;
  }

  .edit-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  .severity {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 8px;
  }

  .severity button {
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    font-size: 13px;
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
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    font-size: 15px;
  }

  .add.on {
    background: var(--accent-soft);
    border-color: var(--accent);
  }

  .bleeding {
    margin: 0 0 12px;
    padding: 10px 12px;
    border-radius: var(--radius);
    background: var(--bg);
  }

  .bleeding-title {
    margin: 0 0 8px;
    color: var(--muted);
    font-size: 13px;
  }

  .panel {
    margin-top: 10px;
    padding: 12px;
    border-radius: var(--radius);
    background: var(--bg);
  }

  .panel-subtitle {
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
    font-size: 14px;
  }
</style>
