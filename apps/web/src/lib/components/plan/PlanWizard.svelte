<script lang="ts">
  import { get } from 'svelte/store'
  import { api } from '$lib/api'
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId } from '$lib/stores/ui'
  import { selectedModelId } from '$lib/stores/chat'
  import type { DeckPlan, FidelityMode } from '@slide-maker/shared'

  let { onclose }: { onclose: () => void } = $props()

  // Wizard state
  let step = $state<1 | 2 | 3 | 4>(1)
  let loading = $state(false)
  let error = $state('')

  // Step 1: Upload
  let fileInput: HTMLInputElement | undefined = $state()
  let uploadedFile = $state<{ id: string; filename: string; mimeType: string } | null>(null)

  // Step 2: Configure
  let fidelity = $state<FidelityMode>('balanced')
  let slideMin = $state(5)
  let slideMax = $state(20)
  let budgetAdjusted = $state(false)

  // Step 3: Plan preview
  let plan = $state<DeckPlan | null>(null)
  let warnings = $state<string[]>([])
  let hasExistingSlides = $state(false)
  let removedPlanIds = $state<Set<string>>(new Set())

  // Step 4: Apply progress
  let applying = $state(false)
  let applyResult = $state<{ count: number } | null>(null)

  const activePlanSlides = $derived(
    plan?.slides.filter(s => !removedPlanIds.has(s.planId)) ?? []
  )

  async function handleUpload() {
    const deck = get(currentDeck)
    if (!deck || !fileInput?.files?.length) return

    loading = true
    error = ''
    try {
      const file = fileInput.files[0]
      const result = await api.uploadFile(deck.id, file)
      uploadedFile = result.file
      step = 2
    } catch (err: any) {
      error = err.message || 'Upload failed'
    } finally {
      loading = false
    }
  }

  async function generatePlan() {
    const deck = get(currentDeck)
    if (!deck || !uploadedFile) return

    loading = true
    error = ''
    try {
      const modelId = get(selectedModelId)
      const slideRange = budgetAdjusted ? { min: slideMin, max: slideMax } : undefined
      const result = await api.planDeck(deck.id, uploadedFile.id, fidelity, modelId, slideRange)
      plan = result.plan
      warnings = result.warnings ?? []
      hasExistingSlides = result.hasExistingSlides
      removedPlanIds = new Set()

      // Update budget display from the plan
      if (plan?.estimatedSlideCount) {
        slideMin = plan.estimatedSlideCount.min
        slideMax = plan.estimatedSlideCount.max
      }

      step = 3
    } catch (err: any) {
      error = err.message || 'Failed to generate plan'
    } finally {
      loading = false
    }
  }

  function toggleSlide(planId: string) {
    const next = new Set(removedPlanIds)
    if (next.has(planId)) {
      next.delete(planId)
    } else {
      next.add(planId)
    }
    removedPlanIds = next
  }

  async function applyPlan() {
    const deck = get(currentDeck)
    if (!deck || !plan) return

    applying = true
    error = ''
    try {
      const filteredPlan = {
        ...plan,
        slides: activePlanSlides,
      }
      const result = await api.applyPlan(deck.id, filteredPlan, uploadedFile?.id)
      const newSlides = result.slides ?? []
      applyResult = { count: newSlides.length }

      // Refresh the deck state
      const deckData: any = await api.getDeck(deck.id)
      const refreshed = deckData.deck ?? deckData
      if (refreshed?.id) {
        currentDeck.set({
          ...refreshed,
          slides: refreshed.slides ?? [],
        })
        // Select the first new slide
        if (newSlides.length > 0) {
          activeSlideId.set(newSlides[0].id)
        }
      }

      step = 4
    } catch (err: any) {
      error = err.message || 'Failed to apply plan'
    } finally {
      applying = false
    }
  }

  function purposeBadge(purpose: string): string {
    switch (purpose) {
      case 'title': return 'Title'
      case 'divider': return 'Divider'
      case 'content': return 'Content'
      case 'quote': return 'Quote'
      case 'visual': return 'Visual'
      case 'closing': return 'Closing'
      default: return purpose
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="wizard-backdrop" onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="wizard-overlay" onclick={onclose}></div>
  <div class="wizard-modal" role="dialog" aria-label="Import outline">
    <div class="wizard-header">
      <h2>Import Outline</h2>
      <button class="wizard-close" onclick={onclose} aria-label="Close">&times;</button>
    </div>

    <div class="wizard-steps">
      <span class="step-dot" class:active={step >= 1} class:done={step > 1}>1</span>
      <span class="step-line" class:done={step > 1}></span>
      <span class="step-dot" class:active={step >= 2} class:done={step > 2}>2</span>
      <span class="step-line" class:done={step > 2}></span>
      <span class="step-dot" class:active={step >= 3} class:done={step > 3}>3</span>
      <span class="step-line" class:done={step > 3}></span>
      <span class="step-dot" class:active={step >= 4}>4</span>
    </div>

    <div class="wizard-body">
      {#if step === 1}
        <div class="step-content">
          <h3>Upload Source Document</h3>
          <p class="step-desc">Upload a PDF, DOCX, or Markdown file containing your presentation outline.</p>
          <input
            bind:this={fileInput}
            type="file"
            accept=".pdf,.docx,.doc,.md,.markdown,.txt"
            class="file-input"
          />
          {#if error}
            <p class="error-msg">{error}</p>
          {/if}
          <div class="step-actions">
            <button class="ghost-btn" onclick={onclose}>Cancel</button>
            <button class="primary-btn" onclick={handleUpload} disabled={loading}>
              {loading ? 'Uploading...' : 'Upload & Parse'}
            </button>
          </div>
        </div>

      {:else if step === 2}
        <div class="step-content">
          <h3>Configure Plan</h3>
          <p class="step-desc">File: <strong>{uploadedFile?.filename}</strong></p>

          <div class="config-group">
            <label for="fidelity-select">Fidelity Mode</label>
            <select id="fidelity-select" bind:value={fidelity}>
              <option value="strict">Strict — preserve exact wording</option>
              <option value="balanced">Balanced — preserve claims, allow compression</option>
              <option value="interpretive">Interpretive — rewrite for visual impact</option>
            </select>
          </div>

          <div class="config-group">
            <label>
              <input type="checkbox" bind:checked={budgetAdjusted} />
              Adjust slide count (default: auto-estimated)
            </label>
            {#if budgetAdjusted}
              <div class="range-inputs">
                <label>
                  Min: <input type="number" bind:value={slideMin} min={1} max={60} />
                </label>
                <label>
                  Max: <input type="number" bind:value={slideMax} min={slideMin} max={60} />
                </label>
              </div>
            {/if}
          </div>

          {#if error}
            <p class="error-msg">{error}</p>
          {/if}
          <div class="step-actions">
            <button class="ghost-btn" onclick={() => { step = 1; error = '' }}>Back</button>
            <button class="primary-btn" onclick={generatePlan} disabled={loading}>
              {loading ? 'Planning...' : 'Generate Plan'}
            </button>
          </div>
        </div>

      {:else if step === 3}
        <div class="step-content">
          <h3>Review Plan</h3>
          <p class="step-desc">
            {activePlanSlides.length} slide{activePlanSlides.length !== 1 ? 's' : ''} planned.
            {#if hasExistingSlides}
              <span class="warn-text">Slides will be added after existing content.</span>
            {/if}
          </p>

          {#if warnings.length > 0}
            <div class="warnings">
              {#each warnings as w}
                <p class="warn-text">{w}</p>
              {/each}
            </div>
          {/if}

          <div class="plan-list">
            {#each plan?.slides ?? [] as slide, i}
              {@const removed = removedPlanIds.has(slide.planId)}
              <div class="plan-slide" class:removed>
                <label class="plan-slide-check">
                  <input type="checkbox" checked={!removed} onchange={() => toggleSlide(slide.planId)} />
                  <span class="plan-slide-num">{i + 1}</span>
                </label>
                <div class="plan-slide-info">
                  <span class="plan-slide-title">{slide.title || '(untitled)'}</span>
                  <span class="badge layout-badge">{slide.layout}</span>
                  <span class="badge purpose-badge">{purposeBadge(slide.purpose)}</span>
                  <span class="plan-slide-modules">{slide.modules?.length ?? 0} modules</span>
                </div>
              </div>
            {/each}
          </div>

          {#if plan?.omissions && plan.omissions.length > 0}
            <details class="omissions">
              <summary>{plan.omissions.length} omitted node{plan.omissions.length !== 1 ? 's' : ''}</summary>
              <ul>
                {#each plan.omissions as om}
                  <li><code>{om.nodeId}</code>: {om.reason}</li>
                {/each}
              </ul>
            </details>
          {/if}

          {#if error}
            <p class="error-msg">{error}</p>
          {/if}
          <div class="step-actions">
            <button class="ghost-btn" onclick={() => { step = 2; error = '' }}>Back</button>
            <button class="ghost-btn" onclick={() => { step = 2; error = '' }}>Re-plan</button>
            <button class="primary-btn" onclick={applyPlan} disabled={applying || activePlanSlides.length === 0}>
              {applying ? 'Creating slides...' : `Create ${activePlanSlides.length} Slides`}
            </button>
          </div>
        </div>

      {:else if step === 4}
        <div class="step-content step-done">
          <h3>Done</h3>
          <p class="step-desc">
            Created {applyResult?.count ?? 0} slide{(applyResult?.count ?? 0) !== 1 ? 's' : ''}.
            Your deck is ready for editing.
          </p>
          <div class="step-actions">
            <button class="primary-btn" onclick={onclose}>Start Editing</button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .wizard-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .wizard-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
  }

  .wizard-modal {
    position: relative;
    background: var(--color-bg, #ffffff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 12px;
    width: 560px;
    max-width: 90vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  }

  .wizard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 0;
  }

  .wizard-header h2 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: var(--color-text, #333333);
  }

  .wizard-close {
    background: transparent;
    border: none;
    font-size: 20px;
    color: var(--color-text-muted, #636b75);
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }
  .wizard-close:hover { color: var(--color-text, #333333); }

  .wizard-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 12px 20px;
  }

  .step-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid var(--color-border, #e2e8f0);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: var(--color-text-muted, #636b75);
    background: transparent;
    flex-shrink: 0;
  }
  .step-dot.active {
    border-color: var(--color-primary, #3564d0);
    color: var(--color-primary, #3564d0);
  }
  .step-dot.done {
    background: var(--color-primary, #3564d0);
    border-color: var(--color-primary, #3564d0);
    color: #fff;
  }

  .step-line {
    width: 40px;
    height: 1px;
    background: var(--color-border, #e2e8f0);
  }
  .step-line.done {
    background: var(--color-primary, #3564d0);
  }

  .wizard-body {
    padding: 0 20px 20px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .step-content h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 4px;
    color: var(--color-text, #333333);
  }

  .step-desc {
    font-size: 12px;
    color: var(--color-text-muted, #636b75);
    margin: 0 0 12px;
    line-height: 1.5;
  }

  .file-input {
    display: block;
    width: 100%;
    padding: 10px;
    border: 1px dashed var(--color-border, #e2e8f0);
    border-radius: var(--radius-sm, 6px);
    background: var(--color-bg-secondary, #f8fafc);
    color: var(--color-text, #333333);
    font-size: 12px;
    margin-bottom: 12px;
  }
  .file-input::file-selector-button {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    border: 1px solid var(--color-primary, #3564d0);
    color: var(--color-primary, #3564d0);
    border-radius: var(--radius-sm, 6px);
    padding: 4px 10px;
    font-size: 11px;
    cursor: pointer;
    margin-right: 8px;
  }

  .config-group {
    margin-bottom: 12px;
  }
  .config-group label {
    display: block;
    font-size: 12px;
    color: var(--color-text-muted, #636b75);
    margin-bottom: 4px;
  }
  .config-group select, .config-group input[type="number"] {
    background: var(--color-bg-secondary, #f8fafc);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-sm, 6px);
    color: var(--color-text, #333333);
    padding: 6px 8px;
    font-size: 12px;
    width: 100%;
  }
  .config-group input[type="checkbox"] {
    accent-color: var(--color-primary, #3564d0);
    margin-right: 4px;
  }

  .range-inputs {
    display: flex;
    gap: 12px;
    margin-top: 6px;
  }
  .range-inputs label {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }
  .range-inputs input[type="number"] {
    width: 70px;
    flex: 0;
  }

  .plan-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-sm, 6px);
    margin-bottom: 12px;
  }

  .plan-slide {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    font-size: 12px;
  }
  .plan-slide:last-child { border-bottom: none; }
  .plan-slide.removed { opacity: 0.4; }

  .plan-slide-check {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .plan-slide-check input { accent-color: var(--color-primary, #3564d0); }
  .plan-slide-num {
    font-size: 10px;
    color: var(--color-text-muted, #636b75);
    min-width: 16px;
  }

  .plan-slide-info {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    flex-wrap: wrap;
  }

  .plan-slide-title {
    color: var(--color-text, #333333);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }
  .layout-badge {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    color: var(--color-primary, #3564d0);
    border: 1px solid color-mix(in srgb, var(--color-primary, #3564d0) 30%, transparent);
  }
  .purpose-badge {
    background: color-mix(in srgb, var(--color-accent, #2FB8D6) 8%, transparent);
    color: var(--color-accent, #2FB8D6);
    border: 1px solid color-mix(in srgb, var(--color-accent, #2FB8D6) 30%, transparent);
  }

  .plan-slide-modules {
    font-size: 10px;
    color: var(--color-text-muted, #636b75);
    margin-left: auto;
  }

  .omissions {
    font-size: 11px;
    color: var(--color-text-muted, #636b75);
    margin-bottom: 12px;
  }
  .omissions summary { cursor: pointer; }
  .omissions ul { padding-left: 16px; margin: 4px 0; }
  .omissions li { margin: 2px 0; }
  .omissions code { font-size: 10px; }

  .warnings { margin-bottom: 8px; }
  .warn-text {
    font-size: 11px;
    color: var(--color-warning, #ffb81c);
  }

  .error-msg {
    font-size: 12px;
    color: var(--color-error, #ef4444);
    margin: 8px 0;
  }

  .step-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 8px;
  }

  .ghost-btn {
    padding: 6px 14px;
    font-size: 12px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--color-text-muted, #636b75);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .ghost-btn:hover {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    color: var(--color-primary, #3564d0);
    border-color: var(--color-primary, #3564d0);
  }

  .primary-btn {
    padding: 6px 14px;
    font-size: 12px;
    border: 1px solid var(--color-primary, #3564d0);
    border-radius: var(--radius-sm, 6px);
    background: transparent;
    color: var(--color-primary, #3564d0);
    cursor: pointer;
    transition: background 0.15s;
  }
  .primary-btn:hover:not(:disabled) {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
  }
  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .step-done {
    text-align: center;
    padding-top: 20px;
  }
  .step-done .step-actions {
    justify-content: center;
  }
</style>
