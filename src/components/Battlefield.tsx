import { useEffect, useRef } from 'react'
import type { CombatFx, CombatUnit, UnitShape, WeaponInstance } from '../game/types'

export type BattlefieldMode = 'fighting' | 'repairing' | 'holding' | 'ready'

interface BattlefieldProps {
  playerUnits: CombatUnit[]
  enemyUnits: CombatUnit[]
  fx: CombatFx[]
  mode: BattlefieldMode
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
  baseX: number
  baseY: number
  x: number
  y: number
  r: number
  bobPhase: number
  bobSpeed: number
  driftAmp: number
  alive: boolean
  deathT: number
  hitFlash: number
  enterT: number
  muzzle: number
  fireAcc: number
  fireEvery: number
  weaponTag: string
  splash: number
}

interface Projectile {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  tag: string
  life: number
  maxLife: number
  radius: number
  fromSide: 'player' | 'enemy'
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
  mode: BattlefieldMode
  starSeed: number
  scroll: number
  projSeq: number
}

const VIEW_W = 640
const VIEW_H = 240

function tagColor(tag: string): string {
  switch (tag) {
    case 'energy':
    case 'antiShield':
      return '#7ec8ff'
    case 'pierce':
      return '#ffb347'
    case 'splash':
      return '#e0c07a'
    case 'dot':
      return '#8fd98f'
    default:
      return '#d8f0e0'
  }
}

function sideFill(side: 'player' | 'enemy', boss: boolean): string {
  if (side === 'player') return boss ? '#f0c987' : '#e0b06a'
  return boss ? '#ff6b6b' : '#9eb4cc'
}

function primaryWeapon(weapons: WeaponInstance[]): {
  every: number
  tag: string
  splash: number
} {
  const w = weapons[0]
  if (!w) return { every: 0.55, tag: 'kinetic', splash: 0 }
  return {
    every: Math.max(0.28, Math.min(1.4, w.cooldown * 0.55)),
    tag: w.tags[0] ?? 'kinetic',
    splash: w.splash > 0 || w.tags.includes('splash') ? 2 : 0,
  }
}

function layoutSlot(
  index: number,
  side: 'player' | 'enemy',
  isBig: boolean,
): { x: number; y: number; r: number } {
  const col = index % 3
  const row = Math.floor(index / 3)
  const r = isBig ? 22 : 13
  if (side === 'player') {
    return {
      x: 64 + col * 44 + (isBig ? 8 : 0),
      y: 52 + row * 52 + (isBig ? 6 : 0),
      r,
    }
  }
  return {
    x: VIEW_W - 64 - col * 44 - (isBig ? 8 : 0),
    y: 52 + row * 52 + (isBig ? 6 : 0),
    r,
  }
}

function ensureActor(scene: Scene, unit: CombatUnit, index: number): Actor {
  const existing = scene.actors.get(unit.id)
  const isBig = unit.isBoss || unit.isFlagship
  const slot = layoutSlot(index, unit.side, isBig)
  const wpn = primaryWeapon(unit.weapons)

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
    if (unit.weapons.length > 0) {
      existing.fireEvery = wpn.every
      existing.weaponTag = wpn.tag
      existing.splash = wpn.splash
    }
    if (unit.hull > 0 && !existing.alive) {
      existing.alive = true
      existing.deathT = 0
      existing.enterT = 0.35
      existing.x = slot.x + (unit.side === 'enemy' ? 48 : -48)
      existing.y = slot.y
    }
    if (unit.hull <= 0 && existing.alive) {
      existing.alive = false
      existing.deathT = 1
      burst(scene, existing.x, existing.y, sideFill(existing.side, existing.isBoss), 14)
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
    x: slot.x + (unit.side === 'enemy' ? 56 : -56),
    y: slot.y,
    r: slot.r,
    bobPhase: Math.random() * Math.PI * 2,
    bobSpeed: 2.2 + Math.random() * 2.2,
    driftAmp: (isBig ? 7 : 5) + Math.random() * 3,
    alive: unit.hull > 0,
    deathT: 0,
    hitFlash: 0,
    enterT: 0.4,
    muzzle: 0,
    fireAcc: Math.random() * wpn.every,
    fireEvery: wpn.every,
    weaponTag: wpn.tag,
    splash: wpn.splash,
  }
  scene.actors.set(unit.id, actor)
  return actor
}

