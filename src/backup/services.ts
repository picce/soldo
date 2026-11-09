import type { ComputedRef } from 'vue'
import type { ServiceAuth, ServiceId } from './oauth'
import { computed } from 'vue'
import { googleAuth } from './google/auth'
import { serviceAuth } from './oauth'

/**
 * The services the automatic backup can go to (docs/specs/backup-dropbox-onedrive.md): one
 * at a time, each offered only where the Worker has its credentials. Light: names, icons
 * and sign-in only; the providers load with the engine (auto.ts).
 */

export type { ServiceId } from './oauth'

export const SERVICE_IDS: ServiceId[] = ['google', 'dropbox', 'onedrive']

/** Phosphor has no OneDrive logo: a cloud stands for it. */
export const SERVICE_ICONS: Record<ServiceId, string> = {
  google: 'google-drive-logo',
  dropbox: 'dropbox-logo',
  onedrive: 'cloud',
}

export const serviceAuths: Record<ServiceId, ServiceAuth> = {
  google: googleAuth,
  dropbox: serviceAuth('dropbox'),
  onedrive: serviceAuth('onedrive'),
}

export function isServiceId(value: unknown): value is ServiceId {
  return (SERVICE_IDS as unknown[]).includes(value)
}

/**
 * The services this site can back up to, in their order: those the Worker has credentials
 * for. Each is asked once per session (oauth.ts).
 */
export function useAvailableServices(): ComputedRef<ServiceId[]> {
  const available = SERVICE_IDS.map(id => [
    id,
    serviceAuths[id].useAvailable(),
  ] as const)
  return computed(() => available.filter(([, ready]) => ready.value).map(([id]) => id))
}
