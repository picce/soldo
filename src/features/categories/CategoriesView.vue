<script setup lang="ts">
import type { CategoryKind } from '@/db/schema'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import SubPage from '@/components/SubPage.vue'
import { categoryName } from '@/db/names'
import { listCategories } from '@/db/repositories/categories'
import { useLiveQuery } from '@/db/useLiveQuery'
import CategoryLink from './CategoryLink.vue'
import { useCategoryOrder } from './useCategoryOrder'

/**
 * Categories of expenses and income (docs/specs/released/gestione-categorie.md): the order here is
 * the order of the quick-add grid. Rows move with the handle, or with «Sposta su» and
 * «Sposta giù», which appear when reached with the keyboard. Archived categories wait in
 * a closed section at the end.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// The kind lives in the URL (?tipo=entrate), so Indietro from a category comes back to it.
const kind = computed<CategoryKind>({
  get: () => route.query.tipo === 'entrate'
    ? 'income'
    : 'expense',
  set: (value) => {
    void router.replace({
      query: {
        ...route.query,
        tipo: value === 'income'
          ? 'entrate'
          : undefined,
      },
    })
  },
})

const kindOptions = computed<{ value: CategoryKind, label: string }[]>(() => [
  {
    value: 'expense',
    label: t('categories.expenses'),
  },
  {
    value: 'income',
    label: t('categories.income'),
  },
])

const { data: rows } = useLiveQuery(() => listCategories({ kind: kind.value, includeArchived: true }), [kind])
const active = computed(() => rows.value?.filter(category => !category.archived))
const archived = computed(() => (rows.value ?? []).filter(category => category.archived))

const { items, draggedId, offsets, settling, step, startDrag, drag, endDrag } = useCategoryOrder(active)

/** Read by screen readers after a move with the buttons. */
const announcement = ref('')

async function move(index: number, direction: -1 | 1) {
  const category = items.value[index]
  if (!category || !step(index, direction))
    return
  const position = index + direction
  announcement.value = t('categories.moved', {
    name: categoryName(category),
    position: position + 1,
    count: items.value.length,
  })
  // The row moved in the page: the button pressed keeps the focus.
  const buttonId = `${direction < 0
    ? 'up'
    : 'down'}-${category.id}`
  await nextTick()
  document.getElementById(buttonId)?.focus()
}

function rowStyle(id: string) {
  const offset = offsets.value[id]
  return offset
    ? { translate: `0 ${offset}px` }
    : undefined
}

const newCategory = computed(() => ({
  name: 'category-edit',
  params: { id: 'nuova' },
  query: kind.value === 'income'
    ? { tipo: 'entrate' }
    : {},
}))
</script>

<template>
  <SubPage :title="t('categories.title')" :back="{ name: 'settings' }">
    <SegmentedControl v-model="kind" :options="kindOptions" :aria-label="t('categories.kind')" class="categories__kind" />

    <p class="sr-only" aria-live="polite">
      {{ announcement }}
    </p>

    <ul
      v-if="items.length"
      class="categories__list"
      :class="{
        'categories__list--dragging': draggedId,
        'categories__list--settling': settling,
      }"
      :aria-label="kind === 'income' ? t('categories.listIncome') : t('categories.listExpense')"
    >
      <li
        v-for="(category, index) in items"
        :key="category.id"
        class="category-row"
        :class="{ 'category-row--dragged': draggedId === category.id }"
        :style="rowStyle(category.id)"
      >
        <div class="category-row__move">
          <span
            class="category-row__handle"
            aria-hidden="true"
            @pointerdown="startDrag($event, index)"
            @pointermove="drag"
            @pointerup="endDrag"
            @pointercancel="endDrag($event, false)"
          >
            <AppIcon name="dots-six-vertical" />
          </span>
          <button
            :id="`up-${category.id}`"
            type="button"
            class="category-row__step category-row__step--up"
            :aria-label="t('categories.moveUp', { name: categoryName(category) })"
            :aria-disabled="index === 0"
            @click="move(index, -1)"
          >
            <AppIcon name="caret-up" />
          </button>
          <button
            :id="`down-${category.id}`"
            type="button"
            class="category-row__step category-row__step--down"
            :aria-label="t('categories.moveDown', { name: categoryName(category) })"
            :aria-disabled="index === items.length - 1"
            @click="move(index, 1)"
          >
            <AppIcon name="caret-down" />
          </button>
        </div>
        <CategoryLink :category="category" />
      </li>
    </ul>
    <p v-else-if="active" class="categories__empty type-small">
      {{ t('categories.empty') }}
    </p>

    <details v-if="archived.length" class="categories__archived">
      <summary class="categories__archived-summary">
        <span class="type-label">{{ t('categories.archived', { count: archived.length }) }}</span>
        <AppIcon name="caret-down" class="categories__archived-caret" />
      </summary>
      <ul class="categories__list categories__list--archived">
        <li v-for="category in archived" :key="category.id" class="category-row">
          <CategoryLink :category="category" />
        </li>
      </ul>
    </details>

    <template #footer>
      <VvButton :to="newCategory" :label="t('categories.new')" modifiers="secondary" class="categories__new">
        <template #before>
          <AppIcon name="plus" weight="regular" class="categories__new-icon" />
        </template>
      </VvButton>
    </template>
  </SubPage>
