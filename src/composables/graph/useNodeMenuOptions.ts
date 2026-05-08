import { useI18n } from 'vue-i18n'

import type { MenuOption } from './useMoreOptionsMenu'
import { useSelectedNodeActions } from './useSelectedNodeActions'
import type { NodeSelectionState } from './useSelectionState'

/**
 * Composable for node-related menu operations.
 *
 * Lite fork: Shape and Color submenus removed with V1 drop. V2 nodes
 * are CSS-styled, not per-node configured.
 */
export function useNodeMenuOptions() {
  const { t } = useI18n()
  const {
    adjustNodeSize,
    toggleNodeCollapse,
    toggleNodePin,
    toggleNodeBypass,
    runBranch
  } = useSelectedNodeActions()

  const getAdjustSizeOption = (): MenuOption => ({
    label: t('contextMenu.Adjust Size'),
    icon: 'icon-[lucide--move-diagonal-2]',
    action: adjustNodeSize
  })

  const getNodeVisualOptions = (
    states: NodeSelectionState,
    bump: () => void
  ): MenuOption[] => [
    {
      label: states.collapsed
        ? t('contextMenu.Expand Node')
        : t('contextMenu.Minimize Node'),
      icon: states.collapsed
        ? 'icon-[lucide--maximize-2]'
        : 'icon-[lucide--minimize-2]',
      action: () => {
        toggleNodeCollapse()
        bump()
      }
    }
  ]

  const getPinOption = (
    states: NodeSelectionState,
    bump: () => void
  ): MenuOption => ({
    label: states.pinned ? t('contextMenu.Unpin') : t('contextMenu.Pin'),
    icon: states.pinned ? 'icon-[lucide--pin-off]' : 'icon-[lucide--pin]',
    action: () => {
      toggleNodePin()
      bump()
    }
  })

  const getBypassOption = (
    states: NodeSelectionState,
    bump: () => void
  ): MenuOption => ({
    label: states.bypassed
      ? t('contextMenu.Remove Bypass')
      : t('contextMenu.Bypass'),
    icon: 'icon-[lucide--redo-dot]',
    shortcut: 'Ctrl+B',
    action: () => {
      toggleNodeBypass()
      bump()
    }
  })

  const getRunBranchOption = (): MenuOption => ({
    label: t('contextMenu.Run Branch'),
    icon: 'icon-[lucide--play]',
    action: runBranch
  })

  const getNodeInfoOption = (showNodeHelp: () => void): MenuOption => ({
    label: t('contextMenu.Node Info'),
    icon: 'icon-[lucide--info]',
    action: showNodeHelp
  })

  return {
    getNodeInfoOption,
    getAdjustSizeOption,
    getNodeVisualOptions,
    getPinOption,
    getBypassOption,
    getRunBranchOption
  }
}
