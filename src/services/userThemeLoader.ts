import { ref } from 'vue'

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
  cssText: string
}

const STYLE_ID = 'lite-user-theme'
const META_REGEX = /\/\*\s*@meta\s+([\w-]+)\s*=\s*([^*]+?)\s*\*\//g

const themes = ref<UserTheme[] | null>(null)
const isLoading = ref(false)
const activeUserThemeId = ref<string | null>(null)

/**
 * The id of the currently-applied user theme, or null if a built-in
 * theme is active. Shared between consumers (ColorSchemeMenu and
 * ComfyMenuButton's quick-access dropdown).
 */
export function useActiveUserTheme() {
  return activeUserThemeId
}

/**
 * Lists user themes from `<ComfyUI>/user/default/themes/*.css`.
 * Caches the result; call `reloadUserThemes()` to refresh after a
 * file edit.
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
  const csses = files.filter((f) => f.path.toLowerCase().endsWith('.css'))

  const loaded: UserTheme[] = []
  for (const file of csses) {
    const theme = await tryLoadOne(file.path)
    if (theme) loaded.push(theme)
  }
  return loaded
}

async function tryLoadOne(path: string): Promise<UserTheme | null> {
  try {
    const resp = await api.getUserData(path)
    if (!resp.ok) return null
    const cssText = await resp.text()

    const filename = path.replace(/^themes\//, '')
    const id = filename.replace(/\.css$/i, '')

    return {
      id,
      filename,
      meta: parseMeta(cssText),
      cssText
    }
  } catch (err) {
    console.warn(`[userThemes] failed to load ${path}:`, err)
    return null
  }
}

function parseMeta(cssText: string): UserThemeMeta {
  const meta: Record<string, string> = {}
  let match: RegExpExecArray | null
  // Reset lastIndex on every call — the regex is module-scoped
  META_REGEX.lastIndex = 0
  while ((match = META_REGEX.exec(cssText)) !== null) {
    const [, key, value] = match
    meta[key] = value
  }
  return meta as UserThemeMeta
}

/**
 * Applies a user theme by injecting its CSS as a `<style>` element in
 * `<head>`. The cascade picks up `:root` overrides automatically.
 * Re-applying replaces the previous theme's CSS.
 */
export function applyUserTheme(theme: UserTheme): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = theme.cssText
  activeUserThemeId.value = theme.id
}

/**
 * Removes the user-theme `<style>` element. The built-in `[data-theme]`
 * cascade then drives the visual style again.
 */
export function clearUserTheme(): void {
  const style = document.getElementById(STYLE_ID)
  if (style) style.remove()
  activeUserThemeId.value = null
}
