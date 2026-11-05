<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'

/**
 * Small button with an icon and a short text: Data, Conto and Nota in the quick add
 * (36 px high, on the card color). Long texts, such as a note, are cut with an ellipsis.
 */
defineProps<{
  icon: string
  label: string
}>()
</script>

<template>
  <button type="button" class="action-chip">
    <AppIcon :name="icon" class="action-chip__icon" />
    <span class="action-chip__label">{{ label }}</span>
  </button>
</template>

<style scoped>
.action-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  max-width: 100%;
  height: 2.25rem;
  padding: 0 0.75rem;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  touch-action: manipulation;
}

/* 44 px touch target around the 36 px chip. */
.action-chip::after {
  content: '';
  position: absolute;
  inset: -0.25rem 0;
}

.action-chip:active {
  background: var(--color-paper);
}

.action-chip:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

.action-chip__icon {
  --app-icon-size: 1.25rem;
}

.action-chip__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
