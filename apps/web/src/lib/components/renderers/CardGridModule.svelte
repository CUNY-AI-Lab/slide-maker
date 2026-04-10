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
    gap: clamp(12px, 2.5cqi, 20px);
    width: 100%;
  }
  .card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: clamp(16px, 3cqi, 24px);
  }
  .card-title {
    font-family: var(--font-display);
    font-size: clamp(0.95rem, 1.6cqi, 1.3rem);
    font-weight: 650;
    display: block;
    margin-bottom: 8px;
  }
  .card-content {
    margin: 0;
    font-size: clamp(0.85rem, 1.3cqi, 1rem);
    line-height: 1.45;
    color: rgba(240, 240, 240, 0.65);
    font-family: var(--font-body);
  }
</style>
