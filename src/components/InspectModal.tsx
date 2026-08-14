import { useEffect, useId } from 'react'
import type { InspectCard } from '../game/inspect'

interface InspectModalProps {
  card: InspectCard
  onClose: () => void
}

export function InspectModal({ card, onClose }: InspectModalProps) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="screen-help-backdrop" role="presentation" onClick={onClose}>
      <div
        className="screen-help-card inspect-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {card.kicker ? <p className="combat-hud-kicker">{card.kicker}</p> : null}
        <h3 id={titleId}>{card.title}</h3>
        {card.stats.length > 0 ? (
          <dl className="inspect-stats">
            {card.stats.map((row) => (
              <div key={`${row.label}-${row.value}`} className="inspect-stat">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {card.body.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <button type="button" className="primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
