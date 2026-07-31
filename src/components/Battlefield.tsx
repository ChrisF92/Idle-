import { useEffect, useRef } from 'react'
import type { CombatFx, CombatUnit, UnitShape } from '../game/types'

interface BattlefieldProps {
  playerUnits: CombatUnit[]
  enemyUnits: CombatUnit[]
  fx: CombatFx[]
  inFight: boolean
}

interface Actor {
  id: string
  side: 'player' | 'enemy'
  shape: UnitShape
  name: string
  isBoss: boolean
  isFlagship: boolean
  family: string
  hull: number
  hullMax: number
  shield: number
  shieldMax: number
  /** Rest / lane base position */
  baseX: number
  baseY: number
  x: number
  y: number
  r: number
  bobPhase: number
  bobSpeed: number
  alive: boolean
  deathT: number
  hitFlash: number
  enterT: number
}

interface Projectile {
  id: string
  x: number
  y: number
  tx: number
  ty: number
  vx: number
  vy: number
  tag: string
  life: number
  maxLife: number
  splash: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

interface Scene {
  actors: Map<string, Actor>
  projectiles: Projectile[]
  particles: Particle[]
  seenFx: Set<string>
  prevHull: Map<string, number>
  width: number
  height: number
  time: number
  inFight: boolean
  starSeed: number
}

const VIEW_W = 640
const VIEW_H = 220

function tagColor(tag: string): string {
  switch (tag) {
    case 'energy':
      return '#7ec8ff'
    case 'pierce':
      return '#ffb347'
    case 'splash':
      return '#e0c07a'
    case 'antiShield':
      return '#c9a0ff'
    case 'dot':
      return '#8fd98f'
    default:
      return '#c8e0d0'
  }
}

function sideFill(side: 'player' | 'enemy', boss: boolean): string {
  if (side === 'player') return boss ? '#f0c987' : '#d4a574'
  return boss ? '#e07070' : '#8aa0b8'
}

function layoutSlot(
  index: number,
  side: 'player' | 'enemy',
  isBig: boolean,
): { x: number; y: number; r: number } {
  const col = index % 3
  const row = Math.floor(index / 3)
  const r = isBig ? 20 : 12
  if (side === 'player') {
    return {
      x: 56 + col * 40 + (isBig ? 6 : 0),
      y: 48 + row * 48 + (isBig ? 4 : 0),
      r,
    }
  }
  return {
    x: VIEW_W - 56 - col * 40 - (isBig ? 6 : 0),
    y: 48 + row * 48 + (isBig ? 4 : 0),
    r,
  }
}

function ensureActor(scene: Scene, unit: CombatUnit, index: number): Actor {
  const existing = scene.actors.get(unit.id)
  const isBig = unit.isBoss || unit.isFlagship
  const slot = layoutSlot(index, unit.side, isBig)
  if (existing) {
    existing.hull = unit.hull
    existing.hullMax = unit.hullMax
    existing.shield = unit.shield
    existing.shieldMax = unit.shieldMax
    existing.shape = unit.shape
    existing.isBoss = unit.isBoss
    existing.family = unit.family
    existing.baseX = slot.x
    existing.baseY = slot.y
    existing.r = slot.r
    if (unit.hull > 0 && !existing.alive) {
      existing.alive = true
      existing.deathT = 0
      existing.enterT = 0.35
      existing.x = slot.x + (unit.side === 'enemy' ? 40 : -40)
      existing.y = slot.y
    }
    if (unit.hull <= 0 && existing.alive) {
      existing.alive = false
      existing.deathT = 1
    }
    return existing
  }

  const actor: Actor = {
    id: unit.id,
    side: unit.side,
    shape: unit.shape,
    name: unit.name,
    isBoss: unit.isBoss,
    isFlagship: unit.isFlagship,
    family: unit.family,
    hull: unit.hull,
    hullMax: unit.hullMax,
    shield: unit.shield,
    shieldMax: unit.shieldMax,
    baseX: slot.x,
    baseY: slot.y,
    x: slot.x + (unit.side === 'enemy' ? 50 : -50),
    y: slot.y,
    r: slot.r,
    bobPhase: Math.random() * Math.PI * 2,
    bobSpeed: 1.6 + Math.random() * 1.4,
    alive: unit.hull > 0,
    deathT: unit.hull > 0 ? 0 : 0,
    hitFlash: 0,
    enterT: 0.45,
  }
  scene.actors.set(unit.id, actor)
  return actor
}

function spawnProjectile(scene: Scene, fx: CombatFx): void {
  const from = scene.actors.get(fx.fromId)
  const to = scene.actors.get(fx.toId)
  if (!from || !to) return

  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.max(1, Math.hypot(dx, dy))
  const speed = fx.tag === 'pierce' ? 520 : fx.tag === 'energy' ? 420 : 360
  const travel = dist / speed
  const splash = fx.tag === 'splash'
  const count = splash ? 3 : 1

  for (let i = 0; i < count; i += 1) {
    const spread = splash ? (i - 1) * 0.18 : 0
    const angle = Math.atan2(dy, dx) + spread
    const vx = Math.cos(angle) * speed
    const vy = Math.sin(angle) * speed
    scene.projectiles.push({
      id: `${fx.id}-${i}`,
      x: from.x,
      y: from.y,
      tx: to.x,
      ty: to.y,
      vx,
      vy,
      tag: fx.tag,
      life: travel * (splash ? 0.85 + i * 0.05 : 1),
      maxLife: travel * (splash ? 0.85 + i * 0.05 : 1),
      splash,
    })
  }
}

function spawnHit(scene: Scene, actor: Actor, tag: string): void {
  actor.hitFlash = 1
  const color = tagColor(tag)
  const n = tag === 'splash' ? 10 : 6
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2
    const sp = 40 + Math.random() * 120
    scene.particles.push({
      x: actor.x,
      y: actor.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.25 + Math.random() * 0.35,
      maxLife: 0.45,
      color,
      size: 1.5 + Math.random() * 2.5,
    })
  }
}

