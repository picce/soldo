<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppLogo from '@/components/AppLogo.vue'
import AppPage from '@/components/AppPage.vue'

const { t } = useI18n()
</script>

<template>
  <AppPage :intro="t('pages.home.intro')">
    <template #title>
      <AppLogo />
    </template>
  </AppPage>
</template>
