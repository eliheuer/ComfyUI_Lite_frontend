/**
 * Lite-only registration barrel.
 *
 * Imported once from `main.ts` to activate Lite-specific systems
 * (theme tokens, theme runtime, future features). Future Lite
 * additions register themselves through this file so `main.ts` stays
 * touched exactly once over the lifetime of the fork.
 */

// Load the new token system into the build. The CSS sits alongside
// the legacy palette plumbing for now — Tier 1 aliases keep existing
// components working through tokens.css.
import '@/styles/tokens.css'

import {
  getBuiltInMood,
  setBodyMood,
  useColorScheme
} from '@/composables/useColorScheme'
import { installThemeBridge } from '@/services/themeBridge'
import { app } from '@/scripts/app'

// Activate the theme runtime. Sets up a watchEffect that toggles the
// `data-theme` attribute on <html> based on the stored preference.
useColorScheme()

// Install the LiteGraph bridge once the canvas exists, AND re-apply
// the body mood here too. The legacy GraphView.vue still has a watcher
// that toggles `.dark-theme` based on the legacy palette store; it
// fires at mount, which happens AFTER our module-load watchEffect.
// Re-applying after canvas-ready ensures we win the initial-load race.
function installBridgeWhenReady() {
  if (app.canvas) {
    installThemeBridge()
    setBodyMood(getBuiltInMood())
  } else {
    requestAnimationFrame(installBridgeWhenReady)
  }
}
installBridgeWhenReady()
