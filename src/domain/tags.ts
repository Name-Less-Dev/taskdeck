import { compareIds, compareNumbers } from './compare.ts'
import type { Task } from './schemas.ts'

export interface TagCount {
  readonly tag: string
  readonly count: number
}

/**
 * Every tag used by `tasks` with how many tasks carry it, most used first,
 * then alphabetical (code-unit order, independent of the runtime locale).
 */
export function collectTags(tasks: readonly Task[]): TagCount[] {
  const counts = new Map<string, number>()
  for (const task of tasks) {
    for (const tag of task.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => compareNumbers(b.count, a.count) || compareIds(a.tag, b.tag))
}

/** Tasks carrying `tag` (normalized like stored tags); null means no filter. Returns a new array. */
export function filterByTag(tasks: readonly Task[], tag: string | null): Task[] {
  if (tag === null) return [...tasks]
  const wanted = tag.trim().toLowerCase()
  return tasks.filter((task) => task.tags.includes(wanted))
}
