<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'

/**
 * Filter of Movimenti (mockup "Movimenti"): 32 px high with a 44 px touch area; when
 * active it is filled with the pen color. `icon` goes after the text (`caret-down` for a
 * filter that opens a sheet, `x` for one that is removed with a tap).
 */
withDefaults(defineProps<{
  label: string
  pressed?: boolean
  icon?: string
}>(), {
  pressed: false,
  icon: undefined,
})
</script>

<template>
  <button type="button" class="filter-chip" :aria-pressed="pressed">
    <span>{{ label }}</span>
    <AppIcon v-if="icon" :name="icon" class="filter-chip__icon" />
  </button>
</template>

<style scoped>
.filter-chip {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.375rem;
  height: 2rem;
  padding: 0 0.75rem;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: 0.375rem;
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--motion-press) var(--motion-ease),
    border-color var(--motion-press) var(--motion-ease);
}

.filter-chip::after {
  content: '';
  position: absolute;
  inset: -0.375rem 0;
}

.filter-chip[aria-pressed='true'] {
  background: var(--color-pen);
  border-color: var(--color-pen);
  color: var(--color-on-pen);
}

@media (hover: hover) {
  .filter-chip:hover {
    background: var(--color-hover);
  }

  .filter-chip[aria-pressed='true']:hover {
    background: var(--color-pen-hover);
    border-color: var(--color-pen-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.filter-chip:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.filter-chip[aria-pressed='true']:active {
  background: var(--color-pen-pressed);
  border-color: var(--color-pen-pressed);
}

.filter-chip:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

.filter-chip__icon {
  --app-icon-size: 1rem;
}
</style>
