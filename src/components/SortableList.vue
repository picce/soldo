<script setup lang="ts" generic="T extends { id: string }">
import { nextTick, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { useRowOrder } from './useRowOrder'

/**
 * List in a card whose rows move with the handle, or with «Sposta su» and «Sposta giù», which
 * appear when reached with the keyboard. The `row` slot draws what each row opens. Name the
 * list with `aria-label`.
 */
const props = defineProps<{
  /** Rows from the database; undefined while they load. */
  source: T[] | undefined
  /** Saves the order: ids from first to last. */
  persist: (ids: string[]) => Promise<void>
  /** Name of a row, read by screen readers. */
  nameOf: (item: T) => string
}>()

const { t } = useI18n()

const { items, draggedId, offsets, settling, step, startDrag, drag, endDrag } = useRowOrder<T>(toRef(props, 'source'), ids => props.persist(ids))

/** Read by screen readers after a move with the buttons. */
const announcement = ref('')

async function move(index: number, direction: -1 | 1) {
  const item = items.value[index]
  if (!item || !step(index, direction))
    return
  announcement.value = t('sortable.moved', {
    name: props.nameOf(item),
    position: index + direction + 1,
    count: items.value.length,
  })
  // The row moved in the page: the button pressed keeps the focus.
  const buttonId = `${direction < 0
    ? 'up'
    : 'down'}-${item.id}`
  await nextTick()
  document.getElementById(buttonId)?.focus()
}

function rowStyle(id: string) {
  const offset = offsets.value[id]
  return offset
    ? { translate: `0 ${offset}px` }
    : undefined
}
</script>

<template>
  <p class="sr-only" aria-live="polite">
    {{ announcement }}
  </p>

  <ul
    v-if="items.length"
    v-bind="$attrs"
    class="sortable-list"
    :class="{
      'sortable-list--dragging': draggedId,
      'sortable-list--settling': settling,
    }"
  >
    <li
      v-for="(item, index) in items"
      :key="item.id"
      class="sortable-row"
      :class="{ 'sortable-row--dragged': draggedId === item.id }"
      :style="rowStyle(item.id)"
    >
      <div class="sortable-row__move">
        <span
          class="sortable-row__handle"
          aria-hidden="true"
          @pointerdown="startDrag($event, index)"
          @pointermove="drag"
          @pointerup="endDrag"
          @pointercancel="endDrag($event, false)"
        >
          <AppIcon name="dots-six-vertical" />
        </span>
        <button
          :id="`up-${item.id}`"
          type="button"
          class="sortable-row__step sortable-row__step--up"
          :aria-label="t('sortable.moveUp', { name: nameOf(item) })"
          :aria-disabled="index === 0"
          @click="move(index, -1)"
        >
          <AppIcon name="caret-up" />
        </button>
        <button
          :id="`down-${item.id}`"
          type="button"
          class="sortable-row__step sortable-row__step--down"
          :aria-label="t('sortable.moveDown', { name: nameOf(item) })"
          :aria-disabled="index === items.length - 1"
          @click="move(index, 1)"
        >
          <AppIcon name="caret-down" />
        </button>
      </div>
      <div class="sortable-row__content">
        <slot name="row" :item="item" :index="index" />
      </div>
    </li>
  </ul>
</template>

<style scoped>
.sortable-list {
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.sortable-list--dragging {
  user-select: none;
}

.sortable-row {
  position: relative;
  display: flex;
  align-items: stretch;
  border-radius: var(--rounded);
  transition: translate var(--motion-quick) ease;
}

.sortable-row + .sortable-row {
  border-top: 1px solid var(--color-line);
  border-radius: 0;
}

/* The dragged row follows the finger without delay, above the others. */
.sortable-row--dragged {
  z-index: 1;
  background: var(--color-card);
  outline: 1px solid var(--color-pen);
  transition: none;
}

.sortable-list--settling .sortable-row {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .sortable-row {
    transition: none;
  }
}

.sortable-row__content {
  display: flex;
  flex: 1;
  min-width: 0;
}

/* The pressed background of a row follows the rounded corners of the card. */
.sortable-row:first-child > .sortable-row__content {
  overflow: hidden;
  border-start-end-radius: calc(var(--rounded) - 1px);
}

.sortable-row:last-child > .sortable-row__content {
  overflow: hidden;
  border-end-end-radius: calc(var(--rounded) - 1px);
}

/* Handle for the finger; the two buttons show up in its place when they have the focus. */
.sortable-row__move {
  position: relative;
  flex-shrink: 0;
  width: 2.5rem;
}

.sortable-row__handle {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-ink-2);
  cursor: grab;
  touch-action: none;
}

.sortable-list--dragging .sortable-row__handle {
  cursor: grabbing;
}

.sortable-row__handle .app-icon {
  --app-icon-size: 1.125rem;
}

.sortable-row__step {
  position: absolute;
  inset-inline: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50%;
  padding: 0;
  background: var(--color-card);
  border: 0;
  color: var(--color-ink);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
}

.sortable-row__step--up {
  top: 0;
}

.sortable-row__step--down {
  bottom: 0;
}

.sortable-row__move:focus-within .sortable-row__step {
  opacity: 1;
  pointer-events: auto;
}

.sortable-row__step[aria-disabled='true'] {
  color: var(--color-line);
  cursor: default;
}

.sortable-row__step:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
  border-radius: 4px;
}

.sortable-row__step .app-icon {
  --app-icon-size: 1rem;
}
</style>
