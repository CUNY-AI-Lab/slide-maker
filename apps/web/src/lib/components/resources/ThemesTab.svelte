<script lang="ts">
  import { get } from 'svelte/store'
  import { currentDeck } from '$lib/stores/deck'
  import { themesStore, themesLoaded, ensureThemesLoaded, type ThemeData, isDark } from '$lib/stores/themes'
  import { API_URL } from '$lib/api'

  type Theme = ThemeData

  const COMMON_FONTS = [
    'Inter', 'Outfit', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
    'Poppins', 'Raleway', 'Nunito', 'Playfair Display', 'Merriweather',
    'Source Sans Pro', 'PT Sans', 'Work Sans', 'DM Sans', 'Space Grotesk',
    'Georgia',
  ]

  let themes = $derived($themesStore)
  let loading = $derived(!$themesLoaded)
  let error = $state<string | null>(null)
  let applying = $state<string | null>(null)
  let deckThemeId = $state<string | null>(null)
  let deckHasTheme = $derived(!!deckThemeId)
  let currentTheme = $derived(themes.find((t) => t.id === deckThemeId) ?? null)
  let currentIsDark = $derived(currentTheme ? isDark((currentTheme.colors as any)?.bg ?? '#111827') : true)

  // Create theme form
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

  $effect(() => {
    const unsub = currentDeck.subscribe((d) => {
      deckThemeId = d?.themeId ?? null
    })
    return unsub
  })

  $effect(() => { ensureThemesLoaded() })

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

  function findPairedTheme(current: Theme, list: Theme[]): Theme | null {
    if (!current) return null
    const byName = (name: string) => list.find(t => t.name.toLowerCase() === name.toLowerCase()) || null
    const byId = (id: string) => list.find(t => t.id.toLowerCase() === id.toLowerCase()) || null

    const name = current.name
    const id = current.id
    const candidates: (Theme | null)[] = []
    if (/dark/i.test(name)) candidates.push(byName(name.replace(/dark/i, 'Light')))
    if (/light/i.test(name)) candidates.push(byName(name.replace(/light/i, 'Dark')))
    if (/-dark$/i.test(id)) candidates.push(byId(id.replace(/-dark$/i, '-light')))
    if (/-light$/i.test(id)) candidates.push(byId(id.replace(/-light$/i, '-dark')))

    const found = candidates.find(Boolean)
    if (found) return found as Theme

    // Fallback: flip by brightness to nearest opposite
    const curIsDark = isDark((current.colors as any)?.bg ?? '#111827')
    const pool = list.filter(t => !!t.colors)
    const opposites = pool.filter(t => isDark((t.colors as any).bg ?? '#111827') !== curIsDark)
    return opposites[0] ?? null
  }

  async function toggleDeckLightDark() {
    const deck = get(currentDeck)
    if (!deck) return
    const themes = get(themesStore)
    const cur = themes.find(t => t.id === deck.themeId)
    if (!cur) return
    const paired = findPairedTheme(cur, themes)
    if (!paired) return
    await applyTheme(paired.id)
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

  async function forkTheme(theme: Theme) {
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
        // If deleted theme was active, fall back to default
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

  function getColors(theme: Theme): string[] {
    const c = theme.colors as Record<string, string> | null
    if (!c) return ['#6b7280', '#9ca3af', '#d1d5db', '#f3f4f6']
    return [c.primary ?? '#6b7280', c.secondary ?? '#9ca3af', c.accent ?? '#d1d5db', c.bg ?? '#f3f4f6']
  }

  function getFonts(theme: Theme): string {
    const f = theme.fonts as Record<string, string> | null
    if (!f) return 'Default'
    const parts: string[] = []
    if (f.heading) parts.push(f.heading)
    if (f.body && f.body !== f.heading) parts.push(f.body)
    return parts.length > 0 ? parts.join(' / ') : 'Default'
  }
</script>

<div class="themes-tab">
  <div class="tab-header">
    <div class="header-actions">
      <button
        class="toggle-btn"
        class:toggled-on={currentIsDark}
        onclick={toggleDeckLightDark}
        disabled={!deckHasTheme || applying !== null}
        title={currentIsDark ? 'Switch to light theme' : 'Switch to dark theme'}
        aria-label={currentIsDark ? 'Switch to light theme' : 'Switch to dark theme'}
        role="switch"
        aria-checked={currentIsDark}>
        <span class="toggle-track">
          <span class="toggle-thumb"></span>
        </span>
        <span class="toggle-label">{currentIsDark ? 'Dark' : 'Light'}</span>
      </button>
      <button class="create-btn" onclick={() => { showCreateForm = !showCreateForm }}>
        {showCreateForm ? 'Cancel' : '+ Create Theme'}
      </button>
    </div>
  </div>

  {#if showCreateForm}
    <div class="create-form">
      <input class="form-input" type="text" bind:value={formName} placeholder="Theme name" />

      <div class="color-row">
        <label class="color-field">
          <span>Primary</span>
          <input type="color" bind:value={formPrimary} />
        </label>
        <label class="color-field">
          <span>Secondary</span>
          <input type="color" bind:value={formSecondary} />
        </label>
        <label class="color-field">
          <span>Accent</span>
          <input type="color" bind:value={formAccent} />
        </label>
        <label class="color-field">
          <span>Bg</span>
          <input type="color" bind:value={formBg} />
        </label>
      </div>

      <div class="font-row">
        <label class="font-field">
          <span>Heading</span>
          <select bind:value={formHeadingFont}>
            {#each COMMON_FONTS as font}
              <option value={font}>{font}</option>
            {/each}
          </select>
        </label>
        <label class="font-field">
          <span>Body</span>
          <select bind:value={formBodyFont}>
            {#each COMMON_FONTS as font}
              <option value={font}>{font}</option>
            {/each}
          </select>
        </label>
      </div>

      <button class="save-btn" onclick={handleCreateTheme} disabled={!formName.trim() || saving}>
        {saving ? 'Saving...' : 'Save Theme'}
      </button>
    </div>
  {/if}

  {#if loading}
    <div class="center-msg">Loading themes...</div>
  {:else if error}
    <div class="center-msg error">{error}</div>
  {:else if themes.length === 0}
    <div class="center-msg">No themes available yet. Themes will appear here after seeding.</div>
  {:else}
    <div class="theme-list">
      {#each themes as theme (theme.id)}
        {@const isActive = deckThemeId === theme.id}
        <div class="theme-card" class:active={isActive}>
          <button
            class="theme-apply"
            onclick={() => applyTheme(theme.id)}
            disabled={applying !== null}
          >
            <div class="theme-header">
              <span class="theme-name">{theme.name}</span>
              {#if isActive}
                <span class="check">{'\u2713'}</span>
              {/if}
            </div>
            <div class="swatches">
              {#each getColors(theme) as color}
                <span class="swatch" style:background={color}></span>
              {/each}
            </div>
            <div class="theme-fonts">{getFonts(theme)}</div>
          </button>
          <button class="fork-btn" onclick={() => forkTheme(theme)} title="Fork this theme">Fork</button>
          {#if !theme.builtIn}
            <button
              class="delete-btn"
              onclick={() => {
                if (confirmDelete === theme.id) {
                  deleteTheme(theme.id)
                } else {
                  confirmDelete = theme.id
                }
              }}
              disabled={deleting === theme.id}
              title={confirmDelete === theme.id ? 'Click again to confirm' : 'Delete this theme'}
            >
              {deleting === theme.id ? '...' : confirmDelete === theme.id ? 'Sure?' : '✕'}
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .themes-tab {
    padding: 8px;
  }

  .tab-header {
    margin-bottom: 8px;
  }

  .header-actions { display: flex; gap: 6px; }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: transparent;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    transition: background 0.15s, border-color 0.15s;
  }
  .toggle-btn:hover:not(:disabled) { background: #f3f4f6; }
  .toggle-btn:disabled { opacity: 0.5; cursor: default; }

  .toggle-track {
    position: relative;
    width: 24px;
    height: 14px;
    background: var(--color-border, #d1d5db);
    border-radius: 7px;
    transition: background 0.2s;
  }
  .toggled-on .toggle-track {
    background: var(--color-primary, #3B73E6);
  }
  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 10px;
    height: 10px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  .toggled-on .toggle-thumb {
    transform: translateX(10px);
  }
  .toggle-label {
    min-width: 24px;
  }

  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

  .create-btn {
    width: 100%;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    background: transparent;
    color: var(--color-primary, #3B73E6);
    border: 1px dashed var(--color-primary, #3B73E6);
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    transition: background 0.15s;
  }
  .create-btn:hover {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
  }

  .create-form {
    background: #f9fafb;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 6px;
    padding: 10px;
    margin-bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-input {
    width: 100%;
    padding: 6px 8px;
    font-size: 12px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 4px;
    outline: none;
    box-sizing: border-box;
  }
  .form-input:focus {
    border-color: var(--color-primary, #3B73E6);
  }

  .color-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .color-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
  }
  .color-field span {
    font-size: 9px;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .color-field input[type="color"] {
    width: 32px;
    height: 24px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 4px;
    cursor: pointer;
    padding: 0;
  }

  .font-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .font-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .font-field span {
    font-size: 9px;
    color: var(--color-text-muted, #6b7280);
    text-transform: uppercase;
  }
  .font-field select {
    font-size: 11px;
    padding: 4px;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 4px;
  }

  .save-btn {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    background: transparent;
    color: var(--color-primary, #3B73E6);
    border: 1px solid var(--color-primary, #3B73E6);
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    transition: background 0.15s;
  }
  .save-btn:hover:not(:disabled) { background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08)); }
  .save-btn:disabled { opacity: 0.5; cursor: default; }

  .center-msg {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px 16px;
    font-size: 12px;
    color: var(--color-text-muted, #6b7280);
    text-align: center;
    line-height: 1.5;
  }

  .center-msg.error {
    color: #ef4444;
  }

  .theme-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .theme-card {
    display: flex;
    align-items: stretch;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: var(--radius-sm, 6px);
    background: var(--color-bg);
    transition: border-color 0.15s, box-shadow 0.15s;
    overflow: hidden;
  }

  .theme-card:hover {
    border-color: var(--color-text-muted);
  }

  .theme-card.active {
    border-color: var(--color-primary, #3B73E6);
    box-shadow: 0 0 0 1px var(--color-primary, #3B73E6);
  }

  .theme-apply {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .theme-apply:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .fork-btn {
    padding: 0 12px;
    background: #f9fafb;
    border: none;
    border-left: 1px solid var(--color-border, #e5e7eb);
    cursor: pointer;
    font-size: 9px;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    transition: background 0.15s, color 0.15s;
  }
  .fork-btn:hover {
    background: var(--color-ghost-bg, rgba(59, 115, 230, 0.08));
    color: var(--color-primary, #3B73E6);
  }

  .delete-btn {
    padding: 0 8px;
    background: #f9fafb;
    border: none;
    border-left: 1px solid var(--color-border, #e5e7eb);
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-muted, #6b7280);
    transition: background 0.15s, color 0.15s;
  }
  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.08);
    color: #ef4444;
  }
  .delete-btn:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  .theme-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .theme-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text, #1f2937);
  }

  .check {
    color: var(--color-primary, #3B73E6);
    font-size: 14px;
    font-weight: 700;
  }

  .swatches {
    display: flex;
    gap: 6px;
  }

  .swatch {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }

  .theme-fonts {
    font-size: 10px;
    color: var(--color-text-muted, #9ca3af);
  }
</style>
