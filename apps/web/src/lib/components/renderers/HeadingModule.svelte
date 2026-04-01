<script lang="ts">
  import { fitText } from '$lib/utils/text-measure'

  let { data = {}, editable = false, onchange }: { data: Record<string, unknown>; editable: boolean; onchange?: (newData: Record<string, unknown>) => void } = $props()

  let level = $derived(typeof data.level === 'number' ? Math.min(Math.max(data.level, 1), 4) : 1)
  let text = $derived(typeof data.text === 'string' ? data.text : '')

  const LEVEL_CONFIG: Record<number, { base: number; min: number; weight: string }> = {
    1: { base: 48, min: 24, weight: '800' },
    2: { base: 32, min: 18, weight: '700' },
    3: { base: 24, min: 16, weight: '600' },
    4: { base: 18, min: 14, weight: '600' },
  }

  let containerEl: HTMLElement | undefined = $state(undefined)
  let fittedFontSize: number | undefined = $state(undefined)
  let focused = $state(false)

  // Set text content via DOM ref — Svelte must NOT manage contenteditable text
  $effect(() => {
    if (containerEl && !focused) {
      containerEl.textContent = text
    }
  })

  $effect(() => {
    void text
    void level
    if (!containerEl || !text.trim()) { fittedFontSize = undefined; return }
    const raf = requestAnimationFrame(() => {
      if (!containerEl) return
      const w = containerEl.clientWidth
      const h = containerEl.clientHeight
      if (w <= 0 || h <= 0) { fittedFontSize = undefined; return }
      const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG[1]
      const size = fitText(text, 'Outfit', cfg.base, cfg.weight, w, h, 1.2, cfg.min)
      fittedFontSize = size < cfg.base ? size : undefined
    })
    return () => cancelAnimationFrame(raf)
  })

  let saveTimer: ReturnType<typeof setTimeout> | undefined

  function handleInput(e: Event) {
    const target = e.target as HTMLElement
    const newText = target.textContent ?? ''
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      onchange?.({ ...data, text: newText })
    }, 500)
  }
</script>

{#if level === 1}
  <h1
    bind:this={containerEl}
    class="heading heading-1"
    contenteditable={editable}
    onfocus={() => focused = true}
    oninput={handleInput}
    onblur={() => focused = false}
    role={editable ? 'textbox' : undefined}
    style:font-size={fittedFontSize ? `${fittedFontSize}px` : undefined}
  ></h1>
{:else if level === 2}
  <h2
    bind:this={containerEl}
    class="heading heading-2"
    contenteditable={editable}
    onfocus={() => focused = true}
    oninput={handleInput}
    onblur={() => focused = false}
    role={editable ? 'textbox' : undefined}
    style:font-size={fittedFontSize ? `${fittedFontSize}px` : undefined}
  ></h2>
{:else if level === 3}
  <h3
    bind:this={containerEl}
    class="heading heading-3"
    contenteditable={editable}
    onfocus={() => focused = true}
    oninput={handleInput}
    onblur={() => focused = false}
    role={editable ? 'textbox' : undefined}
    style:font-size={fittedFontSize ? `${fittedFontSize}px` : undefined}
  ></h3>
{:else}
  <h4
    bind:this={containerEl}
    class="heading heading-4"
    contenteditable={editable}
    onfocus={() => focused = true}
    oninput={handleInput}
    onblur={() => focused = false}
    role={editable ? 'textbox' : undefined}
    style:font-size={fittedFontSize ? `${fittedFontSize}px` : undefined}
  ></h4>
{/if}

<style>
  .heading {
    font-family: var(--font-display);
    line-height: 1.2;
    margin: 0;
    outline: none;
  }
  .heading[contenteditable="true"] {
    padding-inline: 12px;
  }
  .heading-1 {
    font-size: clamp(2rem, 5cqi, 3.5rem);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .heading-2 {
    font-size: clamp(1.5rem, 3.5cqi, 2.5rem);
    font-weight: 700;
  }
  .heading-3 {
    font-size: clamp(1.1rem, 2.5cqi, 1.75rem);
    font-weight: 600;
  }
  .heading-4 {
    font-size: clamp(0.95rem, 2cqi, 1.25rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-primary);
  }
  .heading[contenteditable="true"]:focus {
    outline: 1px dashed var(--color-primary);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
</style>
