import type { ThemeData } from '$lib/stores/themes'

export const StudioDark: ThemeData = {
  id: 'studio-dark',
  name: 'Studio Dark',
  css: '',
  fonts: { heading: 'Outfit', body: 'Inter' },
  colors: { primary: '#1D3A83', secondary: '#64b5f6', accent: '#2FB8D6', bg: '#0c1220' },
  builtIn: true,
}

export const StudioLight: ThemeData = {
  id: 'studio-light',
  name: 'Studio Light',
  css: '',
  fonts: { heading: 'Outfit', body: 'Inter' },
  colors: { primary: '#1D3A83', secondary: '#3B73E6', accent: '#2FB8D6', bg: '#ffffff' },
  builtIn: true,
}

export const STUDIO_THEMES: ThemeData[] = [StudioDark, StudioLight]

