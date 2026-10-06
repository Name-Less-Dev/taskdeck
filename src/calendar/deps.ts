// The calendar module's view of the domain (one import point keeps it obviously pure).
import { addToDayKey, type Due, type Priority, type Recurrence, type Task } from '../domain/index.ts'

export { addToDayKey }
export type { Due, Priority, Recurrence, Task }

/** Deterministic order (code units), independent of the runtime locale. */
export function compareTasksById(a: Task, b: Task): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
