import { useEffect, useLayoutEffect, useState } from 'react'
import type { GuideStep } from '../game/progression'

interface GuideOverlayProps {
  step: GuideStep
  onComplete: (stepId: string) => void
  onSkip: (stepId: string) => void
}

/**
 * Spotlight coach-mark: dims the UI, punches a hole around [data-guide=target],
 * and advances when the user clicks the highlighted control.
 */
export function GuideOverlay({ step, onComplete, onSkip }: GuideOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  const measure = () => {
    const el = document.querySelector(`[data-guide="${step.target}"]`)
    if (!el) {
      setRect(null)
      return
    }
    setRect(el.getBoundingClientRect())
  }

  useLayoutEffect(() => {
    measure()
    const id = window.setInterval(measure, 200)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step.target, step.id])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = document.querySelector(`[data-guide="${step.target}"]`)
      if (!el) return
      if (el === e.target || el.contains(e.target as Node)) {
        // Let the click apply, then complete on next frame.
        window.setTimeout(() => onComplete(step.id), 0)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [step.id, step.target, onComplete])

  const pad = 6
  const hole = rect
    ? {
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null

  const tipStyle = hole
    ? {
        top: Math.min(window.innerHeight - 140, hole.top + hole.height + 12),
        left: Math.min(window.innerWidth - 300, Math.max(12, hole.left)),
      }
    : { top: 80, left: 16 }

  return (
    <div className="guide-root" aria-live="polite">
      {hole ? (
        <div
          className="guide-hole"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
          }}
        />
      ) : (
        <div className="guide-dim" />
      )}
      <div className="guide-tip" style={tipStyle} role="dialog" aria-label={step.title}>
        <p className="combat-hud-kicker">Guide</p>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="guide-tip-actions">
          <button type="button" onClick={() => onSkip(step.id)}>
            Skip
          </button>
          {!hole ? (
            <button type="button" className="primary" onClick={() => onComplete(step.id)}>
              Continue
            </button>
          ) : (
            <span className="muted">Tap the highlighted control</span>
          )}
        </div>
      </div>
    </div>
  )
}
