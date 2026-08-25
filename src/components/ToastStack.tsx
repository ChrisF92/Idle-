import type { PresentationItem, PresentationNav } from '../game/presentation'
import { useOverlayLayer } from '../ui/overlay'

interface ToastStackProps {
  item: PresentationItem | null
  onDismiss: (id: string) => void
  onAction: (nav: PresentationNav) => void
}

export function ToastStack({ item, onDismiss, onAction }: ToastStackProps) {
  const open = Boolean(item && item.kind === 'toast')
  useOverlayLayer({
    id: 'presentation-toast',
    kind: 'toast',
    open,
    closeOnBack: false,
    blocking: false,
    onClose: () => undefined,
  })
  if (!item || item.kind !== 'toast') {
    return <div className="toast-live" aria-live="polite" aria-atomic="true" />
  }

  const compact = item.class === 'minor'
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      <div className="toast-live vis-hidden" aria-live="polite" aria-atomic="true">
        {item.kicker}. {item.title}. {item.body.join(' ')}
      </div>
      <article className={`toast-card toast-${item.class}`} role="status">
        {item.kicker ? <p className="toast-kicker">{item.kicker}</p> : null}
        <h3 className="toast-title">{item.title}</h3>
        {item.body[0] ? <p className="toast-body">{item.body.join(' ')}</p> : null}
        {compact && !item.action ? null : (
          <div className="toast-actions">
            {item.action ? (
              <button
                type="button"
                className="primary toast-action"
                onClick={() => {
                  onAction(item.action!.nav)
                  onDismiss(item.id)
                }}
              >
                {item.action.label}
              </button>
            ) : (
              <span />
            )}
            {item.dismissible ? (
              <button type="button" className="toast-dismiss" onClick={() => onDismiss(item.id)}>
                Dismiss
              </button>
            ) : null}
          </div>
        )}
      </article>
    </div>
  )
}
