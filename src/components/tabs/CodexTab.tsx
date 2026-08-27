import type { GameState, UnitShape } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  bossCodexLines,
  discoveredHostileRecords,
  hostileCodexLines,
  unknownHostilePlaceholderCount,
  type CodexPane,
} from '../../game/codex'
import {
  COMMANDER_TRAIT_BLURBS,
  COMMANDER_TRAIT_ICONS,
  COMMANDER_TRAIT_LABELS,
  HOSTILE_DEFS,
  type CommanderTraitId,
} from '../../game/hostileCatalogue'
import { BOSS_DEFS } from '../../game/bossRegistry'
import { SheetTabs } from '../SheetTabs'
import { useSyncedPane } from '../../hooks/useSyncedPane'

const PANE_OPTIONS: { id: CodexPane; label: string; guide?: string }[] = [
  { id: 'hostiles', label: 'Hostiles', guide: 'codex-hostiles' },
  { id: 'bosses', label: 'Bosses', guide: 'codex-bosses' },
]

interface CodexTabProps {
  state: GameState
  onBack: () => void
  guideTarget?: string | null
}

export function CodexTab({ state, onBack, guideTarget = null }: CodexTabProps) {
  const open = isSystemUnlocked(state, 'codex')
  const discovered = discoveredHostileRecords(state)
  const unknownHostiles = unknownHostilePlaceholderCount(state)
  const discoveredBosses = new Set(state.codex.discoveredBossIds ?? [])
  const discoveredTraits = (state.codex.discoveredCommanderTraitIds ?? []) as CommanderTraitId[]
  const hint = guideTarget === 'codex-bosses' ? 'bosses' : guideTarget === 'codex-hostiles' ? 'hostiles' : null
  const [pane, setPane] = useSyncedPane<CodexPane>('hostiles', hint)
  const safePane: CodexPane = pane === 'bosses' ? 'bosses' : 'hostiles'

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            More
          </button>
        </p>
        <h2>Codex</h2>
        <p>
          {open
            ? `Hostiles ${discovered.length}/${HOSTILE_DEFS.length} · Bosses ${discoveredBosses.size}/${BOSS_DEFS.length}`
            : `Reach Wave ${ACT1_CADENCE.codex} to decrypt encounter memory.`}
        </p>
      </header>

      {!open ? (
        <p className="muted">
          Recorded from actual spawns: {discovered.length} hostiles
          {discovered.length > 0 ? ` (waiting for Wave ${ACT1_CADENCE.codex}).` : '.'}
        </p>
      ) : (
        <>
          <SheetTabs value={safePane} onChange={setPane} options={PANE_OPTIONS} label="Codex panes" />
          <div className="panel-scroll">
            {safePane === 'hostiles' ? (
              <>
                <h3 className="foundry-heading" data-guide="codex-hostiles">
                  Hostiles
                </h3>
                <ul className="sector-roster">
                  {discovered.map((row) => {
                    const lines = hostileCodexLines(row.def)
                    const taxonomy = [lines.family, lines.role].filter((value): value is string => Boolean(value)).join(' · ')
                    return (
                      <li key={row.def.id} className="sector-roster-item">
                        <HostileGlyph shape={row.def.shape} />
                        <div>
                          <strong>{row.def.name}</strong>
                          {taxonomy ? <p className="muted">{taxonomy}</p> : null}
                          {lines.mechanic ? <p>{lines.mechanic}</p> : null}
                          {lines.profile ? <p className="muted">{lines.profile}</p> : null}
                          {lines.softCounter ? <p>{lines.softCounter}</p> : null}
                          {lines.telemetry ? <p className="muted">{lines.telemetry}</p> : null}
                          {row.commanderEncounters > 0 ? (
                            <p className="muted">
                              Commanders faced {row.commanderEncounters} · defeated {row.commanderDefeats}
                              {row.traitsEncountered.length > 0
                                ? ` · ${row.traitsEncountered.map((t) => COMMANDER_TRAIT_LABELS[t]).join(', ')}`
                                : ''}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                  {Array.from({ length: unknownHostiles }, (_, i) => (
                    <li key={`unknown-h-${i}`} className="sector-roster-item">
                      <div className="enemy-glyph codex-unknown" aria-hidden="true">
                        ?
                      </div>
                      <div>
                        <strong>Unknown signature</strong>
                        <p className="muted">Encounter this hostile in the field to unlock.</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {discoveredTraits.length > 0 ? (
                  <>
                    <h3 className="foundry-heading">Commander Traits</h3>
                    <p className="muted">Discovered glossary. Not a third Codex catalogue.</p>
                    {discoveredTraits.map((id) => (
                      <article key={id} className="network-row">
                        <div className="network-row-main">
                          <strong>
                            {COMMANDER_TRAIT_ICONS[id]} {COMMANDER_TRAIT_LABELS[id]}
                          </strong>
                        </div>
                        <p className="network-row-stats">{COMMANDER_TRAIT_BLURBS[id]}</p>
                      </article>
                    ))}
                  </>
                ) : null}
              </>
            ) : (
              <>
                <h3 className="foundry-heading" data-guide="codex-bosses">
                  Bosses
                </h3>
                <ul className="sector-roster">
                  {BOSS_DEFS.filter((def) => discoveredBosses.has(def.id)).map((def) => {
                    const lines = bossCodexLines(def.id)
                    const cleared = (state.codex.bossClears ?? []).includes(def.id)
                    return (
                      <li key={def.id} className="sector-roster-item">
                        <HostileGlyph shape="hex" prominent />
                        <div>
                          <strong>{def.name}</strong>
                          <p className="muted">Wave {def.wave}{cleared ? ' · cleared' : ''}</p>
                          {lines.mechanic ? <p>{lines.mechanic}</p> : null}
                          {lines.profile ? <p className="muted">{lines.profile}</p> : null}
                          {lines.softAnswer ? <p>{lines.softAnswer}</p> : null}
                          {lines.telemetry ? <p className="muted">{lines.telemetry}</p> : null}
                        </div>
                      </li>
                    )
                  })}
                  {BOSS_DEFS.filter((def) => !discoveredBosses.has(def.id)).map((def) => (
                    <li key={`unknown-b-${def.id}`} className="sector-roster-item">
                      <div className="enemy-glyph codex-unknown" aria-hidden="true">
                        ?
                      </div>
                      <div>
                        <strong>Unknown boundary</strong>
                        <p className="muted">A proper Boss has not spawned yet.</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function HostileGlyph({ shape, prominent = false }: { shape: UnitShape; prominent?: boolean }) {
  const r = prominent ? 18 : 14
  return (
    <svg
      className="enemy-glyph"
      viewBox="0 0 64 64"
      width="56"
      height="56"
      aria-hidden="true"
    >
      <rect width="64" height="64" fill="#0e141c" />
      <circle cx="32" cy="32" r="28" fill="#1a2430" opacity="0.9" />
      <g transform="translate(32 32)" fill="#9eb4cc" stroke="#e7edf5" strokeWidth="1.5">
        {shapePath(shape, r)}
      </g>
    </svg>
  )
}

function shapePath(shape: UnitShape, r: number) {
  switch (shape) {
    case 'triangle':
      return <path d={`M ${r} 0 L ${-r * 0.85} ${-r} L ${-r * 0.85} ${r} Z`} />
    case 'square':
      return <rect x={-r * 0.85} y={-r * 0.85} width={r * 1.7} height={r * 1.7} />
    case 'diamond':
      return <path d={`M 0 ${-r} L ${r} 0 L 0 ${r} L ${-r} 0 Z`} />
    case 'hex': {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6
        return `${Math.cos(a) * r},${Math.sin(a) * r}`
      }).join(' ')
      return <polygon points={pts} />
    }
    default:
      return <circle r={r} />
  }
}
