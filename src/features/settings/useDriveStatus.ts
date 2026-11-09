import { useOnline } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { backupPending, backupRunning, backupState } from '@/backup/state'
import { timeAgo } from '@/domain/dates'
import { useIntlLocale } from '@/i18n/locale'

/**
 * One line on the automatic backup, for the Settings row and the sheet of the service
 * (docs/specs/backup-google-drive.md, "Interfaccia"): what needs the user comes first,
 * then what is happening, then when the last backup went.
 */
export function useDriveStatus() {
  const { t } = useI18n()
  const intlLocale = useIntlLocale()
  const online = useOnline()

  /** «Google Drive», «Dropbox», «OneDrive»: the service connected. */
  const service = computed(() => t(`services.${backupState.value.service}`))

  const detail = computed(() => {
    const state = backupState.value
    if (!state.connected)
      return t('drive.connect')
    if (state.choice)
      return t('drive.status.choice')
    if (state.error === 'auth' || state.error === 'quota')
      return t(`drive.status.${state.error}`, { service: service.value })
    if (backupRunning.value)
      return t('drive.status.running')
    if (!online.value && backupPending.value)
      return t('drive.status.waiting')
    if (state.error === 'unavailable')
      return t('drive.status.unavailable', { service: service.value })
    return state.lastBackupAt
      ? t('drive.status.ok', {
          when: timeAgo(state.lastBackupAt, intlLocale.value),
        })
      : t('drive.status.never')
  })

  /** Something the user has to do: drawn in the error color. */
  const alert = computed(() => {
    const state = backupState.value
    return state.connected && (state.choice || state.error === 'auth' || state.error === 'quota')
  })

  return {
    state: backupState,
    service,
    detail,
    alert,
    online,
  }
}
