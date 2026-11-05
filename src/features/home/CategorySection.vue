<script setup lang="ts">
import type { CategoryRow } from './CategoryRows.vue'
import CategoryBar from '@/components/CategoryBar.vue'
import CategoryRows from './CategoryRows.vue'

/**
 * A section of the Home per kind (mockup "Home", «Uscite per categoria»; the same for the
 * income): title and total, the bar of the categories and their rows. The default slot
 * holds what to show instead of the rows when there are none.
 */
defineProps<{
  /** Id of the title, which names the section. */
  titleId: string
  title: string
  total: string
  segments: { key: string, color: string, share: number }[]
  barLabel: string
  rows: CategoryRow[]
}>()
</script>

<template>
  <section class="category-section" :aria-labelledby="titleId">
    <div class="category-section__head">
      <h2 :id="titleId" class="category-section__title type-label">
        {{ title }}
      </h2>
      <span class="type-note">{{ total }}</span>
    </div>
    <CategoryBar :segments="segments" :label="barLabel" />
    <CategoryRows v-if="rows.length" :rows="rows" class="category-section__rows" />
    <slot v-else />
  </section>
</template>

<style scoped>
.category-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.category-section__title {
  margin: 0;
}

.category-section__rows {
  margin-top: 1rem;
}
</style>
