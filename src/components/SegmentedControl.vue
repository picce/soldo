<script setup lang="ts" generic="T extends string">
/**
 * Single choice among a few options, drawn as segments (the Uscita/Entrata switch of the
 * mockups). The active segment is filled with the pen color. Name it with `aria-label`
 * or `aria-labelledby`: attributes go to the underlying group.
 *
 * Each segment gets its value as `name` too: VvButton marks itself pressed by comparing
 * its name, not its value, with the group model.
 */
defineProps<{
  options: { value: T, label: string }[]
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <VvButtonGroup v-model="model" toggle :unselectable="false" class="segmented-control">
    <VvButton
      v-for="option in options"
      :key="option.value"
      :name="option.value"
      :value="option.value"
      :label="option.label"
      class="segmented-control__segment"
    />
  </VvButtonGroup>
</template>

<style scoped>
.segmented-control {
  display: inline-flex;
  gap: 2px;
  margin: 0;
  padding: 3px;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.segmented-control__segment {
  --vv-button-background: transparent;
  --vv-button-border-color: transparent;
  --vv-button-color: var(--color-ink-2);
  --vv-button-font-weight: 400;
  --vv-button-text-shadow: none;
  --vv-button-padding-block: 0.4375rem;
  --vv-button-padding-inline: 1rem;

  min-height: 2.25rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.segmented-control__segment[aria-pressed='true'] {
  --vv-button-background: var(--color-pen);
  --vv-button-border-color: var(--color-pen);
  --vv-button-color: var(--color-on-pen);
  --vv-button-font-weight: 600;
}

.segmented-control__segment:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}
</style>
