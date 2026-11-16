<script lang="ts">
  import { backupAgeDays } from '../lib/backup';
  import { diffDays, isDayKey } from '../lib/date';
  import { app } from '../lib/store.svelte';

  let { onExport }: { onExport: () => void } = $props();

  const age = $derived(backupAgeDays(app.settings.lastExportAt, app.today));

  const dismissed = $derived.by(() => {
    const raw = app.settings.backupNudgeDismissedAt?.slice(0, 10);
    if (!raw || !isDayKey(raw)) return false;
    return diffDays(raw, app.today) < 30;
  });

  const show = $derived(
    !dismissed && (age === null ? app.events.length >= 10 : age > 60),
  );

  function dismiss(): void {
    void app.saveSettings({ backupNudgeDismissedAt: new Date().toISOString() });
  }
</script>

{#if show}
  <p class="nudge" role="status">
    <span>{age === null ? 'No backup yet.' : `Backup is ${age} days old.`}</span>
    <button class="link-button" onclick={onExport}>Export</button>
    <button class="link-button" onclick={dismiss}>Dismiss</button>
  </p>
{/if}

<style>
  .nudge {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 6px;
    margin: 12px 0 0;
    color: var(--muted);
    font-size: 13px;
  }

  .nudge button {
    font-size: 13px;
  }
</style>
