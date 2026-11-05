<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'

/** «− Uscita» and «+ Entrata», fixed above the navigation (mockup "Home"). */
const { t } = useI18n()
</script>

<template>
  <div class="action-bar">
    <div class="action-bar__buttons" role="group" :aria-label="t('home.actions')">
      <VvButton
        :to="{ name: 'transaction-new', params: { kind: 'uscita' } }"
        :label="t('home.addExpense')"
        modifiers="primary"
        class="action-bar__button"
      >
        <template #before>
          <AppIcon name="minus" weight="regular" class="action-bar__icon" />
        </template>
      </VvButton>
      <VvButton
        :to="{ name: 'transaction-new', params: { kind: 'entrata' } }"
        :label="t('home.addIncome')"
        modifiers="secondary"
        class="action-bar__button"
      >
        <template #before>
          <AppIcon name="plus" weight="regular" class="action-bar__icon" />
        </template>
      </VvButton>
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

.action-bar__button {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
  text-decoration: none;
}

.action-bar__icon {
  --app-icon-size: 1.25rem;
}
</style>
