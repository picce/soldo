<script setup lang="ts">
import type { RepeatChoice } from './useTransactionEditor'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import { addDays, formatDate, isIsoDate, today } from '@/domain/dates'
import { useIntlLocale } from '@/i18n/locale'
import RepeatFields from './RepeatFields.vue'

/**
 * Date of a transaction (mockup "Data"): today, yesterday or any other day. With `repeatMode` it
 * also has «Ripeti» (docs/specs/released/ricorrenze.md): `optional` in the quick add, `required` for a
 * series. While a repeat is chosen a tap on a day does not close the sheet: «Fatto» does.
 */
const props = withDefaults(defineProps<{
  repeatMode?: 'none' | 'optional' | 'required'
}>(), {
  repeatMode: 'none',
})

const open = defineModel<boolean>('open', { required: true })
const date = defineModel<string>('date', { required: true })
const repeat = defineModel<RepeatChoice | null>('repeat', { default: null })

const repeating = computed(() => props.repeatMode !== 'none' && !!repeat.value)

const { t } = useI18n()
const intlLocale = useIntlLocale()
const otherDate = ref('')

const shortcuts = computed(() => {
  const current = today()
  return [
    {
      date: current,
      label: t('dateSheet.today'),
    },
    {
      date: addDays(current, -1),
      label: t('dateSheet.yesterday'),
    },
  ].map(item => ({
    ...item,
    detail: formatDate(item.date, intlLocale.value, { weekday: 'long', day: 'numeric', month: 'long' }),
  }))
})

// On opening, the field shows the current date when it is not today or yesterday.
watch(open, (isOpen) => {
  if (isOpen) {
    otherDate.value = shortcuts.value.some(item => item.date === date.value)
      ? ''
      : date.value
  }
})

function choose(value: string) {
  date.value = value
  otherDate.value = ''
  if (!repeating.value)
    open.value = false
}

/** The whole field opens the browser's calendar: its own button is hidden for the icon of the mockup. */
function openPicker(event: MouseEvent) {
  const input = event.currentTarget as HTMLInputElement
  try {
    input.showPicker()
  }
  catch {}
}

function confirm() {
  if (isIsoDate(otherDate.value))
    date.value = otherDate.value
  if (repeating.value || isIsoDate(otherDate.value))
    open.value = false
}
</script>

<template>
  <BottomSheet v-model="open" :title="t('dateSheet.title')">
    <ul class="date-sheet__list">
      <li v-for="item in shortcuts" :key="item.date">
        <button
          type="button"
          class="date-sheet__option"
          :aria-pressed="item.date === date"
          @click="choose(item.date)"
        >
          <span class="date-sheet__text">
            <span class="type-body-strong">{{ item.label }}</span>
            <span class="date-sheet__detail type-body">{{ item.detail }}</span>
          </span>
          <AppIcon v-if="item.date === date" name="check" class="date-sheet__check" />
        </button>
      </li>
    </ul>
    <label class="date-sheet__label type-label" for="date-sheet-other">{{ t('dateSheet.other') }}</label>
    <div class="date-sheet__field">
      <AppIcon name="calendar-blank" class="date-sheet__field-icon" />
      <input
        id="date-sheet-other"
        v-model="otherDate"
        type="date"
        class="date-sheet__input type-body"
        @click="openPicker"
        @keydown.enter.prevent="confirm"
      >
    </div>
    <RepeatFields
      v-if="repeatMode !== 'none'"
      v-model="repeat"
      :optional="repeatMode === 'optional'"
      :start-date="isIsoDate(otherDate) ? otherDate : date"
    />
    <template #footer>
      <VvButton
        :label="repeating ? t('dateSheet.done') : t('dateSheet.confirm')"
        modifiers="primary"
        class="date-sheet__confirm"
        :disabled="!repeating && !isIsoDate(otherDate)"
        @click="confirm"
      />
    </template>
  </BottomSheet>
</template>

<style scoped>
.date-sheet__list {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.date-sheet__list li + li {
  border-top: 1px solid var(--color-line);
}

.date-sheet__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 0;
  background: none;
  color: var(--color-ink);
  text-align: start;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .date-sheet__option:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.date-sheet__option:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.date-sheet__option:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
  border-radius: var(--rounded);
}

.date-sheet__option[aria-pressed='false'] .type-body-strong {
  font-weight: 400;
}

.date-sheet__text {
  display: flex;
  flex-direction: column;
}

.date-sheet__detail {
  color: var(--color-ink-2);
}

.date-sheet__check {
  color: var(--color-pen);
}

.date-sheet__label {
  display: block;
  margin: 1.5rem 0 0.5rem;
  color: var(--color-ink-2);
}

.date-sheet__field {
  position: relative;
  display: flex;
  align-items: center;
}

.date-sheet__field-icon {
  --app-icon-size: 1.25rem;

  position: absolute;
  inset-inline-start: 0.875rem;
  color: var(--color-ink-2);
  pointer-events: none;
}

.date-sheet__input {
  width: 100%;
  min-height: 2.75rem;
  padding: 0 0.875rem 0 2.75rem;
  background: var(--color-card);
  border: 1px solid var(--color-ink-2);
  border-radius: var(--rounded);
  color: var(--color-ink);
  color-scheme: var(--color-scheme);
}

.date-sheet__input::-webkit-calendar-picker-indicator {
  display: none;
}

.date-sheet__input:focus {
  outline: none;
  border-color: var(--color-pen);
  box-shadow: 0 0 0 1px var(--color-pen);
}

.date-sheet__confirm {
  flex: 1;
  min-height: 3.25rem;
}
</style>
