import { useDarkMood } from '@/composables/useColorScheme'
import { adjustColor } from '@/utils/colorUtil'

/**
 * Applies light theme color adjustments to a color
 */
export function applyLightThemeColor(color?: string): string {
  if (!color) return ''

  if (useDarkMood().value) return color

  return adjustColor(color, { lightness: 0.5 })
}
