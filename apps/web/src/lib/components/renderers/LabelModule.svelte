<script lang="ts">
  let { data = {}, editable = false, onchange }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
  } = $props()

  let text = $derived(typeof data.text === 'string' ? data.text : '')
  let color = $derived(typeof data.color === 'string' ? data.color : 'cyan')

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

<span
  class="label label-{color}"
  contenteditable={editable}
  oninput={handleInput}
  role={editable ? 'textbox' : undefined}
>{text}</span>

<style>
  .label {
    display: inline-block;
    font-size: clamp(0.6rem, 1cqi, 0.75rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0;
    background: none;
    border-radius: 0;
    outline: none;
    font-family: var(--font-body);
  }
  .label-cyan { color: #79c0ff; }
  .label-blue { color: var(--blue, #3B73E6); }
  .label-navy { color: var(--navy, #1D3A83); }
  .label-red { color: #ff6b6b; }
  .label-amber { color: #d4a017; }
  .label-green { color: #2d8a4e; }
  .label[contenteditable="true"]:focus {
    outline: 1px dashed var(--color-primary);
    outline-offset: 2px;
  }
</style>
