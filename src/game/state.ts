import type { GameState, Resources, ShipCombatStats, WeaponInstance } from './types'
import {
  MIN_CORE_WEAPON_RANGE,
  SHORT_RANGE_MAX,
  STARTER_FRAME_ID,
  aiDoctrinesActive,
  equippedFrame,
  essenceDamageMultiplier,
  essenceHullBonus,
  frameCoreDamageMult,
  getFrame,
  getModule,
  masteryBonus,
  metaDamageMultiplier,
  moduleLeveledBonus,
  moduleLevelMultiplier,
  moduleWeaponDamage,
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
import { combinedCoreMods, effectiveCoreLevel } from './coreProgression'
import { coreInstanceAtSlot } from './coreInstances'
import { coreRelicModifiers } from './relicEffects'
import {
  createEmptyNetworkState,
} from './network'
import {
  createEmptyFoundryState,
} from './foundry'
import { createEmptyRelicState } from './relics'
import { createEmptyFurnaceState, furnaceDamageMult, furnaceShieldMult } from './furnace'
import {
  createEmptyHiveResearchState,
  hiveResearchDamageMult,
  hiveResearchShieldMult,
} from './hiveResearch'
import { createEmptyProtocolState, protocolHullMult, protocolMutes } from './protocols'
import { createEmptyEchoState, echoDamageMult, echoShieldMult } from './echo'
import { createEmptyProcessState, processDamageMult, processShieldMult } from './process'
import { createEmptySpecialistState, specialistDamageMult, specialistShieldMult } from './specialists'
import { createEmptyCapitalState, capitalDamageMult, capitalShieldMult } from './capital'
import { emptyLastSortie } from './sortieSummary'
import { createEmptyPlaytest } from './playtest'
import { emptyWaveRuntime } from './waveRuntime'
import { createSimRng } from './simRng'
import {
  createEmptyWorkshop,
  cycleRateMult,
  damageControlTakenMult,
  emptyGenericUpgradeUnlocks,
  runHullMult,
  runShieldMult,
  shopArmor,
  weaponPowerMult,
} from './workshop'
import { matterHullMult, matterShieldMult, weaponCalibrationMult } from './matter'
import { directiveIncomingMult, directiveShieldMult, directiveSplashMult, directiveWeaponMult } from './directives'

export const SAVE_VERSION = 48
export const SAVE_KEY = 'cosmic-idle-save'

export const RESOURCE_LABELS: Record<keyof Resources, string> = {
  scrap: 'Scrap',
  alloys: 'Alloys',
  energy: 'Energy',
  data: 'Data',
  essence: 'Essence',
  aiPoints: 'Process',
  prestigeMatter: 'Rebuild Matter',
  challengePoints: 'Challenge Marks',
  salvage: 'Salvage',
  choirAsh: 'Ash',
  heat: 'Heat',
}

export function createInitialState(now = Date.now()): GameState {
  const hullMax = getFrame(STARTER_FRAME_ID)?.baseHull ?? 40
  const state: GameState = {
    version: SAVE_VERSION,
    lastTickAt: now,
    resources: {
      scrap: 25,
      alloys: 0,
      energy: 0,
      data: 0,
      essence: 0,
      aiPoints: 0,
      prestigeMatter: 0,
      challengePoints: 0,
      salvage: 0,
      choirAsh: 0,
      heat: 0,
    },
    shipyard: {
      frameId: STARTER_FRAME_ID,
      modules: ['pulse-cannon', 'plate-layer'],
      coreInstances: [
        { id: 'pulse-cannon:1', moduleId: 'pulse-cannon' },
        { id: 'plate-layer:1', moduleId: 'plate-layer' },
      ],
      equippedCoreIds: ['pulse-cannon:1', 'plate-layer:1'],
      unlockedFrames: [STARTER_FRAME_ID],
      unlockedModules: ['pulse-cannon', 'plate-layer'],
      frameLocked: false,
    },
    combat: {
      ...emptyWaveRuntime(),
      wave: 1,
      bestWave: 0,
      runUpgrades: {},
      coreMasteryStart: {},
      coreMasteryXp: {},
      coreBossClears: {},
      coreNewBest: {},
      coreMilestones: {},
      inFight: false,
      sortiePaused: false,
      docked: true,
      consecutiveLosses: 0,
      sortieSeed: 0,
      rng: createSimRng(1),
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
      beams: [],
      fx: [],
      log: ['Hiveworks dock online. Launch a sortie when ready.'],
      fragmentNotice: null,
      lastSortie: emptyLastSortie(),
      sortieMark: null,
      defeatLeft: 0,
      defeatTactical: false,
      directives: [],
      directiveOffer: null,
      coreRuntime: {
        salvageMarks: {},
        moltenPools: [],
        barrierInterceptCooldown: 0,
        barrierEmergencyUntil: 0,
        barrierRearmWeak: false,
        ablativeLayerHp: 0,
        ablativeRegenAt: 0,
        tempArmor: 0,
        tempArmorUntil: 0,
        deferredDamage: 0,
        deferredUntil: 0,
        choirTapHeatGranted: 0,
        choirTapFurnaceFeed: false,
        pulseChainAt: {},
        phaseRamp: {},
        phaseLockMemory: {},
        phaseExposureUntil: {},
        heavyFractureUntil: 0,
        gravWellUntil: 0,
        aegisOverflow: 0,
        aegisBreakUntil: 0,
        plateBreakArmorUntil: 0,
        nanoLatheBurstAt: 0,
      },
    },
    workshop: createEmptyWorkshop(),
    base: {
      workerDrones: 0,
      assignments: {},
    },
    network: createEmptyNetworkState(),
    foundry: createEmptyFoundryState(),
    relics: createEmptyRelicState(),
    furnace: createEmptyFurnaceState(),
    hiveResearch: createEmptyHiveResearchState(),
    protocols: createEmptyProtocolState(),
    echo: createEmptyEchoState(),
    process: createEmptyProcessState(),
    specialists: createEmptySpecialistState(),
    capital: createEmptyCapitalState(),
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
      cycle: { bestWave: 0, normalSortiesCompleted: 0, scrapGenerated: 0 },
    },
    codex: {
      discoveredHostileIds: [],
      discoveredBossIds: [],
      discoveredCommanderTraitIds: [],
      hostileCommander: {},
      bossClears: [],
      milestones: [],
    },
    meta: {
      bestWave: 0,
      sortieSerial: 0,
      act1Cleared: false,
      act1FinalePending: false,
      ascensionCount: 0,
      seenOnboarding: [],
      onboarding: {},
      acknowledgedEvents: [],
      seenContent: [],
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
      moduleMasteryXp: {},
      lifetimeCoreRunBuys: 0,
      signalCoresCarryOver: false,
      starterCombatLesson: 2,
      hullLostOnce: false,
      numberNotation: 'engineering',
      damageNumbers: 'standard',
      sortieSpeed: 1,
      extractedOnce: false,
      genericUpgradeUnlocks: emptyGenericUpgradeUnlocks(),
      extractionExplained: false,
      coreSlotGrants: [],
    },
    core: createEmptyCoreState(),
    signalCores: createEmptySignalCoresState(),
    playtest: createEmptyPlaytest(now),
  }
  const stats = computeShipStats(state)
  state.combat.playerHull = stats.hullMax
  state.combat.playerHullMax = stats.hullMax
  state.combat.playerShield = stats.shieldMax
  state.combat.playerShieldMax = stats.shieldMax
  return state
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
  mult *= processDamageMult(state)
  mult *= directiveWeaponMult(state)
  mult *= ballisticsDamageMult(state.core?.ranks.ballistics ?? 0)
  const coreDmg = computeSignalCoreBonuses(state).damage
  if (coreDmg) mult *= 1 + coreDmg * 0.5
  mult *= furnaceDamageMult(state)
  mult *= hiveResearchDamageMult(state)
  mult *= echoDamageMult(state)
  mult *= specialistDamageMult(state)
  mult *= capitalDamageMult(state)
  return mult
}

