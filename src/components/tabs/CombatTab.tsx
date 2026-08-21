import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { GameState, RunUpgradeCategory, RunUpgradeId } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { formatCompact } from '../../game/format'
import { activeGuideStep, hasHullLostOnce, isCoresGuideTarget, isSystemUnlocked, type GuideStep } from '../../game/progression'
import { attentionAria, coresAttention } from '../../game/hubAttention'
import { AttentionPips } from '../AttentionPips'
import { Battlefield, type BattlefieldMode } from '../Battlefield'
import { CoreSheet } from '../CoreSheet'
import { FOUNDRY_RECIPES } from '../../game/foundry'
import { markLocalOk } from '../../hooks/useJustBecame'
import { hasProcess } from '../../game/process'
import {
  effectiveUpgradeLevel,
  runUpgradeCost,
  visibleRunUpgrades,
  workshopLevel,
} from '../../game/workshop'
import { isBossWave } from '../../game/waves'
import { getEchoRun } from '../../game/echo'
import { activeProtocol } from '../../game/protocols'
import { isChallengeSortie } from '../../game/frontier'
import { DIRECTIVES, getDirective, hasDirectiveOffer } from '../../game/directives'

interface CombatTabProps {
  state: GameState
  onLaunch: () => void
  onExtract?: () => void
  onBuyRunUpgrade?: (id: RunUpgradeId) => void
  onViewReport?: () => void
  onUpgrade: (moduleId: string) => void
  onPickMilestone: (moduleId: string, milestoneId: string, choiceId: string) => void
  paused?: boolean
  guide?: GuideStep | null
  onMarkCoresSeen?: () => void
  coresRequest?: { key: number; moduleId?: string } | null
  onCoresRequestHandled?: () => void
  onOpenFoundry?: () => void
  onOpenPrints?: () => void
  onBuyMaxCores?: () => void
  onChooseDirective?: (id: string) => void
  onEquipRelic?: (moduleId: string, relicId: string) => void
  onRemoveRelic?: (moduleId: string) => void
}

function coresGuideActive(state: GameState, guide?: GuideStep | null): boolean {
  const step = guide ?? activeGuideStep(state, 'combat')
  if (!step) return false
  return isCoresGuideTarget(step)
}

function CraftStrip({ state, onOpen }: { state: GameState; onOpen: () => void }) {
  if (!isSystemUnlocked(state, 'foundry')) return null
  const running = state.foundry.slots.flatMap((slot, index) => {
    if (!slot.recipeId) return []
    return [
      {
        index,
        progress: slot.progress,
        name: FOUNDRY_RECIPES.find((r) => r.id === slot.recipeId)?.name ?? 'Queued',
      },
    ]
  })
  if (running.length === 0) return null
  const label = running.map((job) => job.name).join(', ')
  return (
    <button
      type="button"
      className="craft-strip"
      onClick={onOpen}
      aria-label={`Foundry smelting ${label}. Open Foundry.`}
    >
      <span className="combat-hud-kicker">Foundry</span>
      {running.map((job) => (
        <span key={job.index} className="craft-chip">
          <span className="craft-chip-name">{job.name}</span>
          <span className="network-fill is-active" aria-hidden>
            <span style={{ transform: `scaleX(${job.progress})` }} />
          </span>
        </span>
      ))}
    </button>
  )
}

