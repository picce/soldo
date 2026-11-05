<script setup lang="ts">
import type { LocalePreference } from '@/i18n/locale'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppPage from '@/components/AppPage.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { useLocalePreference } from '@/i18n/locale'

const { t } = useI18n()

const localePreference = useLocalePreference()

// Language names stay in their own language; only "Automatic" is translated.
const localeOptions = computed<{ value: LocalePreference, label: string }[]>(() => [
  {
    value: 'auto',
    label: t('settings.language.auto'),
  },
  {
    value: 'it',
    label: t('settings.language.it'),
  },
  {
    value: 'en',
    label: t('settings.language.en'),
  },
])
</script>

<template>
  <AppPage :title="t('nav.settings')" :intro="t('pages.settings.intro')">
    <section class="settings-section" aria-labelledby="settings-language">
      <h2 id="settings-language" class="settings-section__title type-label">
        {{ t('settings.language.label') }}
      </h2>
      <SegmentedControl
        v-model="localePreference"
        :options="localeOptions"
        aria-labelledby="settings-language"
        aria-describedby="settings-language-hint"
      />
      <p id="settings-language-hint" class="settings-section__hint type-small">
        {{ t('settings.language.hint') }}
      </p>
    </section>
  </AppPage>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding-top: 0.5rem;
}

.settings-section__title,
.settings-section__hint {
  margin: 0;
}

.settings-section__hint {
  color: var(--color-ink-2);
}
</style>
