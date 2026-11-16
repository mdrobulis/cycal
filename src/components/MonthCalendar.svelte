<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Calendar } from 'bits-ui';
  import {
    getLocalTimeZone,
    parseDate,
    today as adtToday,
    type DateValue,
  } from '@internationalized/date';
  import { formatDay, formatRange, isDayKey, rangeSet } from '../lib/date';
  import { EVENT_ICON, EVENT_ORDER, type UserEventKind } from '../lib/icon-names';
  import { recordedPeriodDays } from '../lib/periods';
  import { app } from '../lib/store.svelte';
  import { COPY, ltCount } from '../lib/strings';
  import type { CycleStats, DayEvent, DayKey } from '../lib/types';
  import Icon from './Icon.svelte';

  let {
    events,
    stats,
    today,
    selectedDay,
    onSelectDay,
    onClearSelection,
  }: {
    events: DayEvent[];
    stats: CycleStats;
    today: DayKey;
    selectedDay: DayKey | null;
    onSelectDay: (day: DayKey) => void;
    onClearSelection: () => void;
  } = $props();

  const byDay = $derived.by(() => {
    const map = new Map<DayKey, DayEvent[]>();
    for (const event of events) {
      const list = map.get(event.date);
      if (list) list.push(event);
      else map.set(event.date, [event]);
    }
    return map;
  });

  const recorded = $derived(recordedPeriodDays(events));
  const predicted = $derived(stats.predictedPeriodDays);
  const fertile = $derived(rangeSet(stats.fertileRange));

  const value = $derived(selectedDay ? parseDate(selectedDay) : undefined);
  // The view starts on today's month; later navigation is owned by the calendar.
  // svelte-ignore state_referenced_locally
  let placeholder = $state<DateValue>(parseDate(today));

  const visiblePrefix = $derived(
    `${placeholder.year}-${String(placeholder.month).padStart(2, '0')}`,
  );

  const hasRecorded = $derived([...recorded].some((day) => day.startsWith(visiblePrefix)));
  const hasPredicted = $derived([...predicted].some((day) => day.startsWith(visiblePrefix)));
  const hasFertile = $derived([...fertile].some((day) => day.startsWith(visiblePrefix)));
  const hasOvulation = $derived(Boolean(stats.ovulation?.startsWith(visiblePrefix)));
  const legendKinds = $derived.by(() => {
    const found = new Set<UserEventKind>();
    for (const [day, list] of byDay) {
      if (!day.startsWith(visiblePrefix)) continue;
      for (const event of list) {
        if (event.kind in EVENT_ICON) found.add(event.kind as UserEventKind);
      }
    }
    return EVENT_ORDER.filter((kind) => found.has(kind));
  });
  const showLegend = $derived(
    hasRecorded || hasPredicted || hasFertile || hasOvulation || legendKinds.length > 0,
  );

  let calendarEl = $state<HTMLElement>();
  let rangeMode = $state(false);
  let rangeStart = $state<DayKey | null>(null);
  let rangeEnd = $state<DayKey | null>(null);
  let rangeError = $state<string | null>(null);
  let rangeStatus = $state<string | null>(null);
  let dragStart = $state<DayKey | null>(null);
  let dragCurrent = $state<DayKey | null>(null);
  let dragging = false;
  let dragMoved = false;
  let suppressClick = false;
  let pointerCaptured = false;
  let activePointerId: number | null = null;
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  const rangePreview = $derived.by(() => {
    const anchor = dragStart ?? rangeStart;
    if (!anchor) return null;
    const other = dragCurrent ?? rangeEnd ?? anchor;
    return anchor <= other ? { from: anchor, to: other } : { from: other, to: anchor };
  });

  const rangeHint = $derived(
    rangeStart ? COPY.range.end(formatDay(rangeStart)) : COPY.range.start,
  );

  onDestroy(() => {
    if (statusTimer) clearTimeout(statusTimer);
  });

  $effect(() => {
    const element = calendarEl;
    if (!element) return;
    const swallow = (event: MouseEvent) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    };
    element.addEventListener('click', swallow, true);
    return () => element.removeEventListener('click', swallow, true);
  });

  $effect(() => {
    const element = calendarEl;
    if (!element) return;
    const down = (event: PointerEvent) => onPointerDown(event);
    const move = (event: PointerEvent) => onPointerMove(event);
    const up = (event: PointerEvent) => onPointerUp(event);
    const cancel = () => onPointerCancel();
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', cancel);
    return () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', cancel);
    };
  });

  function handleValueChange(next: DateValue | DateValue[] | undefined): void {
    if (Array.isArray(next) || !next) return;
    if (rangeMode) {
      selectRangeDay(next.toString());
      return;
    }
    onSelectDay(next.toString());
  }

  function enterRange(): void {
    rangeMode = true;
    rangeStart = null;
    rangeEnd = null;
    rangeError = null;
    rangeStatus = null;
    dragStart = null;
    dragCurrent = null;
    dragging = false;
    onClearSelection();
  }

  function exitRange(): void {
    rangeMode = false;
    rangeStart = null;
    rangeEnd = null;
    rangeError = null;
    dragStart = null;
    dragCurrent = null;
    dragging = false;
  }

  function showRangeStatus(text: string): void {
    rangeStatus = text;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      rangeStatus = null;
      statusTimer = undefined;
    }, 6000);
  }

  function selectRangeDay(day: DayKey): void {
    if (day > today) {
      rangeError = COPY.errors.futureStart;
      return;
    }
    rangeError = null;
    if (!rangeStart) {
      rangeStart = day;
      rangeEnd = null;
      return;
    }
    const from = rangeStart <= day ? rangeStart : day;
    const to = rangeStart <= day ? day : rangeStart;
    rangeStart = from;
    rangeEnd = to;
    void commitRange(from, to);
  }

  async function commitRange(from: DayKey, to: DayKey): Promise<void> {
    if (to > today) {
      rangeError = COPY.errors.futureEnd;
      rangeEnd = null;
      return;
    }
    rangeError = null;
    try {
      await app.addPeriodRange(from, to);
      rangeMode = false;
      rangeStart = null;
      rangeEnd = null;
      dragStart = null;
      dragCurrent = null;
      showRangeStatus(COPY.range.saved(formatRange(from, to)));
    } catch (cause) {
      rangeError = cause instanceof Error ? cause.message : COPY.errors.save;
      rangeStart = from;
      rangeEnd = null;
      dragStart = null;
      dragCurrent = null;
    }
  }

  function dayFromTarget(target: EventTarget | null): DayKey | null {
    if (!(target instanceof Element)) return null;
    const cell = target.closest<HTMLElement>('.cal-day[data-value]');
    const value = cell?.dataset.value;
    return value && isDayKey(value) ? value : null;
  }

  function dayFromPoint(x: number, y: number): DayKey | null {
    const element = document.elementFromPoint(x, y);
    if (!(element instanceof Element) || !calendarEl?.contains(element)) return null;
    return dayFromTarget(element);
  }

  function onPointerDown(event: PointerEvent): void {
    if (!rangeMode) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const day = dayFromTarget(event.target);
    if (!day) return;
    if (day > today) {
      rangeError = COPY.errors.futureStart;
      return;
    }
    rangeError = null;
    dragStart = day;
    dragCurrent = day;
    dragging = true;
    dragMoved = false;
    pointerCaptured = false;
    activePointerId = event.pointerId;
  }

  function onPointerMove(event: PointerEvent): void {
    if (!rangeMode || !dragging) return;
    const day = dayFromPoint(event.clientX, event.clientY);
    if (!day) return;
    if (day > today) return;
    if (!pointerCaptured) {
      try {
        calendarEl?.setPointerCapture(event.pointerId);
        pointerCaptured = true;
      } catch {
        // Pointer capture is optional; pointermove still reaches the section.
      }
    }
    if (day !== dragStart) dragMoved = true;
    dragCurrent = day;
  }

  function onPointerUp(event: PointerEvent): void {
    if (!rangeMode || !dragging) return;
    const moved = dragMoved;
    const from = dragStart;
    const to = dragCurrent;
    dragging = false;
    dragStart = null;
    dragCurrent = null;
    if (pointerCaptured && activePointerId !== null) {
      try {
        if (calendarEl?.hasPointerCapture(activePointerId)) {
          calendarEl.releasePointerCapture(activePointerId);
        }
      } catch {
        // Capture can be lost when the pointer leaves the document.
      }
    }
    pointerCaptured = false;
    activePointerId = null;
    if (!moved || !from || !to) return;
    const start = from <= to ? from : to;
    const end = from <= to ? to : from;
    rangeStart = start;
    rangeEnd = end;
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 500);
    void commitRange(start, end);
  }

  function onPointerCancel(): void {
    if (pointerCaptured && activePointerId !== null) {
      try {
        if (calendarEl?.hasPointerCapture(activePointerId)) {
          calendarEl.releasePointerCapture(activePointerId);
        }
      } catch {
        // Capture can be lost when the pointer leaves the document.
      }
    }
    dragging = false;
    dragStart = null;
    dragCurrent = null;
    pointerCaptured = false;
    activePointerId = null;
  }

  function eventKinds(day: DayKey): UserEventKind[] {
    const list = byDay.get(day);
    if (!list) return [];
    const found = new Set<UserEventKind>();
    for (const event of list) {
      if (event.kind in EVENT_ICON) found.add(event.kind as UserEventKind);
    }
    return EVENT_ORDER.filter((kind) => found.has(kind));
  }

  function eventCount(day: DayKey): number {
    const list = byDay.get(day);
    if (!list) return 0;
    return list.filter(
      (event) =>
        event.kind !== 'period-start' &&
        event.kind !== 'period-day' &&
        event.kind !== 'period-end',
    ).length;
  }

  function cellClass(day: DayKey): string {
    const classes = ['cal-cell'];
    if (recorded.has(day)) classes.push('is-period');
    else if (predicted.has(day)) classes.push('is-predicted');
    if (fertile.has(day) && !recorded.has(day)) classes.push('is-fertile');
    if (stats.ovulation === day) classes.push('is-ovulation');
    if (rangeMode && rangePreview) {
      if (day >= rangePreview.from && day <= rangePreview.to) classes.push('is-range-in');
      if (day === rangePreview.from) classes.push('is-range-start');
      if (day === rangePreview.to) classes.push('is-range-end');
    }
    return classes.join(' ');
  }

  function shiftMonth(delta: number): void {
    placeholder = placeholder.add({ months: delta });
  }

  function goToday(): void {
    placeholder = adtToday(getLocalTimeZone());
  }
