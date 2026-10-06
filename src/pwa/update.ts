export interface UpdateOfferInput {
  /** A new service worker is installed and waiting. */
  readonly needRefresh: boolean
  /** A sheet is open (a form may hold unsaved input). */
  readonly sheetOpen: boolean
  /** "Later" was chosen in this session. */
  readonly postponed: boolean
}

/** The update toast never interrupts a sheet or a form being filled in. */
export function shouldOfferUpdate({ needRefresh, sheetOpen, postponed }: UpdateOfferInput): boolean {
  return needRefresh && !sheetOpen && !postponed
}
