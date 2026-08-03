import { useEffect, useId, useMemo, useState } from 'react'
import type { ExpeditionRunSummary, GameState } from '../../game/types'
import { computeShipStats } from '../../game/state'
import { getChallenge, getFrame } from '../../game/catalog'
import { formatCompact } from '../../game/format'
import {
  canExtractOrPrestige,
  formatPrestigeMatter,
  PRESTIGE_UNLOCK_WAVE,
} from '../../game/prestigeMatter'
import { computeFightDamage } from '../../game/combat'
import {
  encounterForWave,
  escortOrbitPosition,
  familyIntel,
  softCounterForFamily,
} from '../../game/waves'
import { Battlefield, type BattlefieldMode } from '../Battlefield'

interface CombatTabProps {
  state: GameState
  onSetDocked: (docked: boolean) => void
  onExtract: () => void
}

type Overlay = 'none' | 'wave' | 'launch-confirm' | 'extract-confirm'

export function CombatTab({ state, onSetDocked, onExtract }: CombatTabProps) {
  const { combat } = state
  const stats = computeShipStats(state)
  const frame = getFrame(state.shipyard.frameId)
  const challenge = state.prestige.activeChallengeId
    ? getChallenge(state.prestige.activeChallengeId)
    : null
  const encounter = useMemo(
    () => encounterForWave('sector-1', combat.wave),
    [combat.wave],
  )
  const fightSummary = useMemo(() => computeFightDamage(state), [state])
  const [overlay, setOverlay] = useState<Overlay>('none')
  const [runSummary, setRunSummary] = useState<ExpeditionRunSummary | null>(null)

  useEffect(() => {
    if (combat.lastRunSummary) {
      setRunSummary(combat.lastRunSummary)
    }
  }, [combat.lastRunSummary])

  const careerBest = Math.max(state.meta.highestWaveEver ?? 0, combat.bestWaveThisRun)
  const extractUnlocked = canExtractOrPrestige(careerBest)
  const extractHasProgress =
    combat.bestWaveThisRun > 0 || combat.wave > 1 || combat.inFight
  const showExtract = extractUnlocked && extractHasProgress

  const dockButtonLabel = !combat.docked
    ? 'Pause'
    : state.shipyard.frameLocked
      ? 'Resume'
      : 'Launch'

  const battlefieldMode: BattlefieldMode =
    combat.docked && combat.inFight
      ? 'holding' // paused mid-fight — keep units, no hangar wash
      : combat.docked
        ? 'docked'
        : combat.inFight
          ? 'fighting'
          : 'ready'

  const previewPlayer = useMemo(
    () => [
      {
        id: 'preview-flag',
        side: 'player' as const,
        name: frame?.name ?? 'Flagship',
        shape: 'triangle' as const,
        family: 'player',
        hull: combat.playerHull,
        hullMax: combat.playerHullMax,
        shield: combat.playerShield,
        shieldMax: combat.playerShieldMax,
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
      ...Array.from({ length: stats.escortCount }, (_, i) => {
        const slot = escortOrbitPosition(i)
        return {
          id: `preview-escort-${i}`,
          side: 'player' as const,
          name: `Drone ${i + 1}`,
          shape: 'circle' as const,
          family: 'escort',
          hull: 1,
          hullMax: 1,
          shield: 0,
          shieldMax: 0,
          armor: 0,
          evasion: 0,
          damageTakenMult: 1,
          weapons: [],
          isBoss: false,
          isFlagship: false,
          dots: [],
          x: slot.x,
          y: slot.y,
          speed: 0,
          engageRange: 0,
          kite: false,
          phaseWarnLeft: 0,
        }
      }),
    ],
    [
      frame?.name,
      combat.playerHull,
      combat.playerHullMax,
      combat.playerShield,
      combat.playerShieldMax,
      stats.armor,
      stats.evasion,
      stats.damageTakenMult,
      stats.escortCount,
    ],
  )

  const contactLabel = combat.docked
    ? combat.inFight
      ? `Paused — ${combat.enemyName}`
      : 'Paused — Hangar'
    : combat.inFight
      ? combat.enemyName
      : encounter.name

  const pushActive = !combat.docked && combat.mode === 'push'
  const isEndless = combat.wave > 100

  const playerUnits = combat.inFight ? combat.playerUnits : previewPlayer
  const enemyUnits =
    combat.docked && !combat.inFight
      ? []
      : combat.inFight
        ? combat.enemyUnits
        : encounter.units

  return (
    <section className="panel combat-hud combat-bridge">
      <header className="combat-hud-bar">
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">Sector</span>
          <strong className="combat-hud-value">1 · The Frontier</strong>
        </div>
        <div className="combat-hud-readout">
          <span className="combat-hud-kicker">Wave</span>
          <strong className="combat-hud-value">
            {combat.wave}
            {isEndless ? (
              <span className="combat-badge combat-badge-threat"> Endless</span>
            ) : null}
          </strong>
          <span className="muted" style={{ fontSize: '0.72rem' }}>
            Best {combat.bestWaveThisRun} · Career {state.meta.highestWaveEver ?? 0}
          </span>
        </div>
        <div className="combat-hud-readout combat-hud-readout-wide">
          <span className="combat-hud-kicker">Contact</span>
          <strong className="combat-hud-value combat-hud-contact">{contactLabel}</strong>
        </div>
        <button
          type="button"
          className="combat-intel-btn"
          onClick={() => setOverlay('wave')}
        >
          Wave preview
        </button>
      </header>

      {challenge ? (
        <p className="notice-warn combat-challenge">
          Challenge: {challenge.name} — cleared {combat.highestSector}/{challenge.goalSector}
        </p>
      ) : null}

      <Battlefield
        playerUnits={playerUnits}
        enemyUnits={enemyUnits}
        projectiles={combat.inFight ? combat.projectiles : []}
        fx={combat.fx}
        mode={battlefieldMode}
      />

      <div className="combat-live-strip" aria-label="Expedition readouts">
        <span>
          <span className="combat-hud-kicker">Salvage</span>{' '}
          <strong>{formatCompact(state.resources.salvage, 0)}</strong>
        </span>
        <span>
          <span className="combat-hud-kicker">PM on Extract</span>{' '}
          <strong>{formatPrestigeMatter(combat.estimatedPrestigeMatter)}</strong>
        </span>
        <span>
          <span className="combat-hud-kicker">DPS</span>{' '}
          <strong>{formatCompact(fightSummary.playerDps, 1)}</strong>
        </span>
        <span>
          <span className="combat-hud-kicker">Best</span>{' '}
          <strong>{combat.bestWaveThisRun}</strong>
        </span>
      </div>

      <div className="combat-controls combat-controls-sticky" role="group" aria-label="Fleet controls">
        <button
          type="button"
          className={pushActive ? 'primary mode-active' : ''}
          aria-pressed={pushActive}
          onClick={() => {
            if (combat.docked) {
              if (!state.shipyard.frameLocked) {
                setOverlay('launch-confirm')
                return
              }
              onSetDocked(false)
            }
          }}
        >
          Push
        </button>
        <button
          type="button"
          data-guide="launch-btn"
          className={combat.docked ? 'primary mode-active' : ''}
          aria-pressed={combat.docked}
          onClick={() => {
            if (combat.docked && !state.shipyard.frameLocked) {
              setOverlay('launch-confirm')
              return
            }
            onSetDocked(!combat.docked)
          }}
        >
          {dockButtonLabel}
        </button>
        {showExtract ? (
          <button
            type="button"
            onClick={() => setOverlay('extract-confirm')}
            title="Extract and bank Prestige Matter"
          >
            Extract
          </button>
        ) : null}
      </div>

      {combat.docked ? (
        <p className="muted combat-dock-hint">
          {combat.inFight
            ? `Paused at wave ${combat.wave} — simulation frozen. Resume or Push to continue.`
            : state.shipyard.frameLocked
              ? `Paused at wave ${combat.wave}. Resume or Push to continue the Expedition.`
              : 'Hangar open — choose your frame, then Launch (locks until Extract).'}
        </p>
      ) : (
        <p className="muted combat-dock-hint">
          Push advances Sector 1 waves. Pause freezes the fight without repair or refit.
          {extractUnlocked
            ? ' Extract banks Prestige Matter (+5%) and resets the Expedition.'
            : ` Extract unlocks at career wave ${PRESTIGE_UNLOCK_WAVE}.`}
        </p>
      )}

      {state.meta.act1Cleared ? (
        <p className="notice">Act 1 complete — Endless waves and Prestige are the long game.</p>
      ) : null}

      {overlay === 'launch-confirm' ? (
        <LaunchConfirmModal
          frameName={frame?.name ?? 'current frame'}
          onConfirm={() => {
            setOverlay('none')
            onSetDocked(false)
          }}
          onClose={() => setOverlay('none')}
        />
      ) : null}

      {overlay === 'wave' ? (
        <WavePreviewModal
          wave={combat.wave}
          encounter={encounter}
          onClose={() => setOverlay('none')}
        />
      ) : null}

      {overlay === 'extract-confirm' ? (
        <ExtractConfirmModal
          wave={combat.wave}
          bestWave={combat.bestWaveThisRun}
          estimatedPm={combat.estimatedPrestigeMatter}
          onConfirm={() => {
            setOverlay('none')
            onExtract()
          }}
          onClose={() => setOverlay('none')}
        />
      ) : null}

      {runSummary ? (
        <RunSummaryModal
          summary={runSummary}
          onContinue={() => setRunSummary(null)}
        />
      ) : null}
    </section>
  )
}

function WavePreviewModal({
  wave,
  encounter,
  onClose,
}: {
  wave: number
  encounter: ReturnType<typeof encounterForWave>
  onClose: () => void
}) {
  const titleId = useId()
  useEscapeClose(onClose)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">Wave {wave}</p>
            <h3 id={titleId}>{encounter.name}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        <p className="muted">
          {encounter.isBoss ? 'Boss wave' : encounter.tags.includes('elite') ? 'Elite wave' : 'Standard wave'}
          {' · '}
          {encounter.family}
          {' · '}
          {encounter.units.length} contact{encounter.units.length === 1 ? '' : 's'}
        </p>
        <p>{encounter.blurb}</p>
        <p className="muted">{familyIntel(encounter.family)}</p>
        <p className="muted">Soft counter: {softCounterForFamily(encounter.family)}</p>
        <p className="muted">
          Clear reward: {encounter.scrapReward} scrap · {encounter.salvageReward} salvage
          {encounter.dataReward > 0 ? ` · ${encounter.dataReward} data` : ''}
          {encounter.essenceReward > 0 ? ` · ${encounter.essenceReward} essence` : ''}
        </p>
      </div>
    </div>
  )
}

