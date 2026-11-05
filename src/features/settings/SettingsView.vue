<script setup lang="ts">
import type { LocalePreference } from '@/i18n/locale'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from '@/app/toast'
import { exportBackup, exportTransactionsCsv } from '@/backup/export'
import AppPage from '@/components/AppPage.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { listCategories } from '@/db/repositories/categories'
import { getMeta } from '@/db/repositories/meta'
import { useLiveQuery } from '@/db/useLiveQuery'
import { timeAgo } from '@/domain/dates'
import { useIntlLocale, useLocalePreference } from '@/i18n/locale'
import RestoreBackup from './RestoreBackup.vue'
import SettingsRow from './SettingsRow.vue'

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

// Categories in the quick add, archived ones aside: «12 uscite · 4 entrate».
const { data: categories } = useLiveQuery(() => listCategories())
const categoryCount = computed(() => {
  if (!categories.value)
    return ''
  const count = (kind: 'expense' | 'income') => categories.value!.filter(category => category.kind === kind).length
  return [
    t('settings.categories.expenses', count('expense')),
    t('settings.categories.income', count('income')),
  ].join(' · ')
})

// Backup: «ultimo: 3 giorni fa» from the last JSON export (or the restored file).
const intlLocale = useIntlLocale()
const { data: lastExportAt } = useLiveQuery(() => getMeta<string>('lastExportAt'))
const lastBackup = computed(() => t('settings.backup.last', {
  when: lastExportAt.value
    ? timeAgo(lastExportAt.value, intlLocale.value)
    : t('settings.backup.never'),
}))

const exporting = ref(false)
const restore = useTemplateRef<InstanceType<typeof RestoreBackup>>('restore')

/** Runs one export at a time; closing the share sheet is not an error and shows nothing. */
async function runExport(run: () => Promise<'done' | 'cancelled'>, done: string) {
  if (exporting.value)
    return
  exporting.value = true
  try {
    if (await run() === 'done')
      showToast({ message: done })
  }
  catch {
    showToast({
      message: t('backup.exportError'),
    })
  }
  finally {
    exporting.value = false
  }
}

// Version and commit are fixed at build time (build-info.ts); the commit tells apart two
// builds with the same version, e.g. the develop preview and production.
const versionLine = computed(() =>
  [
    t('settings.about.version', { version: __APP_VERSION__ }),
    __APP_COMMIT__,
  ].filter(Boolean).join(' · '),
)
</script>

<template>
  <AppPage :title="t('nav.settings')">
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
    <section class="settings-section" aria-labelledby="settings-categories">
      <h2 id="settings-categories" class="settings-section__title type-label">
        {{ t('settings.categories.label') }}
      </h2>
      <div class="settings-section__card">
        <SettingsRow
          icon="shopping-cart"
          :title="t('settings.categories.title')"
          :detail="categoryCount"
          :to="{ name: 'categories' }"
        />
      </div>
    </section>
    <section class="settings-section" aria-labelledby="settings-backup">
      <div class="settings-section__head">
        <h2 id="settings-backup" class="settings-section__title type-label">
          {{ t('settings.backup.label') }}
        </h2>
        <span class="type-note">{{ lastBackup }}</span>
      </div>
      <div class="settings-section__card">
        <SettingsRow
          icon="export"
          :title="t('settings.backup.export')"
          :detail="t('settings.backup.exportDetail')"
          :disabled="exporting"
          @click="runExport(exportBackup, t('backup.exported'))"
        />
        <SettingsRow
          icon="file-csv"
          :title="t('settings.backup.csv')"
          :detail="t('settings.backup.csvDetail')"
          :disabled="exporting"
          @click="runExport(exportTransactionsCsv, t('backup.csvExported'))"
        />
        <SettingsRow
          icon="file-arrow-up"
          :title="t('settings.backup.import')"
          :detail="t('settings.backup.importDetail')"
          @click="restore?.pick()"
        />
      </div>
      <RestoreBackup ref="restore" />
    </section>
    <section class="settings-section" aria-labelledby="settings-about">
      <h2 id="settings-about" class="settings-section__title type-label">
        {{ t('settings.about.label') }}
      </h2>
      <p class="settings-section__value type-note">
        {{ versionLine }}
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
.settings-section__hint,
.settings-section__value {
  margin: 0;
}

.settings-section__hint {
  color: var(--color-ink-2);
}

/* Title on the left, a note (the last backup) on the right. */
.settings-section__head {
  display: flex;
  align-self: stretch;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

/* Rows in a card, separated by a line (docs/design/README.md, "Elenchi in una scheda"). */
.settings-section__card {
  align-self: stretch;
  overflow: hidden;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.settings-section__card > * + * {
  border-top: 1px solid var(--color-line);
}
</style>
