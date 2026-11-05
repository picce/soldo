<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'

/**
 * Row of a settings card (mockup "Impostazioni"): icon, title, a line of detail and an
 * arrow. With `to` it is a link to another page of the app, with `href` a link to a page
 * outside it (the privacy), otherwise a button (listen to `click`). `alert` draws the
 * detail in the error color (Drive to reconnect).
 */
const props = defineProps<{
  icon: string
  title: string
  detail?: string
  to?: RouteLocationRaw
  href?: string
  alert?: boolean
}>()

const tag = computed(() => {
  if (props.to)
    return RouterLink
  return props.href
    ? 'a'
    : 'button'
})

// Only the attribute of the element drawn: an empty `href` would hide RouterLink's own.
const link = computed(() => {
  if (props.to)
    return { to: props.to }
  return props.href
    ? { href: props.href }
    : { type: 'button' }
})
</script>

<template>
  <component :is="tag" v-bind="link" class="settings-row">
    <AppIcon :name="icon" class="settings-row__icon" />
    <span class="settings-row__text">
      <span class="type-body">{{ title }}</span>
      <span v-if="detail" class="settings-row__detail type-small" :class="{ 'settings-row__detail--alert': alert }">{{ detail }}</span>
    </span>
    <AppIcon name="caret-right" class="settings-row__caret" />
  </component>
</template>

<style scoped>
.settings-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  box-sizing: border-box;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.75rem 1rem;
  border: 0;
  background: none;
  color: var(--color-ink);
  font: inherit;
  text-align: start;
  text-decoration: none;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

.settings-row:disabled {
  cursor: progress;
}

@media (hover: hover) {
  .settings-row:not(:disabled):hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.settings-row:not(:disabled):active {
  background: var(--color-pressed);
  transition-duration: 0s;
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

.settings-row__detail--alert {
  color: var(--color-danger);
}

.settings-row__caret {
  --app-icon-size: 1.125rem;

  color: var(--color-ink-2);
}
</style>
