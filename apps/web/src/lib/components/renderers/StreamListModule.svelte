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
    padding: 0.35rem 0 0.35rem 1.25rem;
    position: relative;
    font-size: clamp(0.8rem, 1.3cqi, 1rem);
    line-height: 1.6;
    outline: none;
  }
  .stream-list li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.75rem;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--teal, #2FB8D6);
  }
  .stream-list li[contenteditable="true"]:focus {
    outline: none;
    border-radius: 3px;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary, #3B73E6) 45%, transparent);
  }
</style>
