<script setup lang="ts">
import type { CalculatorKey } from '@/domain/calculator'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { decimalSeparator, operatorSymbol } from '@/domain/calculator'
import { useIntlLocale } from '@/i18n/locale'

/**
 * Calculator keypad of the quick add (docs/design/README.md, "Aggiunta rapida"): a sheet
 * of thin lines, digits on the card color and operators on paper. It only emits the
 * pressed key; src/domain/calculator.ts does the math.
 */
const emit = defineEmits<{
  press: [key: CalculatorKey]
}>()

const { t } = useI18n()
const intlLocale = useIntlLocale()

interface KeyDef {
  key: CalculatorKey
  /** Text on the key; the backspace key shows an icon instead. */
  text?: string
  /** Accessible name when the text alone is not clear ("÷" → "Diviso"). */
  label?: string
  operator?: boolean
}

const keys = computed<KeyDef[]>(() => {
  const digit = (key: CalculatorKey): KeyDef => ({ key, text: key })
  const operator = (key: '+' | '-' | '*' | '/', label: string): KeyDef => ({
    key,
    text: operatorSymbol(key),
    label,
    operator: true,
  })
  return [
    digit('7'),
    digit('8'),
    digit('9'),
    operator('/', t('keypad.divide')),
    digit('4'),
    digit('5'),
    digit('6'),
    operator('*', t('keypad.multiply')),
    digit('1'),
    digit('2'),
    digit('3'),
    operator('-', t('keypad.subtract')),
    {
      key: 'decimal',
      text: decimalSeparator(intlLocale.value),
      label: t('keypad.decimal'),
    },
    digit('0'),
    {
      key: 'backspace',
      label: t('keypad.backspace'),
    },
    operator('+', t('keypad.add')),
  ]
})

function press(key: CalculatorKey) {
  // A short vibration where the device supports it (Android); iOS ignores it.
  if ('vibrate' in navigator)
    navigator.vibrate(10)
  emit('press', key)
}
</script>

<template>
  <div class="keypad" role="group" :aria-label="t('keypad.label')">
    <button
      v-for="item in keys"
      :key="item.key"
      type="button"
      class="keypad__key"
      :class="{ 'keypad__key--operator': item.operator }"
      :aria-label="item.label"
      @click="press(item.key)"
    >
      <AppIcon v-if="item.key === 'backspace'" name="backspace" class="keypad__icon" />
      <template v-else>
        {{ item.text }}
      </template>
    </button>
  </div>
</template>

<style scoped>
.keypad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--color-line);
  border-block: 1px solid var(--color-line);
}

.keypad__key {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--keypad-key-height, 3.625rem);
  padding: 0;
  border: 0;
  background: var(--color-card);
  color: var(--color-ink);
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 400;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

.keypad__key--operator {
  background: var(--color-paper);
  color: var(--color-ink-2);
}

@media (hover: hover) {
  .keypad__key:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.keypad__key:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.keypad__key:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

.keypad__icon {
  --app-icon-size: 1.75rem;
}
</style>
