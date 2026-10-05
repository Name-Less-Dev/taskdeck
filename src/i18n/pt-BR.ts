import { plural, type Dictionary } from './dictionary.ts'

// CLDR puts 0 in the "one" category for Portuguese ("0 tarefa"); Brazilian usage
// is plural ("0 tarefas"), so zero always takes the plural form here.
const p = (count: number, one: string, other: string) =>
  count === 0 ? other.replace('{n}', '0') : plural('pt-BR', count, { one, other })

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
    ariaLabel: (title, due, priority, deck) =>
      `${title}. ${due}. Prioridade ${priority.toLowerCase()}.${deck === undefined ? '' : ` Baralho ${deck}.`}`,
    edit: 'Editar',
    editLabel: (title) => `Editar a tarefa ${title}`,
    tagsLabel: 'Tags',
  },
  toast: {
    completed: 'Tarefa concluída',
    postponed: 'Tarefa adiada',
    removed: 'Tarefa apagada',
    taskUpdated: 'Tarefa atualizada',
    deckCreated: 'Baralho criado',
    deckRenamed: 'Baralho renomeado',
    deckRemoved: 'Baralho apagado',
  },
  announce: {
    completed: (title) => `Tarefa concluída: ${title}. Desfazer disponível.`,
    postponed: (title) => `Tarefa adiada: ${title}. Desfazer disponível.`,
    removed: (title) => `Tarefa apagada: ${title}. Desfazer disponível.`,
    added: (title) => `Tarefa criada: ${title}.`,
    deckSelected: (name) => `Mostrando: ${name}.`,
    taskUpdated: (title) => `Tarefa atualizada: ${title}. Desfazer disponível.`,
    tagFilter: (tag, n) => `Filtro #${tag}: ${p(n, '{n} tarefa', '{n} tarefas')}.`,
    tagFilterCleared: 'Filtro de tag removido.',
    deckCreated: (name) => `Baralho criado: ${name}. Desfazer disponível.`,
    deckRenamed: (from, to) => `Baralho renomeado de ${from} para ${to}. Desfazer disponível.`,
    deckRemoved: (name, n) => `Baralho apagado: ${name}, com ${p(n, '{n} tarefa', '{n} tarefas')}. Desfazer disponível.`,
    samplesLoaded: (n) => p(n, '{n} tarefa de exemplo carregada.', '{n} tarefas de exemplo carregadas.'),
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
  tags: {
    label: 'Tags',
    hint: 'Enter ou vírgula adiciona; Backspace no campo vazio remove a última.',
    removeLabel: (tag) => `Remover a tag ${tag}`,
    more: (n) => `+${n}`,
    moreLabel: (n) => p(n, 'mais {n} tag', 'mais {n} tags'),
    filterLabel: 'Filtrar por tag',
    filterButton: (tag, n) => `${tag}, ${p(n, '{n} tarefa', '{n} tarefas')}`,
    clear: 'Limpar',
    emptyTitle: (tag) => `Nada com #${tag}`,
    emptyBody: 'Nenhuma tarefa ativa deste baralho tem essa tag.',
    clearFilter: 'Limpar filtro',
    errors: {
      tooLong: (max) => `Cada tag pode ter no máximo ${max} caracteres.`,
      tooMany: (max) => `Use no máximo ${max} tags.`,
    },
  },
  decks: {
    switcherPrefix: 'Baralho:',
    allDecks: 'Todos os baralhos',
    sheetTitle: 'Baralhos',
    activeCount: (n) => p(n, '{n} tarefa ativa', '{n} tarefas ativas'),
    select: (name) => `Mostrar ${name}`,
    rename: 'Renomear',
    renameLabel: (name) => `Renomear ${name}`,
    remove: 'Apagar',
    removeLabel: (name) => `Apagar ${name}`,
    save: 'Salvar',
    cancel: 'Cancelar',
    nameLabel: 'Nome do baralho',
    newDeckLabel: 'Novo baralho',
    create: 'Criar baralho',
    confirmRemoveTitle: (name) => `Apagar o baralho “${name}”?`,
    confirmRemoveBody: (n) =>
      n === 0 ? 'Ele não tem tarefas.' : p(n, 'A tarefa dele também será apagada.', 'As {n} tarefas dele também serão apagadas.'),
    confirmRemove: 'Apagar baralho',
    lastDeck: 'Este é o único baralho e não pode ser apagado.',
    cardLabel: 'Baralho',
    errors: {
      required: 'Informe um nome.',
      tooLong: (max) => `Use no máximo ${max} caracteres.`,
      duplicate: 'Já existe um baralho com esse nome.',
    },
  },
  startup: {
    loading: 'Carregando suas tarefas…',
    generalDeck: 'Geral',
    recoveredDeck: 'Recuperadas',
  },
  storage: {
    memoryWarning: 'Seus dados não serão salvos neste navegador. Exporte um backup antes de sair.',
    saveFailed: 'Não foi possível salvar as últimas alterações.',
    retry: 'Tentar de novo',
  },
  firstRun: {
    title: 'Bem-vindo ao taskdeck',
    body: 'Comece com algumas tarefas de exemplo para experimentar os gestos, ou com o baralho vazio.',
    loadSamples: 'Carregar tarefas de exemplo',
    startEmpty: 'Começar do zero',
  },
  readOnly: {
    title: 'Dados de uma versão mais nova',
    newerVersion: (found, supported) =>
      `Estes dados foram salvos por uma versão mais nova do taskdeck (formato ${found}). Esta versão só entende o formato ${supported}.`,
    missingMigration: (found) => `Estes dados estão num formato antigo (${found}) que esta versão não sabe converter.`,
    untouched: 'Nada foi alterado: o app está em modo somente leitura. Atualize o app ou exporte uma cópia dos dados.',
    found: (decks, tasks) => `Encontrado: ${p(decks, '{n} registro de baralho', '{n} registros de baralho')}, ${p(tasks, '{n} registro de tarefa', '{n} registros de tarefa')}.`,
    export: 'Exportar o que foi encontrado',
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
    editTitle: 'Editar tarefa',
    saveChanges: 'Salvar alterações',
    deckLabel: 'Baralho',
    recurrenceNote: (rule) => `Repete: ${rule}. A recorrência poderá ser editada numa próxima versão.`,
    cancel: 'Cancelar',
    close: 'Fechar',
    errors: {
      titleRequired: 'Informe um título.',
      titleTooLong: (max) => `Use no máximo ${max} caracteres.`,
      descriptionTooLong: (max) => `Use no máximo ${max} caracteres.`,
      invalidDate: 'Informe uma data válida.',
      invalidTime: 'Informe uma hora válida (HH:mm).',
      timeWithoutDate: 'Escolha uma data para usar um horário.',
      recurrenceNeedsDue: 'Uma tarefa recorrente precisa de uma data.',
      generic: 'Valor inválido.',
    },
  },
}
