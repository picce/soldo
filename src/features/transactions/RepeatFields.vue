<script setup lang="ts">
import type { RepeatChoice } from './useTransactionEditor'
import type { RecurrenceFrequency } from '@/db/schema'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { RECURRENCE_FREQUENCIES } from '@/db/schema'
import { isIsoDate } from '@/domain/dates'
import { MAX_INTERVAL } from '@/domain/recurrences'
import { describeEvery } from '@/features/recurrences/describe'

/**
 * «Ripeti» in the date sheet (docs/specs/ricorrenze.md, mockup "Foglio Ripeti"): how often, every
 * how many, and until when. Without `optional` there is no «Non si ripete»: a series always
 * repeats. The start is the date chosen above it.
 */
const props = defineProps<{
  optional?: boolean
  /** The start: the end cannot come before it. */
  startDate: string
}>()

const repeat = defineModel<RepeatChoice | null>({ required: true })

const { t } = useI18n()
const id = useId()

function choose(freq: RecurrenceFrequency | null) {
  repeat.value = freq
    ? { freq, interval: repeat.value?.interval ?? 1, endDate: repeat.value?.endDate }
    : null
}

// «Ogni N» while typing: an empty field is fine until it loses focus, then it goes back to a number.
const intervalText = ref(String(repeat.value?.interval ?? 1))
watch(() => repeat.value?.interval, (interval) => {
  if (interval !== undefined && Number(intervalText.value) !== interval)
    intervalText.value = String(interval)
})

function typeInterval(event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '').slice(0, 2)
  input.value = digits
  intervalText.value = digits
  const interval = Number(digits)
  if (repeat.value && interval >= 1 && interval <= MAX_INTERVAL)
    repeat.value = { ...repeat.value, interval }
}

function settleInterval() {
  intervalText.value = String(repeat.value?.interval ?? 1)
}

const endDate = computed({
  get: () => repeat.value?.endDate ?? '',
  set: (value: string) => {
    if (repeat.value) {
      repeat.value = {
        ...repeat.value,
        endDate: isIsoDate(value)
          ? value
          : undefined,
      }
    }
  },
})

/** The whole field opens the browser's calendar, as for «Altra data». */
function openPicker(event: MouseEvent) {
  try {
    (event.currentTarget as HTMLInputElement).showPicker()
  }
  catch {}
}

const options = computed(() => RECURRENCE_FREQUENCIES.map(freq => ({
  freq,
  label: describeEvery({ freq, interval: 1 }),
})))
</script>

<template>
  <div class="repeat-fields">
    <h3 :id="`${id}-title`" class="repeat-fields__label type-label">
      {{ t('repeat.title') }}
    </h3>
    <ul class="repeat-fields__list" :aria-labelledby="`${id}-title`">
      <li v-if="optional">
        <button type="button" class="repeat-fields__option" :aria-pressed="!repeat" @click="choose(null)">
          <span class="type-body">{{ t('repeat.none') }}</span>
          <AppIcon v-if="!repeat" name="check" class="repeat-fields__check" />
        </button>
      </li>
      <li v-for="option in options" :key="option.freq">
        <button
          type="button"
          class="repeat-fields__option"
          :aria-pressed="repeat?.freq === option.freq"
          @click="choose(option.freq)"
        >
          <span class="type-body">{{ option.label }}</span>
          <AppIcon v-if="repeat?.freq === option.freq" name="check" class="repeat-fields__check" />
        </button>
      </li>
    </ul>

    <div v-if="repeat" class="repeat-fields__row">
      <div class="repeat-fields__field">
        <label :for="`${id}-interval`" class="repeat-fields__label type-label">{{ t('repeat.interval') }}</label>
        <div class="repeat-fields__box">
          <input
            :id="`${id}-interval`"
            :value="intervalText"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            class="repeat-fields__input type-body"
            :aria-describedby="`${id}-unit`"
            @input="typeInterval"
            @blur="settleInterval"
          >
          <span :id="`${id}-unit`" class="repeat-fields__unit type-note">{{ t(`repeat.unit.${repeat.freq}`, repeat.interval) }}</span>
        </div>
      </div>
      <div class="repeat-fields__field">
        <label :for="`${id}-until`" class="repeat-fields__label type-label">{{ t('repeat.until') }}</label>
        <div class="repeat-fields__box">
          <input
            :id="`${id}-until`"
            v-model="endDate"
            type="date"
            :min="props.startDate"
            class="repeat-fields__input repeat-fields__date type-body"
            :class="{ 'repeat-fields__date--empty': !endDate }"
            :aria-describedby="endDate ? undefined : `${id}-no-end`"
            @click="openPicker"
          >
          <span v-if="!endDate" :id="`${id}-no-end`" class="repeat-fields__placeholder type-body">{{ t('repeat.noEnd') }}</span>
          <button
            v-if="endDate"
            type="button"
            class="repeat-fields__clear"
            :aria-label="t('repeat.clearEnd')"
            @click="endDate = ''"
          >
            <AppIcon name="x" />
          </button>
          <AppIcon v-else name="calendar-blank" class="repeat-fields__icon" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.repeat-fields__label {
  display: block;
  margin: 1.5rem 0 0.5rem;
  color: var(--color-ink-2);
}

.repeat-fields__list {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.repeat-fields__list li + li {
  border-top: 1px solid var(--color-line);
}

.repeat-fields__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.5rem 1rem;
  border: 0;
  background: none;
  color: var(--color-ink);
  text-align: start;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .repeat-fields__option:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.repeat-fields__option:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.repeat-fields__option:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
  border-radius: var(--rounded);
}

@media (prefers-reduced-motion: reduce) {
  .repeat-fields__option {
    transition: none;
  }
}

.repeat-fields__check {
  color: var(--color-pen);
}

.repeat-fields__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.repeat-fields__field {
  min-width: 0;
}

.repeat-fields__box {
  position: relative;
  display: flex;
  align-items: center;
}

.repeat-fields__input {
  width: 100%;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0 2.75rem 0 0.875rem;
  background: var(--color-card);
  border: 1px solid var(--color-ink-2);
  border-radius: var(--rounded);
  color: var(--color-ink);
  color-scheme: var(--color-scheme);
}

.repeat-fields__input:focus {
  outline: none;
  border-color: var(--color-pen);
  box-shadow: 0 0 0 1px var(--color-pen);
}

.repeat-fields__date::-webkit-calendar-picker-indicator {
  display: none;
}

/* Empty, the browser would show «gg/mm/aaaa»: «Nessuna fine» takes its place. */
.repeat-fields__date--empty:not(:focus) {
  color: transparent;
}

.repeat-fields__unit,
.repeat-fields__placeholder,
.repeat-fields__icon {
  position: absolute;
  color: var(--color-ink-2);
  pointer-events: none;
}

.repeat-fields__unit,
.repeat-fields__icon {
  inset-inline-end: 0.875rem;
}

.repeat-fields__placeholder {
  inset-inline-start: 0.875rem;
}

.repeat-fields__date--empty:focus + .repeat-fields__placeholder {
  visibility: hidden;
}

.repeat-fields__icon {
  --app-icon-size: 1.25rem;
}

.repeat-fields__clear {
  --app-icon-size: 1.125rem;

  position: absolute;
  inset-inline-end: 0.25rem;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  background: none;
  border: 0;
  border-radius: var(--rounded);
  color: var(--color-ink-2);
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .repeat-fields__clear:hover {
    background: var(--color-hover);
  }
}

.repeat-fields__clear:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.repeat-fields__clear:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .repeat-fields__clear {
    transition: none;
  }
}
</style>
