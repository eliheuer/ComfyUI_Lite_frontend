<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { THEMES, useColorScheme } from '@/composables/useColorScheme';
import type { Theme } from '@/composables/useColorScheme';
import { applyUserTheme, clearUserTheme, loadUserThemes, reloadUserThemes } from '@/services/userThemeLoader';
import type { UserTheme } from '@/services/userThemeLoader';
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()
const { theme } = useColorScheme()

const userThemes = ref<UserTheme[]>([])
const activeUserId = ref<string | null>(null)
const isReloading = ref(false)

onMounted(async () => {
  userThemes.value = await loadUserThemes()
})

function selectBuiltIn(t: Theme) {
  clearUserTheme()
  activeUserId.value = null
  theme.value = t
}

function selectUser(ut: UserTheme) {
  applyUserTheme(ut)
  activeUserId.value = ut.id
}

async function reload() {
  isReloading.value = true
  try {
    userThemes.value = await reloadUserThemes()
  } finally {
    isReloading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-1 p-2">
    <div
      class="text-text-muted px-2 py-1 text-xs font-medium tracking-wider uppercase"
    >
      {{ t('colorScheme.builtIn') }}
    </div>

    <button
      v-for="builtIn in THEMES"
      :key="builtIn"
      type="button"
      :class="
        cn(
          'hover:bg-surface-alt rounded-md px-3 py-1.5 text-left transition-colors',
          theme === builtIn &&
            activeUserId === null &&
            'bg-surface-alt font-medium'
        )
      "
      @click="selectBuiltIn(builtIn)"
    >
      {{ t(`colorScheme.themes.${builtIn}`) }}
    </button>

    <template v-if="userThemes.length > 0">
      <div
        class="text-text-muted mt-3 px-2 py-1 text-xs font-medium tracking-wider uppercase"
      >
        {{ t('colorScheme.user') }}
      </div>

      <button
        v-for="ut in userThemes"
        :key="ut.id"
        type="button"
        :class="
          cn(
            'hover:bg-surface-alt flex flex-col rounded-md px-3 py-1.5 text-left transition-colors',
            activeUserId === ut.id && 'bg-surface-alt font-medium'
          )
        "
        @click="selectUser(ut)"
      >
        <span>{{ ut.meta.name ?? ut.id }}</span>
        <span
          v-if="ut.meta.description"
          class="text-text-muted text-xs font-normal"
        >
          {{ ut.meta.description }}
        </span>
      </button>
    </template>

    <button
      type="button"
      :disabled="isReloading"
      class="text-text-muted hover:text-text mt-3 px-3 py-1 text-left text-xs disabled:opacity-50"
      @click="reload"
    >
      {{ t('colorScheme.reload') }}
    </button>
  </div>
</template>
