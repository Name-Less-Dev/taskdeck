import { plural, type Dictionary } from './dictionary.ts'

const p = (count: number, one: string, other: string) => plural('pt-BR', count, { one, other })

export const ptBR: Dictionary = {
  locale: 'pt-BR',
  app: {
    name: 'taskdeck',
    deckLabel: 'Baralho de tarefas',
    historyLabel: 'Histórico',
  },
  actions: {
    complete: 'Concluir',
    postpone: 'Adiar',
    remove: 'Apagar',
    undo: 'Desfazer',
    redo: 'Refazer',
    add: 'Nova tarefa',
    actionsLabel: 'Ações da carta',
  },
  priority: {
    label: 'Prioridade',
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
  },
  due: {
    none: 'Sem prazo',
    today: 'Hoje',
    tomorrow: 'Amanhã',
    overdueNow: 'Atrasada agora',
    overdueMinutes: (n) => `Atrasada há ${n} min`,
    overdueHours: (n) => `Atrasada há ${n} h`,
    overdueDays: (n) => p(n, 'Atrasada há {n} dia', 'Atrasada há {n} dias'),
    soonMinutes: (n) => p(n, 'Falta {n} min', 'Faltam {n} min'),
    soonHours: (h, m) => p(h, 'Falta {n} h', 'Faltam {n} h') + (m > 0 ? ` ${m} min` : ''),
    inDays: (n) => p(n, 'Em {n} dia', 'Em {n} dias'),
  },
  recurrence: {
    every: (unit, n) => {
      switch (unit) {
        case 'day':
          return p(n, 'Todo dia', 'A cada {n} dias')
        case 'week':
          return p(n, 'Toda semana', 'A cada {n} semanas')
        case 'month':
          return p(n, 'Todo mês', 'A cada {n} meses')
      }
    },
    fromCompletion: ', contando da conclusão',
  },
  card: {
    front: 'Frente',
    back: 'Verso',
    flipHint: 'Toque para virar',
    description: 'Descrição',
    noDescription: 'Sem descrição.',
    dueLabel: 'Prazo',
    recurrenceLabel: 'Repete',
    postponedLabel: 'Adiada',
    postponedBadge: (n) => p(n, 'adiada {n} dia', 'adiada {n} dias'),
    postponedCount: (n) => (n === 0 ? 'Nunca' : p(n, '{n} dia', '{n} dias')),
    ariaLabel: (title, due, priority) => `${title}. ${due}. Prioridade ${priority.toLowerCase()}.`,
  },
  toast: {
    completed: 'Tarefa concluída',
    postponed: 'Tarefa adiada',
    removed: 'Tarefa apagada',
  },
  announce: {
    completed: (title) => `Tarefa concluída: ${title}. Desfazer disponível.`,
    postponed: (title) => `Tarefa adiada: ${title}. Desfazer disponível.`,
    removed: (title) => `Tarefa apagada: ${title}. Desfazer disponível.`,
    added: (title) => `Tarefa criada: ${title}.`,
    undone: 'Ação desfeita.',
    redone: 'Ação refeita.',
    empty: 'Nenhuma tarefa no baralho.',
  },
  empty: {
    title: 'Tudo em dia!',
    body: 'Nenhuma tarefa no baralho. Crie uma com o botão Nova tarefa.',
  },
  shortcuts: {
    summary: 'Atalhos',
    spaceKey: 'Espaço',
    flip: 'Virar a carta',
    complete: 'Concluir',
    postpone: 'Adiar',
    remove: 'Apagar',
    undo: 'Desfazer',
    redo: 'Refazer',
  },
  errorScreen: {
    title: 'Algo deu errado',
    body: 'O taskdeck encontrou um erro e não pôde continuar. Recarregue a página para tentar de novo.',
    reload: 'Recarregar',
    details: 'Detalhes técnicos',
  },
  form: {
    title: 'Nova tarefa',
    titleLabel: 'Título',
    descriptionLabel: 'Descrição',
    priorityLabel: 'Prioridade',
    dateLabel: 'Data do prazo',
    timeLabel: 'Hora do prazo',
    optional: '(opcional)',
    save: 'Criar tarefa',
    cancel: 'Cancelar',
    close: 'Fechar',
    errors: {
      titleRequired: 'Informe um título.',
      titleTooLong: (max) => `Use no máximo ${max} caracteres.`,
      descriptionTooLong: (max) => `Use no máximo ${max} caracteres.`,
      invalidDate: 'Informe uma data válida.',
      invalidTime: 'Informe uma hora válida (HH:mm).',
      timeWithoutDate: 'Escolha uma data para usar um horário.',
      generic: 'Valor inválido.',
    },
  },
}
