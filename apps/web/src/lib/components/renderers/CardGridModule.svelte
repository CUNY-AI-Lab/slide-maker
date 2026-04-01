<script lang="ts">
  import { renderContent } from '$lib/utils/markdown'

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
        <div class="card-content">{@html renderContent(card.content)}</div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .card-grid {
    display: grid;
    gap: clamp(0.75rem, 1.8cqi, 1.25rem);
    width: 100%;
  }
  .card {
    background: var(--color-bg-secondary, rgba(0, 0, 0, 0.03));
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: clamp(1rem, 2.2cqi, 1.5rem);
    min-height: clamp(130px, 15cqi, 220px);
  }
  .card-title {
    font-family: var(--font-display);
    font-size: clamp(1rem, 1.8cqi, 1.25rem);
    font-weight: 650;
    display: block;
    margin-bottom: 0.5rem;
  }
  .card-content {
    margin: 0;
    font-size: clamp(0.9rem, 1.4cqi, 1.05rem);
    line-height: 1.6;
    color: var(--color-text-secondary);
    font-family: var(--font-body);
  }
</style>
