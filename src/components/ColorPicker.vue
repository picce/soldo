<script setup lang="ts">
import type { PaletteColor } from '@/db/schema'
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import { colorNameKey, PALETTE_COLORS } from './palette'

/**
 * Choice among the eight category colors (mockup "Modifica categoria"): only the palette,
 * whose colors were checked for color blindness. The chosen one has a 2 px `inchiostro`
 * ring and a check. Native radio buttons underneath, named after the color. Name the
 * group with `aria-labelledby` or `aria-label`.
 */
const model = defineModel<PaletteColor>({ required: true })

const { t } = useI18n()
const name = useId()
</script>

<template>
  <div role="radiogroup" class="color-picker">
    <label v-for="color in PALETTE_COLORS" :key="color" class="color-picker__option">
      <input
        v-model="model"
        type="radio"
        class="color-picker__input"
        :name="name"
        :value="color"
        :aria-label="t(colorNameKey(color))"
      >
      <span class="color-picker__ring">
        <span class="color-picker__swatch" :style="{ background: `var(--color-category-${color})` }">
          <AppIcon v-if="model === color" name="check" weight="regular" />
        </span>
      </span>
    </label>
  </div>
</template>

<style scoped>
.color-picker {
  display: flex;
  justify-content: space-between;
}

/* Eight rings fit a 320 px wide content (360 px screens): below that they shrink. */
.color-picker__option {
  position: relative;
  flex: 0 1 2.5rem;
  min-width: 0;
  padding-block: 0.125rem;
  cursor: pointer;
}

.color-picker__input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

/* The ring is 40 px (44 px to touch, with the padding above), the swatch 30 px. */
.color-picker__ring {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  border: 2px solid transparent;
  border-radius: 0.5rem;
}

.color-picker__swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 75%;
  aspect-ratio: 1;
  border-radius: 0.25rem;
  color: var(--color-card);
  transition: scale var(--motion-press) var(--motion-ease);
}

/* Pressed at once and a little smaller, released in a moment (docs/design/README.md, "Movimento"). */
.color-picker__option:active .color-picker__swatch {
  scale: 0.9;
  transition-duration: 0s;
}

@media (prefers-reduced-motion: reduce) {
  .color-picker__option:active .color-picker__swatch {
    scale: none;
  }
}

.color-picker__swatch .app-icon {
  --app-icon-size: 1.125rem;
}

.color-picker__input:checked + .color-picker__ring {
  border-color: var(--color-ink);
}

.color-picker__input:focus-visible + .color-picker__ring {
  outline: 2px solid var(--color-pen);
  outline-offset: 2px;
}
</style>
