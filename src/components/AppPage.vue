<script setup lang="ts">
defineProps<{
  /** Page title (the level 1 heading). The `title` slot replaces it, e.g. with the logo. */
  title?: string
  /** Optional introduction under the title. */
  intro?: string
}>()
</script>

<template>
  <section class="app-page">
    <header class="app-page__header">
      <h1 class="app-page__title type-title">
        <slot name="title">
          {{ title }}
        </slot>
      </h1>
      <slot name="actions" />
    </header>
    <p v-if="intro" class="app-page__intro type-body">
      {{ intro }}
    </p>
    <slot />
  </section>
</template>

<style scoped>
.app-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.app-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.75rem;
}

.app-page__title {
  margin: 0;
}

.app-page__intro {
  margin: 0;
  color: var(--color-ink-2);
}
</style>
