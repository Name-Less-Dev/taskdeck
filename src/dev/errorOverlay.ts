/**
 * Development-only overlay that prints uncaught errors and unhandled promise
 * rejections on the page itself, because a phone has no DevTools. It uses
 * plain DOM (not React) so it still works when React never mounted, and only
 * textContent, so error text is never parsed as HTML. Texts are English on
 * purpose: this is a developer tool, not product UI.
 */

const PANEL_STYLE = [
  'position:fixed',
  'left:0',
  'right:0',
  'bottom:0',
  'z-index:2147483647',
  'max-height:50vh',
  'overflow:auto',
  'margin:0',
  'padding:12px 12px calc(12px + env(safe-area-inset-bottom))',
  'background:#3b0b0b',
  'color:#ffffff',
  'font:12px/1.4 ui-monospace,Menlo,Consolas,monospace',
  'box-shadow:0 -4px 24px rgb(0 0 0 / 50%)',
].join(';')

function describe(value: unknown): string {
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** Starts listening; returns a function that removes the listeners and the panel. */
export function installErrorOverlay(target: Window = window): () => void {
  const doc = target.document
  let panel: HTMLElement | null = null

  function ensurePanel(): HTMLElement {
    if (panel !== null) return panel
    panel = doc.createElement('section')
    panel.setAttribute('role', 'alert')
    panel.setAttribute('aria-label', 'Development errors')
    panel.dataset.devErrorOverlay = ''
    panel.setAttribute('style', PANEL_STYLE)

    const dismiss = doc.createElement('button')
    dismiss.type = 'button'
    dismiss.textContent = 'Dismiss'
    dismiss.setAttribute('style', 'float:right;min-height:40px;padding:0 12px;font:inherit')
    dismiss.addEventListener('click', () => {
      panel?.remove()
      panel = null
    })
    panel.append(dismiss)
    doc.body.append(panel)
    return panel
  }

  function show(kind: string, detail: string) {
    const entry = doc.createElement('pre')
    entry.setAttribute('style', 'margin:0 0 8px;white-space:pre-wrap;overflow-wrap:anywhere')
    entry.textContent = `[${kind}] ${detail}`
    ensurePanel().append(entry)
  }

  const onError = (event: ErrorEvent) => {
    const where = event.filename === '' ? '' : `\n    at ${event.filename}:${event.lineno}:${event.colno}`
    show('error', describe(event.error ?? event.message) + where)
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    show('unhandledrejection', describe(event.reason))
  }

  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)

  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
    panel?.remove()
    panel = null
  }
}
