import { useStorage } from '@vueuse/core'
import { watchEffect } from 'vue'

const STORAGE_KEY = 'lite-color-scheme'

export const THEMES = [
  'dark',
  'light',
  'gray',
  'strawberry',
  'mint',
  'campfire',
  'rainforest'
] as const

export type Theme = (typeof THEMES)[number]

type Mood = 'dark' | 'light'

const DEFAULT_THEME: Theme = 'dark'

const THEME_MOODS: Record<Theme, Mood> = {
  dark: 'dark',
  light: 'light',
  gray: 'light',
  strawberry: 'light',
  mint: 'light',
  campfire: 'dark',
  rainforest: 'dark'
}

const theme = useStorage<Theme>(STORAGE_KEY, DEFAULT_THEME)

/**
 * Toggle the `.dark-theme` body class. The `@comfyorg/design-system`
 * package gates its dark-mode tokens behind this class via a
 * `@custom-variant dark-theme`, so we drive it from the active theme's
 * mood. Without this, light themes leave half the UI dark.
 */
export function setBodyMood(mood: Mood) {
  if (typeof document === 'undefined' || !document.body) return
  document.body.classList.toggle('dark-theme', mood === 'dark')
}

/** Read the current built-in theme's mood. Used by the user-theme
 *  clear path to restore the underlying built-in mood. */
export function getBuiltInMood(): Mood {
  return THEME_MOODS[theme.value]
}

watchEffect(() => {
  const root = document.documentElement
  if (theme.value === DEFAULT_THEME) root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme.value)
  setBodyMood(THEME_MOODS[theme.value])
})

export function useColorScheme() {
  return { theme }
}
