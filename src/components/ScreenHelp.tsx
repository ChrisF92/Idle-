import { useEffect, useState } from 'react'
import type { TabId } from '../game/types'
import { screenHelpFor } from '../game/screenHelp'
import { BottomSheet } from '../ui/primitives'

interface ScreenHelpProps {
  screen: TabId
}

export function ScreenHelp({ screen }: ScreenHelpProps) {
  const [open, setOpen] = useState(false)
  const help = screenHelpFor(screen)

  useEffect(() => {
    setOpen(false)
  }, [screen])

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
      <BottomSheet
        open={open}
        title={help.title}
        kicker="Info"
        onClose={() => setOpen(false)}
        size="compact"
        overlayId={`screen-help-${screen}`}
        footer={
          <button type="button" className="primary" onClick={() => setOpen(false)}>
            Got it
          </button>
        }
      >
        {help.body.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </BottomSheet>
    </>
  )
}
