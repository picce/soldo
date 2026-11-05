<script setup lang="ts">
import type { Category, CategoryKind, PaletteColor } from '@/db/schema'
import { computed, ref, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { goBack } from '@/app/navigation'
import { showToast } from '@/app/toast'
import AppIcon from '@/components/AppIcon.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import IconButton from '@/components/IconButton.vue'
import IconPicker from '@/components/IconPicker.vue'
import { colorNameKey } from '@/components/palette'
import SubPage from '@/components/SubPage.vue'
import TextField from '@/components/TextField.vue'
import { categoryName } from '@/db/names'
import {
  archiveCategory,
  countCategoryTransactions,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  MAX_CATEGORY_NAME,
  restoreCategory,
  unarchiveCategory,
  updateCategory,
} from '@/db/repositories/categories'
import { normalizeText } from '@/domain/search'
import { CATEGORY_ICONS, iconNameKey } from './icons'
import { suggestColor, suggestIcon } from './suggest'

/**
 * New category and changes to one (mockup "Modifica categoria"): name, icon and color.
 * Archivia hides it from the quick add and keeps it in the history; a category no
 * transaction uses can also be deleted, from the trash in the header.
 */
const props = defineProps<{
  /** Null for a new category. */
  id: string | null
  /** Kind of a new category (from ?tipo=entrate). */
  kind: CategoryKind
}>()

const { t } = useI18n()
const router = useRouter()

const category = shallowRef<Category>()
/** Other categories of the same kind, archived too: a name cannot repeat. */
const siblings = shallowRef<Category[]>([])
const ready = ref(false)
const name = ref('')
const icon = ref('')
const color = ref<PaletteColor>(1)
/** Transactions in the category: with any, it can be archived but not deleted. */
const usage = ref(0)
const submitted = ref(false)
const busy = ref(false)
const nameField = useTemplateRef<InstanceType<typeof TextField>>('nameField')

const kind = computed(() => category.value?.kind ?? props.kind)
const back = computed(() => ({
  name: 'categories',
  query: kind.value === 'income'
    ? { tipo: 'entrate' }
    : {},
}))

async function load() {
  if (props.id) {
    const found = await getCategory(props.id)
    if (!found) {
      void router.replace(back.value)
      return
    }
    category.value = found
    name.value = categoryName(found)
    icon.value = found.icon
    color.value = found.color
    usage.value = await countCategoryTransactions(found.id)
  }
  const others = (await listCategories({ kind: kind.value, includeArchived: true }))
    .filter(other => other.id !== props.id)
  siblings.value = others
  if (!props.id) {
    const active = others.filter(other => !other.archived)
    icon.value = suggestIcon(active)
    color.value = suggestColor(active)
  }
  ready.value = true
}
void load()

const title = computed(() => {
  if (!props.id)
    return t('categoryEdit.new')
  return category.value
    ? categoryName(category.value)
    : t('categoryEdit.edit')
})

const cleanName = computed(() => name.value.trim().replace(/\s+/g, ' '))

const nameError = computed(() => {
  if (!cleanName.value) {
    return submitted.value
      ? t('categoryEdit.nameRequired')
      : ''
  }
  const typed = normalizeText(cleanName.value)
  return siblings.value.some(other => normalizeText(categoryName(other)) === typed)
    ? t('categoryEdit.nameTaken')
    : ''
})

/** A default category keeps its translated name until the name changes. */
const nameHint = computed(() => {
  const preset = category.value?.preset
  return preset && !category.value?.name && cleanName.value === categoryName({ preset })
    ? t('categoryEdit.defaultName')
    : undefined
})

const iconOptions = computed(() => CATEGORY_ICONS.map(value => ({
  value,
  label: t(iconNameKey(value)),
})))

const deletable = computed(() => category.value && usage.value === 0)

/** Runs one change at a time, then goes back to the list; on failure it stays here. */
async function run(change: () => Promise<void>) {
  if (busy.value)
    return
  busy.value = true
  try {
    await change()
    goBack(router, back.value)
  }
  catch {
    showToast({
      message: t('common.saveError'),
    })
  }
  finally {
    busy.value = false
  }
}

function save() {
  submitted.value = true
  if (nameError.value) {
    nameField.value?.focus()
    return
  }
  void run(async () => {
    if (!category.value) {
      const created = await createCategory({
        kind: kind.value,
        name: cleanName.value,
        icon: icon.value,
        color: color.value,
      })
      showToast({
        message: t('categoryEdit.added', {
          name: categoryName(created),
        }),
      })
      return
    }
    await updateCategory(category.value.id, { name: cleanName.value, icon: icon.value, color: color.value })
  })
}

function archive() {
  const current = category.value
  if (!current)
    return
  void run(async () => {
    await archiveCategory(current.id)
    showToast({
      message: t('categoryEdit.archivedToast', {
        name: categoryName(current),
      }),
      action: {
        label: t('common.undo'),
        run: () => unarchiveCategory(current.id, current.order),
      },
    })
  })
}

function unarchive() {
  const current = category.value
  if (!current)
    return
  void run(async () => {
    await unarchiveCategory(current.id)
    showToast({
      message: t('categoryEdit.unarchivedToast', {
        name: categoryName(current),
      }),
    })
  })
}

function remove() {
  const current = category.value
  if (!current)
    return
  void run(async () => {
    await deleteCategory(current.id)
    showToast({
      message: t('categoryEdit.deletedToast', {
        name: categoryName(current),
      }),
      action: {
        label: t('common.undo'),
        run: () => restoreCategory(current.id),
      },
    })
  })
}
</script>

<template>
  <SubPage :title="title" :back="back">
    <template v-if="deletable" #actions>
      <IconButton icon="trash" tone="danger" :label="t('categoryEdit.delete')" :disabled="busy" @click="remove" />
    </template>

    <template v-if="ready">
      <TextField
        ref="nameField"
        v-model="name"
        :label="t('categoryEdit.name')"
        :hint="nameHint"
        :error="nameError"
        :maxlength="MAX_CATEGORY_NAME"
        autocomplete="off"
        enterkeyhint="done"
        @keydown.enter.prevent="save"
      />

      <section class="category-edit__section" aria-labelledby="category-icon-title">
        <h2 id="category-icon-title" class="category-edit__title type-label">
          {{ t('categoryEdit.icon') }}
        </h2>
        <IconPicker v-model="icon" :options="iconOptions" aria-labelledby="category-icon-title" />
      </section>

      <section class="category-edit__section" aria-labelledby="category-color-title">
        <div class="category-edit__heading">
          <h2 id="category-color-title" class="category-edit__title type-label">
            {{ t('categoryEdit.color') }}
          </h2>
          <span class="type-note" aria-hidden="true">{{ t(colorNameKey(color)) }}</span>
        </div>
        <ColorPicker v-model="color" aria-labelledby="category-color-title" />
      </section>

      <p v-if="category?.archived" class="category-edit__note type-small">
        {{ t('categoryEdit.archivedNote') }}
      </p>
      <p v-else-if="usage > 0" class="category-edit__note type-small">
        {{ t('categoryEdit.usage', usage) }}
      </p>
    </template>

    <template v-if="ready" #footer>
      <VvButton
        v-if="category?.archived"
        :label="t('categoryEdit.unarchive')"
        modifiers="secondary"
        class="category-edit__action"
        :disabled="busy"
        @click="unarchive"
      >
        <template #before>
          <AppIcon name="arrow-counter-clockwise" class="category-edit__action-icon" />
        </template>
      </VvButton>
      <VvButton
        v-else-if="category"
        :label="t('categoryEdit.archive')"
        modifiers="secondary"
        class="category-edit__action"
        :disabled="busy"
        @click="archive"
      >
        <template #before>
          <AppIcon name="archive" class="category-edit__action-icon" />
        </template>
      </VvButton>
      <VvButton
        :label="t('categoryEdit.save')"
        modifiers="primary"
        class="category-edit__action"
        :disabled="busy"
        @click="save"
      >
        <template #before>
          <AppIcon name="check" class="category-edit__action-icon" />
        </template>
      </VvButton>
    </template>
  </SubPage>
</template>

<style scoped>
.category-edit__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.category-edit__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.category-edit__title {
  margin: 0;
}

.category-edit__note {
  margin: 0;
  color: var(--color-ink-2);
}

.category-edit__action {
  flex: 1;
  min-height: 3.25rem;
  gap: 0.75rem;
  font-size: 1rem;
}

.category-edit__action-icon {
  --app-icon-size: 1.25rem;
}
</style>
