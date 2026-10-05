export interface Announcement {
  /** Changes for every announcement so repeating the same text is read again. */
  readonly id: number
  readonly message: string
}

/**
 * Polite live region for screen readers. The region stays mounted (live
 * regions must exist before their content changes); the keyed span is
 * replaced on each announcement so identical messages are re-announced.
 */
export function LiveRegion({ announcement }: { announcement: Announcement | null }) {
  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {announcement !== null && <span key={announcement.id}>{announcement.message}</span>}
    </div>
  )
}
