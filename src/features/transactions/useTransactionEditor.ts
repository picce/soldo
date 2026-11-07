import type { RecurrenceInput } from '@/db/repositories/recurrences'
import type { Account, Category, PaymentMethod, Recurrence, RecurrenceFrequency, Transaction } from '@/db/schema'
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
  createRecurrence,
  deleteRecurrence,
  generateDueOccurrences,
  getRecurrence,
  restoreRecurrence,
  resumeRecurrence,
  revertRecurrence,
  stopRecurrence,
  updateRecurrence,
} from '@/db/repositories/recurrences'
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
import { isFinished } from '@/domain/recurrences'
import { withBudgetCheck } from '@/features/budgets/warnings'
import { recurrenceName } from '@/features/recurrences/describe'
import { useAccountFilterStore } from '@/stores/account-filter'
import { showDeleted, showDuplicated, showSaved, showSeriesSaved } from './notices'

export type EditorKind = Transaction['kind']

/**
 * What the screen works on: a new transaction (a series too, with `repeat` already chosen), a
 * saved one, or a series (docs/specs/released/ricorrenze.md).
 */
export type EditorTarget
  = | { mode: 'new', kind: EditorKind, repeat?: RecurrenceFrequency }
    | { mode: 'edit', id: string }
    | { mode: 'rule', id: string }

/** How a series repeats, as chosen in the date sheet. */
export interface RepeatChoice {
  freq: RecurrenceFrequency
  interval: number
  endDate?: string
}

/** Why the screen cannot save yet, shown above the amount. */
export type EditorHint = 'enterAmount' | 'invalidAmount' | 'chooseCategory' | 'chooseAccounts' | 'endBeforeStart'

/** What an edited transaction or series already uses: archived choices stay on offer for it. */
type KeptChoices = Pick<Transaction, 'kind' | 'accountId' | 'toAccountId' | 'paymentMethodId' | 'categoryId'>

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
 * account comes from there; an income names its account; a transfer names two. With a repeat, a
 * new one is saved as a series, and a series is edited on the same screen (docs/specs/released/ricorrenze.md).
 */
