/** Saves a Blob as a file through a temporary object URL, revoked right after. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  // Revoking in the same task can cancel the download in some browsers.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}

export type Download = (blob: Blob, fileName: string) => void

export function jsonBlob(text: string): Blob {
  return new Blob([text], { type: 'application/json' })
}
