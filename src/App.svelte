<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { app } from './lib/store.svelte';
  import { exportBackup } from './lib/backup';
  import { COPY } from './lib/strings';
  import type { DayKey, HomeTab, View } from './lib/types';
  import ActivePeriodCard from './components/ActivePeriodCard.svelte';
  import BackupNudge from './components/BackupNudge.svelte';
  import CycleHistory from './components/CycleHistory.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import DayPanel from './components/DayPanel.svelte';
  import Icon from './components/Icon.svelte';
  import MonthCalendar from './components/MonthCalendar.svelte';
  import Settings from './components/Settings.svelte';
  import UndoToast from './components/UndoToast.svelte';

  let view = $state<View>('home');
  let homeTab = $state<HomeTab>('today');
  let selectedDay = $state<DayKey | null>(null);
  let rangeMode = $state(false);
  let rangeInitialStart = $state<DayKey | null>(null);
  let rangeInitialEnd = $state<DayKey | null>(null);
  let historyReturn = $state<'home' | 'settings'>('settings');
  let historyStartAdding = $state(false);
  let actionError = $state<string | null>(null);

  const TABS: HomeTab[] = ['today', 'calendar'];

  onMount(() => {
    void app.init();
    const tickTimer = setInterval(() => app.refreshToday(), 60_000);
    const onVisible = () => {
      if (!document.hidden) app.refreshToday();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tickTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });

  function reduceMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function go(next: View): void {
    if (next !== 'home') rangeMode = false;
    view = next;
    window.scrollTo({ top: 0 });
  }

  function openHistory(returnTo: 'home' | 'settings', startAdding = false): void {
    historyReturn = returnTo;
    historyStartAdding = startAdding;
    go('history');
  }

  function selectTab(tab: HomeTab): void {
    if (homeTab === tab) return;
    if (tab !== 'calendar') rangeMode = false;
    homeTab = tab;
    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  function onTabKeydown(event: KeyboardEvent, tab: HomeTab): void {
    const index = TABS.indexOf(tab);
    let next: HomeTab | null = null;
    if (event.key === 'ArrowRight') next = TABS[(index + 1) % TABS.length]!;
    else if (event.key === 'ArrowLeft') next = TABS[(index - 1 + TABS.length) % TABS.length]!;
    else if (event.key === 'Home') next = TABS[0]!;
    else if (event.key === 'End') next = TABS[TABS.length - 1]!;
    if (!next) return;
    event.preventDefault();
    selectTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  function openPeriodRange(initial?: { start: DayKey; end?: DayKey | null }): void {
    selectedDay = null;
    rangeInitialStart = initial?.start ?? null;
    rangeInitialEnd = initial?.end ?? null;
    rangeMode = true;
    homeTab = 'calendar';
    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  async function closeDay(): Promise<void> {
    const day = selectedDay;
    selectedDay = null;
    await tick();
    if (day) {
      document.querySelector<HTMLElement>(`.cal-day[data-value="${day}"]`)?.focus();
    }
  }

  async function openTodayBleeding(): Promise<void> {
    homeTab = 'calendar';
    selectedDay = app.today;
    await tick();
    document
      .querySelector<HTMLElement>('.day-panel')
      ?.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  function exportNow(): void {
    exportBackup(app.events, app.settings);
    void app
      .saveSettings({ lastExportAt: new Date().toISOString() })
      .catch((cause) => console.error('Could not record the export time', cause));
  }

  async function runAction(task: () => Promise<unknown>): Promise<void> {
    actionError = null;
    try {
      await task();
    } catch (cause) {
      actionError = cause instanceof Error ? cause.message : COPY.errors.save;
    }
  }
</script>

<div class="app" class:with-actionbar={view === 'home' && !rangeMode}>
  {#if view === 'home'}
    <header class="topbar">
      <h1 class="wordmark">Cycal</h1>
      <button class="icon-btn" aria-label={COPY.app.settingsAria} onclick={() => go('settings')}>
        <Icon name="settings" />
      </button>
    </header>

    <div class="tabs">
      <div class="tabs-inner" role="tablist" aria-label={COPY.tabs.aria}>
        <button
          id="tab-today"
          role="tab"
          aria-selected={homeTab === 'today'}
          aria-controls="today-panel"
          tabindex={homeTab === 'today' ? 0 : -1}
          onclick={() => selectTab('today')}
          onkeydown={(event) => onTabKeydown(event, 'today')}
        >
          {COPY.tabs.today}
        </button>
        <button
          id="tab-calendar"
          role="tab"
          aria-selected={homeTab === 'calendar'}
          aria-controls="calendar-panel"
          tabindex={homeTab === 'calendar' ? 0 : -1}
          onclick={() => selectTab('calendar')}
          onkeydown={(event) => onTabKeydown(event, 'calendar')}
        >
          {COPY.tabs.calendar}
        </button>
      </div>
    </div>
  {/if}

  {#if app.storageBlocked}
    <p class="banner" role="alert">{COPY.app.storageBlocked}</p>
  {/if}

  <main>
    {#if !app.ready}
      <p class="loading">{COPY.common.loading}</p>
    {:else if view === 'settings'}
      <Settings
        onBack={() => go('home')}
        onHistory={() => openHistory('settings')}
        onExport={exportNow}
      />
    {:else if view === 'history'}
      <CycleHistory onBack={() => go(historyReturn)} startAdding={historyStartAdding} />
    {:else}
      <div
        id="today-panel"
        role="tabpanel"
        aria-labelledby="tab-today"
        tabindex="0"
        hidden={homeTab !== 'today'}
      >
        <Dashboard
          stats={app.stats}
          today={app.today}
          onHistory={() => openHistory('home', true)}
        />
        <BackupNudge onExport={exportNow} />
      </div>

      <div
        id="calendar-panel"
        role="tabpanel"
        aria-labelledby="tab-calendar"
        tabindex="0"
        hidden={homeTab !== 'calendar'}
      >
        <MonthCalendar
          events={app.events}
          stats={app.stats}
          today={app.today}
          selectedDay={selectedDay}
          onSelectDay={(day) => (selectedDay = day)}
          onClearSelection={() => (selectedDay = null)}
          bind:rangeMode
          {rangeInitialStart}
          {rangeInitialEnd}
        />
        {#if selectedDay}
          {#key selectedDay}
            <DayPanel
              date={selectedDay}
              onClose={closeDay}
              onEditRange={(start: DayKey, end: DayKey | null) => openPeriodRange({ start, end })}
            />
          {/key}
        {/if}
      </div>

      {#if actionError}
        <p class="banner action-error" role="alert">{actionError}</p>
      {/if}
    {/if}
  </main>
</div>

{#if app.ready && view === 'home' && !rangeMode}
  <footer class="actionbar">
    <div class="actionbar-inner">
      {#if app.activePeriod}
        <ActivePeriodCard
          period={app.activePeriod}
          flow={app.flowForDay(app.today)}
          onChange={openTodayBleeding}
          onEnded={() => runAction(() => app.endActivePeriod(app.today))}
        />
      {:else}
        <button
          class="primary"
          aria-label={COPY.app.periodsAria}
          onclick={() => openPeriodRange()}
        >{COPY.app.periods}</button>
      {/if}
    </div>
  </footer>
{/if}

{#if view === 'home' && !selectedDay}
  <UndoToast />
{/if}

<style>
  .loading {
    margin: 32px 0;
    color: var(--muted);
    font-size: 15px;
  }

  main {
    display: block;
  }

  .action-error {
    margin-top: 18px;
  }
</style>
