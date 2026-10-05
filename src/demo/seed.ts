import { addDays, addHours, format, subDays } from 'date-fns'
import { createTask, TaskSchema, toDayKey, type Due, type Task, type TaskInput } from '../domain/index.ts'
import { createId as randomId } from '../lib/id.ts'

/** Deck the demo tasks belong to until the app manages decks itself. */
export const DEMO_DECK = { id: 'demo', name: 'Geral' } as const
const DECK_ID = DEMO_DECK.id

function dayOffset(now: Date, days: number): Due {
  return { date: toDayKey(addDays(now, days)) }
}

/**
 * In-memory demo deck (stage 2 has no persistence), relative to `now` so it
 * always covers every urgency band. Ids are generated here, outside the domain.
 */
export function createDemoTasks(now: Date, createId: () => string = randomId): Task[] {
  const inTwoHours = addHours(now, 2)
  const make = (input: Omit<TaskInput, 'deckId'>) => createTask({ deckId: DECK_ID, ...input }, { id: createId(), now })

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
