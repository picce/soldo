<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import AmountText from '@/components/AmountText.vue'

export interface CategoryRow {
  key: string
  name: string
  /** CSS color of the square, e.g. `var(--color-category-3)`. */
  color: string
  cents: number
  percent: number
  /** Movimenti filtered by this category and period. */
  to: RouteLocationRaw
}

/** Rows under the category bar: square, name, dots, amount and percentage. Each opens Movimenti. */
defineProps<{
  rows: CategoryRow[]
}>()
</script>

<template>
  <ul class="category-rows">
    <li v-for="row in rows" :key="row.key">
      <RouterLink :to="row.to" class="category-rows__link">
        <span class="category-rows__square" :style="{ background: row.color }" aria-hidden="true" />
        <span class="category-rows__name type-body">{{ row.name }}</span>
        <span class="dot-leader" aria-hidden="true" />
        <AmountText :cents="row.cents" class="category-rows__amount" />
        <span class="category-rows__percent type-note">{{ row.percent }}%</span>
      </RouterLink>
    </li>
  </ul>
</template>

<style scoped>
.category-rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.category-rows__link {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 2.25rem;
  color: var(--color-ink);
  text-decoration: none;
}

.category-rows__link:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
  border-radius: 2px;
}

.category-rows__square {
  flex-shrink: 0;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 2px;
}

.category-rows__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-rows__percent {
  flex-shrink: 0;
  width: 2.5rem;
  text-align: end;
}
</style>
