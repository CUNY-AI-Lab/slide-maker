<script lang="ts">
  let { data = {}, editable = false }: { data: Record<string, unknown>; editable: boolean } = $props()

  let level = $derived(typeof data.level === 'number' ? Math.min(Math.max(data.level, 1), 4) : 1)
  let text = $derived(typeof data.text === 'string' ? data.text : '')

  function handleInput(e: Event) {
    const target = e.target as HTMLElement
    data.text = target.textContent ?? ''
  }
</script>

{#if level === 1}
  <h1
    class="heading heading-1"
    contenteditable={editable}
    oninput={handleInput}
    role={editable ? 'textbox' : undefined}
  >{text}</h1>
{:else if level === 2}
  <h2
    class="heading heading-2"
    contenteditable={editable}
    oninput={handleInput}
    role={editable ? 'textbox' : undefined}
  >{text}</h2>
{:else if level === 3}
  <h3
    class="heading heading-3"
    contenteditable={editable}
    oninput={handleInput}
    role={editable ? 'textbox' : undefined}
  >{text}</h3>
{:else}
  <h4
    class="heading heading-4"
    contenteditable={editable}
    oninput={handleInput}
    role={editable ? 'textbox' : undefined}
  >{text}</h4>
{/if}

<style>
  .heading {
    font-family: var(--font-display);
    line-height: 1.2;
    margin: 0;
    outline: none;
  }
  .heading-1 {
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .heading-2 {
    font-size: clamp(1.5rem, 3.5vw, 2.5rem);
    font-weight: 700;
  }
  .heading-3 {
    font-size: clamp(1.1rem, 2.5vw, 1.75rem);
    font-weight: 600;
  }
  .heading-4 {
    font-size: clamp(0.95rem, 2vw, 1.25rem);
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
