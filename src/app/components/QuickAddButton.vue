<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'

/**
 * «− Uscita» on the tabs that are not the Home (docs/specs/released/aggiunta-meno-tocchi.md): the new
 * expense is one tap away from Movimenti, Budget and Statistiche too. The sign is the minus
 * of the Home's button: in Soldo the plus is an income. Above the navigation, and above the
 * action bar where a page has one (app.css moves the notices above it).
 */
const { t } = useI18n()
</script>

<template>
  <RouterLink
    :to="{ name: 'transaction-new', params: { kind: 'uscita' } }"
    class="quick-add"
    :aria-label="t('editor.newExpense')"
  >
    <AppIcon name="minus" weight="regular" class="quick-add__icon" />
    <span>{{ t('home.addExpense') }}</span>
  </RouterLink>
</template>

<style scoped>
.quick-add {
  position: fixed;
  /* On a wide screen it stays at the edge of the column of the page. */
  inset-inline-end: max(var(--page-gutter), calc((100vw - 40rem) / 2 + var(--page-gutter)));
  bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + var(--quick-add-lift, 0rem) + 0.75rem);
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  height: var(--quick-add-height);
  padding-inline: 1rem 1.25rem;
  background: var(--color-pen);
  border-radius: calc(var(--quick-add-height) / 2);
  /* A ring of paper keeps it apart from the rows it floats over. */
  box-shadow: 0 0 0 3px var(--color-paper);
  color: var(--color-on-pen);
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-ease);
}

.quick-add__icon {
  --app-icon-size: 1.25rem;
}

@media (hover: hover) {
  .quick-add:hover {
    background: var(--color-pen-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.quick-add:active {
  background: var(--color-pen-pressed);
  transition-duration: 0s;
}

.quick-add:focus-visible {
  outline: 2px solid var(--color-ink);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .quick-add {
    transition: none;
  }
}
</style>
