/**
 * Reading XML files (Excel sheets, CAMT.053) with the browser's parser, by local name, so
 * the namespace prefixes a file uses do not matter.
 */

export function parseXml(text: string): Document | null {
  const document = new DOMParser().parseFromString(text, 'application/xml')
  return document.getElementsByTagName('parsererror').length
    ? null
    : document
}

/** Descendants named `name`, whatever their prefix. */
export function elements(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter(node => node.localName === name)
}

/** The first descendant named `name`, or the first along a path of names. */
export function element(root: Document | Element, ...path: string[]): Element | undefined {
  let current: Document | Element | undefined = root
  for (const name of path) {
    current = current && elements(current, name)[0]
    if (!current)
      return undefined
  }
  return current as Element
}

/** The text of the element at `path`, trimmed; empty when it is not there. */
export function text(root: Document | Element, ...path: string[]): string {
  return element(root, ...path)?.textContent?.trim() ?? ''
}

/** Direct children named `name`. */
export function children(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter(child => child.localName === name)
}
