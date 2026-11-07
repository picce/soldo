<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { budgetLevel, usedPercent } from '@/domain/budgets'

/**
 * «⚠ 86%» next to a budget from 80% on, with the icon in the color of its bar. With `always`,
 * below 80% it shows the plain percentage instead of nothing (the card of the monthly budget).
 */
const props = defineProps<{
  spentCents: number
  budgetCents: number
  always?: boolean
}>()

const level = computed(() => budgetLevel(props.spentCents, props.budgetCents))
</script>

<template>
  <span v-if="level !== 'ok'" class="budget-flag" :class="`budget-flag--${level}`">
    <AppIcon :name="level === 'over' ? 'warning-circle' : 'warning'" weight="regular" class="budget-flag__icon" />{{ usedPercent(spentCents, budgetCents) }}%
  </span>
  <span v-else-if="always" class="budget-flag budget-flag--ok">{{ usedPercent(spentCents, budgetCents) }}%</span>
</template>

<style scoped>
.budget-flag {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  color: var(--color-ink);
  font-weight: 600;
  white-space: nowrap;
}

.budget-flag--ok {
  color: var(--color-ink-2);
  font-weight: 400;
}

.budget-flag__icon {
  --app-icon-size: 0.875rem;
}

.budget-flag--near .budget-flag__icon {
  color: var(--color-warning);
}

.budget-flag--over .budget-flag__icon {
  color: var(--color-danger);
}
</style>
