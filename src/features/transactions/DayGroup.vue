<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { addDays, formatDate, today } from '@/domain/dates'
import { formatAmount } from '@/domain/money'
import { useIntlLocale } from '@/i18n/locale'

/** A day of the list: «OGGI · GIOVEDÌ 5 NOVEMBRE», the day's total, and its rows in a card. */
const props = defineProps<{
  date: string
  totalCents: number
}>()

const { t } = useI18n()
const intlLocale = useIntlLocale()

const label = computed(() => {
  const current = today()
  const sameYear = props.date.slice(0, 4) === current.slice(0, 4)
  const day = formatDate(props.date, intlLocale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear
      ? {}
      : { year: 'numeric' }),
  })
  if (props.date === current)
    return `${t('dateSheet.today')} · ${day}`
  if (props.date === addDays(current, -1))
    return `${t('dateSheet.yesterday')} · ${day}`
  return day
})

const total = computed(() => formatAmount(props.totalCents, intlLocale.value, { sign: 'always' }))
const headingId = computed(() => `day-${props.date}`)
</script>

<template>
  <section class="day-group" :aria-labelledby="headingId">
    <div class="day-group__head">
      <h2 :id="headingId" class="day-group__label type-label">
        {{ label }}
      </h2>
      <span class="type-note">{{ total }}</span>
    </div>
    <ul class="day-group__rows">
      <slot />
    </ul>
  </section>
</template>

<style scoped>
.day-group__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.day-group__label {
  margin: 0;
  color: var(--color-ink-2);
}

.day-group__rows {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.day-group__rows :slotted(li + li) {
  border-top: 1px solid var(--color-line);
}
</style>