export function useTransactionEditor(target: EditorTarget, options: EditorOptions) {
  const { t } = useI18n()
  const filter = useAccountFilterStore()

  /** A saved transaction or a series: categories are chosen, and «Salva» saves. */
  const isEdit = target.mode !== 'new'
  const isRule = target.mode === 'rule'
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
  /** The series edited (mode `rule`), or the one an edited transaction belongs to. */
  const rule = shallowRef<Recurrence>()
  const kept = shallowRef<KeptChoices>()
  const repeat = ref<RepeatChoice | null>(target.mode === 'new' && target.repeat
    ? { freq: target.repeat, interval: 1 }
    : null)
  /** False while an existing transaction or series is loading. */
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
    .filter(category => !category.archived || category.id === kept.value?.categoryId))

  /** The selected category, when it belongs to the current kind. */
  const selectedId = computed(() => categories.value.some(category => category.id === categoryId.value)
    ? categoryId.value
    : null)

  const { data: accountRows } = useLiveQuery(() => listAccounts({ includeArchived: true }))
  const { data: methodRows } = useLiveQuery(() => listPaymentMethods({ includeArchived: true }))
  const activeAccounts = computed(() => (accountRows.value ?? []).filter(account => !account.archived))

  /** Accounts offered: the active ones, and an archived one this transaction already uses. */
  const accountChoices = computed(() => (accountRows.value ?? []).filter(account =>
    !account.archived || [kept.value?.accountId, kept.value?.toAccountId].includes(account.id)))
  /** Methods offered: the active ones, and an archived one this expense already uses. */
  const paymentChoices = computed(() => (methodRows.value ?? []).filter(method =>
    !method.archived || method.id === kept.value?.paymentMethodId))

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

  /** Puts a saved transaction, or the template of a series, on screen. */
  function fill(fields: KeptChoices & Pick<Transaction, 'amountCents' | 'date' | 'note'>) {
    kept.value = fields
    currentKind.value = fields.kind
    calculator.value = calculatorFromCents(fields.amountCents)
    date.value = fields.date
    note.value = fields.note
    categoryId.value = fields.categoryId
    accountId.value = fields.accountId
    paymentMethodId.value = fields.paymentMethodId ?? null
    fromAccountId.value = fields.accountId
    toAccountId.value = fields.toAccountId ?? null
  }

  if (target.mode === 'edit') {
    void getTransaction(target.id).then(async (transaction) => {
      if (!transaction) {
        options.onNotFound()
        return
      }
      original.value = transaction
      fill(transaction)
      if (transaction.recurrenceId)
        rule.value = await getRecurrence(transaction.recurrenceId)
      ready.value = true
    })
  }
  else if (target.mode === 'rule') {
    void getRecurrence(target.id).then((found) => {
      if (!found) {
        options.onNotFound()
        return
      }
      rule.value = found
      fill({ ...found.template, date: found.startDate })
      repeat.value = { freq: found.freq, interval: found.interval, endDate: found.endDate }
      ready.value = true
    })
  }

  /** A series that is over can be taken up again; one that has started can be stopped. */
  const ruleState = computed<'upcoming' | 'active' | 'finished' | undefined>(() => {
    const current = rule.value
    if (!isRule || !current)
      return undefined
    if (isFinished(current, today()))
      return 'finished'
    return current.startDate > today()
      ? 'upcoming'
      : 'active'
  })

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
    const unchanged = selectedMethod.value?.id === kept.value?.paymentMethodId
    return {
      // An expense keeps its account until its payment method changes: a method moved to another
      // account later must not move the old expenses (and their balances) with it.
      accountId: isEdit && unchanged && kept.value?.kind === 'expense'
        ? kept.value.accountId
        : selectedMethod.value?.accountId ?? accountId.value!,
      paymentMethodId: selectedMethod.value?.id,
    }
  }

  /** False after showing why: a series cannot end before it starts. */
  function validSchedule(): boolean {
    const end = repeat.value?.endDate
    if (end && end < date.value) {
      refuse('endBeforeStart')
      return false
    }
    return true
  }

  type ScreenFields = Pick<Transaction, 'kind' | 'amountCents' | 'date' | 'accountId' | 'categoryId' | 'note'>
    & Partial<Pick<Transaction, 'toAccountId' | 'paymentMethodId'>>

  /** The series of what is on screen: the date is its start. */
  function seriesInput({ date: startDate, ...template }: ScreenFields, choice: RepeatChoice): RecurrenceInput {
    return {
      template,
      freq: choice.freq,
      interval: choice.interval,
      startDate,
      endDate: choice.endDate,
    }
  }

  /** A new series from what is on screen, and its transactions already due (today's too). */
  async function createSeries(fields: ScreenFields, choice: RepeatChoice, subject: Category | string) {
    const input = seriesInput(fields, choice)
    const { warning } = await withBudgetCheck(fields, async () => {
      await createRecurrence(input)
      return generateDueOccurrences(today())
    })
    showSeriesSaved(fields, subject, input, warning)
  }

  /** Changes to the series on screen; what came due with them is added at once. */
  async function updateSeries(fields: ScreenFields, subject: Category | string) {
    await updateRecurrence(rule.value!.id, seriesInput(fields, repeat.value!), today())
    await generateDueOccurrences(today())
    showSaved(fields, subject)
  }

  function selectCategory(category: Category) {
    hint.value = null
    if (isEdit) {
      categoryId.value = category.id
      return
    }
    const amount = validAmount()
    if (amount === null || !validSchedule())
      return
    const choice = repeat.value
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
      if (choice) {
        await createSeries(fields, choice, category)
      }
      else {
        const { result: saved, warning } = await withBudgetCheck(fields, () => addTransaction(fields))
        showSaved(saved, category, warning)
      }
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
    if (!fields || !validSchedule())
      return
    const choice = repeat.value
    void run(async () => {
      const transaction = original.value
      if (isRule) {
        await updateSeries(fields, routeLabel())
      }
      else if (choice) {
        await createSeries(fields, choice, routeLabel())
      }
      else {
        if (transaction)
          await updateTransaction(transaction.id, fields)
        else
          await addTransaction(fields)
        showSaved(fields, routeLabel())
      }
      options.onDone()
    })
  }

  function save() {
    if (currentKind.value === 'transfer') {
      saveTransfer()
      return
    }
    const edited = editedFields()
    if (!edited || !validSchedule())
      return
    if (isRule) {
      void run(async () => {
        await updateSeries(edited.fields, edited.category)
        options.onDone()
      })
      return
    }
    const transaction = original.value
    if (!transaction)
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

  /** Name of the series on screen, for its notices. */
  async function ruleName(): Promise<string> {
    const template = rule.value!.template
    const category = template.categoryId
      ? await getCategory(template.categoryId)
      : undefined
    return recurrenceName(template, category)
  }

  /** Ends the series today, with «Annulla». */
  function stop() {
    const current = rule.value
    if (!current)
      return
    void run(async () => {
      const before = await stopRecurrence(current.id, today())
      showToast({
        message: t('recurrences.stopped', { name: await ruleName() }),
        action: {
          label: t('common.undo'),
          run: () => revertRecurrence(before),
        },
      })
      options.onDone()
    })
  }

  /** Takes a series that is over up again, from today on. */
  function resume() {
    const current = rule.value
    if (!current)
      return
    void run(async () => {
      await resumeRecurrence(current.id, today())
      await generateDueOccurrences(today())
      showToast({
        message: t('recurrences.resumed', { name: await ruleName() }),
      })
      options.onDone()
    })
  }

  function remove() {
    const current = rule.value
    if (isRule && current) {
      void run(async () => {
        await deleteRecurrence(current.id)
        showToast({
          message: t('recurrences.deleted', { name: await ruleName() }),
          action: {
            label: t('common.undo'),
            run: () => restoreRecurrence(current.id),
          },
        })
        options.onDone()
      })
      return
    }
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
    isRule,
    rule,
    ruleState,
    repeat,
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
    stop,
    resume,
  }
}
