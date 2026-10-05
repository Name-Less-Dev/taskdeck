import { z } from 'zod'
import { DeckSchema, TaskSchema, type Deck, type Task } from './schemas.ts'

/** The whole persisted state: every deck and every task (of every deck). */
export interface AppData {
  readonly decks: readonly Deck[]
  readonly tasks: readonly Task[]
}

export const AppDataSchema = z.object({
  decks: z.array(DeckSchema).readonly(),
  tasks: z.array(TaskSchema).readonly(),
})

/** Custom-issue reasons, so callers can tell these apart from plain schema errors. */
export const DUPLICATE_DECK_NAME = 'duplicate-deck-name'
export const DUPLICATE_DECK_ID = 'duplicate-deck-id'

export interface DeckInput {
  readonly name: string
}

export interface CreateDeckContext {
  readonly id: string
  /** Decks the new one must not clash with (id, or name ignoring case). */
  readonly existing?: readonly Deck[]
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** DeckSchema plus uniqueness against `others` (a deck never clashes with itself). */
function deckAgainst(others: readonly Deck[]) {
  return DeckSchema.refine((deck) => !others.some((other) => other.id === deck.id), {
    error: 'deck id already exists',
    path: ['id'],
    params: { reason: DUPLICATE_DECK_ID },
  }).refine((deck) => !others.some((other) => sameName(other.name, deck.name)), {
    error: 'deck name already exists (case-insensitive)',
    path: ['name'],
    params: { reason: DUPLICATE_DECK_NAME },
  })
}

/** Validates (1-30 chars after trim, unique name and id) and builds a deck. Throws ZodError. */
export function createDeck(input: DeckInput, { id, existing = [] }: CreateDeckContext): Deck {
  return deckAgainst(existing).parse({ id, name: input.name })
}

/** Renames a deck; `existing` may include the deck itself. Throws ZodError. */
export function renameDeck(deck: Deck, name: string, existing: readonly Deck[] = []): Deck {
  return deckAgainst(existing.filter((other) => other.id !== deck.id)).parse({ id: deck.id, name })
}

/**
 * Removes a deck and every task in it. Refuses (returns the same object)
 * when the deck does not exist or is the last one.
 */
export function removeDeck(data: AppData, deckId: string): AppData {
  if (data.decks.length <= 1 || !data.decks.some((deck) => deck.id === deckId)) return data
  return {
    decks: data.decks.filter((deck) => deck.id !== deckId),
    tasks: data.tasks.filter((task) => task.deckId !== deckId),
  }
}

export type IntegrityProblem =
  | { readonly kind: 'no-decks' }
  | { readonly kind: 'duplicate-deck-id'; readonly id: string }
  | { readonly kind: 'duplicate-task-id'; readonly id: string }
  | { readonly kind: 'orphan-task'; readonly taskId: string; readonly deckId: string }

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id)
    seen.add(id)
  }
  return [...repeated]
}

/** Lists every broken invariant: at least one deck, unique ids, every task in an existing deck. */
export function checkIntegrity(data: AppData): IntegrityProblem[] {
  const problems: IntegrityProblem[] = []
  if (data.decks.length === 0) problems.push({ kind: 'no-decks' })
  for (const id of duplicates(data.decks.map((deck) => deck.id))) problems.push({ kind: 'duplicate-deck-id', id })
  for (const id of duplicates(data.tasks.map((task) => task.id))) problems.push({ kind: 'duplicate-task-id', id })
  const deckIds = new Set(data.decks.map((deck) => deck.id))
  for (const task of data.tasks) {
    if (!deckIds.has(task.deckId)) problems.push({ kind: 'orphan-task', taskId: task.id, deckId: task.deckId })
  }
  return problems
}

/**
 * Adds `deck` when there are no decks at all (first run, or everything lost).
 * The name comes from the caller, so the domain stays free of UI text.
 */
export function ensureDeck(data: AppData, deck: Deck): { data: AppData; created: boolean } {
  if (data.decks.length > 0) return { data, created: false }
  return { data: { decks: [deck], tasks: data.tasks }, created: true }
}

/**
 * Moves tasks whose deck does not exist into a recovery deck. Reuses an
 * existing deck with the same name (ignoring case) instead of adding a twin.
 */
export function adoptOrphans(data: AppData, recovery: Deck): { data: AppData; adopted: number } {
  const deckIds = new Set(data.decks.map((deck) => deck.id))
  const orphans = data.tasks.filter((task) => !deckIds.has(task.deckId))
  if (orphans.length === 0) return { data, adopted: 0 }

  const target = data.decks.find((deck) => sameName(deck.name, recovery.name)) ?? recovery
  const decks = target === recovery ? [...data.decks, recovery] : data.decks
  return {
    data: {
      decks,
      tasks: data.tasks.map((task) => (deckIds.has(task.deckId) ? task : { ...task, deckId: target.id })),
    },
    adopted: orphans.length,
  }
}
