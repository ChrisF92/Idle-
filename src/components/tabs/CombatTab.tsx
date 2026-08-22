import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { GameState, RunUpgradeCategory, RunUpgradeId } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { formatCompact } from '../../game/format'
import { activeGuideStep, isCoresGuideTarget, isSystemUnlocked, type GuideStep } from '../../game/progression'
import { Battlefield, type BattlefieldMode } from '../Battlefield'
import { SheetTabs } from '../SheetTabs'
import { FOUNDRY_RECIPES } from '../../game/foundry'
import { markLocalOk } from '../../hooks/useJustBecame'
import { type BuyMode } from '../../game/workshop'
import {
  formatRunTime,
  liveBossHp,
  normalizeDamageNumbers,
  runScrapEarned,
  sortieSpeed,
  coreDps,
  coreContributionPct,
  coreShieldOutput,
} from '../../game/uiReadout'
import { getModule, moduleMasteryRank } from '../../game/catalog'
import { coreRunLevel, nextMasteryMilestone } from '../../game/coreProgression'
import { activeProtocol } from '../../game/protocols'
import { isChallengeSortie } from '../../game/frontier'
import { DIRECTIVES, getDirective, hasDirectiveOffer } from '../../game/directives'
import { BuyModeRow, UpgradeGrid } from '../UpgradeGrid'
import { inspectCore } from '../../game/inspect'
import { InspectName } from '../InspectName'

interface CombatTabProps {
  state: GameState
  onLaunch: () => void
  onExtract?: () => void
  onBuyRunUpgrade?: (id: RunUpgradeId, count?: number) => void
  onBuyCoreRun?: (slot: number, count?: number) => void
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
  onCycleSpeed?: () => void
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
        <span className="muted">
          {' '}
          · {chip.totalHave}/{chip.totalNeed}
        </span>
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
    <button type="button" className="fragment-chip" onClick={onOpen} aria-label={`${chip.name} fragment. Open prints.`}>
      {body}
    </button>
  )
}

