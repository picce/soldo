import { readonly, ref } from 'vue'

/**
 * Installing the app (docs/specs/onboarding.md, "Installa Soldo"). Chrome and Edge offer
 * `beforeinstallprompt`: the event is kept and replayed by the «Installa» button. Safari
 * on iPhone has no such event, so it gets instructions instead.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const canPrompt = ref(false)
const installed = ref(false)

/** Call once at start: the event can fire before any page is shown. */
export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    canPrompt.value = true
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    canPrompt.value = false
    installed.value = true
  })
}

/** Shows the browser's install dialog; true when the user accepts. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event)
    return false
  deferred = null
  canPrompt.value = false
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome === 'accepted'
}

/** iPhone and iPad (which presents itself as a Mac with a touch screen). */
export function isIos(userAgent = navigator.userAgent, touchPoints = navigator.maxTouchPoints): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes('Macintosh') && touchPoints > 1)
}

/** Opened from the home screen, as an installed app. */
export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function useInstall() {
  return {
    canPrompt: readonly(canPrompt),
    installed: readonly(installed),
  }
}
