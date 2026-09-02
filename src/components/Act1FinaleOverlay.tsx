import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useOverlayLayer } from '../ui/overlay'

interface Act1FinaleOverlayProps {
  open: boolean
  onContinue: () => void
  onOpenReinforce: () => void
}

export function Act1FinaleOverlay({ open, onContinue, onOpenReinforce }: Act1FinaleOverlayProps) {
  const reduced = usePrefersReducedMotion()
  const { allowed } = useOverlayLayer({
    id: 'act1-finale',
    kind: 'major',
    open,
    onClose: onContinue,
  })
  if (!open || !allowed) return null

  return (
    <div className="ui-modal-backdrop act1-finale-backdrop" role="presentation">
      <div
        className={`ui-modal-card act1-finale-card${reduced ? ' is-static' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="act1-finale-title"
      >
        <p className="ui-kicker">Wave 1000</p>
        <h3 id="act1-finale-title">Act 1 complete</h3>
        <p>
          The Choir Crown is destroyed. Rebuild has carried knowledge as far as this loop allows. Something in the
          Hive remembers this reconstruction — a stutter in time, as if the lattice has folded shut before.
        </p>
        <p>
          A deeper loop has been exposed. Reinforce is now visible as a possible future direction, but no
          second reset or Act 2 economy is defined here.
        </p>
        <div className="modal-actions">
          <button type="button" onClick={onContinue}>
            Continue
          </button>
          <button type="button" className="primary" onClick={onOpenReinforce}>
            View what lies beyond
          </button>
        </div>
      </div>
    </div>
  )
}
