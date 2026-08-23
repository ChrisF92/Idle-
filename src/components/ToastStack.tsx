import type { QueuedToast, ToastNav } from '../game/toasts'
import { TOAST_MAX_VISIBLE, toastTier } from '../game/toasts'

interface ToastStackProps {
  toasts: QueuedToast[]
  suppressed?: boolean
  onDismiss: (id: string) => void
  onAction: (nav: ToastNav) => void
}

export function ToastStack({ toasts, suppressed = false, onDismiss, onAction }: ToastStackProps) {
  const majors = toasts.filter((t) => toastTier(t) === 'major')
  const rest = toasts.filter((t) => toastTier(t) !== 'major')
  const visible = (majors.length > 0 ? [majors[0], ...rest] : rest).slice(0, TOAST_MAX_VISIBLE)
  if (suppressed || visible.length === 0) {
    return <div className="toast-live" aria-live="polite" aria-atomic="true" />
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      <div className="toast-live vis-hidden" aria-live="polite" aria-atomic="true">
        {visible.map((t) => `${t.category}. ${t.title}. ${t.body}`).join(' ')}
      </div>
      {visible.map((toast) => (
        <article
          key={toast.key}
          className={`toast-card toast-${toastTier(toast)}`}
          role="status"
        >
          <p className="toast-kicker">{toast.category}</p>
          <h3 className="toast-title">{toast.title}</h3>
          <p className="toast-body">{toast.body}</p>
          <div className="toast-actions">
            {toast.action ? (
              <button
                type="button"
                className="primary toast-action"
                onClick={() => {
                  onAction(toast.action!.nav)
                  onDismiss(toast.id)
                }}
              >
                {toast.action.label} →
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="toast-dismiss" onClick={() => onDismiss(toast.id)}>
              Dismiss
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
