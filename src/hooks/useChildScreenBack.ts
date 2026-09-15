import { useEffect, useRef } from 'react'

/** Registers a single history entry for an app child screen. */
export function useChildScreenBack(routeKey: string | null, onBack: () => void) {
  const backRef = useRef(onBack)
  backRef.current = onBack

  useEffect(() => {
    if (!routeKey || typeof history === 'undefined') return
    const previous = typeof history.state === 'object' && history.state ? history.state : {}
    history.pushState({ ...previous, hwChild: routeKey }, '')
    let active = true

    const onPop = (event: PopStateEvent) => {
      if (!active || event.state?.hwChild === routeKey) return
      active = false
      backRef.current()
    }

    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (!active) return
      active = false
      if (history.state?.hwChild === routeKey) {
        history.replaceState({ ...(history.state ?? {}), hwChild: undefined }, '')
      }
    }
  }, [routeKey])
}
