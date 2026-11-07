<script setup lang="ts">
import type { Category } from '@/db/schema'
import AppIcon from '@/components/AppIcon.vue'
import { categoryName } from '@/db/names'

/**
 * Grid of categories, four per row, each with its icon in the category color and its
 * name (docs/design/README.md, "Aggiunta rapida"). In a new transaction a tap saves;
 * with `selectable` the grid is a choice and `selectedId` gets the pen border.
 */
withDefaults(defineProps<{
  categories: Category[]
  selectable?: boolean
  selectedId?: string | null
}>(), {
  selectable: false,
  selectedId: null,
})

const emit = defineEmits<{
  select: [category: Category]
}>()
</script>

<template>
  <ul class="category-grid">
    <li v-for="category in categories" :key="category.id">
      <button
        type="button"
        class="category-grid__item"
        :aria-pressed="selectable ? category.id === selectedId : undefined"
        :style="{ '--category-color': `var(--color-category-${category.color})` }"
        @click="emit('select', category)"
      >
        <AppIcon :name="category.icon" class="category-grid__icon" />
        <span class="category-grid__name">{{ categoryName(category) }}</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.category-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5625rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.category-grid__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--category-tile-gap, 0.375rem);
  width: 100%;
  /* Smaller on short screens: the quick add sets these (TransactionEditorView.vue). */
  min-height: var(--category-tile-height, 4.25rem);
  padding: var(--category-tile-padding-top, 0.625rem) 0.25rem var(--category-tile-padding-bottom, 0.5rem);
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  line-height: 1.2;
  cursor: pointer;
  transition:
    background-color var(--motion-press) var(--motion-ease),
    scale var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .category-grid__item:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once and a little smaller, released in a moment (docs/design/README.md, "Movimento"). */
.category-grid__item:active {
  background: var(--color-pressed);
  scale: 0.96;
  transition-duration: 0s;
}

@media (prefers-reduced-motion: reduce) {
  .category-grid__item:active {
    scale: none;
  }
}

.category-grid__item[aria-pressed='true'] {
  /* 2px pen border; the padding shrinks by 1px so the content does not move. */
  padding:
    calc(var(--category-tile-padding-top, 0.625rem) - 1px)
    calc(0.25rem - 1px)
    calc(var(--category-tile-padding-bottom, 0.5rem) - 1px);
  border: 2px solid var(--color-pen);
}

.category-grid__item:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

.category-grid__icon {
  --app-icon-size: 1.625rem;

  color: var(--category-color);
}

.category-grid__name {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  text-align: center;
  overflow-wrap: break-word;
  hyphens: auto;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}
</style>
