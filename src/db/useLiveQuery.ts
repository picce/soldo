import type { Ref, WatchSource } from 'vue'
import { liveQuery } from 'dexie'
import { getCurrentScope, onScopeDispose, shallowRef, watch } from 'vue'

/**
 * Runs a Dexie query and keeps its result up to date: Dexie re-runs it whenever the tables
 * it read change, also from another tab. The query must only use Dexie (no fetch, no timers).
 * With `deps`, the query runs again when they change (e.g. the selected period).
 */
export function useLiveQuery<T>(query: () => T | Promise<T>, deps: WatchSource[] = []) {
  const data: Ref<T | undefined> = shallowRef()
  const error: Ref<unknown> = shallowRef()
  let subscription: { unsubscribe: () => void } | undefined

  function subscribe() {
    subscription?.unsubscribe()
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

  if (deps.length)
    watch(deps, subscribe, { immediate: true })
  else
    subscribe()

  if (getCurrentScope())
    onScopeDispose(() => subscription?.unsubscribe())

  return { data, error }
}
