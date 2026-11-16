<script lang="ts">
  import { COPY } from '../lib/strings';
  import type { ActivePeriod, FlowValue } from '../lib/types';
  import { flowLabel } from '../lib/vocab';

  let {
    period,
    flow,
    onChange,
    onEnded,
  }: {
    period: ActivePeriod;
    flow?: FlowValue;
    onChange: () => void;
    onEnded: () => void;
  } = $props();
</script>

<div class="active-period">
  <p class="label">{COPY.period.day(period.days)}</p>
  <p class="flow">
    <span>{COPY.sheet.flow}:</span>
    <strong>{flow ? flowLabel(flow) : COPY.bleeding.unmarked}</strong>
  </p>
  <div class="actions">
    <button class="link-button" onclick={onChange}>{COPY.bleeding.change}</button>
    <button class="secondary" onclick={onEnded}>{COPY.period.ended}</button>
  </div>
</div>

<style>
  .active-period {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 12px;
  }

  .label {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    white-space: nowrap;
  }

  .flow {
    flex: 1 1 auto;
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    text-align: right;
    white-space: nowrap;
  }

  .flow strong {
    color: var(--ink);
    font-weight: 600;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .actions .link-button,
  .actions .secondary {
    min-height: 44px;
  }
</style>
