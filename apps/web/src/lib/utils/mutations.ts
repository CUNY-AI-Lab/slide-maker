import { currentDeck, addSlideToDeck, removeSlideFromDeck, updateSlideInDeck } from '$lib/stores/deck'
import { reorderBlocksInZone, moveBlockBetweenZones, reorderSlides as reorderSlidesTransform } from '@slide-maker/shared/dnd-transforms'
import { activeSlideId } from '$lib/stores/ui'
import { history } from '$lib/stores/history'
import { logAction, lastAgentSlideId } from '$lib/stores/actions'
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

/** Resolve artifact source from catalog for a module def that has artifactName but no rawSource */
async function resolveArtifactSource(data: Record<string, unknown>): Promise<void> {
  if (!data.artifactName || data.rawSource) return
  const { findArtifactByName, ensureArtifactsLoaded } = await import('../stores/artifacts')
  const { buildSourceWithConfig, getResolvedConfig } = await import('./artifact-config')
  await ensureArtifactsLoaded()
  const artifactDef = findArtifactByName(data.artifactName as string)
  if (!artifactDef?.source) return
  const userConfig = (data.config as Record<string, unknown>) || {}
  const defaults = getResolvedConfig(artifactDef)
  const mergedConfig = { ...defaults, ...userConfig }
  data.rawSource = buildSourceWithConfig(artifactDef.source, mergedConfig)
  data.config = mergedConfig
  if (!data.alt) data.alt = artifactDef.name
  if (data.autoSize === undefined) data.autoSize = true
  if (data.aspectRatio === undefined) data.aspectRatio = 4 / 3
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

      // Guard against duplicate slides by heading text
      const existingSlides = get(currentDeck)?.slides ?? []
      const newHeadingMod = moduleDefs.find((m: any) => m.type === 'heading')
      const newHeadingText = String(newHeadingMod?.data?.text ?? '').toLowerCase().trim()
      if (newHeadingText) {
        const duplicate = existingSlides.find((s) => {
          const h = (s.blocks as any[])?.find((b: any) => b.type === 'heading')
          return String((h?.data as any)?.text ?? '').toLowerCase().trim() === newHeadingText
        })
        if (duplicate) {
          console.warn(`[Wiz] Skipping duplicate slide: "${newHeadingMod.data.text}" already exists as slide ${(duplicate.order ?? 0) + 1}`)
          return
        }
      }

      // Resolve artifact sources before sending to API
      for (const mod of moduleDefs) {
        if (mod.type === 'artifact' && mod.data) {
          await resolveArtifactSource(mod.data)
        }
      }

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
        lastAgentSlideId.set(slide.id)
        logAction(`AI: added slide (${(payload.layout as string) || 'layout-split'})`)

        // Track reverse mutation (use resolved IDs so redo works)
        history.pushMutation(
          { action: 'addSlide', payload: { layout: payload.layout || 'layout-split', splitRatio: payload.splitRatio, modules: moduleDefs, insertAfter: payload.insertAfter } },
          { action: 'removeSlide', payload: { slideId: slide.id } },
        )
      }
      break
    }

    case 'removeSlide': {
      const slideId = (resolveSlideRef(payload.slideId as string) || (payload.slideId as string))

      // Snapshot slide for undo before deleting
      const removedSlide = deck.slides.find((s) => s.id === slideId)
      const slideIndex = deck.slides.indexOf(removedSlide!)
      const prevSlideId = slideIndex > 0 ? deck.slides[slideIndex - 1]?.id : undefined

      await apiCall(`/api/decks/${deck.id}/slides/${slideId}`, 'DELETE')
      removeSlideFromDeck(slideId)

      if (removedSlide) {
        const snapshot = {
          layout: removedSlide.layout,
          splitRatio: removedSlide.splitRatio,
          modules: removedSlide.blocks.map((b) => ({
            type: b.type, zone: b.zone,
            data: { ...b.data },
            stepOrder: b.stepOrder ?? null,
          })),
          insertAfter: prevSlideId,
        }
        history.pushMutation(
          { action: 'removeSlide', payload: { slideId } },
          { action: 'addSlide', payload: snapshot },
        )
      }
      break
    }

    case 'updateSlide': {
      const slideId = (resolveSlideRef(payload.slideId as string) || (payload.slideId as string))

      // Capture old values for undo
      const oldSlide = deck.slides.find((s) => s.id === slideId)
      const oldValues: Record<string, unknown> = {}
      if (payload.notes !== undefined) oldValues.notes = (oldSlide as any)?.notes ?? null
      if (payload.splitRatio !== undefined) oldValues.splitRatio = oldSlide?.splitRatio
      if (payload.layout !== undefined) oldValues.layout = oldSlide?.layout

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

      history.pushMutation(
        { action: 'updateSlide', payload: { slideId, ...updates } },
        { action: 'updateSlide', payload: { slideId, ...oldValues } },
      )
      break
    }

    case 'addBlock': {
      const slideId = (resolveSlideRef(payload.slideId as string) || (payload.slideId as string))
      const blockDef = payload.block as { type: string; zone?: string; data: Record<string, unknown>; stepOrder?: number }

      if (blockDef.type === 'artifact' && blockDef.data) {
        await resolveArtifactSource(blockDef.data)
      }

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
        lastAgentSlideId.set(slideId)
        logAction(`AI: added ${blockDef.type} module`)

        history.pushMutation(
          { action: 'addBlock', payload: { slideId, block: { type: blockDef.type, zone: blockDef.zone || 'content', data: blockDef.data || {}, stepOrder: blockDef.stepOrder } } },
          { action: 'removeBlock', payload: { slideId, blockId: result.block.id } },
        )
      }
      break
    }

    case 'removeBlock': {
      const slideId = (resolveSlideRef(payload.slideId as string) || (payload.slideId as string))
      const blockId = payload.blockId as string
      // Capture snapshot for undo/redo robustness
      const currentSlide = deck.slides.find((s) => s.id === slideId)
      const oldBlock = currentSlide?.blocks.find((b) => b.id === blockId)
      await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${blockId}`, 'DELETE')
      updateSlideInDeck(slideId, (s) => ({
        ...s,
        blocks: s.blocks.filter((b) => b.id !== blockId),
      }))
      if (oldBlock) {
        const snapshot = { type: oldBlock.type, zone: oldBlock.zone, data: oldBlock.data || {}, stepOrder: oldBlock.stepOrder ?? null }
        // Enhance the forward mutation so redo can target the re-added block by snapshot
        const forward = { action: 'removeBlock', payload: { slideId, blockId, snapshot } }
        const reverse = {
          action: 'addBlock',
          payload: { slideId, block: { ...snapshot } },
        }
        history.pushMutation(forward, reverse)
      }
      break
    }

    case 'updateBlock': {
      const slideId = (resolveSlideRef(payload.slideId as string) || (payload.slideId as string))
      const blockId = payload.blockId as string
      const newData = payload.data as Record<string, unknown>

      // Capture old data for undo
      const currentSlide = deck.slides.find((s) => s.id === slideId)
      const oldBlock = currentSlide?.blocks.find((b) => b.id === blockId)
      const oldData = oldBlock ? { ...oldBlock.data } : {}

      const result = await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${blockId}`, 'PATCH', {
        data: newData,
      })
      const updatedBlock = result?.block as { id?: string; data?: Record<string, unknown> } | undefined
      updateSlideInDeck(slideId, (s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                ...(updatedBlock?.id === blockId ? updatedBlock : {}),
                data: updatedBlock?.id === blockId ? (updatedBlock.data ?? b.data) : { ...b.data, ...newData },
              }
            : b,
        ),
      }))

      lastAgentSlideId.set(slideId)
      logAction(`AI: updated ${oldBlock?.type || 'module'}`)

      history.pushMutation(
        { action: 'updateBlock', payload: { slideId, blockId, data: newData } },
        { action: 'updateBlock', payload: { slideId, blockId, data: oldData } },
      )
      break
    }

    case 'updateBlockStep': {
      const slideId = (resolveSlideRef(payload.slideId as string) || (payload.slideId as string))
      const blockId = payload.blockId as string
      const newStep = (payload.stepOrder as number | null) ?? null
      const currentSlide = deck.slides.find((s) => s.id === slideId)
      const oldBlock = currentSlide?.blocks.find((b) => b.id === blockId)
      const prevStep = (oldBlock?.stepOrder ?? null) as number | null

      await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${blockId}`, 'PATCH', {
        stepOrder: newStep,
      })
      updateSlideInDeck(slideId, (s) => ({
        ...s,
        blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, stepOrder: newStep } : b)),
      }))

      history.pushMutation(
        { action: 'updateBlockStep', payload: { slideId, blockId, stepOrder: newStep } },
        { action: 'updateBlockStep', payload: { slideId, blockId, stepOrder: prevStep } },
      )
      break
    }

    case 'setTheme': {
      const themeId = payload.themeId as string
      await apiCall(`/api/decks/${deck.id}`, 'PATCH', { themeId })
      currentDeck.update((d) => (d ? { ...d, themeId } : d))
      logAction('AI: changed theme')
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
      const prevOrder = deck.slides
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => s.id)
      await apiCall(`/api/decks/${deck.id}/slides/reorder`, 'POST', { order })
      currentDeck.update((d) => {
        if (!d) return d
        return { ...d, slides: reorderSlidesTransform(d.slides, order) }
      })
      history.pushMutation(
        { action: 'reorderSlides', payload: { order } },
        { action: 'reorderSlides', payload: { order: prevOrder } },
      )
      break
    }

    case 'reorderBlocks': {
      const slideId = (resolveSlideRef(payload.slideId as string) || (payload.slideId as string))
      const zone = payload.zone as string
      const order = payload.order as string[]

      // Capture previous order for undo
      const slide = deck.slides.find((s) => s.id === slideId)
      const prevOrder = (slide?.blocks ?? [])
        .filter((b) => b.zone === zone)
        .sort((a, b) => a.order - b.order)
        .map((b) => b.id)

      // Optimistic store update
      currentDeck.update((d) => {
        if (!d) return d
        return {
          ...d,
          slides: d.slides.map((s) =>
            s.id !== slideId ? s : reorderBlocksInZone(s as any, zone, order) as any
          ),
        }
      })

      // Batch persist — single request, fire-and-forget
      apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/reorder`, 'POST', { order })

      history.pushMutation(
        { action: 'reorderBlocks', payload: { slideId, zone, order } },
        { action: 'reorderBlocks', payload: { slideId, zone, order: prevOrder } },
      )
      break
    }

    case 'moveBlockToSlide': {
      const fromSlideId = (resolveSlideRef((payload as any).fromSlideId as string) || (payload as any).fromSlideId) as string
      const toSlideId = (resolveSlideRef((payload as any).toSlideId as string) || (payload as any).toSlideId) as string
      const blockId = (payload as any).blockId as string
      const toZone = (payload as any).toZone as string
      const toIndexRaw = (payload as any).toIndex as number | undefined

      const source = deck.slides.find((s) => s.id === fromSlideId)
      const dest = deck.slides.find((s) => s.id === toSlideId)
      if (!source || !dest) break
      const moved = source.blocks.find((b) => b.id === blockId)
      if (!moved) break

      // Compute destination index within zone
      const destZoneBlocks = dest.blocks.filter((b) => b.zone === toZone).sort((a, b) => a.order - b.order)
      let toIndex = toIndexRaw ?? destZoneBlocks.length
      if (toIndex < 0) toIndex = 0
      if (toIndex > destZoneBlocks.length) toIndex = destZoneBlocks.length

      // Optimistic store update
      currentDeck.update((d) => {
        if (!d) return d
        const slides = d.slides.map((s) => {
          if (s.id === fromSlideId) {
            // Remove from source and compact source zone order
            const remaining = s.blocks.filter((b) => b.id !== blockId)
            const srcZone = moved.zone
            const compacted = remaining.map((b) =>
              b.zone === srcZone
                ? { ...b, order: b.order - (b.order > moved.order ? 1 : 0) }
                : b,
            )
            return { ...s, blocks: compacted }
          }
          return s
        })

        // Insert into destination
        const afterRemoval = slides
        const destSlide = afterRemoval.find((s) => s.id === toSlideId)!
        const updatedBlocks = (() => {
          const before = destSlide.blocks.filter((b) => b.zone === toZone && b.order < toIndex)
          const after = destSlide.blocks.filter((b) => b.zone === toZone && b.order >= toIndex)
          const others = destSlide.blocks.filter((b) => b.zone !== toZone)
          const movedBlock = { ...moved, slideId: toSlideId, zone: toZone, order: toIndex }
          const reafter = after.map((b, i) => ({ ...b, order: toIndex + 1 + i }))
          return [...others, ...before, movedBlock, ...reafter]
        })()
        const newSlides = afterRemoval.map((s) => (s.id === toSlideId ? { ...s, blocks: updatedBlocks } : s))
        return { ...d, slides: newSlides }
      })

      // Persist move atomically via API
      await apiCall(`/api/decks/${deck.id}/blocks/${blockId}/move`, 'POST', {
        toSlideId,
        toZone,
        toIndex,
      })

      lastAgentSlideId.set(toSlideId)
      logAction('AI: moved module to another slide')

      // Record undo/redo entry
      history.pushMutation(
        { action: 'moveBlockToSlide', payload: { fromSlideId, toSlideId, blockId, toZone, toIndex } },
        { action: 'moveBlockToSlide', payload: { fromSlideId: toSlideId, toSlideId: fromSlideId, blockId, toZone: moved.zone, toIndex: moved.order } },
      )
      break
    }

    case 'moveBlockToZone': {
      const slideId = payload.slideId as string
      const blockId = payload.blockId as string
      const fromZone = payload.fromZone as string
      const toZone = payload.toZone as string
      const order = payload.order as string[]

      // Capture old state for undo
      const slide = deck.slides.find((s) => s.id === slideId)
      const movedBlock = slide?.blocks.find((b) => b.id === blockId)
      const prevZone = movedBlock?.zone ?? fromZone
      const prevOrder = (slide?.blocks ?? [])
        .filter((b) => b.zone === prevZone)
        .sort((a, b) => a.order - b.order)
        .map((b) => b.id)

      // Update store: move block to new zone, recompute orders
      currentDeck.update((d) => {
        if (!d) return d
        return {
          ...d,
          slides: d.slides.map((s) =>
            s.id !== slideId ? s : moveBlockBetweenZones(s as any, blockId, fromZone, toZone, order) as any
          ),
        }
      })

      // Persist: update moved block zone, then batch reindex destination zone
      apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${blockId}`, 'PATCH', {
        zone: toZone,
        order: order.indexOf(blockId),
      })
      // Batch reindex destination zone
      apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/reorder`, 'POST', { order })
      // Batch reindex source zone
      const updatedDeck = get(currentDeck)
      const updatedSlide = updatedDeck?.slides.find((s) => s.id === slideId)
      const sourceOrder = (updatedSlide?.blocks ?? [])
        .filter((b) => b.zone === fromZone)
        .sort((a, b) => a.order - b.order)
        .map((b) => b.id)
      if (sourceOrder.length > 0) {
        apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/reorder`, 'POST', { order: sourceOrder })
      }

      history.pushMutation(
        { action: 'moveBlockToZone', payload: { slideId, blockId, fromZone, toZone, order } },
        { action: 'moveBlockToZone', payload: { slideId, blockId, fromZone: toZone, toZone: fromZone, order: prevOrder } },
      )
      break
    }

    case 'applyTemplate': {
      const templateId = payload.templateId as string
      const slideId = payload.slideId as string | undefined
      const resolvedSlideId = slideId ? (resolveSlideRef(slideId) || slideId) : undefined

      // Fetch template details
      const { ensureTemplatesLoaded, findTemplateById } = await import('../stores/templates')
      await ensureTemplatesLoaded()
      const template = findTemplateById(templateId)
      if (!template) {
        console.error('Template not found:', templateId)
        break
      }

      if (resolvedSlideId) {
        // Replace slide content with template
        const slide = deck.slides.find((s) => s.id === resolvedSlideId)
        if (slide) {
          // Snapshot old state for undo
          const oldLayout = slide.layout
          const oldBlocks = slide.blocks.map((b) => ({ type: b.type, zone: b.zone, data: { ...b.data }, stepOrder: b.stepOrder }))

          for (const block of slide.blocks) {
            await apiCall(`/api/decks/${deck.id}/slides/${resolvedSlideId}/blocks/${block.id}`, 'DELETE')
          }
          await apiCall(`/api/decks/${deck.id}/slides/${resolvedSlideId}`, 'PATCH', { layout: template.layout })
          const newBlocks: any[] = []
          for (const mod of template.modules) {
            const result = await apiCall(`/api/decks/${deck.id}/slides/${resolvedSlideId}/blocks`, 'POST', {
              type: mod.type,
              zone: mod.zone,
              data: mod.data || {},
              stepOrder: mod.stepOrder,
            })
            if (result?.block) newBlocks.push(result.block)
          }
          updateSlideInDeck(resolvedSlideId, (s) => ({
            ...s,
            layout: template.layout,
            blocks: newBlocks,
          }))

          // Undo: restore old layout and blocks
          history.pushMutation(
            { action: 'applyTemplate', payload: { ...payload, slideId: resolvedSlideId } },
            { action: '_restoreSlide', payload: { slideId: resolvedSlideId, layout: oldLayout, modules: oldBlocks } }
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

    case 'searchImage': {
      const query = payload.query as string
      const zone = (payload.zone as string) || 'stage'
      const alt = (payload.alt as string) || query
      const blockId = payload.blockId as string | undefined

      // Resolve slideId: use provided ID if it matches a real slide, otherwise fall back to active slide.
      // This handles the case where AI emits addSlide + searchImage in the same response —
      // addSlide sets activeSlideId, so searchImage can find the new slide even with a placeholder ID.
      let slideId = (resolveSlideRef(payload.slideId as string) || (payload.slideId as string))
      const slideExists = slideId && deck.slides.some((s) => s.id === slideId)
      if (!slideExists) {
        slideId = get(activeSlideId) ?? ''
      }

      if (!query || !slideId) break

      // Search Pexels for openly licensed images
      const { api: searchApi } = await import('$lib/api')
      const results = await searchApi.searchImages(query, 3)
      const images = results.images ?? []

      if (!images.length) {
        // Surface to user via a short assistant message
        try {
          const { addAssistantMessage, appendToAssistant, finishAssistant } = await import('$lib/stores/chat')
          const msgId = addAssistantMessage()
          appendToAssistant(msgId, `Image search found no results for "${query}" (Pexels). Try different terms.`)
          finishAssistant(msgId)
        } catch {}
        console.warn('searchImage: no images found for', query)
        break
      }

      // Try downloading images until one succeeds
      const sanitized = query.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 40)
      let downloaded: { file: { id: string; url: string; filename: string } } | null = null
      for (let i = 0; i < images.length; i++) {
        try {
          downloaded = await searchApi.downloadImage(
            images[i].url, deck.id,
            `search-${sanitized}-${i + 1}.jpg`,
          )
          if (downloaded?.file) break
        } catch { continue }
      }

      if (!downloaded?.file) {
        try {
          const { addAssistantMessage, appendToAssistant, finishAssistant } = await import('$lib/stores/chat')
          const msgId = addAssistantMessage()
          appendToAssistant(msgId, `Failed to download images for "${query}". Please try again or adjust the query.`)
          finishAssistant(msgId)
        } catch {}
        console.warn('searchImage: all downloads failed for', query)
        break
      }

      // Store relative path — ImageModule.svelte prepends API_URL when it sees /api/ prefix
      const imgSrc = downloaded.file.url

      // Either update existing image block or add new one
      if (blockId) {
        await applyMutation({
          action: 'updateBlock',
          payload: { slideId, blockId, data: { src: imgSrc, alt } },
        })
      } else {
        await applyMutation({
          action: 'addBlock',
          payload: { slideId, block: { type: 'image', zone, data: { src: imgSrc, alt, caption: '' } } },
        })
      }

      logAction(`AI: searched web for "${query}"`)
      break
    }

    default:
      console.warn('Unhandled mutation action:', mutation.action)
  }
}

/** Resolve flexible slide references to concrete IDs.
 * Supports:
 *  - "active" → current active slide id
 *  - "index:N" (1-based) → slide at position N
 *  - "heading:<text>" → first slide whose heading module text matches (case-insensitive)
 */
function resolveSlideRef(ref?: string): string | null {
  if (!ref || typeof ref !== 'string') return null
  const deck = get(currentDeck)
  if (!deck) return null

  if (ref === 'active') {
    const id = get(activeSlideId)
    return id ?? null
  }

  if (ref.startsWith('index:')) {
    const num = parseInt(ref.slice(6), 10)
    if (!isNaN(num) && num >= 1 && num <= deck.slides.length) {
      const s = deck.slides[num - 1]
      return s?.id ?? null
    }
  }

  if (ref.toLowerCase().startsWith('heading:')) {
    const target = ref.slice(8).trim().toLowerCase()
    for (const s of deck.slides) {
      const h = (s.blocks as any[])?.find((b: any) => b.type === 'heading')
      const text = String((h?.data as any)?.text ?? '').toLowerCase().trim()
      if (text && text === target) return s.id
    }
  }

  // Already a concrete id? Ensure it exists.
  if (deck.slides.some((s) => s.id === ref)) return ref
  return null
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
      let blockId = payload.blockId as string
      const snapshot = (payload as any).snapshot as
        | { type: string; zone: string; data: Record<string, unknown>; stepOrder: number | null }
        | undefined
      // If the original ID is not present (e.g., after undo re-add), try to find by snapshot
      const slide = get(currentDeck)?.slides.find((s) => s.id === slideId)
      const exists = slide?.blocks.some((b) => b.id === blockId)
      if (!exists && snapshot && slide) {
        const match = slide.blocks.find(
          (b) =>
            b.type === snapshot.type &&
            b.zone === snapshot.zone &&
            (b.stepOrder ?? null) === (snapshot.stepOrder ?? null) &&
            JSON.stringify(b.data || {}) === JSON.stringify(snapshot.data || {}),
        )
        if (match) blockId = match.id
      }
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

    case 'updateBlockStep': {
      const slideId = payload.slideId as string
      const blockId = payload.blockId as string
      const newStep = (payload.stepOrder as number | null) ?? null
      await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${blockId}`, 'PATCH', {
        stepOrder: newStep,
      })
      updateSlideInDeck(slideId, (s) => ({
        ...s,
        blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, stepOrder: newStep } : b)),
      }))
      break
    }

    case 'reorderBlocks': {
      const slideId = payload.slideId as string
      const zone = payload.zone as string
      const order = payload.order as string[]

      currentDeck.update((d) => {
        if (!d) return d
        return {
          ...d,
          slides: d.slides.map((s) => {
            if (s.id !== slideId) return s
            const idToBlock = new Map(s.blocks.map((b) => [b.id, b]))
            const reorderedZone = order
              .map((id, i) => {
                const b = idToBlock.get(id)
                return b ? { ...b, order: i, zone } : null
              })
              .filter(Boolean) as typeof s.blocks
            const others = s.blocks.filter((b) => b.zone !== zone)
            return { ...s, blocks: [...others, ...reorderedZone] as typeof s.blocks }
          }),
        }
      })

      for (let i = 0; i < order.length; i++) {
        const id = order[i]
        await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${id}`, 'PATCH', { order: i })
      }
      break
    }
    case 'moveBlockToZone': {
      const slideId = payload.slideId as string
      const blockId = payload.blockId as string
      const toZone = payload.toZone as string
      const fromZone = payload.fromZone as string
      const order = payload.order as string[]

      currentDeck.update((d) => {
        if (!d) return d
        return {
          ...d,
          slides: d.slides.map((s) => {
            if (s.id !== slideId) return s
            const updatedBlocks = s.blocks.map((b) =>
              b.id === blockId ? { ...b, zone: toZone } : b
            )
            const idToBlock = new Map(updatedBlocks.map((b) => [b.id, b]))
            const reorderedDest = order
              .map((id, i) => {
                const b = idToBlock.get(id)
                return b ? { ...b, order: i, zone: toZone } : null
              })
              .filter(Boolean) as typeof s.blocks
            const sourceBlocks = updatedBlocks
              .filter((b) => b.zone === fromZone && b.id !== blockId)
              .sort((a, b) => a.order - b.order)
              .map((b, i) => ({ ...b, order: i }))
            const others = updatedBlocks.filter(
              (b) => b.zone !== toZone && b.zone !== fromZone
            )
            return { ...s, blocks: [...others, ...sourceBlocks, ...reorderedDest] as typeof s.blocks }
          }),
        }
      })

      await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${blockId}`, 'PATCH', {
        zone: toZone,
        order: order.indexOf(blockId),
      })
      for (let i = 0; i < order.length; i++) {
        if (order[i] !== blockId) {
          await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${order[i]}`, 'PATCH', { order: i })
        }
      }
      const updatedDeck = get(currentDeck)
      const updatedSlide = updatedDeck?.slides.find((s) => s.id === slideId)
      const sourceBlocks = (updatedSlide?.blocks ?? [])
        .filter((b) => b.zone === fromZone)
        .sort((a, b) => a.order - b.order)
      for (let i = 0; i < sourceBlocks.length; i++) {
        await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${sourceBlocks[i].id}`, 'PATCH', { order: i })
      }
      break
    }
    case 'addBlock': {
      const slideId = payload.slideId as string
      const blockDef = payload.block as { type: string; zone?: string; data: Record<string, unknown>; stepOrder?: number | null }
      if (blockDef.type === 'artifact' && blockDef.data) {
        await resolveArtifactSource(blockDef.data)
      }
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
      }
      break
    }
    case 'addSlide': {
      const moduleDefs = (payload.modules as any[]) || []
      for (const mod of moduleDefs) {
        if (mod.type === 'artifact' && mod.data) {
          await resolveArtifactSource(mod.data)
        }
      }
      const result = await apiCall(`/api/decks/${deck.id}/slides`, 'POST', {
        layout: (payload.layout as string) || 'layout-split',
        splitRatio: payload.splitRatio,
        modules: moduleDefs,
        insertAfter: payload.insertAfter || undefined,
      })
      const newSlide = result?.slide ?? result
      if (newSlide?.id) {
        addSlideToDeck({ ...newSlide, blocks: newSlide.blocks || newSlide.modules || [] })
        activeSlideId.set(newSlide.id)
      }
      break
    }
    case 'reorderSlides': {
      const order = payload.order as string[]
      await apiCall(`/api/decks/${deck.id}/slides/reorder`, 'POST', { order })
      currentDeck.update((d) => {
        if (!d) return d
        return { ...d, slides: reorderSlidesTransform(d.slides, order) }
      })
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
    case 'moveBlockToSlide': {
      const fromSlideId = (payload as any).fromSlideId as string
      const toSlideId = (payload as any).toSlideId as string
      const blockId = (payload as any).blockId as string
      const toZone = (payload as any).toZone as string
      const toIndexRaw = (payload as any).toIndex as number | undefined

      const source = deck.slides.find((s) => s.id === fromSlideId)
      const dest = deck.slides.find((s) => s.id === toSlideId)
      if (!source || !dest) break
      const moved = source.blocks.find((b) => b.id === blockId)
      if (!moved) break

      const destZoneBlocks = dest.blocks.filter((b) => b.zone === toZone).sort((a, b) => a.order - b.order)
      let toIndex = toIndexRaw ?? destZoneBlocks.length
      if (toIndex < 0) toIndex = 0
      if (toIndex > destZoneBlocks.length) toIndex = destZoneBlocks.length

      currentDeck.update((d) => {
        if (!d) return d
        const slides = d.slides.map((s) => {
          if (s.id === fromSlideId) {
            const remaining = s.blocks.filter((b) => b.id !== blockId)
            const srcZone = moved.zone
            const compacted = remaining.map((b) =>
              b.zone === srcZone ? { ...b, order: b.order - (b.order > moved.order ? 1 : 0) } : b,
            )
            return { ...s, blocks: compacted }
          }
          return s
        })
        const afterRemoval = slides
        const destSlide = afterRemoval.find((s) => s.id === toSlideId)!
        const updatedBlocks = (() => {
          const before = destSlide.blocks.filter((b) => b.zone === toZone && b.order < toIndex)
          const after = destSlide.blocks.filter((b) => b.zone === toZone && b.order >= toIndex)
          const others = destSlide.blocks.filter((b) => b.zone !== toZone)
          const movedBlock = { ...moved, slideId: toSlideId, zone: toZone, order: toIndex }
          const reafter = after.map((b, i) => ({ ...b, order: toIndex + 1 + i }))
          return [...others, ...before, movedBlock, ...reafter]
        })()
        const newSlides = afterRemoval.map((s) => (s.id === toSlideId ? { ...s, blocks: updatedBlocks } : s))
        return { ...d, slides: newSlides }
      })

      await apiCall(`/api/decks/${deck.id}/blocks/${blockId}/move`, 'POST', {
        toSlideId, toZone, toIndex,
      })
      break
    }
    case 'applyTemplate': {
      // Redo path: re-apply template to slide
      const templateId = payload.templateId as string
      const slideId = payload.slideId as string
      const { ensureTemplatesLoaded, findTemplateById } = await import('../stores/templates')
      await ensureTemplatesLoaded()
      const template = findTemplateById(templateId)
      if (!template) break
      if (slideId) {
        const slide = deck.slides.find((s) => s.id === slideId)
        if (slide) {
          for (const block of slide.blocks) {
            await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks/${block.id}`, 'DELETE')
          }
          await apiCall(`/api/decks/${deck.id}/slides/${slideId}`, 'PATCH', { layout: template.layout })
          const redoBlocks: any[] = []
          for (const mod of template.modules) {
            const result = await apiCall(`/api/decks/${deck.id}/slides/${slideId}/blocks`, 'POST', {
              type: mod.type, zone: mod.zone, data: mod.data || {}, stepOrder: mod.stepOrder,
            })
            if (result?.block) redoBlocks.push(result.block)
          }
          updateSlideInDeck(slideId, (s) => ({ ...s, layout: template.layout, blocks: redoBlocks }))
        }
      } else {
        const result = await apiCall(`/api/decks/${deck.id}/slides`, 'POST', {
          layout: template.layout, modules: template.modules,
        })
        const newSlide = result?.slide ?? result
        if (newSlide?.id) {
          addSlideToDeck({ ...newSlide, blocks: newSlide.blocks || newSlide.modules || [] })
          activeSlideId.set(newSlide.id)
        }
      }
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
        const newBlocks: any[] = []
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
      console.warn('applyMutationSilent: unhandled action', mutation.action)
      break
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
