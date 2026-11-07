<script setup lang="ts">
/**
 * Buttons fixed above the navigation (mockups "Home", "Budget"). Notices move above it
 * (app.css, `.action-bar`). Give the buttons the class `action-bar__button`.
 */
defineProps<{
  /** Name of the group of buttons, read by screen readers. */
  label: string
}>()
</script>

<template>
  <div class="action-bar">
    <div class="action-bar__buttons" role="group" :aria-label="label">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.action-bar {
  position: fixed;
  inset-inline: 0;
  bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
  z-index: 10;
  height: var(--action-bar-height);
  padding: 0.75rem var(--page-gutter);
  background: var(--color-paper);
  border-top: 1px solid var(--color-line);
}

.action-bar__buttons {
  display: flex;
  gap: 0.75rem;
  max-width: 37.5rem;
  margin-inline: auto;
}

.action-bar__buttons > :slotted(.action-bar__button) {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
  text-decoration: none;
}

.action-bar__buttons :slotted(.action-bar__icon) {
  --app-icon-size: 1.25rem;
}
</style>
