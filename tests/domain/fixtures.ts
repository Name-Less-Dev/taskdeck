import { TaskSchema, type Task } from '../../src/domain/index.ts'

/** Fixed clock for every test: 5 Oct 2026, 10:00 local time. */
export const NOW = new Date(2026, 9, 5, 10, 0)

/** Local wall-clock instant as an ISO string (works in any TZ). */
export function localIso(year: number, monthIndex: number, day: number, hours = 0, minutes = 0): string {
  return new Date(year, monthIndex, day, hours, minutes).toISOString()
}

/** A valid active task; overrides are re-validated by the schema. */
export function makeTask(overrides: Partial<Task> = {}): Task {
  return TaskSchema.parse({
    id: 'task-1',
    deckId: 'deck-1',
    title: 'Task',
    description: '',
    tags: [],
    priority: 'medium',
    due: null,
    recurrence: null,
    status: 'active',
    createdAt: localIso(2026, 9, 1, 9, 0),
    completedAt: null,
    skippedAt: null,
    postponedDays: 0,
    ...overrides,
  })
}

/** Recursively freezes test input so any mutation throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}
