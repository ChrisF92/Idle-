import type { EnemyRole, GameState, UnitShape } from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE } from '../../game/cadence'
import {
  CODEX_FAMILIES,
  CODEX_ROLES,
  familyIntel,
  familyShape,
  roleIntel,
  softCounterForFamily,
  type EnemyFamily,
} from '../../game/combat'
import { SheetTabs } from '../SheetTabs'
import { useSyncedPane } from '../../hooks/useSyncedPane'

type CodexPane = 'families' | 'roles'

const CODEX_PANES: { id: CodexPane; label: string; guide?: string }[] = [
  { id: 'families', label: 'Families', guide: 'codex-families' },
  { id: 'roles', label: 'Roles', guide: 'codex-roles' },
]

interface CodexTabProps {
  state: GameState
  onBack: () => void
  guideTarget?: string | null
}

export function CodexTab({ state, onBack, guideTarget = null }: CodexTabProps) {
  const open = isSystemUnlocked(state, 'codex')
  const seen = new Set(state.codex.seenFamilies)
  const revealed = CODEX_FAMILIES.filter((f) => seen.has(f)).length
  const hint = guideTarget === 'codex-roles' ? 'roles' : guideTarget === 'codex-families' ? 'families' : null
  const [pane, setPane] = useSyncedPane<CodexPane>('families', hint)

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
            ? `Families ${revealed}/${CODEX_FAMILIES.length} · hull roles always listed`
            : `Reach Wave ${ACT1_CADENCE.codex} to decrypt encounter memory.`}
        </p>
      </header>

      {!open ? (
        <p className="muted">
          Families already seen this career: {revealed}/{CODEX_FAMILIES.length}
          {revealed > 0 ? ` (waiting for Wave ${ACT1_CADENCE.codex}).` : '.'}
        </p>
      ) : (
        <>
          <SheetTabs value={pane} onChange={setPane} options={CODEX_PANES} label="Codex panes" />
          <div className="panel-scroll">
          {pane === 'families' ? (
            <>
          <h3 className="foundry-heading" data-guide="codex-families">
            Families
          </h3>
          <ul className="sector-roster">
            {CODEX_FAMILIES.map((family) => {
              const known = seen.has(family)
              return (
                <li key={family} className="sector-roster-item">
                  {known ? (
                    <FamilyGlyph family={family} />
                  ) : (
                    <div className="enemy-glyph codex-unknown" aria-hidden="true">
                      ?
                    </div>
                  )}
                  <div>
                    <strong>{known ? titleCase(family) : 'Unknown signature'}</strong>
                    {known ? (
                      <>
                        <p className="muted">{familyIntel(family)}</p>
                        <p>{softCounterForFamily(family)}</p>
                      </>
                    ) : (
                      <p className="muted">Encounter this family in the field to unlock.</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
            </>
          ) : (
            <>
          <h3 className="foundry-heading" data-guide="codex-roles">
            Hull roles
          </h3>
          <p className="muted">Stand-off classes. Silhouettes on the lane match these names.</p>
          {CODEX_ROLES.map((role) => (
            <article key={role} className="network-row">
              <div className="network-row-main">
                <strong>{titleCase(role)}</strong>
              </div>
              <p className="network-row-stats">{roleIntel(role)}</p>
            </article>
          ))}
            </>
          )}
          </div>
        </>
      )}
    </section>
  )
}

function FamilyGlyph({ family }: { family: EnemyFamily }) {
  const fill = familyColor(family)
  const shape = familyShape(family)
  const gradId = `codex-${family}`
  return (
    <svg
      className="enemy-glyph"
      viewBox="0 0 64 64"
      width="56"
      height="56"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={fill} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0e141c" stopOpacity="0.9" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" fill="#0e141c" />
      <circle cx="32" cy="32" r="28" fill={`url(#${gradId})`} opacity="0.35" />
      <g transform="translate(32 32)" fill={fill} stroke="#e7edf5" strokeWidth="1.5">
        {shapePath(shape, family === 'titan' ? 18 : 14)}
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

function familyColor(family: EnemyFamily): string {
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
      return '#ff6b6b'
  }
}

function titleCase(value: EnemyFamily | EnemyRole): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
