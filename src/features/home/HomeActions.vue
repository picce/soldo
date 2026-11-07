<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ActionBar from '@/components/ActionBar.vue'
import AppIcon from '@/components/AppIcon.vue'

/** «− Uscita» and «+ Entrata», fixed above the navigation (mockup "Home"). */
const { t } = useI18n()
</script>

<template>
  <ActionBar :label="t('home.actions')">
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
  </ActionBar>
</template>
