<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'

/**
 * Soldo is used upright. The manifest keeps the installed app upright on Android
 * (`orientation: 'portrait'` in vite.config.ts), but the iPhone and the browsers ignore it: a
 * phone turned sideways gets this notice over the whole app instead. Only on touch screens
 * that are low and wide, so a computer window or a tablet are left alone. With `preview` it
 * shows in place, for /dev/ui.
 */
defineProps<{
  preview?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div class="rotate-notice" :class="{ 'rotate-notice--preview': preview }">
    <AppIcon name="device-rotate" class="rotate-notice__icon" />
    <p class="rotate-notice__title type-title">
      {{ t('rotate.title') }}
    </p>
    <p class="rotate-notice__text type-body">
      {{ t('rotate.text') }}
    </p>
  </div>
</template>

<style scoped>
.rotate-notice {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  background: var(--color-paper);
  color: var(--color-ink);
  text-align: center;
}

@media (orientation: landscape) and (max-height: 500px) and (pointer: coarse) {
  .rotate-notice {
    position: fixed;
    inset: 0;
    /* Above the bars, the notices and «Aggiorna». */
    z-index: 40;
    display: flex;
    padding:
      calc(1.5rem + env(safe-area-inset-top))
      calc(1.5rem + env(safe-area-inset-right))
      calc(1.5rem + env(safe-area-inset-bottom))
      calc(1.5rem + env(safe-area-inset-left));
    /* The page under it does not move while the notice is there. */
    overscroll-behavior: contain;
    touch-action: none;
  }
}

.rotate-notice--preview {
  display: flex;
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.rotate-notice p {
  margin: 0;
}

.rotate-notice__icon {
  --app-icon-size: 2.5rem;

  margin-bottom: 0.5rem;
  color: var(--color-pen);
}

.rotate-notice__text {
  color: var(--color-ink-2);
}
</style>
