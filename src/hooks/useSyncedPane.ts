import { useLayoutEffect, useState } from 'react'

/** Local pane state that jumps when a guide, toast, or caller requests another pane. */
export function useSyncedPane<T extends string>(fallback: T, hint?: T | null): [T, (next: T) => void] {
  const [pane, setPane] = useState<T>(hint ?? fallback)
  useLayoutEffect(() => {
    if (hint) setPane(hint)
  }, [hint])
  return [pane, setPane]
}
