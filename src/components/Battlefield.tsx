import { useEffect, useRef } from 'react'
import type { CombatFx, CombatUnit, UnitShape, WeaponInstance } from '../game/types'
import { SPAWN_DISTANCE } from '../game/combat'

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
  isBoss: boolean
  isFlagship: boolean
  hull: number
  hullMax: number
  shield: number
  shieldMax: number
  /** Display position */
  x: number
  y: number
  /** Target from sim lane coords */
  targetX: number
  targetY: number
  r: number
  bobPhase: number
  bobSpeed: number
  alive: boolean
  deathT: number
  hitFlash: number
  enterT: number
  muzzle: number
  weaponTag: string
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
const VIEW_H = 260
/** Player flagship sits on the left, vertically centered. */
const PLAYER_SCREEN_X = 78
const LANE_SCALE = (VIEW_W - PLAYER_SCREEN_X - 36) / SPAWN_DISTANCE

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

function primaryWeaponTag(weapons: WeaponInstance[]): string {
  return weapons[0]?.tags[0] ?? 'kinetic'
}

function laneToScreen(unit: CombatUnit): { x: number; y: number; r: number } {
  const isBig = unit.isBoss || unit.isFlagship
  const r = isBig ? 22 : 13
  // Player flagship: fixed left, vertical center. Escorts keep their y.
  // Enemies: x grows to the right with lane distance.
  if (unit.side === 'player' && unit.isFlagship) {
    return { x: PLAYER_SCREEN_X, y: VIEW_H / 2, r }
  }
  return {
    x: PLAYER_SCREEN_X + Math.max(0, unit.x) * LANE_SCALE,
    y: VIEW_H / 2 + unit.y,
    r,
  }
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

function ensureActor(scene: Scene, unit: CombatUnit): Actor {
  const existing = scene.actors.get(unit.id)
  const slot = laneToScreen(unit)

  if (existing) {
    existing.hull = unit.hull
    existing.hullMax = unit.hullMax
    existing.shield = unit.shield
    existing.shieldMax = unit.shieldMax
    existing.shape = unit.shape
    existing.isBoss = unit.isBoss
    existing.targetX = slot.x
    existing.targetY = slot.y
    existing.r = slot.r
    existing.weaponTag = primaryWeaponTag(unit.weapons)
    if (unit.hull > 0 && !existing.alive) {
      existing.alive = true
      existing.deathT = 0
      existing.enterT = 0.3
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
    isBoss: unit.isBoss,
    isFlagship: unit.isFlagship,
    hull: unit.hull,
    hullMax: unit.hullMax,
    shield: unit.shield,
    shieldMax: unit.shieldMax,
    x: slot.x + (unit.side === 'enemy' ? 30 : 0),
    y: slot.y,
    targetX: slot.x,
    targetY: slot.y,
    r: slot.r,
    bobPhase: Math.random() * Math.PI * 2,
    bobSpeed: 2.4 + Math.random() * 2,
    alive: unit.hull > 0,
    deathT: 0,
    hitFlash: 0,
    enterT: 0.35,
    muzzle: 0,
    weaponTag: primaryWeaponTag(unit.weapons),
  }
  scene.actors.set(unit.id, actor)
  return actor
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
    const spread = splashExtra > 0 ? (i - (count - 1) / 2) * 0.2 : (Math.random() - 0.5) * 0.06
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.max(1, Math.hypot(dx, dy))
    const speed =
      tag === 'pierce' ? 680 : tag === 'energy' || tag === 'antiShield' ? 560 : 500
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

function syncScene(
  scene: Scene,
  playerUnits: CombatUnit[],
  enemyUnits: CombatUnit[],
  fx: CombatFx[],
  mode: BattlefieldMode,
): void {
  scene.mode = mode
  const livingIds = new Set<string>()

  for (const u of playerUnits) {
    livingIds.add(u.id)
    ensureActor(scene, u)
  }
  for (const u of enemyUnits) {
    livingIds.add(u.id)
    ensureActor(scene, u)
  }

  for (const [id, actor] of scene.actors) {
    if (!livingIds.has(id) && actor.alive) {
      actor.alive = false
      actor.deathT = 1
      burst(scene, actor.x, actor.y, sideFill(actor.side, actor.isBoss), 12)
    }
  }

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
  if (scene.seenFx.size > 240) scene.seenFx = new Set(fx.map((f) => f.id))

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
    ctx.moveTo(r, 0)
    ctx.lineTo(-r * 0.85, -r)
    ctx.lineTo(-r * 0.85, r)
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
  for (let i = 0; i < 70; i += 1) {
    seed = (seed * 16807) % 2147483647
    const baseX = (seed % 1000) / 1000 * scene.width
    seed = (seed * 16807) % 2147483647
    const y = (seed % 1000) / 1000 * scene.height
    const layer = i % 3 === 0 ? 1.8 : i % 3 === 1 ? 1 : 0.55
    const x = (baseX - scene.scroll * layer * 48 + scene.width * 8) % scene.width
    const twinkle = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(scene.time * 3 + i))
    ctx.fillStyle = `rgba(230,238,248,${twinkle})`
    ctx.fillRect(x, y, i % 9 === 0 ? 2.2 : 1, i % 9 === 0 ? 2.2 : 1)
  }

  // Vertical center guide near player
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.beginPath()
  ctx.moveTo(PLAYER_SCREEN_X, 16)
  ctx.lineTo(PLAYER_SCREEN_X, scene.height - 28)
  ctx.stroke()
}

function stepScene(scene: Scene, dt: number): void {
  scene.time += dt
  const advancing = scene.mode === 'fighting' || scene.mode === 'ready'
  scene.scroll += dt * (advancing ? 0.7 : scene.mode === 'repairing' ? 0.12 : 0.3)

  for (const actor of scene.actors.values()) {
    if (actor.enterT > 0) actor.enterT = Math.max(0, actor.enterT - dt)
    if (actor.hitFlash > 0) actor.hitFlash = Math.max(0, actor.hitFlash - dt * 4)
    if (actor.muzzle > 0) actor.muzzle = Math.max(0, actor.muzzle - dt * 5)

    if (!actor.alive) {
      if (actor.deathT > 0) actor.deathT = Math.max(0, actor.deathT - dt * 1.8)
      continue
    }

    actor.bobPhase += actor.bobSpeed * dt
    const bob =
      actor.side === 'player' && actor.isFlagship
        ? Math.sin(actor.bobPhase) * 2.2
        : Math.sin(actor.bobPhase) * 3.2

    // Follow sim lane targets; flagship locked left + vertical center.
    // Projectiles only come from real combat FX (in-range shots) — no ghost fire.
    const tx = actor.targetX
    const ty = actor.targetY + bob
    actor.x += (tx - actor.x) * Math.min(1, dt * 10)
    actor.y += (ty - actor.y) * Math.min(1, dt * 10)

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
    const tail = p.tag === 'pierce' ? 22 : 14
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
        ? 'REPAIRING'
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
