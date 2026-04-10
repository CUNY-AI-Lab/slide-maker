<script lang="ts">
  import { inlineMarkdown } from '$lib/utils/markdown'
  import DOMPurify from 'dompurify'

  let { data = {}, editable = false, onchange }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
  } = $props()

  let items: string[] = $derived(
    Array.isArray(data.items)
      ? data.items.map((item: unknown) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') {
            const o = item as Record<string, unknown>
            return String(o.text || o.content || o.label || o.title || JSON.stringify(item))
          }
          return String(item)
        })
      : []
  )

  let saveTimer: ReturnType<typeof setTimeout> | undefined

  function handleItemInput(index: number, e: Event) {
    const target = e.target as HTMLElement
    const newText = target.textContent ?? ''
    const newItems = [...items]
    newItems[index] = newText
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      onchange?.({ ...data, items: newItems })
    }, 500)
  }
</script>

<ul class="stream-list">
  {#each items as item, i}
    {#if editable}
      <li
        contenteditable="true"
        oninput={(e) => handleItemInput(i, e)}
      >{item}</li>
    {:else}
      <li>{@html DOMPurify.sanitize(inlineMarkdown(item))}</li>
    {/if}
  {/each}
</ul>

<style>
  .stream-list {
    list-style: none;
    padding: 0;
    margin: 0;
    font-family: var(--font-body);
  }
  .stream-list li {
    padding: clamp(8px, 1.5cqi, 12px) clamp(12px, 2cqi, 16px);
    border-left: 2px solid var(--accent-cyan, #64b5f6);
    margin-bottom: clamp(4px, 0.8cqi, 6px);
    background: rgba(255, 255, 255, 0.02);
    border-radius: 0 6px 6px 0;
    font-size: clamp(0.8rem, 1.3cqi, 1rem);
    line-height: 1.5;
    outline: none;
  }
  .stream-list li[contenteditable="true"]:focus {
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary, #3B73E6) 45%, transparent);
  }
</style>