</template>

<style scoped>
.categories__kind {
  align-self: flex-start;
}

.categories__list {
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.categories__list--dragging {
  user-select: none;
}

.category-row {
  position: relative;
  display: flex;
  align-items: stretch;
  border-radius: var(--rounded);
  transition: translate 0.15s ease;
}

.category-row + .category-row {
  border-top: 1px solid var(--color-line);
  border-radius: 0;
}

/* The dragged row follows the finger without delay, above the others. */
.category-row--dragged {
  z-index: 1;
  background: var(--color-card);
  outline: 1px solid var(--color-pen);
  transition: none;
}

.categories__list--settling .category-row {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .category-row {
    transition: none;
  }
}

.categories__list--archived .category-link {
  padding-inline-start: 1rem;
}

/* The pressed background of a link follows the rounded corners of the card. */
.category-row:first-child > .category-link {
  border-start-end-radius: calc(var(--rounded) - 1px);
}

.category-row:last-child > .category-link {
  border-end-end-radius: calc(var(--rounded) - 1px);
}

.categories__list--archived .category-row:first-child > .category-link {
  border-start-start-radius: calc(var(--rounded) - 1px);
}

.categories__list--archived .category-row:last-child > .category-link {
  border-end-start-radius: calc(var(--rounded) - 1px);
}

/* Handle for the finger; the two buttons show up in its place when they have the focus. */
.category-row__move {
  position: relative;
  flex-shrink: 0;
  width: 2.5rem;
}

.category-row__handle {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-ink-2);
  cursor: grab;
  touch-action: none;
}

.categories__list--dragging .category-row__handle {
  cursor: grabbing;
}

.category-row__handle .app-icon {
  --app-icon-size: 1.125rem;
}

.category-row__step {
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

.category-row__step--up {
  top: 0;
}

.category-row__step--down {
  bottom: 0;
}

.category-row__move:focus-within .category-row__step {
  opacity: 1;
  pointer-events: auto;
}

.category-row__step[aria-disabled='true'] {
  color: var(--color-line);
  cursor: default;
}

.category-row__step:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
  border-radius: 4px;
}

.category-row__step .app-icon {
  --app-icon-size: 1rem;
}

.categories__empty {
  margin: 0;
  color: var(--color-ink-2);
}

.categories__archived-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 2.75rem;
  border-bottom: 1px solid var(--color-line);
  color: var(--color-ink-2);
  cursor: pointer;
  list-style: none;
  transition: color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .categories__archived-summary:hover {
    color: var(--color-ink);
  }
}

.categories__archived-summary:active {
  color: var(--color-ink);
  transition-duration: 0s;
}

.categories__archived-summary::-webkit-details-marker {
  display: none;
}

.categories__archived-summary:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

.categories__archived-caret {
  --app-icon-size: 1.125rem;

  transition: rotate 0.15s ease;
}

.categories__archived[open] .categories__archived-caret {
  rotate: 180deg;
}

.categories__archived .categories__list {
  margin-top: 0.75rem;
}

.categories__new {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
  text-decoration: none;
}

.categories__new-icon {
  --app-icon-size: 1.25rem;
}
</style>