export function buildCoreWeapon(state: GameState, slot: number): WeaponInstance | null {
  const moduleId = state.shipyard.modules[slot]
  const mod = getModule(moduleId)
  if (!mod?.weapon) return null
  if (protocolMutes(state, 'weapons') && mod.role === 'weapon') return null
  const mult = globalDamageMultiplier(state)
  const shortRange = state.prestige.activeChallengeId === 'short-range'
  const capRange = (range: number) => (shortRange ? Math.min(range, SHORT_RANGE_MAX) : range)
  const level = Math.floor(effectiveCoreLevel(state, slot))
  const mastery = masteryBonus(moduleMasteryRank(state, moduleId))
  const mods = combinedCoreMods(state, moduleId)
  const coreId = coreInstanceAtSlot(state, slot)?.id
  const relicMods = coreId ? coreRelicModifiers(state, coreId) : coreRelicModifiers(state, '')
  return {
    id: `${moduleId}-wpn-${slot}`,
    name: mod.weapon.name,
    damage:
      moduleWeaponDamage(mod, level, mastery) *
      mods.damageMult *
      relicMods.damageMult *
      relicMods.ballisticOutputMult *
      relicMods.universalMult *
      mult *
      weaponPowerMult(state) *
      (mod.role === 'weapon' ? weaponCalibrationMult(state) : 1) *
      frameCoreDamageMult(state),
    cooldown: (mod.weapon.cooldown * mods.cooldownMult) / cycleRateMult(state),
    cooldownLeft: 0,
    range: capRange(mod.weapon.range + mods.rangeAdd),
    tags: [...mod.weapon.tags],
    splash: ((mod.weapon.splash ?? 0) + mods.splashAdd) * directiveSplashMult(state),
    dotDuration: mod.weapon.dotDuration ?? 0,
    dotDamage: (mod.weapon.dotDamage ?? 0) * mult * mastery,
    telegraphDuration: mod.weapon.telegraphDuration ?? 0,
    telegraphLeft: 0,
    delivery: mod.weapon.delivery,
    hullDamage: mod.weapon.hullDamage,
    shieldDamage: mod.weapon.shieldDamage,
    armorDamage: mod.weapon.armorDamage,
  }
}

