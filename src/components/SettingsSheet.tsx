import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import type { AppData } from '../domain/index.ts'
import { useI18n, type Dictionary } from '../i18n/index.tsx'
import type { BackupError, BackupWarning, Language, ParseBackupResult, PersistenceState } from '../storage/index.ts'
import form from './Form.module.css'
import styles from './SettingsSheet.module.css'
import { Sheet } from './Sheet.tsx'

export interface SettingsSheetProps {
  readonly language: Language
  /** ?lang= in the address overrides the stored choice for now. */
  readonly languageForcedByUrl: boolean
  readonly onLanguageChange: (language: Language) => void
  readonly storageMode: 'indexeddb' | 'memory'
  /** null while the browser has not answered yet. */
  readonly persistence: PersistenceState | null
  readonly lastBackupAt: string | null
  readonly quarantineTotal: number
  /** Names used for decks the import may have to create (for the warnings). */
  readonly recoveredDeckName: string
  readonly generalDeckName: string
  readonly onExport: () => void
  readonly parseImport: (text: string) => ParseBackupResult
  readonly onImport: (data: AppData) => void
  readonly onClose: () => void
}

type ImportState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'review'; readonly data: AppData; readonly warnings: readonly BackupWarning[] }

export function backupErrorMessage(error: BackupError, t: Dictionary): string {
  const messages = t.settings.errors
  switch (error.kind) {
    case 'invalid-json':
      return messages.invalidJson
    case 'wrong-format':
      return messages.wrongFormat
    case 'newer-version':
      return messages.newerVersion(error.version)
    case 'missing-migration':
      return messages.missingMigration(error.version)
    case 'schema':
      return messages.schema(error.path)
    case 'duplicate-ids':
      return messages.duplicateIds(error.entity, error.ids.join(', '))
  }
}

const LANGUAGE_OPTIONS: readonly { value: Language; label: (t: Dictionary) => string }[] = [
  { value: 'auto', label: (t) => t.settings.languageAuto },
  { value: 'pt-BR', label: (t) => t.settings.languagePt },
  { value: 'en', label: (t) => t.settings.languageEn },
]

/** Settings: language, storage status, backup export and import. */
export function SettingsSheet({
  language,
  languageForcedByUrl,
  onLanguageChange,
  storageMode,
  persistence,
  lastBackupAt,
  quarantineTotal,
  recoveredDeckName,
  generalDeckName,
  onExport,
  parseImport,
  onImport,
  onClose,
}: SettingsSheetProps) {
  const { locale, t } = useI18n()
  const id = useId()
  const [importState, setImportState] = useState<ImportState>({ kind: 'idle' })
  const reviewCancelRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (importState.kind === 'review') reviewCancelRef.current?.focus()
  }, [importState.kind])

  const persistentText =
    persistence === null
      ? t.settings.persistentChecking
      : !persistence.supported
        ? t.settings.persistentUnavailable
        : persistence.persisted
          ? t.settings.persistentYes
          : t.settings.persistentNo

  const lastBackupText =
    lastBackupAt === null
      ? t.settings.never
      : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lastBackupAt))

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (file === undefined) return
    let text: string
    try {
      text = await file.text()
    } catch {
      setImportState({ kind: 'error', message: t.settings.errors.unreadable })
      return
    } finally {
      // Allow choosing the same file again.
      input.value = ''
    }
    const result = parseImport(text)
    setImportState(
      result.ok
        ? { kind: 'review', data: result.data, warnings: result.warnings }
        : { kind: 'error', message: backupErrorMessage(result.error, t) },
    )
  }

  function warningText(warning: BackupWarning): string {
    return warning.kind === 'orphans-recovered'
      ? t.settings.orphansRecovered(warning.count, recoveredDeckName)
      : t.settings.defaultDeckCreated(generalDeckName)
  }

  return (
    <Sheet title={t.settings.title} onClose={onClose}>
      <div className={styles.body}>
        <fieldset className={styles.section}>
          <legend className={styles.heading}>{t.settings.languageLegend}</legend>
          <div className={styles.options}>
            {LANGUAGE_OPTIONS.map((option) => (
              <label key={option.value} className={styles.option}>
                <input
                  type="radio"
                  name={`${id}-language`}
                  value={option.value}
                  checked={language === option.value}
                  onChange={() => {
                    onLanguageChange(option.value)
                  }}
                />
                <span>{option.label(t)}</span>
              </label>
            ))}
          </div>
          {languageForcedByUrl && <p className={form.hint}>{t.settings.languageForcedByUrl}</p>}
        </fieldset>

        <section className={styles.section} aria-labelledby={`${id}-storage`}>
          <h3 id={`${id}-storage`} className={styles.heading}>
            {t.settings.storageHeading}
          </h3>
          {storageMode === 'memory' && (
            <p className={styles.warning} role="note">
              {t.settings.memoryMode}
            </p>
          )}
          <dl className={styles.facts}>
            <dt>{t.settings.persistentLabel}</dt>
            <dd data-testid="persistent-status">{persistentText}</dd>
            <dt>{t.settings.lastBackupLabel}</dt>
            <dd data-testid="last-backup">{lastBackupText}</dd>
          </dl>
          <p className={form.hint}>{t.settings.backupAdvice}</p>
          {quarantineTotal > 0 && <p className={styles.warning}>{t.settings.quarantine(quarantineTotal)}</p>}

          <div className={styles.backupActions}>
            <button type="button" className={form.primary} onClick={onExport}>
              {t.settings.export}
            </button>
            <div className={form.field}>
              <label htmlFor={`${id}-import`}>{t.settings.importLabel}</label>
              <input
                ref={fileRef}
                id={`${id}-import`}
                type="file"
                accept=".json,application/json"
                className={styles.file}
                onChange={(event) => {
                  void handleFile(event)
                }}
              />
            </div>
          </div>

          {importState.kind === 'error' && (
            <p className={form.error} role="alert">
              {importState.message}
            </p>
          )}

          {importState.kind === 'review' && (
            <div className={styles.review} role="group" aria-labelledby={`${id}-summary`}>
              <p id={`${id}-summary`} className={styles.summary}>
                {t.settings.importSummary(importState.data.decks.length, importState.data.tasks.length)}
              </p>
              {importState.warnings.length > 0 && (
                <ul className={styles.warnings}>
                  {importState.warnings.map((warning) => (
                    <li key={warning.kind}>{warningText(warning)}</li>
                  ))}
                </ul>
              )}
              <p>{t.settings.importConfirm}</p>
              <div className={form.actions}>
                <button
                  ref={reviewCancelRef}
                  type="button"
                  className={form.secondary}
                  onClick={() => {
                    setImportState({ kind: 'idle' })
                    fileRef.current?.focus()
                  }}
                >
                  {t.settings.importCancel}
                </button>
                <button
                  type="button"
                  className={form.danger}
                  onClick={() => {
                    onImport(importState.data)
                  }}
                >
                  {t.settings.importReplace}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </Sheet>
  )
}
