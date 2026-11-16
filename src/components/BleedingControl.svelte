<script lang="ts">
  import { COPY } from '../lib/strings';
  import type { FlowValue } from '../lib/types';
  import { FLOWS } from '../lib/vocab';

  let {
    value,
    onChange,
  }: { value: FlowValue | undefined; onChange: (value: FlowValue) => void } = $props();
</script>

<div class="bleeding-control" role="group" aria-label={COPY.bleeding.aria}>
  {#each FLOWS as flow (flow.value)}
    <button
      type="button"
      class:on={value === flow.value}
      aria-pressed={value === flow.value}
      onclick={() => onChange(flow.value)}
    >
      {flow.label}
    </button>
  {/each}
</div>

<style>
  .bleeding-control {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
  }

  button {
    min-height: 44px;
    padding: 0 8px;
    color: var(--ink);
    font-size: 14px;
  }

  button + button {
    border-left: 1px solid var(--line-strong);
  }

  button.on {
    background: var(--accent-soft);
    font-weight: 600;
  }
</style>
