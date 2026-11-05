<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** Phosphor icon name, e.g. `house`. Only icons listed in scripts/build-icons.js exist. */
  name: string
  /** Light is the default weight; Regular marks the active state. */
  weight?: 'light' | 'regular'
}>(), {
  weight: 'light',
})

const iconName = computed(() => props.weight === 'light'
  ? `${props.name}-light`
  : props.name)
</script>

<template>
  <VvIcon :name="iconName" prefix="ph" class="app-icon" aria-hidden="true" />
</template>

<style scoped>
.app-icon {
  width: var(--app-icon-size, 1.5rem);
  height: var(--app-icon-size, 1.5rem);
  flex-shrink: 0;
}
</style>
