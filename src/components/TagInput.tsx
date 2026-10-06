import type { KeyboardEvent, Ref } from 'react'
import { MAX_TAGS, TAG_MAX_LENGTH } from '../domain/index.ts'
import { useI18n } from '../i18n/index.tsx'
import { isComposingKey } from '../ui/form-navigation.ts'
import { addTags, type TagInputError } from '../ui/tags.ts'
import { Icon } from './Icon.tsx'
import styles from './TagInput.module.css'
import { tagHue } from '../ui/theme.ts'

export interface TagInputProps {
  readonly id: string
  readonly tags: readonly string[]
  /** Text typed but not turned into a chip yet (the form adds it on submit). */
  readonly draft: string
  readonly onChange: (next: { tags: readonly string[]; draft: string }) => void
  readonly error?: string | undefined
  readonly errorId: string
  readonly hintId: string
  readonly inputRef?: Ref<HTMLInputElement>
  readonly onLocalError: (error: TagInputError | null) => void
}

/**
 * Tag chips. Enter or comma turns the typed text into a chip; Backspace in
 * the empty field removes the last chip; each chip has its own remove button.
 */
export function TagInput({ id, tags, draft, onChange, error, errorId, hintId, inputRef, onLocalError }: TagInputProps) {
  const { t } = useI18n()

  function commit(text: string) {
    const result = addTags(tags, text)
    onLocalError(result.error)
    onChange({ tags: result.tags, draft: '' })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (isComposingKey(event)) return
    if (event.key === ',' || (event.key === 'Enter' && draft.trim() !== '')) {
      // With text, Enter makes a chip (and must not submit the form). Empty, it
      // is left to the form, which moves on to the next field.
      event.preventDefault()
      if (draft.trim() !== '') commit(draft)
    } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
      event.preventDefault()
      onLocalError(null)
      onChange({ tags: tags.slice(0, -1), draft: '' })
    }
  }

  return (
    <div className={styles.wrapper}>
      {tags.length > 0 && (
        <ul className={styles.chips} aria-label={t.tags.label}>
          {tags.map((tag) => (
            <li key={tag} className={styles.chip} data-tag-hue={tagHue(tag)}>
              <span>#{tag}</span>
              <button
                type="button"
                className={styles.remove}
                aria-label={t.tags.removeLabel(tag)}
                onClick={() => {
                  onLocalError(null)
                  onChange({ tags: tags.filter((other) => other !== tag), draft })
                }}
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        id={id}
        className={styles.input}
        value={draft}
        autoComplete="off"
        autoCapitalize="none"
        enterKeyHint="next"
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? hintId : `${errorId} ${hintId}`}
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          const value = event.target.value
          // Pasting "casa, trabalho" adds both at once.
          if (value.includes(',')) commit(value)
          else onChange({ tags, draft: value })
        }}
      />
      <p id={hintId} className={styles.hint}>
        {t.tags.hint}
      </p>
    </div>
  )
}

/** UI message for an error raised while typing tags. */
export function tagInputMessage(error: TagInputError, t: ReturnType<typeof useI18n>['t']): string {
  return error === 'too-long' ? t.tags.errors.tooLong(TAG_MAX_LENGTH) : t.tags.errors.tooMany(MAX_TAGS)
}
