<script lang="ts">
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import { get } from 'svelte/store'
  import { currentDeck } from '$lib/stores/deck'
  import { activeSlideId, setActiveSlide } from '$lib/stores/ui'
  import { editorDarkMode } from '$lib/stores/editor-theme'
  import { themesStore, themesLoaded, ensureThemesLoaded, isDark, type ThemeData } from '$lib/stores/themes'
  import { API_URL } from '$lib/api'
  import ShareDeckDialog from '$lib/components/gallery/ShareDeckDialog.svelte'

  const COMMON_FONTS = [
    'Inter', 'Outfit', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
    'Poppins', 'Raleway', 'Nunito', 'Playfair Display', 'Merriweather',
    'Source Sans Pro', 'PT Sans', 'Work Sans', 'DM Sans', 'Space Grotesk',
    'Georgia',
  ]

  type CanvasMode = 'edit' | 'view'
  let {
    canvasMode = 'view' as CanvasMode,
    onSetMode,
    onPreview,
  }: {
    canvasMode?: CanvasMode
    onSetMode?: (mode: CanvasMode) => void
    onPreview?: () => void
  } = $props()

  let slides = $derived($currentDeck?.slides ?? [])
  let sortedSlides = $derived([...slides].sort((a, b) => a.order - b.order))
  let currentIndex = $derived(
    $activeSlideId ? sortedSlides.findIndex((s) => s.id === $activeSlideId) : -1
  )
  let total = $derived(sortedSlides.length)

  function goToPrev() {
    if (currentIndex > 0) {
      setActiveSlide(sortedSlides[currentIndex - 1].id, currentIndex)
    }
  }

  function goToNext() {
    if (currentIndex < total - 1) {
      setActiveSlide(sortedSlides[currentIndex + 1].id, currentIndex + 2)
    }
  }

  // ── Theme popover ──
  let showThemes = $state(false)
  let themes = $derived($themesStore)
  let themesReady = $derived($themesLoaded)
  let deckThemeId = $derived($currentDeck?.themeId ?? null)
  let applying = $state<string | null>(null)

  // Create form
  let showCreateForm = $state(false)
  let formName = $state('')
  let formPrimary = $state('#3b82f6')
  let formSecondary = $state('#6366f1')
  let formAccent = $state('#2FB8D6')
  let formBg = $state('#ffffff')
  let formHeadingFont = $state('Outfit')
  let formBodyFont = $state('Inter')
  let saving = $state(false)
  let deleting = $state<string | null>(null)
  let confirmDelete = $state<string | null>(null)

  $effect(() => { ensureThemesLoaded() })

  // Group themes into families (light/dark pairs merged)
  interface ThemeFamily {
    name: string
    light: ThemeData | null
    dark: ThemeData | null
    standalone: ThemeData | null // themes with no pair
  }

  let families = $derived.by(() => {
    const matched = new Set<string>()
    const result: ThemeFamily[] = []

    for (const theme of themes) {
      if (matched.has(theme.id)) continue
      const pair = findPairedTheme(theme, themes)
      if (pair && !matched.has(pair.id)) {
        const thisIsDark = isDark((theme.colors as any)?.bg ?? '#111827')
        matched.add(theme.id)
        matched.add(pair.id)
        const familyName = theme.name
          .replace(/\s*\b(dark|light)\b\s*/i, ' ').trim()
          || theme.name
        result.push({
          name: familyName,
          light: thisIsDark ? pair : theme,
          dark: thisIsDark ? theme : pair,
          standalone: null,
        })
      } else {
        matched.add(theme.id)
        result.push({
          name: theme.name,
          light: null,
          dark: null,
          standalone: theme,
        })
      }
    }
    return result
  })

  function findPairedTheme(current: ThemeData, list: ThemeData[]): ThemeData | null {
    const byName = (name: string) => list.find(t => t.name.toLowerCase() === name.toLowerCase()) || null
    const byId = (id: string) => list.find(t => t.id.toLowerCase() === id.toLowerCase()) || null
    const name = current.name
    const id = current.id
    const candidates: (ThemeData | null)[] = []
    if (/dark/i.test(name)) candidates.push(byName(name.replace(/dark/i, 'Light')))
    if (/light/i.test(name)) candidates.push(byName(name.replace(/light/i, 'Dark')))
    if (/-dark$/i.test(id)) candidates.push(byId(id.replace(/-dark$/i, '-light')))
    if (/-light$/i.test(id)) candidates.push(byId(id.replace(/-light$/i, '-dark')))
    return (candidates.find(Boolean) as ThemeData) ?? null
  }

  function getActiveVariant(family: ThemeFamily): ThemeData {
    if (family.standalone) return family.standalone
    // If the active deck theme is one of the variants, show that
    if (family.light && family.light.id === deckThemeId) return family.light
    if (family.dark && family.dark.id === deckThemeId) return family.dark
    // Default to light
    return family.light ?? family.dark!
  }

  function isActiveFamily(family: ThemeFamily): boolean {
    if (!deckThemeId) return false
    return family.standalone?.id === deckThemeId
      || family.light?.id === deckThemeId
      || family.dark?.id === deckThemeId
  }

  function activeFamilyVariant(family: ThemeFamily): 'light' | 'dark' | null {
    if (family.standalone) return null
    if (family.light?.id === deckThemeId) return 'light'
    if (family.dark?.id === deckThemeId) return 'dark'
    return null
  }

  async function applyTheme(themeId: string) {
    const deck = get(currentDeck)
    if (!deck || applying) return
    applying = themeId
    try {
      const res = await fetch(`${API_URL}/api/decks/${deck.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId }),
      })
      if (res.ok) {
        currentDeck.update((d) => d ? { ...d, themeId } : d)
      }
    } catch (err) {
      console.error('Failed to apply theme:', err)
    } finally {
      applying = null
    }
  }

  function switchVariant(family: ThemeFamily, variant: 'light' | 'dark') {
    const theme = variant === 'light' ? family.light : family.dark
    if (theme) applyTheme(theme.id)
  }

  function getColors(theme: ThemeData): string[] {
    const c = theme.colors as Record<string, string> | null
    if (!c) return ['#6b7280', '#9ca3af', '#d1d5db', '#f3f4f6']
    return [c.primary ?? '#6b7280', c.secondary ?? '#9ca3af', c.accent ?? '#d1d5db', c.bg ?? '#f3f4f6']
  }

  function getFonts(theme: ThemeData): string {
    const f = theme.fonts as Record<string, string> | null
    if (!f) return 'Default'
    const parts: string[] = []
    if (f.heading) parts.push(f.heading)
    if (f.body && f.body !== f.heading) parts.push(f.body)
    return parts.length > 0 ? parts.join(' / ') : 'Default'
  }

  function forkTheme(theme: ThemeData) {
    const colors = theme.colors as Record<string, string> | null
    const fonts = theme.fonts as Record<string, string> | null
    formName = `${theme.name} (Copy)`
    formPrimary = colors?.primary ?? '#3b82f6'
    formSecondary = colors?.secondary ?? '#6366f1'
    formAccent = colors?.accent ?? '#2FB8D6'
    formBg = colors?.bg ?? '#ffffff'
    formHeadingFont = fonts?.heading ?? 'Outfit'
    formBodyFont = fonts?.body ?? 'Inter'
    showCreateForm = true
  }

  async function handleCreateTheme() {
    if (!formName.trim() || saving) return
    saving = true
    try {
      const res = await fetch(`${API_URL}/api/themes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          colors: { primary: formPrimary, secondary: formSecondary, accent: formAccent, bg: formBg },
          fonts: { heading: formHeadingFont, body: formBodyFont },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.theme) {
          themesStore.update((t) => [...t, data.theme])
        }
        showCreateForm = false
        formName = ''
      }
    } catch (err) {
      console.error('Failed to create theme:', err)
    } finally {
      saving = false
    }
  }

  async function deleteTheme(themeId: string) {
    if (deleting) return
    deleting = themeId
    try {
      const res = await fetch(`${API_URL}/api/themes/${themeId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        themesStore.update((t) => t.filter((th) => th.id !== themeId))
        if (deckThemeId === themeId) {
          await applyTheme('cuny-ai-lab-default')
        }
      }
    } catch (err) {
      console.error('Failed to delete theme:', err)
    } finally {
      deleting = null
      confirmDelete = null
    }
  }

  function closeThemes() {
    showThemes = false
    showCreateForm = false
    confirmDelete = null
  }

  function handleThemeKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeThemes()
  }

  // Branding
  let showBranding = $state(false)
  let brandingLogo = $state('')
  let brandingPosition = $state('top-left')

  $effect(() => {
    const meta = $currentDeck?.metadata as Record<string, unknown> | undefined
    if (meta?.branding) {
      const b = meta.branding as { logo?: string; position?: string }
      brandingLogo = b.logo ?? ''
      brandingPosition = b.position ?? 'top-left'
    }
  })

  async function saveBranding() {
    if (!$currentDeck) return
    const branding = brandingLogo ? { logo: brandingLogo, position: brandingPosition } : null
    const newMetadata = { ...($currentDeck.metadata as Record<string, unknown>), branding }

    currentDeck.update((d) => d ? { ...d, metadata: newMetadata } : d)

    await fetch(`${API_URL}/api/decks/${$currentDeck.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: newMetadata }),
    }).catch(console.error)

    showBranding = false
  }

  let showShare = $state(false)

  let exporting = $state(false)

  async function handleExport() {
    if (!$currentDeck || exporting) return
    exporting = true
    try {
      const res = await fetch(`${API_URL}/api/decks/${$currentDeck.id}/export`, { method: 'POST', credentials: 'include' })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${$currentDeck.slug ?? 'deck'}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      exporting = false
    }
  }
