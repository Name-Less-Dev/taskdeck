import { useState } from 'react'

/**
 * Interface preferences (e.g. whether the tag filter is open): per browser,
 * in localStorage, never in IndexedDB or in backups. Storage may be missing
 * or throw (private modes, blocked site data), so every access is guarded
 * and the default is used instead.
 */
export const PREFERENCE_PREFIX = 'taskdeck:ui:'

export function readBooleanPreference(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(PREFERENCE_PREFIX + key)
    return value === null ? fallback : value === 'true'
  } catch {
    return fallback
  }
}

export function writeBooleanPreference(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(PREFERENCE_PREFIX + key, String(value))
  } catch {
    // Not saved; the choice still applies for this session.
  }
}

/** A boolean interface preference, read once and written on every change. */
export function useBooleanPreference(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => readBooleanPreference(key, fallback))
  return [
    value,
    (next: boolean) => {
      setValue(next)
      writeBooleanPreference(key, next)
    },
  ]
}
