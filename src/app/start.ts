import type { Router } from 'vue-router'
import { readonly, ref } from 'vue'

/**
 * What Soldo shows when it opens (docs/specs/released/aggiunta-meno-tocchi.md): the Home, or the new
 * expense, so that an expense is the amount and a tap on the category. A preference of the
 * device, in localStorage like the language: it does not travel inside the backups.
 */

export type StartPage = 'home' | 'expense'

export const START_KEY = 'soldo.start'
/** Set once the app has opened in this tab: a reload does not open the keypad again. */
export const STARTED_KEY = 'soldo.started'

function read(): StartPage {
  try {
    return localStorage.getItem(START_KEY) === 'expense'
      ? 'expense'
      : 'home'
  }
  catch {
    return 'home'
  }
}

const page = ref<StartPage>(read())

export const startPage = readonly(page)

export function setStartPage(next: StartPage): void {
  page.value = next
  try {
    if (next === 'home')
      localStorage.removeItem(START_KEY)
    else
      localStorage.setItem(START_KEY, next)
  }
  catch {
    // Storage full or blocked: it lasts for this session.
  }
}

/** True the first time it is asked in this tab, false after a reload. */
function firstOpening(): boolean {
  try {
    if (sessionStorage.getItem(STARTED_KEY))
      return false
    sessionStorage.setItem(STARTED_KEY, '1')
  }
  catch {
    // Without sessionStorage every load counts as an opening.
  }
  return true
}

/**
 * When the app opens on the Home and the preference says so, the new expense shows instead;
 * closing it or saving leads to the Home. Only the first navigation counts, and only to the
 * Home: any other address (an app shortcut, the return from a sign-in) is respected.
 * Installed by main.ts after the guard of the first start.
 */
export function openOnStart(router: Router): void {
  let opening = true
  router.beforeEach((to) => {
    if (!opening)
      return true
    opening = false
    if (to.name !== 'home' || page.value !== 'expense' || !firstOpening())
      return true
    return {
      name: 'transaction-new',
      params: { kind: 'uscita' },
    }
  })
}

/** Reads the stored preference again; tests only. */
export function reloadStartPage(): void {
  page.value = read()
}
