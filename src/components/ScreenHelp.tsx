import { useEffect, useId, useState } from 'react'
import type { TabId } from '../game/types'
import { screenHelpFor } from '../game/screenHelp'

interface ScreenHelpProps {
  screen: TabId
}

export function ScreenHelp({ screen }: ScreenHelpProps) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const help = screenHelpFor(screen)

  useEffect(() => {
    setOpen(false)
  }, [screen])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        className="screen-help-btn"
        aria-label={`${help.title} info`}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        i
      </button>
      {open ? (
        <div className="screen-help-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="screen-help-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="combat-hud-kicker">Info</p>
            <h3 id={titleId}>{help.title}</h3>
            {help.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <button type="button" className="primary" onClick={() => setOpen(false)}>
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
