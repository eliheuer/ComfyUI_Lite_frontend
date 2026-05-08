/**
 * Vue-related feature flags composable.
 *
 * Lite fork: V1 nodes are dropped; V2 (Vue-rendered) is the only
 * supported mode. `shouldRenderVueNodes` always returns true. The
 * `Comfy.VueNodes.Enabled` setting still exists but the toggle no
 * longer has any effect; the setting will be removed in a follow-up.
 */
import { createSharedComposable } from '@vueuse/core'
import { computed } from 'vue'

import { LiteGraph } from '../lib/litegraph/src/litegraph'

LiteGraph.vueNodesMode = true

function useVueFeatureFlagsIndividual() {
  return {
    shouldRenderVueNodes: computed(() => true)
  }
}

export const useVueFeatureFlags = createSharedComposable(
  useVueFeatureFlagsIndividual
)
