<script lang="ts">
  let { data = {} }: { data: Record<string, unknown>; editable: boolean } = $props()

  let code = $derived(typeof data.content === 'string' ? data.content : typeof data.code === 'string' ? data.code : '')
  let language = $derived(typeof data.language === 'string' ? data.language : '')
  let showLineNumbers = $derived(Boolean(data.showLineNumbers))
  let lines = $derived(code.split('\n'))

  let copied = $state(false)

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(code)
      copied = true
      setTimeout(() => { copied = false }, 2000)
    } catch {
      // Clipboard API may not be available
    }
  }
</script>

<div class="code-block">
  <div class="code-header">
    <span class="language-label">{language || 'code'}</span>
    <button class="copy-btn" onclick={copyToClipboard}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  </div>
  <pre><code class="language-{language}">{#if showLineNumbers}{#each lines as line, i}<span class="line-number">{i + 1}</span>{line}
{/each}{:else}{code}{/if}</code></pre>
</div>

<style>
  .code-block {
    background: #0b0e14;
    border-radius: var(--radius-md);
    overflow: hidden;
    position: relative;
  }
  .code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.06);
    padding: 0.4rem 1rem;
    font-size: 0.75rem;
  }
  .language-label {
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    font-weight: 500;
    letter-spacing: 0.05em;
    font-family: var(--font-body);
  }
  .copy-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.7rem;
    padding: 0.2rem 0.6rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    font-family: var(--font-body);
  }
  .copy-btn:hover {
    color: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.35);
  }
  pre {
    padding: 1rem 1.25rem;
    margin: 0;
    color: rgba(255, 255, 255, 0.92);
    font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
    font-size: clamp(0.7rem, 1.2vw, 0.9rem);
    line-height: 1.6;
    overflow-x: auto;
  }
  code {
    font-family: inherit;
  }
  .line-number {
    display: inline-block;
    width: 2.5em;
    text-align: right;
    padding-right: 1em;
    color: rgba(255, 255, 255, 0.2);
    user-select: none;
  }
</style>
