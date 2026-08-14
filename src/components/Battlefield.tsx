import { useEffect, useRef } from 'react'
import type {
  CombatBeam,
  CombatFx,
  CombatProjectile,
  CombatUnit,
  UnitShape,
  WeaponDelivery,
  WeaponInstance,
  WeaponTag,
} from '../game/types'
import { SPAWN_DISTANCE } from '../game/combat'
import { formatNumber } from '../game/format'

export type BattlefieldMode = 'fighting' | 'repairing' | 'holding' | 'ready' | 'docked'

interface BattlefieldProps {
  playerUnits: CombatUnit[]
  enemyUnits: CombatUnit[]
  projectiles: CombatProjectile[]
  beams: CombatBeam[]
  fx: CombatFx[]
  mode: BattlefieldMode
  /** Freeze interpolation / starfield while a coach-mark is up. */
  paused?: boolean
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
  /** 0..1 charge amount while telegraphing a slam or charge laser. */
  telegraph: number
  /** 0..1 boss phase-shift warn pulse. */
  phaseWarn: number
  /** True while winding a sniper charge laser (not a titan slam). */
  chargeLaser: boolean
  /** Locked telegraph target, if any. */
  telegraphToId?: string
  telegraphToX: number | null
  telegraphToY: number | null
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
  /** Optional drag multiplier per frame (default 0.9). */
  drag?: number
}

interface ScreenFlash {
  r: number
  g: number
  b: number
  life: number
  maxLife: number
  strength: number
}

interface RingFx {
  x: number
  y: number
  life: number
  maxLife: number
  color: string
  maxR: number
  lineW: number
}

type ShotShape = 'slug' | 'lance' | 'bolt' | 'orb' | 'missile' | 'spark' | 'flak'

interface ShotStyle {
  shape: ShotShape
  color: string
  core: string
  length: number
  width: number
  radius: number
  glow: number
}

interface VisualShot {
  x: number
  y: number
  tag: string
  tags: WeaponTag[]
  fromSide: 'player' | 'enemy'
  attackerFamily: string
  /** Screen-space heading for trail. */
  hx: number
  hy: number
  /** Screen-space spawn point for energy / charge traces. */
  ox: number
  oy: number
  delivery?: WeaponDelivery
}

interface VisualBeam {
  id: string
  fromId: string
  toId: string
  tag: string
  side: 'player' | 'enemy'
  remaining: number
  duration: number
}

interface TraceLinger {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  core: string
  life: number
  maxLife: number
  width: number
}

interface Scene {
  actors: Map<string, Actor>
  /** Screen-space copies of sim projectiles, keyed by id. */
  projectiles: Map<string, VisualShot>
  beams: VisualBeam[]
  traces: TraceLinger[]
  particles: Particle[]
  flashes: ScreenFlash[]
  rings: RingFx[]
  shake: number
  seenFx: Set<string>
  seenProj: Set<string>
  seenBeam: Set<string>
  prevHull: Map<string, number>
  prevShield: Map<string, number>
  prevPhaseWarn: Map<string, number>
  knownBossIds: Set<string>
  prevMode: BattlefieldMode | null
  width: number
  height: number
  time: number
  mode: BattlefieldMode
  starSeed: number
  scroll: number
}

/** Portrait logical canvas — phone-first, USI-style bottom ship / incoming waves. */
const VIEW_W = 360
const VIEW_H = 520
/** Player flagship sits bottom-center. Enemies close in from the far side (top). */
const PLAYER_SCREEN_X = VIEW_W / 2
const PLAYER_SCREEN_Y = VIEW_H - 64
const LANE_SCALE = (PLAYER_SCREEN_Y - 28) / SPAWN_DISTANCE
/** Lateral spread from sim y (±~110). */
const Y_SCALE = 1.45

function tagColor(tag: string): string {
  switch (tag) {
    case 'energy':
    case 'antiShield':
      return '#e08a3a'
    case 'pierce':
      return '#5ec4b8'
    case 'splash':
      return '#e0c07a'
    case 'dot':
      return '#8fd98f'
    case 'miss':
      return '#9aa3ad'
    default:
      return '#d8f0e0'
  }
}

function familyShotColor(family: string): string {
  switch (family) {
    case 'swarm':
      return '#9eb4cc'
    case 'armored':
      return '#c4a574'
    case 'ethereal':
      return '#7ec8ff'
    case 'divine':
      return '#e0c07a'
    case 'titan':
      return '#ff8a7a'
    case 'escort':
      return '#b8d4c8'
    default:
      return '#d8f0e0'
  }
}

function shotStyle(p: VisualShot): ShotStyle {
  const tags = new Set<string>([p.tag, ...p.tags])

  if (p.delivery === 'charge') {
    return {
      shape: 'lance',
      color: p.fromSide === 'player' ? '#e08a3a' : '#7ec8ff',
      core: '#ffffff',
      length: 34,
      width: 2.8,
      radius: 2.6,
      glow: 16,
    }
  }

  if (p.fromSide === 'player') {
    if (tags.has('pierce')) {
      return {
        shape: 'lance',
        color: '#5ec4b8',
        core: '#e8fff8',
        length: 30,
        width: 2.4,
        radius: 2.2,
        glow: 10,
      }
    }
    if (tags.has('splash') && (tags.has('antiShield') || tags.has('energy'))) {
      return {
        shape: 'orb',
        color: '#e08a3a',
        core: '#ffe8c8',
        length: 12,
        width: 2,
        radius: 3.6,
        glow: 12,
      }
    }
    if (tags.has('splash')) {
      return {
        shape: 'missile',
        color: '#e0c07a',
        core: '#fff0c8',
        length: 16,
        width: 2.6,
        radius: 3,
        glow: 9,
      }
    }
    if (tags.has('dot')) {
      return {
        shape: 'flak',
        color: '#8fd98f',
        core: '#d8ffe0',
        length: 10,
        width: 1.8,
        radius: 2.8,
        glow: 8,
      }
    }
    if (tags.has('antiShield') || tags.has('energy')) {
      return {
        shape: 'bolt',
        color: '#e08a3a',
        core: '#ffe8c8',
        length: 28,
        width: 3.2,
        radius: 3.2,
        glow: 18,
      }
    }
    return {
      shape: 'slug',
      color: '#d8f0e0',
      core: '#ffffff',
      length: 12,
      width: 2.2,
      radius: 2.5,
      glow: 7,
    }
  }

  // Enemy / escort shots — family silhouette with tag overrides.
  if (tags.has('pierce')) {
    return {
      shape: 'lance',
      color: familyShotColor(p.attackerFamily),
      core: '#fff8e8',
      length: 26,
      width: 2.2,
      radius: 2,
      glow: 9,
    }
  }
  if (tags.has('splash')) {
    return {
      shape: 'missile',
      color: familyShotColor(p.attackerFamily),
      core: '#fff0d0',
      length: 14,
      width: 2.4,
      radius: 3.2,
      glow: 8,
    }
  }
  if (tags.has('energy') || tags.has('antiShield')) {
    return {
      shape: 'bolt',
      color: familyShotColor(p.attackerFamily),
      core: '#e8f4ff',
      length: 22,
      width: 2.6,
      radius: 2.8,
      glow: 14,
    }
  }

  switch (p.attackerFamily) {
    case 'swarm':
      return {
        shape: 'spark',
        color: '#9eb4cc',
        core: '#e8eef5',
        length: 12,
        width: 2,
        radius: 2.2,
        glow: 8,
      }
    case 'armored':
      return {
        shape: 'slug',
        color: '#c4a574',
        core: '#ffe8c0',
        length: 16,
        width: 3.6,
        radius: 3.6,
        glow: 9,
      }
    case 'ethereal':
      return {
        shape: 'bolt',
        color: '#7ec8ff',
        core: '#e8f7ff',
        length: 20,
        width: 1.8,
        radius: 2,
        glow: 11,
      }
    case 'divine':
      return {
        shape: 'lance',
        color: '#e0c07a',
        core: '#fff4d0',
        length: 24,
        width: 2.2,
        radius: 2.2,
        glow: 10,
      }
    case 'titan':
      return {
        shape: 'orb',
        color: '#ff8a7a',
        core: '#ffe0d8',
        length: 22,
        width: 3.4,
        radius: 5.5,
        glow: 20,
      }
    default:
      return {
        shape: 'slug',
        color: tagColor(p.tag),
        core: '#ffffff',
        length: 12,
        width: 2,
        radius: 2.2,
        glow: 7,
      }
  }
}

