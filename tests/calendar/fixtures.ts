import type { IcsOptions } from '../../src/calendar/ics.ts'

/** Labels the UI would pass in pt-BR. */
export const LABELS: IcsOptions['labels'] = {
  priority: 'Prioridade',
  priorities: { low: 'Baixa', medium: 'Média', high: 'Alta' },
  deck: 'Baralho',
  completionRecurrenceNote: 'Repete a partir da conclusão: só a próxima data foi exportada.',
}
