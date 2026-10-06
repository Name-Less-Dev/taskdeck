import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { ALARM_OPTIONS, type AlarmOption } from '../calendar/ics.ts'
import type { AppData } from '../domain/index.ts'
import type { InstallUi } from '../pwa/install.ts'
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
  readonly alarm: AlarmOption
  readonly onAlarmChange: (alarm: AlarmOption) => void
  /** Name of the active deck, or null in "All decks". */
  readonly activeDeckName: string | null
  /** Active tasks with a due date, in all decks and in the active deck. */
  readonly exportableAll: number
  readonly exportableActiveDeck: number
  readonly onExportCalendar: (activeDeckOnly: boolean) => void
  /** Install button (Chromium), iOS hint, or nothing (installed / unsupported). */
  readonly installUi: InstallUi
  readonly onInstall: () => void
  readonly onDismissInstallHint: () => void
  /** The service worker is active and the app shell is cached. */
  readonly offlineReady: boolean
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

/** Settings: language, app (offline, install), calendar, storage status, backup export and import. */
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
  alarm,
  onAlarmChange,
  activeDeckName,
  exportableAll,
  exportableActiveDeck,
  onExportCalendar,
  installUi,
  onInstall,
  onDismissInstallHint,
  offlineReady,
  onClose,
}: SettingsSheetProps) {
  const { locale, t } = useI18n()
  const id = useId()
  const [importState, setImportState] = useState<ImportState>({ kind: 'idle' })
  const [activeDeckOnly, setActiveDeckOnly] = useState(false)
  const onlyActiveDeck = activeDeckOnly && activeDeckName !== null
  const exportable = onlyActiveDeck ? exportableActiveDeck : exportableAll
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

        <section className={styles.section} aria-labelledby={`${id}-app`}>
          <h3 id={`${id}-app`} className={styles.heading}>
            {t.pwa.heading}
          </h3>
          <p className={form.hint} data-testid="offline-status">
            {offlineReady ? t.pwa.offlineReady : t.pwa.offlineNotReady}
          </p>
          {installUi === 'prompt' && (
            <button type="button" className={form.primary} onClick={onInstall}>
              {t.pwa.install}
            </button>
          )}
          {installUi === 'ios-hint' && (
            <div className={styles.installHint}>
              <p className={styles.installHintText}>{t.pwa.iosHint}</p>
              <button type="button" className={form.secondary} onClick={onDismissInstallHint}>
                {t.pwa.dismissHint}
              </button>
            </div>
          )}
        </section>

        <section className={styles.section} aria-labelledby={`${id}-calendar`}>
          <h3 id={`${id}-calendar`} className={styles.heading}>
            {t.calendar.heading}
          </h3>
          <div className={form.field}>
            <label htmlFor={`${id}-alarm`}>{t.calendar.alarmLabel}</label>
            <select
              id={`${id}-alarm`}
              value={alarm}
              onChange={(event) => {
                const next = ALARM_OPTIONS.find((option) => option === event.target.value)
                if (next !== undefined) onAlarmChange(next)
              }}
            >
              {ALARM_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t.calendar.alarms[option]}
                </option>
              ))}
            </select>
          </div>
          {activeDeckName !== null && (
            <label className={styles.option}>
              <input
                type="checkbox"
                checked={activeDeckOnly}
                onChange={(event) => {
                  setActiveDeckOnly(event.target.checked)
                }}
              />
              <span>
                {t.calendar.activeDeckOnly} ({activeDeckName})
              </span>
            </label>
          )}
          <p id={`${id}-exportable`} className={form.hint} data-testid="exportable-count">
            {exportable === 0 ? t.calendar.nothingToExport : t.calendar.exportable(exportable)}
          </p>
          <button
            type="button"
            className={form.primary}
            disabled={exportable === 0}
            aria-describedby={`${id}-exportable ${id}-calendar-limits`}
            onClick={() => {
              onExportCalendar(onlyActiveDeck)
            }}
          >
            {t.calendar.export}
          </button>
          <p id={`${id}-calendar-limits`} className={form.hint}>
            {t.calendar.limits}
          </p>
        </section>

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