export function CombatTab({
  state,
  onLaunch,
  onExtract,
  onBuyRunUpgrade,
  onBuyCoreRun,
  paused = false,
  guide = null,
  onMarkCoresSeen,
  onOpenFoundry,
  onOpenPrints,
  onChooseDirective,
  onCycleSpeed,
}: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const dying = (combat.defeatLeft ?? 0) > 0
  const live = !combat.docked
  const protocol = activeProtocol(state)
  const titleId = useId()
  const forceCores = coresGuideActive(state, guide)
  const [upgradeCat, setUpgradeCat] = useState<RunUpgradeCategory>('attack')
  const [buyMode, setBuyMode] = useState<BuyMode>(1)
  const [shopCollapsed, setShopCollapsed] = useState(false)
  const [coresOpen, setCoresOpen] = useState(false)
  const [directivesOpen, setDirectivesOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailCore, setDetailCore] = useState<string | null>(null)
  const hullPct = stats.hullMax > 0 ? combat.playerHull / stats.hullMax : 1
  const shieldPct = stats.shieldMax > 0 ? combat.playerShield / stats.shieldMax : 0
  const hullBand = hullPct <= 0.28 ? 'critical' : hullPct <= 0.55 ? 'damaged' : 'healthy'
  const [banner, setBanner] = useState<{ text: string; kind: 'wave' | 'boss' | 'sector' | 'best' } | null>(null)
  const bannerRef = useRef({
    wave: combat.wave,
    sector: combat.sector,
    boss: combat.isBoss,
    primed: false,
  })
  const focusCoreId = useRef<string | undefined>(undefined)
  const showExtractRow = live && !state.meta.extractedOnce
  const careerBest = Math.max(state.meta.bestWave ?? 0, combat.bestWave ?? 0)
  const isNewBest = live && combat.wave > careerBest

  useEffect(() => {
    if (forceCores) setCoresOpen(true)
  }, [forceCores])

  useEffect(() => {
    if (guide?.target === 'run-upgrade-weapon-power') setShopCollapsed(false)
  }, [guide?.target])

  useEffect(() => {
    if (coresOpen) onMarkCoresSeen?.()
  }, [coresOpen, onMarkCoresSeen])

  useEffect(() => {
    if (!coresOpen) return
    const moduleId = focusCoreId.current
    if (!moduleId) return
    const id = moduleId.replace(/[^a-z0-9-]/gi, '')
    const el = document.querySelector(`[data-guide="core-${id}"]`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    focusCoreId.current = undefined
  }, [coresOpen])

  useEffect(() => {
    if (combat.docked && !dying) {
      bannerRef.current = { wave: combat.wave, sector: combat.sector, boss: combat.isBoss, primed: false }
      setBanner(null)
      return
    }
    const prev = bannerRef.current
    if (!prev.primed) {
      bannerRef.current = { wave: combat.wave, sector: combat.sector, boss: combat.isBoss, primed: true }
      return
    }
    if (combat.isBoss && !prev.boss) {
      setBanner({ text: 'BOSS WAVE', kind: 'boss' })
    } else if (combat.wave !== prev.wave) {
      setBanner({
        text: combat.wave > careerBest ? 'NEW BEST' : `WAVE ${combat.wave}`,
        kind: combat.wave > careerBest ? 'best' : 'wave',
      })
    }
    bannerRef.current = { wave: combat.wave, sector: combat.sector, boss: combat.isBoss, primed: true }
  }, [combat.wave, combat.sector, combat.isBoss, combat.docked, dying, careerBest])

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
        name: 'Hive',
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

  const battlefieldMode: BattlefieldMode = combat.inFight || dying ? 'fighting' : 'ready'
  const playerUnits = combat.playerUnits.length > 0 ? combat.playerUnits : previewPlayer
  const enemyUnits = combat.docked && !dying ? [] : combat.enemyUnits
  const speed = sortieSpeed(state)
  const bossHp = liveBossHp(state)
  const scrapRun = runScrapEarned(state)
  const coreCap = state.shipyard.modules.length

  return (
    <section
      className={[
        'sortie-screen',
        hullBand === 'critical' ? 'is-critical' : '',
        shopCollapsed ? 'is-shop-collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="sortie-hud">
        <div className="sortie-hud-wave">
          {protocol ? <span className="combat-hud-kicker">{protocol.name}</span> : null}
          {!state.meta.hullLostOnce ? <span className="combat-hud-kicker">WAVE</span> : null}
          <strong className={`sortie-wave${isNewBest ? ' is-new-best' : ''}`}>W{combat.wave}</strong>
          <span className="sortie-best">{isNewBest ? 'NEW BEST' : `BEST ${careerBest || '—'}`}</span>
        </div>
        <div className="sortie-hud-res">
          <div data-guide="salvage-stat">
            <strong>{formatCompact(Math.floor(state.resources.salvage))}</strong>
            <span className="muted">Salvage</span>
          </div>
          <div data-guide="scrap-stat">
            <strong>+{formatCompact(Math.floor(scrapRun))}</strong>
            <span className="muted">Scrap</span>
          </div>
        </div>
        <button
          type="button"
          className="sortie-speed"
          data-guide="sortie-speed"
          onClick={() => onCycleSpeed?.()}
        >
          ×{speed.toFixed(speed % 1 === 0 ? 0 : 1)}
        </button>
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
          numbers={normalizeDamageNumbers(state.meta.damageNumbers)}
          frameId={state.shipyard.frameId}
          coreIds={state.shipyard.modules}
        />
        {banner ? (
          <p className={`combat-banner is-${banner.kind}`} role="status">
            <span className="combat-banner-kicker">
              {banner.kind === 'boss' ? 'CONTACT' : banner.kind === 'best' ? 'RECORD' : 'WAVE'}
            </span>
            <strong className="combat-banner-title">{banner.text}</strong>
          </p>
        ) : null}
        {dying ? (
          <p className="sortie-defeat-banner" role="status">
            {challenge ? 'Hull lost' : `SORTIE COMPLETE — Wave ${combat.wave}`}
          </p>
        ) : null}
      </div>

      <div className="sortie-status">
        <div className="sortie-meter" data-guide="sortie-shield">
          <span>SHIELD</span>
          <span className="hud-underline shield" aria-hidden>
            <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, shieldPct))})` }} />
          </span>
          <strong>{Math.round(shieldPct * 100)}%</strong>
        </div>
        <div className={`sortie-meter${hullBand === 'healthy' ? '' : ` is-${hullBand}`}`} data-guide="sortie-hull">
          <span>HULL</span>
          <span className="hud-underline hull" aria-hidden>
            <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, hullPct))})` }} />
          </span>
          <strong>{Math.round(hullPct * 100)}%</strong>
        </div>
        <div className="sortie-status-meta">
          <span>DPS {formatCompact(stats.damage)}</span>
          <span>{formatRunTime(combat.fightElapsed ?? 0)}</span>
        </div>
        {bossHp ? (
          <div className="sortie-meter">
            <span>BOSS</span>
            <span className="hud-underline hull" aria-hidden>
              <span
                style={{
                  transform: `scaleX(${Math.max(0, Math.min(1, bossHp.hull / Math.max(1, bossHp.hullMax)))})`,
                }}
              />
            </span>
            <strong>
              {formatCompact(Math.ceil(bossHp.hull))}/{formatCompact(Math.ceil(bossHp.hullMax))}
            </strong>
          </div>
        ) : null}
      </div>

      {showExtractRow ? (
        <div className="sortie-actions">
          {dying ? (
            <button type="button" disabled>
              Sortie ending
            </button>
          ) : (
            <button type="button" data-guide="extract" onClick={() => onExtract?.()}>
              Extract
            </button>
          )}
        </div>
      ) : null}

      <div className={`sortie-shop${shopCollapsed ? ' is-collapsed' : ''}`}>
        {live ? (
          <>
            <div className="sortie-shop-head">
              <button
                type="button"
                className="sortie-shop-toggle"
                aria-expanded={!shopCollapsed}
                aria-label={shopCollapsed ? 'Show upgrades' : 'Hide upgrades'}
                onClick={() => setShopCollapsed((open) => !open)}
              >
                {shopCollapsed ? 'Upgrades' : 'Hide'}
              </button>
              {shopCollapsed ? null : (
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
              )}
              <button type="button" className="sortie-menu-btn" aria-label="Sortie menu" onClick={() => setMenuOpen(true)}>
                ⋮
              </button>
            </div>
            {shopCollapsed ? null : (
              <>
                <BuyModeRow state={state} value={buyMode} onChange={setBuyMode} />
                <UpgradeGrid
                  state={state}
                  category={upgradeCat}
                  kind="run"
                  buyMode={buyMode}
                  onBuy={(id, count) => onBuyRunUpgrade?.(id, count)}
                  onBuyCore={(slot, count) => onBuyCoreRun?.(slot, count)}
                />
              </>
            )}
            <div className="sortie-shop-tools">
              <button type="button" className="sortie-tool" onClick={() => setCoresOpen(true)} data-guide="cores-sheet">
                CORES · {coreCap}/{coreCap}
              </button>
              <button
                type="button"
                className="sortie-tool"
                onClick={() => setDirectivesOpen(true)}
                disabled={activeDirectives.length === 0 && directiveOffer.length === 0}
              >
                DIRECTIVES · {activeDirectives.length}
              </button>
            </div>
          </>
        ) : dying ? (
          <p className="muted">Sortie ending…</p>
        ) : (
          <div className="sortie-docked">
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
            <button type="button" className="sortie-tool" onClick={() => setCoresOpen(true)} data-guide="cores-sheet">
              CORES · {coreCap}/{coreCap}
            </button>
          </div>
        )}
      </div>

      {coresOpen ? (
        <div className="sheet-overlay is-partial" role="dialog" aria-labelledby={`${titleId}-cores`}>
          <div className="sheet-card">
            <header className="modal-header">
              <h3 id={`${titleId}-cores`}>Cores</h3>
              <button type="button" onClick={() => setCoresOpen(false)}>
                Close
              </button>
            </header>
            <p className="muted">
              Loadout is locked mid-Sortie. Power Cores with Salvage in Attack, Defense, and Economy —
              Run Levels reset when the Sortie ends.
            </p>
            <div className="sheet-scroll" data-guide="cores-sheet">
              {state.shipyard.modules.map((id, slot) => {
                const def = getModule(id)
                if (!def) return null
                const dps = coreDps(state, id)
                const share = coreContributionPct(state, id)
                const shield = coreShieldOutput(state, id)
                return (
                  <div
                    key={`${id}-${slot}`}
                    className="core-summary"
                    data-guide={`core-${id}`}
                  >
                    <InspectName name={def.name} card={inspectCore(state, id)} />
                    <button type="button" onClick={() => setDetailCore(id)}>
                      <span className="muted">
                        Run Lv{coreRunLevel(state, slot)}
                        {moduleMasteryRank(state, id) > 0 ? ` · Mastery ${moduleMasteryRank(state, id)}` : ''}
                      </span>
                      <span>
                        {dps > 0
                          ? `${formatCompact(dps)} DPS${share != null ? ` · ${share}% of output` : ''}`
                          : shield > 0
                            ? `+${formatCompact(shield)} Shield`
                            : def.description}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {detailCore ? (
        <div className="sheet-overlay" role="dialog" aria-labelledby={`${titleId}-core-detail`}>
          <div className="sheet-card">
            <header className="modal-header">
              <h3 id={`${titleId}-core-detail`}>{getModule(detailCore)?.name ?? 'Core'}</h3>
              <button type="button" onClick={() => setDetailCore(null)}>
                Close
              </button>
            </header>
            <p className="muted">{getModule(detailCore)?.description}</p>
            {(() => {
              const slot = state.shipyard.modules.indexOf(detailCore)
              const mastery = moduleMasteryRank(state, detailCore)
              const next = nextMasteryMilestone(detailCore, mastery)
              return (
                <>
                  <p>
                    Mastery {mastery}
                    {slot >= 0 ? ` · Run Lv${coreRunLevel(state, slot)}` : ''}
                  </p>
                  <p className="muted">
                    Run Levels spend Salvage and last only for this Sortie. Mastery is earned while
                    the Core is equipped and survives Rebuild.
                  </p>
                  {next ? (
                    <p className="muted">
                      Next: M{next.level} · {next.name}
                    </p>
                  ) : null}
                </>
              )
            })()}
            <p className="muted">Loadout and Relic changes stay locked while the Sortie is live.</p>
          </div>
        </div>
      ) : null}

      {directivesOpen && directiveOffer.length === 0 ? (
        <div className="sheet-overlay is-partial" role="dialog" aria-labelledby={`${titleId}-dirs`}>
          <div className="sheet-card">
            <header className="modal-header">
              <h3 id={`${titleId}-dirs`}>Directives</h3>
              <button type="button" onClick={() => setDirectivesOpen(false)}>
                Close
              </button>
            </header>
            {activeDirectives.length > 0 ? (
              activeDirectives.map((def) => (
                <article key={def.id} className="upgrade-card">
                  <strong>{def.name}</strong>
                  <p className="muted">{def.blurb}</p>
                </article>
              ))
            ) : (
              <p className="muted">Directives pause the Sortie at Waves 50, 100, 150, 200, and 250.</p>
            )}
          </div>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="sheet-overlay is-partial" role="dialog" aria-labelledby={`${titleId}-menu`}>
          <div className="sheet-card">
            <header className="modal-header">
              <h3 id={`${titleId}-menu`}>Sortie</h3>
              <button type="button" onClick={() => setMenuOpen(false)}>
                Close
              </button>
            </header>
            <button type="button" disabled>
              Pause
            </button>
            {live && !dying ? (
              <button
                type="button"
                data-guide="extract"
                onClick={() => {
                  setMenuOpen(false)
                  onExtract?.()
                }}
              >
                Extract
              </button>
            ) : null}
            <p className="muted">
              DPS {formatCompact(stats.damage)} · {formatRunTime(combat.fightElapsed ?? 0)} · Wave {combat.wave}
            </p>
          </div>
        </div>
      ) : null}

      {directiveOffer.length > 0 && !dying ? (
        <div className="directive-choice" role="dialog" aria-modal="true" aria-labelledby={`${titleId}-directive`}>
          <div className="directive-choice-card" data-guide="directive-offer">
            <p className="combat-hud-kicker">DIRECTIVE AVAILABLE</p>
            <h3 id={`${titleId}-directive`}>Choose one. Each card is the whole decision.</h3>
            <div className="directive-picks">
              {directiveOffer.map((id) => {
                const def = getDirective(id) ?? DIRECTIVES.find((d) => d.id === id)
                if (!def) return null
                return (
                  <button
                    key={def.id}
                    type="button"
                    className="directive-pick"
                    disabled={!onChooseDirective}
                    onClick={() => onChooseDirective?.(def.id)}
                  >
                    <strong>{def.name}</strong>
                    <span>{def.blurb}</span>
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
