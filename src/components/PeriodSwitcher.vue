<script setup lang="ts">
import type { Period, PeriodUnit } from '@/domain/periods'
import { computed, nextTick, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { periodLabel } from '@/domain/periods'
import { useIntlLocale } from '@/i18n/locale'

/**
 * Tabs Giorno, Settimana, Mese, Anno, the title of the period and the arrows to move
 * back and forth (mockup "Home"). Tabs follow the ARIA pattern: arrow keys, Home and End.
 * `controls` is the id of the element the tabs drive; tab ids are `period-tab-<unit>`.
 */
const props = defineProps<{
  period: Period
  /** Moving between periods: −1 back, 1 forward. Picks the direction of the title animation. */
  direction?: -1 | 0 | 1
  controls?: string
}>()

const emit = defineEmits<{
  'update:unit': [unit: PeriodUnit]
  'shift': [step: -1 | 1]
}>()

const UNITS: PeriodUnit[] = ['day', 'week', 'month', 'year']

const { t } = useI18n()
const intlLocale = useIntlLocale()
const tabs = useTemplateRef<HTMLButtonElement[]>('tabs')

const title = computed(() => periodLabel(props.period, intlLocale.value))
const transition = computed(() => props.direction === -1
  ? 'period-back'
  : props.direction === 1
    ? 'period-forward'
    : 'period-fade')

async function select(unit: PeriodUnit, focus = false) {
  if (unit !== props.period.unit)
    emit('update:unit', unit)
  if (focus) {
    await nextTick()
    tabs.value?.[UNITS.indexOf(unit)]?.focus()
  }
}

function onKeydown(event: KeyboardEvent) {
  const index = UNITS.indexOf(props.period.unit)
  const target = {
    ArrowLeft: index - 1,
    ArrowRight: index + 1,
    Home: 0,
    End: UNITS.length - 1,
  }[event.key]
  if (target === undefined)
    return
  event.preventDefault()
  void select(UNITS[(target + UNITS.length) % UNITS.length]!, true)
}
</script>

<template>
  <div class="period-switcher">
    <div class="period-switcher__tabs" role="tablist" :aria-label="t('period.label')" @keydown="onKeydown">
      <button
        v-for="unit in UNITS"
        :id="`period-tab-${unit}`"
        :key="unit"
        ref="tabs"
        type="button"
        role="tab"
        class="period-switcher__tab"
        :aria-selected="unit === period.unit"
        :aria-controls="controls"
        :tabindex="unit === period.unit ? 0 : -1"
        @click="select(unit)"
      >
        {{ t(`period.${unit}`) }}
      </button>
    </div>
    <div class="period-switcher__head">
      <h2 class="period-switcher__title type-title" aria-live="polite">
        <Transition :name="transition" mode="out-in">
          <span :key="title">{{ title }}</span>
        </Transition>
      </h2>
      <div class="period-switcher__arrows">
        <button type="button" class="period-switcher__arrow" :aria-label="t('period.previous')" @click="emit('shift', -1)">
          <AppIcon name="caret-left" />
        </button>
        <button type="button" class="period-switcher__arrow" :aria-label="t('period.next')" @click="emit('shift', 1)">
          <AppIcon name="caret-right" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.period-switcher__tabs {
  display: flex;
  gap: 1.25rem;
  border-bottom: 1px solid var(--color-line);
}

.period-switcher__tab {
  position: relative;
  min-height: 2.75rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-ink-2);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 400;
  cursor: pointer;
  transition: color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .period-switcher__tab:hover {
    color: var(--color-ink);
  }
}

.period-switcher__tab:active {
  color: var(--color-ink);
  transition-duration: 0s;
}

.period-switcher__tab[aria-selected='true'] {
  color: var(--color-ink);
  font-weight: 600;
}

.period-switcher__tab[aria-selected='true']::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  bottom: -1px;
  height: 2px;
  background: var(--color-pen);
}

.period-switcher__tab:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
  border-radius: 2px;
}

.period-switcher__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
}

.period-switcher__title {
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
}

.period-switcher__title span {
  display: inline-block;
}

.period-switcher__arrows {
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
}

/* 34 px buttons with a 44 px touch area. */
.period-switcher__arrow {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.125rem;
  height: 2.125rem;
  padding: 0;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: 0.375rem;
  color: var(--color-ink);
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

.period-switcher__arrow::after {
  content: '';
  position: absolute;
  inset: -0.3125rem;
}

@media (hover: hover) {
  .period-switcher__arrow:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.period-switcher__arrow:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.period-switcher__arrow:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}

.period-switcher__arrow .app-icon {
  --app-icon-size: 1.25rem;
}

.period-back-enter-active,
.period-forward-enter-active,
.period-fade-enter-active,
.period-back-leave-active,
.period-forward-leave-active,
.period-fade-leave-active {
  transition:
    opacity 0.12s ease,
    translate 0.12s ease;
}

.period-back-enter-from,
.period-forward-leave-to {
  opacity: 0;
  translate: -0.75rem 0;
}

.period-forward-enter-from,
.period-back-leave-to {
  opacity: 0;
  translate: 0.75rem 0;
}

.period-fade-enter-from,
.period-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .period-back-enter-active,
  .period-forward-enter-active,
  .period-fade-enter-active,
  .period-back-leave-active,
  .period-forward-leave-active,
  .period-fade-leave-active {
    transition: none;
  }
}
</style>
