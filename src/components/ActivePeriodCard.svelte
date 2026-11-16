<script lang="ts">
  import { COPY } from '../lib/strings';
  import type { ActivePeriod } from '../lib/types';

  let {
    period,
    onStill,
    onEnded,
  }: {
    period: ActivePeriod;
    onStill: () => void;
    onEnded: () => void;
  } = $props();
</script>

<div class="active-period">
  <p class="label">{COPY.period.day(period.days)}</p>
  <div class="actions">
    <button class="primary" onclick={onStill}>{COPY.period.still}</button>
    <button class="secondary" onclick={onEnded}>{COPY.period.ended}</button>
  </div>
</div>

<style>
  .active-period {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .label {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .actions .primary {
    width: auto;
    min-height: 44px;
    padding: 0 14px;
    font-size: 15px;
  }

  .actions .secondary {
    min-height: 44px;
    padding: 0 12px;
  }

  @media (max-width: 360px) {
    .active-period {
      flex-wrap: wrap;
    }

    .label {
      width: 100%;
    }
  }
</style>
