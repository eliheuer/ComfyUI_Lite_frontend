import { useStorage } from '@vueuse/core'
import { ref, watchEffect } from 'vue'

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

const isDarkMood = ref<boolean>(THEME_MOODS[DEFAULT_THEME] === 'dark')

/**
 * Reactive ref that tracks whether the active theme (built-in or user)
 * is in dark mood. Replaces the legacy
 * `colorPaletteStore.completedActivePalette.light_theme` check —
 * use `!useDarkMood().value` for the legacy polarity.
 */
export function useDarkMood() {
  return isDarkMood
}

/**
 * Toggle the `.dark-theme` body class. The `@comfyorg/design-system`
 * package gates its dark-mode tokens behind this class via a
 * `@custom-variant dark-theme`, so we drive it from the active theme's
 * mood. Without this, light themes leave half the UI dark.
 */
export function setBodyMood(mood: Mood) {
  if (typeof document === 'undefined' || !document.body) return
  document.body.classList.toggle('dark-theme', mood === 'dark')
  isDarkMood.value = mood === 'dark'
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
