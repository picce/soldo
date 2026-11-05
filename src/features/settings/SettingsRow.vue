<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'

/**
 * Row of a settings card (mockup "Impostazioni"): icon, title, a line of detail and the
 * arrow of a link to another page.
 */
defineProps<{
  icon: string
  title: string
  detail?: string
  to: RouteLocationRaw
}>()
</script>

<template>
  <RouterLink :to="to" class="settings-row">
    <AppIcon :name="icon" class="settings-row__icon" />
    <span class="settings-row__text">
      <span class="type-body">{{ title }}</span>
      <span v-if="detail" class="settings-row__detail type-small">{{ detail }}</span>
    </span>
    <AppIcon name="caret-right" class="settings-row__caret" />
  </RouterLink>
</template>

<style scoped>
.settings-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 2.75rem;
  padding: 0.75rem 1rem;
  color: var(--color-ink);
  text-decoration: none;
}

.settings-row:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
  border-radius: var(--rounded);
}

.settings-row__icon {
  --app-icon-size: 1.5rem;
}

.settings-row__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.settings-row__detail {
  color: var(--color-ink-2);
}

.settings-row__caret {
  --app-icon-size: 1.125rem;

  color: var(--color-ink-2);
}
</style>
