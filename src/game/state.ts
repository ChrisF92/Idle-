import type { GameState, Resources, ShipCombatStats, WeaponInstance } from './types'
import {
  SHORT_RANGE_MAX,
  aiDoctrinesActive,
  essenceDamageMultiplier,
  essenceHullBonus,
  getFrame,
  getModule,
  masteryBonus,
  matterShopHullBonus,
  matterShopShieldBonus,
  metaDamageMultiplier,
  moduleLevel,
  moduleLevelMultiplier,
  moduleMasteryRank,
  prestigeMomentumDamageBonus,
  researchDamageMultiplier,
} from './catalog'
import {
  ballisticsDamageMult,
  createEmptyCoreState,
  platingArmorBonus,
  platingHullMult,
  reactorsShieldBonus,
  sensorsEvasionBonus,
} from './core'
import {
  computeSignalCoreBonuses,
  createEmptySignalCoresState,
} from './signalCores'

export const SAVE_VERSION = 20
export const SAVE_KEY = 'cosmic-idle-save'

export const RESOURCE_LABELS: Record<keyof Resources, string> = {
  scrap: 'Scrap',
  alloys: 'Alloys',
  energy: 'Energy',
  data: 'Data',
  essence: 'Essence',
  aiPoints: 'AI Points',
  prestigeMatter: 'Prestige Matter',
  challengePoints: 'Challenge Points',
  salvage: 'Salvage',
}

export function createInitialState(now = Date.now()): GameState {
  const hullMax = getFrame('scout-frame')?.baseHull ?? 130
  return {
    version: SAVE_VERSION,
    lastTickAt: now,
    resources: {
      scrap: 25,
      alloys: 5,
      energy: 10,
      data: 0,
      essence: 0,
      aiPoints: 0,
      prestigeMatter: 0,
      challengePoints: 0,
      salvage: 0,
    },
    shipyard: {
      frameId: 'scout-frame',
      modules: ['pulse-cannon'],
      unlockedFrames: ['scout-frame'],
      unlockedModules: ['pulse-cannon'],
      moduleLevels: {},
      frameLocked: false,
    },
    combat: {
      sector: 1,
      highestSector: 0,
      wave: 1,
      inFight: false,
      docked: true,
      campaign: true,
      consecutiveLosses: 0,
      bossPhase: 0,
      fightElapsed: 0,
      playerHull: hullMax,
      playerHullMax: hullMax,
      playerShield: 0,
      playerShieldMax: 0,
      playerUnits: [],
      enemyUnits: [],
      enemyName: 'None',
      enemyFamily: '',
      enemyTags: [],
      isBoss: false,
      enemyHull: 0,
      enemyHullMax: 0,
      projectiles: [],
      fx: [],
      log: ['Systems online. Choose a frame, then Launch.'],
    },
    base: {
      workerDrones: 0,
      assignments: {},
      manufactureProgress: 0,
      fabProject: null,
    },
    research: {
      unlocked: [],
    },
    ai: {
      purchased: [],
    },
    essence: {
      purchased: [],
    },
    prestige: {
      prestigeCount: 0,
      activeChallengeId: null,
      challengeClears: {},
      shop: {},
      matterShop: {},
    },
    codex: {
      seenFamilies: [],
    },
    meta: {
      highestSectorEver: 0,
      act1Cleared: false,
      ascensionCount: 0,
      seenOnboarding: [],
      aiUnlocked: false,
      codexUnlocked: false,
      laborProfile: 'balanced',
      completedAchievements: [],
      achievementCompletions: {},
      lifetimeSectorClears: 0,
      lifetimeFabCrafts: 0,
      lifetimeCoreMerges: 0,
      lifetimeWaveClears: 0,
      lifetimeDronesBuilt: 0,
      discoveredModules: [],
      moduleMastery: {},
      signalCoresCarryOver: false,
      starterCombatLesson: 0,
    },
    core: createEmptyCoreState(),
    signalCores: createEmptySignalCoresState(),
    parts: {},
  }
}

export function globalDamageMultiplier(state: GameState): number {
  let mult = researchDamageMultiplier(state.research.unlocked)
  mult *= essenceDamageMultiplier(state.essence.purchased)
  mult *=
    1 +
    prestigeMomentumDamageBonus(
      state.prestige.prestigeCount,
      state.meta.ascensionCount ?? 0,
    )
  mult *= metaDamageMultiplier(
    state.resources.prestigeMatter,
    state.resources.challengePoints,
    state.prestige.shop,
    state.prestige.matterShop,
    state.prestige.challengeClears,
  )
  if (aiDoctrinesActive(state, 'focus-fire')) mult *= 1.06
  mult *= ballisticsDamageMult(state.core?.ranks.ballistics ?? 0)
  const coreDmg = computeSignalCoreBonuses(state).damage
  // Signal damage is a softer half-weight layer (not a full multiply stack).
  if (coreDmg) mult *= 1 + coreDmg * 0.5
  return mult
}

