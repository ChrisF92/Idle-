import { useState } from 'react'
import type { InspectCard } from '../game/inspect'
import { InspectModal } from './InspectModal'

interface InspectNameProps {
  name: string
  card: InspectCard | null
}

/** Clickable row title that opens a USI-style inspect sheet. */
export function InspectName({ name, card }: InspectNameProps) {
  const [open, setOpen] = useState(false)
  if (!card) return <strong>{name}</strong>
  return (
    <>
      <button
        type="button"
        className="inspect-name"
        aria-label={`Inspect ${name}`}
        onClick={() => setOpen(true)}
      >
        {name}
      </button>
      {open ? <InspectModal card={card} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
