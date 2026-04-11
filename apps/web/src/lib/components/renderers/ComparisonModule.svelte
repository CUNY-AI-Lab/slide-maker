<script lang="ts">
  import RichTextEditor from './RichTextEditor.svelte'
  import { renderContent } from '$lib/utils/markdown'
  import DOMPurify from 'dompurify'
  import type { Editor } from '@tiptap/core'

  let { data = {}, editable = false, onchange, oneditorready, oneditorblur }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
    oneditorready?: (editor: Editor) => void;
    oneditorblur?: () => void;
  } = $props()

  let panels: Array<{ title: string; content: string }> = $derived(
    Array.isArray(data.panels)
      ? data.panels.map((p: unknown) => {
          const panel = p as Record<string, unknown>
          return {
            title: typeof panel.title === 'string' ? panel.title : '',
            content: typeof panel.content === 'string' ? panel.content : '',
          }
        })
      : []
  )

  let activeField: { panelIndex: number; field: 'title' | 'content' } | null = $state(null)
  let editContent = $state('')
  let clickCoords: { x: number; y: number } | null = $state(null)

  function activateField(panelIndex: number, field: 'title' | 'content', value: string, e: MouseEvent) {
    clickCoords = { x: e.clientX, y: e.clientY }
    editContent = field === 'content' ? renderContent(value) : DOMPurify.sanitize(value)
    activeField = { panelIndex, field }
  }

  function handleFieldChange(panelIndex: number, field: 'title' | 'content', html: string) {
    editContent = html
    const newPanels = panels.map((p, i) => i === panelIndex ? { ...p, [field]: html } : { ...p })
    onchange?.({ ...data, panels: newPanels })
  }
</script>

<div class="comparison">
  {#each panels as panel, i}
    <div class="comparison-panel">
      {#if editable && activeField?.panelIndex === i && activeField.field === 'title'}
        <h3>
          <RichTextEditor
            content={editContent}
            {editable}
            placeholder="Panel title..."
            onchange={(html) => handleFieldChange(i, 'title', html)}
            {oneditorready}
            {oneditorblur}
            initialClickCoords={clickCoords}
          />
        </h3>
      {:else if editable || panel.title}
        <h3>
          <button
            type="button"
            class="field-preview"
            class:placeholder-text={editable && !panel.title}
            onclick={(e) => activateField(i, 'title', panel.title, e)}
            disabled={!editable}
          >{#if panel.title}{@html DOMPurify.sanitize(panel.title)}{:else}Panel title...{/if}</button>
        </h3>
      {/if}

      {#if editable && activeField?.panelIndex === i && activeField.field === 'content'}
        <div class="panel-content">
          <RichTextEditor
            content={editContent}
            {editable}
            placeholder="Panel content..."
            onchange={(html) => handleFieldChange(i, 'content', html)}
            {oneditorready}
            {oneditorblur}
            initialClickCoords={clickCoords}
          />
        </div>
      {:else if editable}
        <div class="panel-content">
          <button
            type="button"
            class="field-preview"
            class:placeholder-text={!panel.content}
            onclick={(e) => activateField(i, 'content', panel.content, e)}
          >{#if panel.content}{@html renderContent(panel.content)}{:else}Panel content...{/if}</button>
        </div>
      {:else}
        <div class="panel-content">
          {@html renderContent(panel.content)}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .comparison {
    display: flex;
    gap: clamp(12px, 2.5cqi, 20px);
    width: 100%;
    font-family: var(--font-body);
  }
  .comparison-panel {
    flex: 1;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: clamp(14px, 3cqi, 24px);
  }
  .comparison-panel h3 {
    font-size: clamp(0.9rem, 1.6cqi, 1.3rem);
    margin: 0 0 8px 0;
    font-family: var(--font-display);
    font-weight: 600;
  }
  .panel-content {
    font-size: clamp(0.8rem, 1.3cqi, 1rem);
    line-height: 1.45;
    color: rgba(240, 240, 240, 0.65);
  }
  .field-preview {
    cursor: text;
    background: transparent;
    border: none;
    color: inherit;
    font: inherit;
    text-align: inherit;
    width: 100%;
    display: block;
    padding: 0;
    outline: none;
    line-height: inherit;
  }
  .field-preview:disabled {
    cursor: default;
  }
  .field-preview.placeholder-text {
    opacity: 0.4;
    font-style: italic;
  }
  .comparison-panel h3 :global(.tiptap),
  .comparison-panel h3 :global(.tiptap p) {
    font-size: clamp(0.9rem, 1.6cqi, 1.3rem);
    font-family: var(--font-display);
    font-weight: 600;
    line-height: 1.2;
    margin: 0;
  }
  .panel-content :global(.tiptap),
  .panel-content :global(.tiptap p) {
    font-size: clamp(0.8rem, 1.3cqi, 1rem);
    line-height: 1.45;
    color: rgba(240, 240, 240, 0.65);
    margin: 0;
  }
</style>
