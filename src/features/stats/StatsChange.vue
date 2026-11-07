<script setup lang="ts">
import type { Change } from '@/domain/stats'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { formatAmount } from '@/domain/money'
import { useIntlLocale } from '@/i18n/locale'

/**
 * How a figure moved from the period before: «↗ 12% · +33,50 € rispetto a 1–7 ottobre». No
 * color: spending more is not always worse, so the arrow and the sign say which way it went.
 * `newWord` replaces the figures when there was nothing before (a category: «nuova»).
 */
const props = defineProps<{
  change: Change
  against?: string
  newWord?: string
}>()

const { t } = useI18n()
const intlLocale = useIntlLocale()

const text = computed(() => {
  const { deltaCents, percent } = props.change
  if (deltaCents === 0)
    return t('stats.same')
  if (percent === null && props.newWord)
    return props.newWord
  const amount = formatAmount(deltaCents, intlLocale.value, { sign: 'always', currency: true })
  return percent === null
    ? amount
    : `${Math.abs(percent)}% · ${amount}`
})

const icon = computed(() => {
  const { deltaCents, percent } = props.change
  if (deltaCents === 0 || (percent === null && props.newWord))
    return undefined
  return deltaCents > 0
    ? 'arrow-up-right'
    : 'arrow-down-right'
})
</script>

<template>
  <span class="stats-change">
    <AppIcon v-if="icon" :name="icon" weight="regular" class="stats-change__icon" />
    <span>{{ text }}</span>
    <span v-if="against" class="stats-change__against">{{ against }}</span>
  </span>
</template>

<style scoped>
.stats-change {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 0.3125rem;
}

.stats-change__icon {
  --app-icon-size: 0.875rem;
}

.stats-change__against {
  color: var(--color-ink-2);
}
</style>
