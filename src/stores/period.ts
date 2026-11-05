import type { Period, PeriodUnit } from '@/domain/periods'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { today } from '@/domain/dates'
import { isInPeriod, periodRange, shiftPeriod } from '@/domain/periods'

/**
 * Period shown by the Home (docs/specs/released/home-rendiconto.md). It lives in memory while the
 * app is open, so going back to the Home does not reset it; at start it is this month.
 */
export const usePeriodStore = defineStore('period', () => {
  const period = ref<Period>({
    unit: 'month',
    anchor: today(),
  })
  /** Direction of the last move, for the transition: −1 back in time, 1 forward. */
  const direction = ref<-1 | 0 | 1>(0)

  /** Changes the unit; while the period includes today, the new one does too. */
  function setUnit(unit: PeriodUnit) {
    const current = today()
    const anchor = isInPeriod(current, period.value)
      ? current
      : period.value.anchor
    direction.value = 0
    period.value = { unit, anchor }
  }

  function shift(step: -1 | 1) {
    direction.value = step
    period.value = shiftPeriod(period.value, step)
  }

  /** True while the period shown includes today: the «Oggi» button is not needed. */
  const isCurrent = computed(() => isInPeriod(today(), period.value))

  /** Back to the period of the same unit that includes today, sliding from the right side. */
  function goToToday() {
    const current = today()
    if (isInPeriod(current, period.value))
      return
    direction.value = current > periodRange(period.value).to
      ? 1
      : -1
    period.value = { unit: period.value.unit, anchor: current }
  }

  return {
    period,
    direction,
    isCurrent,
    setUnit,
    shift,
    goToToday,
  }
})
