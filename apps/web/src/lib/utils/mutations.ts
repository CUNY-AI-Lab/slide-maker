import { currentDeck, addSlideToDeck, removeSlideFromDeck, updateSlideInDeck } from '$lib/stores/deck'
import { activeSlideId } from '$lib/stores/ui'
import { history } from '$lib/stores/history'
import { get } from 'svelte/store'
import { API_URL } from '$lib/api'

async function apiCall(path: string, method: string, body?: unknown) {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (res.ok) return res.json()
    console.error('API persist failed:', res.status, await res.text())
  } catch (err) {
    console.error('API persist error:', err)
  }
  return null
}

export async function applyMutation(mutation: Record<string, unknown>): Promise<void> {
  const deck = get(currentDeck)
  if (!deck) return

  const payload = mutation.payload as Record<string, unknown>

  switch (mutation.action) {
    case 'updateArtifactConfig': {
      const { artifactName, config: newConfig } = payload as { artifactName: string; config: Record<string, unknown> }
      if (!artifactName || !newConfig) break

      // Find artifact definition for the original source
      const { findArtifactByName, ensureArtifactsLoaded } = await import('../stores/artifacts')
      await ensureArtifactsLoaded()
      const artifactDef = findArtifactByName(artifactName)

      // Find all matching artifact blocks across the deck
      const targets: { slideId: string; blockId: string; data: Record<string, unknown> }[] = []
      for (const s of deck.slides) {
        for (const b of s.blocks) {
          if (b.type !== 'artifact') continue
          const d = (b.data || {}) as Record<string, unknown>
          const name = String(d.artifactName || d.alt || '').trim()
          if (name && name.toLowerCase() === artifactName.toLowerCase()) {
            targets.push({ slideId: s.id, blockId: b.id, data: d })
          }
        }
      }

      // Apply updates to each target via updateBlock mutations
      for (const t of targets) {
        const prevCfg = (t.data.config as Record<string, unknown>) || {}
        const nextCfg = { ...prevCfg, ...newConfig }

        const nextData: Record<string, unknown> = { config: nextCfg }

        // Allow size controls via config keys too (width/height)
        if (typeof (newConfig as any).width === 'string') {
          nextData.width = (newConfig as any).width
        }
        if (typeof (newConfig as any).height === 'string') {
          nextData.height = (newConfig as any).height
        }

        // Rebuild rawSource from original artifact source with new config
        const originalSource = artifactDef?.source
        if (originalSource) {
          const { buildSourceWithConfig } = await import('../utils/artifact-config')
          nextData.rawSource = buildSourceWithConfig(originalSource, nextCfg)
        }

        await applyMutation({
          action: 'updateBlock',
          payload: { slideId: t.slideId, blockId: t.blockId, data: nextData },
        })
      }

      break
    }
    case 'addSlide': {
      const moduleDefs = (payload.modules as any[]) || []

      // Persist to API first — it generates the real IDs
      const result = await apiCall(`/api/decks/${deck.id}/slides`, 'POST', {
        layout: (payload.layout as string) || 'layout-split',
        splitRatio: payload.splitRatio,
        modules: moduleDefs,
        insertAfter: payload.insertAfter || undefined,
      })

      // API returns the slide at top level (not nested under .slide)
      const newSlide = result?.slide ?? result
      if (newSlide?.id) {
        const slide = {
          ...newSlide,
          blocks: newSlide.blocks || newSlide.modules || [],
        }
        addSlideToDeck(slide)
        // Auto-select the new slide
        activeSlideId.set(slide.id)

        // Track reverse mutation
        history.pushMutation(mutation, {
          action: 'removeSlide',
          payload: { slideId: slide.id },
        })
      }
      break
    }

    case 'removeSlide': {
      const slideId = payload.slideId as string
      await apiCall(`/api/decks/${deck.id}/slides/${slideId}`, 'DELETE')
      removeSlideFromDeck(slideId)
      break
    }

    case 'updateSlide': {
      const slideId = payload.slideId as string
      const updates: Record<string, unknown> = {}
      if (payload.notes !== undefined) updates.notes = payload.notes
      if (payload.splitRatio !== undefined) updates.splitRatio = payload.splitRatio
      if (payload.layout !== undefined) updates.layout = payload.layout
      await apiCall(`/api/decks/${deck.id}/slides/${slideId}`, 'PATCH', updates)
      updateSlideInDeck(slideId, (s) => ({
        ...s,
        ...(payload.notes !== undefined ? { notes: payload.notes as string | null } : {}),
        ...(payload.splitRatio !== undefined ? { splitRatio: payload.splitRatio as string } : {}),
        ...(payload.layout !== undefined ? { layout: payload.layout as string } : {}),
      }))
      break
    }

    case 'addBlock': {
      const slideId = payload.slideId as string
      const blockDef = payload.block as { type: string; zone?: string; data: Record<string, unknown>; stepOrder?: number }

      const result = await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks`, 'POST', {
        type: blockDef.type,
        zone: blockDef.zone || 'content',
        data: blockDef.data || {},
        stepOrder: blockDef.stepOrder,
      })

      if (result?.block) {
        updateSlideInDeck(slideId, (s) => ({
          ...s,
          blocks: [...s.blocks, result.block],
        }))

        history.pushMutation(mutation, {
          action: 'removeBlock',
          payload: { slideId, blockId: result.block.id },
        })
      }
      break
    }

    case 'removeBlock': {
      const slideId = payload.slideId as string
      const blockId = payload.blockId as string
      await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${blockId}`, 'DELETE')
      updateSlideInDeck(slideId, (s) => ({
        ...s,
        blocks: s.blocks.filter((b) => b.id !== blockId),
      }))
      break
    }

    case 'updateBlock': {
      const slideId = payload.slideId as string
      const blockId = payload.blockId as string
      const newData = payload.data as Record<string, unknown>

      // Capture old data for undo
      const currentSlide = deck.slides.find((s) => s.id === slideId)
      const oldBlock = currentSlide?.blocks.find((b) => b.id === blockId)
      const oldData = oldBlock ? { ...oldBlock.data } : {}

      await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${blockId}`, 'PATCH', {
        data: newData,
      })
      updateSlideInDeck(slideId, (s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === blockId ? { ...b, data: { ...b.data, ...newData } } : b,
        ),
      }))

      history.pushMutation(mutation, {
        action: 'updateBlock',
        payload: { slideId, blockId, data: oldData },
      })
      break
    }

    case 'setTheme': {
      const themeId = payload.themeId as string
      await apiCall(`/api/decks/${deck.id}`, 'PATCH', { themeId })
      currentDeck.update((d) => (d ? { ...d, themeId } : d))
      break
    }

    case 'updateMetadata':
    case 'updateDeckMeta': {
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

    case 'reorderSlides': {
      const order = payload.order as string[]
      await apiCall(`/api/decks/${deck.id}/slides/reorder`, 'POST', { order })
      currentDeck.update((d) => {
        if (!d) return d
        const slideMap = new Map(d.slides.map((s) => [s.id, s]))
        const reordered = order
          .map((id, idx) => {
            const slide = slideMap.get(id)
            return slide ? { ...slide, order: idx } : null
          })
          .filter(Boolean) as typeof d.slides
        return { ...d, slides: reordered }
      })
      break
    }

    case 'applyTemplate': {
      const templateId = payload.templateId as string
      const slideId = payload.slideId as string | undefined

      // Fetch template details
      const tmplData = await apiCall('/api/templates', 'GET')
      const template = (tmplData?.templates ?? []).find((t: any) => t.id === templateId)
      if (!template) {
        console.error('Template not found:', templateId)
        break
      }

      if (slideId) {
        // Replace slide content with template
        const slide = deck.slides.find((s) => s.id === slideId)
        if (slide) {
          // Snapshot old state for undo
          const oldLayout = slide.layout
          const oldBlocks = slide.blocks.map((b) => ({ type: b.type, zone: b.zone, data: { ...b.data }, stepOrder: b.stepOrder }))

          for (const block of slide.blocks) {
            await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${block.id}`, 'DELETE')
          }
          await apiCall(`/api/decks/${deck.id}/slides/${slideId}`, 'PATCH', { layout: template.layout })
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

          // Undo: restore old layout and blocks
          history.pushMutation(
            { action: 'applyTemplate', payload },
            { action: '_restoreSlide', payload: { slideId, layout: oldLayout, modules: oldBlocks } }
          )
        }
      } else {
        // Create new slide from template
        const result = await apiCall(`/api/decks/${deck.id}/slides`, 'POST', {
          layout: template.layout,
          modules: template.modules,
        })
        const newSlide = result?.slide ?? result
        if (newSlide?.id) {
          const slide = { ...newSlide, blocks: newSlide.blocks || newSlide.modules || [] }
          addSlideToDeck(slide)
          activeSlideId.set(slide.id)

          history.pushMutation(
            { action: 'applyTemplate', payload },
            { action: 'removeSlide', payload: { slideId: slide.id } }
          )
        }
      }
      break
    }

    default:
      console.warn('Unhandled mutation action:', mutation.action)
  }
}

