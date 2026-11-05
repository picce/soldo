<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppPage from '@/components/AppPage.vue'

const { t } = useI18n()
</script>

<template>
  <AppPage :title="t('nav.transactions')" :intro="t('pages.transactions.intro')" />
</template>
