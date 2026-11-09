<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * How many digits of the PIN are typed (docs/specs/blocco-pin.md): empty and full dots.
 * `shake` makes them tremble once, after a wrong PIN; still with «Riduci movimento».
 */
defineProps<{
  filled: number
  total: number
  shake?: boolean
}>()

const emit = defineEmits<{
  shaken: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="pin-dots"
    :class="{ 'pin-dots--shake': shake }"
    role="img"
    :aria-label="t('pinPad.typed', { n: filled, total }, filled)"
    @animationend="emit('shaken')"
  >
    <span
      v-for="index in total"
      :key="index"
      class="pin-dots__dot"
      :class="{ 'pin-dots__dot--filled': index <= filled }"
    />
  </div>
</template>

<style scoped>
.pin-dots {
  display: flex;
  justify-content: center;
  gap: 1rem;
  padding: 0.5rem;
}

.pin-dots__dot {
  width: 0.875rem;
  height: 0.875rem;
  border: 1.5px solid var(--color-ink);
  border-radius: 50%;
  transition: background-color var(--motion-press) var(--motion-ease);
}

.pin-dots__dot--filled {
  background: var(--color-ink);
}

.pin-dots--shake {
  animation: pin-dots-shake 360ms var(--motion-ease);
}

@keyframes pin-dots-shake {
  20%,
  60% {
    transform: translateX(-0.5rem);
  }

  40%,
  80% {
    transform: translateX(0.5rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pin-dots--shake {
    animation: none;
  }
}
</style>
