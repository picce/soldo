<script setup lang="ts">
/**
 * Bar of the expenses per category (docs/design/README.md, "Home"): 10 px high, segments
 * in the category colors split by 2 px, widths animated when the totals change. It is an
 * image for assistive technology, named by `label`; the rows under it carry the details.
 * Without segments it is the dashed outline of the empty state.
 */
defineProps<{
  segments: { key: string, color: string, share: number }[]
  label: string
}>()
</script>

<template>
  <div v-if="segments.length" class="category-bar" role="img" :aria-label="label">
    <span
      v-for="segment in segments"
      :key="segment.key"
      class="category-bar__segment"
      :style="{ flexGrow: segment.share, background: segment.color }"
    />
  </div>
  <div v-else class="category-bar category-bar--empty" role="img" :aria-label="label" />
</template>

<style scoped>
.category-bar {
  display: flex;
  gap: 2px;
  height: 0.625rem;
  overflow: hidden;
  border-radius: 3px;
}

.category-bar__segment {
  flex-basis: 0;
  flex-shrink: 1;
  min-width: 3px;
  transition: flex-grow 0.3s ease;
}

.category-bar--empty {
  border: 1px dashed var(--color-line);
}

@media (prefers-reduced-motion: reduce) {
  .category-bar__segment {
    transition: none;
  }
}
</style>
