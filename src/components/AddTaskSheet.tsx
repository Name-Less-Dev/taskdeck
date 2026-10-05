import { useEffect, useId, useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react'
import { ZodError } from 'zod'
import { createTask, PRIORITIES, type Due, type Priority, type Task } from '../domain/index.ts'
import { useI18n } from '../i18n/index.tsx'
import { TASK_FORM_FIELDS, taskFormErrors, type TaskFormErrors, type TaskFormField } from '../ui/form-errors.ts'
import styles from './AddTaskSheet.module.css'
import { Icon } from './Icon.tsx'

export interface AddTaskSheetProps {
  readonly deckId: string
  readonly createId: () => string
  readonly onCreate: (task: Task) => void
  readonly onClose: () => void
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]'

interface FormValues {
  title: string
  description: string
  priority: Priority
  date: string
  time: string
}

const EMPTY: FormValues = { title: '', description: '', priority: 'medium', date: '', time: '' }

/**
 * Modal sheet to create a task. Validation is the domain's createTask: its
 * ZodError is mapped to per-field messages wired with aria-invalid and
 * aria-describedby. Escape or the backdrop closes it; Tab stays inside.
 */
export function AddTaskSheet({ deckId, createId, onCreate, onClose }: AddTaskSheetProps) {
  const { t } = useI18n()
  const id = useId()
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<TaskFormErrors>({})
  const dialogRef = useRef<HTMLDivElement>(null)
  const fieldRefs = useRef<Partial<Record<TaskFormField, HTMLInputElement | HTMLTextAreaElement | null>>>({})

  useEffect(() => {
    fieldRefs.current.title?.focus()
  }, [])

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const due: Due | null =
      values.date === '' ? null : values.time === '' ? { date: values.date } : { date: values.date, time: values.time }
    // A time alone is a UI-level mistake (the domain only sees due = null), so check it here.
    const uiErrors: TaskFormErrors =
      values.date === '' && values.time !== '' ? { time: t.form.errors.timeWithoutDate } : {}

    let task: Task | null = null
    let domainErrors: TaskFormErrors = {}
    try {
      task = createTask(
        { deckId, title: values.title, description: values.description, priority: values.priority, due },
        { id: createId(), now: new Date() },
      )
    } catch (error) {
      if (!(error instanceof ZodError)) throw error
      domainErrors = taskFormErrors(error, t)
    }

    const nextErrors = { ...domainErrors, ...uiErrors }
    setErrors(nextErrors)
    const firstInvalid = TASK_FORM_FIELDS.find((field) => nextErrors[field] !== undefined)
    if (firstInvalid !== undefined) {
      fieldRefs.current[firstInvalid]?.focus()
      return
    }
    if (task !== null && nextErrors.form === undefined) onCreate(task)
  }

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
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

  function errorFor(field: TaskFormField) {
    const message = errors[field]
    return message === undefined ? null : (
      <p id={`${id}-${field}-error`} className={styles.error}>
        {message}
      </p>
    )
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
        aria-labelledby={`${id}-heading`}
        onKeyDown={trapFocus}
      >
        <div className={styles.header}>
          <h2 id={`${id}-heading`} className={styles.heading}>
            {t.form.title}
          </h2>
          <button type="button" className={styles.close} aria-label={t.form.close} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <form className={styles.form} noValidate onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor={`${id}-title`}>{t.form.titleLabel}</label>
            <input
              {...fieldProps('title')}
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
              value={values.description}
              onChange={(event) => {
                update('description', event.target.value)
              }}
            />
            {errorFor('description')}
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
                type="time"
                value={values.time}
                onChange={(event) => {
                  update('time', event.target.value)
                }}
              />
              {errorFor('time')}
            </div>
          </div>

          {errors.form !== undefined && <p className={styles.error}>{errors.form}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={onClose}>
              {t.form.cancel}
            </button>
            <button type="submit" className={styles.primary}>
              {t.form.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
