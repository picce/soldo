<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { CHART_HEIGHT, CHART_PADDING as PAD, useChartSelection, useChartWidth, valueAxis } from './chart'

/**
 * Lines over days (docs/specs/statistiche.md, «Giorno per giorno»): 2px lines, a dashed one for
 * the period before, one value axis from zero. A point is read with the finger, the mouse or the
 * arrow keys (`v-model:selected`); the page writes what it reads. For screen readers the drawing
 * is hidden and a table holds every value.
 */
export interface LineSeries {
  key: string
  label: string
  /** One value per point, in cents; it may stop before the end (the month still running). */
  values: number[]
  /** A CSS color, such as `var(--color-chart-expense)`. */
  color: string
  dashed?: boolean
}

const props = defineProps<{
  /** Name of the chart and caption of its table. */
  label: string
  series: LineSeries[]
  /** Points on the horizontal axis. */
  length: number
  /** Indexes of the points labelled below the drawing. */
  ticks: number[]
  tickLabel: (index: number) => string
  /** Name of a point in the table and in the readout: «5 novembre». */
  pointLabel: (index: number) => string
  formatValue: (cents: number) => string
  formatTick: (cents: number) => string
  /** A dot on the first series while nothing is chosen: today. */
  marker?: number
}>()

const selected = defineModel<number | null>('selected', { default: null })

const frame = useTemplateRef<HTMLElement>('frame')
const width = useChartWidth(frame)

const plotWidth = computed(() => width.value - PAD.left - PAD.right)
const plotHeight = CHART_HEIGHT - PAD.top - PAD.bottom

const axis = computed(() => valueAxis(Math.max(0, ...props.series.flatMap(line => line.values))))

function x(index: number): number {
  return PAD.left + (props.length > 1
    ? (index / (props.length - 1)) * plotWidth.value
    : 0)
}

function y(cents: number): number {
  return PAD.top + plotHeight - (cents / axis.value.top) * plotHeight
}

function path(values: number[]): string {
  return values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
}

/** The main line on top: the dashed ones first. */
const drawn = computed(() => [...props.series].sort((a, b) => Number(!!b.dashed) - Number(!!a.dashed)))

const dots = computed(() => {
  if (selected.value !== null) {
    const index = selected.value
    return props.series
      .filter(line => line.values[index] !== undefined)
      .map(line => ({
        key: line.key,
        cx: x(index),
        cy: y(line.values[index]!),
        color: line.color,
      }))
  }
  const first = props.series[0]
  return first && props.marker !== undefined && first.values[props.marker] !== undefined
    ? [
        {
          key: first.key,
          cx: x(props.marker),
          cy: y(first.values[props.marker]!),
          color: first.color,
        },
      ]
    : []
})

const { onPointerDown, onPointerMove, onPointerLeave, onKeydown } = useChartSelection(selected, {
  count: () => props.length,
  indexAt: position => Math.round(((position - PAD.left) / plotWidth.value) * (props.length - 1)),
  start: () => props.marker ?? props.length - 1,
})

const rows = computed(() => Array.from({ length: props.length }, (_, index) => index))
</script>

<template>
  <div
    ref="frame"
    class="line-chart"
    tabindex="0"
    role="group"
    :aria-label="label"
    @keydown="onKeydown"
  >
    <svg
      class="line-chart__drawing"
      :viewBox="`0 0 ${width} ${CHART_HEIGHT}`"
      :width="width"
      :height="CHART_HEIGHT"
      aria-hidden="true"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
    >
      <g v-for="tick in axis.ticks" :key="tick">
        <line :x1="PAD.left" :x2="width - PAD.right" :y1="y(tick)" :y2="y(tick)" class="line-chart__grid" />
        <text :x="PAD.left - 6" :y="y(tick) + 3.5" class="line-chart__tick" text-anchor="end">{{ formatTick(tick) }}</text>
      </g>
      <text
        v-for="tick in ticks"
        :key="`x${tick}`"
        :x="x(tick)"
        :y="CHART_HEIGHT - 6"
        class="line-chart__tick"
        :class="{ 'line-chart__tick--on': tick === selected }"
        text-anchor="middle"
      >
        {{ tickLabel(tick) }}
      </text>
      <path
        v-for="line in drawn"
        :key="line.key"
        :d="path(line.values)"
        class="line-chart__line"
        :class="{ 'line-chart__line--dashed': line.dashed }"
        :style="{ stroke: line.color }"
      />
      <line
        v-if="selected !== null"
        :x1="x(selected)"
        :x2="x(selected)"
        :y1="PAD.top"
        :y2="PAD.top + plotHeight"
        class="line-chart__guide"
      />
      <circle v-for="dot in dots" :key="dot.key" :cx="dot.cx" :cy="dot.cy" r="4" class="line-chart__dot" :style="{ fill: dot.color }" />
    </svg>

    <table class="sr-only">
      <caption>{{ label }}</caption>
      <thead>
        <tr>
          <td />
          <th v-for="line in series" :key="line.key" scope="col">
            {{ line.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="index in rows" :key="index">
          <th scope="row">
            {{ pointLabel(index) }}
          </th>
          <td v-for="line in series" :key="line.key">
            {{ line.values[index] === undefined ? '' : formatValue(line.values[index]!) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.line-chart {
  position: relative;
  border-radius: var(--rounded);
}

.line-chart:focus-visible {
  outline: 2px solid var(--color-pen);
  outline-offset: 4px;
}

.line-chart__drawing {
  display: block;
  overflow: visible;
  /* Sideways moves read the chart, vertical ones still scroll the page. */
  touch-action: pan-y;
  user-select: none;
}

.line-chart__grid {
  stroke: var(--color-line);
  stroke-width: 1;
}

.line-chart__tick {
  fill: var(--color-ink-2);
  font-family: var(--font-mono);
  font-size: 10px;
}

.line-chart__tick--on {
  fill: var(--color-ink);
  font-weight: 600;
}

.line-chart__line {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.line-chart__line--dashed {
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
}

.line-chart__guide {
  stroke: var(--color-ink-2);
  stroke-width: 1;
}

.line-chart__dot {
  stroke: var(--color-card);
  stroke-width: 2;
}
</style>
