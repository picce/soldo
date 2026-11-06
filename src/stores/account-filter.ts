import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Account that Home and Movimenti show (docs/specs/conti-pagamenti-trasferimenti.md): one choice
 * for both, in memory while the app is open, like the period of the Home. Null is «Tutti i conti».
 */
export const useAccountFilterStore = defineStore('accountFilter', () => {
  const accountId = ref<string | null>(null)

  function select(id: string | null) {
    accountId.value = id
  }

  return { accountId, select }
})
