import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { GameState, RunUpgradeCategory, RunUpgradeId } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { formatCompact } from '../../game/format'
import { type GuideStep } from '../../game/progression'
import { Battlefield, type BattlefieldMode } from '../Battlefield'
import { SheetTabs } from '../SheetTabs'
import { type BuyMode } from '../../game/workshop'
import {
  availableSortieSpeeds,
  formatRunTime,
  liveBossHp,
  normalizeDamageNumbers,
  runResourceRates,
  runScrapEarned,
  sortieSpeed,
} from '../../game/uiReadout'
import { DIRECTIVES, directivesUnlocked, getDirective, hasDirectiveOffer } from '../../game/directives'
import { BuyModeRow, UpgradeGrid } from '../UpgradeGrid'
import { isChallengeSortie } from '../../game/frontier'

type ShopTab = RunUpgradeCategory

interface CombatTabProps {
  state: GameState
  onLaunch: () => void
  onExtract?: () => void
  onBuyRunUpgrade?: (id: RunUpgradeId, count?: number) => void
  onViewReport?: () => void
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

export function CombatTab({
  state,
  onExtract,
  onBuyRunUpgrade,
  paused = false,
  guide = null,
  onChooseDirective,
  onCycleSpeed,
}: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const dying = (combat.defeatLeft ?? 0) > 0
  const live = !combat.docked
  const titleId = useId()
  const [shopTab, setShopTab] = useState<ShopTab>('attack')
  const [buyMode, setBuyMode] = useState<BuyMode>(1)
  const [shopCollapsed, setShopCollapsed] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [directivesOpen, setDirectivesOpen] = useState(false)
  const [rateView, setRateView] = useState<'salvage' | 'scrap' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
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
  const careerBest = Math.max(state.meta.bestWave ?? 0, combat.bestWave ?? 0)
  const extraSpeeds = availableSortieSpeeds(state).length > 1

  useEffect(() => {
    if (guide?.target === 'run-upgrade-weapon-power') {
      setShopCollapsed(false)
      setShopTab('attack')
    }
    if (guide?.target === 'run-upgrade-hull') {
      setShopCollapsed(false)
      setShopTab('defense')
    }
  }, [guide?.target])

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

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

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

  if (!live && !dying) return null

  const challenge = isChallengeSortie(state)
  const directiveOffer = hasDirectiveOffer(state) ? (combat.directiveOffer ?? []) : []
  const activeDirectives = (combat.directives ?? [])
    .map((id) => getDirective(id))
    .filter((def): def is NonNullable<typeof def> => Boolean(def))
  const showDirectives = directivesUnlocked(state)

  const battlefieldMode: BattlefieldMode = combat.inFight || dying ? 'fighting' : 'ready'
  const playerUnits = combat.playerUnits.length > 0 ? combat.playerUnits : previewPlayer
  const enemyUnits = combat.docked && !dying ? [] : combat.enemyUnits
  const speed = sortieSpeed(state)
  const boss = liveBossHp(state)
  const scrapRun = runScrapEarned(state)
  const rates = runResourceRates(state)
  const salvageBank = Math.floor(state.resources.salvage)

  function toggleRate(kind: 'salvage' | 'scrap') {
    setRateView((cur) => (cur === kind ? null : kind))
  }

  return (
    <section
      className={[
        'sortie-screen',
        hullBand === 'critical' && live ? 'is-critical' : '',
        shopCollapsed ? 'is-shop-collapsed' : 'is-shop-open',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="sortie-canvas" data-guide="sortie-canvas">
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
        <div className="sortie-canvas-chrome is-top">
          {boss ? (
            <div className="sortie-boss-anchor" aria-label="Boss">
              {boss.shieldMax > 0 ? (
                <div className="sortie-meter">
                  <span>BOSS SHIELD</span>
                  <span className="hud-underline shield" aria-hidden>
                    <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, boss.shield / boss.shieldMax))})` }} />
                  </span>
                  <strong>
                    {formatCompact(Math.ceil(boss.shield))}/{formatCompact(Math.ceil(boss.shieldMax))}
                  </strong>
                </div>
              ) : null}
              <div className="sortie-meter">
                <span>BOSS HULL</span>
                <span className="hud-underline hull" aria-hidden>
                  <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, boss.hull / Math.max(1, boss.hullMax)))})` }} />
                </span>
                <strong>
                  {formatCompact(Math.ceil(boss.hull))}/{formatCompact(Math.ceil(boss.hullMax))}
                </strong>
              </div>
            </div>
          ) : null}
          <header className="sortie-hud">
            <div className="sortie-hud-econ">
              <button
                type="button"
                className="sortie-econ"
                data-guide="salvage-stat"
                onClick={() => toggleRate('salvage')}
              >
                <strong>
                  {rateView === 'salvage' ? `${formatCompact(rates.salvagePerSec)}/s` : formatCompact(salvageBank)}
                </strong>
                <span className="muted">{rateView === 'salvage' ? 'Salvage /s' : 'Salvage'}</span>
              </button>
              <button type="button" className="sortie-econ" data-guide="scrap-stat" onClick={() => toggleRate('scrap')}>
                <strong>
                  {rateView === 'scrap' ? `${formatCompact(rates.scrapPerSec)}/s` : `+${formatCompact(Math.floor(scrapRun))}`}
                </strong>
                <span className="muted">{rateView === 'scrap' ? 'Scrap /s' : 'Scrap'}</span>
              </button>
            </div>
            <div className="sortie-hud-mid">
              <strong className="sortie-wave">W{combat.wave}</strong>
              <span>DPS {formatCompact(stats.damage)}</span>
              <span>{formatRunTime(combat.fightElapsed ?? 0)}</span>
            </div>
            <div className="sortie-menu" ref={menuRef}>
              <button
                type="button"
                className={`sortie-menu-btn${menuOpen ? ' is-open' : ''}`}
                aria-label="Sortie menu"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls={`${titleId}-menu`}
                onClick={() => setMenuOpen((open) => !open)}
              >
                ☰
              </button>
              {menuOpen ? (
                <div className="sortie-menu-pop" id={`${titleId}-menu`} role="menu" aria-label="Sortie">
                  {live && !dying ? (
                    <button
                      type="button"
                      role="menuitem"
                      data-guide="extract"
                      onClick={() => {
                        setMenuOpen(false)
                        onExtract?.()
                      }}
                    >
                      Extract
                    </button>
                  ) : (
                    <p className="muted">No actions</p>
                  )}
                </div>
              ) : null}
            </div>
          </header>
        </div>
        <div className="sortie-canvas-chrome is-bottom">
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
            {extraSpeeds ? (
              <button
                type="button"
                className="sortie-speed"
                data-guide="sortie-speed"
                onClick={() => onCycleSpeed?.()}
              >
                ×{speed.toFixed(speed % 1 === 0 ? 0 : 1)}
              </button>
            ) : null}
          </div>
        </div>
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