function syncScene(
  scene: Scene,
  playerUnits: CombatUnit[],
  enemyUnits: CombatUnit[],
  fx: CombatFx[],
  inFight: boolean,
): void {
  scene.inFight = inFight
  const livingIds = new Set<string>()

  playerUnits.forEach((u, i) => {
    livingIds.add(u.id)
    ensureActor(scene, u, i)
  })
  enemyUnits.forEach((u, i) => {
    livingIds.add(u.id)
    ensureActor(scene, u, i)
  })

  for (const [id, actor] of scene.actors) {
    if (!livingIds.has(id) && actor.alive) {
      actor.alive = false
      actor.deathT = 1
    }
  }

  for (const shot of fx) {
    if (scene.seenFx.has(shot.id)) continue
    scene.seenFx.add(shot.id)
    spawnProjectile(scene, shot)
  }

  // Trim seen set so it doesn't grow forever across fights
  if (scene.seenFx.size > 200) {
    scene.seenFx = new Set(fx.map((f) => f.id))
  }

  for (const actor of scene.actors.values()) {
    const prev = scene.prevHull.get(actor.id)
    if (prev != null && actor.hull < prev && actor.hull > 0) {
      spawnHit(scene, actor, 'kinetic')
    }
    scene.prevHull.set(actor.id, actor.hull)
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: UnitShape,
  r: number,
  fill: string,
  stroke: string,
  alpha: number,
): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1.4
  ctx.beginPath()
  if (shape === 'triangle') {
    ctx.moveTo(0, -r)
    ctx.lineTo(r, r * 0.85)
    ctx.lineTo(-r, r * 0.85)
    ctx.closePath()
  } else if (shape === 'square') {
    ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7)
  } else if (shape === 'diamond') {
    ctx.moveTo(0, -r)
    ctx.lineTo(r, 0)
    ctx.lineTo(0, r)
    ctx.lineTo(-r, 0)
    ctx.closePath()
  } else if (shape === 'hex') {
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i - Math.PI / 6
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2)
  }
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawStars(ctx: CanvasRenderingContext2D, scene: Scene): void {
  ctx.fillStyle = '#121820'
  ctx.fillRect(0, 0, scene.width, scene.height)

  // subtle nebula bands
  const g = ctx.createLinearGradient(0, 0, scene.width, scene.height)
  g.addColorStop(0, 'rgba(40, 70, 90, 0.35)')
  g.addColorStop(0.5, 'rgba(20, 30, 40, 0.1)')
  g.addColorStop(1, 'rgba(70, 50, 40, 0.25)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, scene.width, scene.height)

  let seed = scene.starSeed
  for (let i = 0; i < 48; i += 1) {
    seed = (seed * 16807) % 2147483647
    const x = (seed % 1000) / 1000 * scene.width
    seed = (seed * 16807) % 2147483647
    const y = (seed % 1000) / 1000 * scene.height
    seed = (seed * 16807) % 2147483647
    const twinkle = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(scene.time * 2 + i))
    ctx.fillStyle = `rgba(220,230,240,${twinkle})`
    ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1)
  }

  // lane divider
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.setLineDash([4, 6])
  ctx.beginPath()
  ctx.moveTo(scene.width / 2, 10)
  ctx.lineTo(scene.width / 2, scene.height - 10)
  ctx.stroke()
  ctx.setLineDash([])
}

