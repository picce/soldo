<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <section class="app-page">
    <header class="app-page__header">
      <h1 class="text-28 font-semibold text-word">
        {{ title }}
      </h1>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>

<style scoped>
.app-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.app-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}
</style>
