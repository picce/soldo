/**
 * Whether the system asks for less motion («Riduci movimento»): animations driven from
 * script check it, the CSS ones use the media query (docs/design/README.md, "Movimento").
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
}