function stepScene(scene: Scene, dt: number): void {
  scene.time += dt

  for (const actor of scene.actors.values()) {
    if (actor.enterT > 0) {
      actor.enterT = Math.max(0, actor.enterT - dt)
    }
    if (actor.hitFlash > 0) {
      actor.hitFlash = Math.max(0, actor.hitFlash - dt * 3)
    }
    if (!actor.alive) {
      if (actor.deathT > 0) actor.deathT = Math.max(0, actor.deathT - dt * 1.6)
      continue
    }

    actor.bobPhase += actor.bobSpeed * dt
    const bob = Math.sin(actor.bobPhase) * (actor.isBoss ? 3.5 : 2.2)
    const push = scene.inFight
      ? Math.sin(scene.time * 0.7 + actor.bobPhase) * (actor.side === 'player' ? 4 : -4)
      : 0
    const targetX = actor.baseX + push
    const targetY = actor.baseY + bob
    // ease toward slot
    actor.x += (targetX - actor.x) * Math.min(1, dt * 6)
    actor.y += (targetY - actor.y) * Math.min(1, dt * 6)
  }

  for (const p of scene.projectiles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.life -= dt
    if (p.life <= 0) {
      // impact particles at destination
      const target = [...scene.actors.values()].find(
        (a) => Math.hypot(a.x - p.tx, a.y - p.ty) < 28,
      )
      if (target) spawnHit(scene, target, p.tag)
      else {
        for (let i = 0; i < 4; i += 1) {
          const a = Math.random() * Math.PI * 2
          scene.particles.push({
            x: p.tx,
            y: p.ty,
            vx: Math.cos(a) * 60,
            vy: Math.sin(a) * 60,
            life: 0.2,
            maxLife: 0.2,
            color: tagColor(p.tag),
            size: 2,
          })
        }
      }
    }
  }
  scene.projectiles = scene.projectiles.filter((p) => p.life > 0)

  for (const part of scene.particles) {
    part.x += part.vx * dt
    part.y += part.vy * dt
    part.vx *= 0.92
    part.vy *= 0.92
    part.life -= dt
  }
  scene.particles = scene.particles.filter((p) => p.life > 0)

  // Drop fully dead actors after anim
  for (const [id, actor] of scene.actors) {
    if (!actor.alive && actor.deathT <= 0) {
      scene.actors.delete(id)
      scene.prevHull.delete(id)
    }
  }
}

function drawScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  drawStars(ctx, scene)

  // projectiles under ships look busier; draw trails first
  for (const p of scene.projectiles) {
    const color = tagColor(p.tag)
    const progress = 1 - p.life / p.maxLife
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.globalAlpha = 0.85
    ctx.lineWidth = p.tag === 'pierce' ? 2.4 : p.splash ? 1.4 : 2
    const tail = p.tag === 'energy' ? 18 : 12
    const ang = Math.atan2(p.vy, p.vx)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x - Math.cos(ang) * tail, p.y - Math.sin(ang) * tail)
    ctx.stroke()
    if (p.tag === 'energy') {
      ctx.globalAlpha = 0.35
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4 + progress * 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.splash ? 2 : 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  const actors = [...scene.actors.values()].sort((a, b) => a.y - b.y)
  for (const actor of actors) {
    const dying = !actor.alive
    const alpha = dying ? Math.max(0, actor.deathT) : 1
    if (alpha <= 0) continue
    const scale = dying ? 0.4 + actor.deathT * 0.6 : 1 - actor.enterT * 0.35
    const fill = sideFill(actor.side, actor.isBoss)
    const stroke = actor.side === 'player' ? '#ffe8c7' : '#c8d4e0'

    ctx.save()
    ctx.translate(actor.x, actor.y)
    ctx.scale(scale, scale)
    if (actor.hitFlash > 0) {
      ctx.shadowColor = '#fff'
      ctx.shadowBlur = 12 * actor.hitFlash
    }
    // slight facing: player points right, enemy left for triangles
    if (actor.shape === 'triangle' && actor.side === 'enemy') {
      ctx.scale(-1, 1)
    }
    drawShape(ctx, actor.shape, actor.r, fill, stroke, alpha)
    ctx.restore()

    // hull bar
    const barW = actor.r * 2
    const barX = actor.x - actor.r
    const barY = actor.y + actor.r + 4
    ctx.globalAlpha = alpha * 0.95
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(barX, barY, barW, 3)
    ctx.fillStyle = actor.side === 'player' ? '#e0b06a' : '#e07070'
    ctx.fillRect(
      barX,
      barY,
      barW * Math.max(0, actor.hull / Math.max(1, actor.hullMax)),
      3,
    )
    if (actor.shieldMax > 0 && actor.shield > 0) {
      ctx.fillStyle = '#7ec8ff'
      ctx.fillRect(
        barX,
        barY - 3,
        barW * Math.max(0, actor.shield / actor.shieldMax),
        2,
      )
    }
    ctx.globalAlpha = 1
  }

  for (const part of scene.particles) {
    ctx.globalAlpha = Math.max(0, part.life / part.maxLife)
    ctx.fillStyle = part.color
    ctx.beginPath()
    ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  if (!scene.inFight) {
    ctx.fillStyle = 'rgba(200, 210, 220, 0.45)'
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Standing by', scene.width / 2, scene.height - 14)
  }
}

export function Battlefield({
  playerUnits,
  enemyUnits,
  fx,
  inFight,
}: BattlefieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const propsRef = useRef({ playerUnits, enemyUnits, fx, inFight })
  propsRef.current = { playerUnits, enemyUnits, fx, inFight }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scene: Scene = {
      actors: new Map(),
      projectiles: [],
      particles: [],
      seenFx: new Set(),
      prevHull: new Map(),
      width: VIEW_W,
      height: VIEW_H,
      time: 0,
      inFight: false,
      starSeed: 1234567,
    }
    sceneRef.current = scene

    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      const rawDt = (now - last) / 1000
      last = now
      const dt = Math.min(0.05, Math.max(0, rawDt))

      const p = propsRef.current
      syncScene(scene, p.playerUnits, p.enemyUnits, p.fx, p.inFight)
      stepScene(scene, dt)

      // HiDPI
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cssW = canvas.clientWidth || VIEW_W
      const cssH = (cssW * VIEW_H) / VIEW_W
      const needW = Math.floor(cssW * dpr)
      const needH = Math.floor(cssH * dpr)
      if (canvas.width !== needW || canvas.height !== needH) {
        canvas.width = needW
        canvas.height = needH
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // draw in viewBox space scaled to css width
      const scale = cssW / VIEW_W
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
      scene.width = VIEW_W
      scene.height = VIEW_H
      drawScene(ctx, scene)

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      sceneRef.current = null
    }
  }, [])

  // Reset projectile memory when leaving a fight so next engage is fresh
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (!inFight) {
      scene.projectiles = []
      scene.seenFx.clear()
    }
  }, [inFight])

  return (
    <canvas
      ref={canvasRef}
      className="battlefield"
      width={VIEW_W}
      height={VIEW_H}
      role="img"
      aria-label="Fleet battlefield"
    />
  )
}
