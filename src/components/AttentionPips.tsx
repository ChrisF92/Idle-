import type { AttentionFlags } from '../game/hubAttention'

interface AttentionPipsProps extends AttentionFlags {
  layout?: 'corner' | 'inline'
}

export function AttentionPips({ spend, fresh, layout = 'corner' }: AttentionPipsProps) {
  if (!spend && !fresh) return null
  return (
    <span className={layout === 'inline' ? 'attention-pips attention-pips-inline' : 'attention-pips'} aria-hidden>
      {spend ? <span className="attention-pip attention-pip-spend" /> : null}
      {fresh ? <span className="attention-pip attention-pip-fresh" /> : null}
    </span>
  )
}
