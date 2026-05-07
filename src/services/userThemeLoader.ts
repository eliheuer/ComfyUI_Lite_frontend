import { ref } from 'vue'
import { parse as parseToml } from 'smol-toml'

import { api } from '@/scripts/api'

export interface UserThemeMeta {
  name?: string
  author?: string
  description?: string
  mood?: 'dark' | 'light'
}

export interface UserTheme {
  id: string
  filename: string
  meta: UserThemeMeta
  tokens: {
    colors?: Record<string, string | Record<string, string>>
    typography?: Record<string, string>
    spacing?: Record<string, string>
    radii?: Record<string, string>
    shadows?: Record<string, string>
    motion?: Record<string, string>
  }
}

const themes = ref<UserTheme[] | null>(null)
const isLoading = ref(false)
const appliedProperties = new Set<string>()

/**
 * Lists user themes from `<ComfyUI>/user/default/themes/*.toml`. Caches
 * the result; call `reloadUserThemes()` to refresh after a file edit.
 */
export async function loadUserThemes(): Promise<UserTheme[]> {
  if (themes.value !== null) return themes.value
  if (isLoading.value) {
    while (isLoading.value) await new Promise((r) => setTimeout(r, 30))
    return themes.value ?? []
  }
  isLoading.value = true
  try {
    themes.value = await fetchUserThemes()
    return themes.value
  } finally {
    isLoading.value = false
  }
}

export async function reloadUserThemes(): Promise<UserTheme[]> {
  themes.value = null
  return loadUserThemes()
}

async function fetchUserThemes(): Promise<UserTheme[]> {
  const files = await api.listUserDataFullInfo('themes').catch(() => [])
  const tomls = files.filter((f) => f.path.toLowerCase().endsWith('.toml'))

  const loaded: UserTheme[] = []
  for (const file of tomls) {
    const theme = await tryLoadOne(file.path)
    if (theme) loaded.push(theme)
  }
  return loaded
}

async function tryLoadOne(path: string): Promise<UserTheme | null> {
  try {
    const resp = await api.getUserData(path)
    if (!resp.ok) return null
    const text = await resp.text()
    const parsed = parseToml(text) as Record<string, unknown>

    const filename = path.replace(/^themes\//, '')
    const id = filename.replace(/\.toml$/i, '')

    return {
      id,
      filename,
      meta: (parsed.meta as UserThemeMeta) ?? {},
      tokens: {
        colors: parsed.colors as UserTheme['tokens']['colors'],
        typography: parsed.typography as Record<string, string>,
        spacing: parsed.spacing as Record<string, string>,
        radii: parsed.radii as Record<string, string>,
        shadows: parsed.shadows as Record<string, string>,
        motion: parsed.motion as Record<string, string>
      }
    }
  } catch (err) {
    console.warn(`[userThemes] failed to load ${path}:`, err)
    return null
  }
}

/**
 * Applies a user theme by setting CSS custom properties on `:root`.
 * Tracks which properties were set so `clearUserTheme()` can fully
 * undo them, returning to the active built-in theme's cascade.
 */
export function applyUserTheme(theme: UserTheme): void {
  clearUserTheme()
  const root = document.documentElement.style

  const set = (name: string, value: string) => {
    root.setProperty(name, value)
    appliedProperties.add(name)
  }

  const colors = theme.tokens.colors ?? {}
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value === 'string') {
      set(`--color-${key}`, value)
    } else if (value !== null && typeof value === 'object') {
      // Nested groups in TOML map to single-prefix tokens. The only
      // group we ship by default is [colors.links]; rename to singular
      // to match our --color-link-* token convention.
      const groupName = key === 'links' ? 'link' : key
      for (const [subKey, subValue] of Object.entries(value)) {
        if (typeof subValue === 'string') {
          set(`--color-${groupName}-${subKey}`, subValue)
        }
      }
    }
  }

  applyCategory('text', theme.tokens.typography, set)
  applyCategory('space', theme.tokens.spacing, set)
  applyCategory('radius', theme.tokens.radii, set)
  applyCategory('shadow', theme.tokens.shadows, set)
  applyCategory('motion', theme.tokens.motion, set)
}

function applyCategory(
  prefix: string,
  map: Record<string, string> | undefined,
  set: (name: string, value: string) => void
): void {
  if (!map) return
  for (const [key, value] of Object.entries(map)) {
    if (typeof value === 'string') set(`--${prefix}-${key}`, value)
  }
}

/**
 * Removes every CSS property previously set by `applyUserTheme`. The
 * built-in `[data-theme]` cascade then drives the visual style again.
 */
export function clearUserTheme(): void {
  const root = document.documentElement.style
  for (const name of appliedProperties) {
    root.removeProperty(name)
  }
  appliedProperties.clear()
}
