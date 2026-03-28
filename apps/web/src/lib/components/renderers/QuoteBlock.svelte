<script lang="ts">
  let { data = {} }: { data: Record<string, unknown>; editable: boolean } = $props()

  let text = $derived(typeof data.text === 'string' ? data.text : '')
  let attribution = $derived(typeof data.attribution === 'string' ? data.attribution : '')
</script>

<blockquote class="quote-block">
  <p class="quote-text">{text}</p>
  {#if attribution}
    <cite class="quote-attribution">— {attribution}</cite>
  {/if}
</blockquote>

<style>
  .quote-block {
    border-left: 4px solid var(--color-primary);
    padding: 0.75rem 1rem;
    margin: 0;
    background: var(--color-bg-secondary);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }
  .quote-text {
    font-style: italic;
    font-size: 0.95rem;
    line-height: 1.6;
    margin: 0;
  }
  .quote-attribution {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    font-style: normal;
  }
</style>
