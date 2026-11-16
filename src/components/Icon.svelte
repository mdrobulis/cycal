<script lang="ts">
  type Name =
    | 'settings'
    | 'back'
    | 'chevron-left'
    | 'chevron-right'
    | 'close'
    | 'trash'
    | 'plus'
    | 'check'
    | 'calendar';

  let {
    name,
    size = 20,
    strokeWidth = 1.8,
  }: { name: Name; size?: number; strokeWidth?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'settings'}
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  {:else if name === 'back' || name === 'chevron-left'}
    <path d="M15 5l-7 7 7 7" />
  {:else if name === 'chevron-right'}
    <path d="M9 5l7 7-7 7" />
  {:else if name === 'close'}
    <path d="M6 6l12 12M18 6L6 18" />
  {:else if name === 'trash'}
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  {:else if name === 'plus'}
    <path d="M12 5v14M5 12h14" />
  {:else if name === 'check'}
    <path d="M5 12.5l4.5 4.5L19 7" />
  {:else if name === 'calendar'}
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  {/if}
</svg>
