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
  import { periodBlocks, periodDisplayDays } from '../lib/periods';
  import { app } from '../lib/store.svelte';
  import { COPY, ltCount } from '../lib/strings';
  import type { CycleStats, DayEvent, DayKey, PeriodBlock } from '../lib/types';
  import Icon from './Icon.svelte';

  let {
    events,
    stats,
    today,
    selectedDay,
    onSelectDay,
    onClearSelection,
    rangeMode = $bindable(false),
    rangeInitialStart = null,
    rangeInitialEnd = null,
  }: {
    events: DayEvent[];
    stats: CycleStats;
    today: DayKey;
    selectedDay: DayKey | null;
    onSelectDay: (day: DayKey) => void;
    onClearSelection: () => void;
    rangeMode?: boolean;
    rangeInitialStart?: DayKey | null;
    rangeInitialEnd?: DayKey | null;
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

  const recorded = $derived(periodDisplayDays(events, today));
  const blocks = $derived(periodBlocks(events, today));
  const startEdges = $derived.by(() => {
    const map = new Map<DayKey, PeriodBlock>();
    for (const block of blocks) map.set(block.start, block);
    return map;
  });
  const endEdges = $derived.by(() => {
    const map = new Map<DayKey, PeriodBlock>();
    for (const block of blocks) map.set(block.displayEnd, block);
    return map;
  });
  const incomplete = $derived.by(() => {
    const set = new Set<DayKey>();
    for (const day of recorded) {
      if (
        blocks.some(
          (block) => block.open && !block.active && day >= block.start && day <= block.lastConfirmed,
        )
      ) {
        set.add(day);
      }
    }
    return set;
  });
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
  let drag = $state<{
    kind:
      | 'create'
      | 'start'
      | 'end'
      | 'single'
      | 'picker-new'
      | 'picker-start'
      | 'picker-end';
    anchor: DayKey;
    current: DayKey;
    blockStart?: DayKey;
    blockEnd?: DayKey | null;
    displayEnd?: DayKey;
    open?: boolean;
    originalStart?: DayKey;
  } | null>(null);
  let pickerStart = $state<DayKey | null>(null);
  let pickerEnd = $state<DayKey | null>(null);
  let pickerOriginalStart = $state<DayKey | null>(null);
  let pickerError = $state<string | null>(null);
  let dragMoved = false;
  let suppressClick = false;
  let pointerCaptured = false;
  let activePointerId: number | null = null;
  let dragError = $state<string | null>(null);
  let dragStatus = $state<string | null>(null);
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  function normalise(a: DayKey, b: DayKey): { from: DayKey; to: DayKey } {
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }

  const dragPreview = $derived.by(() => {
    if (!drag) return null;
    const { kind, anchor, current } = drag;
    if (kind === 'create') return normalise(anchor, current);
    if (kind === 'start') {
      return normalise(current, drag.blockEnd ?? drag.displayEnd ?? current);
    }
    if (kind === 'end') {
      return normalise(drag.blockStart ?? current, current);
    }
    if (drag.open) {
      return current >= anchor
        ? normalise(anchor, current)
        : normalise(current, drag.displayEnd ?? anchor);
    }
    return normalise(anchor, current);
  });

  const pickerPreview = $derived.by(() => {
    if (!rangeMode || !pickerStart) return null;
    return pickerEnd
      ? normalise(pickerStart, pickerEnd)
      : { from: pickerStart, to: pickerStart };
  });

  onDestroy(() => {
    if (statusTimer) clearTimeout(statusTimer);
  });

  $effect(() => {
    if (!rangeMode) {
      pickerStart = null;
      pickerEnd = null;
      pickerOriginalStart = null;
      pickerError = null;
      drag = null;
      return;
    }
    pickerStart = rangeInitialStart;
    pickerEnd = rangeInitialEnd;
    pickerOriginalStart = rangeInitialStart;
    pickerError = null;
    drag = null;
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
      selectPickerDay(next.toString());
      return;
    }
    onSelectDay(next.toString());
  }

  function selectPickerDay(day: DayKey): void {
    if (day > today) {
      pickerError = COPY.errors.periodFuture;
      return;
    }
    pickerError = null;
    if (!pickerStart) {
      pickerStart = day;
      pickerEnd = null;
      return;
    }
    if (!pickerEnd) {
      const range = normalise(pickerStart, day);
      pickerStart = range.from;
      pickerEnd = range.to;
      return;
    }
    if (day < pickerStart) {
      pickerStart = day;
      pickerEnd = null;
      return;
    }
    pickerEnd = day;
  }

  async function savePicker(): Promise<void> {
    if (!pickerStart || !pickerEnd) return;
    pickerError = null;
    try {
      if (pickerOriginalStart) {
        await app.updatePeriodBounds(pickerOriginalStart, pickerStart, pickerEnd);
        showStatus(`${COPY.calendar.updated}: ${formatRange(pickerStart, pickerEnd)}`);
      } else {
        await app.addPeriodRange(pickerStart, pickerEnd);
        showStatus(`${COPY.calendar.created}: ${formatRange(pickerStart, pickerEnd)}`);
      }
      rangeMode = false;
    } catch (cause) {
      pickerError = cause instanceof Error ? cause.message : COPY.errors.save;
    }
  }

  async function savePickerOpen(): Promise<void> {
    if (!pickerStart) return;
    pickerError = null;
    try {
      if (pickerOriginalStart) {
        await app.updatePeriodBounds(pickerOriginalStart, pickerStart, null);
        showStatus(`${COPY.calendar.updated}: ${formatDay(pickerStart)}`);
      } else {
        await app.markPeriodStart(pickerStart);
        showStatus(`${COPY.calendar.created}: ${formatDay(pickerStart)}`);
      }
      rangeMode = false;
    } catch (cause) {
      pickerError = cause instanceof Error ? cause.message : COPY.errors.save;
    }
  }

  function cancelPicker(): void {
    pickerError = null;
    rangeMode = false;
  }

  function showStatus(text: string): void {
    dragStatus = text;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      dragStatus = null;
      statusTimer = undefined;
    }, 6000);
  }

  async function undoPeriod(): Promise<void> {
    await app.undoPeriodChange();
    dragStatus = null;
    dragError = null;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = undefined;
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
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const day = dayFromTarget(event.target);
    if (!day || day > today) return;

    dragError = null;
    dragMoved = false;

    if (rangeMode) {
      pickerError = null;
      const kind =
        pickerEnd && day === pickerEnd
          ? 'picker-end'
          : pickerStart && day === pickerStart
            ? 'picker-start'
            : 'picker-new';
      drag = { kind, anchor: day, current: day };
      pointerCaptured = false;
      activePointerId = event.pointerId;
      return;
    }

    const startBlock = startEdges.get(day);
    const endBlock = endEdges.get(day);

    if (startBlock && endBlock && startBlock.start === endBlock.start) {
      drag = {
        kind: 'single',
        anchor: day,
        current: day,
        blockStart: startBlock.start,
        blockEnd: startBlock.end ?? null,
        displayEnd: startBlock.displayEnd,
        open: startBlock.open,
        originalStart: startBlock.start,
      };
    } else if (startBlock) {
      drag = {
        kind: 'start',
        anchor: day,
        current: day,
        blockStart: startBlock.start,
        blockEnd: startBlock.end ?? null,
        displayEnd: startBlock.displayEnd,
        open: startBlock.open,
        originalStart: startBlock.start,
      };
    } else if (endBlock) {
      drag = {
        kind: 'end',
        anchor: day,
        current: day,
        blockStart: endBlock.start,
        blockEnd: endBlock.end ?? null,
        displayEnd: endBlock.displayEnd,
        open: endBlock.open,
        originalStart: endBlock.start,
      };
    } else if (!recorded.has(day)) {
      drag = { kind: 'create', anchor: day, current: day };
    }
    pointerCaptured = false;
    activePointerId = event.pointerId;
  }

  function onPointerMove(event: PointerEvent): void {
    if (!drag) return;
    const day = dayFromPoint(event.clientX, event.clientY);
    if (!day) return;
    if (!pointerCaptured && day !== drag.anchor) {
      try {
        calendarEl?.setPointerCapture(event.pointerId);
        pointerCaptured = true;
      } catch {
        // Pointer capture is optional; pointermove still reaches the section.
      }
    }
    if (day !== drag.anchor) {
      if (!dragMoved) onClearSelection();
      dragMoved = true;
    }
    if (day !== drag.current) drag = { ...drag, current: day };

    if (rangeMode && day <= today) {
      pickerError = null;
      if (drag.kind === 'picker-new') {
        const range = normalise(drag.anchor, day);
        pickerStart = range.from;
        pickerEnd = range.to;
      } else if (drag.kind === 'picker-start') {
        pickerStart = day;
        if (pickerEnd && day > pickerEnd) pickerEnd = day;
      } else if (drag.kind === 'picker-end') {
        pickerEnd = day;
        if (pickerStart && day < pickerStart) pickerStart = day;
      }
    }
  }

  function onPointerUp(event: PointerEvent): void {
    if (!drag) return;
    const state = drag;
    const moved = dragMoved;
    const releaseDay = dayFromPoint(event.clientX, event.clientY);
    drag = null;
    dragMoved = false;
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

    if (rangeMode) {
      if (!moved) {
        if (releaseDay && releaseDay === state.anchor) {
          suppressClick = true;
          setTimeout(() => {
            suppressClick = false;
          }, 500);
          selectPickerDay(releaseDay);
        }
      } else {
        if (releaseDay && releaseDay !== state.anchor) {
          if (state.kind === 'picker-new') {
            const range = normalise(state.anchor, releaseDay);
            pickerStart = range.from;
            pickerEnd = range.to;
          } else if (state.kind === 'picker-start') {
            pickerStart = releaseDay;
            if (pickerEnd && releaseDay > pickerEnd) pickerEnd = releaseDay;
          } else if (state.kind === 'picker-end') {
            pickerEnd = releaseDay;
            if (pickerStart && releaseDay < pickerStart) pickerStart = releaseDay;
          }
        }
        suppressClick = true;
        setTimeout(() => {
          suppressClick = false;
        }, 500);
      }
      return;
    }

    if (!moved) {
      if (releaseDay && releaseDay === state.anchor) {
        suppressClick = true;
        setTimeout(() => {
          suppressClick = false;
        }, 500);
        onSelectDay(releaseDay);
      }
      return;
    }
    if (!releaseDay || releaseDay === state.anchor) return;

    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 500);

    let start: DayKey;
    let end: DayKey | null;
    if (state.kind === 'create') {
      const range = normalise(state.anchor, releaseDay);
      start = range.from;
      end = range.to;
    } else if (state.kind === 'start') {
      start = releaseDay;
      end = state.blockEnd ?? null;
    } else if (state.kind === 'end') {
      start = state.blockStart!;
      end = releaseDay;
    } else if (state.open) {
      if (releaseDay >= state.anchor) {
        start = state.anchor;
        end = releaseDay;
      } else {
        start = releaseDay;
        end = null;
      }
    } else {
      const range = normalise(state.anchor, releaseDay);
      start = range.from;
      end = range.to;
    }

    void (async () => {
      try {
        if (state.kind === 'create') {
          await app.addPeriodRange(start, end!);
          showStatus(`${COPY.calendar.created}: ${formatRange(start, end!)}`);
        } else {
          await app.updatePeriodBounds(state.originalStart!, start, end);
          showStatus(
            `${COPY.calendar.updated}: ${formatRange(start, end ?? state.displayEnd ?? start)}`,
          );
        }
      } catch (cause) {
        dragError = cause instanceof Error ? cause.message : COPY.errors.save;
      }
    })();
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
    drag = null;
    dragMoved = false;
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
    if (startEdges.has(day)) classes.push('is-period-start');
    if (endEdges.has(day)) classes.push('is-period-end');
    if (incomplete.has(day)) classes.push('is-period-incomplete');
    if (rangeMode && pickerPreview) {
      if (day >= pickerPreview.from && day <= pickerPreview.to) classes.push('is-picker-in');
      if (day === pickerPreview.from) classes.push('is-picker-start');
      if (day === pickerPreview.to) classes.push('is-picker-end');
    }
    if (!rangeMode && dragPreview) {
      if (day >= dragPreview.from && day <= dragPreview.to) classes.push('is-drag-in');
      if (day === dragPreview.from) classes.push('is-drag-start');
      if (day === dragPreview.to) classes.push('is-drag-end');
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

<section class="calendar" bind:this={calendarEl} aria-label={COPY.calendar.sectionAria}>
  <Calendar.Root
    type="single"
    {value}
    onValueChange={handleValueChange}
    bind:placeholder
    weekStartsOn={1}
    weekdayFormat="short"
    fixedWeeks
    disableDaysOutsideMonth={false}
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
        <div class="picker-bar">
          <p class="picker-hint">{COPY.calendar.pickerHint}</p>
          <div class="picker-dates">
            <span><b>{COPY.calendar.pickerStart}:</b> {pickerStart ? formatDay(pickerStart) : '—'}</span>
            <span><b>{COPY.calendar.pickerEnd}:</b> {pickerEnd ? formatDay(pickerEnd) : '—'}</span>
          </div>
          <div class="picker-actions">
            <button
              class="primary"
              disabled={!pickerStart || !pickerEnd}
              onclick={savePicker}
            >{COPY.common.save}</button>
            <button
              class="secondary"
              disabled={!pickerStart}
              onclick={savePickerOpen}
            >{COPY.calendar.pickerOpen}</button>
            <button class="link-button" onclick={cancelPicker}>{COPY.common.cancel}</button>
          </div>
          {#if pickerError}
            <p class="picker-error" role="alert">{pickerError}</p>
          {/if}
        </div>
      {:else}
        <p class="cal-hint">{COPY.calendar.dragHint}</p>
        {#if incomplete.size > 0}
          <p class="cal-note">{COPY.calendar.needsEnd}</p>
        {/if}
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

  {#if dragError}
    <p class="drag-error" role="alert">{dragError}</p>
  {/if}
  {#if dragStatus}
    <div class="drag-status" role="status">
      <span>{dragStatus}</span>
      {#if app.periodUndo}
        <button class="link-button" onclick={undoPeriod}>{COPY.common.undo}</button>
      {/if}
    </div>
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
