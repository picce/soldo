<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { needsEdgeSwipe, useEdgeSwipeBack } from '@/app/gestures'
import { goBack } from '@/app/navigation'
import IconButton from '@/components/IconButton.vue'

/**
 * Page opened from another one, without the bottom navigation (route meta `fullscreen`):
 * Indietro and the title on top, the content, and an optional bar of actions that stays
 * at the bottom of the screen (mockups "Categorie" and "Modifica categoria"). On an
 * installed iPhone app a swipe from the left edge goes back too.
 */
const props = defineProps<{
  title: string
  /** Where Indietro goes when the page was opened directly, with no history behind it. */
  back: RouteLocationRaw
}>()

const { t } = useI18n()
const router = useRouter()

const page = useTemplateRef<HTMLElement>('page')
const edgeSwipe = needsEdgeSwipe()
const { offset, dragging } = useEdgeSwipeBack(page, () => goBack(router, props.back), edgeSwipe)
</script>

<template>
  <div
    ref="page"
    class="sub-page"
    :class="{ 'sub-page--edge-swipe': edgeSwipe, 'sub-page--dragging': dragging }"
    :style="offset ? { translate: `${offset}px 0` } : undefined"
  >
    <header class="sub-page__header">
      <IconButton icon="caret-left" :label="t('common.back')" class="sub-page__back" @click="goBack(router, back)" />
      <h1 class="sub-page__title type-title">
        {{ title }}
      </h1>
      <slot name="actions" />
    </header>
    <div class="sub-page__content">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="sub-page__footer">
      <div class="sub-page__footer-inner">
        <slot name="footer" />
      </div>
    </footer>
  </div>
</template>

<style scoped>
.sub-page {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

/* Swipe back from the edge: sideways moves are the page's, the vertical ones scroll. */
.sub-page--edge-swipe {
  touch-action: pan-y;
  transition: translate var(--motion-base) var(--motion-ease);
}

.sub-page--dragging {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .sub-page--edge-swipe {
    transition: none;
  }
}

.sub-page__header,
.sub-page__content {
  width: 100%;
  max-width: 40rem;
  margin-inline: auto;
  padding-inline: var(--page-gutter);
}

.sub-page__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-top: calc(0.75rem + env(safe-area-inset-top));
}

/* The square lines up with the content; the touch area reaches into the margin. */
.sub-page__header .sub-page__back {
  margin-inline-start: 0;
}

.sub-page__title {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-page__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.5rem;
  padding-bottom: 1.5rem;
}

/* Same bar as the actions of the Home: 52 px buttons, 12 px around, a line above. */
.sub-page__footer {
  position: sticky;
  bottom: 0;
  z-index: 10;
  padding: 0.75rem var(--page-gutter) calc(0.75rem + env(safe-area-inset-bottom));
  background: var(--color-paper);
  border-top: 1px solid var(--color-line);
}

.sub-page__footer-inner {
  display: flex;
  gap: 0.75rem;
  max-width: 37.5rem;
  margin-inline: auto;
}
</style>
