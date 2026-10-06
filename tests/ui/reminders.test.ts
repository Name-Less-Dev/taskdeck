import { describe, expect, it } from 'vitest'
import { completeTask, updateTask, type Task } from '../../src/domain/index.ts'
import { INITIAL_REMINDERS, reminderStep, type Reminder, type ReminderState } from '../../src/ui/reminders.ts'
import { makeTask } from '../domain/fixtures.ts'

const at = (hours: number, minutes = 0, day = 5) => new Date(2026, 9, day, hours, minutes)

const meeting = makeTask({ id: 'meeting', title: 'Reunião', due: { date: '2026-10-05', time: '12:00' } })
const call = makeTask({ id: 'call', title: 'Ligação', due: { date: '2026-10-05', time: '12:00' } })
const report = makeTask({ id: 'report', title: 'Relatório', due: { date: '2026-10-05' } })

/** Runs steps in order and returns every reminder produced (null when none). */
function run(steps: readonly [readonly Task[], Date, boolean][], start: ReminderState = INITIAL_REMINDERS) {
  let state = start
  const reminders: (Reminder | null)[] = []
  for (const [tasks, now, visible] of steps) {
    const result = reminderStep(state, tasks, now, visible)
    state = result.state
    reminders.push(result.reminder)
  }
  return reminders
}

function describeReminder(reminder: Reminder | null): string | null {
  if (reminder === null) return null
  switch (reminder.kind) {
    case 'single':
      return `${reminder.task.id}:${reminder.band}`
    case 'group':
      return `group:${String(reminder.count)}`
    case 'away':
      return `away:${String(reminder.count)}:${reminder.allOverdue ? 'overdue' : 'mixed'}`
  }
}

describe('reminderStep', () => {
  it('says nothing on the initial load, even for tasks already overdue', () => {
    expect(run([[[makeTask({ id: 'late', due: { date: '2026-10-01' } })], at(10), true]])).toEqual([null])
  })

  it('reminds once when time moves a task into "soon", then into "overdue"', () => {
    const reminders = run([
      [[meeting], at(8), true],
      [[meeting], at(9, 30), true],
      [[meeting], at(10), true],
      [[meeting], at(12), true],
      [[meeting], at(12, 30), true],
    ])

    expect(reminders.map(describeReminder)).toEqual([null, 'meeting:soon', null, 'meeting:overdue', null])
  })

  it('groups simultaneous changes into one reminder', () => {
    expect(
      run([
        [[meeting, call], at(8), true],
        [[meeting, call], at(9, 30), true],
      ]).map(describeReminder),
    ).toEqual([null, 'group:2'])
  })

  it('collects changes while hidden and summarizes them once on return', () => {
    const reminders = run([
      [[meeting, report], at(8), true],
      [[meeting, report], at(12), false],
      [[meeting, report], at(0, 0, 6), false],
      [[meeting, report], at(0, 30, 6), true],
      [[meeting, report], at(1, 0, 6), true],
    ])

    expect(reminders.map(describeReminder)).toEqual([null, null, null, 'away:2:overdue', null])
  })

  it('reports a mixed summary when some tasks are only "soon"', () => {
    const reminders = run([
      [[meeting, report], at(8), true],
      [[meeting, report], at(10), false],
      [[meeting, report], at(10, 5), true],
    ])

    // Even a single change made while hidden comes back as a summary.
    expect(reminders.map(describeReminder)).toEqual([null, null, 'away:1:mixed'])
    const mixed = run([
      [[meeting, makeTask({ id: 'late', due: { date: '2026-10-05', time: '09:00' } })], at(8), true],
      [[meeting, makeTask({ id: 'late', due: { date: '2026-10-05', time: '09:00' } })], at(10), false],
      [[meeting, makeTask({ id: 'late', due: { date: '2026-10-05', time: '09:00' } })], at(10, 1), true],
    ])
    expect(mixed.map(describeReminder)).toEqual([null, null, 'away:2:mixed'])
  })

  it('does not repeat a reminder for the same task and band', () => {
    const reminders = run([
      [[meeting], at(8), true],
      [[meeting], at(9, 30), true],
      [[], at(9, 31), true], // filtered out of view for a moment
      [[meeting], at(9, 32), true],
    ])

    expect(reminders.map(describeReminder)).toEqual([null, 'meeting:soon', null, null])
  })

  it('does not remind about a change caused by editing the due date', () => {
    const edited = updateTask(meeting, { due: { date: '2026-10-05', time: '09:00' } })

    expect(
      run([
        [[meeting], at(10), true],
        [[edited], at(10), true],
      ]).map(describeReminder),
    ).toEqual([null, null])
  })

  it('reminds again after a recurring task is rescheduled and comes due again', () => {
    const daily = makeTask({ id: 'pill', due: { date: '2026-10-05', time: '09:00' }, recurrence: { unit: 'day', every: 1, anchor: 'due' } })
    const rescheduled = completeTask(daily, at(9, 30))

    const reminders = run([
      [[daily], at(8), true],
      [[daily], at(9), true], // overdue
      [[rescheduled], at(9, 30), true], // completed: due tomorrow 09:00, an edit-free change of due
      [[rescheduled], at(9, 0, 6), true], // overdue again, the next day
    ])

    expect(reminders.map(describeReminder)).toEqual([null, 'pill:overdue', null, 'pill:overdue'])
  })

  it('ignores tasks that are done', () => {
    const done = completeTask(meeting, at(8))

    expect(
      run([
        [[done], at(8), true],
        [[done], at(13), true],
      ]),
    ).toEqual([null, null])
  })
})
