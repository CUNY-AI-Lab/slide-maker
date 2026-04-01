# Agent Resource Wiring + Chat UI Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire templates, themes, and artifacts to the AI agent as actionable mutations, and redesign the chat/outline left panel with independently collapsible sections and minimalist styling.

**Architecture:** Two workstreams — (1) implement `applyTemplate` mutation handler + fix `updateMetadata` alias + expose template details in system prompt, (2) refactor EditorShell left panel into independently collapsible chat/outline sections with a minimalist chat restyle. Both are independent and can be worked in parallel.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Hono API, TypeScript

---

## File Map

### Workstream 1: Agent Resource Wiring
- Modify: `apps/web/src/lib/utils/mutations.ts` — add `applyTemplate` + `updateMetadata` alias handlers
- Modify: `apps/api/src/prompts/system.ts` — document `applyTemplate`, expose template modules, list theme IDs

### Workstream 2: Chat UI + Collapsible Panels
- Modify: `apps/web/src/lib/components/editor/EditorShell.svelte` — independent chat/outline collapse
- Modify: `apps/web/src/lib/components/chat/ChatPanel.svelte` — minimalist restyle
- Modify: `apps/web/src/lib/components/chat/ChatMessage.svelte` — cleaner message bubbles
- Modify: `apps/web/src/lib/components/chat/ChatInput.svelte` — larger input, cleaner styling

---

## Task 1: Implement `applyTemplate` Mutation Handler

**Files:**
- Modify: `apps/web/src/lib/utils/mutations.ts:236` (add case before `default`)

The type already exists in `packages/shared/src/mutations.ts:11`. The handler needs to:
1. Fetch the template from the API
2. Create a new slide using the template's layout + modules (reuses the existing `POST /api/decks/:id/slides` endpoint)
3. Update the local store

- [ ] **Step 1: Add `applyTemplate` case to `applyMutation`**

In `apps/web/src/lib/utils/mutations.ts`, add this case before the `default:` case (line 236):

