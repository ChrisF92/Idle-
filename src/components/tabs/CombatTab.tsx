import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { GameState, RunUpgradeCategory, RunUpgradeId } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { formatCompact } from '../../game/format'
import { activeGuideStep, isCoresGuideTarget, isSystemUnlocked, type GuideStep } from '../../game/progression'
import { Battlefield, type BattlefieldMode } from '../Battlefield'
import { CoreSheet } from '../CoreSheet'
import { SheetTabs } from '../SheetTabs'
import { FOUNDRY_RECIPES } from '../../game/foundry'
import { markLocalOk } from '../../hooks/useJustBecame'
import {
  effectiveUpgradeLevel,
  runUpgradeCost,
  salvageWaveBonus,
  visibleRunUpgrades,
  workshopLevel,
} from '../../game/workshop'
import { isBossWave } from '../../game/waves'
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
  onEquipRelic?: (moduleId: string, relicId: string, socketIndex?: number) => void
  onRemoveRelic?: (moduleId: string, socketIndex?: number) => void
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

function runUpgradePreview(
  state: GameState,
  id: RunUpgradeId,
): { current: string; next: string } {
  const level = effectiveUpgradeLevel(state, id)
  const fmt = (per: number) => ({
    current: `×${Math.pow(1 + per, level).toFixed(2)}`,
    next: `×${Math.pow(1 + per, level + 1).toFixed(2)}`,
  })
  switch (id) {
    case 'weapon-power':
      return fmt(0.08)
    case 'cycle-rate':
      return fmt(0.03)
    case 'hull':
      return fmt(0.08)
    case 'shield':
      return fmt(0.1)
    case 'salvage-kill':
      return fmt(0.08)
    case 'salvage-wave': {
      const next = Math.floor(4 * (level + 1) * Math.pow(1.06, level + 1))
      return { current: `+${formatCompact(salvageWaveBonus(state))}`, next: `+${formatCompact(next)}` }
    }
  }
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
        const preview = runUpgradePreview(state, def.id)
        return (
          <article key={def.id} className={affordable ? 'upgrade-card is-affordable' : 'upgrade-card'}>
            <header className="upgrade-card-head">
              <strong>{def.name}</strong>
              <span className="muted">
                Lv {level}
                {start > 0 ? ` · ${start} Workshop` : ''}
              </span>
            </header>
            <p className="muted">{def.blurb}</p>
            <dl className="upgrade-card-stats">
              <div>
                <dt>Current</dt>
                <dd>{preview.current}</dd>
              </div>
              <div>
                <dt>Next</dt>
                <dd>{preview.next}</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd>{formatCompact(cost)} Salvage</dd>
              </div>
            </dl>
            <button
              type="button"
              className="primary"
              disabled={!onBuy || !affordable}
              onClick={() => onBuy?.(def.id)}
            >
              Buy
            </button>
          </article>
        )
      })}
    </div>
  )
}

type SortiePane = 'upgrades' | 'cores' | 'directives'

const SORTIE_PANES: { id: SortiePane; label: string; guide?: string }[] = [
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'cores', label: 'Cores', guide: 'cores-sheet' },
  { id: 'directives', label: 'Directives' },
]

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
  onChooseDirective,
}: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const dying = (combat.defeatLeft ?? 0) > 0
  const live = !combat.docked
  const protocol = activeProtocol(state)
  const titleId = useId()
  const forceCores = coresGuideActive(state, guide)
  const [upgradeCat, setUpgradeCat] = useState<RunUpgradeCategory>('attack')
  const [pane, setPane] = useState<SortiePane>(live ? 'upgrades' : 'cores')
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
    if (live) setPane('upgrades')
  }, [live])

  useEffect(() => {
    if (forceCores) setPane('cores')
  }, [forceCores])

  useEffect(() => {
    if (pane === 'cores') onMarkCoresSeen?.()
  }, [pane, onMarkCoresSeen])

  useEffect(() => {
    if (!coresRequest) return
    focusCoreId.current = coresRequest.moduleId
    if (!live || dying) setPane('cores')
    onCoresRequestHandled?.()
  }, [coresRequest, live, dying, onCoresRequestHandled])

  useEffect(() => {
    if (pane !== 'cores') return
    const moduleId = focusCoreId.current
    if (!moduleId) return
    const id = moduleId.replace(/[^a-z0-9-]/gi, '')
    const el = document.querySelector(`[data-guide="core-${id}"]`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    focusCoreId.current = undefined
  }, [pane])

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
  useEffect(() => {
    if (directiveOffer.length > 0) setPane('directives')
  }, [directiveOffer.length])
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
            {protocol ? protocol.name : isBossWave(combat.wave) ? 'BOSS' : 'WAVE'}
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
        <div className="combat-hud-readout" data-guide="scrap-stat">
          <span className="combat-hud-kicker">Scrap</span>
          <strong className="combat-hud-value">{formatCompact(Math.floor(state.resources.scrap))}</strong>
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
      </div>

      <div className="sortie-sheet">
        <SheetTabs
          value={pane}
          onChange={setPane}
          options={SORTIE_PANES}
          label="Sortie panes"
        />
        {pane === 'upgrades' ? (
          live ? (
            <>
              <SheetTabs
                value={upgradeCat}
                onChange={setUpgradeCat}
                options={[
                  { id: 'attack', label: 'Attack' },
                  { id: 'defense', label: 'Defense' },
                  { id: 'economy', label: 'Economy' },
                ]}
                label="Upgrade categories"
              />
              <RunUpgradePanel state={state} category={upgradeCat} onBuy={onBuyRunUpgrade} />
            </>
          ) : (
            <p className="muted">Launch to spend Salvage on Attack, Defense, and Economy.</p>
          )
        ) : null}
        {pane === 'cores' ? (
          <div data-guide="cores-sheet">
            <p className="sortie-sheet-kicker">
              Inspect only. Rank and equip Cores at Dock with Scrap.
            </p>
            <CoreSheet
              state={state}
              compact
              inspectOnly
              onUpgrade={onUpgrade}
              onPickMilestone={onPickMilestone}
            />
          </div>
        ) : null}
        {pane === 'directives' ? (
          <div>
            {activeDirectives.length > 0 ? (
              <p className="muted">
                Active: {activeDirectives.map((def) => def.name).join(' · ')}
              </p>
            ) : (
              <p className="muted">Directives pause the Sortie at Waves 50, 100, 150, 200, and 250.</p>
            )}
          </div>
        ) : null}
      </div>

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