function FragmentChip({ state, onOpen }: { state: GameState; onOpen?: () => void }) {
  const notice = state.combat.fragmentNotice
  const [chip, setChip] = useState(notice)
  useEffect(() => {
    if (!notice) return
    setChip(notice)
    const t = window.setTimeout(() => setChip(null), 2200)
    return () => window.clearTimeout(t)
  }, [notice])
  if (!chip) return null
  const partLabel = chip.partType.charAt(0).toUpperCase() + chip.partType.slice(1)
  const body = (
    <>
      <span className="combat-hud-kicker">Fragment</span>
      <strong className="fragment-chip-title">{chip.name}</strong>
      <span className="fragment-chip-line">
        {partLabel} {Math.min(chip.partHave, chip.partNeed)}/{chip.partNeed}
        <span className="muted"> · {chip.totalHave}/{chip.totalNeed}</span>
      </span>
    </>
  )
  if (!onOpen) {
    return (
      <div className="fragment-chip" role="status">
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      className="fragment-chip"
      onClick={onOpen}
      aria-label={`${chip.name} fragment. Open prints.`}
    >
      {body}
    </button>
  )
}

function RunUpgradePanel({
  state,
  category,
  onBuy,
}: {
  state: GameState
  category: RunUpgradeCategory
  onBuy?: (id: RunUpgradeId) => void
}) {
  const best = Math.max(state.meta.bestWave ?? 0, state.combat.bestWave ?? 0, state.combat.wave ?? 1)
  const rows = visibleRunUpgrades(best, category)
  if (rows.length === 0) return <p className="muted">More upgrades open as Best Wave climbs.</p>
  return (
    <div className="run-upgrade-list">
      {rows.map((def) => {
        const level = effectiveUpgradeLevel(state, def.id)
        const start = workshopLevel(state, def.id)
        const cost = runUpgradeCost(level)
        const affordable = state.resources.salvage >= cost
        return (
          <button
            key={def.id}
            type="button"
            className={affordable ? 'network-row is-affordable' : 'network-row'}
            disabled={!onBuy || !affordable}
            onClick={() => onBuy?.(def.id)}
          >
            <span>
              <strong>{def.name}</strong>
              <span className="muted">
                {' '}
                Lv {level}
                {start > 0 ? ` (${start} Workshop)` : ''}
              </span>
              <p className="muted">{def.blurb}</p>
            </span>
            <strong>{formatCompact(cost)}</strong>
          </button>
        )
      })}
    </div>
  )
}

export function CombatTab({
  state,
  onLaunch,
  onExtract,
  onBuyRunUpgrade,
  onUpgrade,
  onPickMilestone,
  paused = false,
  guide = null,
  onMarkCoresSeen,
  coresRequest = null,
  onCoresRequestHandled,
  onOpenFoundry,
  onOpenPrints,
  onBuyMaxCores,
  onChooseDirective,
  onEquipRelic,
  onRemoveRelic,
}: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const dying = (combat.defeatLeft ?? 0) > 0
  const live = !combat.docked
  const protocol = activeProtocol(state)
  const echoRun = combat && state.echo?.activeId ? getEchoRun(state.echo.activeId) : undefined
  const titleId = useId()
  const forceCores = coresGuideActive(state, guide)
  const salvageOpen = live || hasHullLostOnce(state)
  const [coresOpen, setCoresOpen] = useState(false)
  const [upgradeCat, setUpgradeCat] = useState<RunUpgradeCategory>('attack')
  const [upgradesOpen, setUpgradesOpen] = useState(false)
  const sheetOpen = salvageOpen && (coresOpen || forceCores)
  const coresFlags = coresAttention(state)
  const hullPct = stats.hullMax > 0 ? combat.playerHull / stats.hullMax : 1
  const shieldPct = stats.shieldMax > 0 ? combat.playerShield / stats.shieldMax : 0
  const hullBand = hullPct <= 0.28 ? 'critical' : hullPct <= 0.55 ? 'damaged' : 'healthy'
  const [banner, setBanner] = useState<{ text: string; kind: 'wave' | 'boss' | 'sector' } | null>(
    null,
  )
  const bannerRef = useRef({
    wave: combat.wave,
    sector: combat.sector,
    boss: combat.isBoss,
    primed: false,
  })
  const focusCoreId = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (forceCores) setCoresOpen(true)
  }, [forceCores])

  useEffect(() => {
    if (sheetOpen) onMarkCoresSeen?.()
  }, [sheetOpen, onMarkCoresSeen])

  useEffect(() => {
    if (guide && !isCoresGuideTarget(guide)) setCoresOpen(false)
  }, [guide])

  useEffect(() => {
    if (!coresRequest) return
    focusCoreId.current = coresRequest.moduleId
    if (!live || dying) setCoresOpen(true)
    onCoresRequestHandled?.()
  }, [coresRequest, live, dying, onCoresRequestHandled])

  useEffect(() => {
    if (!sheetOpen) return
    const moduleId = focusCoreId.current
    if (!moduleId) return
    const id = moduleId.replace(/[^a-z0-9-]/gi, '')
    const el = document.querySelector(`[data-guide="core-${id}"]`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    focusCoreId.current = undefined
  }, [sheetOpen])

  useEffect(() => {
    if (combat.docked && !dying) {
      bannerRef.current = {
        wave: combat.wave,
        sector: combat.sector,
        boss: combat.isBoss,
        primed: false,
      }
      setBanner(null)
      return
    }
    const prev = bannerRef.current
    if (!prev.primed) {
      bannerRef.current = {
        wave: combat.wave,
        sector: combat.sector,
        boss: combat.isBoss,
        primed: true,
      }
      return
    }
    if (combat.isBoss && !prev.boss) {
      setBanner({ text: 'BOSS WAVE', kind: 'boss' })
    } else if (combat.wave !== prev.wave) {
      setBanner({ text: `WAVE ${combat.wave}`, kind: 'wave' })
    }
    bannerRef.current = {
      wave: combat.wave,
      sector: combat.sector,
      boss: combat.isBoss,
      primed: true,
    }
  }, [combat.wave, combat.sector, combat.isBoss, combat.docked, dying])

  useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 1700)
    return () => window.clearTimeout(t)
  }, [banner])

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !forceCores) setCoresOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen, forceCores])

  const previewPlayer = useMemo(
    () => [
      {
        id: 'preview-flag',
        side: 'player' as const,
        name: 'Hiveworks hull',
        shape: 'triangle' as const,
        family: 'player',
        hull: combat.playerHull,
        hullMax: combat.playerHullMax || stats.hullMax,
        shield: combat.playerShield,
        shieldMax: combat.playerShieldMax || stats.shieldMax,
        armor: stats.armor,
        evasion: stats.evasion,
        damageTakenMult: stats.damageTakenMult,
        weapons: [],
        isBoss: false,
        isFlagship: true,
        dots: [],
        x: 0,
        y: 0,
        speed: 0,
        engageRange: 0,
        kite: false,
        phaseWarnLeft: 0,
      },
    ],
    [
      combat.playerHull,
      combat.playerHullMax,
      combat.playerShield,
      combat.playerShieldMax,
      stats.armor,
      stats.evasion,
      stats.damageTakenMult,
      stats.hullMax,
      stats.shieldMax,
    ],
  )

  const challenge = isChallengeSortie(state)
  const directiveOffer = hasDirectiveOffer(state) ? (combat.directiveOffer ?? []) : []
  const activeDirectives = (combat.directives ?? [])
    .map((id) => getDirective(id))
    .filter((def): def is NonNullable<typeof def> => Boolean(def))

  const battlefieldMode: BattlefieldMode =
    combat.inFight || dying ? 'fighting' : 'ready'

  const playerUnits =
    combat.playerUnits.length > 0 ? combat.playerUnits : previewPlayer
  const enemyUnits = combat.docked && !dying ? [] : combat.enemyUnits

  return (
    <section className={hullBand === 'critical' ? 'sortie-screen is-critical' : 'sortie-screen'}>
      <header className="combat-hud-bar">
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">
            {echoRun ? echoRun.name : protocol ? protocol.name : isBossWave(combat.wave) ? 'BOSS' : 'WAVE'}
          </span>
          <strong className="combat-hud-value">W{combat.wave}</strong>
        </div>
        <div
          className={`combat-hud-readout${hullBand === 'healthy' ? '' : ` is-${hullBand}`}`}
          data-guide="sortie-hull"
        >
          <span className="combat-hud-kicker">Hull</span>
          <strong className="combat-hud-value">
            {formatCompact(Math.ceil(combat.playerHull))}/{formatCompact(Math.ceil(stats.hullMax))}
          </strong>
          <span className="hud-underline hull" aria-hidden>
            <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, hullPct))})` }} />
          </span>
        </div>
        <div className="combat-hud-readout" data-guide="sortie-shield">
          <span className="combat-hud-kicker">Shield</span>
          <strong className="combat-hud-value">
            {formatCompact(Math.ceil(combat.playerShield))}/{formatCompact(Math.ceil(stats.shieldMax))}
          </strong>
          <span className="hud-underline shield" aria-hidden>
            <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, shieldPct))})` }} />
          </span>
        </div>
        <div className="combat-hud-readout" data-guide="salvage-stat">
          <span className="combat-hud-kicker">Salvage</span>
          <strong className="combat-hud-value">{formatCompact(Math.floor(state.resources.salvage))}</strong>
        </div>
      </header>

      <div className="sortie-canvas" data-guide="sortie-canvas">
        {onOpenFoundry ? <CraftStrip state={state} onOpen={onOpenFoundry} /> : null}
        <FragmentChip state={state} onOpen={onOpenPrints} />
        <Battlefield
          playerUnits={playerUnits}
          enemyUnits={enemyUnits}
          projectiles={combat.docked && !dying ? [] : combat.projectiles}
          beams={combat.docked && !dying ? [] : combat.beams ?? []}
          fx={combat.fx}
          mode={battlefieldMode}
          paused={paused || directiveOffer.length > 0}
        />
        {banner ? (
          <p className={`combat-banner is-${banner.kind}`} role="status">
            <span className="combat-banner-kicker">
              {banner.kind === 'boss' ? 'CONTACT' : 'WAVE'}
            </span>
            <strong className="combat-banner-title">{banner.text}</strong>
          </p>
        ) : null}
        {dying ? (
          <p className="sortie-defeat-banner" role="status">
            {challenge ? 'Hull lost' : `SORTIE COMPLETE — Wave ${combat.wave}`}
          </p>
        ) : null}
        {activeDirectives.length > 0 && directiveOffer.length === 0 ? (
          <p className="directive-chip" role="status">
            <span className="combat-hud-kicker">Directives</span>
            {activeDirectives.map((def) => def.name).join(' · ')}
          </p>
        ) : null}
      </div>

      <div className="sortie-actions">
        {dying ? (
          <button type="button" disabled>
            Sortie ending
          </button>
        ) : live ? (
          <button
            type="button"
            data-guide="extract"
            onClick={() => onExtract?.()}
          >
            Extract
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            data-guide="launch"
            onClick={(e) => {
              markLocalOk(e.currentTarget)
              onLaunch()
            }}
          >
            Launch Sortie
          </button>
        )}
        {live ? (
          <button
            type="button"
            className={upgradesOpen ? 'primary' : undefined}
            onClick={() => setUpgradesOpen((open) => !open)}
          >
            Upgrades
          </button>
        ) : null}
        <button
          type="button"
          className={sheetOpen ? 'primary sortie-cores-btn' : 'sortie-cores-btn'}
          data-guide={sheetOpen ? undefined : 'cores-sheet'}
          aria-expanded={sheetOpen}
          aria-label={attentionAria('Cores', coresFlags)}
          onClick={() => setCoresOpen((open) => !open)}
        >
          Cores
          <AttentionPips spend={coresFlags.spend} fresh={coresFlags.fresh} />
        </button>
      </div>

      {upgradesOpen && live ? (
        <div className="sortie-upgrade-dock">
          <div className="sheet-tabs">
            {(['attack', 'defense', 'economy'] as RunUpgradeCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                className={upgradeCat === cat ? 'sheet-tab active' : 'sheet-tab'}
                onClick={() => setUpgradeCat(cat)}
              >
                {cat === 'attack' ? 'Attack' : cat === 'defense' ? 'Defense' : 'Economy'}
              </button>
            ))}
          </div>
          <RunUpgradePanel state={state} category={upgradeCat} onBuy={onBuyRunUpgrade} />
        </div>
      ) : null}

      {sheetOpen ? (
        <div
          className="screen-help-backdrop cores-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!forceCores) setCoresOpen(false)
          }}
        >
          <div
            className="screen-help-card cores-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-guide="cores-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="combat-hud-kicker">Cores</p>
            <h3 id={titleId}>Cores</h3>
            <p className="sortie-sheet-kicker">Salvage ranks these Cores for this Sortie only.</p>
            <CoreSheet
              state={state}
              compact
              onUpgrade={onUpgrade}
              onPickMilestone={onPickMilestone}
              onBuyMax={hasProcess(state, 'core-buy-max') ? onBuyMaxCores : undefined}
              onEquipRelic={onEquipRelic}
              onRemoveRelic={onRemoveRelic}
            />
            <button
              type="button"
              className="primary"
              disabled={forceCores}
              onClick={() => setCoresOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {directiveOffer.length > 0 && !dying ? (
        <div className="screen-help-backdrop directive-backdrop" role="presentation">
          <div
            className="screen-help-card directive-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${titleId}-directive`}
            data-guide="directive-offer"
          >
            <p className="combat-hud-kicker">DIRECTIVE AVAILABLE</p>
            <h3 id={`${titleId}-directive`}>Directives strongly alter this Sortie only.</h3>
            <div className="directive-picks">
              {directiveOffer.map((id) => {
                const def = getDirective(id) ?? DIRECTIVES.find((d) => d.id === id)
                if (!def) return null
                return (
                  <button
                    key={def.id}
                    type="button"
                    className="primary"
                    disabled={!onChooseDirective}
                    onClick={() => onChooseDirective?.(def.id)}
                  >
                    <strong>{def.name}</strong>
                    <span className="muted">{def.blurb}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