function lanePointToScreen(x: number, y: number): { x: number; y: number } {
  return {
    x: PLAYER_SCREEN_X + y * Y_SCALE,
    y: PLAYER_SCREEN_Y - Math.max(0, x) * LANE_SCALE,
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
  const r = unitRadius(unit)
  if (unit.side === 'player' && unit.isFlagship) {
    return { x: PLAYER_SCREEN_X, y: PLAYER_SCREEN_Y, r }
  }
  return {
    x: PLAYER_SCREEN_X + unit.y * Y_SCALE,
    y: PLAYER_SCREEN_Y - Math.max(0, unit.x) * LANE_SCALE,
    r,
  }
}

/** Skirmishers are tiny; juggernauts and bosses fill the lane. */
function unitRadius(unit: CombatUnit): number {
  if (unit.isFlagship) return 20
  if (unit.isBoss || unit.role === 'boss') return 22
  switch (unit.role) {
    case 'skirmisher':
      return 8
    case 'fighter':
      return 11
    case 'sniper':
      return 10
    case 'shield':
      return 13
    case 'juggernaut':
      return 18
    default:
      return unit.hullMax > 50 ? 16 : 12
  }
}

function burst(
  scene: Scene,
  x: number,
  y: number,
  color: string,
  n: number,
  opts?: { speed?: number; life?: number; size?: number; drag?: number },
): void {
  const speedMul = opts?.speed ?? 1
  const lifeMul = opts?.life ?? 1
  const sizeMul = opts?.size ?? 1
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2
    const sp = (50 + Math.random() * 160) * speedMul
    const life = (0.2 + Math.random() * 0.4) * lifeMul
    scene.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life,
      maxLife: Math.max(0.35, life),
      color,
      size: (1.5 + Math.random() * 3) * sizeMul,
      drag: opts?.drag,
    })
  }
}

function flash(
  scene: Scene,
  r: number,
  g: number,
  b: number,
  strength: number,
  duration = 0.35,
): void {
  scene.flashes.push({ r, g, b, life: duration, maxLife: duration, strength })
}

function ring(
  scene: Scene,
  x: number,
  y: number,
  color: string,
  maxR: number,
  duration = 0.45,
  lineW = 2.5,
): void {
  scene.rings.push({ x, y, life: duration, maxLife: duration, color, maxR, lineW })
}

function addShake(scene: Scene, amount: number): void {
  scene.shake = Math.min(14, scene.shake + amount)
}

