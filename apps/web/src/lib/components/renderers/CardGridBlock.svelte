<script lang="ts">
  let { data = {} }: { data: Record<string, unknown>; editable: boolean } = $props()

  let columns = $derived(
    typeof data.columns === 'number' && data.columns >= 2 && data.columns <= 4
      ? data.columns
      : 3
  )

  let cards: Array<{ title: string; content: string; color?: string }> = $derived(
    Array.isArray(data.cards)
      ? data.cards.map((c: unknown) => {
          const card = c as Record<string, unknown>
          return {
            title: typeof card.title === 'string' ? card.title : '',
            content: typeof card.content === 'string' ? card.content : '',
            color: typeof card.color === 'string' ? card.color : undefined
          }
        })
      : []
  )
</script>

<div class="card-grid" style="grid-template-columns: repeat({columns}, 1fr);">
  {#each cards as card}
    <div class="card" style={card.color ? `border-top: 3px solid ${card.color};` : ''}>
      {#if card.title}
        <strong class="card-title">{card.title}</strong>
      {/if}
      {#if card.content}
        <p class="card-content">{card.content}</p>
      {/if}
    </div>
  {/each}
</div>

<style>
  .card-grid {
    display: grid;
    gap: clamp(0.5rem, 1.2vw, 1rem);
    width: 100%;
  }
  .card {
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: clamp(0.75rem, 1.5vw, 1.25rem);
  }
  .card-title {
    font-family: var(--font-display);
    font-size: clamp(0.85rem, 1.3vw, 1.05rem);
    font-weight: 600;
    display: block;
    margin-bottom: 0.35rem;
  }
  .card-content {
    margin: 0;
    font-size: clamp(0.75rem, 1.1vw, 0.9rem);
    line-height: 1.5;
    color: var(--color-text-secondary);
    font-family: var(--font-body);
  }
</style>
