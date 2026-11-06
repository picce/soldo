<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'

/** Closed section at the end of a list, with what was archived (mockups "Categorie", "Conti"). */
defineProps<{
  label: string
}>()
</script>

<template>
  <details class="archived-section">
    <summary class="archived-section__summary">
      <span class="type-label">{{ label }}</span>
      <AppIcon name="caret-down" class="archived-section__caret" />
    </summary>
    <slot />
  </details>
</template>

<style scoped>
.archived-section__summary {
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
  .archived-section__summary:hover {
    color: var(--color-ink);
  }
}

.archived-section__summary:active {
  color: var(--color-ink);
  transition-duration: 0s;
}

.archived-section__summary::-webkit-details-marker {
  display: none;
}

.archived-section__summary:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

.archived-section__caret {
  --app-icon-size: 1.125rem;

  transition: rotate var(--motion-quick) var(--motion-ease);
}

.archived-section[open] .archived-section__caret {
  rotate: 180deg;
}

@media (prefers-reduced-motion: reduce) {
  .archived-section__caret {
    transition: none;
  }
}
</style>
