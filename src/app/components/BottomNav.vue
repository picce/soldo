<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface NavEntry {
  to: RouteLocationRaw
  label: string
  icon: string
}

const { t } = useI18n()

// Icone provvisorie dal set Volver: lo studio grafico (Fase 1) definirà il set definitivo.
const items = computed<NavEntry[]>(() => [
  {
    to: { name: 'home' },
    label: t('nav.home'),
    icon: 'home',
  },
  {
    to: { name: 'transactions' },
    label: t('nav.transactions'),
    icon: 'view-list',
  },
  {
    to: { name: 'budget' },
    label: t('nav.budget'),
    icon: 'dashboard',
  },
  {
    to: { name: 'stats' },
    label: t('nav.stats'),
    icon: 'analysis',
  },
  {
    to: { name: 'settings' },
    label: t('nav.settings'),
    icon: 'settings',
  },
])
</script>

<template>
  <nav class="bottom-nav" :aria-label="t('nav.label')">
    <RouterLink
      v-for="item in items"
      :key="item.label"
      :to="item.to"
      class="bottom-nav__item"
    >
      <VvIcon :name="item.icon" class="bottom-nav__icon" aria-hidden="true" />
      <span class="bottom-nav__label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-surface);
  border-top: 1px solid var(--color-surface-3);
}

.bottom-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-4);
  min-width: 0;
  color: var(--color-word-3);
  font-size: var(--text-12);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}

.bottom-nav__item[aria-current='page'] {
  color: var(--color-brand);
}

.bottom-nav__item:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: -4px;
  border-radius: var(--rounded-md);
}

.bottom-nav__icon {
  width: 1.5rem;
  height: 1.5rem;
}

.bottom-nav__label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
