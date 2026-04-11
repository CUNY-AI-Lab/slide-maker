<script lang="ts">
  import RichTextEditor from './RichTextEditor.svelte'
  import DOMPurify from 'dompurify'
  import type { Editor } from '@tiptap/core'

  let { data = {}, editable = false, onchange, oneditorready, oneditorblur }: {
    data: Record<string, unknown>;
    editable: boolean;
    onchange?: (newData: Record<string, unknown>) => void;
    oneditorready?: (editor: Editor) => void;
    oneditorblur?: () => void;
  } = $props()

  let nodes: Array<{ icon?: string; label: string; description?: string }> = $derived(
    Array.isArray(data.nodes)
      ? data.nodes.map((n: unknown) => {
          const node = n as Record<string, unknown>
          return {
            icon: typeof node.icon === 'string' ? node.icon : undefined,
            label: typeof node.label === 'string' ? node.label : '',
            description: typeof node.description === 'string' ? node.description : undefined,
          }
        })
      : []
  )

  let activeField: { nodeIndex: number; field: 'label' | 'description' } | null = $state(null)
  let editContent = $state('')
  let clickCoords: { x: number; y: number } | null = $state(null)

  function activateField(nodeIndex: number, field: 'label' | 'description', value: string, e: MouseEvent) {
    clickCoords = { x: e.clientX, y: e.clientY }
    editContent = value
    activeField = { nodeIndex, field }
  }

  function handleFieldChange(nodeIndex: number, field: 'label' | 'description', html: string) {
    editContent = html
    const newNodes = nodes.map((n, i) => i === nodeIndex ? { ...n, [field]: html } : { ...n })
    onchange?.({ ...data, nodes: newNodes })
  }
</script>

<div class="flow">
  {#each nodes as node, i}
    <div class="flow-node">
      <div class="flow-icon">
        {#if node.icon}
          {node.icon}
        {:else}
          {i + 1}
        {/if}
      </div>
      <div class="flow-body">
        {#if editable && activeField?.nodeIndex === i && activeField.field === 'label'}
          <div class="flow-label">
            <RichTextEditor
              content={editContent}
              {editable}
              placeholder="Label..."
              onchange={(html) => handleFieldChange(i, 'label', html)}
              {oneditorready}
              {oneditorblur}
              initialClickCoords={clickCoords}
            />
          </div>
        {:else if editable}
          <button
            type="button"
            class="field-preview flow-label"
            onclick={(e) => activateField(i, 'label', node.label, e)}
          >{@html DOMPurify.sanitize(node.label)}</button>
        {:else}
          <div class="flow-label">{@html DOMPurify.sanitize(node.label)}</div>
        {/if}

        {#if editable && activeField?.nodeIndex === i && activeField.field === 'description'}
          <div class="flow-desc">
            <RichTextEditor
              content={editContent}
              {editable}
              placeholder="Description..."
              onchange={(html) => handleFieldChange(i, 'description', html)}
              {oneditorready}
              {oneditorblur}
              initialClickCoords={clickCoords}
            />
          </div>
        {:else if editable || node.description}
          <button
            type="button"
            class="field-preview flow-desc"
            class:placeholder-text={editable && !node.description}
            onclick={(e) => activateField(i, 'description', node.description ?? '', e)}
            disabled={!editable}
          >{#if node.description}{@html DOMPurify.sanitize(node.description)}{:else}Description...{/if}</button>
        {/if}
      </div>
    </div>
    {#if i < nodes.length - 1}
      <div class="flow-arrow"></div>
    {/if}
  {/each}
</div>

<style>
  .flow {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .flow-node {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: clamp(10px, 1.8cqi, 14px) clamp(14px, 2.8cqi, 22px);
    font-size: clamp(0.8rem, 1.3cqi, 1rem);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .flow-icon {
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    background: var(--accent-cyan, #64b5f6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-weight: 700;
    font-size: 0.7rem;
    font-family: var(--font-display);
  }
  .flow-arrow {
    font-size: 1.2rem;
    color: rgba(240, 240, 240, 0.65);
  }
  .flow-arrow::after {
    content: '→';
  }
  .flow-body {
    min-width: 0;
  }
  .flow-label {
    font-weight: 600;
    font-size: clamp(0.8rem, 1.3cqi, 1rem);
    font-family: var(--font-display);
    line-height: 1.2;
  }
  .flow-label :global(p) {
    margin: 0;
  }
  .flow-desc {
    font-size: clamp(0.7rem, 1cqi, 0.85rem);
    color: rgba(240, 240, 240, 0.65);
    font-family: var(--font-body);
    line-height: 1.4;
  }
  .flow-desc :global(p) {
    margin: 0;
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
  .flow-label :global(.tiptap),
  .flow-label :global(.tiptap p) {
    font-weight: 600;
    font-size: clamp(0.8rem, 1.3cqi, 1rem);
    font-family: var(--font-display);
    line-height: 1.2;
    margin: 0;
  }
  .flow-desc :global(.tiptap),
  .flow-desc :global(.tiptap p) {
    font-size: clamp(0.7rem, 1cqi, 0.85rem);
    color: rgba(240, 240, 240, 0.65);
    font-family: var(--font-body);
    line-height: 1.4;
    margin: 0;
  }
</style>