```typescript
    case 'applyTemplate': {
      const templateId = payload.templateId as string
      const slideId = payload.slideId as string | undefined

      // Fetch template details
      const tmplRes = await fetch(`${API_URL}/api/templates`, { credentials: 'include' })
      const tmplData = await tmplRes.json()
      const template = (tmplData.templates ?? []).find((t: any) => t.id === templateId)
      if (!template) {
        console.error('Template not found:', templateId)
        break
      }

      // If slideId provided, replace that slide's content; otherwise create new slide
      if (slideId) {
        // Remove existing blocks from the slide
        const slide = deck.slides.find((s) => s.id === slideId)
        if (slide) {
          for (const block of slide.blocks) {
            await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${block.id}`, 'DELETE')
          }
          // Update layout
          await apiCall(`/api/decks/${deck.id}/slides/${slideId}`, 'PATCH', { layout: template.layout })
          // Add template modules
          const newBlocks = []
          for (const mod of template.modules) {
            const result = await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks`, 'POST', {
              type: mod.type,
              zone: mod.zone,
              data: mod.data || {},
              stepOrder: mod.stepOrder,
            })
            if (result?.block) newBlocks.push(result.block)
          }
          updateSlideInDeck(slideId, (s) => ({
            ...s,
            layout: template.layout,
            blocks: newBlocks,
          }))
        }
      } else {
        // Create new slide from template (same as TemplatesTab.applyTemplate)
        const result = await apiCall(`/api/decks/${deck.id}/slides`, 'POST', {
          layout: template.layout,
          modules: template.modules,
        })
        const newSlide = result?.slide ?? result
        if (newSlide?.id) {
          const slide = { ...newSlide, blocks: newSlide.blocks || newSlide.modules || [] }
          addSlideToDeck(slide)
          activeSlideId.set(slide.id)
        }
      }
      break
    }
```

- [ ] **Step 2: Add `updateMetadata` alias**

The system prompt documents `updateMetadata` but the handler only has `updateDeckMeta`. Add this case right after the `updateDeckMeta` case (after line 218):

```typescript
    case 'updateMetadata': {
      // Alias — system prompt uses this name
      const updates: Record<string, unknown> = {}
      if (payload.name !== undefined) updates.name = payload.name
      await apiCall(`/api/decks/${deck.id}`, 'PATCH', updates)
      currentDeck.update((d) => {
        if (!d) return d
        return {
          ...d,
          ...(payload.name !== undefined ? { name: payload.name as string } : {}),
        }
      })
      break
    }
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/zacharymuhlbauer/Desktop/STUDIO/projects/slide-maker && pnpm build`
Expected: Build succeeds with no TypeScript errors related to mutations.ts

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/utils/mutations.ts
git commit -m "feat(mutations): implement applyTemplate and updateMetadata alias"
```

---

## Task 2: Document `applyTemplate` in System Prompt + Expose Template Details

**Files:**
- Modify: `apps/api/src/prompts/system.ts:122-124` (templates section)
- Modify: `apps/api/src/prompts/system.ts:281-295` (mutation docs, add applyTemplate)

- [ ] **Step 1: Expose template module details in the prompt**

In `apps/api/src/prompts/system.ts`, replace the templates list generation (lines 122-124):

```typescript
  const templatesList = templates?.length
    ? templates.map((t) => {
        const modSummary = (t.modules as any[]).map((m: any) => `${m.type}(${m.zone})`).join(', ')
        return `  - "${t.name}" (id="${t.id}", layout="${t.layout}") → [${modSummary}]`
      }).join('\n')
    : '  (none loaded)'
```

- [ ] **Step 2: Add `applyTemplate` mutation documentation**

In `apps/api/src/prompts/system.ts`, after the `setTheme` documentation block (after line 289), add:

```typescript
### 9. applyTemplate
Apply a template to create a new slide, or replace the active slide's content with a template.
\`\`\`json
{ "action": "applyTemplate", "payload": { "templateId": "<templateId>" } }
\`\`\`
To replace an existing slide's content with the template layout and modules:
\`\`\`json
{ "action": "applyTemplate", "payload": { "slideId": "<slideId>", "templateId": "<templateId>" } }
\`\`\`
Use the template IDs from the Available Templates list above. When the user asks for a specific layout or style (e.g., "make this a comparison slide"), find the matching template and apply it.
```

- [ ] **Step 3: Renumber subsequent mutation docs**

Renumber `updateMetadata` to 10, `updateArtifactConfig` to 11. Update the line:
```
### 9. updateMetadata
```
to:
```
### 10. updateMetadata
```
And:
```
### 10. updateArtifactConfig
```
to:
```
### 11. updateArtifactConfig
```

- [ ] **Step 4: Add template-related guidance to the Guidelines section**

In the Guidelines section (around line 363), add:

```typescript
- When the user asks to change a slide's layout or style to match a known template, use \`applyTemplate\` instead of manually recreating the modules.
- When suggesting templates, mention them by name so the user can confirm before you apply.
```

- [ ] **Step 5: Add theme list with IDs to the theme section**

In `apps/api/src/prompts/system.ts`, the `BuildPromptOptions` interface already accepts a `theme` object. But the agent only sees the *current* theme — it needs the full list to pick from. Update the interface (line 55) to add `allThemes`:

```typescript
  allThemes?: { id: string; name: string }[]
```

Then update the `themeInfo` block (lines 126-128) to include the list:

```typescript
  const themeInfo = theme
    ? `  Current Theme: "${theme.name}" (id="${theme.id}")\n  Colors: ${JSON.stringify(theme.colors)}\n  Fonts: ${JSON.stringify(theme.fonts)}`
    : '  No theme set'

  const themeList = opts.allThemes?.length
    ? '\n  Available themes:\n' + opts.allThemes.map((t) => `    - "${t.name}" (id="${t.id}")`).join('\n')
    : ''
```

Then include `${themeList}` after `${themeInfo}` in the template string (line 324):

```typescript
${themeInfo}${themeList}
```

- [ ] **Step 6: Pass allThemes from the chat route**

In `apps/api/src/routes/chat.ts`, find where `buildSystemPrompt` is called and add `allThemes` to the options. Search for the call site and add:

```typescript
allThemes: themes.map((t: any) => ({ id: t.id, name: t.name })),
```

where `themes` is already fetched for the resource injection.

- [ ] **Step 7: Build and verify**

Run: `cd /Users/zacharymuhlbauer/Desktop/STUDIO/projects/slide-maker && pnpm build`
Expected: Clean build

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/prompts/system.ts apps/api/src/routes/chat.ts
git commit -m "feat(prompt): expose applyTemplate, template details, and theme list to agent"
```

---

## Task 3: Independent Chat/Outline Collapse in EditorShell

**Files:**
- Modify: `apps/web/src/lib/components/editor/EditorShell.svelte`

The left panel currently stacks ChatPanel (flex:1) over SlideOutline (fixed 260px). We'll add independent collapse toggles so each section can be collapsed, giving the other full height.

- [ ] **Step 1: Add collapse state variables**

In `apps/web/src/lib/components/editor/EditorShell.svelte`, after line 14 (`let rightCollapsed = $state(false)`), add:

```typescript
  let chatCollapsed = $state(false)
  let outlineCollapsed = $state(false)
```

- [ ] **Step 2: Replace the left panel markup**

Replace the left panel content (lines 110-117):

```svelte
    <div class="left-panel" style:width="{leftWidth}px" style:min-width="{leftWidth}px">
      {#if !chatCollapsed && !outlineCollapsed}
        <!-- Both visible: stacked with divider -->
        <div class="chat-section">
          <div class="section-header">
            <span class="section-label">Chat</span>
            <button class="section-toggle" onclick={() => chatCollapsed = true} title="Collapse chat" aria-label="Collapse chat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            </button>
          </div>
          <ChatPanel />
        </div>
        <div class="outline-section">
          <div class="section-header">
            <span class="section-label">Slides</span>
            <button class="section-toggle" onclick={() => outlineCollapsed = true} title="Collapse outline" aria-label="Collapse outline">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            </button>
          </div>
          <SlideOutline />
        </div>
      {:else if chatCollapsed}
        <!-- Outline fills full height, chat collapsed to tab -->
        <div class="collapsed-tab top" >
          <button class="tab-restore" onclick={() => chatCollapsed = false} title="Expand chat" aria-label="Expand chat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            <span>Chat</span>
          </button>
        </div>
        <div class="outline-section full">
          <div class="section-header">
            <span class="section-label">Slides</span>
            <button class="section-toggle" onclick={() => outlineCollapsed = true} title="Collapse outline" aria-label="Collapse outline">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            </button>
          </div>
          <SlideOutline />
        </div>
      {:else}
        <!-- Chat fills full height, outline collapsed to tab -->
        <div class="chat-section full">
          <div class="section-header">
            <span class="section-label">Chat</span>
            <button class="section-toggle" onclick={() => chatCollapsed = true} title="Collapse chat" aria-label="Collapse chat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            </button>
          </div>
          <ChatPanel />
        </div>
        <div class="collapsed-tab bottom">
          <button class="tab-restore" onclick={() => outlineCollapsed = false} title="Expand outline" aria-label="Expand outline">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            <span>Slides</span>
          </button>
        </div>
      {/if}
    </div>
```

- [ ] **Step 3: Add CSS for collapse controls**

In the `<style>` section, replace the `.chat-section` and `.outline-section` rules and add new ones:

```css
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border);
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-muted);
  }

  .section-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 4px;
    padding: 0;
    transition: color 0.15s, background 0.15s;
  }

  .section-toggle:hover {
    color: var(--color-primary);
    background: var(--color-ghost-bg);
  }

  .chat-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .chat-section.full {
    flex: 1;
    height: 0;
  }

  .outline-section {
    height: 260px;
    min-height: 200px;
    overflow-y: auto;
    border-top: 1px solid var(--color-border);
  }

  .outline-section.full {
    flex: 1;
    height: 0;
    min-height: 0;
    border-top: none;
  }

  .collapsed-tab {
    flex-shrink: 0;
  }

  .collapsed-tab.top {
    border-bottom: 1px solid var(--color-border);
  }

  .collapsed-tab.bottom {
    border-top: 1px solid var(--color-border);
  }

  .tab-restore {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .tab-restore:hover {
    color: var(--color-primary);
    background: var(--color-ghost-bg);
  }
```

- [ ] **Step 4: Handle edge case — both collapsed**

If the user collapses both, restore the most recently collapsed. Add after the state variables:

```typescript
  // Prevent both from being collapsed simultaneously
  $effect(() => {
    if (chatCollapsed && outlineCollapsed) {
      outlineCollapsed = false
    }
  })
```

- [ ] **Step 5: Update view mode effect to also collapse inner sections**

Update the canvas mode effect (lines 26-39) to save/restore chat+outline state:

```typescript
  let savedChat = false
  let savedOutline = false

  $effect(() => {
    const mode = canvasMode
    untrack(() => {
      if (mode === 'view') {
        savedLeft = leftCollapsed
        savedRight = rightCollapsed
        savedChat = chatCollapsed
        savedOutline = outlineCollapsed
        leftCollapsed = true
        rightCollapsed = true
      } else {
        leftCollapsed = savedLeft
        rightCollapsed = savedRight
        chatCollapsed = savedChat
        outlineCollapsed = savedOutline
      }
    })
  })
```

- [ ] **Step 6: Build and verify**

Run: `cd /Users/zacharymuhlbauer/Desktop/STUDIO/projects/slide-maker && pnpm build`
Expected: Clean build

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/components/editor/EditorShell.svelte
git commit -m "ux(editor): independently collapsible chat and outline sections"
```

---

## Task 4: Minimalist Chat Restyle

**Files:**
- Modify: `apps/web/src/lib/components/chat/ChatPanel.svelte`
- Modify: `apps/web/src/lib/components/chat/ChatMessage.svelte`
- Modify: `apps/web/src/lib/components/chat/ChatInput.svelte`

- [ ] **Step 1: Simplify ChatPanel header**

In `ChatPanel.svelte`, replace the chat header markup (lines 230-256) with a cleaner version that moves the brand title into the section header (handled by EditorShell now) and keeps only the controls:

```svelte
<div class="chat-panel">
  <div class="chat-header">
    <div class="chat-controls">
      <ModelSelector />
      {#if $chatStreaming}
        <button class="stop-btn" title="Stop response" onclick={stopStreaming} aria-label="Stop streaming">Stop</button>
      {/if}
      <div class="reset-wrap" style="margin-left: auto;">
        <button
          class="reset-btn"
          title={$chatStreaming ? 'Wait for response to finish' : 'Reset chat'}
          onclick={resetChat}
          disabled={clearing || $chatStreaming}
          aria-label="Reset chat"
        >
          {clearing ? '...' : (showConfirm ? 'Confirm' : 'Reset')}
        </button>
        {#if showConfirm}
          <div class="confirm-pop">
            <label>Type <b>RESET</b> to confirm</label>
            <input class="confirm-input" type="text" bind:value={confirmText} placeholder="RESET" />
            <button class="confirm-cancel" onclick={() => { showConfirm = false; confirmText = '' }}>Cancel</button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="messages" bind:this={messagesContainer}>
    {#if messages.length === 0}
      <div class="empty-state">
        <p>Ask the AI to build slides for you.</p>
      </div>
    {:else}
      {#each messages as msg (msg.id)}
        <ChatMessage message={msg} />
      {/each}
    {/if}
  </div>

  <ChatInput onsend={handleSend} />
</div>
```

- [ ] **Step 2: Update ChatPanel styles for minimalism**

Replace the style section with cleaner rules:

```css
  .chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .chat-header {
    flex-shrink: 0;
  }

  .chat-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
  }

  .reset-wrap { position: relative; }

  .stop-btn {
    padding: 3px 8px;
    font-size: 11px;
    border: 1px solid #ef4444;
    border-radius: var(--radius-sm);
    background: transparent;
    color: #ef4444;
    cursor: pointer;
    transition: background 0.15s;
  }
  .stop-btn:hover {
    background: rgba(239, 68, 68, 0.08);
  }

  .reset-btn {
    padding: 3px 8px;
    font-size: 11px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .reset-btn:hover:not(:disabled) {
    background: var(--color-ghost-bg);
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .reset-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .confirm-pop {
    position: absolute;
    right: 0;
    top: 32px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    z-index: 10;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
    font-size: 12px;
  }
  .confirm-input { width: 80px; padding: 3px 6px; font-size: 11px; border: 1px solid var(--color-border); border-radius: 4px; }
  .confirm-cancel { background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 11px; }

  .messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 0;
    min-height: 0;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 24px;
    text-align: center;
  }

  .empty-state p {
    font-size: 13px;
    color: var(--color-text-muted);
    line-height: 1.5;
  }
```

- [ ] **Step 3: Restyle ChatMessage for minimalism**

In `ChatMessage.svelte`, replace the style block:

```css
  .chat-message {
    padding: 8px 12px;
    margin: 2px 10px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    line-height: 1.55;
    max-width: 90%;
  }

  .chat-message.user {
    align-self: flex-end;
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    color: var(--color-text);
    margin-left: auto;
  }

  .chat-message.assistant {
    align-self: flex-start;
    background: transparent;
    color: var(--color-text);
    margin-right: auto;
    border-left: 2px solid var(--color-border);
  }

  .message-role {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
    color: var(--color-text-muted);
  }

  .message-content {
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .message-content :global(.code-block) {
    margin: 6px 0;
    background: var(--color-bg-tertiary, #1e1e1e);
    border-radius: 4px;
    overflow-x: auto;
    position: relative;
  }

  .message-content :global(.code-block pre) {
    margin: 0;
    padding: 8px 10px;
    font-size: 12px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    line-height: 1.4;
  }

  .message-content :global(.code-block code) {
    color: var(--color-text);
  }

  .message-content :global(.code-lang) {
    position: absolute;
    top: 4px;
    right: 6px;
    font-size: 10px;
    opacity: 0.5;
  }

  .message-content :global(.inline-code) {
    background: var(--color-bg-tertiary, #e8e8e8);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 12px;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .cursor-blink {
    display: inline-block;
    width: 2px;
    height: 13px;
    background: var(--color-primary, #2563eb);
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
```

- [ ] **Step 4: Restyle ChatInput for prominence**

In `ChatInput.svelte`, replace the style block:

```css
  .chat-input {
    display: flex;
    gap: 6px;
    padding: 10px;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg);
    position: relative;
  }

  .chat-input.drag-over {
    border-color: var(--color-primary);
    background: rgba(59, 115, 230, 0.04);
  }

  .drop-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(59, 115, 230, 0.08);
    border: 2px dashed var(--color-primary);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-primary);
    z-index: 5;
    pointer-events: none;
  }

  textarea {
    flex: 1;
    resize: none;
    padding: 8px 10px;
    font-size: 13px;
    font-family: inherit;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    color: var(--color-text);
    outline: none;
    line-height: 1.45;
    transition: border-color 0.15s;
  }

  textarea:focus {
    border-color: var(--color-primary);
  }

  textarea:disabled {
    opacity: 0.5;
  }

  button {
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-primary);
    cursor: pointer;
    align-self: flex-end;
    min-width: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  button:hover:not(:disabled) {
    background: var(--color-ghost-bg);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(59, 115, 230, 0.2);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .add-menu {
    position: absolute;
    bottom: 100%;
    left: 10px;
    right: 10px;
    margin-bottom: 4px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 4px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    z-index: 10;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
  }

  .add-menu-item {
    padding: 6px 8px;
    font-size: 12px;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--color-text);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }

  .add-menu-item:hover {
    background: var(--color-ghost-bg);
    color: var(--color-primary);
  }
```

- [ ] **Step 5: Build and verify**

Run: `cd /Users/zacharymuhlbauer/Desktop/STUDIO/projects/slide-maker && pnpm build`
Expected: Clean build

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/components/chat/ChatPanel.svelte apps/web/src/lib/components/chat/ChatMessage.svelte apps/web/src/lib/components/chat/ChatInput.svelte
git commit -m "ux(chat): minimalist restyle with cleaner messages and prominent input"
```

---

## Task 5: Responsive CSS Polish

**Files:**
- Modify: `apps/web/src/lib/components/editor/EditorShell.svelte` (style section)

- [ ] **Step 1: Add responsive rules for inner panel collapse**

Add media queries that auto-collapse the outline on narrow left panels:

```css
  @media (max-width: 1024px) {
    .left-panel {
      max-width: 240px;
    }
    .right-panel {
      max-width: 220px;
    }
    .outline-section:not(.full) {
      height: 200px;
      min-height: 160px;
    }
  }

  @media (max-width: 860px) {
    .left-panel {
      max-width: 200px;
    }
    .right-panel {
      max-width: 180px;
    }
  }
```

This replaces the existing media query blocks (lines 348-364).

- [ ] **Step 2: Add smooth transitions for section collapse**

Add transition rules for the collapsible sections:

```css
  .chat-section, .outline-section, .collapsed-tab {
    transition: flex 0.2s ease, height 0.2s ease;
  }
```

- [ ] **Step 3: Remove the old `.chat-section` border-bottom rule**

The old rule had `border-bottom: 2px solid var(--color-border)` on `.chat-section`. This is now handled by `.outline-section { border-top }` and `.collapsed-tab.bottom { border-top }`. Ensure the old rule is removed (it was replaced in Task 3).

- [ ] **Step 4: Build and verify**

Run: `cd /Users/zacharymuhlbauer/Desktop/STUDIO/projects/slide-maker && pnpm build`
Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/components/editor/EditorShell.svelte
git commit -m "ux(editor): responsive polish for collapsible inner panels"
```
