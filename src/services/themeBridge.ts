import { watch } from 'vue'

import { useColorScheme } from '@/composables/useColorScheme'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

const readVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function applyToLiteGraph() {
  const canvas = app.canvas
  if (!canvas) return

  // Properties on the running LGraphCanvas instance
  canvas.clear_background_color = readVar('--color-canvas-bg')
  canvas.default_link_color = readVar('--color-border')
  canvas.node_title_color = readVar('--color-node-header')

  // Namespace constants — Tier 1 compat for any extension that still
  // draws on the canvas and reads these values directly. New code
  // should reference --color-* tokens via CSS instead.
  Object.assign(LiteGraph, {
    NODE_DEFAULT_BGCOLOR: readVar('--color-node-bg'),
    NODE_DEFAULT_COLOR: readVar('--color-node-border'),
    NODE_TITLE_COLOR: readVar('--color-node-header'),
    NODE_TEXT_COLOR: readVar('--color-node-text'),
    NODE_BOX_OUTLINE_COLOR: readVar('--color-text'),
    NODE_ERROR_COLOUR: readVar('--color-node-error'),
    LINK_COLOR: readVar('--color-border'),
    WIDGET_BGCOLOR: readVar('--color-surface-alt'),
    WIDGET_TEXT_COLOR: readVar('--color-text'),
    WIDGET_OUTLINE_COLOR: readVar('--color-border')
  })

  canvas.draw(true, true)
}

/**
 * Wires the theme system to the LiteGraph canvas: every time the
 * active theme changes, reads CSS-var values from :root and pushes
 * them into LiteGraph's runtime constants, then redraws.
 *
 * Call once after the LGraphCanvas instance exists. Safe to call
 * multiple times (the watcher is idempotent under HMR).
 */
export function installThemeBridge() {
  const { theme } = useColorScheme()
  watch(theme, applyToLiteGraph, { immediate: true, flush: 'post' })
}
