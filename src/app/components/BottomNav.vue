<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'

interface NavEntry {
  to: RouteLocationRaw
  label: string
  icon: string
}

const { t } = useI18n()

const items = computed<NavEntry[]>(() => [
  {
    to: { name: 'home' },
    label: t('nav.home'),
    icon: 'house',
  },
  {
    to: { name: 'transactions' },
    label: t('nav.transactions'),
    icon: 'receipt',
  },
  {
    to: { name: 'budget' },
    label: t('nav.budget'),
    icon: 'piggy-bank',
  },
  {
    to: { name: 'stats' },
    label: t('nav.stats'),
    icon: 'chart-pie-slice',
  },
  {
    to: { name: 'settings' },
    label: t('nav.settings'),
    icon: 'gear-six',
  },
])
</script>

<template>
  <nav class="bottom-nav" :aria-label="t('nav.label')">
    <RouterLink
      v-for="item in items"
      :key="item.icon"
      v-slot="{ href, navigate, isExactActive }"
      :to="item.to"
      custom
    >
      <a
        :href="href"
        class="bottom-nav__item"
        :aria-current="isExactActive ? 'page' : undefined"
        @click="navigate"
      >
        <AppIcon :name="item.icon" :weight="isExactActive ? 'regular' : 'light'" />
        <span class="bottom-nav__label">{{ item.label }}</span>
      </a>
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
  padding: 0 0.5rem env(safe-area-inset-bottom);
  background: var(--color-card);
  border-top: 1px solid var(--color-line);
}

.bottom-nav__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1875rem;
  min-width: 0;
  height: var(--bottom-nav-height);
  color: var(--color-ink-2);
  font-size: 0.6875rem;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}

.bottom-nav__item[aria-current='page'] {
  color: var(--color-ink);
  font-weight: 600;
}

/* Active item: a 28x2px pen mark on the top edge of the bar. */
.bottom-nav__item[aria-current='page']::before {
  content: '';
  position: absolute;
  top: -1px;
  inset-inline: 0;
  width: 1.75rem;
  height: 2px;
  margin-inline: auto;
  background: var(--color-pen);
}

.bottom-nav__item:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -4px;
  border-radius: var(--rounded);
}

.bottom-nav__label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
