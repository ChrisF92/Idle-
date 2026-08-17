import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CombatPushMode, GameState } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { COMBAT_PUSH_MODES, normalizePushMode, normalizeRoute, pushModeLabel } from '../../game/sectors'
import { wavesForRun, getEchoRun } from '../../game/echo'
import { activeProtocol } from '../../game/protocols'
import { formatCompact } from '../../game/format'
import { activeGuideStep, hasHullLostOnce, isCoresGuideTarget, type GuideStep } from '../../game/progression'
import { attentionAria, coresAttention } from '../../game/hubAttention'
import { AttentionPips } from '../AttentionPips'
import { Battlefield, type BattlefieldMode } from '../Battlefield'
import { CoreSheet } from '../CoreSheet'
import { markLocalOk } from '../../hooks/useJustBecame'

interface CombatTabProps {
  state: GameState
  onLaunch: () => void
  onSetPushMode: (mode: CombatPushMode) => void
  onUpgrade: (moduleId: string) => void
  onPickMilestone: (moduleId: string, milestoneId: string, choiceId: string) => void
  paused?: boolean
  guide?: GuideStep | null
  onMarkCoresSeen?: () => void
  coresRequest?: { key: number; moduleId?: string } | null
}

function coresGuideActive(state: GameState, guide?: GuideStep | null): boolean {
  const step = guide ?? activeGuideStep(state, 'combat')
  if (!step) return false
  return isCoresGuideTarget(step)
}

export function CombatTab({
  state,
  onLaunch,
  onSetPushMode,
  onUpgrade,
  onPickMilestone,
  paused = false,
  guide = null,
  onMarkCoresSeen,
  coresRequest = null,
}: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const waves = wavesForRun(state)
  const dying = (combat.defeatLeft ?? 0) > 0
  const live = !combat.docked
  const protocol = activeProtocol(state)
  const echoRun = combat && state.echo?.activeId ? getEchoRun(state.echo.activeId) : undefined
  const pushMode = normalizePushMode(combat.pushMode, combat.campaign)
  const titleId = useId()
  const forceCores = coresGuideActive(state, guide)
  const salvageOpen = hasHullLostOnce(state)
  const [coresOpen, setCoresOpen] = useState(false)
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
    setCoresOpen(true)
  }, [coresRequest])

  useEffect(() => {
    if (!sheetOpen || !coresRequest?.moduleId) return
    const el = document.querySelector(`[data-guide="core-${CSS.escape(coresRequest.moduleId)}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [sheetOpen, coresRequest])

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
    if (combat.sector > prev.sector) {
      setBanner({ text: `SECTOR ${prev.sector} CLEARED`, kind: 'sector' })
    } else if (combat.isBoss && !prev.boss) {
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
            {echoRun
              ? echoRun.name
              : protocol
                ? `P${protocol.goalSector}`
                : `S${combat.sector}${normalizeRoute(combat.route) === 'B' ? 'B' : ''}`}
          </span>
          <strong className="combat-hud-value">
            W{combat.wave}/{waves}
          </strong>
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
        {salvageOpen ? (
          <div className="combat-hud-readout" data-guide="salvage-stat">
            <span className="combat-hud-kicker">Salvage</span>
            <strong className="combat-hud-value">{formatCompact(Math.floor(state.resources.salvage))}</strong>
          </div>
        ) : null}
      </header>

      <div className="sortie-canvas" data-guide="sortie-canvas">
        <Battlefield
          playerUnits={playerUnits}
          enemyUnits={enemyUnits}
          projectiles={combat.docked && !dying ? [] : combat.projectiles}
          beams={combat.docked && !dying ? [] : combat.beams ?? []}
          fx={combat.fx}
          mode={battlefieldMode}
          paused={paused}
        />
        {banner ? (
          <p className={`combat-banner is-${banner.kind}`} role="status">
            <span className="combat-banner-kicker">
              {banner.kind === 'boss' ? 'CONTACT' : banner.kind === 'sector' ? 'CLEAR' : 'WAVE'}
            </span>
            <strong className="combat-banner-title">{banner.text}</strong>
          </p>
        ) : null}
        {dying ? (
          <p className="sortie-defeat-banner" role="status">
            Hull lost
          </p>
        ) : null}
      </div>

      <div className="sortie-actions">
        {dying ? (
          <button type="button" disabled>
            Hull lost
          </button>
        ) : live ? (
          <div className="sheet-tabs sortie-push-tabs" data-guide="sortie-push">
            {COMBAT_PUSH_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={pushMode === mode ? 'sheet-tab active' : 'sheet-tab'}
                onClick={() => onSetPushMode(mode)}
              >
                {pushModeLabel(mode)}
              </button>
            ))}
          </div>
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
            Launch
          </button>
        )}
        {salvageOpen ? (
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
        ) : null}
      </div>

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
            <p className="sortie-sheet-kicker">
              Tap a name for the full sheet. Salvage ranks these. Drones live on Network.
            </p>
            <CoreSheet
              state={state}
              compact
              onUpgrade={onUpgrade}
              onPickMilestone={onPickMilestone}
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
    </section>
  )
}
