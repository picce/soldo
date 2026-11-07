<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { budgetLevel, usedPercent } from '@/domain/budgets'
import { formatAmount } from '@/domain/money'
import { useIntlLocale } from '@/i18n/locale'

/**
 * How much of a budget is spent (docs/specs/budget-mensili.md, «Barra»): the fill is `biro` below
 * 80%, `avviso` from 80% and `pericolo` over the budget, on a track that is a lighter step of the
 * same color. The text next to it says the same, so color is never the only cue.
 */
const props = defineProps<{
  spentCents: number
  budgetCents: number
  /** What the meter measures, e.g. «Budget di Spesa». */
  label: string
}>()

const { t } = useI18n()
const intlLocale = useIntlLocale()

const level = computed(() => budgetLevel(props.spentCents, props.budgetCents))
const percent = computed(() => usedPercent(props.spentCents, props.budgetCents))
const width = computed(() => `${Math.min(props.spentCents / props.budgetCents, 1) * 100}%`)
const valueText = computed(() => level.value === 'over'
  ? t('budgetMeter.over', {
      percent: percent.value,
      amount: formatAmount(props.spentCents - props.budgetCents, intlLocale.value, { currency: true }),
    })
  : t('budgetMeter.used', { percent: percent.value }))
</script>

<template>
  <div
    class="budget-meter"
    :class="`budget-meter--${level}`"
    role="meter"
    aria-valuemin="0"
    :aria-valuemax="Math.max(100, percent)"
    :aria-valuenow="percent"
    :aria-valuetext="valueText"
    :aria-label="label"
  >
    <span class="budget-meter__fill" :style="{ width }" />
  </div>
</template>

<style scoped>
.budget-meter {
  --budget-meter-color: var(--color-pen);

  height: 0.5rem;
  overflow: hidden;
  background: color-mix(in oklab, var(--budget-meter-color) 18%, var(--color-card));
  border-radius: 4px;
}

.budget-meter--near {
  --budget-meter-color: var(--color-warning);
}

.budget-meter--over {
  --budget-meter-color: var(--color-danger);
}

.budget-meter__fill {
  display: block;
  height: 100%;
  background: var(--budget-meter-color);
  border-radius: 4px;
  transition: width var(--motion-base) var(--motion-ease);
}

@media (prefers-reduced-motion: reduce) {
  .budget-meter__fill {
    transition: none;
  }
}
</style>