/** Apply a mutation without recording history (used for undo/redo) */
async function applyMutationSilent(mutation: Record<string, unknown>): Promise<void> {
  const deck = get(currentDeck)
  if (!deck) return

  const payload = mutation.payload as Record<string, unknown>

  switch (mutation.action) {
    case 'removeSlide': {
      const slideId = payload.slideId as string
      await apiCall(`/api/decks/${deck.id}/slides/${slideId}`, 'DELETE')
      removeSlideFromDeck(slideId)
      break
    }
    case 'removeBlock': {
      const slideId = payload.slideId as string
      const blockId = payload.blockId as string
      await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${blockId}`, 'DELETE')
      updateSlideInDeck(slideId, (s) => ({
        ...s,
        blocks: s.blocks.filter((b) => b.id !== blockId),
      }))
      break
    }
    case 'updateBlock': {
      const slideId = payload.slideId as string
      const blockId = payload.blockId as string
      const newData = payload.data as Record<string, unknown>
      await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${blockId}`, 'PATCH', {
        data: newData,
      })
      updateSlideInDeck(slideId, (s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === blockId ? { ...b, data: { ...b.data, ...newData } } : b,
        ),
      }))
      break
    }
    case '_restoreSlide': {
      // Undo for applyTemplate replace path: delete current blocks, restore layout + old blocks
      const slideId = payload.slideId as string
      const layout = payload.layout as string
      const modules = payload.modules as { type: string; zone: string; data: Record<string, unknown>; stepOrder?: number | null }[]
      const slide = deck.slides.find((s) => s.id === slideId)
      if (slide) {
        for (const block of slide.blocks) {
          await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${block.id}`, 'DELETE')
        }
        await apiCall(`/api/decks/${deck.id}/slides/${slideId}`, 'PATCH', { layout })
        const newBlocks = []
        for (const mod of modules) {
          const result = await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks`, 'POST', {
            type: mod.type,
            zone: mod.zone,
            data: mod.data || {},
            stepOrder: mod.stepOrder,
          })
          if (result?.block) newBlocks.push(result.block)
        }
        updateSlideInDeck(slideId, (s) => ({ ...s, layout, blocks: newBlocks }))
      }
      break
    }
    default:
      // For any other action, just apply normally (won't double-push history
      // because applyMutation's history.pushMutation would be called, but
      // for safety we handle core cases above)
      await applyMutation(mutation)
  }
}

export async function undo(): Promise<void> {
  const entry = history.popUndo()
  if (!entry) return
  await applyMutationSilent(entry.reverseMutation)
}

export async function redo(): Promise<void> {
  const entry = history.popRedo()
  if (!entry) return
  await applyMutationSilent(entry.mutation)
}

/** Extract mutation blocks from assistant text (```mutation fences) */
export function extractMutations(text: string): Record<string, unknown>[] {
  const mutations: Record<string, unknown>[] = []
  const regex = /```mutation\s*\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    try {
      mutations.push(JSON.parse(match[1].trim()))
    } catch {
      /* skip malformed mutation JSON */
    }
  }
  return mutations
}
