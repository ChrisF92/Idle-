import { useEffect, useLayoutEffect, useState } from 'react'
import { targetElement, targetIsVisible, type SemanticTargetId } from '../game/onboarding'
import type { PresentationItem } from '../game/presentation'
import { useOverlayLayer } from '../ui/overlay'

interface OnboardingOverlayProps {
  item: PresentationItem
  onComplete: (lessonId: string) => void
  onSkip: (lessonId: string) => void
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
 * One blocking onboarding presentation. Waits for the semantic target to mount
 * before cutting a spotlight — never points at empty space.
 */
export function OnboardingOverlay({ item, onComplete, onSkip }: OnboardingOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)
  const lessonId = item.lessonId ?? item.id
  const target = item.target as SemanticTargetId | undefined
  const payoff = item.phase === 'payoff'
  const needsTap = Boolean(item.actionLabel) && !payoff
  useOverlayLayer({
    id: `onboarding-${item.id}`,
    kind: 'onboarding',
    open: true,
    closeOnBack: item.skippable,
    onClose: () => {
      if (item.skippable) onSkip(lessonId)
    },
  })

  useLayoutEffect(() => {
    if (!target) {
      setMounted(true)
      setRect(null)
      return
    }
    const measure = () => {
      const el = targetElement(target)
      if (!el || !targetIsVisible(el)) {
        setMounted(false)
        setRect(null)
        return
      }
      scrollTargetIntoView(el)
      setMounted(true)
      setRect(el.getBoundingClientRect())
    }
    measure()
    const t1 = window.setTimeout(measure, 50)
    const t2 = window.setTimeout(measure, 320)
    const id = window.setInterval(measure, 200)
    window.addEventListener('resize', measure)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearInterval(id)
      window.removeEventListener('resize', measure)
    }
  }, [target, item.id])

  useEffect(() => {
    if (!target || payoff) return
    const onClick = (e: MouseEvent) => {
      const el = targetElement(target)
      if (!el) return
      if (el === e.target || el.contains(e.target as Node)) {
        if (!item.completeOnTap) return
        window.setTimeout(() => onComplete(lessonId), 0)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [item.id, item.phase, item.completeOnTap, target, lessonId, onComplete, payoff])

  const pad = 8
  const hole: Hole | null = mounted && rect
    ? {
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null

  if (target && !mounted) {
    return <div className="guide-root" aria-hidden />
  }

  const tipPlacement = placeTip(hole)
  const kicker = payoff ? 'Payoff' : item.pause ? 'Paused' : needsTap ? 'Tap the highlight' : 'Guide'

  return (
    <div className={`guide-root guide-root-action${item.required ? ' guide-root-required' : ''}`} aria-live="polite">
      {hole ? (
        <>
          <div className="guide-block" style={{ top: 0, left: 0, right: 0, height: hole.top }} />
          <div
            className="guide-block"
            style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }}
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
            style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className="guide-hole"
            style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
          />
        </>
      ) : (
        <div className="guide-dim" />
      )}
      <div
        className={`guide-tip guide-tip-action guide-tip-${tipPlacement.side}`}
        style={tipPlacement.style}
        role="dialog"
        aria-label={item.title}
      >
        <p className="combat-hud-kicker">{kicker}</p>
        <h3>{item.title}</h3>
        <div className="guide-tip-body">
          {item.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {item.actionLabel && !payoff ? <p className="guide-tip-action-label">{item.actionLabel}</p> : null}
        <div className="guide-tip-actions">
          {item.skippable ? (
            <button type="button" onClick={() => onSkip(lessonId)}>
              Skip
            </button>
          ) : (
            <span />
          )}
          {payoff || !needsTap ? (
            <button type="button" className="primary" onClick={() => onComplete(lessonId)}>
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

export const GuideOverlay = OnboardingOverlay

function placeTip(hole: Hole | null): {
  side: 'top' | 'bottom'
  style: { top?: number; bottom?: number; left: number }
} {
  const tipMaxH = 220
  const margin = 12
  const left = 12
  if (!hole) return { side: 'bottom', style: { bottom: 24, left } }
  const holeMidY = hole.top + hole.height / 2
  const preferTop = holeMidY > window.innerHeight * 0.45
  const spaceAbove = hole.top - margin
  const spaceBelow = window.innerHeight - (hole.top + hole.height) - margin
  if (preferTop && spaceAbove >= 80) {
    return {
      side: 'top',
      style: { top: Math.max(margin, Math.min(hole.top - tipMaxH - 8, 72)), left },
    }
  }
  if (spaceBelow >= 80) {
    return {
      side: 'bottom',
      style: {
        top: Math.min(window.innerHeight - tipMaxH - margin, hole.top + hole.height + 10),
        left,
      },
    }
  }
  if (preferTop) return { side: 'top', style: { top: margin, left } }
  return { side: 'bottom', style: { bottom: 24, left } }
}
