import { useSyncExternalStore } from 'react'

/** Same query as the shortcuts legend: a mouse or trackpad, where a keyboard is likely. */
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'

function subscribe(listener: () => void) {
  const query = window.matchMedia(FINE_POINTER_QUERY)
  query.addEventListener('change', listener)
  return () => {
    query.removeEventListener('change', listener)
  }
}

/** True on devices with hover and a precise pointer; follows changes (e.g. a docked tablet). */
export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(FINE_POINTER_QUERY).matches)
}
