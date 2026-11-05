<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'

/**
 * Square button with only an icon: Chiudi and Elimina in the editor, Indietro in the
 * settings pages. 34 px on the card color, with a 44 px touch area
 * (docs/design/README.md, "Forme e spaziature"). `label` is its accessible name.
 */
withDefaults(defineProps<{
  icon: string
  label: string
  tone?: 'ink' | 'danger'
}>(), {
  tone: 'ink',
})
</script>

<template>
  <button type="button" class="icon-button" :class="`icon-button--${tone}`" :aria-label="label">
    <AppIcon :name="icon" />
  </button>
</template>

<style scoped>
.icon-button {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.125rem;
  height: 2.125rem;
  margin: 0.3125rem;
  padding: 0;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: 0.375rem;
  color: var(--color-ink);
  cursor: pointer;
}

.icon-button::after {
  content: '';
  position: absolute;
  inset: -0.3125rem;
}

.icon-button:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

.icon-button:disabled {
  cursor: default;
  opacity: 0.5;
}

.icon-button--danger {
  color: var(--color-danger);
}

.icon-button .app-icon {
  --app-icon-size: 1.25rem;
}
</style>
