import type { Account, Category, PaymentMethod, Transaction } from '@/db/schema'
import type { CalculatorKey, CalculatorState } from '@/domain/calculator'
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from '@/app/toast'
import { accountName, paymentMethodName, transferRoute } from '@/db/names'
import { firstActiveAccount } from '@/db/payment-defaults'
import { listAccounts } from '@/db/repositories/accounts'
import { getCategory, listCategories } from '@/db/repositories/categories'
import { listPaymentMethods, startingPaymentMethod } from '@/db/repositories/payment-methods'
import {
  addTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from '@/db/repositories/transactions'
import { useLiveQuery } from '@/db/useLiveQuery'
import {
  calculatorFromCents,
  emptyCalculator,
  evaluate,
  isEmptyCalculator,
  isValidResult,
  pressKey,
} from '@/domain/calculator'
import { today } from '@/domain/dates'
import { withBudgetCheck } from '@/features/budgets/warnings'
import { useAccountFilterStore } from '@/stores/account-filter'
import { showDeleted, showDuplicated, showSaved } from './notices'

export type EditorKind = Transaction['kind']

export type EditorTarget
  = | { mode: 'new', kind: EditorKind }
    | { mode: 'edit', id: string }

/** Why the screen cannot save yet, shown above the amount. */
export type EditorHint = 'enterAmount' | 'invalidAmount' | 'chooseCategory' | 'chooseAccounts'

export interface EditorOptions {
  /** Called once the transaction is saved, duplicated or deleted: the screen closes. */
  onDone: () => void
  /** Called in edit mode when the transaction does not exist (or was deleted). */
  onNotFound: () => void
}

/**
 * State and actions of the quick-add and edit screen (docs/specs/released/aggiunta-rapida.md,
 * docs/specs/released/conti-pagamenti-trasferimenti.md). A new expense or income is saved by tapping a
 * category; an existing one and a transfer with «Salva». An expense names how it is paid, and its
 * account comes from there; an income names its account; a transfer names two.
 */
export function useTransactionEditor(target: EditorTarget, options: EditorOptions) {
  const { t } = useI18n()
  const filter = useAccountFilterStore()

  const isEdit = target.mode === 'edit'
  const currentKind = ref<EditorKind>(target.mode === 'new'
    ? target.kind
    : 'expense')
  const calculator = shallowRef<CalculatorState>(emptyCalculator())
  const date = ref(today())
  const note = ref('')
  const categoryId = ref<string | null>(null)
  /** Account of an income, or of an expense without a payment method. */
  const accountId = ref<string | null>(null)
  const paymentMethodId = ref<string | null>(null)
  /** The two sides of a transfer. */
  const fromAccountId = ref<string | null>(null)
  const toAccountId = ref<string | null>(null)
  const original = shallowRef<Transaction>()
  /** False while an existing transaction is loading. */
  const ready = ref(!isEdit)
  const hint = ref<EditorHint | null>(null)
  /** Grows at every refused save: the amount shakes again. */
  const shakeCount = ref(0)
  let busy = false

  const amountCents = computed(() => evaluate(calculator.value))

  // Archived categories are hidden, except the one of the transaction being edited.
  const { data: categoryRows } = useLiveQuery(
    async () => currentKind.value === 'transfer'
      ? []
      : listCategories({ kind: currentKind.value, includeArchived: true }),
    [currentKind],
  )
  const categories = computed(() => (categoryRows.value ?? [])
    .filter(category => !category.archived || category.id === original.value?.categoryId))

  /** The selected category, when it belongs to the current kind. */
  const selectedId = computed(() => categories.value.some(category => category.id === categoryId.value)
    ? categoryId.value
    : null)

  const { data: accountRows } = useLiveQuery(() => listAccounts({ includeArchived: true }))
  const { data: methodRows } = useLiveQuery(() => listPaymentMethods({ includeArchived: true }))
  const activeAccounts = computed(() => (accountRows.value ?? []).filter(account => !account.archived))

  /** Accounts offered: the active ones, and an archived one this transaction already uses. */
  const accountChoices = computed(() => (accountRows.value ?? []).filter(account =>
    !account.archived || [original.value?.accountId, original.value?.toAccountId].includes(account.id)))
  /** Methods offered: the active ones, and an archived one this expense already uses. */
  const paymentChoices = computed(() => (methodRows.value ?? []).filter(method =>
    !method.archived || method.id === original.value?.paymentMethodId))

  function accountById(id: string | null): Account | undefined {
    return (accountRows.value ?? []).find(account => account.id === id)
  }

  const selectedMethod = computed<PaymentMethod | undefined>(() =>
    (methodRows.value ?? []).find(method => method.id === paymentMethodId.value))
  const selectedAccount = computed(() => accountById(accountId.value))
  const fromAccount = computed(() => accountById(fromAccountId.value))
  const toAccount = computed(() => accountById(toAccountId.value))

  const canTransfer = computed(() => !isEdit && activeAccounts.value.length >= 2)
  /** The choice of account of an income: pointless with a single active account. */
  const showsAccountChoice = computed(() =>
    activeAccounts.value.length >= 2 || !!selectedAccount.value?.archived)

  /** The account chosen in the selector of Home and Movimenti, if it can take a new transaction. */
  async function chosenAccount(): Promise<Account | undefined> {
    const accounts = await listAccounts()
    return accounts.find(account => account.id === filter.accountId)
  }

  /** What an expense starts from: the last method used, and the account it is tied to. */
  async function startExpense() {
    const chosen = await chosenAccount()
    const method = await startingPaymentMethod(chosen?.id)
    paymentMethodId.value = method?.id ?? null
    if (method)
      accountId.value = method.accountId
    else
      accountId.value = chosen?.id ?? firstActiveAccount(await listAccounts())?.id ?? null
  }

  async function startIncome() {
    const accounts = await listAccounts()
    accountId.value = (await chosenAccount())?.id ?? accounts[0]?.id ?? null
  }

  /** «Da» starts from the chosen account or the first of the list, «A» from the next one. */
  async function startTransfer() {
    const accounts = await listAccounts()
    const from = (await chosenAccount()) ?? accounts[0]
    fromAccountId.value = from?.id ?? null
    toAccountId.value = accounts.find(account => account.id !== from?.id)?.id ?? null
  }

  function start(kind: EditorKind): Promise<void> {
    if (kind === 'expense')
      return startExpense()
    return kind === 'income'
      ? startIncome()
      : startTransfer()
  }

  /** Done once the screen knows the account: a save waits for it. */
  let started: Promise<void> = target.mode === 'new'
    ? start(target.kind)
    : Promise.resolve()

  /** Kind on screen. Changing it starts the new kind's choices, keeping what still applies. */
  const kind = computed<EditorKind>({
    get: () => currentKind.value,
    set: (next) => {
      const previous = currentKind.value
      if (next === previous)
        return
      currentKind.value = next
      hint.value = null
      if (next === 'income' && previous === 'expense') {
        paymentMethodId.value = null
        return
      }
      started = started.then(() => start(next))
    },
  })

  if (target.mode === 'edit') {
    void getTransaction(target.id).then((transaction) => {
      if (!transaction) {
        options.onNotFound()
        return
      }
      original.value = transaction
      currentKind.value = transaction.kind
      calculator.value = calculatorFromCents(transaction.amountCents)
      date.value = transaction.date
      note.value = transaction.note
      categoryId.value = transaction.categoryId
      accountId.value = transaction.accountId
      paymentMethodId.value = transaction.paymentMethodId ?? null
      fromAccountId.value = transaction.accountId
      toAccountId.value = transaction.toAccountId ?? null
      ready.value = true
    })
  }

  function press(key: CalculatorKey) {
    calculator.value = pressKey(calculator.value, key)
    hint.value = null
  }

  function refuse(reason: EditorHint) {
    hint.value = reason
    shakeCount.value++
    if ('vibrate' in navigator)
      navigator.vibrate(30)
  }

  /** The amount, or null after showing why it cannot be saved. */
  function validAmount(): number | null {
    if (isValidResult(amountCents.value))
      return amountCents.value
    refuse(isEmptyCalculator(calculator.value)
      ? 'enterAmount'
      : 'invalidAmount')
    return null
  }

  /** Runs one write at a time (a double tap must not save twice) and reports failures. */
  async function run(action: () => Promise<void>) {
    if (busy)
      return
    busy = true
    try {
      await started
      await action()
    }
    catch (error) {
      console.error(error)
      showToast({
        message: t('common.saveError'),
      })
    }
    finally {
      busy = false
    }
  }

  /** Account and payment method of what is on screen, for an expense or an income. */
  function moneySide() {
    if (currentKind.value !== 'expense')
      return { accountId: accountId.value!, paymentMethodId: undefined }
    const unchanged = selectedMethod.value?.id === original.value?.paymentMethodId
    return {
      // An expense keeps its account until its payment method changes: a method moved to another
      // account later must not move the old expenses (and their balances) with it.
      accountId: isEdit && unchanged && original.value?.kind === 'expense'
        ? original.value.accountId
        : selectedMethod.value?.accountId ?? accountId.value!,
      paymentMethodId: selectedMethod.value?.id,
    }
  }

  function selectCategory(category: Category) {
    hint.value = null
    if (isEdit) {
      categoryId.value = category.id
      return
    }
    const amount = validAmount()
    if (amount === null)
      return
    void run(async () => {
      const side = moneySide()
      if (!side.accountId)
        throw new Error('No account to save the transaction to')
      const fields = {
        kind: currentKind.value,
        amountCents: amount,
        date: date.value,
        categoryId: category.id,
        note: note.value,
        ...side,
      }
      const { result: saved, warning } = await withBudgetCheck(fields, () => addTransaction(fields))
      showSaved(saved, category, warning)
      options.onDone()
    })
  }

  /** Fields of the edited expense or income as shown on screen, or null if they cannot be saved. */
  function editedFields() {
    const amount = validAmount()
    if (amount === null)
      return null
    const category = categories.value.find(item => item.id === selectedId.value)
    if (!category) {
      refuse('chooseCategory')
      return null
    }
    return {
      category,
      fields: {
        kind: currentKind.value,
        amountCents: amount,
        date: date.value,
        categoryId: category.id,
        note: note.value,
        ...moneySide(),
      },
    }
  }

  /** Fields of the transfer on screen, or null if it cannot be saved. */
  function transferFields() {
    const amount = validAmount()
    if (amount === null)
      return null
    if (!fromAccountId.value || !toAccountId.value || fromAccountId.value === toAccountId.value) {
      refuse('chooseAccounts')
      return null
    }
    return {
      kind: 'transfer' as const,
      amountCents: amount,
      date: date.value,
      accountId: fromAccountId.value,
      toAccountId: toAccountId.value,
      categoryId: null,
      note: note.value,
    }
  }

  function routeLabel(): string {
    return transferRoute(fromAccount.value, toAccount.value)
  }

  function saveTransfer() {
    const fields = transferFields()
    if (!fields)
      return
    void run(async () => {
      const transaction = original.value
      if (transaction)
        await updateTransaction(transaction.id, fields)
      else
        await addTransaction(fields)
      showSaved(fields, routeLabel())
      options.onDone()
    })
  }

  function save() {
    if (currentKind.value === 'transfer') {
      saveTransfer()
      return
    }
    const edited = editedFields()
    const transaction = original.value
    if (!edited || !transaction)
      return
    void run(async () => {
      const { warning } = await withBudgetCheck(edited.fields, () => updateTransaction(transaction.id, edited.fields))
      showSaved(edited.fields, edited.category, warning)
      options.onDone()
    })
  }

  /** Copy of what is on screen, dated today; the original stays as it was. */
  function duplicate() {
    if (currentKind.value === 'transfer') {
      const fields = transferFields()
      if (!fields)
        return
      void run(async () => {
        const copy = await addTransaction({
          ...fields,
          date: today(),
        })
        showDuplicated(copy, routeLabel())
        options.onDone()
      })
      return
    }
    const edited = editedFields()
    const transaction = original.value
    if (!edited || !transaction)
      return
    void run(async () => {
      const fields = {
        ...edited.fields,
        date: today(),
      }
      const { result: copy, warning } = await withBudgetCheck(fields, () => addTransaction(fields))
      showDuplicated(copy, edited.category, warning)
      options.onDone()
    })
  }

  function remove() {
    const transaction = original.value
    if (!transaction)
      return
    void run(async () => {
      await deleteTransaction(transaction.id)
      if (transaction.kind === 'transfer') {
        showDeleted(transaction, transferRoute(accountById(transaction.accountId), accountById(transaction.toAccountId ?? null)))
      }
      else {
        const category = transaction.categoryId
          ? await getCategory(transaction.categoryId)
          : undefined
        showDeleted(transaction, category)
      }
      options.onDone()
    })
  }

  function selectPaymentMethod(id: string) {
    paymentMethodId.value = id
  }

  function selectAccount(id: string) {
    accountId.value = id
  }

  function selectFrom(id: string) {
    fromAccountId.value = id
    hint.value = null
  }

  function selectTo(id: string) {
    toAccountId.value = id
    hint.value = null
  }

  function swapAccounts() {
    const from = fromAccountId.value
    fromAccountId.value = toAccountId.value
    toAccountId.value = from
  }

  const paymentLabel = computed(() => selectedMethod.value
    ? paymentMethodName(selectedMethod.value)
    : '')
  const accountLabel = computed(() => selectedAccount.value
    ? accountName(selectedAccount.value)
    : '')

  return {
    isEdit,
    ready,
    kind,
    calculator,
    amountCents,
    date,
    note,
    categories,
    selectedId,
    hint,
    shakeCount,
    canTransfer,
    accountRows,
    accountChoices,
    paymentChoices,
    showsAccountChoice,
    paymentMethodId,
    accountId,
    fromAccountId,
    toAccountId,
    fromAccount,
    toAccount,
    paymentLabel,
    accountLabel,
    press,
    selectCategory,
    selectPaymentMethod,
    selectAccount,
    selectFrom,
    selectTo,
    swapAccounts,
    save,
    duplicate,
    remove,
  }
}