export function buildFlagshipWeapons(state: GameState): WeaponInstance[] {
  const frame = equippedFrame(state)
  const mult = globalDamageMultiplier(state)
  const shortRange = state.prestige.activeChallengeId === 'short-range'
  const capRange = (range: number) => (shortRange ? Math.min(range, SHORT_RANGE_MAX) : range)
  const weapons: WeaponInstance[] = []
  const muteGuns = protocolMutes(state, 'weapons')
  const batteryDamage = frame.baseDamage > 0 ? frame.baseDamage : muteGuns ? 5 : 0
  if (batteryDamage > 0) {
    weapons.push({
      id: 'frame-battery',
      name: 'Frame Battery',
      damage: batteryDamage * mult * weaponPowerMult(state),
      cooldown: 1 / cycleRateMult(state),
      cooldownLeft: 0,
      // Must reach the farthest legal enemy park, same rule as Core guns.
      range: capRange(MIN_CORE_WEAPON_RANGE),
      tags: ['kinetic'],
      splash: 0,
      dotDuration: 0,
      dotDamage: 0,
      telegraphDuration: 0,
      telegraphLeft: 0,
      hullDamage: 1,
      shieldDamage: 0.6,
      armorDamage: 1,
      delivery: 'bolt',
    })
  }

  for (let slot = 0; slot < state.shipyard.modules.length; slot += 1) {
    const weapon = buildCoreWeapon(state, slot)
    if (weapon) weapons.push(weapon)
  }

  return weapons
}

/** Derive combat stats from frame, modules, research, meta, essence, and challenges. */
export function computeShipStats(state: GameState): ShipCombatStats {
  const frame = equippedFrame(state)
  let hullMax =
    frame.baseHull +
    essenceHullBonus(state.essence.purchased)
  let damageTakenMult = 1
  let armor = 0
  let shieldMax = frame.baseShield ?? 0
  let evasion = 0
  let escortCount = 0

  for (let slot = 0; slot < state.shipyard.modules.length; slot += 1) {
    const moduleId = state.shipyard.modules[slot]!
    const mod = getModule(moduleId)
    if (!mod) continue
    if (protocolMutes(state, 'shields') && mod.role === 'defense') continue
    const level = Math.floor(effectiveCoreLevel(state, slot))
    const mastery = masteryBonus(moduleMasteryRank(state, moduleId))
    const mods = combinedCoreMods(state, moduleId)
    const pctMult = moduleLevelMultiplier(level) * mastery
    hullMax += moduleLeveledBonus(mod.hullBonus, mod.hullBonusPerLevel, level, mastery)
    const taken = mod.damageTakenMult
    damageTakenMult *= taken < 1 ? 1 - (1 - taken) * Math.min(1.5, pctMult) / 1.5 : taken
    armor += moduleLeveledBonus(mod.armorBonus ?? 0, mod.armorBonusPerLevel, level, mastery)
    shieldMax +=
      moduleLeveledBonus(mod.shieldBonus ?? 0, mod.shieldBonusPerLevel, level, mastery) * mods.shieldMult
    evasion += (mod.evasionBonus ?? 0) * Math.min(1.4, pctMult)
    escortCount += mod.escorts ?? 0
  }

  hullMax *= frame.hullMult ?? 1
  shieldMax *= frame.shieldMult ?? 1

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
  shieldMax *= furnaceShieldMult(state)
  shieldMax *= hiveResearchShieldMult(state)
  shieldMax *= echoShieldMult(state)
  shieldMax *= specialistShieldMult(state)
  shieldMax *= capitalShieldMult(state)
  shieldMax *= processShieldMult(state)

  if (protocolMutes(state, 'shields')) shieldMax = 0

  hullMax *= protocolHullMult(state)
  hullMax *= runHullMult(state)
  hullMax *= matterHullMult(state)
  shieldMax *= runShieldMult(state)
  shieldMax *= matterShieldMult(state)
  armor += shopArmor(state)
  shieldMax *= directiveShieldMult(state)
  damageTakenMult *= directiveIncomingMult(state)
  damageTakenMult *= damageControlTakenMult(state)

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
