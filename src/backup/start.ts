import { showToast } from '@/app/toast'
import { i18n } from '@/i18n'
import { backupState } from './state'

/**
 * Starts the automatic backup with the app (docs/specs/backup-google-drive.md): after the
 * return from Google's consent screen it completes the connection, otherwise it starts the
 * engine only if Drive is connected. Light: the engine is loaded only when it is needed.
 */

const OUTCOMES = [
  'connected',
  'denied',
  'scope',
  'error',
  'unavailable',
] as const
type ConnectOutcome = typeof OUTCOMES[number]

/** Reads `?google=…` left by the Worker and removes it, before the router reads the address. */
function takeConnectOutcome(): ConnectOutcome | undefined {
  const url = new URL(window.location.href)
  const value = url.searchParams.get('google')
  if (value === null)
    return undefined
  url.searchParams.delete('google')
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
  return (OUTCOMES as readonly string[]).includes(value)
    ? value as ConnectOutcome
    : 'error'
}

export function startBackup(): void {
  const outcome = takeConnectOutcome()
  if (outcome === 'connected') {
    void import('./auto').then(async ({ completeConnection }) => {
      await completeConnection()
      showToast({
        message: i18n.global.t('drive.toast.connected'),
      })
    })
    return
  }
  if (outcome) {
    showToast({
      message: i18n.global.t(`drive.toast.${outcome}`),
    })
  }
  if (backupState.value.connected)
    void import('./auto').then(({ startAutoBackup }) => startAutoBackup())
}
