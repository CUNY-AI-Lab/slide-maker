<script lang="ts">
  let { data = {} }: { data: Record<string, unknown>; editable: boolean } = $props()

  let code = $derived(typeof data.code === 'string' ? data.code : '')
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
    {#if language}
      <span class="language-label">{language}</span>
    {/if}
    <button class="copy-btn" onclick={copyToClipboard}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  </div>
  <pre><code class="language-{language}">{#if showLineNumbers}{#each lines as line, i}<span class="line-number">{i + 1}</span>{line}
{/each}{:else}{code}{/if}</code></pre>
</div>

<style>
  .code-block {
    position: relative;
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #151e2d;
    padding: 0.4rem 0.75rem;
    font-size: 0.75rem;
  }
  .language-label {
    color: #94a3b8;
    text-transform: uppercase;
    font-weight: 500;
    letter-spacing: 0.05em;
  }
  .copy-btn {
    background: transparent;
    border: 1px solid #334155;
    color: #94a3b8;
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .copy-btn:hover {
    color: #e2e8f0;
    border-color: #64748b;
  }
  pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 0.75rem;
    margin: 0;
    overflow-x: auto;
    font-size: 0.8rem;
    line-height: 1.5;
    font-family: 'Fira Code', 'Cascadia Code', monospace;
  }
  code {
    font-family: inherit;
  }
  .line-number {
    display: inline-block;
    width: 2.5em;
    text-align: right;
    padding-right: 1em;
    color: #475569;
    user-select: none;
  }
</style>
