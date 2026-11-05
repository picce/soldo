/**
 * Hands a file to the user. On a phone (coarse pointer) the share sheet opens, so the file
 * can go to Files, Drive or an email; elsewhere, or when sharing is not possible, the file
 * is downloaded. Returns 'cancelled' when the user closes the share sheet.
 */
export async function deliverFile(blob: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], name, { type: blob.type })
  const phone = window.matchMedia?.('(pointer: coarse)').matches
  if (phone && navigator.canShare?.({
    files: [file],
  })) {
    try {
      await navigator.share({
        files: [file],
      })
      return 'shared'
    }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        return 'cancelled'
      // NotAllowedError and the like (e.g. the tap was too long ago): download instead.
    }
  }
  download(blob, name)
  return 'downloaded'
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers read the URL after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
