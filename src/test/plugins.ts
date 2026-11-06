import type { Plugin } from 'vue'
import { VolverPlugin } from '@volverjs/ui-vue'
import { createPinia } from 'pinia'
import phIcons from '@/assets/icons/ph.json'
import { i18n } from '@/i18n'

/**
 * Plugins for mounting components in unit tests, as in main.ts: Pinia, vue-i18n and Volver
 * with the local icons. Without the icons, VvIcon would try to download them from the network.
 */
export function testPlugins(...extra: Plugin[]): (Plugin | [Plugin, ...unknown[]])[] {
  return [
    createPinia(),
    ...extra,
    i18n,
    [
      VolverPlugin,
      {
        iconsCollections: [phIcons],
      },
    ],
  ]
}
