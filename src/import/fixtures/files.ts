/** The sample statements of this folder, invented. */
const files = import.meta.glob<string>('./*.{csv,ofx,qif,xml}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export function fixtureText(name: string): string {
  const text = files[`./${name}`]
  if (text === undefined)
    throw new Error(`No fixture ${name}`)
  return text
}

export function fixtureBytes(name: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(fixtureText(name))
}
