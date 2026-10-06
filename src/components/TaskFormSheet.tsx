import { useId, useRef, useState, type SubmitEvent } from 'react'
import { ZodError } from 'zod'
import {
  createTask,
  PRIORITIES,
  RECURRENCE_ANCHORS,
  RECURRENCE_UNITS,
  updateTask,
  type Deck,
  type Due,
  type Priority,
  type Recurrence,
  type RecurrenceInput,
  type Task,
  type TaskPatch,
} from '../domain/index.ts'
import { useI18n } from '../i18n/index.tsx'
import { TASK_FORM_FIELDS, taskFormErrors, type TaskFormErrors, type TaskFormField } from '../ui/form-errors.ts'
import { handleFormEnter, SUBMIT_ON_ENTER_ATTRIBUTE } from '../ui/form-navigation.ts'
import { addTags, type TagInputError } from '../ui/tags.ts'
import styles from './Form.module.css'
import { AUTOFOCUS_ATTRIBUTE, Sheet } from './Sheet.tsx'
import { TagInput, tagInputMessage } from './TagInput.tsx'

export interface TaskFormSheetProps {
  readonly decks: readonly Deck[]
  /** Deck preselected when creating (active deck, or the first one). */
  readonly defaultDeckId: string
  /** When given, the sheet edits this task instead of creating one. */
  readonly task?: Task
  readonly createId: () => string
  readonly onCreate: (task: Task) => void
  readonly onUpdate: (id: string, patch: TaskPatch) => void
  readonly onClose: () => void
}

interface FormValues {
  title: string
  description: string
  priority: Priority
  date: string
  time: string
  deckId: string
  tags: string[]
  tagDraft: string
  repeat: boolean
  /** Kept as typed text so the field can hold an invalid value and show an error. */
  every: string
  unit: Recurrence['unit']
  anchor: Recurrence['anchor']
}

function initialValues(task: Task | undefined, deckId: string): FormValues {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? 'medium',
    date: task?.due?.date ?? '',
    time: task?.due?.time ?? '',
    deckId: task?.deckId ?? deckId,
    tags: [...(task?.tags ?? [])],
    tagDraft: '',
    repeat: task?.recurrence != null,
    every: String(task?.recurrence?.every ?? 1),
    unit: task?.recurrence?.unit ?? 'week',
    anchor: task?.recurrence?.anchor ?? 'due',
  }
}

/**
 * Create or edit a task. Validation is the domain's: createTask for a new
 * task, updateTask for an edit (counters are preserved; the recurrence is
 * set, changed or removed through the "Repeat" block).
 * ZodErrors become per-field messages wired with aria-invalid and
 * aria-describedby; focus moves to the first invalid field.
 */
