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
    gap: 0.75rem;
  }
  .card {
    background: white;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0.75rem;
  }
  .card-title {
    font-size: 0.85rem;
    display: block;
    margin-bottom: 0.35rem;
  }
  .card-content {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }
</style>
