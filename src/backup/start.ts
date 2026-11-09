import type { ServiceId } from './services'
import { showToast } from '@/app/toast'
import { i18n } from '@/i18n'
import { SERVICE_IDS } from './services'
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

/**
 * Reads `?google=…` (or `?dropbox=…`, `?onedrive=…`) left by the Worker and removes it,
 * before the router reads the address.
 */
function takeConnectOutcome(): { service: ServiceId, outcome: ConnectOutcome } | undefined {
  const url = new URL(window.location.href)
  const service = SERVICE_IDS.find(id => url.searchParams.has(id))
  if (!service)
    return undefined
  const value = url.searchParams.get(service)!
  url.searchParams.delete(service)
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
  return {
    service,
    outcome: (OUTCOMES as readonly string[]).includes(value)
      ? value as ConnectOutcome
      : 'error',
  }
}

export function startBackup(): void {
  const back = takeConnectOutcome()
  if (back) {
    const service = i18n.global.t(`services.${back.service}`)
    if (back.outcome === 'connected') {
      void import('./auto').then(async ({ completeConnection }) => {
        await completeConnection(back.service)
        showToast({
          message: i18n.global.t('drive.toast.connected', { service }),
        })
      })
      return
    }
    showToast({
      message: i18n.global.t(`drive.toast.${back.outcome}`, { service }),
    })
  }
  if (backupState.value.connected)
    void import('./auto').then(({ startAutoBackup }) => startAutoBackup())
}