export function TaskFormSheet({
  decks,
  defaultDeckId,
  task,
  createId,
  onCreate,
  onUpdate,
  onClose,
}: TaskFormSheetProps) {
  const { t } = useI18n()
  const id = useId()
  const [values, setValues] = useState<FormValues>(() => initialValues(task, defaultDeckId))
  const [errors, setErrors] = useState<TaskFormErrors>({})
  const [tagError, setTagError] = useState<TagInputError | null>(null)
  const fieldRefs = useRef<Partial<Record<TaskFormField, HTMLInputElement | HTMLTextAreaElement | null>>>({})
  const editing = task !== undefined

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    // Text still in the tag field counts as a tag.
    const pending = addTags(values.tags, values.tagDraft)
    const due: Due | null =
      values.date === '' ? null : values.time === '' ? { date: values.date } : { date: values.date, time: values.time }
    // A time alone is a UI-level mistake (the domain only sees due = null), so check it here.
    const every = Number(values.every)
    const everyValid = values.every.trim() !== '' && Number.isInteger(every) && every >= 1
    const recurrence: RecurrenceInput | null =
      values.repeat && everyValid ? { unit: values.unit, every, anchor: values.anchor } : null
    const uiErrors: TaskFormErrors = {
      ...(values.date === '' && values.time !== '' ? { time: t.form.errors.timeWithoutDate } : {}),
      ...(pending.error === null ? {} : { tags: tagInputMessage(pending.error, t) }),
      ...(values.repeat && due === null ? { date: t.form.errors.recurrenceNeedsDue } : {}),
      ...(values.repeat && !everyValid ? { every: t.repeat.everyInvalid } : {}),
    }
    const fields = {
      deckId: values.deckId,
      title: values.title,
      description: values.description,
      tags: pending.tags,
      priority: values.priority,
      due,
      // An invalid interval is reported by the UI; the domain only sees valid recurrences.
      ...(values.repeat && !everyValid ? {} : { recurrence }),
    } satisfies TaskPatch

    let created: Task | null = null
    let domainErrors: TaskFormErrors = {}
    try {
      if (editing) updateTask(task, fields)
      else created = createTask(fields, { id: createId(), now: new Date() })
    } catch (error) {
      if (!(error instanceof ZodError)) throw error
      domainErrors = taskFormErrors(error, t)
    }

    const nextErrors = { ...domainErrors, ...uiErrors }
    setErrors(nextErrors)
    setTagError(null)
    setValues((current) => ({
      ...current,
      tags: pending.tags,
      tagDraft: pending.error === null ? '' : current.tagDraft,
    }))
    const firstInvalid = TASK_FORM_FIELDS.find((field) => nextErrors[field] !== undefined)
    if (firstInvalid !== undefined) {
      fieldRefs.current[firstInvalid]?.focus()
      return
    }
    if (nextErrors.form !== undefined) return
    if (editing) onUpdate(task.id, fields)
    else if (created !== null) onCreate(created)
  }

  function fieldProps(field: TaskFormField) {
    const message = errors[field]
    return {
      id: `${id}-${field}`,
      'aria-invalid': message !== undefined,
      'aria-describedby': message === undefined ? undefined : `${id}-${field}-error`,
      ref: (element: HTMLInputElement | HTMLTextAreaElement | null) => {
        fieldRefs.current[field] = element
      },
    }
  }

  function errorFor(field: TaskFormField, override?: string) {
    const message = override ?? errors[field]
    return message === undefined ? null : (
      <p id={`${id}-${field}-error`} className={styles.error}>
        {message}
      </p>
    )
  }

  const tagMessage = tagError === null ? errors.tags : tagInputMessage(tagError, t)

  return (
    <Sheet title={editing ? t.form.editTitle : t.form.title} onClose={onClose}>
      <form className={styles.form} noValidate onSubmit={handleSubmit} onKeyDown={handleFormEnter}>
        <div className={styles.field}>
          <label htmlFor={`${id}-title`}>{t.form.titleLabel}</label>
          <input
            {...fieldProps('title')}
            {...{ [AUTOFOCUS_ATTRIBUTE]: true }}
            type="text"
            autoComplete="off"
            aria-required="true"
            enterKeyHint="next"
            value={values.title}
            onChange={(event) => {
              update('title', event.target.value)
            }}
          />
          {errorFor('title')}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-description`}>
            {t.form.descriptionLabel} <span className={styles.optional}>{t.form.optional}</span>
          </label>
          <textarea
            {...fieldProps('description')}
            rows={3}
            enterKeyHint="enter"
            value={values.description}
            onChange={(event) => {
              update('description', event.target.value)
            }}
          />
          {errorFor('description')}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-deck`}>{t.form.deckLabel}</label>
          <select
            id={`${id}-deck`}
            value={values.deckId}
            onChange={(event) => {
              update('deckId', event.target.value)
            }}
          >
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-tags`}>
            {t.tags.label} <span className={styles.optional}>{t.form.optional}</span>
          </label>
          <TagInput
            id={`${id}-tags`}
            tags={values.tags}
            draft={values.tagDraft}
            error={tagMessage}
            errorId={`${id}-tags-error`}
            hintId={`${id}-tags-hint`}
            inputRef={(element) => {
              fieldRefs.current.tags = element
            }}
            onLocalError={setTagError}
            onChange={({ tags, draft }) => {
              setValues((current) => ({ ...current, tags: [...tags], tagDraft: draft }))
            }}
          />
          {errorFor('tags', tagMessage)}
        </div>

        <fieldset className={styles.priority}>
          <legend>{t.form.priorityLabel}</legend>
          <div className={styles.segments}>
            {PRIORITIES.map((priority) => (
              <label key={priority} className={styles.segment}>
                <input
                  type="radio"
                  name={`${id}-priority`}
                  value={priority}
                  checked={values.priority === priority}
                  onChange={() => {
                    update('priority', priority)
                  }}
                />
                <span>{t.priority[priority]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor={`${id}-date`}>
              {t.form.dateLabel} <span className={styles.optional}>{t.form.optional}</span>
            </label>
            <input
              {...fieldProps('date')}
              type="date"
              enterKeyHint="next"
              value={values.date}
              onChange={(event) => {
                update('date', event.target.value)
              }}
            />
            {errorFor('date')}
          </div>
          <div className={styles.field}>
            <label htmlFor={`${id}-time`}>
              {t.form.timeLabel} <span className={styles.optional}>{t.form.optional}</span>
            </label>
            <input
              {...fieldProps('time')}
              {...(values.repeat ? {} : { [SUBMIT_ON_ENTER_ATTRIBUTE]: true })}
              type="time"
              enterKeyHint={values.repeat ? 'next' : 'done'}
              value={values.time}
              onChange={(event) => {
                update('time', event.target.value)
              }}
            />
            {errorFor('time')}
          </div>
        </div>

        <fieldset className={styles.repeat}>
          <legend className="visually-hidden">{t.repeat.legend}</legend>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={values.repeat}
              onChange={(event) => {
                update('repeat', event.target.checked)
              }}
            />
            <span>{t.repeat.toggle}</span>
          </label>

          {values.repeat && (
            <>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor={`${id}-every`}>{t.repeat.everyLabel}</label>
                  <input
                    {...fieldProps('every')}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    enterKeyHint="next"
                    value={values.every}
                    onChange={(event) => {
                      update('every', event.target.value)
                    }}
                  />
                  {errorFor('every')}
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${id}-unit`}>{t.repeat.unitLabel}</label>
                  <select
                    id={`${id}-unit`}
                    value={values.unit}
                    onChange={(event) => {
                      const unit = RECURRENCE_UNITS.find((candidate) => candidate === event.target.value)
                      if (unit !== undefined) update('unit', unit)
                    }}
                  >
                    {RECURRENCE_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {t.repeat.units[unit](Number(values.every) || 1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <fieldset className={styles.anchors}>
                <legend>{t.repeat.anchorLegend}</legend>
                {RECURRENCE_ANCHORS.map((anchor) => (
                  <label key={anchor} className={styles.anchor}>
                    <input
                      type="radio"
                      name={`${id}-anchor`}
                      value={anchor}
                      checked={values.anchor === anchor}
                      aria-describedby={`${id}-anchor-${anchor}`}
                      enterKeyHint="done"
                      {...{ [SUBMIT_ON_ENTER_ATTRIBUTE]: true }}
                      onChange={() => {
                        update('anchor', anchor)
                      }}
                    />
                    <span>
                      <span className={styles.anchorName}>
                        {anchor === 'due' ? t.repeat.anchorDue : t.repeat.anchorCompletion}
                      </span>
                      <span id={`${id}-anchor-${anchor}`} className={styles.hint}>
                        {anchor === 'due' ? t.repeat.anchorDueHint : t.repeat.anchorCompletionHint}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
        </fieldset>

        {errors.form !== undefined && <p className={styles.error}>{errors.form}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t.form.cancel}
          </button>
          <button type="submit" className={styles.primary}>
            {editing ? t.form.saveChanges : t.form.save}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
