import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import {
  adoptOrphans,
  checkIntegrity,
  createDeck,
  DUPLICATE_DECK_ID,
  DUPLICATE_DECK_NAME,
  ensureDeck,
  removeDeck,
  renameDeck,
  type AppData,
  type Deck,
} from '../../src/domain/index.ts'
import { deepFreeze, makeTask } from './fixtures.ts'

const home: Deck = { id: 'home', name: 'Casa' }
const work: Deck = { id: 'work', name: 'Trabalho' }

function data(): AppData {
  return deepFreeze({
    decks: [home, work],
    tasks: [
      makeTask({ id: 't1', deckId: 'home' }),
      makeTask({ id: 't2', deckId: 'work' }),
      makeTask({ id: 't3', deckId: 'work' }),
    ],
  })
}

function issueReason(fn: () => unknown): unknown {
  try {
    fn()
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0]
      return issue?.code === 'custom' ? issue.params?.reason : issue?.code
    }
    throw error
  }
  return 'no error'
}

describe('createDeck', () => {
  it('trims the name and keeps the injected id', () => {
    expect(createDeck({ name: '  Mercado  ' }, { id: 'd1' })).toEqual({ id: 'd1', name: 'Mercado' })
  })

  it('returns a frozen deck', () => {
    expect(Object.isFrozen(createDeck({ name: 'Mercado' }, { id: 'd1' }))).toBe(true)
  })

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['31 characters', 'x'.repeat(31)],
  ])('rejects a name that is %s', (_label, name) => {
    expect(() => createDeck({ name }, { id: 'd1' })).toThrow(ZodError)
  })

  it('accepts exactly 30 characters', () => {
    expect(createDeck({ name: 'x'.repeat(30) }, { id: 'd1' }).name).toHaveLength(30)
  })

  it.each([
    ['same case', 'Casa'],
    ['different case', 'CASA'],
    ['extra spaces', '  casa '],
  ])('rejects a duplicate name with %s', (_label, name) => {
    expect(issueReason(() => createDeck({ name }, { id: 'd1', existing: [home, work] }))).toBe(DUPLICATE_DECK_NAME)
  })

  it('rejects an id that already exists', () => {
    expect(issueReason(() => createDeck({ name: 'Nova' }, { id: 'home', existing: [home] }))).toBe(DUPLICATE_DECK_ID)
  })
})

describe('renameDeck', () => {
  it('renames and keeps the id', () => {
    expect(renameDeck(home, ' Lar ', [home, work])).toEqual({ id: 'home', name: 'Lar' })
  })

  it('allows changing only the case of its own name', () => {
    expect(renameDeck(home, 'CASA', [home, work])).toEqual({ id: 'home', name: 'CASA' })
  })

  it('rejects the name of another deck, ignoring case', () => {
    expect(issueReason(() => renameDeck(home, 'trabalho', [home, work]))).toBe(DUPLICATE_DECK_NAME)
  })

  it('rejects an invalid name', () => {
    expect(issueReason(() => renameDeck(home, '', [home, work]))).toBe('too_small')
  })
})

describe('removeDeck', () => {
  it('removes the deck and all of its tasks', () => {
    const result = removeDeck(data(), 'work')

    expect(result.decks).toEqual([home])
    expect(result.tasks.map((task) => task.id)).toEqual(['t1'])
  })

  it.each([
    ['the last deck', { decks: [home], tasks: [makeTask({ deckId: 'home' })] }, 'home'],
    ['an unknown deck', { decks: [home, work], tasks: [] }, 'missing'],
  ])('returns the same state when removing %s', (_label, input: AppData, deckId) => {
    expect(removeDeck(input, deckId)).toBe(input)
  })

  it('does not mutate its input', () => {
    const input = data()

    removeDeck(input, 'home')

    expect(input.decks).toHaveLength(2)
    expect(input.tasks).toHaveLength(3)
  })
})

describe('checkIntegrity', () => {
  it('reports nothing for consistent data', () => {
    expect(checkIntegrity(data())).toEqual([])
  })

  it.each<[string, AppData, ReturnType<typeof checkIntegrity>]>([
    ['no decks', { decks: [], tasks: [] }, [{ kind: 'no-decks' }]],
    [
      'an orphan task',
      { decks: [home], tasks: [makeTask({ id: 'x', deckId: 'gone' })] },
      [{ kind: 'orphan-task', taskId: 'x', deckId: 'gone' }],
    ],
    ['a duplicate deck id', { decks: [home, { id: 'home', name: 'Outra' }], tasks: [] }, [{ kind: 'duplicate-deck-id', id: 'home' }]],
    [
      'a duplicate task id',
      { decks: [home], tasks: [makeTask({ id: 'x', deckId: 'home' }), makeTask({ id: 'x', deckId: 'home' })] },
      [{ kind: 'duplicate-task-id', id: 'x' }],
    ],
  ])('reports %s', (_label, input, expected) => {
    expect(checkIntegrity(input)).toEqual(expected)
  })
})

describe('ensureDeck', () => {
  const general: Deck = { id: 'g', name: 'Geral' }

  it('adds the deck when there is none', () => {
    expect(ensureDeck({ decks: [], tasks: [] }, general)).toEqual({ data: { decks: [general], tasks: [] }, created: true })
  })

  it('keeps existing decks untouched', () => {
    const input = data()

    expect(ensureDeck(input, general)).toEqual({ data: input, created: false })
  })
})

describe('adoptOrphans', () => {
  const recovered: Deck = { id: 'r', name: 'Recuperadas' }

  it('moves orphan tasks to a new recovery deck and counts them', () => {
    const input: AppData = {
      decks: [home],
      tasks: [makeTask({ id: 'ok', deckId: 'home' }), makeTask({ id: 'o1', deckId: 'gone' }), makeTask({ id: 'o2', deckId: 'x' })],
    }

    const result = adoptOrphans(input, recovered)

    expect(result.adopted).toBe(2)
    expect(result.data.decks).toEqual([home, recovered])
    expect(result.data.tasks.map((task) => task.deckId)).toEqual(['home', 'r', 'r'])
    expect(checkIntegrity(result.data)).toEqual([])
  })

  it('reuses an existing deck with the same name instead of adding a twin', () => {
    const previous: Deck = { id: 'old-r', name: 'recuperadas' }
    const result = adoptOrphans({ decks: [previous], tasks: [makeTask({ deckId: 'gone' })] }, recovered)

    expect(result.data.decks).toEqual([previous])
    expect(result.data.tasks[0]?.deckId).toBe('old-r')
  })

  it('returns the same data when nothing is orphaned', () => {
    const input = data()

    expect(adoptOrphans(input, recovered)).toEqual({ data: input, adopted: 0 })
  })
})