</script>

<section
  class="calendar"
  class:range-mode={rangeMode}
  bind:this={calendarEl}
  aria-label={COPY.calendar.sectionAria}
>
  <Calendar.Root
    type="single"
    {value}
    onValueChange={handleValueChange}
    bind:placeholder
    weekStartsOn={1}
    weekdayFormat="short"
    fixedWeeks
    locale="lt-LT"
    calendarLabel={COPY.calendar.label}
    initialFocus={false}
  >
    {#snippet children({ months, weekdays })}
      <Calendar.Header class="cal-head">
        <button
          class="icon-btn"
          aria-label={COPY.calendar.prev}
          onclick={() => shiftMonth(-1)}
        >
          <Icon name="chevron-left" />
        </button>
        <Calendar.MonthSelect aria-label={COPY.calendar.month} />
        <Calendar.YearSelect aria-label={COPY.calendar.year} />
        <button
          class="icon-btn"
          aria-label={COPY.calendar.next}
          onclick={() => shiftMonth(1)}
        >
          <Icon name="chevron-right" />
        </button>
        <button class="icon-btn" aria-label={COPY.calendar.today} onclick={goToday}>
          <Icon name="calendar" />
        </button>
      </Calendar.Header>

      {#if rangeMode}
        <div class="range-bar">
          <p class="range-hint" role="status" aria-live="polite">{rangeHint}</p>
          <button class="link-button" onclick={exitRange}>{COPY.common.cancel}</button>
        </div>
        {#if rangeError}
          <p class="range-error" role="alert">{rangeError}</p>
        {/if}
      {:else}
        <div class="range-entry">
          <button class="link-button" onclick={enterRange}>{COPY.range.action}</button>
        </div>
      {/if}

      {#each months as month (month.value.toString())}
        <Calendar.Grid class="cal-grid">
          <Calendar.GridHead>
            <Calendar.GridRow>
              {#each weekdays as weekday (weekday)}
                <Calendar.HeadCell class="cal-weekday">{weekday}</Calendar.HeadCell>
              {/each}
            </Calendar.GridRow>
          </Calendar.GridHead>
          <Calendar.GridBody>
            {#each month.weeks as week, weekIndex (weekIndex)}
              <Calendar.GridRow>
                {#each week as date (date.toString())}
                  {@const key = date.toString()}
                  {@const kinds = eventKinds(key)}
                  {@const visibleKinds = kinds.slice(0, 3)}
                  {@const overflow = kinds.length > visibleKinds.length}
                  {@const count = eventCount(key)}
                  <Calendar.Cell {date} month={month.value} class={cellClass(key)}>
                    <Calendar.Day class="cal-day">
                      <span class="num">{date.day}</span>
                      {#if visibleKinds.length > 0}
                        <span class="event-icons" aria-hidden="true">
                          {#each visibleKinds as kind (kind)}
                            <Icon name={EVENT_ICON[kind]} size={11} strokeWidth={2.1} />
                          {/each}
                          {#if overflow}<i class="more"></i>{/if}
                        </span>
                      {/if}
                      {#if count > 0}
                        <span class="sr-only">{ltCount(count, 'įrašas', 'įrašai', 'įrašų')}</span>
                      {/if}
                    </Calendar.Day>
                  </Calendar.Cell>
                {/each}
              </Calendar.GridRow>
            {/each}
          </Calendar.GridBody>
        </Calendar.Grid>
      {/each}
    {/snippet}
  </Calendar.Root>

  {#if rangeStatus}
    <p class="range-status" role="status">{rangeStatus}</p>
  {/if}

  {#if showLegend}
    <div class="cal-legend" aria-label={COPY.calendar.legendAria}>
      {#if hasRecorded}
        <span class="legend-item"><i class="swatch period"></i>{COPY.calendar.legend.period}</span>
      {/if}
      {#if hasPredicted}
        <span class="legend-item"><i class="swatch predicted"></i>{COPY.calendar.legend.predicted}</span>
      {/if}
      {#if hasFertile}
        <span class="legend-item"><i class="swatch fertile"></i>{COPY.calendar.legend.fertile}</span>
      {/if}
      {#if hasOvulation}
        <span class="legend-item"><i class="swatch ovulation"></i>{COPY.calendar.legend.ovulation}</span>
      {/if}
      {#each legendKinds as kind (kind)}
        <span class="legend-item">
          <Icon name={EVENT_ICON[kind]} size={14} />
          {COPY.sheet[kind]}
        </span>
      {/each}
    </div>
  {/if}
</section>
