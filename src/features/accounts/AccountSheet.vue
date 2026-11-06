<script setup lang="ts">
import type { Choice } from '@/components/ChoiceList.vue'
import type { Account } from '@/db/schema'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSheet from '@/components/BottomSheet.vue'
import ChoiceList from '@/components/ChoiceList.vue'
import { accountName } from '@/db/names'

/** Choice of one account (entrate, «Da» and «A» of a transfer, conto collegato di un pagamento). */
const props = defineProps<{
  accounts: Account[]
  selected?: string | null
  title?: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()

const choices = computed<Choice[]>(() => props.accounts.map(account => ({
  id: account.id,
  title: accountName(account),
  icon: account.icon,
  color: account.color,
})))

function select(id: string) {
  emit('select', id)
  open.value = false
}
</script>

<template>
  <BottomSheet v-model="open" :title="title ?? t('accountSheet.title')">
    <ChoiceList :choices="choices" :selected="selected" :aria-label="title ?? t('accountSheet.title')" @select="select" />
  </BottomSheet>
</template>