</script>

<div class="canvas-toolbar">
  <button class="back-btn" onclick={() => goto(`${base}/`)} title="Back to decks">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
  </button>
  <div class="sep"></div>
  <button class="nav-btn" onclick={goToPrev} disabled={currentIndex <= 0} aria-label="Previous slide">&#8592;</button>
  <span class="slide-counter">{total > 0 ? `${currentIndex + 1}/${total}` : '—'}</span>
  <button class="nav-btn" onclick={goToNext} disabled={currentIndex >= total - 1} aria-label="Next slide">&#8594;</button>
  <div class="sep"></div>
  <div class="mode-switcher">
    <button class="mode-btn" class:active={canvasMode === 'edit'} onclick={() => onSetMode?.('edit')} title="Edit slide content">Edit</button>
    <button class="mode-btn" class:active={canvasMode === 'view'} onclick={() => onSetMode?.('view')} title="View slide">View</button>
    <button class="mode-btn" onclick={() => onPreview?.()} title="Preview full deck in new tab">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    </button>
  </div>
  <div class="toolbar-spacer"></div>
  <div class="theme-wrapper">
    <button class="icon-btn" onclick={() => { showThemes = !showThemes; if (showThemes) { showBranding = false } }} title="Theme">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="13.5" r="2.5"/><circle cx="6.5" cy="6.5" r="2.5" fill="currentColor" opacity="0.3"/><circle cx="5" cy="13.5" r="2.5"/><circle cx="12" cy="19" r="2.5"/></svg>
    </button>
    {#if showThemes}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="theme-popover" onkeydown={handleThemeKeydown}>
        <div class="tp-header">
          <span class="tp-title">Theme</span>
          <button class="tp-create-toggle" onclick={() => { showCreateForm = !showCreateForm }}>
            {showCreateForm ? 'Cancel' : '+ New'}
          </button>
        </div>

        {#if showCreateForm}
          <div class="tp-create-form">
            <input class="tp-input" type="text" bind:value={formName} placeholder="Theme name" />
            <div class="tp-colors">
              <label class="tp-color-field">
                <span>Pri</span>
                <input type="color" bind:value={formPrimary} />
              </label>
              <label class="tp-color-field">
                <span>Sec</span>
                <input type="color" bind:value={formSecondary} />
              </label>
              <label class="tp-color-field">
                <span>Acc</span>
                <input type="color" bind:value={formAccent} />
              </label>
              <label class="tp-color-field">
                <span>Bg</span>
                <input type="color" bind:value={formBg} />
              </label>
            </div>
            <div class="tp-fonts">
              <label class="tp-font-field">
                <span>Heading</span>
                <select bind:value={formHeadingFont}>
                  {#each COMMON_FONTS as font}
                    <option value={font}>{font}</option>
                  {/each}
                </select>
              </label>
              <label class="tp-font-field">
                <span>Body</span>
                <select bind:value={formBodyFont}>
                  {#each COMMON_FONTS as font}
                    <option value={font}>{font}</option>
                  {/each}
                </select>
              </label>
            </div>
            <button class="tp-save-btn" onclick={handleCreateTheme} disabled={!formName.trim() || saving}>
              {saving ? 'Saving...' : 'Save Theme'}
            </button>
          </div>
        {/if}

        <div class="tp-list">
          {#if !themesReady}
            <div class="tp-empty">Loading...</div>
          {:else if families.length === 0}
            <div class="tp-empty">No themes available</div>
          {:else}
            {#each families as family (family.name)}
              {@const active = isActiveFamily(family)}
              {@const variant = getActiveVariant(family)}
              {@const hasPair = !!family.light && !!family.dark}
              {@const activeVar = activeFamilyVariant(family)}
              <div class="tp-row" class:active>
                <button
                  class="tp-row-apply"
                  onclick={() => applyTheme(variant.id)}
                  disabled={applying !== null}
                >
                  <div class="tp-row-top">
                    <span class="tp-row-name">{family.name}</span>
                    {#if active}
                      <span class="tp-check">{'\u2713'}</span>
                    {/if}
                  </div>
                  <div class="tp-row-detail">
                    <div class="tp-swatches">
                      {#each getColors(variant) as color}
                        <span class="tp-swatch" style:background={color}></span>
                      {/each}
                    </div>
                    <span class="tp-fonts-label">{getFonts(variant)}</span>
                  </div>
                </button>
                <div class="tp-row-actions">
                  {#if hasPair}
                    <div class="tp-variant-toggle">
                      <button
                        class="tp-var-btn"
                        class:active={activeVar === 'light'}
                        onclick={() => switchVariant(family, 'light')}
                        title="Light variant"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                      </button>
                      <button
                        class="tp-var-btn"
                        class:active={activeVar === 'dark'}
                        onclick={() => switchVariant(family, 'dark')}
                        title="Dark variant"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                      </button>
                    </div>
                  {/if}
                  <button class="tp-fork-btn" onclick={() => forkTheme(variant)} title="Fork">Fk</button>
                  {#if !variant.builtIn}
                    <button
                      class="tp-delete-btn"
                      onclick={() => {
                        if (confirmDelete === variant.id) {
                          deleteTheme(variant.id)
                        } else {
                          confirmDelete = variant.id
                        }
                      }}
                      disabled={deleting === variant.id}
                      title={confirmDelete === variant.id ? 'Click again to confirm' : 'Delete'}
                    >
                      {deleting === variant.id ? '..' : confirmDelete === variant.id ? 'Sure?' : '\u2715'}
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="tp-backdrop" onclick={closeThemes}></div>
    {/if}
  </div>
  <div class="branding-wrapper">
    <button class="icon-btn" onclick={() => { showBranding = !showBranding; if (showBranding) { showThemes = false } }} title="Branding / Logo">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
    </button>
    {#if showBranding}
      <div class="branding-panel">
        <label class="branding-field">
          <span>Logo URL</span>
          <input type="text" bind:value={brandingLogo} placeholder="https://..." />
        </label>
        <label class="branding-field">
          <span>Position</span>
          <select bind:value={brandingPosition}>
            <option value="top-left">Top Left</option>
            <option value="top-right">Top Right</option>
            <option value="bottom-left">Bottom Left</option>
          </select>
        </label>
        <button class="branding-save" onclick={saveBranding}>Save</button>
      </div>
    {/if}
  </div>
  <button class="icon-btn" onclick={() => editorDarkMode.toggle()} title={$editorDarkMode ? 'Light mode' : 'Dark mode'} aria-label={$editorDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
    {#if $editorDarkMode}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    {/if}
  </button>
  <button class="icon-btn" onclick={() => { showShare = true }} disabled={!$currentDeck} title="Share deck">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
  </button>
  <button class="icon-btn" onclick={handleExport} disabled={exporting || !$currentDeck} title="Export deck">
    {#if exporting}
      ...
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    {/if}
  </button>
</div>

{#if showShare && $currentDeck}
  <ShareDeckDialog deckId={$currentDeck.id} onclose={() => { showShare = false }} />
{/if}

<style>
  .canvas-toolbar {
    display: flex;
    align-items: center;
    padding: 3px 6px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
    flex-shrink: 0;
    gap: 2px;
    min-width: 0;
  }
  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 4px;
    padding: 0;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .back-btn:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text);
  }
  .sep {
    width: 1px;
    height: 16px;
    background: var(--color-border);
    margin: 0 3px;
    flex-shrink: 0;
  }
  .nav-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 13px;
    cursor: pointer;
    color: var(--color-text);
    transition: background 0.12s, border-color 0.12s;
    flex-shrink: 0;
  }
  .nav-btn:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-text-muted);
  }
  .nav-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .slide-counter {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    min-width: 2.5em;
    text-align: center;
    flex-shrink: 0;
  }
  .toolbar-spacer {
    flex: 1;
    min-width: 4px;
  }
  .mode-switcher {
    display: flex;
    gap: 1px;
    flex-shrink: 0;
  }
  .mode-btn {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    color: var(--color-text-muted);
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .mode-btn:hover:not(.active) {
    background: var(--color-ghost-bg);
    color: var(--color-text-secondary);
  }
  .mode-btn.active {
    background: var(--color-ghost-bg);
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .icon-btn:hover:not(:disabled) {
    background: var(--color-ghost-bg);
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  .icon-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .branding-wrapper {
    position: relative;
  }
  .branding-panel {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--color-bg, white);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    padding: 10px;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 220px;
  }
  .branding-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .branding-field span {
    font-size: 12px;
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .branding-field input,
  .branding-field select {
    font-size: 13px;
    padding: 4px 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    outline: none;
  }
  .branding-field input:focus,
  .branding-field select:focus {
    border-color: var(--color-primary);
  }
  .branding-save {
    padding: 5px 10px;
    font-size: 13px;
    font-weight: 600;
    background: transparent;
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s;
  }
  .branding-save:hover {
    background: var(--color-ghost-bg);
  }

  /* ── Theme popover ── */
  .theme-wrapper {
    position: relative;
  }
  .tp-backdrop {
    position: fixed;
    inset: 0;
    z-index: 49;
  }
  .theme-popover {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--color-bg, white);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.16);
    z-index: 50;
    width: 280px;
    max-height: 460px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .tp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .tp-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: 0.02em;
  }
  .tp-create-toggle {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-primary);
    background: none;
    border: 1px dashed var(--color-primary);
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .tp-create-toggle:hover {
    background: var(--color-ghost-bg);
  }

  /* Create form */
  .tp-create-form {
    padding: 8px 10px;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
    background: var(--color-bg-secondary, #f9fafb);
  }
  .tp-input {
    width: 100%;
    padding: 5px 7px;
    font-size: 12px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    outline: none;
    box-sizing: border-box;
    background: var(--color-bg);
    color: var(--color-text);
  }
  .tp-input:focus {
    border-color: var(--color-primary);
  }
  .tp-colors {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }
  .tp-color-field {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .tp-color-field span {
    font-size: 9px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .tp-color-field input[type="color"] {
    width: 28px;
    height: 20px;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    cursor: pointer;
    padding: 0;
  }
  .tp-fonts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  .tp-font-field {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .tp-font-field span {
    font-size: 9px;
    color: var(--color-text-muted);
    text-transform: uppercase;
  }
  .tp-font-field select {
    font-size: 11px;
    padding: 3px 4px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text);
  }
  .tp-save-btn {
    padding: 5px 10px;
    font-size: 11px;
    font-weight: 600;
    background: transparent;
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    transition: background 0.15s;
  }
  .tp-save-btn:hover:not(:disabled) { background: var(--color-ghost-bg); }
  .tp-save-btn:disabled { opacity: 0.5; cursor: default; }

  /* Theme list */
  .tp-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }
  .tp-empty {
    padding: 24px 10px;
    text-align: center;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  /* Theme row */
  .tp-row {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--color-border);
    transition: background 0.12s;
  }
  .tp-row:last-child {
    border-bottom: none;
  }
  .tp-row:hover {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.04));
  }
  .tp-row.active {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.06));
  }

  .tp-row-apply {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 7px 10px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    min-width: 0;
  }
  .tp-row-apply:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .tp-row-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
  }
  .tp-row-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tp-check {
    color: var(--color-primary);
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .tp-row-detail {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tp-swatches {
    display: flex;
    gap: 3px;
  }
  .tp-swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
  }
  .tp-fonts-label {
    font-size: 10px;
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Row actions */
  .tp-row-actions {
    display: flex;
    align-items: center;
    gap: 1px;
    flex-shrink: 0;
    border-left: 1px solid var(--color-border);
  }

  /* Variant toggle (light/dark) */
  .tp-variant-toggle {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--color-border);
  }
  .tp-var-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 50%;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    transition: background 0.12s, color 0.12s;
    padding: 0;
  }
  .tp-var-btn:hover {
    background: var(--color-ghost-bg);
    color: var(--color-primary);
  }
  .tp-var-btn.active {
    color: var(--color-primary);
    background: var(--color-ghost-bg);
  }

  .tp-fork-btn {
    padding: 0 6px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 9px;
    font-weight: 700;
    color: var(--color-text-muted);
    transition: color 0.12s;
    align-self: stretch;
    display: flex;
    align-items: center;
  }
  .tp-fork-btn:hover {
    color: var(--color-primary);
  }

  .tp-delete-btn {
    padding: 0 6px;
    background: none;
    border: none;
    border-left: 1px solid var(--color-border);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
    transition: color 0.12s;
    align-self: stretch;
    display: flex;
    align-items: center;
  }
  .tp-delete-btn:hover {
    color: #ef4444;
  }
  .tp-delete-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
