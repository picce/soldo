<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AmountText from '@/components/AmountText.vue'

/**
 * Statement of the period (mockup "Home"): income, expenses, a rule in ink, then the
 * balance. Changing period, the figures run to their new values.
 */
defineProps<{
  incomeCents: number
  expenseCents: number
  balanceCents: number
}>()

const { t } = useI18n()
</script>

<template>
  <section class="summary-card" :aria-label="t('home.summary')">
    <dl class="summary-card__lines">
      <div class="summary-card__line">
        <dt class="summary-card__label type-body">
          {{ t('home.income') }}<span class="dot-leader" aria-hidden="true" />
        </dt>
        <dd><AmountText :cents="incomeCents" animated class="summary-card__income" /></dd>
      </div>
      <div class="summary-card__line">
        <dt class="summary-card__label type-body">
          {{ t('home.expenses') }}<span class="dot-leader" aria-hidden="true" />
        </dt>
        <dd><AmountText :cents="-expenseCents" animated /></dd>
      </div>
      <div class="summary-card__line summary-card__line--balance">
        <dt class="type-body-strong">
          {{ t('home.balance') }}
        </dt>
        <dd><AmountText :cents="balanceCents" sign="always" currency large animated /></dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.summary-card {
  padding: 0.75rem 1rem 1rem;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.summary-card__lines {
  margin: 0;
}

.summary-card__line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.75rem;
}

.summary-card__line dt {
  color: var(--color-ink-2);
}

/* The label takes the free space, so the dots reach the amount. */
.summary-card__label {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 0.5rem;
}

.summary-card__line dd {
  margin: 0;
}

/* Income is green even at zero, as in the mockup of the empty Home. */
.summary-card__income {
  color: var(--color-income);
}

.summary-card__line--balance {
  justify-content: space-between;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-ink);
}

.summary-card__line--balance dt {
  color: var(--color-ink);
}
</style>
