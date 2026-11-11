<script setup lang="ts">
import type { StartPage } from '@/app/start'
import type { OpenableReading } from '@/backup/import'
import type { RemoteBackup } from '@/backup/provider'
import type { ServiceId } from '@/backup/services'
import type { LocalePreference } from '@/i18n/locale'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { appLock, DELAY_NAMES } from '@/app/lock'
import { setStartPage, startPage } from '@/app/start'
import { showToast } from '@/app/toast'
import { markRestoredFromDrive } from '@/backup/auto'
import { backupEncryption } from '@/backup/encryption'
import { exportBackup, exportTransactionsCsv } from '@/backup/export'
import { SERVICE_ICONS, serviceAuths, useAvailableServices } from '@/backup/services'
import AppPage from '@/components/AppPage.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { listAccounts } from '@/db/repositories/accounts'
import { listCategories } from '@/db/repositories/categories'
import { getMeta } from '@/db/repositories/meta'
import { listPaymentMethods } from '@/db/repositories/payment-methods'
import { listRecurrences } from '@/db/repositories/recurrences'
import { useLiveQuery } from '@/db/useLiveQuery'
import { timeAgo, today } from '@/domain/dates'
import { isFinished } from '@/domain/recurrences'
import { useIntlLocale, useLocalePreference } from '@/i18n/locale'
import DriveRestoreSheet from './DriveRestoreSheet.vue'
import DriveSheet from './DriveSheet.vue'
import EncryptionSheet from './EncryptionSheet.vue'
import LockSheet from './LockSheet.vue'
import RestoreBackup from './RestoreBackup.vue'
import SettingsRow from './SettingsRow.vue'
import { useDriveStatus } from './useDriveStatus'

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

// What the app opens on (docs/specs/released/aggiunta-meno-tocchi.md).
const startOptions = computed<{ value: StartPage, label: string }[]>(() => [
  {
    value: 'home',
    label: t('settings.start.home'),
  },
  {
    value: 'expense',
    label: t('settings.start.expense'),
  },
])
const startChoice = computed<StartPage>({
  get: () => startPage.value,
  set: setStartPage,
})

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

const { data: accounts } = useLiveQuery(() => listAccounts())
const { data: paymentMethods } = useLiveQuery(() => listPaymentMethods())
const accountCount = computed(() => accounts.value
  ? t('settings.accounts.accountsCount', accounts.value.length)
  : '')
const paymentCount = computed(() => paymentMethods.value
  ? t('settings.accounts.paymentsCount', paymentMethods.value.length)
  : '')

