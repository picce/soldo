import { prefersReducedMotion } from '@/app/motion'

/**
 * Hooks for `<TransitionGroup :css="false" @enter="expand" @leave="collapse">`
 * (docs/design/README.md, "Movimento"): an element that enters opens in height and fades
 * in, one that leaves closes and fades out, so the card around them grows and shrinks
 * without a jump. Height is the only layout property the app animates: one row at a time,
 * for a moment.
 */

/** Value of a time token of tokens.css in milliseconds, or `fallback` when it is missing. */
function tokenMs(name: string, fallback: number): number {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(value)
    ? value
    : fallback
}

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

type Size = Pick<Keyframe, 'height' | 'opacity' | 'marginTop' | 'marginBottom'>

function sizeOf(element: HTMLElement): Size {
  const style = getComputedStyle(element)
  return {
    height: `${element.offsetHeight}px`,
    opacity: 1,
    marginTop: style.marginTop,
    marginBottom: style.marginBottom,
  }
}

const CLOSED: Size = {
  height: '0px',
  opacity: 0,
  marginTop: '0px',
  marginBottom: '0px',
}

function animate(element: HTMLElement, frames: [Size, Size], easing: string, done: () => void) {
  if (prefersReducedMotion() || typeof element.animate !== 'function') {
    done()
    return
  }
  // The measured height includes border and padding; nothing inside spills out meanwhile.
  element.style.boxSizing = 'border-box'
  element.style.overflow = 'hidden'
  const animation = element.animate(frames, {
    duration: tokenMs('--motion-base', 200),
    easing,
  })
  const finish = () => {
    element.style.boxSizing = ''
    element.style.overflow = ''
    done()
  }
  animation.onfinish = finish
  animation.oncancel = finish
}

/** Opens a new element from nothing to its height. */
export function expand(el: Element, done: () => void) {
  const element = el as HTMLElement
  animate(element, [
    CLOSED,
    sizeOf(element),
  ], token('--motion-ease', 'ease-out'), done)
}

/** Closes a leaving element down to nothing, accelerating. */
export function collapse(el: Element, done: () => void) {
  const element = el as HTMLElement
  animate(element, [
    sizeOf(element),
    CLOSED,
  ], token('--motion-ease-exit', 'ease-in'), done)
}
