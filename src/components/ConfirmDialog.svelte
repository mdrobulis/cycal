<script lang="ts">
  let {
    open,
    title,
    message,
    confirmLabel,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  let dialog = $state<HTMLDialogElement>();
  const uid = $props.id();
  const titleId = `confirm-${uid}`;

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  class="dialog-card"
  bind:this={dialog}
  oncancel={(event) => {
    event.preventDefault();
    onCancel();
  }}
  aria-labelledby={titleId}
>
  <div class="card">
    <h2 id={titleId}>{title}</h2>
    <p>{message}</p>
    <div class="actions">
      <button class="secondary" onclick={onCancel}>Cancel</button>
      <button class="danger-button" onclick={onConfirm}>{confirmLabel}</button>
    </div>
  </div>
</dialog>

<style>
  .card {
    padding: 20px;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 19px;
    font-weight: 600;
  }

  p {
    margin: 0 0 20px;
    color: var(--muted);
    font-size: 15px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
