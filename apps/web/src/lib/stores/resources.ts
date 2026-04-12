import { derived } from 'svelte/store'
import { templatesStore, ensureTemplatesLoaded, findTemplateById } from './templates'
import { themesStore, ensureThemesLoaded, createTheme, deleteTheme } from './themes'
import { artifactsStore, ensureArtifactsLoaded, findArtifactByName } from './artifacts'

export {
  // Templates
  templatesStore, ensureTemplatesLoaded, findTemplateById,
  // Themes
  themesStore, ensureThemesLoaded, createTheme, deleteTheme,
  // Artifacts
  artifactsStore, ensureArtifactsLoaded, findArtifactByName,
}

export const allResources = derived(
  [templatesStore, themesStore, artifactsStore],
  ([$templates, $themes, $artifacts]) => ({
    templates: $templates,
    themes: $themes,
    artifacts: $artifacts,
  }),
)

export async function ensureAllResourcesLoaded() {
  await Promise.all([
    ensureTemplatesLoaded(),
    ensureThemesLoaded(),
    ensureArtifactsLoaded(),
  ])
}
