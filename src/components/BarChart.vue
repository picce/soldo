<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { CHART_HEIGHT, CHART_PADDING as PAD, useChartSelection, useChartWidth, valueAxis } from './chart'

/**
 * Bars over months (docs/specs/released/statistiche.md, «Mese per mese» and a category over 12 months): one
 * or two series side by side, 2px apart, rounded at the top and standing on the axis; optionally
 * the average as a dashed line, named in the right margin. Choosing a month (finger, mouse, arrow
 * keys, `v-model:selected`) dims the others; `emphasis` does the same while nothing is chosen.
 * For screen readers the drawing is hidden and a table holds every value.
 */
export interface BarSeries {
  key: string
  label: string
  /** One value per group, in cents. */
  values: number[]
  /** A CSS color, such as `var(--color-chart-income)`. */
  color: string
}

const props = defineProps<{
  label: string
  series: BarSeries[]
  /** Short label of each group, below the drawing: «G», «F»… */
  labels: string[]
  /** Name of a group in the table: «gennaio 2026». */
  pointLabel: (index: number) => string
  formatValue: (cents: number) => string
  formatTick: (cents: number) => string
  average?: number | null
  averageLabel?: string
  /** The group that stands out while nothing is chosen. */
  emphasis?: number | null
}>()

const selected = defineModel<number | null>('selected', { default: null })

const frame = useTemplateRef<HTMLElement>('frame')
const width = useChartWidth(frame)

/** Room on the right for the name of the average. */
const AVERAGE_MARGIN = 38
const GAP = 2
const INSET = 3

const right = computed(() => props.average != null
  ? PAD.right + AVERAGE_MARGIN
  : PAD.right)
const plotWidth = computed(() => width.value - PAD.left - right.value)
const plotHeight = CHART_HEIGHT - PAD.top - PAD.bottom
const groups = computed(() => props.labels.length)
const slot = computed(() => plotWidth.value / Math.max(1, groups.value))
const barWidth = computed(() => Math.max(1, (slot.value - 2 * INSET - GAP * (props.series.length - 1)) / props.series.length))

const axis = computed(() => valueAxis(Math.max(0, props.average ?? 0, ...props.series.flatMap(bars => bars.values))))

function y(cents: number): number {
  return PAD.top + plotHeight - (cents / axis.value.top) * plotHeight
}

function groupX(index: number): number {
  return PAD.left + index * slot.value
}

/** A bar standing on the axis, its top corners rounded. */
function bar(left: number, cents: number): string {
  const base = PAD.top + plotHeight
  const top = y(cents)
  const radius = Math.min(3, base - top, barWidth.value / 2)
  const w = barWidth.value
  return `M${left},${base} V${top + radius} Q${left},${top} ${left + radius},${top} H${left + w - radius} Q${left + w},${top} ${left + w},${top + radius} V${base} Z`
}

const highlighted = computed(() => selected.value ?? props.emphasis ?? null)

const shapes = computed(() => props.series.flatMap((bars, seriesIndex) => bars.values.flatMap((cents, index) => cents > 0
  ? [
      {
        key: `${bars.key}-${index}`,
        d: bar(groupX(index) + INSET + seriesIndex * (barWidth.value + GAP), cents),
        color: bars.color,
        dim: highlighted.value !== null && highlighted.value !== index,
      },
    ]
  : [])))

const { onPointerDown, onPointerMove, onPointerLeave, onKeydown } = useChartSelection(selected, {
  count: () => groups.value,
  indexAt: position => Math.floor((position - PAD.left) / slot.value),
  start: () => props.emphasis ?? groups.value - 1,
})
</script>

<template>
  <div
    ref="frame"
    class="bar-chart"
    tabindex="0"
    role="group"
    :aria-label="label"
    @keydown="onKeydown"
  >
    <svg
      class="bar-chart__drawing"
      :viewBox="`0 0 ${width} ${CHART_HEIGHT}`"
      :width="width"
      :height="CHART_HEIGHT"
      aria-hidden="true"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
    >
      <g v-for="tick in axis.ticks" :key="tick">
        <line :x1="PAD.left" :x2="width - right" :y1="y(tick)" :y2="y(tick)" class="bar-chart__grid" />
        <text :x="PAD.left - 6" :y="y(tick) + 3.5" class="bar-chart__tick" text-anchor="end">{{ formatTick(tick) }}</text>
      </g>
      <path
        v-for="shape in shapes"
        :key="shape.key"
        :d="shape.d"
        class="bar-chart__bar"
        :class="{ 'bar-chart__bar--dim': shape.dim }"
        :style="{ fill: shape.color }"
      />
      <text
        v-for="(text, index) in labels"
        :key="`x${index}`"
        :x="groupX(index) + slot / 2"
        :y="CHART_HEIGHT - 6"
        class="bar-chart__tick"
        :class="{ 'bar-chart__tick--on': index === highlighted }"
        text-anchor="middle"
      >
        {{ text }}
      </text>
      <template v-if="average != null">
        <line :x1="PAD.left" :x2="width - right + 2" :y1="y(average)" :y2="y(average)" class="bar-chart__average" />
        <text :x="width - right + 6" :y="y(average) + 3.5" class="bar-chart__tick">{{ averageLabel }}</text>
      </template>
    </svg>

    <table class="sr-only">
      <caption>{{ label }}</caption>
      <thead>
        <tr>
          <td />
          <th v-for="bars in series" :key="bars.key" scope="col">
            {{ bars.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(_, index) in labels" :key="index">
          <th scope="row">
            {{ pointLabel(index) }}
          </th>
          <td v-for="bars in series" :key="bars.key">
            {{ formatValue(bars.values[index] ?? 0) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.bar-chart {
  border-radius: var(--rounded);
}

.bar-chart:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 4px;
}

.bar-chart__drawing {
  display: block;
  overflow: visible;
  /* Sideways moves read the chart, vertical ones still scroll the page. */
  touch-action: pan-y;
  user-select: none;
}

.bar-chart__grid {
  stroke: var(--color-line);
  stroke-width: 1;
}

.bar-chart__tick {
  fill: var(--color-ink-2);
  font-family: var(--font-mono);
  font-size: 10px;
}

.bar-chart__tick--on {
  fill: var(--color-ink);
  font-weight: 600;
}

.bar-chart__bar {
  transition: fill-opacity var(--motion-press) var(--motion-ease);
}

.bar-chart__bar--dim {
  fill-opacity: 0.38;
}

@media (prefers-reduced-motion: reduce) {
  .bar-chart__bar {
    transition: none;
  }
}

.bar-chart__average {
  stroke: var(--color-ink-2);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
}
</style>