export function buildFlagshipWeapons(state: GameState): WeaponInstance[] {
  const frame = getFrame(state.shipyard.frameId) ?? getFrame('scout-frame')!
  const mult = globalDamageMultiplier(state)
  const shortRange = state.prestige.activeChallengeId === 'short-range'
  const capRange = (range: number) => (shortRange ? Math.min(range, SHORT_RANGE_MAX) : range)
  const weapons: WeaponInstance[] = [
    {
      id: 'frame-battery',
      name: 'Frame Battery',
      damage: frame.baseDamage * mult,
      cooldown: 1,
      cooldownLeft: 0,
      // Must reach early kite packs (Ethereal ~110, Divine core ~105).
      range: capRange(120),
      tags: ['kinetic'],
      splash: 0,
      dotDuration: 0,
      dotDamage: 0,
      telegraphDuration: 0,
      telegraphLeft: 0,
    },
  ]

  for (const moduleId of state.shipyard.modules) {
    const mod = getModule(moduleId)
    if (!mod?.weapon) continue
    const lvlMult =
      moduleLevelMultiplier(moduleLevel(state.shipyard.moduleLevels, moduleId)) *
      masteryBonus(moduleMasteryRank(state, moduleId))
    weapons.push({
      id: `${moduleId}-wpn`,
      name: mod.weapon.name,
      damage: mod.weapon.damage * mult * lvlMult,
      cooldown: mod.weapon.cooldown,
      cooldownLeft: 0,
      range: capRange(mod.weapon.range),
      tags: [...mod.weapon.tags],
      splash: mod.weapon.splash ?? 0,
      dotDuration: mod.weapon.dotDuration ?? 0,
      dotDamage: (mod.weapon.dotDamage ?? 0) * mult * lvlMult,
      telegraphDuration: 0,
      telegraphLeft: 0,
    })
  }

  return weapons
}

/** Derive combat stats from frame, modules, research, meta, essence, and challenges. */
export function computeShipStats(state: GameState): ShipCombatStats {
  const frame = getFrame(state.shipyard.frameId) ?? getFrame('scout-frame')!
  let hullMax =
    frame.baseHull +
    essenceHullBonus(state.essence.purchased) +
    matterShopHullBonus(state.prestige.matterShop)
  let damageTakenMult = 1
  let armor = 0
  let shieldMax = matterShopShieldBonus(state.prestige.matterShop)
  let evasion = 0
  let escortCount = 0

  for (const moduleId of state.shipyard.modules) {
    const mod = getModule(moduleId)
    if (!mod) continue
    const lvlMult =
      moduleLevelMultiplier(moduleLevel(state.shipyard.moduleLevels, moduleId)) *
      masteryBonus(moduleMasteryRank(state, moduleId))
    hullMax += mod.hullBonus * lvlMult
    // Soften incoming mult toward 1 as levels rise for defensive modules
    const taken = mod.damageTakenMult
    damageTakenMult *= taken < 1 ? 1 - (1 - taken) * Math.min(1.5, lvlMult) / 1.5 : taken
    armor += (mod.armorBonus ?? 0) * lvlMult
    shieldMax += (mod.shieldBonus ?? 0) * lvlMult
    evasion += (mod.evasionBonus ?? 0) * Math.min(1.4, lvlMult)
    escortCount += mod.escorts ?? 0
  }

  if (
    state.prestige.activeChallengeId === 'thin-hull' ||
    state.prestige.activeChallengeId === 'hollow-choir'
  ) {
    hullMax *= 0.5
  }

  const platingRank = state.core?.ranks.plating ?? 0
  const reactorsRank = state.core?.ranks.reactors ?? 0
  const sensorsRank = state.core?.ranks.sensors ?? 0
  hullMax *= platingHullMult(platingRank)
  armor += platingArmorBonus(platingRank)
  shieldMax += reactorsShieldBonus(reactorsRank)
  evasion += sensorsEvasionBonus(sensorsRank)

  const signalBonuses = computeSignalCoreBonuses(state)
  if (signalBonuses.hull) hullMax *= 1 + signalBonuses.hull
  armor += signalBonuses.armor
  shieldMax += signalBonuses.shield
  evasion += signalBonuses.evasion

  evasion = Math.min(0.45, evasion)

  const weapons = buildFlagshipWeapons(state)
  let damage = weapons.reduce((sum, w) => sum + w.damage / Math.max(0.2, w.cooldown), 0)
  damage += escortCount * (6 * globalDamageMultiplier(state))

  return {
    damage,
    hullMax,
    shieldMax,
    armor,
    evasion,
    damageTakenMult,
    escortCount,
  }
}

/** Cap current hull/shield to new maxima without full healing. */
export function syncPersistedHullCaps(state: GameState): void {
  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax
  state.combat.playerHull = Math.min(state.combat.playerHull, stats.hullMax)
  state.combat.playerShield = Math.min(state.combat.playerShield, stats.shieldMax)
  if (state.combat.playerHull <= 0) {
    state.combat.playerHull = Math.max(1, stats.hullMax * 0.1)
  }
}

export function fullHealPlayer(state: GameState): void {
  const stats = computeShipStats(state)
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerShieldMax = stats.shieldMax
  state.combat.playerHull = stats.hullMax
  state.combat.playerShield = stats.shieldMax
}
