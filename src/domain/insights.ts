import { compareIds, compareNumbers } from './compare.ts'
import type { Task } from './schemas.ts'

export const DEFAULT_PROCRASTINATION_THRESHOLD = 3

/**
 * Active tasks postponed on at least `threshold` different days,
 * most postponed first (ties broken by id).
 */
export function procrastinated(
  tasks: readonly Task[],
  threshold: number = DEFAULT_PROCRASTINATION_THRESHOLD,
): Task[] {
  return tasks
    .filter((task) => task.status === 'active' && task.postponedDays >= threshold)
    .sort((a, b) => compareNumbers(b.postponedDays, a.postponedDays) || compareIds(a.id, b.id))
}
