import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import type { Deck, Task } from '../domain/index.ts'
import { useI18n } from '../i18n/index.tsx'
import styles from './DeckSheet.module.css'
import form from './Form.module.css'
import { Icon } from './Icon.tsx'
import { AUTOFOCUS_ATTRIBUTE, Sheet } from './Sheet.tsx'

export interface DeckSheetProps {
  readonly decks: readonly Deck[]
  readonly tasks: readonly Task[]
  /** null = "All decks". */
  readonly activeDeckId: string | null
  readonly onSelect: (deckId: string | null) => void
  /** Returns an error message, or null when the deck was created. */
  readonly onCreate: (name: string) => string | null
  /** Returns an error message, or null when the deck was renamed. */
  readonly onRename: (deckId: string, name: string) => string | null
  readonly onRemove: (deckId: string) => void
  readonly onClose: () => void
}

type Mode =
  | { readonly kind: 'list' }
  | { readonly kind: 'rename'; readonly deckId: string }
  | { readonly kind: 'confirm-remove'; readonly deckId: string }

const ROW_ATTRIBUTE = 'data-deck-row'

/** "Decks" sheet: choose the active deck, create, rename and delete decks. */
export function DeckSheet({ decks, tasks, activeDeckId, onSelect, onCreate, onRename, onRemove, onClose }: DeckSheetProps) {
  const { t } = useI18n()
  const id = useId()
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // Where focus goes after the next mode change (list rows are re-rendered).
  const focusAfter = useRef<string | null>(null)

  const activeCount = (deckId: string | null) =>
    tasks.filter((task) => task.status === 'active' && (deckId === null || task.deckId === deckId)).length
  const isLast = decks.length <= 1

  useEffect(() => {
    const selector = focusAfter.current
    focusAfter.current = null
    if (selector !== null) bodyRef.current?.querySelector<HTMLElement>(selector)?.focus()
  }, [mode, decks])

  function startRename(deck: Deck) {
    setRenameValue(deck.name)
    setRenameError(null)
    setMode({ kind: 'rename', deckId: deck.id })
    focusAfter.current = `[${ROW_ATTRIBUTE}="${deck.id}"] input`
  }

  function backToList(deckId: string | null) {
    setMode({ kind: 'list' })
    focusAfter.current = deckId === null ? `[${ROW_ATTRIBUTE}="all"] button` : `[${ROW_ATTRIBUTE}="${deckId}"] button`
  }

  function submitRename(event: SubmitEvent<HTMLFormElement>, deckId: string) {
    event.preventDefault()
    const error = onRename(deckId, renameValue)
    if (error === null) backToList(deckId)
    else setRenameError(error)
  }

  function submitCreate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const error = onCreate(newName)
    setCreateError(error)
    if (error === null) setNewName('')
  }

  if (mode.kind === 'confirm-remove') {
    const deck = decks.find((candidate) => candidate.id === mode.deckId)
    const taskCount = tasks.filter((task) => task.deckId === mode.deckId).length
    return (
      <Sheet title={t.decks.sheetTitle} onClose={onClose}>
        <div className={styles.confirm} role="group" aria-labelledby={`${id}-confirm`} ref={bodyRef}>
          <h3 id={`${id}-confirm`} className={styles.confirmTitle}>
            {t.decks.confirmRemoveTitle(deck?.name ?? '')}
          </h3>
          <p className={form.hint}>{t.decks.confirmRemoveBody(taskCount)}</p>
          <div className={form.actions}>
            <button
              type="button"
              className={form.secondary}
              {...{ [AUTOFOCUS_ATTRIBUTE]: true }}
              onClick={() => {
                backToList(mode.deckId)
              }}
            >
              {t.decks.cancel}
            </button>
            <button
              type="button"
              className={form.danger}
              onClick={() => {
                onRemove(mode.deckId)
                backToList(null)
              }}
            >
              {t.decks.confirmRemove}
            </button>
          </div>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={t.decks.sheetTitle} onClose={onClose}>
      <div ref={bodyRef} className={styles.body}>
        <ul className={styles.list}>
          <li className={styles.row} {...{ [ROW_ATTRIBUTE]: 'all' }}>
            <button
              type="button"
              className={styles.select}
              aria-current={activeDeckId === null ? 'true' : undefined}
              {...(activeDeckId === null ? { [AUTOFOCUS_ATTRIBUTE]: true } : {})}
              onClick={() => {
                onSelect(null)
              }}
            >
              <span className={styles.name}>{t.decks.allDecks}</span>
              <span className={styles.count}>{t.decks.activeCount(activeCount(null))}</span>
            </button>
          </li>

          {decks.map((deck) => (
            <li key={deck.id} className={styles.row} {...{ [ROW_ATTRIBUTE]: deck.id }}>
              {mode.kind === 'rename' && mode.deckId === deck.id ? (
                <form
                  className={styles.renameForm}
                  noValidate
                  onSubmit={(event) => {
                    submitRename(event, deck.id)
                  }}
                >
                  <label className="visually-hidden" htmlFor={`${id}-rename`}>
                    {t.decks.nameLabel}
                  </label>
                  <input
                    id={`${id}-rename`}
                    className={styles.input}
                    value={renameValue}
                    autoComplete="off"
                    aria-invalid={renameError !== null}
                    aria-describedby={renameError === null ? undefined : `${id}-rename-error`}
                    onChange={(event) => {
                      setRenameValue(event.target.value)
                    }}
                  />
                  <button type="submit" className={form.primary}>
                    {t.decks.save}
                  </button>
                  <button
                    type="button"
                    className={form.secondary}
                    onClick={() => {
                      backToList(deck.id)
                    }}
                  >
                    {t.decks.cancel}
                  </button>
                  {renameError !== null && (
                    <p id={`${id}-rename-error`} className={form.error}>
                      {renameError}
                    </p>
                  )}
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.select}
                    aria-current={activeDeckId === deck.id ? 'true' : undefined}
                    {...(activeDeckId === deck.id ? { [AUTOFOCUS_ATTRIBUTE]: true } : {})}
                    onClick={() => {
                      onSelect(deck.id)
                    }}
                  >
                    <span className={styles.name}>{deck.name}</span>
                    <span className={styles.count}>{t.decks.activeCount(activeCount(deck.id))}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.rowAction}
                    aria-label={t.decks.renameLabel(deck.name)}
                    onClick={() => {
                      startRename(deck)
                    }}
                  >
                    <Icon name="pencil" size={18} />
                    <span aria-hidden="true">{t.decks.rename}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.rowAction}
                    aria-label={t.decks.removeLabel(deck.name)}
                    disabled={isLast}
                    aria-describedby={isLast ? `${id}-last` : undefined}
                    onClick={() => {
                      setMode({ kind: 'confirm-remove', deckId: deck.id })
                      focusAfter.current = `[${AUTOFOCUS_ATTRIBUTE}]`
                    }}
                  >
                    <Icon name="trash" size={18} />
                    <span aria-hidden="true">{t.decks.remove}</span>
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {isLast && (
          <p id={`${id}-last`} className={form.hint}>
            {t.decks.lastDeck}
          </p>
        )}

        <form className={styles.createForm} noValidate onSubmit={submitCreate}>
          <div className={form.field}>
            <label htmlFor={`${id}-new`}>{t.decks.newDeckLabel}</label>
            <input
              id={`${id}-new`}
              value={newName}
              autoComplete="off"
              enterKeyHint="done"
              aria-invalid={createError !== null}
              aria-describedby={createError === null ? undefined : `${id}-new-error`}
              onChange={(event) => {
                setNewName(event.target.value)
              }}
            />
            {createError !== null && (
              <p id={`${id}-new-error`} className={form.error}>
                {createError}
              </p>
            )}
          </div>
          <button type="submit" className={form.primary}>
            <Icon name="plus" size={18} /> {t.decks.create}
          </button>
        </form>
      </div>
    </Sheet>
  )
}
