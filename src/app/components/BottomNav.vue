<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'

interface NavEntry {
  /** Name of the route the entry opens. */
  name: string
  label: string
  icon: string
}

const { t } = useI18n()
const route = useRoute()

const items = computed<NavEntry[]>(() => [
  {
    name: 'home',
    label: t('nav.home'),
    icon: 'house',
  },
  {
    name: 'transactions',
    label: t('nav.transactions'),
    icon: 'receipt',
  },
  {
    name: 'budget',
    label: t('nav.budget'),
    icon: 'piggy-bank',
  },
  {
    name: 'stats',
    label: t('nav.stats'),
    icon: 'chart-pie-slice',
  },
  {
    name: 'settings',
    label: t('nav.settings'),
    icon: 'gear-six',
  },
])

/** Position of the current section, where the pen mark sits; -1 on other pages. */
const activeIndex = computed(() => items.value.findIndex(item => item.name === route.name))
</script>

<template>
  <nav class="bottom-nav" :aria-label="t('nav.label')">
    <RouterLink
      v-for="item in items"
      :key="item.name"
      v-slot="{ href, navigate, isExactActive }"
      :to="{ name: item.name }"
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
    <span
      v-if="activeIndex >= 0"
      class="bottom-nav__indicator"
      :style="{ '--nav-index': activeIndex }"
      aria-hidden="true"
    />
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
  transition: color var(--motion-press) var(--motion-ease);
}

.bottom-nav__item .app-icon {
  transition: scale var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .bottom-nav__item:hover {
    color: var(--color-ink);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.bottom-nav__item:active {
  color: var(--color-ink);
  transition-duration: 0s;
}

.bottom-nav__item:active .app-icon {
  scale: 0.88;
  transition-duration: 0s;
}

.bottom-nav__item[aria-current='page'] {
  color: var(--color-ink);
  font-weight: 600;
}

/*
 * Active item: a 28x2px pen mark on the top edge of the bar. One mark for the whole bar,
 * one column wide, that slides to the current section.
 */
.bottom-nav__indicator {
  position: absolute;
  top: -1px;
  inset-inline-start: 0.5rem;
  width: calc((100% - 1rem) / 5);
  height: 2px;
  translate: calc(var(--nav-index) * 100%) 0;
  transition: translate var(--motion-page) var(--motion-ease);
  pointer-events: none;
}

.bottom-nav__indicator::before {
  content: '';
  display: block;
  width: 1.75rem;
  height: 100%;
  margin-inline: auto;
  background: var(--color-pen);
}

@media (prefers-reduced-motion: reduce) {
  .bottom-nav__item .app-icon,
  .bottom-nav__indicator {
    transition: none;
  }

  .bottom-nav__item:active .app-icon {
    scale: none;
  }
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
