<script lang="ts">
  let { data = {}, editable = false, onchange }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
  } = $props()

  let content = $derived(typeof data.content === 'string' ? data.content : '')
  let quality = $derived(typeof data.quality === 'string' ? data.quality : '')
  let language = $derived(typeof data.language === 'string' ? data.language : '')

  let copied = $state(false)
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  function handleInput(e: Event) {
    const target = e.target as HTMLElement
    const newText = target.textContent ?? ''
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      onchange?.({ ...data, content: newText })
    }, 500)
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(content)
      copied = true
      setTimeout(() => { copied = false }, 2000)
    } catch {
      // Clipboard API may not be available
    }
  }

  const qualityLabels: Record<string, string> = {
    good: 'Good',
    mid: 'Needs Work',
    bad: 'Poor',
  }
</script>

<div
  class="prompt-block"
  class:prompt-good={quality === 'good'}
  class:prompt-mid={quality === 'mid'}
  class:prompt-bad={quality === 'bad'}
>
  <button class="copy-btn" onclick={copyToClipboard}>
    {copied ? 'Copied!' : 'Copy'}
  </button>
  {#if quality && qualityLabels[quality]}
    <span class="quality-badge quality-{quality}">{qualityLabels[quality]}</span>
  {/if}
  {#if language}
    <span class="language-label">{language}</span>
  {/if}
  <pre
    contenteditable={editable ? 'true' : undefined}
    oninput={editable ? handleInput : undefined}
  >{content}</pre>
</div>

<style>
  .prompt-block {
    background: transparent;
    color: var(--text-primary, #f0f0f0);
    font-family: 'JetBrains Mono', monospace;
    padding: clamp(14px, 2.5cqi, 20px) clamp(16px, 3cqi, 24px);
    border-radius: 8px;
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
    font-size: clamp(0.8rem, 1.3cqi, 1.05rem);
    line-height: 1.5;
    white-space: pre-wrap;
    position: relative;
  }
  .prompt-good { border-color: rgba(110, 231, 183, 0.3); background: rgba(110, 231, 183, 0.04); }
  .prompt-mid { border-color: rgba(251, 191, 36, 0.3); background: rgba(251, 191, 36, 0.04); }
  .prompt-bad { border-color: rgba(248, 113, 113, 0.3); background: rgba(248, 113, 113, 0.04); }

  pre {
    margin: 0;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    white-space: pre-wrap;
    word-break: break-word;
    outline: none;
  }
  pre[contenteditable="true"]:focus {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary, #3B73E6) 45%, transparent);
    border-radius: 4px;
  }

  .copy-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.65rem;
    padding: 0.15rem 0.5rem;
    border-radius: 3px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    font-family: var(--font-body);
  }
  .copy-btn:hover {
    color: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.35);
  }

  .quality-badge {
    position: absolute;
    top: 0.5rem;
    right: 4rem;
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.1rem 0.5rem;
    border-radius: 3px;
  }
  .quality-good {
    background: rgba(107, 207, 127, 0.15);
    color: #6bcf7f;
  }
  .quality-mid {
    background: rgba(255, 217, 61, 0.15);
    color: #ffd93d;
  }
  .quality-bad {
    background: rgba(255, 107, 107, 0.15);
    color: #ff6b6b;
  }

  .language-label {
    display: inline-block;
    font-size: 0.6rem;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }
</style>