function burst(scene: Scene, x: number, y: number, color: string, n: number): void {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2
    const sp = 50 + Math.random() * 160
    scene.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.2 + Math.random() * 0.4,
      maxLife: 0.5,
      color,
      size: 1.5 + Math.random() * 3,
    })
  }
}

function spawnShot(
  scene: Scene,
  from: Actor,
  to: Actor,
  tag: string,
  splashExtra = 0,
): void {
  const count = 1 + splashExtra
  for (let i = 0; i < count; i += 1) {
    const spread = splashExtra > 0 ? (i - (count - 1) / 2) * 0.22 : (Math.random() - 0.5) * 0.08
    const dx = to.x - from.x
    const dy = to.y - from.y + spread * 40
    const dist = Math.max(1, Math.hypot(dx, dy))
    const speed =
      tag === 'pierce' ? 640 : tag === 'energy' || tag === 'antiShield' ? 520 : 480
    const ang = Math.atan2(dy, dx) + spread
    const life = dist / speed
    scene.projSeq += 1
    scene.projectiles.push({
      id: `p-${scene.projSeq}`,
      x: from.x,
      y: from.y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      tag,
      life,
      maxLife: life,
      radius: tag === 'pierce' ? 3.2 : splashExtra > 0 ? 2.2 : 2.8,
      fromSide: from.side,
    })
  }
  from.muzzle = 1
}

function pickFoe(scene: Scene, side: 'player' | 'enemy'): Actor | null {
  const foes = [...scene.actors.values()].filter((a) => a.alive && a.side !== side)
  if (foes.length === 0) return null
  foes.sort((a, b) => {
    if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1
    return a.hull / a.hullMax - b.hull / b.hullMax
  })
  return foes[0] ?? null
}