function ExtractConfirmModal({
  wave,
  bestWave,
  estimatedPm,
  onConfirm,
  onClose,
}: {
  wave: number
  bestWave: number
  estimatedPm: number
  onConfirm: () => void
  onClose: () => void
}) {
  const titleId = useId()
  useEscapeClose(onClose)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">Expedition</p>
            <h3 id={titleId}>Extract Expedition?</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <p>
          Current wave <strong>{wave}</strong> · Best this run <strong>{bestWave}</strong>
        </p>
        <p>
          Prestige Matter with +5%:{' '}
          <strong>{formatPrestigeMatter(estimatedPm)}</strong>
        </p>
        <p className="muted">
          Extraction ends the run, banks PM, and resets modules for the next Expedition.
        </p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            Extract
          </button>
        </div>
      </div>
    </div>
  )
}

function RunSummaryModal({
  summary,
  onContinue,
}: {
  summary: ExpeditionRunSummary
  onContinue: () => void
}) {
  const titleId = useId()
  useEscapeClose(onContinue)

  const outcome = summary.extracted
    ? 'Extracted'
    : summary.defeated
      ? 'Defeated'
      : 'Ended'

  return (
    <div className="modal-backdrop" role="presentation" onClick={onContinue}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">Run complete</p>
            <h3 id={titleId}>{outcome}</h3>
          </div>
          <button type="button" onClick={onContinue} aria-label="Close">
            Close
          </button>
        </header>
        <p>
          Best wave <strong>{summary.bestWave}</strong>
          {summary.waveReached !== summary.bestWave
            ? ` · Reached ${summary.waveReached}`
            : ''}
        </p>
        <p>
          Prestige Matter awarded:{' '}
          <strong>{formatPrestigeMatter(summary.awardedPm)}</strong>
        </p>
        <p className="muted">
          Salvage {formatCompact(summary.salvageEarned, 0)} · Scrap{' '}
          {formatCompact(summary.scrapEarned, 0)}
          {summary.durationSec > 0
            ? ` · ${Math.round(summary.durationSec)}s`
            : ''}
        </p>
        <div className="modal-actions">
          <button type="button" className="primary" onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

function LaunchConfirmModal({
  frameName,
  onConfirm,
  onClose,
}: {
  frameName: string
  onConfirm: () => void
  onClose: () => void
}) {
  const titleId = useId()
  useEscapeClose(onClose)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="combat-hud-kicker">Hangar</p>
            <h3 id={titleId}>Confirm Launch</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <p>
          Launching locks <strong>{frameName}</strong> until Extract or Defeat.
          Pause anytime later freezes the fight without unlocking refit.
        </p>
        <p className="muted">Launch anyway?</p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Stay Paused
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            Launch
          </button>
        </div>
      </div>
    </div>
  )
}

function useEscapeClose(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}