      <div className={`sortie-shop${shopCollapsed ? ' is-collapsed' : ''}`}>
        {dying ? (
          <p className="muted">Sortie ending…</p>
        ) : (
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
                  value={shopTab}
                  onChange={setShopTab}
                  options={[
                    { id: 'attack', label: 'Attack' },
                    { id: 'defense', label: 'Defense' },
                    { id: 'economy', label: 'Economy' },
                  ]}
                  label="Upgrade categories"
                />
              )}
            </div>
            {shopCollapsed ? null : (
              <div className="sortie-shop-body">
                <BuyModeRow state={state} value={buyMode} onChange={setBuyMode} />
                <UpgradeGrid
                  state={state}
                  category={shopTab}
                  kind="run"
                  buyMode={buyMode}
                  onBuy={(id, count) => onBuyRunUpgrade?.(id, count)}
                />
              </div>
            )}
            {showDirectives && activeDirectives.length > 0 ? (
              <button
                type="button"
                className="sortie-directive-chip"
                onClick={() => setDirectivesOpen(true)}
              >
                {activeDirectives[0]?.name}
                {activeDirectives.length > 1 ? ` · +${activeDirectives.length - 1}` : ''}
              </button>
            ) : null}
          </>
        )}
      </div>

      {directivesOpen && directiveOffer.length === 0 && showDirectives ? (
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
