<script lang="ts">
  import { Calendar } from 'bits-ui';
  import {
    getLocalTimeZone,
    parseDate,
    today as adtToday,
    type DateValue,
  } from '@internationalized/date';
  import { dayRanges, formatDay, formatRange, rangeSet } from '../lib/date';
  import { recordedPeriodDays } from '../lib/periods';
  import { COPY } from '../lib/strings';
  import type { CycleStats, DayEvent, DayKey } from '../lib/types';
  import Icon from './Icon.svelte';

  let {
    events,
    stats,
    today,
    selectedDay,
    onSelectDay,
  }: {
    events: DayEvent[];
    stats: CycleStats;
    today: DayKey;
    selectedDay: DayKey | null;
    onSelectDay: (day: DayKey) => void;
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

  const recordedText = $derived(
    dayRanges(recorded, visiblePrefix)
      .map((range) => formatRange(range.from, range.to))
      .join(' · '),
  );
  const predictedText = $derived(
    dayRanges(predicted, visiblePrefix)
      .map((range) => formatRange(range.from, range.to))
      .join(' · '),
  );
  const fertileText = $derived(
    dayRanges(fertile, visiblePrefix)
      .map((range) => formatRange(range.from, range.to))
      .join(' · '),
  );
  const ovulation = $derived(
    stats.ovulation?.startsWith(visiblePrefix) ? stats.ovulation : undefined,
  );
  const loggedCount = $derived.by(() => {
    let count = 0;
    for (const [day, list] of byDay) {
      if (!day.startsWith(visiblePrefix)) continue;
      count += list.filter(
        (event) =>
          event.kind !== 'period-start' &&
          event.kind !== 'period-day' &&
          event.kind !== 'period-end',
      ).length;
    }
    return count;
  });
  const hasMarks = $derived(
    Boolean(recordedText || predictedText || fertileText || ovulation || loggedCount),
  );

  function handleValueChange(next: DateValue | DateValue[] | undefined): void {
    if (Array.isArray(next) || !next) return;
    onSelectDay(next.toString());
  }

  function cellClass(day: DayKey): string {
    const classes = ['cal-cell'];
    if (recorded.has(day)) classes.push('is-period');
    else if (predicted.has(day)) classes.push('is-predicted');
    if (fertile.has(day) && !recorded.has(day)) classes.push('is-fertile');
    if (stats.ovulation === day) classes.push('is-ovulation');
    return classes.join(' ');
  }

  function dotCount(day: DayKey): number {
    const list = byDay.get(day);
    if (!list) return 0;
    return Math.min(
      3,
      list.filter(
        (event) =>
          event.kind !== 'period-start' &&
          event.kind !== 'period-day' &&
          event.kind !== 'period-end',
      ).length,
    );
  }

  function shiftMonth(delta: number): void {
    placeholder = placeholder.add({ months: delta });
  }

  function goToday(): void {
    placeholder = adtToday(getLocalTimeZone());
  }
</script>

<section class="calendar" aria-label={COPY.calendar.sectionAria}>
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

      <div class="cal-summary" aria-label={COPY.calendar.summaryAria}>
        {#if stats.paused}
          <p class="summary-note">{COPY.calendar.summary.paused}</p>
        {:else if stats.irregular}
          <p class="summary-note">{COPY.calendar.summary.irregular}</p>
        {/if}

        {#if recordedText}
          <div class="item">
            <i class="swatch period" aria-hidden="true"></i>
            <span class="snippet">
              <span class="summary-label">{COPY.calendar.summary.period}</span>
              <span class="summary-when"> {recordedText}</span>
            </span>
          </div>
        {/if}

        {#if predictedText}
          <div class="item">
            <i class="swatch predicted" aria-hidden="true"></i>
            <span class="snippet">
              <span class="summary-label">{COPY.calendar.summary.predicted}</span>
              <span class="summary-when"> {predictedText}</span>
            </span>
          </div>
        {/if}

        {#if fertileText}
          <div class="item">
            <i class="swatch fertile" aria-hidden="true"></i>
            <span class="snippet">
              <span class="summary-label">{COPY.calendar.summary.fertile}</span>
              <span class="summary-when"> {fertileText}</span>
            </span>
          </div>
        {/if}

        {#if ovulation}
          <div class="item">
            <i class="swatch ovulation" aria-hidden="true"></i>
            <span class="snippet">
              <span class="summary-label">{COPY.calendar.summary.ovulation}</span>
              <span class="summary-when"> {formatDay(ovulation)}</span>
            </span>
          </div>
        {/if}

        {#if loggedCount > 0}
          <div class="item">
            <i class="swatch logged" aria-hidden="true"></i>
            <span class="snippet">
              <span class="summary-label">{COPY.calendar.summary.logged}:</span>
              <span class="summary-when"> {loggedCount}</span>
            </span>
          </div>
        {/if}

        {#if !hasMarks && !stats.paused && !stats.irregular}
          <p class="summary-note">{COPY.calendar.summary.noMarks}</p>
        {/if}
      </div>

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
                  {@const dots = dotCount(key)}
                  <Calendar.Cell {date} month={month.value} class={cellClass(key)}>
                    <Calendar.Day class="cal-day">
                      <span class="num">{date.day}</span>
                      {#if dots > 0}
                        <span class="dots" aria-hidden="true">
                          {#each Array(dots) as _, dotIndex (dotIndex)}
                            <i class="dot"></i>
                          {/each}
                        </span>
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
</section>
