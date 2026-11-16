<script lang="ts">
  import type { IconName } from '../lib/icon-names';

  let {
    name,
    size = 20,
    strokeWidth = 1.8,
  }: { name: IconName; size?: number; strokeWidth?: number } = $props();
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
    <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
  {:else if name === 'droplet'}
    <path d="M12 3.5s6.5 6.3 6.5 10.8a6.5 6.5 0 0 1-13 0C5.5 9.8 12 3.5 12 3.5z" />
  {:else if name === 'leaf'}
    <path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z" />
    <path d="M5 19c4-4 7-7 11-9" />
  {:else if name === 'ovum'}
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
  {:else if name === 'moon'}
    <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5z" />
  {:else if name === 'pulse'}
    <path d="M3 12h4l2-6 3.5 12 2.5-6H21" />
  {:else if name === 'face'}
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="9" cy="10" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="0.8" fill="currentColor" stroke="none" />
    <path d="M8.5 14.5a4 4 0 0 0 7 0" />
  {:else if name === 'heart'}
    <path d="M12 20s-7-4.5-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.5-7 9-7 9z" />
  {:else if name === 'note'}
    <path d="M5 7h14M5 12h14M5 17h9" />
  {:else if name === 'star'}
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
  {:else if name === 'pencil'}
    <path d="M4 20l4-1L19 8l-3-3L5 16l-1 4z" />
    <path d="M14 7l3 3" />
  {:else if name === 'history'}
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 8v4l3 2" />
  {/if}
</svg>
