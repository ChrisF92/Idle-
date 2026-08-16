import { useEffect, useLayoutEffect, useState } from 'react'
import { guideBodyLines, guideStepNeedsTap, type GuideStep } from '../game/progression'

interface GuideOverlayProps {
  step: GuideStep
  onComplete: (stepId: string) => void
  onSkip: (stepId: string) => void
}

type Hole = { top: number; left: number; width: number; height: number }

const SCROLL_PARENT_RE = /(auto|scroll|overlay)/

function scrollTargetIntoView(el: HTMLElement) {
  let parent: HTMLElement | null = el.parentElement
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent)
    const canScroll =
      SCROLL_PARENT_RE.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1
    if (canScroll) {
      const pRect = parent.getBoundingClientRect()
      const eRect = el.getBoundingClientRect()
      const offset = eRect.top - pRect.top - (parent.clientHeight / 2 - eRect.height / 2)
      parent.scrollTop += offset
    }
    parent = parent.parentElement
  }
}

/**
 * Spotlight coach-mark: dims the UI, punches a hole around [data-guide=target],
 * scrolls the nearest overflow parent so the target is on-screen, and advances
 * when the user taps it. Required steps hide Skip. Background scroll is locked.
 */
export function GuideOverlay({ step, onComplete, onSkip }: GuideOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const required = Boolean(step.required)
  const needsTap = guideStepNeedsTap(step)

  useEffect(() => {
    const html = document.documentElement
    const prevHtml = html.style.overflow
    const prevBody = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    const block = (e: Event) => {
      const node = e.target
      if (node instanceof Element && node.closest('.guide-tip')) return
      e.preventDefault()
    }
    document.addEventListener('wheel', block, { capture: true, passive: false })
    document.addEventListener('touchmove', block, { capture: true, passive: false })
    return () => {
      html.style.overflow = prevHtml
      document.body.style.overflow = prevBody
      document.removeEventListener('wheel', block, true)
      document.removeEventListener('touchmove', block, true)
    }
  }, [])

  // Bring the highlighted control on-screen whenever the step changes.
  useLayoutEffect(() => {
    const el = document.querySelector(`[data-guide="${step.target}"]`)
    if (!(el instanceof HTMLElement)) return

    scrollTargetIntoView(el)
    const measure = () => {
      scrollTargetIntoView(el)
      setRect(el.getBoundingClientRect())
    }
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
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', measure)
    }
  }, [step.target, step.id])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = document.querySelector(`[data-guide="${step.target}"]`)
      if (!el) return
      if (el === e.target || el.contains(e.target as Node)) {
        // completeWhen steps advance when the action lands in game state.
        if (step.completeWhen) return
        window.setTimeout(() => onComplete(step.id), 0)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [step.id, step.target, step.completeWhen, onComplete])

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

  return (
    <div
      className={`guide-root${required ? ' guide-root-required' : ''}`}
      aria-live="polite"
    >
      {hole ? (
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
      ) : (
        <div className="guide-block" style={{ inset: 0 }} />
      )}
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
        <p className="combat-hud-kicker">
          {needsTap ? 'Guide · tap the highlight' : 'Guide · paused'}
        </p>
        <h3>{step.title}</h3>
        <div className="guide-tip-body">
          {guideBodyLines(step).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {needsTap || !required ? (
          <div className="guide-tip-actions">
            {!required ? (
              <button type="button" onClick={() => onSkip(step.id)}>
                Skip
              </button>
            ) : (
              <span className="muted">Tap the highlighted control</span>
            )}
            {!needsTap ? (
              <button type="button" className="primary" onClick={() => onComplete(step.id)}>
                Continue
              </button>
            ) : null}
          </div>
        ) : (
          <div className="guide-tip-actions">
            <button type="button" className="primary" onClick={() => onComplete(step.id)}>
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function placeTip(hole: Hole | null): {
  side: 'top' | 'bottom'
  style: { top?: number; bottom?: number; left: number }
} {
  const tipMaxH = 240
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
