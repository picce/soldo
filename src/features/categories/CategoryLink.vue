<script setup lang="ts">
import type { Category } from '@/db/schema'
import AppIcon from '@/components/AppIcon.vue'
import { categoryName } from '@/db/names'

/**
 * Row of the categories list that opens the category (mockup "Categorie"): color square,
 * icon, name and the arrow of a link to another page.
 */
defineProps<{
  category: Category
}>()
</script>

<template>
  <RouterLink :to="{ name: 'category-edit', params: { id: category.id } }" class="category-link" draggable="false">
    <span class="category-link__square" :style="{ background: `var(--color-category-${category.color})` }" aria-hidden="true" />
    <AppIcon :name="category.icon" class="category-link__icon" />
    <span class="category-link__name type-body">{{ categoryName(category) }}</span>
    <AppIcon name="caret-right" class="category-link__caret" />
  </RouterLink>
</template>

<style scoped>
.category-link {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  min-height: 2.75rem;
  padding-inline-end: 1rem;
  color: var(--color-ink);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .category-link:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.category-link:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.category-link:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
  border-radius: var(--rounded);
}

.category-link__square {
  flex-shrink: 0;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 2px;
}

.category-link__icon {
  --app-icon-size: 1.375rem;
}

.category-link__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-link__caret {
  --app-icon-size: 1.125rem;

  color: var(--color-ink-2);
}
</style>
