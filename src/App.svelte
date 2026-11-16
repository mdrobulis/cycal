<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/store.svelte';
  import { exportBackup } from './lib/backup';
  import { STORAGE_BLOCKED } from './lib/strings';
  import type { DayKey, View } from './lib/types';
  import ActivePeriodCard from './components/ActivePeriodCard.svelte';
  import BackupNudge from './components/BackupNudge.svelte';
  import CycleHistory from './components/CycleHistory.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import DaySheet from './components/DaySheet.svelte';
  import Icon from './components/Icon.svelte';
  import MonthCalendar from './components/MonthCalendar.svelte';
  import Settings from './components/Settings.svelte';
  import UndoToast from './components/UndoToast.svelte';

  let view = $state<View>('home');
  let sheetDate = $state<DayKey | null>(null);
  let actionError = $state<string | null>(null);

  onMount(() => {
    void app.init();
    const tick = setInterval(() => app.refreshToday(), 60_000);
    const onVisible = () => {
      if (!document.hidden) app.refreshToday();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });

  function go(next: View): void {
    view = next;
    window.scrollTo({ top: 0 });
  }

  function exportNow(): void {
    exportBackup(app.events, app.settings);
    void app
      .saveSettings({ lastExportAt: new Date().toISOString() })
      .catch((cause) => console.error('Could not record the export time', cause));
  }

  async function markToday(): Promise<void> {
    actionError = null;
    try {
      const result = await app.markPeriodStart(app.today);
      if (result === 'exists') sheetDate = app.today;
    } catch (cause) {
      actionError = cause instanceof Error ? cause.message : 'Could not save that.';
    }
  }

  async function runAction(task: () => Promise<unknown>): Promise<void> {
    actionError = null;
    try {
      await task();
    } catch (cause) {
      actionError = cause instanceof Error ? cause.message : 'Could not save that.';
    }
  }
</script>

<div class="app">
  {#if view === 'home'}
    <header class="topbar">
      <h1 class="wordmark">Cycal</h1>
      <button class="icon-btn" aria-label="Settings" onclick={() => go('settings')}>
        <Icon name="settings" />
      </button>
    </header>
  {/if}

  {#if app.storageBlocked}
    <p class="banner" role="alert">{STORAGE_BLOCKED}</p>
  {/if}

  <main>
    {#if !app.ready}
      <p class="loading">Loading…</p>
    {:else if view === 'settings'}
      <Settings onBack={() => go('home')} onHistory={() => go('history')} onExport={exportNow} />
    {:else if view === 'history'}
      <CycleHistory onBack={() => go('settings')} />
    {:else}
      <Dashboard stats={app.stats} today={app.today} />
      <MonthCalendar
        events={app.events}
        stats={app.stats}
        today={app.today}
        selectedDay={sheetDate}
        onSelectDay={(day) => (sheetDate = day)}
      />
      <BackupNudge onExport={exportNow} />
      {#if actionError}
        <p class="banner action-error" role="alert">{actionError}</p>
      {/if}
    {/if}
  </main>
</div>

{#if app.ready && view === 'home'}
  <footer class="actionbar">
    <div class="actionbar-inner">
      {#if app.activePeriod}
        <ActivePeriodCard
          period={app.activePeriod}
          onStill={() => runAction(() => app.addPeriodDay(app.today))}
          onEnded={() => runAction(() => app.endActivePeriod(app.today))}
        />
      {:else}
        <button class="primary" onclick={markToday}>Mark period start</button>
      {/if}
    </div>
  </footer>
{/if}

{#if sheetDate}
  <DaySheet date={sheetDate} onClose={() => (sheetDate = null)} />
{/if}

{#if !sheetDate}
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
