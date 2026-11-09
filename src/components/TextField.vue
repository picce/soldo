<script setup lang="ts">
import { computed, useId, useTemplateRef } from 'vue'

defineOptions({ inheritAttrs: false })

/**
 * One-line text field with its label above (docs/design/README.md, "Campi di testo"): 44 px,
 * radius 8, `testo-2` outline, `biro` while active. `error` replaces the hint and marks
 * the field invalid. Other attributes (autocomplete, enterkeyhint, …) go to the input.
 */
const props = withDefaults(defineProps<{
  label: string
  hint?: string
  error?: string
  maxlength?: number
  /** `password` hides what is typed (the passphrase of the backups). */
  type?: 'text' | 'password'
}>(), {
  type: 'text',
})

const model = defineModel<string>({ required: true })

const id = useId()
const messageId = `${id}-message`
const input = useTemplateRef<HTMLInputElement>('input')
const message = computed(() => props.error || props.hint)

defineExpose({
  focus: () => input.value?.focus(),
})
</script>

<template>
  <div class="text-field" :class="{ 'text-field--invalid': error }">
    <label :for="id" class="text-field__label type-label">{{ label }}</label>
    <input
      :id="id"
      ref="input"
      v-model="model"
      v-bind="$attrs"
      :type="type"
      class="text-field__input type-body"
      :maxlength="maxlength"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="message ? messageId : undefined"
    >
    <p v-if="message" :id="messageId" class="text-field__message type-small">
      {{ message }}
    </p>
  </div>
</template>

<style scoped>
.text-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.text-field__input {
  box-sizing: border-box;
  width: 100%;
  height: 2.75rem;
  padding: 0 0.875rem;
  background: var(--color-card);
  border: 1px solid var(--color-ink-2);
  border-radius: var(--rounded);
  color: var(--color-ink);
}

.text-field__input:focus {
  outline: none;
  border-color: var(--color-pen);
  box-shadow: 0 0 0 1px var(--color-pen);
}

.text-field__message {
  margin: 0;
  color: var(--color-ink-2);
}

.text-field--invalid .text-field__input {
  border-color: var(--color-danger);
}

.text-field--invalid .text-field__input:focus {
  box-shadow: 0 0 0 1px var(--color-danger);
}

.text-field--invalid .text-field__message {
  color: var(--color-danger);
}
</style>
