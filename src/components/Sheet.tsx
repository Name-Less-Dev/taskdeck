import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useI18n } from '../i18n/index.tsx'
import { Icon } from './Icon.tsx'
import styles from './Sheet.module.css'

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'

/** Put this attribute on the element that should receive focus when the sheet opens. */
export const AUTOFOCUS_ATTRIBUTE = 'data-autofocus'

export interface SheetProps {
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
}

/**
 * Bottom sheet dialog shared by every sheet: role="dialog" + aria-modal,
 * labelled by its title, Escape and backdrop close it, Tab and Shift+Tab stay
 * inside. On open, focus goes to the [data-autofocus] element or the first
 * control after the close button. The caller makes the page behind `inert`
 * and decides where focus returns on close.
 */
export function Sheet({ title, onClose, children }: SheetProps) {
  const { t } = useI18n()
  const headingId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return
    const target =
      dialog.querySelector<HTMLElement>(`[${AUTOFOCUS_ATTRIBUTE}]`) ??
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE)[1] ??
      dialog.querySelector<HTMLElement>(FOCUSABLE)
    target?.focus()
  }, [])

  // Safari does not focus a button or checkbox when it is clicked, so with the
  // sheet open focus can sit on <body>, out of reach of the dialog's own key
  // handler. Escape from outside the dialog closes it too (the page behind is
  // inert, so nothing else there can be using the key).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const dialog = dialogRef.current
      if (dialog === null || (event.target instanceof Node && dialog.contains(event.target))) return
      event.preventDefault()
      onCloseRef.current()
    }
    document.addEventListener('keydown', onDocumentKeyDown)
    return () => {
      document.removeEventListener('keydown', onDocumentKeyDown)
    }
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || dialogRef.current === null) return

    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = focusable[0]
    const last = focusable.at(-1)
    if (first === undefined || last === undefined) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.header}>
          <h2 id={headingId} className={styles.heading}>
            {title}
          </h2>
          <button type="button" className={styles.close} aria-label={t.form.close} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
