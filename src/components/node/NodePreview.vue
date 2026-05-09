<template>
  <LGraphNodePreview :node-def="nodeDef" :position="position" />
</template>

<script setup lang="ts">
import LGraphNodePreview from '@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue'
import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'

// Lite fork: V1 drop simplified this to a thin wrapper around the
// Vue-rendered LGraphNodePreview. Previous file had a 90-line v-else
// fallback for V1 mode that's no longer reachable.
const { nodeDef, position = 'absolute' } = defineProps<{
  nodeDef: ComfyNodeDefV2
  position?: 'absolute' | 'relative'
}>()
</script>
