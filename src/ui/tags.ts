import { MAX_TAGS, TagSchema } from '../domain/index.ts'

export type TagInputError = 'too-long' | 'too-many'

/**
 * Adds every comma-separated tag in `text` to `current`, normalized by the
 * domain's TagSchema (trim, lowercase). Duplicates are skipped silently;
 * tags that are too long or beyond the limit are skipped and reported.
 */
export function addTags(current: readonly string[], text: string): { tags: string[]; error: TagInputError | null } {
  const tags = [...current]
  let error: TagInputError | null = null
  for (const piece of text.split(',')) {
    if (piece.trim() === '') continue
    const parsed = TagSchema.safeParse(piece)
    if (!parsed.success) {
      error = 'too-long'
      continue
    }
    if (tags.includes(parsed.data)) continue
    if (tags.length >= MAX_TAGS) {
      error = 'too-many'
      continue
    }
    tags.push(parsed.data)
  }
  return { tags, error }
}
