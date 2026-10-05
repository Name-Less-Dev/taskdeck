import type { AppData } from '../domain/index.ts'
import type { Meta } from './types.ts'

export const AUTOSAVE_DELAY_MS = 300

export interface AutosaverOptions {
  readonly save: (data: AppData, meta: Meta) => Promise<void>
  readonly delayMs?: number
  readonly onError?: (error: unknown) => void
  readonly onSaved?: () => void
}

export interface Autosaver {
  /** Remembers the latest snapshot and saves it after `delayMs` of quiet. */
  schedule(data: AppData, meta: Meta): void
  /** Saves the pending snapshot now (page hidden, pagehide). */
  flush(): Promise<void>
  /** Saves again the snapshot whose save failed (or the newer pending one). */
  retry(): Promise<void>
  /** True while a scheduled or failed snapshot has not been written. */
  hasPending(): boolean
  dispose(): void
}

interface Snapshot {
  readonly data: AppData
  readonly meta: Meta
}

/**
 * Debounced writer. Saves run one after another (never overlapping), always
 * with the most recent snapshot, and a failure never throws into the app:
 * it is reported through onError and kept for retry().
 */
export function createAutosaver({ save, delayMs = AUTOSAVE_DELAY_MS, onError, onSaved }: AutosaverOptions): Autosaver {
  let pending: Snapshot | null = null
  let failed: Snapshot | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let chain: Promise<void> = Promise.resolve()

  // schedule() may run while a save is awaited; read the variable through a
  // function so the check below is not narrowed away by control-flow analysis.
  function newerPending(): Snapshot | null {
    return pending
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function flush(): Promise<void> {
    clearTimer()
    chain = chain.then(async () => {
      const snapshot = pending
      if (snapshot === null) return
      pending = null
      try {
        await save(snapshot.data, snapshot.meta)
        failed = null
        onSaved?.()
      } catch (error) {
        // Keep it for retry() unless something newer is already waiting.
        failed = newerPending() === null ? snapshot : null
        onError?.(error)
      }
    })
    return chain
  }

  return {
    schedule(data, meta) {
      pending = { data, meta }
      clearTimer()
      timer = setTimeout(() => {
        void flush()
      }, delayMs)
    },
    flush,
    retry() {
      if (pending === null && failed !== null) pending = failed
      return flush()
    },
    hasPending() {
      return pending !== null || failed !== null
    },
    dispose() {
      clearTimer()
    },
  }
}
