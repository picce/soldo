<script setup lang="ts">
import { useId } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

/**
 * Choice of an icon, six per row (mockup "Modifica categoria"); the chosen one has the
 * `biro` border. Native radio buttons underneath, so arrows move the choice and screen
 * readers read the icon names. Name the group with `aria-labelledby` or `aria-label`.
 */
defineProps<{
  options: { value: string, label: string }[]
}>()

const model = defineModel<string>({ required: true })

const name = useId()
</script>

<template>
  <div role="radiogroup" class="icon-picker">
    <label v-for="option in options" :key="option.value" class="icon-picker__option">
      <input
        v-model="model"
        type="radio"
        class="icon-picker__input"
        :name="name"
        :value="option.value"
        :aria-label="option.label"
      >
      <span class="icon-picker__face">
        <AppIcon :name="option.value" />
      </span>
    </label>
  </div>
</template>

<style scoped>
.icon-picker {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.375rem;
}

.icon-picker__option {
  position: relative;
  cursor: pointer;
}

/* The real radio stays in the page for keyboard and screen readers; the face draws it. */
.icon-picker__input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.icon-picker__face {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.875rem;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
  color: var(--color-ink);
}

.icon-picker__face .app-icon {
  --app-icon-size: 1.5rem;
}

.icon-picker__input:checked + .icon-picker__face {
  border: 2px solid var(--color-pen);
  color: var(--color-pen);
}

.icon-picker__input:focus-visible + .icon-picker__face {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}
</style>
