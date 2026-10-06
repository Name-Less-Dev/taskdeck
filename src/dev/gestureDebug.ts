/**
 * Development-only gesture and viewport diagnostics, enabled with
 * ?debug=gestures. Components report through reportGesture/reportRender
 * (no-ops unless the panel is installed, and always called behind
 * import.meta.env.DEV so production builds drop them). Everything else is
 * read straight from the DOM. The panel is plain DOM with
 * pointer-events: none, so it can never intercept a touch itself.
 *
 * How to read it:
 * - heartbeat delay high            -> the main thread is blocked
 * - heartbeat fine, UI stuck        -> a lock flag (exiting), inert or an overlay
 * - "exit started" for over 1 s     -> an exit animation that never finished
 * - innerHeight changing near the problem -> viewport / virtual keyboard
 * - pointercancel during a drag     -> the browser took the touch (scroll, gesture)
 * - pointerdown without drag start  -> drag controls bound to the wrong element
 * - top card opacity 0 or off-screen -> the card is there but invisible
 */

export type ExitStatus = 'idle' | 'started' | 'resolved' | 'interrupted'

export interface GestureReport {
  topId?: string | null
  flippedId?: string | null
  exiting?: { readonly id: string; readonly action: string } | null
  busy?: boolean
  dragX?: number
  dragY?: number
  decision?: string | null
  dragging?: boolean
  exitStatus?: ExitStatus
  exitId?: string | null
}

interface DebugState extends Required<GestureReport> {
  exitChangedAt: number
  renderTimes: number[]
  pointer: string
  pointerLog: string[]
  innerHeightLog: string[]
}

let enabled = false
const state: DebugState = {
  topId: null,
  flippedId: null,
  exiting: null,
  busy: false,
  dragX: 0,
  dragY: 0,
  decision: null,
  dragging: false,
  exitStatus: 'idle',
  exitId: null,
  exitChangedAt: 0,
  renderTimes: [],
  pointer: '-',
  pointerLog: [],
  innerHeightLog: [],
}

export function isGestureDebugEnabled(): boolean {
  return enabled
}

export function reportGesture(patch: GestureReport): void {
  if (!enabled) return
  if (patch.exitStatus !== undefined && patch.exitStatus !== state.exitStatus) state.exitChangedAt = performance.now()
  Object.assign(state, patch)
}

export function reportRender(): void {
  if (!enabled) return
  state.renderTimes.push(performance.now())
}

function describeTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) return target === null ? 'null' : 'window/document'
  const testId = target.closest('[data-testid]')?.getAttribute('data-testid')
  const cls = typeof target.className === 'string' ? target.className.split(' ')[0] : ''
  return `${target.tagName.toLowerCase()}${cls ? '.' + cls : ''}${testId ? ` in ${testId}` : ''}`
}

function topCardInfo(): string {
  const card = document.querySelector<HTMLElement>('[data-top-card]')
  if (card === null) return 'none'
  const rect = card.getBoundingClientRect()
  const style = getComputedStyle(card)
  const onScreen = rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight
  return `opacity=${style.opacity} transform=${card.style.transform || 'none'} rect=${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)} ${onScreen ? 'on-screen' : 'OFF-SCREEN'}`
}

/** Starts the panel; returns a function that removes it. */
export function installGesturePanel(): () => void {
  enabled = true
  const panel = document.createElement('pre')
  panel.dataset.gestureDebug = ''
  panel.setAttribute('aria-hidden', 'true')
  panel.setAttribute(
    'style',
    [
      'position:fixed',
      'left:4px',
      'top:4px',
      'z-index:2147483646',
      'max-width:calc(100vw - 8px)',
      'margin:0',
      'padding:6px 8px',
      'background:rgb(0 0 0 / 78%)',
      'color:#b9ffb9',
      'font:10px/1.35 ui-monospace,Menlo,Consolas,monospace',
      'white-space:pre-wrap',
      'pointer-events:none',
      'border-radius:6px',
    ].join(';'),
  )
  document.body.append(panel)

  const onPointer = (event: PointerEvent) => {
    const line = `${event.type.replace('pointer', '')} ${event.pointerType} -> ${describeTarget(event.target)}`
    state.pointer = line
    if (event.type !== 'pointermove') {
      state.pointerLog = [...state.pointerLog.slice(-3), `${Math.round(performance.now())} ${line}`]
    }
  }
  const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const
  for (const type of types) window.addEventListener(type, onPointer, { capture: true, passive: true })

  let lastInnerHeight = innerHeight
  let expected = performance.now() + 250
  let lastDelay = 0
  let maxDelay = 0
  const timer = setInterval(() => {
    const now = performance.now()
    lastDelay = Math.max(0, Math.round(now - expected))
    maxDelay = Math.max(lastDelay, maxDelay * 0.98)
    expected = now + 250

    if (innerHeight !== lastInnerHeight) {
      state.innerHeightLog = [
        ...state.innerHeightLog.slice(-2),
        `${Math.round(now)} ${lastInnerHeight}->${innerHeight}`,
      ]
      lastInnerHeight = innerHeight
    }
    state.renderTimes = state.renderTimes.filter((time) => now - time < 1000)
    const exitAge = state.exitStatus === 'started' ? ` for ${Math.round(now - state.exitChangedAt)} ms` : ''
    const inert = document.querySelectorAll('[inert]').length

    panel.textContent = [
      `heartbeat delay ${lastDelay} ms (max ~${Math.round(maxDelay)})   renders/s ${state.renderTimes.length}`,
      `viewport inner ${innerWidth}x${innerHeight}  visual ${Math.round(visualViewport?.width ?? 0)}x${Math.round(visualViewport?.height ?? 0)}`,
      ...state.innerHeightLog.map((line) => `  innerHeight ${line}`),
      `top=${state.topId ?? '-'} flipped=${state.flippedId ?? '-'} exiting=${state.exiting ? `${state.exiting.action}:${state.exiting.id}` : '-'} busy=${state.busy}`,
      `exit ${state.exitStatus}${exitAge} (${state.exitId ?? '-'})`,
      `drag ${state.dragging ? 'ON' : 'off'} x=${Math.round(state.dragX)} y=${Math.round(state.dragY)} decide=${state.decision ?? 'null'}`,
      `top card: ${topCardInfo()}`,
      `inert elements: ${inert}`,
      `pointer: ${state.pointer}`,
      ...state.pointerLog.map((line) => `  ${line}`),
    ].join('\n')
  }, 250)

  return () => {
    clearInterval(timer)
    for (const type of types) window.removeEventListener(type, onPointer, { capture: true })
    panel.remove()
    enabled = false
  }
}
