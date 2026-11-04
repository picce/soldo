<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppPage from '@/components/AppPage.vue'

const { t } = useI18n()
</script>

<template>
  <AppPage :title="t('nav.stats')">
    <p class="text-16 text-word-2 leading-relaxed">
      {{ t('pages.stats.intro') }}
    </p>
  </AppPage>
</template>
