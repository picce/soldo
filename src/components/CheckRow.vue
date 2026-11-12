<script setup lang="ts">
import { useId } from 'vue'
import AppIcon from './AppIcon.vue'

/**
 * A yes or no on one row (import preview, docs/specs/released/import-da-file.md): the label, an
 * optional hint below, and a box on the right, filled in `biro` when ticked. The input is a
 * native checkbox, out of sight: the box is drawn, so it looks the same everywhere.
 */
defineProps<{
  label: string
  hint?: string
}>()

const model = defineModel<boolean>({ required: true })
const id = useId()
</script>

<template>
  <label class="check-row" :for="id">
    <span class="check-row__text">
      <span class="type-body">{{ label }}</span>
      <span v-if="hint" :id="`${id}-hint`" class="check-row__hint type-small">{{ hint }}</span>
    </span>
    <input
      :id="id"
      v-model="model"
      type="checkbox"
      class="check-row__input sr-only"
      :aria-describedby="hint ? `${id}-hint` : undefined"
    >
    <span class="check-row__box" :class="{ 'check-row__box--on': model }" aria-hidden="true">
      <AppIcon v-if="model" name="check" weight="regular" />
    </span>
  </label>
</template>

<style scoped>
.check-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 3rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--rounded);
  color: var(--color-ink);
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .check-row:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.check-row:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.check-row:has(.check-row__input:focus-visible) {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .check-row {
    transition: none;
  }
}

.check-row__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.check-row__hint {
  color: var(--color-ink-2);
}

.check-row__box {
  --app-icon-size: 1rem;

  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  height: 1.375rem;
  border: 1.5px solid var(--color-ink-2);
  border-radius: 0.3125rem;
  background: var(--color-card);
}

.check-row__box--on {
  border-color: var(--color-pen);
  background: var(--color-pen);
  color: var(--color-on-pen);
}
</style>
