import { useEffect, useRef } from 'react'
import {
  equippedCoreVisuals,
  hiveDrawRadius,
  hiveFrameStyle,
  HIVE_VISUAL_RADIUS,
  paintHiveStation,
} from '../game/hiveVisual'
import { coreRoleColor } from '../game/combatVisual'
import type { GameState } from '../game/types'

/** Square, centered Dock hive — same station art as Sortie, never a side-scroll dart. */
export function DockHivePreview({ state }: { state: GameState }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameId = state.shipyard.frameId
  const coreKey = state.shipyard.modules.join('|')

  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const origin = performance.now()

    const frame = (now: number) => {
      const time = (now - origin) / 1000
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const css = Math.max(1, Math.min(canvas.clientWidth || 240, canvas.clientHeight || 240))
      const need = Math.floor(css * dpr)
      if (canvas.width !== need || canvas.height !== need) {
        canvas.width = need
        canvas.height = need
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, css, css)
      ctx.fillStyle = '#120e0c'
      ctx.beginPath()
      ctx.arc(css / 2, css / 2, css / 2, 0, Math.PI * 2)
      ctx.fill()

      ctx.save()
      ctx.translate(css / 2, css / 2)
      const hull = hiveDrawRadius(HIVE_VISUAL_RADIUS)
      const scale = (css * 0.22) / hull
      ctx.scale(scale, scale)
      paintHiveStation(ctx, hiveFrameStyle(frameId), hull, time, reduced)
      const cores = equippedCoreVisuals(stateRef.current)
      cores.forEach((core, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, cores.length) + time * core.speed * 0.15
        const orbit = core.orbit + 10
        ctx.beginPath()
        ctx.fillStyle = coreRoleColor(core.role)
        ctx.strokeStyle = '#ffe8c7'
        ctx.lineWidth = 0.8
        ctx.arc(Math.cos(angle) * orbit, Math.sin(angle) * orbit, 3.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      })
      ctx.restore()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [frameId, coreKey])

  return (
    <div className="dock-hive-preview">
      <canvas ref={canvasRef} className="dock-hive-canvas" width={240} height={240} aria-hidden />
    </div>
  )
}
