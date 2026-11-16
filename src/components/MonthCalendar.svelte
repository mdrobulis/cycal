<script lang="ts">
  import { Calendar } from 'bits-ui';
  import {
    getLocalTimeZone,
    parseDate,
    today as adtToday,
    type DateValue,
  } from '@internationalized/date';
  import { rangeSet } from '../lib/date';
  import { recordedPeriodDays } from '../lib/periods';
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

<section class="calendar" aria-label="Month calendar">
  <Calendar.Root
    type="single"
    {value}
    onValueChange={handleValueChange}
    bind:placeholder
    weekStartsOn={1}
    weekdayFormat="short"
    fixedWeeks
    locale="en-GB"
    calendarLabel="Cycle calendar"
    initialFocus={false}
  >
    {#snippet children({ months, weekdays })}
      <Calendar.Header class="cal-head">
        <Calendar.MonthSelect aria-label="Month" />
        <Calendar.YearSelect aria-label="Year" />
      </Calendar.Header>

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

      <div class="cal-legend">
        <span><i class="lg-recorded"></i>recorded</span>
        <span><i class="lg-predicted"></i>predicted</span>
        <span><i class="lg-fertile"></i>fertile</span>
        <span><i class="lg-event"></i>logged</span>
      </div>
    {/snippet}
  </Calendar.Root>

  <div class="cal-nav">
    <button class="icon-btn" aria-label="Previous month" onclick={() => shiftMonth(-1)}>
      <Icon name="chevron-left" />
    </button>
    <button class="today" onclick={goToday}>Today</button>
    <button class="icon-btn" aria-label="Next month" onclick={() => shiftMonth(1)}>
      <Icon name="chevron-right" />
    </button>
  </div>
</section>
