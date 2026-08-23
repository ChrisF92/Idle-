import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/** Lower number = higher priority. Only one of priorities 1–4 should display. */
export type OverlayKind = 'update' | 'confirm' | 'unlock' | 'onboarding' | 'modal' | 'sheet' | 'toast'

export const OVERLAY_PRIORITY: Record<OverlayKind, number> = {
  update: 1,
  confirm: 2,
  unlock: 3,
  onboarding: 4,
  modal: 5,
  sheet: 5,
  toast: 6,
}

export interface OverlayEntry {
  id: string
  kind: OverlayKind
  blocking: boolean
  close: () => void
}

interface OverlayApi {
  stack: OverlayEntry[]
  register: (entry: OverlayEntry) => void
  unregister: (id: string) => void
  replace: (id: string, entry: OverlayEntry) => void
  closeTop: () => boolean
  topBlocking: OverlayEntry | null
  topBlockingKind: OverlayKind | null
  canPresent: (kind: OverlayKind, ignoreId?: string) => boolean
}

const OverlayContext = createContext<OverlayApi | null>(null)

function isExclusive(kind: OverlayKind): boolean {
  return OVERLAY_PRIORITY[kind] < 5
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<OverlayEntry[]>([])

  const register = useCallback((entry: OverlayEntry) => {
    setStack((prev) => {
      const without = prev.filter((row) => row.id !== entry.id)
      return [...without, entry]
    })
  }, [])

  const unregister = useCallback((id: string) => {
    setStack((prev) => prev.filter((row) => row.id !== id))
  }, [])

  const replace = useCallback((id: string, entry: OverlayEntry) => {
    setStack((prev) => {
      const next = prev.filter((row) => row.id !== id && row.id !== entry.id)
      return [...next, entry]
    })
  }, [])

  const closeTop = useCallback(() => {
    let closed = false
    setStack((prev) => {
      if (prev.length === 0) return prev
      const top = prev[prev.length - 1]
      closed = true
      queueMicrotask(() => top.close())
      return prev.slice(0, -1)
    })
    return closed
  }, [])

  const topBlocking = useMemo(
    () => [...stack].reverse().find((row) => row.blocking) ?? null,
    [stack],
  )

  const canPresent = useCallback(
    (kind: OverlayKind, ignoreId?: string) => {
      if (kind === 'toast') return true
      const others = stack.filter((row) => row.id !== ignoreId)
      const exclusiveOpen = others.some((row) => row.blocking && isExclusive(row.kind))
      if (!exclusiveOpen) return true
      if (isExclusive(kind)) {
        const incoming = OVERLAY_PRIORITY[kind]
        return !others.some((row) => row.blocking && isExclusive(row.kind) && OVERLAY_PRIORITY[row.kind] < incoming)
      }
      return false
    },
    [stack],
  )

  const api = useMemo<OverlayApi>(
    () => ({
      stack,
      register,
      unregister,
      replace,
      closeTop,
      topBlocking,
      topBlockingKind: topBlocking?.kind ?? null,
      canPresent,
    }),
    [stack, register, unregister, replace, closeTop, topBlocking, canPresent],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (stack.length === 0) return
      e.preventDefault()
      const top = stack[stack.length - 1]
      top.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stack])

  return <OverlayContext.Provider value={api}>{children}</OverlayContext.Provider>
}

export function useOverlay(): OverlayApi {
  const ctx = useContext(OverlayContext)
  if (!ctx) {
    return {
      stack: [],
      register: () => undefined,
      unregister: () => undefined,
      replace: () => undefined,
      closeTop: () => false,
      topBlocking: null,
      topBlockingKind: null,
      canPresent: () => true,
    }
  }
  return ctx
}

/**
 * Register an open overlay, push history so Android/browser Back closes it first,
 * and refuse exclusive kinds that would stack over a higher-priority blocker.
 */
export function useOverlayLayer(opts: {
  id: string
  kind: OverlayKind
  open: boolean
  onClose: () => void
  blocking?: boolean
}): { allowed: boolean } {
  const api = useOverlay()
  const closeRef = useRef(opts.onClose)
  closeRef.current = opts.onClose
  const pushed = useRef(false)
  const blocking = opts.blocking ?? opts.kind !== 'toast'
  const allowed = !opts.open || api.canPresent(opts.kind, opts.id)

  useEffect(() => {
    if (!opts.open || !allowed) {
      api.unregister(opts.id)
      return
    }
    const entry: OverlayEntry = {
      id: opts.id,
      kind: opts.kind,
      blocking,
      close: () => closeRef.current(),
    }
    api.register(entry)
    return () => api.unregister(opts.id)
  }, [opts.open, opts.id, opts.kind, allowed, blocking, api])

  useEffect(() => {
    if (!opts.open || !allowed) {
      if (pushed.current) {
        pushed.current = false
        if (typeof history !== 'undefined' && history.state?.hwOverlay === opts.id) {
          history.back()
        }
      }
      return
    }
    if (typeof history === 'undefined') return
    history.pushState({ ...(history.state ?? {}), hwOverlay: opts.id }, '')
    pushed.current = true
    const onPop = () => {
      if (!pushed.current) return
      pushed.current = false
      closeRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (pushed.current) {
        pushed.current = false
        if (history.state?.hwOverlay === opts.id) history.back()
      }
    }
  }, [opts.open, opts.id, allowed])

  return { allowed }
}
