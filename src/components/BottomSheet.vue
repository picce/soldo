<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'

/**
 * Sheet that slides up from the bottom (date, note, filters), built on VvDialog: a native
 * modal <dialog>, closed with Chiudi, Esc or a tap on the veiled page around it
 * (docs/design/README.md, "Fogli, finestre e campi").
 */
defineProps<{
  title: string
}>()

const open = defineModel<boolean>({ required: true })

const { t } = useI18n()
const titleId = useId()
</script>

<template>
  <VvDialog
    v-model="open"
    modifiers="drawer-bottom"
    transition="slide-block-end"
    class="bottom-sheet"
    :aria-labelledby="titleId"
  >
    <template #header>
      <span class="bottom-sheet__handle" aria-hidden="true" />
      <h2 :id="titleId" class="bottom-sheet__title type-title">
        {{ title }}
      </h2>
      <button type="button" class="bottom-sheet__close" :aria-label="t('common.close')" @click="open = false">
        <AppIcon name="x" />
      </button>
    </template>
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </VvDialog>
</template>

<style scoped>
/* The dialog is the veil over the page; the article inside is the sheet. */
.bottom-sheet {
  background-color: var(--color-scrim);
  backdrop-filter: none;
}

.bottom-sheet::backdrop {
  background: transparent;
}

.bottom-sheet :deep(.vv-dialog__wrapper) {
  width: 100%;
  max-width: 40rem;
  max-height: 90dvh;
  margin-inline: auto;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-card);
  border-top: 1px solid var(--color-line);
  border-radius: 0.75rem 0.75rem 0 0;
  box-shadow: none;
  color: var(--color-ink);
}

.bottom-sheet :deep(.vv-dialog__header) {
  position: relative;
  gap: 1rem;
  padding: 1.5rem var(--page-gutter) 1rem;
  background: transparent;
  border: 0;
}

.bottom-sheet :deep(.vv-dialog__content) {
  padding: 0 var(--page-gutter) 1.25rem;
}

.bottom-sheet :deep(.vv-dialog__footer) {
  gap: 0.75rem;
  padding: 0 var(--page-gutter) 1.5rem;
  background: transparent;
  border: 0;
}

.bottom-sheet__handle {
  position: absolute;
  top: 0.5rem;
  left: 50%;
  width: 2.25rem;
  height: 0.25rem;
  translate: -50% 0;
  background: var(--color-line);
  border-radius: 2px;
}

.bottom-sheet__title {
  margin: 0;
}

.bottom-sheet__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  margin-inline-end: -0.625rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-ink);
  cursor: pointer;
}

.bottom-sheet__close:focus-visible {
  outline: 2px solid var(--color-pen);
  border-radius: var(--rounded);
}
</style>
