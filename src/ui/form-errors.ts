import type { ZodError } from 'zod'
import type { Dictionary } from '../i18n/dictionary.ts'

export type TaskFormField = 'title' | 'description' | 'date' | 'time'

/** One message per field; `form` holds anything that does not map to a field. */
export type TaskFormErrors = Partial<Record<TaskFormField | 'form', string>>

export const TASK_FORM_FIELDS: readonly TaskFormField[] = ['title', 'description', 'date', 'time']

/**
 * Translates the structured issues of a createTask ZodError into UI messages.
 * The domain never produces UI text; this is where codes become words.
 */
export function taskFormErrors(error: ZodError, t: Dictionary): TaskFormErrors {
  const errors: TaskFormErrors = {}
  const messages = t.form.errors

  for (const issue of error.issues) {
    const [first, second] = issue.path
    let field: TaskFormField | 'form'
    let message: string

    if (first === 'title') {
      field = 'title'
      message = issue.code === 'too_big' ? messages.titleTooLong(Number(issue.maximum)) : messages.titleRequired
    } else if (first === 'description' && issue.code === 'too_big') {
      field = 'description'
      message = messages.descriptionTooLong(Number(issue.maximum))
    } else if (first === 'due' && second === 'date') {
      field = 'date'
      message = messages.invalidDate
    } else if (first === 'due' && second === 'time') {
      field = 'time'
      message = messages.invalidTime
    } else {
      field = 'form'
      message = messages.generic
    }

    errors[field] ??= message
  }

  return errors
}
