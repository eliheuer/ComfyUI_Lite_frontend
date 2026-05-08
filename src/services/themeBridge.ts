import { watch } from 'vue'

import { useColorScheme } from '@/composables/useColorScheme'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

const readVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function applyToLiteGraph() {
  const canvas = app.canvas
  if (!canvas) return

  // Canvas-level properties — used for canvas background and link
  // (cable) rendering between V2 nodes.
  canvas.clear_background_color = readVar('--color-canvas-bg')
  canvas.default_link_color = readVar('--color-border')

  // LINK_COLOR namespace constant — used by some link-drawing code
  // paths and any extension that draws on the canvas.
  LiteGraph.LINK_COLOR = readVar('--color-border')

  canvas.draw(true, true)
}

/**
 * Wires the theme system to the LiteGraph canvas: every time the
 * active theme changes, reads CSS-var values from :root and pushes
 * them into the canvas + LiteGraph link color, then redraws.
 *
 * Lite fork: simplified after V1 nodes were dropped — per-node color
 * constants (`NODE_DEFAULT_BGCOLOR`, `NODE_TITLE_COLOR`, etc.) are no
 * longer set, since V2 nodes are Vue components and don't read them.
 *
 * Call once after the LGraphCanvas instance exists. Safe to call
 * multiple times (the watcher is idempotent under HMR).
 */
export function installThemeBridge() {
  const { theme } = useColorScheme()
  watch(theme, applyToLiteGraph, { immediate: true, flush: 'post' })
}
