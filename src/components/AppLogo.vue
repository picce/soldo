<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// The wordmark is the app name in lowercase; screen readers get the plain name.
const wordmark = computed(() => t('app.name').toLowerCase())
</script>

<template>
  <span class="app-logo">
    <span aria-hidden="true">{{ wordmark }}<span class="app-logo__dot">.</span></span>
    <span class="sr-only">{{ t('app.name') }}</span>
  </span>
</template>

<style scoped>
.app-logo {
  font-family: var(--font-mono);
  font-weight: 600;
  letter-spacing: -0.04em;
  white-space: nowrap;
}

/* In a monospace font the dot sits in a full-width cell: pull it next to the word. */
.app-logo__dot {
  margin-inline-start: -0.18em;
  color: var(--color-pen);
}
</style>
