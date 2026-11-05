import type { Ref, WatchSource } from 'vue'
import { liveQuery } from 'dexie'
import { getCurrentScope, onScopeDispose, shallowRef, watch } from 'vue'

/**
 * Whether the page is on screen, shared by every live query. A copy of the app that is
 * not visible (a second tab, the installed app in the background) stops reading: Android
 * slows such pages down, and a read of theirs, started because the visible copy changed
 * something, made every later write and read of that table wait for seconds.
 */
const visible = shallowRef(typeof document === 'undefined' || document.visibilityState !== 'hidden')
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    visible.value = document.visibilityState !== 'hidden'
  })
}

/**
 * Runs a Dexie query and keeps its result up to date: Dexie re-runs it whenever the tables
 * it read change, also from another tab. The query must only use Dexie (no fetch, no timers).
 * With `deps`, the query runs again when they change (e.g. the selected period). While the
 * page is hidden the query pauses, keeping its last result, and runs again when it shows.
 */
export function useLiveQuery<T>(query: () => T | Promise<T>, deps: WatchSource[] = []) {
  const data: Ref<T | undefined> = shallowRef()
  const error: Ref<unknown> = shallowRef()
  let subscription: { unsubscribe: () => void } | undefined

  function unsubscribe() {
    subscription?.unsubscribe()
    subscription = undefined
  }

  function subscribe() {
    unsubscribe()
    if (!visible.value)
      return
    subscription = liveQuery(query).subscribe({
      next: (value) => {
        data.value = value
        error.value = undefined
      },
      error: (reason) => {
        error.value = reason
      },
    })
  }

  watch([visible, ...deps], subscribe, { immediate: true })

  if (getCurrentScope())
    onScopeDispose(unsubscribe)

  return { data, error }
}