// Series still going: «4 attive».
const { data: recurrences } = useLiveQuery(() => listRecurrences())
const recurrenceCount = computed(() => {
  if (!recurrences.value)
    return ''
  const current = today()
  return t('settings.recurrences.count', recurrences.value.filter(recurrence => !isFinished(recurrence, current)).length)
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

// Automatic backup (docs/specs/backup-google-drive.md, docs/specs/backup-dropbox-onedrive.md):
// a row for each service the Worker can sign in to; once one is connected, only that one.
const availableServices = useAvailableServices()
const { state: drive, detail: driveDetail, alert: driveAlert, online } = useDriveStatus()
const driveServices = computed(() => drive.value.connected
  ? [drive.value.service]
  : availableServices.value)
const driveSheetOpen = ref(false)
const driveRestoreOpen = ref(false)
let driveBackup: RemoteBackup | undefined

function openDrive(service: ServiceId) {
  if (drive.value.connected) {
    driveSheetOpen.value = true
  }
  else if (!online.value) {
    showToast({
      message: t('drive.offline', {
        service: t(`services.${service}`),
      }),
    })
  }
  else {
    serviceAuths[service].connect('/impostazioni')
  }
}

function restoreFromDrive(reading: OpenableReading, backup: RemoteBackup) {
  driveBackup = backup
  restore.value?.show(reading)
}

/** Restored from Drive: the device now holds that backup, no need to upload it back. */
async function onRestored() {
  const backup = driveBackup
  driveBackup = undefined
  if (backup)
    await markRestoredFromDrive(backup)
}

// Encryption of the backups (docs/specs/released/backup-cifrati.md): «Attiva dal 9 novembre».
const encryptionOpen = ref(false)
const encryptionDetail = computed(() => {
  const since = backupEncryption.value?.since
  return since
    ? t('settings.security.on', {
        date: new Intl.DateTimeFormat(intlLocale.value, { day: 'numeric', month: 'long' }).format(new Date(since)),
      })
    : t('settings.security.off')
})

// PIN lock (docs/specs/released/blocco-pin.md): «Attivo · dopo 1 minuto».
const lockOpen = ref(false)
const lockDetail = computed(() => appLock.value
  ? t('settings.security.lockOn', {
      when: t(`settings.security.lockDelays.${DELAY_NAMES[appLock.value.after]}`),
    })
  : t('settings.security.lockOff'))

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
    <section class="settings-section" aria-labelledby="settings-start">
      <h2 id="settings-start" class="settings-section__title type-label">
        {{ t('settings.start.label') }}
      </h2>
      <SegmentedControl
        v-model="startChoice"
        :options="startOptions"
        aria-labelledby="settings-start"
        aria-describedby="settings-start-hint"
      />
      <p id="settings-start-hint" class="settings-section__hint type-small">
        {{ t('settings.start.hint') }}
      </p>
    </section>
    <section class="settings-section" aria-labelledby="settings-accounts">
      <h2 id="settings-accounts" class="settings-section__title type-label">
        {{ t('settings.accounts.label') }}
      </h2>
      <div class="settings-section__card">
        <SettingsRow
          icon="wallet"
          :title="t('settings.accounts.accounts')"
          :detail="accountCount"
          :to="{ name: 'accounts' }"
        />
        <SettingsRow
          icon="credit-card"
          :title="t('settings.accounts.payments')"
          :detail="paymentCount"
          :to="{ name: 'payment-methods' }"
        />
      </div>
    </section>
    <section class="settings-section" aria-labelledby="settings-recurrences">
      <h2 id="settings-recurrences" class="settings-section__title type-label">
        {{ t('settings.recurrences.label') }}
      </h2>
      <div class="settings-section__card">
        <SettingsRow
          icon="repeat"
          :title="t('settings.recurrences.title')"
          :detail="recurrenceCount"
          :to="{ name: 'recurrences' }"
        />
      </div>
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
    <section class="settings-section" aria-labelledby="settings-security">
      <h2 id="settings-security" class="settings-section__title type-label">
        {{ t('settings.security.label') }}
      </h2>
      <div class="settings-section__card">
        <SettingsRow
          icon="lock"
          :title="t('settings.security.encryption')"
          :detail="encryptionDetail"
          @click="encryptionOpen = true"
        />
        <SettingsRow
          icon="lock-key"
          :title="t('settings.security.lock')"
          :detail="lockDetail"
          @click="lockOpen = true"
        />
      </div>
      <EncryptionSheet v-model:open="encryptionOpen" />
      <LockSheet v-model:open="lockOpen" />
    </section>
    <section v-if="driveServices.length" class="settings-section" aria-labelledby="settings-drive">
      <h2 id="settings-drive" class="settings-section__title type-label">
        {{ t('drive.label') }}
      </h2>
      <div class="settings-section__card">
        <SettingsRow
          v-for="service in driveServices"
          :key="service"
          :icon="SERVICE_ICONS[service]"
          :title="t(`services.${service}`)"
          :detail="driveDetail"
          :alert="driveAlert"
          @click="openDrive(service)"
        />
      </div>
      <DriveSheet v-model:open="driveSheetOpen" @restore="driveRestoreOpen = true" />
      <DriveRestoreSheet v-if="drive.connected" v-model:open="driveRestoreOpen" @chosen="restoreFromDrive" />
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
          :detail="backupEncryption ? t('settings.backup.exportDetailEncrypted') : t('settings.backup.exportDetail')"
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
      <RestoreBackup ref="restore" @restored="onRestored" />
    </section>
    <section class="settings-section" aria-labelledby="settings-about">
      <h2 id="settings-about" class="settings-section__title type-label">
        {{ t('settings.about.label') }}
      </h2>
      <div class="settings-section__card">
        <SettingsRow
          icon="shield-check"
          :title="t('settings.about.privacy')"
          :detail="t('settings.about.privacyDetail')"
          href="/privacy"
        />
      </div>
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