function syncScene(
  scene: Scene,
  playerUnits: CombatUnit[],
  enemyUnits: CombatUnit[],
  fx: CombatFx[],
  mode: BattlefieldMode,
): void {
  scene.mode = mode
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
      burst(scene, actor.x, actor.y, sideFill(actor.side, actor.isBoss), 12)
    }
  }

  // Sim FX still spawn extras (keeps visual tied to real hits)
  for (const shot of fx) {
    if (scene.seenFx.has(shot.id)) continue
    scene.seenFx.add(shot.id)
    const from = scene.actors.get(shot.fromId)
    const to = scene.actors.get(shot.toId)
    if (from && to) {
      spawnShot(scene, from, to, shot.tag, shot.tag === 'splash' ? 2 : 0)
      burst(scene, to.x, to.y, tagColor(shot.tag), 5)
      to.hitFlash = 1
    }
  }
  if (scene.seenFx.size > 240) {
    scene.seenFx = new Set(fx.map((f) => f.id))
  }

  for (const actor of scene.actors.values()) {
    const prev = scene.prevHull.get(actor.id)
    if (prev != null && actor.hull < prev) {
      actor.hitFlash = 1
      burst(scene, actor.x, actor.y, tagColor('kinetic'), actor.hull <= 0 ? 14 : 6)
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
  ctx.lineWidth = 1.6
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

function drawBackground(ctx: CanvasRenderingContext2D, scene: Scene): void {
  ctx.fillStyle = '#0e141c'
  ctx.fillRect(0, 0, scene.width, scene.height)

  const g = ctx.createLinearGradient(0, 0, scene.width, scene.height)
  g.addColorStop(0, 'rgba(36, 70, 96, 0.45)')
  g.addColorStop(0.55, 'rgba(18, 28, 40, 0.15)')
  g.addColorStop(1, 'rgba(80, 48, 36, 0.35)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, scene.width, scene.height)

  let seed = scene.starSeed
  const scroll = scene.scroll
  for (let i = 0; i < 64; i += 1) {
    seed = (seed * 16807) % 2147483647
    const baseX = (seed % 1000) / 1000 * scene.width
    seed = (seed * 16807) % 2147483647
    const y = (seed % 1000) / 1000 * scene.height
    const layer = i % 3 === 0 ? 1.6 : i % 3 === 1 ? 1 : 0.55
    const x = (baseX - scroll * layer * 40 + scene.width * 8) % scene.width
    const twinkle = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(scene.time * 3 + i))
    ctx.fillStyle = `rgba(230,238,248,${twinkle})`
    const s = i % 9 === 0 ? 2.2 : 1
    ctx.fillRect(x, y, s, s)
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.setLineDash([5, 8])
  ctx.beginPath()
  ctx.moveTo(scene.width / 2, 12)
  ctx.lineTo(scene.width / 2, scene.height - 28)
  ctx.stroke()
  ctx.setLineDash([])
}

function stepScene(scene: Scene, dt: number): void {
  scene.time += dt
  const advancing = scene.mode === 'fighting' || scene.mode === 'ready'
  scene.scroll += dt * (advancing ? 0.55 : scene.mode === 'repairing' ? 0.12 : 0.25)

  for (const actor of scene.actors.values()) {
    if (actor.enterT > 0) actor.enterT = Math.max(0, actor.enterT - dt)
    if (actor.hitFlash > 0) actor.hitFlash = Math.max(0, actor.hitFlash - dt * 4)
    if (actor.muzzle > 0) actor.muzzle = Math.max(0, actor.muzzle - dt * 5)

    if (!actor.alive) {
      if (actor.deathT > 0) actor.deathT = Math.max(0, actor.deathT - dt * 1.8)
      continue
    }

    actor.bobPhase += actor.bobSpeed * dt
    const bob = Math.sin(actor.bobPhase) * (actor.isBoss ? 5 : 3.4)
    const drift =
      Math.sin(scene.time * 1.1 + actor.bobPhase * 0.7) *
      actor.driftAmp *
      (actor.side === 'player' ? 1 : -1) *
      (scene.mode === 'fighting' ? 1.35 : 0.7)
    const targetX = actor.baseX + drift
    const targetY = actor.baseY + bob
    actor.x += (targetX - actor.x) * Math.min(1, dt * 7)
    actor.y += (targetY - actor.y) * Math.min(1, dt * 7)

    // Presentation-only continuous fire while fighting
    if (scene.mode === 'fighting') {
      actor.fireAcc += dt
      if (actor.fireAcc >= actor.fireEvery) {
        actor.fireAcc -= actor.fireEvery
        const foe = pickFoe(scene, actor.side)
        if (foe) spawnShot(scene, actor, foe, actor.weaponTag, actor.splash)
      }
    }

    // Repair pulse particles on flagship
    if (scene.mode === 'repairing' && actor.isFlagship && actor.side === 'player') {
      if (Math.random() < dt * 8) {
        scene.particles.push({
          x: actor.x + (Math.random() - 0.5) * 16,
          y: actor.y + 10,
          vx: (Math.random() - 0.5) * 20,
          vy: -30 - Math.random() * 40,
          life: 0.5,
          maxLife: 0.5,
          color: '#7dffb0',
          size: 2,
        })
      }
    }
  }

  for (const p of scene.projectiles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.life -= dt
    if (p.life <= 0) {
      burst(scene, p.x, p.y, tagColor(p.tag), p.tag === 'splash' ? 8 : 4)
      // soft hit flash on nearest living foe
      let best: Actor | null = null
      let bestD = 40
      for (const a of scene.actors.values()) {
        if (!a.alive || a.side === p.fromSide) continue
        const d = Math.hypot(a.x - p.x, a.y - p.y)
        if (d < bestD) {
          bestD = d
          best = a
        }
      }
      if (best) best.hitFlash = 1
    }
  }
  scene.projectiles = scene.projectiles.filter((p) => p.life > 0)

  for (const part of scene.particles) {
    part.x += part.vx * dt
    part.y += part.vy * dt
    part.vx *= 0.9
    part.vy *= 0.9
    part.life -= dt
  }
  scene.particles = scene.particles.filter((p) => p.life > 0)

  for (const [id, actor] of scene.actors) {
    if (!actor.alive && actor.deathT <= 0) {
      scene.actors.delete(id)
      scene.prevHull.delete(id)
    }
  }
}

function drawScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  drawBackground(ctx, scene)

  for (const p of scene.projectiles) {
    const color = tagColor(p.tag)
    const ang = Math.atan2(p.vy, p.vx)
    const tail = p.tag === 'pierce' ? 22 : p.tag === 'energy' || p.tag === 'antiShield' ? 18 : 14
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.globalAlpha = 0.95
    ctx.lineWidth = p.tag === 'pierce' ? 3 : 2.2
    ctx.shadowColor = color
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x - Math.cos(ang) * tail, p.y - Math.sin(ang) * tail)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const actors = [...scene.actors.values()].sort((a, b) => a.y - b.y)
  for (const actor of actors) {
    const dying = !actor.alive
    const alpha = dying ? Math.max(0, actor.deathT) : 1
    if (alpha <= 0) continue
    const scale = dying ? 0.35 + actor.deathT * 0.65 : 1 - actor.enterT * 0.3
    const fill = sideFill(actor.side, actor.isBoss)
    const stroke = actor.side === 'player' ? '#ffe8c7' : '#d0dce8'

    ctx.save()
    ctx.translate(actor.x, actor.y)
    ctx.scale(scale, scale)
    if (actor.hitFlash > 0) {
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = 16 * actor.hitFlash
    } else if (scene.mode === 'repairing' && actor.isFlagship && actor.side === 'player') {
      ctx.shadowColor = '#7dffb0'
      ctx.shadowBlur = 10 + Math.sin(scene.time * 6) * 6
    }
    if (actor.shape === 'triangle' && actor.side === 'enemy') ctx.scale(-1, 1)
    drawShape(ctx, actor.shape, actor.r, fill, stroke, alpha)

    if (actor.muzzle > 0) {
      ctx.globalAlpha = actor.muzzle
      ctx.fillStyle = tagColor(actor.weaponTag)
      ctx.beginPath()
      ctx.arc(actor.side === 'player' ? actor.r : -actor.r, 0, 4 + actor.muzzle * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    const barW = actor.r * 2.1
    const barX = actor.x - barW / 2
    const barY = actor.y + actor.r + 5
    ctx.globalAlpha = alpha * 0.95
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(barX, barY, barW, 3.5)
    ctx.fillStyle = actor.side === 'player' ? '#e0b06a' : '#e07070'
    ctx.fillRect(barX, barY, barW * Math.max(0, actor.hull / Math.max(1, actor.hullMax)), 3.5)
    if (actor.shieldMax > 0 && actor.shield > 0) {
      ctx.fillStyle = '#7ec8ff'
      ctx.fillRect(barX, barY - 3.5, barW * (actor.shield / actor.shieldMax), 2.5)
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

  ctx.fillStyle = 'rgba(210, 220, 230, 0.7)'
  ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  const label =
    scene.mode === 'fighting'
      ? 'ENGAGED'
      : scene.mode === 'repairing'
        ? 'REPAIRING — hull recovering'
        : scene.mode === 'holding'
          ? 'HOLDING SECTOR'
          : 'STANDING BY'
  ctx.fillText(label, scene.width / 2, scene.height - 12)
}

export function Battlefield({
  playerUnits,
  enemyUnits,
  fx,
  mode,
}: BattlefieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const propsRef = useRef({ playerUnits, enemyUnits, fx, mode })
  propsRef.current = { playerUnits, enemyUnits, fx, mode }

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
      mode: 'ready',
      starSeed: 1234567,
      scroll: 0,
      projSeq: 0,
    }
    sceneRef.current = scene

    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now

      const p = propsRef.current
      syncScene(scene, p.playerUnits, p.enemyUnits, p.fx, p.mode)
      stepScene(scene, dt)

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cssW = canvas.clientWidth || VIEW_W
      const needW = Math.floor(cssW * dpr)
      const needH = Math.floor(((cssW * VIEW_H) / VIEW_W) * dpr)
      if (canvas.width !== needW || canvas.height !== needH) {
        canvas.width = needW
        canvas.height = needH
      }
      const scale = cssW / VIEW_W
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
      drawScene(ctx, scene)

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (mode !== 'fighting') {
      scene.projectiles = []
      scene.seenFx.clear()
    }
  }, [mode])

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
