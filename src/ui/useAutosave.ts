import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData } from '../domain/index.ts'
import { createAutosaver, type AppStorage, type Meta } from '../storage/index.ts'

export interface AutosaveState {
  /** The last save failed; the UI shows a discreet warning with retry. */
  readonly saveFailed: boolean
  readonly retry: () => void
  /** Saves the current snapshot right away (e.g. after the first-run choice). */
  readonly saveNow: () => void
}

/**
 * Saves `data` + `meta` ~300 ms after they change, and immediately when the
 * page is hidden or unloaded (visibilitychange: hidden, pagehide). The
 * snapshot that was just loaded is not written back. Errors never throw.
 */
export function useAutosave(storage: AppStorage, data: AppData, meta: Meta, enabled = true): AutosaveState {
  const [saveFailed, setSaveFailed] = useState(false)
  const [saver] = useState(() =>
    createAutosaver({
      save: (snapshotData, snapshotMeta) => storage.save(snapshotData, snapshotMeta),
      onError: () => {
        setSaveFailed(true)
      },
      onSaved: () => {
        setSaveFailed(false)
      },
    }),
  )
  const loaded = useRef({ data, meta })
  const latest = useRef({ data, meta })
  latest.current = { data, meta }

  useEffect(() => {
    if (!enabled) return
    if (data === loaded.current.data && meta === loaded.current.meta) return
    saver.schedule(data, meta)
  }, [data, meta, enabled, saver])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void saver.flush()
    }
    const onPageHide = () => {
      void saver.flush()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      // Unmounting (or a hot reload) must not lose the pending snapshot.
      void saver.flush()
      saver.dispose()
    }
  }, [saver])

  const retry = useCallback(() => {
    void saver.retry()
  }, [saver])

  const saveNow = useCallback(() => {
    if (!enabled) return
    saver.schedule(latest.current.data, latest.current.meta)
    void saver.flush()
  }, [saver, enabled])

  return { saveFailed, retry, saveNow }
}
