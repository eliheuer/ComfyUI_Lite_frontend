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

import { useColorScheme } from '@/composables/useColorScheme'

// Activate the theme runtime. Sets up a watchEffect that toggles the
// `data-theme` attribute on <html> based on the stored preference.
// Safe to call at module load — the watchEffect just observes a ref;
// no DOM mutation happens until the value changes.
useColorScheme()