/** Layered death / impact pop — debris + shockwave. */
function explode(
  scene: Scene,
  x: number,
  y: number,
  color: string,
  power: 'small' | 'medium' | 'large' | 'boss',
): void {
  if (power === 'small') {
    burst(scene, x, y, color, 10, { speed: 0.9 })
    ring(scene, x, y, color, 28, 0.28, 1.6)
    return
  }
  if (power === 'medium') {
    burst(scene, x, y, color, 18, { speed: 1.15, size: 1.15 })
    burst(scene, x, y, '#fff4d8', 6, { speed: 0.55, life: 0.7, size: 0.8 })
    ring(scene, x, y, color, 48, 0.4, 2)
    addShake(scene, 2.2)
    return
  }
  if (power === 'large') {
    burst(scene, x, y, color, 28, { speed: 1.35, size: 1.35, life: 1.15 })
    burst(scene, x, y, '#ffe8c0', 12, { speed: 0.7, life: 0.9 })
    burst(scene, x, y, '#ff6b4a', 10, { speed: 1.6, life: 0.7, size: 1.1 })
    ring(scene, x, y, color, 90, 0.55, 3)
    ring(scene, x, y, '#ffe8c0', 48, 0.32, 1.8)
    flash(scene, 255, 120, 80, 0.42, 0.45)
    addShake(scene, 6)
    return
  }
  // Boss wipe
  burst(scene, x, y, color, 40, { speed: 1.5, size: 1.5, life: 1.25 })
  burst(scene, x, y, '#ff8a7a', 18, { speed: 1.8, life: 0.85 })
  burst(scene, x, y, '#fff0d0', 14, { speed: 0.65, life: 1.1, size: 1.2 })
  ring(scene, x, y, '#ff6b6b', 140, 0.7, 3.5)
  ring(scene, x, y, '#e0c07a', 70, 0.4, 2.2)
  flash(scene, 255, 90, 70, 0.55, 0.55)
  addShake(scene, 9)
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
    existing.telegraph = telegraphAmount(unit)
    existing.chargeLaser = isChargeTelegraph(unit)
    existing.telegraphToId = telegraphTargetId(unit)
    existing.phaseWarn = unit.phaseWarnLeft > 0 ? Math.min(1, unit.phaseWarnLeft / 0.9) : 0
    if (unit.hull > 0 && !existing.alive) {
      existing.alive = true
      existing.deathT = 0
      existing.enterT = 0.3
    }
    if (unit.hull <= 0 && existing.alive) {
      existing.alive = false
      existing.deathT = 1
      const power =
        existing.isBoss
          ? 'boss'
          : existing.isFlagship
            ? 'large'
            : existing.side === 'player'
              ? 'medium'
              : 'small'
      explode(scene, existing.x, existing.y, sideFill(existing.side, existing.isBoss), power)
      // Wave / pack wipe — last enemy down gets a cool victory wash.
      if (existing.side === 'enemy' && !existing.isBoss) {
        // Count other living enemies still tracked this frame.
        let others = 0
        for (const a of scene.actors.values()) {
          if (a.id !== existing.id && a.side === 'enemy' && a.alive) others += 1
        }
        if (others === 0) {
          flash(scene, 224, 192, 122, 0.22, 0.38)
          ring(scene, existing.x, existing.y, '#e0c07a', 80, 0.45, 2.2)
        }
      } else if (existing.isBoss) {
        flash(scene, 224, 192, 122, 0.35, 0.55)
      }
    }
    return existing
  }

  const isBossSpawn = unit.isBoss && !scene.knownBossIds.has(unit.id)
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
    x: slot.x,
    y: slot.y - (unit.side === 'enemy' ? (isBossSpawn ? 56 : 30) : 0),
    targetX: slot.x,
    targetY: slot.y,
    r: slot.r,
    bobPhase: Math.random() * Math.PI * 2,
    bobSpeed: 2.4 + Math.random() * 2,
    alive: unit.hull > 0,
    deathT: 0,
    hitFlash: 0,
    enterT: isBossSpawn ? 0.7 : 0.35,
    muzzle: 0,
    weaponTag: primaryWeaponTag(unit.weapons),
    telegraph: telegraphAmount(unit),
    chargeLaser: isChargeTelegraph(unit),
    telegraphToId: telegraphTargetId(unit),
    telegraphToX: null,
    telegraphToY: null,
    phaseWarn: unit.phaseWarnLeft > 0 ? Math.min(1, unit.phaseWarnLeft / 0.9) : 0,
  }
  scene.actors.set(unit.id, actor)

  if (isBossSpawn) {
    scene.knownBossIds.add(unit.id)
    // Titan arrival — hex shockwave + crimson wash.
    burst(scene, actor.x, actor.y, '#ff6b6b', 26, { speed: 1.2, size: 1.4, life: 1.1 })
    burst(scene, actor.x, actor.y, '#e0c07a', 12, { speed: 0.6, life: 0.9 })
    ring(scene, actor.x, actor.y, '#ff6b6b', 120, 0.65, 3.2)
    ring(scene, actor.x, actor.y, '#e0c07a', 60, 0.4, 2)
    flash(scene, 255, 80, 70, 0.48, 0.5)
    addShake(scene, 5.5)
  }

  return actor
}

function telegraphAmount(unit: CombatUnit): number {
  let best = 0
  for (const w of unit.weapons) {
    if (w.telegraphDuration <= 0 || w.telegraphLeft <= 0) continue
    best = Math.max(best, 1 - w.telegraphLeft / w.telegraphDuration)
  }
  return best
}

function telegraphTargetId(unit: CombatUnit): string | undefined {
  for (const w of unit.weapons) {
    if (w.telegraphLeft > 0 && w.telegraphToId) return w.telegraphToId
  }
  return undefined
}

function isChargeTelegraph(unit: CombatUnit): boolean {
  return unit.weapons.some((w) => w.telegraphLeft > 0 && w.delivery === 'charge')
}

function shouldDrawTrace(p: VisualShot): boolean {
  if (p.delivery === 'charge' || p.delivery === 'beam') return true
  if (p.tag === 'energy' || p.tag === 'antiShield') return true
  return p.tags.includes('energy') || p.tags.includes('antiShield')
}

function beamColor(tag: string, side: 'player' | 'enemy'): { glow: string; core: string } {
  if (side === 'player') {
    return { glow: tagColor(tag), core: '#ffe8c8' }
  }
  return { glow: '#7ec8ff', core: '#e8f7ff' }
}

function isHangarMode(_mode: BattlefieldMode): boolean {
  return false
}

function onModeTransition(scene: Scene, prev: BattlefieldMode | null, next: BattlefieldMode): void {
  if (prev == null) return
  const wasHangar = isHangarMode(prev)
  const nowHangar = isHangarMode(next)

  // Enter hangar — clamp latch + bay wash.
  if (!wasHangar && nowHangar) {
    const cx = PLAYER_SCREEN_X
    const cy = PLAYER_SCREEN_Y
    burst(scene, cx - 22, cy - 22, '#3d8f88', 22, { speed: 1.05, life: 1.15, size: 1.25 })
    burst(scene, cx - 22, cy + 22, '#3d8f88', 22, { speed: 1.05, life: 1.15, size: 1.25 })
    burst(scene, cx, cy, '#e8c88c', 28, { speed: 0.7, life: 1.2, size: 1.45 })
    burst(scene, cx - 8, cy, '#ffffff', 8, { speed: 0.4, life: 0.7, size: 0.9 })
    ring(scene, cx, cy, '#3d8f88', 95, 0.65, 3)
    ring(scene, cx, cy, '#e8c88c', 50, 0.4, 2)
    flash(scene, 126, 200, 255, 0.4, 0.55)
    addShake(scene, 3.5)
  }

  // Launch from hangar — thruster kick from the rear (down).
  if (wasHangar && !nowHangar) {
    const cx = PLAYER_SCREEN_X
    const cy = PLAYER_SCREEN_Y
    for (let i = 0; i < 34; i += 1) {
      scene.particles.push({
        x: cx + (Math.random() - 0.5) * 32,
        y: cy + 10,
        vx: (Math.random() - 0.5) * 80,
        vy: 100 + Math.random() * 180,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        color: Math.random() > 0.45 ? '#3d8f88' : '#e0b06a',
        size: 2 + Math.random() * 2.8,
        drag: 0.86,
      })
    }
    ring(scene, cx, cy, '#e0b06a', 75, 0.45, 2.6)
    flash(scene, 224, 176, 106, 0.32, 0.38)
    addShake(scene, 2.2)
  }

  // Engage — subtle green go-pulse (also fires between waves).
  if (prev !== 'fighting' && next === 'fighting') {
    flash(scene, 125, 255, 176, 0.14, 0.22)
  }
}

