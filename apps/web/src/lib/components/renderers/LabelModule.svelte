<script lang="ts">
  let { data = {}, editable = false, onchange }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
  } = $props()

  let text = $derived(typeof data.text === 'string' ? data.text : '')
  let color = $derived(typeof data.color === 'string' ? data.color : 'cyan')

  let isEditing = $state(false)
  let editText = $state('')
  let displayText = $derived(isEditing ? editText : text)

  let saveTimer: ReturnType<typeof setTimeout> | undefined

  function handleFocus() {
    isEditing = true
    editText = text
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLElement
    const newText = target.textContent ?? ''
    editText = newText
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      onchange?.({ ...data, text: newText })
    }, 500)
  }

  function handleBlur() {
    isEditing = false
  }
</script>

<span
  class="label label-{color}"
  contenteditable={editable}
  spellcheck={false}
  onfocus={handleFocus}
  oninput={handleInput}
  onblur={handleBlur}
  role={editable ? 'textbox' : undefined}
>{displayText}</span>

<style>
  .label {
    display: inline-block;
    font-size: clamp(0.65rem, 1.2cqi, 0.85rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 4px 10px;
    background: none;
    border-radius: 4px;
    outline: none;
    font-family: var(--font-body);
    min-width: 3em;
    min-height: 1.5em;
    line-height: 1.5;
  }
  .label-cyan { color: #79c0ff; }
  .label-blue { color: var(--blue, #3B73E6); }
  .label-navy { color: var(--navy, #1D3A83); }
  .label-red { color: #ff6b6b; }
  .label-amber { color: #d4a017; }
  .label-green { color: #2d8a4e; }
  .label[contenteditable="true"]:focus {
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary, #3B73E6) 45%, transparent);
  }
</style>
