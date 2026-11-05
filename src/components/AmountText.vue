<script setup lang="ts">
import type { FormatAmountOptions } from '@/domain/money'
import { computed } from 'vue'
import { formatAmount } from '@/domain/money'
import { useIntlLocale } from '@/i18n/locale'

/**
 * An amount in IBM Plex Mono with tabular figures, formatted for the app language
 * (`−12,40`, `+2.450,00 €`). `cents` carries the sign: negative for expenses.
 * With `colored`, positive amounts use the income color, as in the transaction rows.
 */
const props = withDefaults(defineProps<{
  cents: number
  sign?: FormatAmountOptions['sign']
  currency?: boolean
  colored?: boolean
}>(), {
  sign: 'auto',
  currency: false,
  colored: false,
})

const intlLocale = useIntlLocale()

const text = computed(() => formatAmount(props.cents, intlLocale.value, {
  sign: props.sign,
  currency: props.currency,
}))
</script>

<template>
  <span class="amount-text type-amount" :class="{ 'amount-text--income': colored && cents > 0 }">{{ text }}</span>
</template>

<style scoped>
.amount-text {
  white-space: nowrap;
}

.amount-text--income {
  color: var(--color-income);
}
</style>
