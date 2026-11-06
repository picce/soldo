<script setup lang="ts">
import AmountText from '@/components/AmountText.vue'
import AppIcon from '@/components/AppIcon.vue'

export interface Choice {
  id: string
  title: string
  icon: string
  /** Palette color of the icon, 1 to 8; without it the icon follows the text. */
  color?: number
  detail?: string
  /** Amount at the end of the row, such as the balance of an account. */
  cents?: number
  strong?: boolean
}

/**
 * Single choice in a sheet (mockups "Selettore del conto", "Foglio del pagamento"): a tap picks
 * the row at once, and the chosen one has `check` in `biro`. Name it with `aria-label`.
 */
defineProps<{
  choices: Choice[]
  selected?: string | null
}>()

defineEmits<{
  select: [id: string]
}>()
</script>

<template>
  <ul class="choice-list">
    <li v-for="choice in choices" :key="choice.id">
      <button type="button" class="choice-list__row" :aria-pressed="choice.id === selected" @click="$emit('select', choice.id)">
        <AppIcon
          :name="choice.icon"
          class="choice-list__icon"
          :style="choice.color ? { color: `var(--color-category-${choice.color})` } : undefined"
        />
        <span class="choice-list__text">
          <span :class="choice.strong ? 'type-body-strong' : 'type-body'">{{ choice.title }}</span>
          <span v-if="choice.detail" class="choice-list__detail type-small">{{ choice.detail }}</span>
        </span>
        <AmountText v-if="choice.cents !== undefined" :cents="choice.cents" />
        <span class="choice-list__mark">
          <AppIcon v-if="choice.id === selected" name="check" weight="regular" />
        </span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.choice-list {
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
  background: var(--color-card);
  border: 1px solid var(--color-line);
  border-radius: var(--rounded);
}

.choice-list li + li {
  border-top: 1px solid var(--color-line);
}

.choice-list__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.5rem 0.875rem;
  background: none;
  border: 0;
  color: var(--color-ink);
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color var(--motion-press) var(--motion-ease);
}

@media (hover: hover) {
  .choice-list__row:hover {
    background: var(--color-hover);
  }
}

/* Pressed at once, released in a moment (docs/design/README.md, "Movimento"). */
.choice-list__row:active {
  background: var(--color-pressed);
  transition-duration: 0s;
}

.choice-list__row:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .choice-list__row {
    transition: none;
  }
}

.choice-list__icon {
  --app-icon-size: 1.375rem;

  flex-shrink: 0;
}

.choice-list__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.choice-list__text > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.choice-list__detail {
  color: var(--color-ink-2);
}

.choice-list__mark {
  flex-shrink: 0;
  width: 1.125rem;
  color: var(--color-pen);
}

.choice-list__mark .app-icon {
  --app-icon-size: 1.125rem;
}
</style>