function syncScene(
  scene: Scene,
  playerUnits: CombatUnit[],
  enemyUnits: CombatUnit[],
  projectiles: CombatProjectile[],
  beams: CombatBeam[],
  fx: CombatFx[],
  mode: BattlefieldMode,
): void {
  if (scene.prevMode !== mode) {
    onModeTransition(scene, scene.prevMode, mode)
    scene.prevMode = mode
  }
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

  // Actors that vanish from the sim while still "alive" are soft-despawned
  // (wave clear / preview swap / dock). Real kills go through hull<=0 above.
  for (const [id, actor] of scene.actors) {
    if (!livingIds.has(id) && actor.alive) {
      actor.alive = false
      actor.deathT = 0.28
    }
  }

  for (const actor of scene.actors.values()) {
    if (!actor.telegraphToId) {
      actor.telegraphToX = null
      actor.telegraphToY = null
      continue
    }
    const locked = scene.actors.get(actor.telegraphToId)
    if (locked) {
      actor.telegraphToX = locked.x
      actor.telegraphToY = locked.y
    }
  }

  // Mirror authoritative sim projectiles into screen space (damage is sim-only on impact)
  const nextProj = new Map<string, VisualShot>()
  const liveIds = new Set(projectiles.map((p) => p.id))
  for (const [id, prev] of scene.projectiles) {
    if (liveIds.has(id) || !shouldDrawTrace(prev)) continue
    const style = shotStyle(prev)
    scene.traces.push({
      x1: prev.ox,
      y1: prev.oy,
      x2: prev.x,
      y2: prev.y,
      color: style.color,
      core: style.core,
      life: 0.2,
      maxLife: 0.2,
      width: style.width * 0.85,
    })
  }
  for (const p of projectiles) {
    const screen = lanePointToScreen(p.x, p.y)
    const origin = lanePointToScreen(p.originX ?? p.x, p.originY ?? p.y)
    const prev = scene.projectiles.get(p.id)
    let hx = 0
    let hy = p.side === 'player' ? -1 : 1
    if (prev) {
      const dx = screen.x - prev.x
      const dy = screen.y - prev.y
      if (Math.hypot(dx, dy) > 0.2) {
        hx = dx
        hy = dy
      } else {
        hx = prev.hx
        hy = prev.hy
      }
    }
    nextProj.set(p.id, {
      x: screen.x,
      y: screen.y,
      tag: p.tag,
      tags: p.tags,
      fromSide: p.side,
      attackerFamily: p.attackerFamily,
      hx,
      hy,
      ox: prev?.ox ?? origin.x,
      oy: prev?.oy ?? origin.y,
      delivery: p.delivery,
    })
    if (!scene.seenProj.has(p.id)) {
      scene.seenProj.add(p.id)
      const from = scene.actors.get(p.fromId)
      if (from) {
        from.muzzle = 1
        const style = shotStyle(nextProj.get(p.id)!)
        const noseY = from.side === 'player' ? from.y - from.r : from.y + from.r
        burst(scene, from.x, noseY, style.core, from.isBoss ? 10 : 6, {
          speed: 0.45,
          life: 0.28,
          size: from.isBoss ? 1.2 : 0.75,
        })
        if (from.isBoss || p.side === 'player' || p.delivery === 'charge') {
          ring(scene, from.x, noseY, style.color, from.isBoss ? 28 : 16, 0.18, 1.4)
        }
      }
    } else if (prev) {
      // Exhaust sparkles behind live rounds.
      if (Math.random() < (p.side === 'player' || p.attackerFamily === 'titan' ? 0.55 : 0.28)) {
        const style = shotStyle(nextProj.get(p.id)!)
        const mag = Math.hypot(hx, hy) || 1
        scene.particles.push({
          x: screen.x - (hx / mag) * 6,
          y: screen.y - (hy / mag) * 6,
          vx: -hx * 18 + (Math.random() - 0.5) * 20,
          vy: -hy * 18 + (Math.random() - 0.5) * 20,
          life: 0.1 + Math.random() * 0.14,
          maxLife: 0.24,
          color: style.color,
          size: 1.2 + Math.random() * 1.6,
          drag: 0.82,
        })
      }
    }
  }
  scene.projectiles = nextProj
  if (scene.seenProj.size > 300) {
    scene.seenProj = new Set(projectiles.map((p) => p.id))
  }

  const nextBeams: VisualBeam[] = []
  const liveBeamIds = new Set(beams.map((b) => b.id))
  for (const prev of scene.beams) {
    if (liveBeamIds.has(prev.id)) continue
    const from = scene.actors.get(prev.fromId)
    const to = scene.actors.get(prev.toId)
    if (!from || !to) continue
    const palette = beamColor(prev.tag, prev.side)
    scene.traces.push({
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      color: palette.glow,
      core: palette.core,
      life: 0.16,
      maxLife: 0.16,
      width: 2.4,
    })
  }
  for (const b of beams) {
    nextBeams.push({
      id: b.id,
      fromId: b.fromId,
      toId: b.toId,
      tag: b.tag,
      side: b.side,
      remaining: b.remaining,
      duration: b.duration,
    })
    if (!scene.seenBeam.has(b.id)) {
      scene.seenBeam.add(b.id)
      const from = scene.actors.get(b.fromId)
      if (from) {
        from.muzzle = 1
        const palette = beamColor(b.tag, b.side)
        const noseY = from.side === 'player' ? from.y - from.r : from.y + from.r
        burst(scene, from.x, noseY, palette.core, 8, { speed: 0.4, life: 0.3, size: 0.9 })
        ring(scene, from.x, noseY, palette.glow, 18, 0.2, 1.5)
      }
    }
  }
  scene.beams = nextBeams
  if (scene.seenBeam.size > 120) {
    scene.seenBeam = new Set(beams.map((b) => b.id))
  }

  // Impact FX only (damage already applied in sim on hit)
  for (const shot of fx) {
    if (scene.seenFx.has(shot.id)) continue
    scene.seenFx.add(shot.id)
    const to = scene.actors.get(shot.toId)
    if (to) {
      const color = tagColor(shot.tag)
      burst(scene, to.x, to.y, color, shot.tag === 'miss' ? 4 : 12, {
        speed: shot.tag === 'miss' ? 0.5 : 1.15,
        size: shot.tag === 'miss' ? 0.7 : 1.1,
      })
      if (shot.tag !== 'miss') {
        to.hitFlash = 1
        ring(scene, to.x, to.y, color, to.isBoss || to.isFlagship ? 36 : 22, 0.22, 1.6)
        if (to.isFlagship || to.isBoss) addShake(scene, to.isBoss ? 2.4 : 1.4)
      }
    }
  }
  if (scene.seenFx.size > 240) scene.seenFx = new Set(fx.map((f) => f.id))

  for (const actor of scene.actors.values()) {
    const prev = scene.prevHull.get(actor.id)
    if (prev != null && actor.hull < prev && actor.alive) {
      actor.hitFlash = 1
      burst(scene, actor.x, actor.y, tagColor('kinetic'), 6)
    }
    scene.prevHull.set(actor.id, actor.hull)

    // Shield break — cyan shatter when a live shield drops to empty.
    const prevShield = scene.prevShield.get(actor.id)
    if (
      prevShield != null &&
      prevShield > 0 &&
      actor.shield <= 0 &&
      actor.shieldMax > 0 &&
      actor.alive
    ) {
      burst(scene, actor.x, actor.y, '#7ec8ff', 16, { speed: 1.25, size: 1.1, life: 0.85 })
      burst(scene, actor.x, actor.y, '#e8f7ff', 8, { speed: 0.7, life: 0.6 })
      ring(scene, actor.x, actor.y, '#7ec8ff', actor.r * 3.2, 0.35, 2)
      if (actor.isFlagship || actor.isBoss) {
        flash(scene, 126, 200, 255, 0.2, 0.28)
        addShake(scene, 1.8)
      }
    }
    scene.prevShield.set(actor.id, actor.shield)

    // Boss phase-shift rising edge.
    const prevWarn = scene.prevPhaseWarn.get(actor.id) ?? 0
    if (actor.phaseWarn > 0.15 && prevWarn < 0.05 && actor.isBoss) {
      burst(scene, actor.x, actor.y, '#7ec8ff', 22, { speed: 1.1, size: 1.25, life: 1 })
      burst(scene, actor.x, actor.y, '#e0c07a', 10, { speed: 0.7, life: 0.8 })
      ring(scene, actor.x, actor.y, '#7ec8ff', 100, 0.55, 2.8)
      flash(scene, 126, 200, 255, 0.35, 0.42)
      addShake(scene, 3.5)
    }
    scene.prevPhaseWarn.set(actor.id, actor.phaseWarn)
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
  ctx.fillStyle = '#120e0c'
  ctx.fillRect(0, 0, scene.width, scene.height)

  const g = ctx.createLinearGradient(0, 0, scene.width * 0.2, scene.height)
  g.addColorStop(0, 'rgba(58, 42, 24, 0.45)')
  g.addColorStop(0.4, 'rgba(22, 16, 12, 0.18)')
  g.addColorStop(0.72, 'rgba(48, 36, 28, 0.22)')
  g.addColorStop(1, 'rgba(70, 44, 28, 0.32)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, scene.width, scene.height)

  const band = ctx.createRadialGradient(
    scene.width * 0.72,
    scene.height * 0.28,
    10,
    scene.width * 0.72,
    scene.height * 0.28,
    scene.height * 0.42,
  )
  band.addColorStop(0, 'rgba(79, 143, 154, 0.14)')
  band.addColorStop(1, 'rgba(79, 143, 154, 0)')
  ctx.fillStyle = band
  ctx.fillRect(0, 0, scene.width, scene.height)

  const fighting = scene.mode === 'fighting'
  let seed = scene.starSeed
  for (let i = 0; i < 120; i += 1) {
    seed = (seed * 16807) % 2147483647
    const x = (seed % 1000) / 1000 * scene.width
    seed = (seed * 16807) % 2147483647
    const baseY = (seed % 1000) / 1000 * scene.height
    const layer = i % 3 === 0 ? 1.8 : i % 3 === 1 ? 1 : 0.55
    // Ship flies up the sector; stars drift toward the hull (down the canvas).
    const scrollMul = fighting ? 90 : 42
    const y =
      (((baseY + scene.scroll * layer * scrollMul) % scene.height) + scene.height) %
      scene.height
    const twinkle = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(scene.time * 3 + i))
    ctx.fillStyle = `rgba(230,238,248,${twinkle})`
    if (fighting && i % 4 === 0) {
      const streak = 5 + layer * 5
      ctx.fillRect(x, y - streak, i % 9 === 0 ? 1.6 : 1, streak)
    } else {
      ctx.fillRect(x, y, i % 9 === 0 ? 2.2 : 1, i % 9 === 0 ? 2.2 : 1)
    }
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.beginPath()
  ctx.moveTo(PLAYER_SCREEN_X, 28)
  ctx.lineTo(PLAYER_SCREEN_X, scene.height - 64)
  ctx.stroke()

  // Foundry clamp plate under the hull — industrial floor, not empty stars.
  const dockY = PLAYER_SCREEN_Y + 18
  const plate = ctx.createRadialGradient(PLAYER_SCREEN_X, dockY, 8, PLAYER_SCREEN_X, dockY, 92)
  plate.addColorStop(0, 'rgba(224, 138, 58, 0.22)')
  plate.addColorStop(0.45, 'rgba(61, 143, 136, 0.08)')
  plate.addColorStop(1, 'rgba(18, 14, 12, 0)')
  ctx.fillStyle = plate
  ctx.beginPath()
  ctx.ellipse(PLAYER_SCREEN_X, dockY, 86, 22, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(224, 138, 58, 0.28)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(PLAYER_SCREEN_X, dockY, 70, 16, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(224, 138, 58, 0.45)'
  ctx.beginPath()
  ctx.moveTo(PLAYER_SCREEN_X - 38, dockY)
  ctx.lineTo(PLAYER_SCREEN_X - 22, dockY + 10)
  ctx.moveTo(PLAYER_SCREEN_X + 38, dockY)
  ctx.lineTo(PLAYER_SCREEN_X + 22, dockY + 10)
  ctx.stroke()
}

function stepScene(scene: Scene, dt: number): void {
  scene.time += dt
  const advancing = scene.mode === 'fighting' || scene.mode === 'ready'
  const inHangar = false
  scene.scroll += dt * (advancing ? 0.7 : 0.3)

  if (scene.shake > 0) {
    scene.shake = Math.max(0, scene.shake - dt * 18)
  }

  for (const actor of scene.actors.values()) {
    if (actor.enterT > 0) actor.enterT = Math.max(0, actor.enterT - dt)
    if (actor.hitFlash > 0) actor.hitFlash = Math.max(0, actor.hitFlash - dt * 4)
    if (actor.muzzle > 0) actor.muzzle = Math.max(0, actor.muzzle - dt * 5)

    if (!actor.alive) {
      if (actor.deathT > 0) actor.deathT = Math.max(0, actor.deathT - dt * 1.8)
      // Extra debris while a big unit is dying.
      if (actor.deathT > 0.2 && (actor.isBoss || actor.isFlagship) && Math.random() < dt * 18) {
        burst(
          scene,
          actor.x + (Math.random() - 0.5) * 12,
          actor.y + (Math.random() - 0.5) * 12,
          sideFill(actor.side, actor.isBoss),
          2,
          { speed: 0.8, life: 0.7 },
        )
      }
      continue
    }

    actor.bobPhase += actor.bobSpeed * dt
    const bobAmp =
      inHangar
        ? 1.1
        : actor.side === 'player' && actor.isFlagship
          ? 2.2
          : 3.2
    const bob = Math.sin(actor.bobPhase) * bobAmp

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

    if (inHangar && actor.isFlagship && actor.side === 'player') {
      if (Math.random() < dt * 3) {
        scene.particles.push({
          x: actor.x + (Math.random() - 0.5) * 20,
          y: actor.y + 18 - Math.random() * 8,
          vx: (Math.random() - 0.5) * 12,
          vy: 10 + Math.random() * 16,
          life: 0.6,
          maxLife: 0.6,
          color: scene.mode === 'repairing' ? '#7dffb0' : '#7ec8ff',
          size: 1.5,
        })
      }
    }

    // Combat thruster wash — rear of the ship (down, opposite the nose).
    if (
      !inHangar &&
      actor.side === 'player' &&
      actor.isFlagship &&
      (scene.mode === 'fighting' || scene.mode === 'holding' || scene.mode === 'ready')
    ) {
      if (Math.random() < dt * 14) {
        scene.particles.push({
          x: actor.x + (Math.random() - 0.5) * 10,
          y: actor.y + actor.r * 0.85,
          vx: (Math.random() - 0.5) * 24,
          vy: 40 + Math.random() * 50,
          life: 0.22 + Math.random() * 0.18,
          maxLife: 0.4,
          color: scene.mode === 'fighting' ? '#e0b06a' : '#7ec8ff',
          size: 1.2 + Math.random() * 1.6,
          drag: 0.88,
        })
      }
    }
  }

  // Projectiles are authoritative from the sim; positions refresh in syncScene.

  for (const part of scene.particles) {
    part.x += part.vx * dt
    part.y += part.vy * dt
    const drag = part.drag ?? 0.9
    // Frame-rate independent-ish damping toward the old 0.9 @ ~60fps feel.
    const damp = Math.pow(drag, dt * 60)
    part.vx *= damp
    part.vy *= damp
    part.life -= dt
  }
  scene.particles = scene.particles.filter((p) => p.life > 0)

  for (const f of scene.flashes) f.life -= dt
  scene.flashes = scene.flashes.filter((f) => f.life > 0)

  for (const r of scene.rings) r.life -= dt
  scene.rings = scene.rings.filter((r) => r.life > 0)

  for (const t of scene.traces) t.life -= dt
  scene.traces = scene.traces.filter((t) => t.life > 0)

  for (const [id, actor] of scene.actors) {
    if (!actor.alive && actor.deathT <= 0) {
      scene.actors.delete(id)
      scene.prevHull.delete(id)
      scene.prevShield.delete(id)
      scene.prevPhaseWarn.delete(id)
    }
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: VisualShot): void {
  const style = shotStyle(p)
  const ang = Math.atan2(p.hy, p.hx)

  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(ang)
  ctx.shadowColor = style.color
  ctx.shadowBlur = style.glow
  ctx.globalAlpha = 0.95

  switch (style.shape) {
    case 'lance': {
      ctx.strokeStyle = style.color
      ctx.lineWidth = style.width
      ctx.beginPath()
      ctx.moveTo(-style.length, 0)
      ctx.lineTo(style.length * 0.15, 0)
      ctx.stroke()
      ctx.fillStyle = style.core
      ctx.beginPath()
      ctx.moveTo(style.length * 0.2, 0)
      ctx.lineTo(-2, -style.width)
      ctx.lineTo(-2, style.width)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'bolt': {
      const grad = ctx.createLinearGradient(-style.length, 0, 4, 0)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(0.55, style.color)
      grad.addColorStop(1, style.core)
      ctx.strokeStyle = grad
      ctx.lineWidth = style.width
      ctx.beginPath()
      ctx.moveTo(-style.length, 0)
      ctx.lineTo(2, 0)
      ctx.stroke()
      ctx.fillStyle = style.core
      ctx.beginPath()
      ctx.arc(0, 0, style.radius, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'missile': {
      ctx.fillStyle = style.color
      ctx.beginPath()
      ctx.moveTo(style.radius + 2, 0)
      ctx.lineTo(-style.length * 0.55, -style.width)
      ctx.lineTo(-style.length * 0.35, 0)
      ctx.lineTo(-style.length * 0.55, style.width)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = style.core
      ctx.beginPath()
      ctx.arc(1, 0, style.radius * 0.65, 0, Math.PI * 2)
      ctx.fill()
      // faint exhaust
      ctx.globalAlpha = 0.45
      ctx.strokeStyle = style.color
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(-style.length * 0.35, 0)
      ctx.lineTo(-style.length * 0.85, (Math.sin(p.x * 0.2) * 2))
      ctx.stroke()
      break
    }
    case 'orb': {
      ctx.fillStyle = style.color
      ctx.globalAlpha = 0.35
      ctx.beginPath()
      ctx.arc(0, 0, style.radius * 1.7, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.95
      ctx.fillStyle = style.core
      ctx.beginPath()
      ctx.arc(0, 0, style.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = style.color
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(0, 0, style.radius * 1.25, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'flak': {
      ctx.fillStyle = style.color
      for (let i = 0; i < 3; i += 1) {
        const ox = -i * 3.2
        const oy = (i - 1) * 2.2
        ctx.beginPath()
        ctx.arc(ox, oy, style.radius * (0.7 + i * 0.12), 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'spark': {
      ctx.strokeStyle = style.color
      ctx.lineWidth = style.width
      ctx.beginPath()
      ctx.moveTo(-style.length, 0)
      ctx.lineTo(2, 0)
      ctx.stroke()
      ctx.fillStyle = style.core
      ctx.fillRect(-1.5, -1.5, 3, 3)
      break
    }
    default: {
      ctx.strokeStyle = style.color
      ctx.lineWidth = style.width
      ctx.beginPath()
      ctx.moveTo(-style.length, 0)
      ctx.lineTo(0, 0)
      ctx.stroke()
      ctx.fillStyle = style.core
      ctx.beginPath()
      ctx.arc(0, 0, style.radius, 0, Math.PI * 2)
      ctx.fill()
      break
    }
  }

  ctx.restore()
}

function formatChip(n: number): string {
  return formatNumber(n)
}

function drawPlayerChips(ctx: CanvasRenderingContext2D, scene: Scene): void {
  let flag: Actor | null = null
  for (const actor of scene.actors.values()) {
    if (actor.side === 'player' && actor.isFlagship && actor.alive) {
      flag = actor
      break
    }
  }
  if (!flag) return

  const showShield = flag.shieldMax > 0
  const pad = 10
  const w = 132
  const h = showShield ? 44 : 28
  const x = pad
  const y = scene.height - h - pad
  const hullPct = Math.max(0, Math.min(1, flag.hull / Math.max(1, flag.hullMax)))
  const shieldPct = showShield
    ? Math.max(0, Math.min(1, flag.shield / flag.shieldMax))
    : 0

  ctx.save()
  ctx.fillStyle = 'rgba(12, 18, 26, 0.82)'
  ctx.strokeStyle = 'rgba(79, 143, 154, 0.45)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.rect(x + 0.5, y + 0.5, w - 1, h - 1)
  ctx.fill()
  ctx.stroke()

  ctx.font = '600 9px "IBM Plex Mono", ui-monospace, monospace'
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(139, 151, 168, 0.95)'
  ctx.fillText('HULL', x + 8, y + 14)
  ctx.fillStyle = '#e0b06a'
  ctx.textAlign = 'right'
  ctx.fillText(
    `${formatChip(flag.hull)}/${formatChip(flag.hullMax)}`,
    x + w - 8,
    y + 14,
  )

  ctx.fillStyle = '#0d1117'
  ctx.fillRect(x + 8, y + 18, w - 16, 4)
  ctx.fillStyle = '#e0b06a'
  ctx.fillRect(x + 8, y + 18, (w - 16) * hullPct, 4)

  if (showShield) {
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(139, 151, 168, 0.95)'
    ctx.fillText('SHIELD', x + 8, y + 34)
    ctx.fillStyle = '#5ec4b8'
    ctx.textAlign = 'right'
    ctx.fillText(
      `${formatChip(flag.shield)}/${formatChip(flag.shieldMax)}`,
      x + w - 8,
      y + 34,
    )

    ctx.fillStyle = '#0d1117'
    ctx.fillRect(x + 8, y + 38, w - 16, 3)
    if (shieldPct > 0) {
      ctx.fillStyle = '#5ec4b8'
      ctx.fillRect(x + 8, y + 38, (w - 16) * shieldPct, 3)
    }
  }
  ctx.restore()
}

function drawRings(ctx: CanvasRenderingContext2D, scene: Scene): void {
  for (const r of scene.rings) {
    const t = 1 - r.life / r.maxLife
    const radius = Math.max(2, r.maxR * t)
    const alpha = Math.max(0, r.life / r.maxLife) * 0.85
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = r.color
    ctx.lineWidth = r.lineW * (1 - t * 0.45)
    ctx.shadowColor = r.color
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(r.x, r.y, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function drawLineGlow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  core: string,
  width: number,
  alpha: number,
): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha * 0.45
  ctx.strokeStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 14
  ctx.lineWidth = width * 3.2
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.globalAlpha = alpha
  ctx.shadowBlur = 6
  ctx.strokeStyle = color
  ctx.lineWidth = width * 1.35
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.strokeStyle = core
  ctx.lineWidth = Math.max(1, width * 0.45)
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

function drawTraces(ctx: CanvasRenderingContext2D, scene: Scene): void {
  for (const t of scene.traces) {
    const a = Math.max(0, t.life / t.maxLife)
    drawLineGlow(ctx, t.x1, t.y1, t.x2, t.y2, t.color, t.core, t.width, a * 0.7)
  }
  for (const p of scene.projectiles.values()) {
    if (!shouldDrawTrace(p)) continue
    const style = shotStyle(p)
    const dist = Math.hypot(p.x - p.ox, p.y - p.oy)
    if (dist < 8) continue
    const alpha = p.delivery === 'charge' ? 0.85 : 0.55
    drawLineGlow(ctx, p.ox, p.oy, p.x, p.y, style.color, style.core, style.width * 0.7, alpha)
  }
}

function drawLiveBeams(ctx: CanvasRenderingContext2D, scene: Scene): void {
  for (const beam of scene.beams) {
    const from = scene.actors.get(beam.fromId)
    const to = scene.actors.get(beam.toId)
    if (!from || !to) continue
    const palette = beamColor(beam.tag, beam.side)
    const dwell = beam.duration > 0 ? beam.remaining / beam.duration : 1
    const flicker = 0.72 + 0.28 * Math.sin(scene.time * 52 + from.bobPhase)
    const alpha = (0.5 + 0.45 * dwell) * flicker
    const width = beam.side === 'player' ? 3.4 : 2.6
    drawLineGlow(ctx, from.x, from.y, to.x, to.y, palette.glow, palette.core, width, alpha)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = palette.core
    ctx.shadowColor = palette.glow
    ctx.shadowBlur = 16
    ctx.beginPath()
    ctx.arc(to.x, to.y, 5 + dwell * 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawChargeLasers(ctx: CanvasRenderingContext2D, scene: Scene): void {
  for (const actor of scene.actors.values()) {
    if (!actor.alive || actor.telegraph <= 0 || !actor.chargeLaser) continue
    if (actor.telegraphToX == null || actor.telegraphToY == null) continue
    const x2 = actor.telegraphToX
    const y2 = actor.telegraphToY
    const fill = actor.telegraph
    const color = '#7ec8ff'
    const core = '#ffffff'
    // Faint lock line the whole way, then a growing hot core.
    drawLineGlow(ctx, actor.x, actor.y, x2, y2, color, core, 1.4, 0.22 + fill * 0.18)
    const hx = actor.x + (x2 - actor.x) * fill
    const hy = actor.y + (y2 - actor.y) * fill
    drawLineGlow(ctx, actor.x, actor.y, hx, hy, color, core, 2.2 + fill * 1.6, 0.45 + fill * 0.5)
    ctx.save()
    ctx.globalAlpha = 0.35 + fill * 0.55
    ctx.fillStyle = core
    ctx.shadowColor = color
    ctx.shadowBlur = 12 + fill * 16
    ctx.beginPath()
    ctx.arc(x2, y2, 3 + fill * 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.4 + fill * 1.6
    ctx.beginPath()
    ctx.arc(x2, y2, 8 + fill * 10, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function drawFlashes(ctx: CanvasRenderingContext2D, scene: Scene): void {
  for (const f of scene.flashes) {
    const t = Math.max(0, f.life / f.maxLife)
    const a = f.strength * t * t
    if (a <= 0.01) continue
    ctx.fillStyle = `rgba(${f.r},${f.g},${f.b},${a})`
    ctx.fillRect(0, 0, scene.width, scene.height)
    // Soft vignette edge so flashes feel like a camera hit, not a flat wash.
    const vig = ctx.createRadialGradient(
      scene.width / 2,
      scene.height / 2,
      scene.height * 0.15,
      scene.width / 2,
      scene.height / 2,
      scene.height * 0.72,
    )
    vig.addColorStop(0, `rgba(${f.r},${f.g},${f.b},0)`)
    vig.addColorStop(1, `rgba(${f.r},${f.g},${f.b},${a * 0.55})`)
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, scene.width, scene.height)
  }
}

function drawScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  ctx.save()
  if (scene.shake > 0.05) {
    const mag = scene.shake
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag)
  }

  drawBackground(ctx, scene)
  drawRings(ctx, scene)
  drawTraces(ctx, scene)
  drawLiveBeams(ctx, scene)
  drawChargeLasers(ctx, scene)

  for (const p of scene.projectiles.values()) {
    drawProjectile(ctx, p)
  }

  const actors = [...scene.actors.values()].sort((a, b) => a.y - b.y)
  for (const actor of actors) {
    const dying = !actor.alive
    const alpha = dying ? Math.max(0, actor.deathT) : 1
    if (alpha <= 0) continue
    const enterScale = actor.isBoss ? 0.45 : 0.3
    const scale = dying
      ? 0.35 + actor.deathT * 0.65
      : 1 - actor.enterT * enterScale
    const fill = sideFill(actor.side, actor.isBoss)
    const stroke = actor.side === 'player' ? '#ffe8c7' : '#d0dce8'

    // Active shield bubble (only when the unit actually has shield remaining).
    if (actor.alive && actor.shieldMax > 0 && actor.shield > 0) {
      const pct = actor.shield / actor.shieldMax
      const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(scene.time * 3.2 + actor.bobPhase))
      ctx.save()
      ctx.translate(actor.x, actor.y)
      ctx.strokeStyle = '#7ec8ff'
      ctx.globalAlpha = (0.18 + pct * 0.28) * pulse * alpha
      ctx.lineWidth = 1.4 + pct
      ctx.beginPath()
      ctx.arc(0, 0, actor.r + 5 + pct * 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    ctx.save()
    ctx.translate(actor.x, actor.y)
    ctx.scale(scale, scale)
    if (actor.hitFlash > 0) {
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = 16 * actor.hitFlash
    } else if (scene.mode === 'repairing' && actor.isFlagship && actor.side === 'player') {
      ctx.shadowColor = '#7dffb0'
      ctx.shadowBlur = 10 + Math.sin(scene.time * 6) * 6
    } else if (actor.isBoss && actor.enterT > 0) {
      ctx.shadowColor = '#ff6b6b'
      ctx.shadowBlur = 18 * (actor.enterT / 0.7)
    }
    // Face the incoming lane: player nose up, enemies nose down.
    ctx.rotate(actor.side === 'player' ? -Math.PI / 2 : Math.PI / 2)
    drawShape(ctx, actor.shape, actor.r, fill, stroke, alpha)

    if (actor.muzzle > 0) {
      ctx.globalAlpha = actor.muzzle
      ctx.fillStyle = tagColor(actor.weaponTag)
      ctx.shadowColor = tagColor(actor.weaponTag)
      ctx.shadowBlur = 14 * actor.muzzle
      ctx.beginPath()
      ctx.arc(actor.r, 0, 5 + actor.muzzle * 5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    if ((actor.telegraph > 0 && !actor.chargeLaser) || (actor.phaseWarn > 0 && actor.telegraph <= 0)) {
      const pulse = actor.telegraph > 0 ? actor.telegraph : 1 - actor.phaseWarn
      // Telegraph = amber-red slam charge; phase warn = cool cyan (no purple).
      const color = actor.telegraph > 0 ? '#ff6b4a' : '#7ec8ff'
      ctx.save()
      ctx.translate(actor.x, actor.y)
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.35 + pulse * 0.55
      ctx.lineWidth = 2 + pulse * 2.5
      ctx.shadowColor = color
      ctx.shadowBlur = 10 + pulse * 14
      ctx.beginPath()
      ctx.arc(0, 0, actor.r + 6 + pulse * 10, 0, Math.PI * 2)
      ctx.stroke()
      if (actor.telegraph > 0) {
        ctx.beginPath()
        ctx.arc(0, 0, actor.r + 6 + pulse * 10, -Math.PI / 2, -Math.PI / 2 + pulse * Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Compact bars on units; flagship uses the chip panel instead.
    if (!(actor.side === 'player' && actor.isFlagship)) {
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
  }

  for (const part of scene.particles) {
    ctx.globalAlpha = Math.max(0, part.life / part.maxLife)
    ctx.fillStyle = part.color
    ctx.beginPath()
    ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  drawFlashes(ctx, scene)
  drawPlayerChips(ctx, scene)

  ctx.restore()
}

export function Battlefield({
  playerUnits,
  enemyUnits,
  projectiles,
  beams,
  fx,
  mode,
  paused = false,
}: BattlefieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const propsRef = useRef({ playerUnits, enemyUnits, projectiles, beams, fx, mode, paused })
  propsRef.current = { playerUnits, enemyUnits, projectiles, beams, fx, mode, paused }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scene: Scene = {
      actors: new Map(),
      projectiles: new Map(),
      beams: [],
      traces: [],
      particles: [],
      flashes: [],
      rings: [],
      shake: 0,
      seenFx: new Set(),
      seenProj: new Set(),
      seenBeam: new Set(),
      prevHull: new Map(),
      prevShield: new Map(),
      prevPhaseWarn: new Map(),
      knownBossIds: new Set(),
      prevMode: null,
      width: VIEW_W,
      height: VIEW_H,
      time: 0,
      mode: 'ready',
      starSeed: 1234567,
      scroll: 0,
    }
    sceneRef.current = scene

    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      const p = propsRef.current
      const dt = p.paused ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now

      syncScene(scene, p.playerUnits, p.enemyUnits, p.projectiles, p.beams, p.fx, p.mode)
      stepScene(scene, dt)

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cssW = canvas.clientWidth || VIEW_W
      const cssH = canvas.clientHeight || VIEW_H
      const needW = Math.floor(cssW * dpr)
      const needH = Math.floor(cssH * dpr)
      if (canvas.width !== needW || canvas.height !== needH) {
        canvas.width = needW
        canvas.height = needH
      }
      const scale = Math.max(cssW / VIEW_W, cssH / VIEW_H)
      const ox = (cssW - VIEW_W * scale) / 2
      const oy = (cssH - VIEW_H * scale) / 2
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#120e0c'
      ctx.fillRect(0, 0, cssW, cssH)
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy)
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
      scene.projectiles = new Map()
      scene.beams = []
      scene.traces = []
      scene.seenFx.clear()
      scene.seenProj.clear()
      scene.seenBeam.clear()
    }
    if (mode === 'docked' || mode === 'repairing') {
      // Drop enemy ghosts when entering the hangar.
      for (const [id, actor] of scene.actors) {
        if (actor.side === 'enemy') {
          scene.actors.delete(id)
          scene.prevHull.delete(id)
          scene.prevShield.delete(id)
          scene.prevPhaseWarn.delete(id)
        }
      }
      scene.knownBossIds.clear()
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
