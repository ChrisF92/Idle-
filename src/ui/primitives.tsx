import { useId, type CSSProperties, type ReactNode } from 'react'
import { useOverlayLayer, type OverlayKind } from './overlay'

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="ui-kicker">{children}</p>
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'ok' | 'warn' }) {
  return <span className={`ui-badge is-${tone}`}>{children}</span>
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="ui-vh">{children}</span>
}

export function InfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="ui-info-btn" aria-label={label} onClick={onClick}>
      i
    </button>
  )
}

export function Screen({
  children,
  className = '',
  sticky,
  label,
}: {
  children: ReactNode
  className?: string
  sticky?: boolean
  label?: string
}) {
  return (
    <section className={`ui-screen${sticky ? ' has-sticky' : ''} ${className}`.trim()} aria-label={label}>
      {children}
    </section>
  )
}

export function ScreenHeader({
  title,
  action,
  kicker,
}: {
  title: ReactNode
  action?: ReactNode
  kicker?: ReactNode
}) {
  return (
    <header className="ui-screen-header">
      <div>
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <h2 className="ui-screen-title">{title}</h2>
      </div>
      {action}
    </header>
  )
}

export function ContextBar({ children }: { children: ReactNode }) {
  return <div className="ui-context-bar">{children}</div>
}

export function Section({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={`ui-section ${className}`.trim()}>{children}</section>
}

export function SectionHeader({
  title,
  action,
}: {
  title: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="ui-section-header">
      <h3 className="ui-section-title">{title}</h3>
      {action}
    </header>
  )
}

export function StatPair({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="ui-stat-pair">
      <span className="ui-meta">{label}</span>
      <strong className="ui-value">{value}</strong>
    </div>
  )
}

export function SummaryCard({
  title,
  value,
  secondary,
  progress,
  action,
  onClick,
}: {
  title: ReactNode
  value?: ReactNode
  secondary?: ReactNode
  progress?: number
  action?: ReactNode
  onClick?: () => void
}) {
  const inner = (
    <>
      <span className="ui-kicker">{title}</span>
      {value != null ? <strong className="ui-value">{value}</strong> : null}
      {secondary != null ? <span className="ui-meta">{secondary}</span> : null}
      {progress != null ? (
        <span className="ui-progress" aria-hidden>
          <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }} />
        </span>
      ) : null}
      {action}
    </>
  )
  if (onClick) {
    return (
      <button type="button" className="ui-summary-card is-button" onClick={onClick}>
        {inner}
      </button>
    )
  }
  return <article className="ui-summary-card">{inner}</article>
}

export function ItemRow({
  title,
  meta,
  value,
  onClick,
  disabled,
  guide,
  onboarding,
}: {
  title: ReactNode
  meta?: ReactNode
  value?: ReactNode
  onClick?: () => void
  disabled?: boolean
  guide?: string
  onboarding?: string
}) {
  return (
    <button
      type="button"
      className="ui-item-row"
      onClick={onClick}
      disabled={disabled || !onClick}
      data-guide={guide}
      data-onboarding={onboarding}
    >
      <span className="ui-item-row-copy">
        <strong>{title}</strong>
        {meta != null ? <span className="ui-meta">{meta}</span> : null}
      </span>
      {value != null ? <span className="ui-item-row-value">{value}</span> : <span className="ui-item-row-chevron">›</span>}
    </button>
  )
}

export function ItemGrid({ children }: { children: ReactNode }) {
  return <div className="ui-item-grid">{children}</div>
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="ui-empty">
      <strong>{title}</strong>
      {body ? <p className="ui-meta">{body}</p> : null}
    </div>
  )
}

export function StickyAction({
  children,
  guide,
  onboarding,
}: {
  children: ReactNode
  guide?: string
  onboarding?: string
}) {
  return (
    <div className="ui-sticky-action" data-guide={guide} data-onboarding={onboarding}>
      {children}
    </div>
  )
}

export function ConfirmModal({
  open,
  title,
  children,
  onClose,
  overlayId = 'confirm',
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  overlayId?: string
}) {
  const { allowed } = useOverlayLayer({
    id: overlayId,
    kind: 'confirm',
    open,
    onClose,
  })
  if (!open || !allowed) return null
  const titleId = `${overlayId}-title`
  return (
    <div className="ui-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ui-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h3 id={titleId}>{title}</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function BottomSheet({
  open,
  title,
  children,
  onClose,
  size = 'standard',
  overlayId,
  kind = 'sheet',
  footer,
  kicker,
}: {
  open: boolean
  title: ReactNode
  children: ReactNode
  onClose: () => void
  size?: 'compact' | 'standard' | 'full'
  overlayId?: string
  kind?: OverlayKind
  footer?: ReactNode
  kicker?: ReactNode
}) {
  const uid = useId()
  const id = overlayId ?? uid
  const { allowed } = useOverlayLayer({
    id,
    kind,
    open,
    onClose,
  })
  if (!open || !allowed) return null
  const titleId = `${id}-title`
  const height: CSSProperties = {
    maxHeight: size === 'compact' ? 'var(--sheet-compact)' : size === 'full' ? 'var(--sheet-full)' : 'var(--sheet-standard)',
    height: size === 'full' ? 'var(--sheet-full)' : undefined,
  }
  return (
    <div className={`ui-sheet-overlay is-${size}`} role="presentation" onClick={onClose}>
      <div
        className={`ui-sheet-card is-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={height}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            {kicker ? <Kicker>{kicker}</Kicker> : null}
            <h3 id={titleId}>{title}</h3>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="ui-sheet-scroll">{children}</div>
        {footer ? <div className="ui-sheet-footer">{footer}</div> : null}
      </div>
    </div>
  )
}

export function FullSheet(props: Omit<Parameters<typeof BottomSheet>[0], 'size'>) {
  return <BottomSheet {...props} size="full" />
}
