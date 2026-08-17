import { useEffect, useRef, useState } from 'react'

/** True for a short beat after `flag` rises, for one-shot local UI feedback. */
export function useJustBecame(flag: boolean, ms = 640): boolean {
  const prev = useRef(flag)
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (flag && !prev.current) {
      setOn(true)
      const t = window.setTimeout(() => setOn(false), ms)
      prev.current = flag
      return () => window.clearTimeout(t)
    }
    prev.current = flag
  }, [flag, ms])

  return on
}

export function markLocalOk(target: EventTarget | null): void {
  if (!(target instanceof HTMLElement)) return
  target.classList.remove('just-ok')
  void target.offsetWidth
  target.classList.add('just-ok')
}
