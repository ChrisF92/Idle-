import { BottomSheet } from '../ui/primitives'
import type { InspectCard } from '../game/inspect'

interface InspectModalProps {
  card: InspectCard
  onClose: () => void
}

export function InspectModal({ card, onClose }: InspectModalProps) {
  return (
    <BottomSheet
      open
      title={card.title}
      kicker={card.kicker}
      onClose={onClose}
      size="standard"
      overlayId={`inspect-${card.title}`}
      footer={
        <button type="button" className="primary" onClick={onClose}>
          Got it
        </button>
      }
    >
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
    </BottomSheet>
  )
}
