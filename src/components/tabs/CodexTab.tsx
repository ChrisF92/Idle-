import type { GameState, UnitShape } from '../../game/types'
import {
  CODEX_FAMILIES,
  familyIntel,
  familyShape,
  softCounterForFamily,
  type EnemyFamily,
} from '../../game/combat'

interface CodexTabProps {
  state: GameState
}

export function CodexTab({ state }: CodexTabProps) {
  const unlocked = state.research.unlocked.includes('tactical-codex')
  const seen = new Set(state.codex.seenFamilies)
  const revealed = CODEX_FAMILIES.filter((f) => seen.has(f)).length

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Codex</h2>
        <p>Enemy intel and soft counters.</p>
      </header>

      {!unlocked ? (
        <div className="notice-box">
          <p>
            Codex offline. Research <strong>Tactical Codex</strong> to decrypt encounter memory.
          </p>
          <p className="muted">
            Families already seen this career: {revealed}/{CODEX_FAMILIES.length}
            {revealed > 0 ? ' (waiting for decryption).' : '.'}
          </p>
        </div>
      ) : (
        <>
          <p className="muted">
            Decrypted {revealed}/{CODEX_FAMILIES.length} families. Fight new packs to fill gaps.
          </p>
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

function titleCase(family: EnemyFamily): string {
  return family.charAt(0).toUpperCase() + family.slice(1)
}
