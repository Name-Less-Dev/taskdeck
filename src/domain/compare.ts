// Internal comparators shared by the ordering functions (not part of the public API).

export function compareNumbers(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Code-unit comparison: deterministic and independent of the runtime locale. */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
