import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/index.tsx'
import styles from './UndoToast.module.css'

/** How long the toast stays up, not counting time spent hovered or focused. */
export const UNDO_TOAST_MS = 6000

export interface ToastData {
  /** Changes for every new toast so the timer restarts. */
  readonly id: number
  readonly message: string
}

export interface UndoToastProps {
  readonly toast: ToastData | null
  readonly onUndo: () => void
  readonly onDismiss: () => void
  /** "top" while a sheet covers the bottom of the screen. */
  readonly placement?: 'bottom' | 'top'
}

/**
 * "Task completed · Undo". It never takes focus, and the countdown pauses
 * while the pointer is over it or focus is inside it. Announcements go
 * through the app's live region, so the toast itself is not a live region.
 */
export function UndoToast({ toast, onUndo, onDismiss, placement = 'bottom' }: UndoToastProps) {
  const { t } = useI18n()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const remainingRef = useRef(UNDO_TOAST_MS)
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  })

  const toastId = toast?.id
  useEffect(() => {
    remainingRef.current = UNDO_TOAST_MS
  }, [toastId])

  const paused = hovered || focused
  useEffect(() => {
    if (toastId === undefined || paused) return
    const startedAt = Date.now()
    const timer = setTimeout(() => {
      onDismissRef.current()
    }, remainingRef.current)
    return () => {
      clearTimeout(timer)
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt))
    }
  }, [toastId, paused])

  if (toast === null) return null

  return (
    <div
      className={styles.toast}
      data-placement={placement}
      data-testid="undo-toast"
      onMouseEnter={() => {
        setHovered(true)
      }}
      onMouseLeave={() => {
        setHovered(false)
      }}
      onFocus={() => {
        setFocused(true)
      }}
      onBlur={() => {
        setFocused(false)
      }}
    >
      <span className={styles.message}>{toast.message}</span>
      <span aria-hidden="true">·</span>
      <button type="button" className={styles.undo} onClick={onUndo}>
        {t.actions.undo}
      </button>
    </div>
  )
}
