import { describe, expect, it } from 'vitest'
import { AI_NODES, CHALLENGES, SHIP_MODULES, formatPrintSourceLine } from './catalog'
import { roleIntel } from './combat'
import { PROTOCOLS } from './protocols'
import { DIRECTIVES } from './directives'
import { inspectCopyCorpus } from './inspect'
import { FOUNDRY_LOGS } from './logs'
import { NETWORK_BARS, NETWORK_LINKS } from './network'
import { ACHIEVEMENTS, SYSTEM_UNLOCKS } from './progression'
import { SHARDS } from './reliquary'
import { SCREEN_HELP } from './screenHelp'
import { createInitialState } from './state'
import { buildSortieDiagnostic } from './sortieTelemetry'
import { reinforceConsequenceLists } from './playerGuidance'

const LEFTOVER =
  /\bFlagship\b|\bflagship\b|\bSector\b|\bsector\b|Frontier Hold|Route B|Foundry Points|\bPrints\b|Boss Protocol|Scavenger Protocol|Reliquary|Echo Mapped|Echo Runs|Slag Ingot|\bSpecialists\b|\bTask List\b|\bCapital\b/

function blob(parts: string[]): string {
  return parts.filter(Boolean).join('\n')
}

describe('GDD Wave / Hive player-facing copy', () => {
  it('keeps inspect, help, and catalogs off Sector and Flagship', () => {
    const state = createInitialState(0)
    const catalog = blob([
      ...inspectCopyCorpus(state),
      ...Object.values(SCREEN_HELP).flatMap((help) => [help.title, ...help.body]),
      ...SHIP_MODULES.map((mod) => `${mod.name} ${mod.description}`),
      ...AI_NODES.map((node) => `${node.name} ${node.description}`),
      ...CHALLENGES.map((row) => `${row.name} ${row.description}`),
      ...PROTOCOLS.flatMap((row) => [row.name, row.blurb, row.restriction, ...row.disabledSystems]),
      ...NETWORK_BARS.flatMap((bar) => [bar.blurb, ...bar.detail]),
      ...NETWORK_LINKS.flatMap((link) => [link.blurb, ...link.detail]),
      ...SHARDS.map((shard) => shard.blurb),
      ...ACHIEVEMENTS.map((row) => `${row.name} ${row.description}`),
      ...FOUNDRY_LOGS.map((log) => `${log.title} ${log.body}`),
      ...DIRECTIVES.map((row) => `${row.name} ${row.blurb}`),
      ...SYSTEM_UNLOCKS.map((row) => `${row.label} ${row.tip}`),
      ...Object.values(reinforceConsequenceLists(createInitialState(0))).flat(),
      roleIntel('skirmisher'),
      formatPrintSourceLine('heavy-lance'),
    ])
    expect(catalog).not.toMatch(LEFTOVER)
    expect(catalog).toMatch(/Hive/)
    expect(catalog).toMatch(/Wave 10/)
  })

  it('titles Sortie diagnostics with Wave, not Sector', () => {
    const state = createInitialState(0)
    const text = buildSortieDiagnostic(
      {
        ...state.combat.lastSortie,
        outcome: 'defeat',
        wave: 140,
        stats: {
          ...state.combat.lastSortie.stats,
          lastIsBoss: true,
          finalEnemyHp: 10,
          finalEnemyHpMax: 100,
        },
      },
      state,
    )
    expect(text.title).toMatch(/WAVE 140 BOSS/)
    expect(text.title).not.toMatch(/SECTOR/)
  })
})
