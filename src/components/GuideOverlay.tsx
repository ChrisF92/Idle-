import { useEffect, useLayoutEffect, useState } from 'react'
import type { GuideStep } from '../game/progression'

interface GuideOverlayProps {
  step: GuideStep
  onComplete: (stepId: string) => void
  onSkip: (stepId: string) => void
}

type Hole = { top: number; left: number; width: number; height: number }

/**
 * Spotlight coach-mark: dims the UI, punches a hole around [data-guide=target],
 * scrolls the target into view, and advances when the user taps it.
 * Required steps hide Skip and block clicks outside the hole.
 */
export function GuideOverlay({ step, onComplete, onSkip }: GuideOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const required = Boolean(step.required)

  // Bring the highlighted control on-screen whenever the step changes.
  useLayoutEffect(() => {
    const el = document.querySelector(`[data-guide="${step.target}"]`)
    if (!(el instanceof HTMLElement)) return

    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
    const measure = () => setRect(el.getBoundingClientRect())
    const t1 = window.setTimeout(measure, 50)
    const t2 = window.setTimeout(measure, 320)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [step.target, step.id])

  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector(`[data-guide="${step.target}"]`)
      if (!el) {
        setRect(null)
        return
      }
      setRect(el.getBoundingClientRect())
    }
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
        // Required steps with completeWhen advance via App state polls only.
        if (required && step.completeWhen) return
        window.setTimeout(() => onComplete(step.id), 0)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [step.id, step.target, step.completeWhen, required, onComplete])

  const pad = 8
  const hole: Hole | null = rect
    ? {
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null

  const tipPlacement = placeTip(hole)
  const targetOffscreen = rect
    ? rect.bottom < 8 || rect.top > window.innerHeight - 8
    : false

  return (
    <div
      className={`guide-root${required ? ' guide-root-required' : ''}`}
      aria-live="polite"
    >
      {required && hole ? (
        <>
          <div
            className="guide-block"
            style={{ top: 0, left: 0, right: 0, height: hole.top }}
          />
          <div
            className="guide-block"
            style={{
              top: hole.top,
              left: 0,
              width: hole.left,
              height: hole.height,
            }}
          />
          <div
            className="guide-block"
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              right: 0,
              height: hole.height,
            }}
          />
          <div
            className="guide-block"
            style={{
              top: hole.top + hole.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
        </>
      ) : null}
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
      <div
        className={`guide-tip guide-tip-${tipPlacement.side}`}
        style={tipPlacement.style}
        role="dialog"
        aria-label={step.title}
      >
        <p className="combat-hud-kicker">Guide</p>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        {targetOffscreen ? (
          <p className="notice-warn">Scroll to the highlighted control.</p>
        ) : null}
        <div className="guide-tip-actions">
          {!required ? (
            <button type="button" onClick={() => onSkip(step.id)}>
              Skip
            </button>
          ) : (
            <span className="muted">Required</span>
          )}
          {!hole ? (
            <button
              type="button"
              className="primary"
              onClick={() => onComplete(step.id)}
              disabled={required && Boolean(step.completeWhen)}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const el = document.querySelector(`[data-guide="${step.target}"]`)
                if (el instanceof HTMLElement) {
                  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
                }
              }}
            >
              Find control
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function placeTip(hole: Hole | null): {
  side: 'top' | 'bottom'
  style: { top?: number; bottom?: number; left: number }
} {
  const tipMaxH = 170
  const margin = 12
  const left = 12

  if (!hole) {
    return { side: 'top', style: { top: 72, left } }
  }

  const holeMidY = hole.top + hole.height / 2
  const preferTop = holeMidY > window.innerHeight * 0.45
  const spaceAbove = hole.top - margin
  const spaceBelow = window.innerHeight - (hole.top + hole.height) - margin

  if (preferTop && spaceAbove >= 100) {
    return {
      side: 'top',
      style: { top: Math.max(margin, Math.min(hole.top - tipMaxH - 8, 72)), left },
    }
  }

  if (spaceBelow >= 100) {
    return {
      side: 'bottom',
      style: {
        top: Math.min(window.innerHeight - tipMaxH - margin, hole.top + hole.height + 10),
        left,
      },
    }
  }

  if (preferTop) {
    return { side: 'top', style: { top: margin, left } }
  }
  return { side: 'bottom', style: { bottom: margin, left } }
}
