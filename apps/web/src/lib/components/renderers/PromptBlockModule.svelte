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
  <pre>{content}</pre>
</div>

<style>
  .prompt-block {
    background: #0b0e14;
    color: rgba(255, 255, 255, 0.92);
    font-family: 'JetBrains Mono', monospace;
    padding: clamp(0.75rem, 1.5cqi, 1.25rem);
    border-radius: 6px;
    border-left: 4px solid #79c0ff;
    font-size: clamp(0.7rem, 1.1cqi, 0.85rem);
    line-height: 1.6;
    white-space: pre-wrap;
    position: relative;
  }
  .prompt-good { border-left-color: #6bcf7f; }
  .prompt-mid { border-left-color: #ffd93d; }
  .prompt-bad { border-left-color: #ff6b6b; }

  pre {
    margin: 0;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    white-space: pre-wrap;
    word-break: break-word;
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
