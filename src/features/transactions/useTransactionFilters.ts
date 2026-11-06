import type { LocationQueryValue } from 'vue-router'
import type { DateRange } from '@/domain/periods'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isIsoDate } from '@/domain/dates'

export type KindFilter = 'expense' | 'income' | 'transfer'

/** Kinds as written in the URL, in Italian like the paths. */
const KIND_SLUGS: Record<string, KindFilter> = { uscite: 'expense', entrate: 'income', trasferimenti: 'transfer' }
const SLUG_OF: Record<KindFilter, string> = { expense: 'uscite', income: 'entrate', transfer: 'trasferimenti' }

function first(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  const item = Array.isArray(value)
    ? value[0]
    : value
  return item ?? ''
}

/**
 * Filters of Movimenti, kept in the URL (`?q=`, `?tipo=`, `?categoria=`, `?pagamento=`, `?dal=`, `?al=`)
 * so that going back and reloading keep them. Changes replace the history entry: typing
 * a search does not add a step for each letter.
 */
export function useTransactionFilters() {
  const route = useRoute()
  const router = useRouter()

  const search = computed(() => first(route.query.q))
  const kind = computed<KindFilter | null>(() => KIND_SLUGS[first(route.query.tipo)] ?? null)
  const categoryIds = computed(() => first(route.query.categoria).split(',').filter(Boolean))
  const paymentIds = computed(() => first(route.query.pagamento).split(',').filter(Boolean))
  const range = computed<DateRange | null>(() => {
    const from = first(route.query.dal)
    const to = first(route.query.al)
    return isIsoDate(from) && isIsoDate(to) && from <= to
      ? { from, to }
      : null
  })
  const active = computed(() => !!(search.value || kind.value || categoryIds.value.length || paymentIds.value.length || range.value))

  function update(changes: Record<string, string | null>) {
    const query = { ...route.query }
    for (const [key, value] of Object.entries(changes)) {
      if (value)
        query[key] = value
      else
        delete query[key]
    }
    void router.replace({ query })
  }

  return {
    search,
    kind,
    categoryIds,
    paymentIds,
    range,
    active,
    setSearch: (value: string) => update({ q: value.trim() || null }),
    // A transfer has neither a category nor a payment method: those filters would hide them all.
    setKind: (value: KindFilter | null) => update({
      tipo: value ? SLUG_OF[value] : null,
      ...(value === 'transfer'
        ? { categoria: null, pagamento: null }
        : {}),
    }),
    setCategories: (ids: string[]) => update({ categoria: ids.join(',') || null }),
    setPayments: (ids: string[]) => update({ pagamento: ids.join(',') || null }),
    clearRange: () => update({ dal: null, al: null }),
  }
}
