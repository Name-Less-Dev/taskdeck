import { useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react'
import styles from './App.module.css'
import { ActionBar } from './components/ActionBar.tsx'
import { DeckSheet } from './components/DeckSheet.tsx'
import { Deck } from './components/Deck.tsx'
import { EmptyState, emptyStateButton } from './components/EmptyState.tsx'
import { HowToSheet } from './components/HowToSheet.tsx'
import { Icon } from './components/Icon.tsx'
import { LiveRegion, type Announcement } from './components/LiveRegion.tsx'
import { ReminderToast } from './components/ReminderToast.tsx'
import { ScheduledSheet } from './components/ScheduledSheet.tsx'
import { SettingsSheet } from './components/SettingsSheet.tsx'
import { StorageBanner } from './components/StorageBanner.tsx'
import { TagFilterBar } from './components/TagFilterBar.tsx'
import { TOP_CARD_ATTRIBUTE } from './components/TaskCard.tsx'
import { TaskFormSheet } from './components/TaskFormSheet.tsx'
import { UndoToast, type ToastData } from './components/UndoToast.tsx'
import { UpdateToast } from './components/UpdateToast.tsx'
import { usePwa } from './pwa/context.ts'
import { decideInstallUi } from './pwa/install.ts'
import { shouldOfferUpdate } from './pwa/update.ts'
import { createDemoTasks } from './demo/seed.ts'
import { reportGesture, reportRender } from './dev/gestureDebug.ts'
import { ZodError } from 'zod'
import {
  availableTasks,
  canRedo,
  canUndo,
  collectTags,
  dailyProgress,
  dormantTasks,
  snoozedTasks,
  createDeck,
  filterByTag,
  getDueStatus,
  isAvailable,
  orderDeck,
  renameDeck,
  toDayKey,
  type AppData,
  type Task,
  type TaskPatch,
} from './domain/index.ts'
import { useI18n } from './i18n/index.tsx'
import { formatDueDate, formatDueStatus } from './ui/format.ts'
import type { Reminder } from './ui/reminders.ts'
import { useDueReminders } from './ui/useDueReminders.ts'
import { rolloverStep, type RolloverState } from './ui/rollover.ts'
import { createId as randomId } from './lib/id.ts'
import { createDeckState, deckReducer, type DeckAction } from './state/deckReducer.ts'
import {
  backupFileName,
  parseBackup,
  SCHEMA_VERSION,
  serializeBackup,
  type AppStorage,
  type Language,
  type Meta,
} from './storage/index.ts'
import { calendarBlob, downloadBlob, jsonBlob, type Download } from './ui/download.ts'
import { buildIcs, exportableCount, icsFileName, type AlarmOption } from './calendar/ics.ts'
import { deckNameError } from './ui/form-errors.ts'
import { EXIT_TIMEOUT_MS, exitReducer, IDLE, isExiting, type ExitEvent, type ExitState } from './ui/exitState.ts'
import type { SwipeAction } from './ui/gestures.ts'
import { useAutosave } from './ui/useAutosave.ts'
import { useNow } from './ui/useNow.ts'
import { useTheme } from './ui/useTheme.ts'
import type { Theme } from './ui/theme.ts'
import { browserPersistence, usePersistence, type PersistenceApi } from './ui/usePersistence.ts'

export interface AppProps {
  readonly initialData: AppData
  readonly initialMeta: Meta
  readonly storage: AppStorage
  /** "memory" when IndexedDB could not be opened: nothing survives a reload. */
  readonly storageMode: 'indexeddb' | 'memory'
  /** Nothing was ever saved: offer sample tasks or an empty start. */
  readonly firstRun?: boolean
  readonly quarantineTotal?: number
  readonly language: Language
  readonly onLanguageChange: (language: Language) => void
  /** ?lang= in the address overrides the stored language for now. */
  readonly languageForcedByUrl?: boolean
  /** Id factory for new tasks and decks (injectable for tests). */
  readonly createId?: () => string
  readonly persistence?: PersistenceApi
  readonly download?: Download
  /** ?help=1: open the how-to when the app loads (the only way it opens without a click). */
  readonly openHowToOnLoad?: boolean
}

type SheetKind = 'add' | 'edit' | 'decks' | 'settings' | 'scheduled' | 'howto'

// Toast and announcement keys per action (same names in both dictionary sections).
const MESSAGE_KEY = { complete: 'completed', postpone: 'postponed', remove: 'removed', snooze: 'snoozed' } as const

export default function App({
  initialData,
  initialMeta,
  storage,
  storageMode,
  firstRun: initialFirstRun = false,
  quarantineTotal = 0,
  language,
  onLanguageChange,
  languageForcedByUrl = false,
  createId = randomId,
  persistence = browserPersistence,
  download = downloadBlob,
  openHowToOnLoad = false,
}: AppProps) {
  const { locale, t } = useI18n()
  const [state, dispatch] = useReducer(deckReducer, initialData, createDeckState)
  const { decks, tasks: allTasks } = state.present
  const now = useNow()
  // Applies the saved theme and follows the system for "auto" (first paint: index.html).
  const [theme, setTheme] = useTheme()

  // UI state outside the undo history. activeDeckId is persisted in meta.
  const [activeDeckId, setActiveDeckId] = useState<string | null>(initialMeta.settings.activeDeckId)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(initialMeta.lastBackupAt)
  const [alarm, setAlarm] = useState<AlarmOption>(initialMeta.settings.alarm)
  const [installHintDismissed, setInstallHintDismissed] = useState(initialMeta.settings.installHintDismissed)
  const [tutorialSeen, setTutorialSeen] = useState(initialMeta.settings.tutorialSeen)
  const [firstRun, setFirstRun] = useState(initialFirstRun)
  // Tag filter: session only, never persisted.
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  // A deck can disappear (removed, undo, import): fall back to "all decks".
  const deckId = activeDeckId !== null && decks.some((deck) => deck.id === activeDeckId) ? activeDeckId : null

  const deckTasks = useMemo(
    () => (deckId === null ? allTasks : allTasks.filter((task) => task.deckId === deckId)),
    [allTasks, deckId],
  )
  // Only available cards are on the deck (isAvailable is the single visibility rule).
  const deckAvailable = useMemo(() => availableTasks(deckTasks, now), [deckTasks, now])
  const tagCounts = useMemo(() => collectTags(deckAvailable), [deckAvailable])
  const visibleTasks = useMemo(() => filterByTag(deckAvailable, activeTag), [deckAvailable, activeTag])
  const tasks = useMemo(() => orderDeck(visibleTasks, now), [visibleTasks, now])
  const progress = dailyProgress(deckTasks, now)
  const dormant = useMemo(() => dormantTasks(deckTasks, now), [deckTasks, now])
  const snoozed = useMemo(() => snoozedTasks(deckTasks, now), [deckTasks, now])
  // "Scheduled (N)": everything waiting for a later day (snoozed + recurring).
  const scheduledCount = dormant.length + snoozed.length
  const top = tasks[0] ?? null

  const meta = useMemo<Meta>(
    () => ({
      schemaVersion: SCHEMA_VERSION,
      settings: { activeDeckId: deckId, language, alarm, installHintDismissed, tutorialSeen },
      lastBackupAt,
    }),
    [deckId, language, alarm, installHintDismissed, tutorialSeen, lastBackupAt],
  )
  const autosave = useAutosave(storage, state.present, meta)
  const { state: persistenceState, requestOnce: requestPersistence } = usePersistence(
    persistence,
    storageMode === 'indexeddb',
  )

  // In-app reminders: every available task (all decks), as time passes; dormant cards never remind.
  const allAvailable = useMemo(() => availableTasks(allTasks, now), [allTasks, now])
  const { notice: reminderNotice, dismiss: dismissReminder } = useDueReminders(allAvailable, now)
  const reminderMessage = reminderNotice === null ? '' : reminderText(reminderNotice.reminder)

  function reminderText(reminder: Reminder): string {
    switch (reminder.kind) {
      case 'single':
        return reminder.band === 'overdue'
          ? t.reminders.overdue(reminder.task.title)
          : t.reminders.soon(reminder.task.title, formatDueStatus(getDueStatus(reminder.task.due, now), t))
      case 'group':
        return t.reminders.group(reminder.count)
      case 'away':
        return reminder.allOverdue ? t.reminders.awayOverdue(reminder.count) : t.reminders.awayMixed(reminder.count)
    }
  }

  const [flippedId, setFlippedId] = useState<string | null>(null)
  const [exitState, setExitState] = useState<ExitState>(IDLE)
  const exiting = isExiting(exitState) ? { id: exitState.id, action: exitState.action } : null
  const [toast, setToast] = useState<ToastData | null>(null)
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const messageCounter = useRef(0)
  const [sheet, setSheet] = useState<SheetKind | null>(openHowToOnLoad ? 'howto' : null)
  // The how-to opened from Settings goes back to Settings when it closes.
  const howToFromSettings = useRef(false)
  // Where focus goes when a sheet closes (the button that opened it), or the deck.
  const returnFocus = useRef<HTMLElement | null>(null)

  const regionRef = useRef<HTMLElement>(null)
  const [focusRequest, setFocusRequest] = useState(0)

  // After an action the card under focus is gone: move focus back to the deck.
  // Looked up in the DOM: the new top card may be an element that was already
  // mounted underneath, so a ref handed to it on promotion is not reliable.
  useEffect(() => {
    if (focusRequest === 0) return
    const opener = returnFocus.current
    returnFocus.current = null
    if (opener?.isConnected === true) {
      opener.focus()
      return
    }
    const region = regionRef.current
    const card = region?.querySelector<HTMLElement>(`[${TOP_CARD_ATTRIBUTE}]`)
    ;(card ?? region)?.focus()
  }, [focusRequest])

  // A new version waits for the user; never offered over an open sheet or form.
  const pwa = usePwa()
  const [updatePostponed, setUpdatePostponed] = useState(false)
  const offerUpdate = shouldOfferUpdate({ needRefresh: pwa.needRefresh, sheetOpen: sheet !== null, postponed: updatePostponed })
  const installUi = decideInstallUi({
    canPrompt: pwa.canPrompt,
    isIos: pwa.isIos,
    standalone: pwa.standalone,
    dismissed: installHintDismissed,
  })
  const updateAnnounced = useRef(false)
  useEffect(() => {
    if (!offerUpdate || updateAnnounced.current) return
    updateAnnounced.current = true
    messageCounter.current += 1
    setAnnouncement({ id: messageCounter.current, message: t.pwa.updateAvailable })
  }, [offerUpdate, t])

  // Day rollover: cards that wake up on a new day are announced once (never on load).
  // Time-driven announcements (rollover, reminders) from the same clock tick are
  // joined into one message: the live region only reads the latest one.
  const tickAnnouncement = useRef<{ tick: number; message: string } | null>(null)
  function announceOnTick(message: string) {
    const tick = now.getTime()
    const previous = tickAnnouncement.current
    const combined = previous?.tick === tick ? `${previous.message} ${message}` : message
    tickAnnouncement.current = { tick, message: combined }
    messageCounter.current += 1
    setAnnouncement({ id: messageCounter.current, message: combined })
  }

  const rollover = useRef<RolloverState | null>(null)
  useEffect(() => {
    const { state: next, appeared } = rolloverStep(rollover.current, deckTasks, now)
    rollover.current = next
    if (appeared > 0) announceOnTick(t.announce.newCards(appeared))
  }, [deckTasks, now, t])

  const announcedReminder = useRef(0)
  useEffect(() => {
    if (reminderNotice === null || reminderNotice.id === announcedReminder.current) return
    announcedReminder.current = reminderNotice.id
    announceOnTick(reminderMessage)
  }, [reminderNotice, reminderMessage])

  const busy = exiting !== null
  if (import.meta.env.DEV) {
    reportRender()
    reportGesture({ topId: top?.id ?? null, flippedId, exiting, busy })
  }
  const editingTask = allTasks.find((task) => task.id === editingId)
  const undoAvailable = canUndo(state) && !busy
  const redoAvailable = canRedo(state) && !busy
  const defaultDeckId = deckId ?? decks[0]?.id ?? ''
  const activeDeckName = decks.find((deck) => deck.id === deckId)?.name ?? t.decks.allDecks
  const deckNames = useMemo(
    // Only useful when cards from several decks are mixed.
    () => (deckId === null && decks.length > 1 ? new Map(decks.map((deck) => [deck.id, deck.name])) : undefined),
    [decks, deckId],
  )

  function announce(message: string) {
    messageCounter.current += 1
    setAnnouncement({ id: messageCounter.current, message })
  }

  /**
   * Dispatches and announces the result. The reducer is pure, so running it
   * here as well tells us whether the deck ends up empty without waiting for
   * the re-render.
   */
  function apply(action: DeckAction, message: string): boolean {
    const next = deckReducer(state, action)
    if (next === state) return false
    dispatch(action)
    // The deck shown after the action: the active one may have just been removed.
    const nextDeckId = deckId !== null && next.present.decks.some((deck) => deck.id === deckId) ? deckId : null
    const nextVisible =
      nextDeckId === null ? next.present.tasks : next.present.tasks.filter((task) => task.deckId === nextDeckId)
    const empty = filterByTag(availableTasks(nextVisible, action.now), activeTag).length === 0
    announce(empty ? `${message} ${t.announce.empty}` : message)
    setFlippedId(null)
    if (sheet === null) setFocusRequest((n) => n + 1)
    setFirstRun(false)
    requestPersistence()
    return true
  }

  /** Gestures, buttons and keys share this path: exit animation first, dispatch after. */
  function requestAction(action: SwipeAction) {
    handleExit({ type: 'request', topId: top?.id ?? null, action, at: performance.now() })
  }

  /** Every exit ends in a commit: animation finished, interrupted, or timed out. */
  function handleExit(event: ExitEvent) {
    const { state: next, commit } = exitReducer(exitState, event)
    if (next !== exitState) setExitState(next)
    if (commit === null) return
    const title = allTasks.find((task) => task.id === commit.id)?.title ?? ''
    const action = { type: commit.action, id: commit.id, now: new Date() }
    // A completed recurring task leaves the deck until its next day: say when it comes back.
    const after = deckReducer(state, action).present.tasks.find((task) => task.id === commit.id)
    if (commit.action === 'complete' && after?.status === 'active' && after.due !== null) {
      const date = formatDueDate(after.due, locale, t)
      apply(action, t.announce.completedUntil(title, date))
      showToast(t.toast.completedUntil(date))
      return
    }
    apply(action, t.announce[MESSAGE_KEY[commit.action]](title))
    showToast(t.toast[MESSAGE_KEY[commit.action]])
  }

  // Safety net: commit an exit whose animation never reports back (see exitState.ts).
  const handleExitRef = useRef(handleExit)
  useEffect(() => {
    handleExitRef.current = handleExit
  })
  useEffect(() => {
    if (!isExiting(exitState)) return
    const timer = setTimeout(() => {
      handleExitRef.current({ type: 'timeout', at: performance.now() })
    }, EXIT_TIMEOUT_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [exitState])

  function undoLast() {
    if (!undoAvailable) return
    apply({ type: 'undo', now: new Date() }, t.announce.undone)
    setToast(null)
  }

  function redoLast() {
    if (!redoAvailable) return
    apply({ type: 'redo', now: new Date() }, t.announce.redone)
    setToast(null)
  }

  function showToast(message: string, undoable = true) {
    setToast({ id: messageCounter.current, message, undoable })
  }

  function openSheet(kind: SheetKind, opener: HTMLElement | null) {
    returnFocus.current = opener
    setSheet(kind)
  }

  function closeSheet() {
    setSheet(null)
    setFocusRequest((n) => n + 1)
  }

  /** Only ever called from a click (or ?help=1 on load): never opened automatically. */
  function openHowTo(opener: HTMLElement | null, fromSettings: boolean) {
    howToFromSettings.current = fromSettings
    if (fromSettings) setSheet('howto')
    else openSheet('howto', opener)
  }

  /** Closing, skipping or finishing all mark the tutorial as seen. */
  function closeHowTo() {
    setTutorialSeen(true)
    if (howToFromSettings.current) {
      howToFromSettings.current = false
      // Back to Settings, where the "How to use" button gets focus again (first control).
      setSheet('settings')
      return
    }
    closeSheet()
  }

  function addTask(task: Task) {
    returnFocus.current = null
    apply({ type: 'add', task, now: new Date() }, t.announce.added(task.title))
    setSheet(null)
    setFocusRequest((n) => n + 1)
  }

  function selectDeck(id: string | null) {
    setActiveDeckId(id)
    setActiveTag(null)
    announce(t.announce.deckSelected(decks.find((deck) => deck.id === id)?.name ?? t.decks.allDecks))
    closeSheet()
  }

  /** Validates with the domain first so the sheet can show the error next to the field. */
  function addDeck(name: string): string | null {
    try {
      const deck = createDeck({ name }, { id: createId(), existing: decks })
      apply({ type: 'addDeck', deck, now: new Date() }, t.announce.deckCreated(deck.name))
      showToast(t.toast.deckCreated)
      return null
    } catch (error) {
      if (error instanceof ZodError) return deckNameError(error, t)
      throw error
    }
  }

  function renameDeckTo(id: string, name: string): string | null {
    const deck = decks.find((candidate) => candidate.id === id)
    if (deck === undefined) return null
    try {
      const renamed = renameDeck(deck, name, decks)
      if (renamed.name !== deck.name) {
        apply(
          { type: 'renameDeck', id, name: renamed.name, now: new Date() },
          t.announce.deckRenamed(deck.name, renamed.name),
        )
        showToast(t.toast.deckRenamed)
      }
      return null
    } catch (error) {
      if (error instanceof ZodError) return deckNameError(error, t)
      throw error
    }
  }

  function removeDeckById(id: string) {
    const deck = decks.find((candidate) => candidate.id === id)
    if (deck === undefined || decks.length <= 1) return
    const taskCount = allTasks.filter((task) => task.deckId === id).length
    apply({ type: 'removeDeck', id, now: new Date() }, t.announce.deckRemoved(deck.name, taskCount))
    showToast(t.toast.deckRemoved)
  }

  function loadSamples() {
    const now = new Date()
    const samples = createDemoTasks(now, { deckId: defaultDeckId, createId })
    apply(
      { type: 'replaceAll', data: { decks, tasks: [...allTasks, ...samples] }, now },
      t.announce.samplesLoaded(samples.length),
    )
  }

  function startEmpty() {
    setFirstRun(false)
    autosave.saveNow()
    setFocusRequest((n) => n + 1)
  }

  function openEdit() {
    if (top === null) return
    setEditingId(top.id)
    openSheet('edit', null)
  }

  /**
   * "Complete now" on a scheduled card, undoable: a recurring card moves on to
   * its next date; a snoozed one-off card is simply done.
   */
  function completeScheduled(id: string) {
    const task = allTasks.find((candidate) => candidate.id === id)
    if (task === undefined) return
    const action = { type: 'complete' as const, id, now: new Date() }
    const after = deckReducer(state, action).present.tasks.find((candidate) => candidate.id === id)
    if (after?.status === 'active' && after.due !== null) {
      const date = formatDueDate(after.due, locale, t)
      if (apply(action, t.announce.completedUntil(task.title, date))) showToast(t.toast.completedUntil(date))
      return
    }
    if (apply(action, t.announce.completed(task.title))) showToast(t.toast.completed)
  }

  /** "Bring back today" on a snoozed card, undoable. */
  function bringBack(id: string) {
    const task = allTasks.find((candidate) => candidate.id === id)
    if (task === undefined) return
    if (apply({ type: 'unsnooze', id, now: new Date() }, t.announce.broughtBack(task.title))) {
      showToast(t.toast.broughtBack)
    }
  }

  function removeScheduled(id: string) {
    const task = allTasks.find((candidate) => candidate.id === id)
    if (task === undefined) return
    if (apply({ type: 'remove', id, now: new Date() }, t.announce.removed(task.title))) showToast(t.toast.removed)
  }

  function editScheduled(id: string) {
    setEditingId(id)
    returnFocus.current = null
    setSheet('edit')
  }

  function updateTaskById(id: string, patch: TaskPatch) {
    const title = patch.title?.trim() ?? allTasks.find((task) => task.id === id)?.title ?? ''
    returnFocus.current = null
    if (apply({ type: 'updateTask', id, patch, now: new Date() }, t.announce.taskUpdated(title))) {
      showToast(t.toast.taskUpdated)
    }
    setSheet(null)
    setEditingId(null)
    setFocusRequest((n) => n + 1)
  }

  function toggleTag(tag: string | null) {
    setActiveTag(tag)
    if (tag === null) {
      announce(t.announce.tagFilterCleared)
    } else {
      const count = filterByTag(deckTasks, tag).filter((task) => isAvailable(task, now)).length
      announce(t.announce.tagFilter(tag, count))
    }
  }

  function exportBackup() {
    const now = new Date()
    download(jsonBlob(serializeBackup(state.present, { now })), backupFileName(now))
    setLastBackupAt(now.toISOString())
    announce(t.announce.exported)
  }

  function parseImport(text: string) {
    return parseBackup(text, {
      createId,
      names: { general: t.startup.generalDeck, recovered: t.startup.recoveredDeck },
    })
  }

  function importData(data: AppData) {
    returnFocus.current = null
    setSheet(null)
    setActiveTag(null)
    // apply() moves focus to the deck only when no sheet is open; it is closing.
    if (
      apply({ type: 'replaceAll', data, now: new Date() }, t.announce.imported(data.decks.length, data.tasks.length))
    ) {
      showToast(t.toast.imported)
    }
    setFocusRequest((n) => n + 1)
  }

  function changeTheme(next: Theme) {
    setTheme(next)
    announce(t.appearance.applied(t.appearance.themes[next]))
  }

  function changeLanguage(next: Language) {
    onLanguageChange(next)
    announce(t.announce.languageChanged)
  }

  /** Downloads an .ics with the given tasks (only active ones with a due date end up in it). */
  function exportCalendar(tasks: readonly Task[]) {
    const now = new Date()
    const text = buildIcs(tasks, {
      now,
      alarm,
      labels: {
        priority: t.priority.label,
        priorities: { low: t.priority.low, medium: t.priority.medium, high: t.priority.high },
        deck: t.decks.cardLabel,
        completionRecurrenceNote: t.calendar.completionNote,
        monthEndRecurrenceNote: t.calendar.monthEndNote,
      },
      deckName: (id) => decks.find((deck) => deck.id === id)?.name,
    })
    download(calendarBlob(text), icsFileName(toDayKey(now)))
    announce(`${t.calendar.exported(exportableCount(tasks))} ${t.calendar.downloaded}`)
    showToast(t.calendar.downloaded, false)
  }

  function toggleFlip() {
    if (top === null) return
    setFlippedId((current) => (current === top.id ? null : top.id))
  }

  function handleDeckKeyDown(event: KeyboardEvent<HTMLElement>) {
    const key = event.key.toLowerCase()
    const modifier = event.ctrlKey || event.metaKey

    if (modifier && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault()
      redoLast()
      return
    }
    if (modifier && key === 'z') {
      event.preventDefault()
      undoLast()
      return
    }
    if (modifier || event.altKey) return

    switch (event.key) {
      case 'Enter':
      case ' ':
        // Only the card itself flips; Enter on another control keeps its meaning.
        if (!(event.target instanceof HTMLElement) || !event.target.hasAttribute(TOP_CARD_ATTRIBUTE)) return
        event.preventDefault()
        toggleFlip()
        return
      case 'e':
      case 'E':
        if (!(event.target instanceof HTMLElement) || !event.target.hasAttribute(TOP_CARD_ATTRIBUTE)) return
        event.preventDefault()
        openEdit()
        return
      case 'ArrowRight':
        event.preventDefault()
        requestAction('complete')
        return
      case 'ArrowLeft':
        event.preventDefault()
        requestAction('postpone')
        return
      case 'ArrowDown':
        event.preventDefault()
        requestAction('snooze')
        return
      case 'Delete':
      case 'Backspace':
        event.preventDefault()
        requestAction('remove')
        return
    }
  }

  const emptyState =
    firstRun && allTasks.length === 0 ? (
      <EmptyState title={t.firstRun.title} body={t.firstRun.body} icon="plus">
        <button type="button" className={emptyStateButton.primary} onClick={loadSamples}>
          {t.firstRun.loadSamples}
        </button>
        <button type="button" className={emptyStateButton.secondary} onClick={startEmpty}>
          {t.firstRun.startEmpty}
        </button>
        {!tutorialSeen && (
          <button
            type="button"
            className={emptyStateButton.link}
            aria-haspopup="dialog"
            onClick={(event) => {
              openHowTo(event.currentTarget, false)
            }}
          >
            {t.howTo.firstRunLink}
          </button>
        )}
      </EmptyState>
    ) : activeTag === null && tasks.length === 0 && snoozed.length > 0 ? (
      // Honest: cards were left for tomorrow, so this is not "all done".
      <EmptyState title={t.day.snoozedTitle} body={t.day.snoozedBody(snoozed.length)} icon="moon">
        <button
          type="button"
          className={emptyStateButton.secondary}
          aria-haspopup="dialog"
          onClick={(event) => {
            openSheet('scheduled', event.currentTarget)
          }}
        >
          {t.day.seeScheduled}
        </button>
      </EmptyState>
    ) : activeTag === null && tasks.length === 0 && (progress.done > 0 || dormant.length > 0) ? (
      <EmptyState title={t.day.doneTitle} body={t.day.doneBody} icon="check" celebrate={progress.done > 0}>
        {dormant.length > 0 && (
          <button
            type="button"
            className={emptyStateButton.secondary}
            aria-haspopup="dialog"
            onClick={(event) => {
              openSheet('scheduled', event.currentTarget)
            }}
          >
            {t.day.upcoming(dormant.length)}
          </button>
        )}
      </EmptyState>
    ) : activeTag === null && tasks.length === 0 && !firstRun ? (
      <EmptyState title={t.day.nothingTitle} body={t.day.nothingBody} icon="calendar" />
    ) : activeTag !== null ? (
      <EmptyState title={t.tags.emptyTitle(activeTag)} body={t.tags.emptyBody} icon="folder">
        <button
          type="button"
          className={emptyStateButton.primary}
          onClick={() => {
            toggleTag(null)
          }}
        >
          {t.tags.clearFilter}
        </button>
      </EmptyState>
    ) : undefined

  return (
    <>
      <div className={styles.shell} inert={sheet !== null}>
        <header className={styles.header}>
          <h1 className="visually-hidden">{t.app.name}</h1>
          <button
            type="button"
            className={styles.deckSwitcher}
            aria-haspopup="dialog"
            aria-label={`${t.decks.switcherPrefix} ${activeDeckName}`}
            onClick={(event) => {
              openSheet('decks', event.currentTarget)
            }}
          >
            <span className={styles.deckName}>{activeDeckName}</span>
            <Icon name="chevron" size={18} />
          </button>
          <div className={styles.history} role="group" aria-label={t.app.historyLabel}>
            <button type="button" className={styles.headerButton} disabled={!undoAvailable} onClick={undoLast}>
              <Icon name="undo" size={18} />
              <span>{t.actions.undo}</span>
            </button>
            <button type="button" className={styles.headerButton} disabled={!redoAvailable} onClick={redoLast}>
              <Icon name="redo" size={18} />
              <span>{t.actions.redo}</span>
            </button>
          </div>
          <button
            type="button"
            className={styles.headerButton}
            aria-haspopup="dialog"
            aria-label={t.settings.open}
            onClick={(event) => {
              openSheet('settings', event.currentTarget)
            }}
          >
            <Icon name="settings" size={20} />
          </button>
          <div className={styles.dayBar}>
            <p className={styles.progress} data-testid="daily-progress">
              {t.progress.today(progress.done, progress.done + progress.remaining)}
            </p>
            {scheduledCount > 0 && (
              <button
                type="button"
                className={styles.scheduledButton}
                aria-haspopup="dialog"
                aria-label={t.scheduled.openLabel(scheduledCount)}
                onClick={(event) => {
                  openSheet('scheduled', event.currentTarget)
                }}
              >
                <Icon name="calendar" size={16} />
                <span aria-hidden="true">{t.scheduled.open(scheduledCount)}</span>
              </button>
            )}
          </div>
          <button
            type="button"
            className={styles.addButton}
            aria-haspopup="dialog"
            onClick={() => {
              openSheet('add', null)
            }}
          >
            <Icon name="plus" size={20} />
            <span>{t.actions.add}</span>
          </button>
        </header>

        <TagFilterBar counts={tagCounts} activeTag={activeTag} onToggle={toggleTag} />

        <StorageBanner
          memoryMode={storageMode === 'memory'}
          saveFailed={autosave.saveFailed}
          onRetry={autosave.retry}
        />

        <main className={styles.main}>
          <Deck
            tasks={tasks}
            now={now}
            flippedId={flippedId}
            exiting={exiting}
            onFlip={toggleFlip}
            onRequestAction={requestAction}
            onExited={(id) => {
              handleExit({ type: 'finished', id })
            }}
            onExitInterrupted={(id) => {
              handleExit({ type: 'interrupted', id })
            }}
            onKeyDown={handleDeckKeyDown}
            regionRef={regionRef}
            emptyState={emptyState}
            onEdit={openEdit}
            onAddToCalendar={() => {
              if (top !== null) exportCalendar([top])
            }}
            {...(deckNames === undefined ? {} : { deckNames })}
          />
        </main>

        <ActionBar disabled={top === null || busy} onAction={requestAction} />
      </div>
      <UndoToast
        toast={toast}
        onUndo={undoLast}
        placement={sheet === null ? 'bottom' : 'top'}
        onDismiss={() => {
          setToast(null)
        }}
      />
      <ReminderToast
        id={reminderNotice?.id ?? null}
        message={reminderMessage}
        tone={
          reminderNotice?.reminder.kind === 'single' && reminderNotice.reminder.band === 'soon' ? 'warning' : 'danger'
        }
        onDismiss={dismissReminder}
      />
      <UpdateToast
        visible={offerUpdate}
        onUpdate={pwa.update}
        onLater={() => {
          setUpdatePostponed(true)
        }}
      />
      <LiveRegion announcement={announcement} />
      {(sheet === 'add' || sheet === 'edit') && (
        <TaskFormSheet
          key={sheet === 'edit' ? (editingId ?? 'edit') : 'add'}
          decks={decks}
          defaultDeckId={defaultDeckId}
          {...(sheet === 'edit' && editingTask !== undefined ? { task: editingTask } : {})}
          createId={createId}
          onCreate={addTask}
          onUpdate={updateTaskById}
          onClose={() => {
            setEditingId(null)
            closeSheet()
          }}
        />
      )}
      {sheet === 'settings' && (
        <SettingsSheet
          language={language}
          languageForcedByUrl={languageForcedByUrl}
          onLanguageChange={changeLanguage}
          storageMode={storageMode}
          persistence={persistenceState}
          lastBackupAt={lastBackupAt}
          quarantineTotal={quarantineTotal}
          recoveredDeckName={t.startup.recoveredDeck}
          generalDeckName={t.startup.generalDeck}
          onExport={exportBackup}
          parseImport={parseImport}
          onImport={importData}
          alarm={alarm}
          onAlarmChange={setAlarm}
          activeDeckName={decks.find((deck) => deck.id === deckId)?.name ?? null}
          exportableAll={exportableCount(allTasks)}
          exportableActiveDeck={exportableCount(deckTasks)}
          onExportCalendar={(activeDeckOnly) => {
            exportCalendar(activeDeckOnly ? deckTasks : allTasks)
          }}
          installUi={installUi}
          onInstall={pwa.install}
          onDismissInstallHint={() => {
            setInstallHintDismissed(true)
          }}
          offlineReady={pwa.offlineReady}
          theme={theme}
          onThemeChange={changeTheme}
          onOpenHowTo={() => {
            openHowTo(null, true)
          }}
          onClose={closeSheet}
        />
      )}
      {sheet === 'scheduled' && (
        <ScheduledSheet
          snoozed={snoozed}
          dormant={dormant}
          onBringBack={bringBack}
          deckNames={new Map(decks.map((deck) => [deck.id, deck.name]))}
          onCompleteNow={completeScheduled}
          onEdit={editScheduled}
          onRemove={removeScheduled}
          onClose={closeSheet}
        />
      )}
      {sheet === 'howto' && <HowToSheet onClose={closeHowTo} />}
      {sheet === 'decks' && (
        <DeckSheet
          decks={decks}
          tasks={allTasks}
          activeDeckId={deckId}
          onSelect={selectDeck}
          onCreate={addDeck}
          onRename={renameDeckTo}
          onRemove={removeDeckById}
          onClose={closeSheet}
        />
      )}
    </>
  )
}
