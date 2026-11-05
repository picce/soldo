<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'

/**
 * Search field of Movimenti (mockup "Movimenti"): 44 px, magnifying glass, the pen border
 * while there is text, and an `x` to empty it. The placeholder doubles as its name.
 */
defineProps<{
  placeholder: string
}>()

const model = defineModel<string>({ required: true })

const { t } = useI18n()
const input = useTemplateRef<HTMLInputElement>('input')

function clear() {
  model.value = ''
  input.value?.focus()
}
</script>

<template>
  <div class="search-field" :class="{ 'search-field--filled': model }">
    <AppIcon name="magnifying-glass" class="search-field__icon" />
    <input
      ref="input"
      v-model="model"
      type="search"
      class="search-field__input type-body"
      :placeholder="placeholder"
      :aria-label="placeholder"
      enterkeyhint="search"
      autocomplete="off"
    >
    <button
      v-if="model"
      type="button"
      class="search-field__clear"
      :aria-label="t('transactions.clearSearch')"
      @click="clear"
    >
      <AppIcon name="x" />
    </button>
  </div>
</template>

<style scoped>
.search-field {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 2.75rem;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.search-field--filled,
.search-field:focus-within {
  border-color: var(--color-pen);
}

.search-field__icon {
  --app-icon-size: 1.25rem;

  position: absolute;
  inset-inline-start: 0.875rem;
  color: var(--color-ink-2);
  pointer-events: none;
}

.search-field__input {
  flex: 1;
  min-width: 0;
  height: 2.625rem;
  padding: 0 0.5rem 0 2.75rem;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  outline: none;
}

.search-field__input::placeholder {
  color: var(--color-ink-2);
}

/* The browser's own clear button would duplicate ours. */
.search-field__input::-webkit-search-cancel-button {
  display: none;
}

.search-field__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.625rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-ink-2);
  cursor: pointer;
}

.search-field__clear:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -4px;
  border-radius: var(--rounded);
}

.search-field__clear .app-icon {
  --app-icon-size: 1.125rem;
}
</style>
