<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'

/**
 * Keys of the PIN (docs/specs/blocco-pin.md, "Tastierino"): 1–9, 0 and delete, on the same
 * sheet of thin lines as the calculator keypad. It only emits what was pressed.
 */
const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  digit: [digit: string]
  delete: []
}>()

const { t } = useI18n()

const DIGITS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
]

function vibrate() {
  // A short vibration where the device supports it (Android); iOS ignores it.
  if ('vibrate' in navigator)
    navigator.vibrate(10)
}

function press(digit: string) {
  if (props.disabled)
    return
  vibrate()
  emit('digit', digit)
}

function remove() {
  if (props.disabled)
    return
  vibrate()
  emit('delete')
}
</script>

<template>
  <div class="pin-pad" role="group" :aria-label="t('pinPad.label')">
    <button
      v-for="digit in DIGITS"
      :key="digit"
      type="button"
      class="pin-pad__key"
      :disabled="disabled"
      @click="press(digit)"
    >
      {{ digit }}
    </button>
    <span class="pin-pad__blank" aria-hidden="true" />
    <button type="button" class="pin-pad__key" :disabled="disabled" @click="press('0')">
      0
    </button>
    <button
      type="button"
      class="pin-pad__key pin-pad__key--quiet"
      :disabled="disabled"
      :aria-label="t('pinPad.delete')"
      @click="remove"
    >
      <AppIcon name="backspace" class="pin-pad__icon" />
    </button>
  </div>
</template>

<style scoped>
.pin-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--color-line);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
  overflow: hidden;
}

.pin-pad__key,
.pin-pad__blank {
  height: var(--pin-pad-key-height, 3.75rem);
  background: var(--color-card);
}

.pin-pad__key {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  color: var(--color-ink);
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 400;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

.pin-pad__key--quiet,
.pin-pad__blank {
  background: var(--color-paper);
}

.pin-pad__key--quiet {
  color: var(--color-ink-2);
}

.pin-pad__key:disabled {
  color: var(--color-ink-2);
  cursor: not-allowed;
}

@media (hover: hover) {
  .pin-pad__key:not(:disabled):hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.pin-pad__key:not(:disabled):active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.pin-pad__key:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

.pin-pad__icon {
  --app-icon-size: 1.75rem;
}
</style>
