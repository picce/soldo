<script setup lang="ts">
import { useId, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDragToClose } from '@/app/gestures'
import AppIcon from '@/components/AppIcon.vue'

/**
 * Sheet that slides up from the bottom (date, note, filters), built on VvDialog: a native
 * modal <dialog>, closed with Chiudi, Esc, a tap on the veiled page around it or by
 * dragging its head down (docs/design/README.md, "Fogli, finestre e campi").
 */
defineProps<{
  title: string
}>()

const open = defineModel<boolean>({ required: true })

const { t } = useI18n()
const titleId = useId()

// The sheet follows the finger; once closed, it leaves from where the finger let it go.
const head = useTemplateRef<HTMLElement>('head')
const { offset, dragging, reset } = useDragToClose(
  head,
  () => head.value?.closest('.vv-dialog__wrapper')?.getBoundingClientRect().height ?? window.innerHeight,
  () => {
    open.value = false
  },
)
</script>

<template>
  <VvDialog
    v-model="open"
    modifiers="drawer-bottom"
    transition="slide-block-end"
    class="bottom-sheet"
    :class="{ 'bottom-sheet--dragging': dragging }"
    :style="{ '--sheet-drag': `${offset}px` }"
    :aria-labelledby="titleId"
    @after-leave="reset"
  >
    <template #header>
      <div ref="head" class="bottom-sheet__head">
        <span class="bottom-sheet__handle" aria-hidden="true" />
        <h2 :id="titleId" class="bottom-sheet__title type-title">
          {{ title }}
        </h2>
        <button type="button" class="bottom-sheet__close" :aria-label="t('common.close')" @click="open = false">
          <AppIcon name="x" />
        </button>
      </div>
    </template>
    <slot />
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </VvDialog>
</template>

<style scoped>
/*
 * The dialog is the veil over the page; the article inside is the sheet. The veil fades
 * and the sheet slides with the motion tokens (docs/design/README.md, "Movimento").
 */
.bottom-sheet {
  --vv-dialog-transition-slide-block-end-active-transition: opacity var(--motion-page) var(--motion-ease);

  background-color: var(--color-scrim);
  backdrop-filter: none;
}

.bottom-sheet::backdrop {
  background: transparent;
}

/*
 * Volver slides the sheet in and out with `translate`; the drag moves it with `transform`
 * (--sheet-drag), which adds up. One transition for both, as this rule overrides Volver's.
 */
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
  transform: translateY(var(--sheet-drag, 0px));
  transition:
    translate var(--motion-page) var(--motion-ease),
    transform var(--motion-base) var(--motion-ease);
}

.bottom-sheet--dragging :deep(.vv-dialog__wrapper) {
  transition: none;
}

/* Closing, it leaves faster, accelerating, from wherever the drag left it. */
.bottom-sheet.vv-dialog--slide-block-end-leave-active {
  --vv-dialog-transition-slide-block-end-active-transition: opacity var(--motion-base) var(--motion-ease-exit);
}

.bottom-sheet.vv-dialog--slide-block-end-leave-active :deep(.vv-dialog__wrapper) {
  transition: translate var(--motion-base) var(--motion-ease-exit);
}

@media (prefers-reduced-motion: reduce) {
  .bottom-sheet,
  .bottom-sheet.vv-dialog--slide-block-end-leave-active {
    --vv-dialog-transition-slide-block-end-active-transition: none;
  }

  .bottom-sheet :deep(.vv-dialog__wrapper),
  .bottom-sheet.vv-dialog--slide-block-end-leave-active :deep(.vv-dialog__wrapper) {
    transition: none;
  }
}

.bottom-sheet :deep(.vv-dialog__header) {
  padding: 0;
  background: transparent;
  border: 0;
}

/* The head is where the sheet is dragged from: handle, title and Chiudi. */
.bottom-sheet__head {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem var(--page-gutter) 1rem;
  touch-action: none;
  cursor: grab;
}

.bottom-sheet--dragging .bottom-sheet__head {
  cursor: grabbing;
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
  border-radius: var(--rounded);
  color: var(--color-ink);
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .bottom-sheet__close:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.bottom-sheet__close:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.bottom-sheet__close:focus-visible {
  outline: 2px solid var(--color-pen);
  border-radius: var(--rounded);
}
</style>
