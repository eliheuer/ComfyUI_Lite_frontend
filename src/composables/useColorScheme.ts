import { useStorage } from '@vueuse/core'
import { watchEffect } from 'vue'

const STORAGE_KEY = 'lite-color-scheme'

/** @knipIgnoreUsedByStackedPR — consumed by ColorSchemeMenu.vue (step 2c). */
export const THEMES = [
  'dark',
  'light',
  'gray',
  'strawberry',
  'mint',
  'campfire'
] as const

/** @knipIgnoreUsedByStackedPR — consumed by ColorSchemeMenu.vue (step 2c). */
export type Theme = (typeof THEMES)[number]

const DEFAULT_THEME: Theme = 'dark'

export function useColorScheme() {
  const theme = useStorage<Theme>(STORAGE_KEY, DEFAULT_THEME)

  watchEffect(() => {
    const root = document.documentElement
    if (theme.value === DEFAULT_THEME) root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme.value)
  })

  return { theme }
}
