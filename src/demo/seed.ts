import { addDays, addHours, format, subDays } from 'date-fns'
import { createTask, TaskSchema, toDayKey, type Due, type Task, type TaskInput } from '../domain/index.ts'
import { createId as randomId } from '../lib/id.ts'


function dayOffset(now: Date, days: number): Due {
  return { date: toDayKey(addDays(now, days)) }
}

export interface DemoOptions {
  /** Deck that receives the sample tasks. */
  readonly deckId: string
  readonly createId?: () => string
}

/**
 * Sample tasks relative to `now`, covering every urgency band. They only
 * enter the app through the "load sample tasks" button on first run, never
 * on top of persisted data. Ids are generated here, outside the domain.
 */
export function createDemoTasks(now: Date, { deckId, createId = randomId }: DemoOptions): Task[] {
  const inTwoHours = addHours(now, 2)
  const make = (input: Omit<TaskInput, 'deckId'>) => createTask({ deckId, ...input }, { id: createId(), now })

  const postponed = TaskSchema.parse({
    ...make({
      title: 'Organizar a gaveta de documentos',
      description: 'Separar contas pagas e jogar fora os recibos antigos.',
      priority: 'low',
      due: dayOffset(now, 3),
    }),
    postponedDays: 3,
    skippedAt: subDays(now, 1).toISOString(),
  })

  return [
    make({
      title: 'Pagar a conta de luz',
      description: 'Venceu ontem. Pagar pelo aplicativo do banco; código de barras no e-mail.',
      priority: 'high',
      due: dayOffset(now, -1),
    }),
    make({
      title: 'Ligar para o dentista',
      description: 'Remarcar a limpeza para a semana que vem.',
      priority: 'medium',
      due: { date: toDayKey(inTwoHours), time: format(inTwoHours, 'HH:mm') },
    }),
    make({
      title: 'Enviar o relatório semanal',
      description: 'Incluir os números de vendas e os próximos passos.',
      priority: 'high',
      due: dayOffset(now, 0),
    }),
    make({
      title: 'Comprar pão e frutas',
      priority: 'low',
      due: dayOffset(now, 1),
    }),
    make({
      title: 'Lavar a roupa',
      description: 'Roupas brancas separadas das coloridas.',
      priority: 'medium',
      due: dayOffset(now, 2),
      recurrence: { unit: 'week', every: 1, anchor: 'due' },
    }),
    postponed,
    make({
      title: 'Renovar o passaporte',
      description: 'Agendar no site da Polícia Federal e levar foto.',
      priority: 'medium',
      due: dayOffset(now, 20),
    }),
    make({
      title: 'Ler um capítulo do livro',
      priority: 'low',
    }),
  ]
}
