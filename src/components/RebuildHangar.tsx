import { useMemo, useState } from 'react'
import type { GameState } from '../game/types'
import {
  MATTER_SHOP,
  SHIP_FRAMES,
  SHIP_MODULES,
  canBuyMatterShop,
  canFitModuleOnFrame,
  getFrame,
  getModule,
  matterShopEffectBlurb,
  shopRank,
  trimModulesToFrame,
} from '../game/catalog'
import { hiveResearchExtraUtilitySlots } from '../game/hiveResearch'
import { canPrestige, prestigeGainFor } from '../game/actions'
import { yardPendingSummary } from '../game/yard'
import { isSystemUnlocked } from '../game/progression'
import { rebuildConsequenceLists } from '../game/playerGuidance'
import { ConsequencePanel } from './ConsequencePanel'
import {
  cycleBestWave,
  rebuildCycle,
  rebuildWaveNeed,
  workshopInvestment,
} from '../game/rebuild'
import { formatCompact } from '../game/format'
import { RESOURCE_LABELS } from '../game/state'

interface RebuildHangarProps {
  state: GameState
  onConfirm: (hangar: { frameId: string; modules: string[] }) => void
  onClose: () => void
  onBuyMatter?: (itemId: string) => void
}

export function RebuildHangar({ state, onConfirm, onClose, onBuyMatter }: RebuildHangarProps) {
  const available = SHIP_FRAMES.filter((f) => state.shipyard.unlockedFrames.includes(f.id))
  const extra = { utility: hiveResearchExtraUtilitySlots(state) }
  const [frameId, setFrameId] = useState(state.shipyard.frameId)
  const frame = getFrame(frameId) ?? available[0]!
  const [modules, setModules] = useState(() =>
    trimModulesToFrame(state.shipyard.modules, frame, extra),
  )

  const ready = canPrestige(state)
  const need = rebuildWaveNeed(state)
  const cycle = rebuildCycle(state)
  const gain = prestigeGainFor(state)
  const lists = rebuildConsequenceLists(state)
  const shopOpen = isSystemUnlocked(state, 'slag') || (state.resources.prestigeMatter ?? 0) > 0
  const matter = state.resources.prestigeMatter
  const label = RESOURCE_LABELS.prestigeMatter

  const weapons = useMemo(
    () => SHIP_MODULES.filter((m) => m.role === 'weapon' && state.shipyard.unlockedModules.includes(m.id)),
    [state.shipyard.unlockedModules],
  )
  const shields = useMemo(
    () =>
      SHIP_MODULES.filter((m) => m.role === 'defense' && state.shipyard.unlockedModules.includes(m.id)),
    [state.shipyard.unlockedModules],
  )
  const utilities = useMemo(
    () =>
      SHIP_MODULES.filter((m) => m.role === 'utility' && state.shipyard.unlockedModules.includes(m.id)),
    [state.shipyard.unlockedModules],
  )

  function toggle(id: string) {
    const def = getModule(id)
    if (!def) return
    if (modules.includes(id)) {
      setModules(modules.filter((m) => m !== id))
      return
    }
    if (!canFitModuleOnFrame(frame, modules, id, extra)) {
      const withoutRole = modules.filter((m) => getModule(m)?.role !== def.role)
      if (canFitModuleOnFrame(frame, withoutRole, id, extra)) {
        setModules(trimModulesToFrame([...withoutRole, id], frame, extra))
      }
      return
    }
    setModules([...modules, id])
  }

  function pickFrame(id: string) {
    const next = getFrame(id)
    if (!next) return
    setFrameId(id)
    setModules(trimModulesToFrame(modules, next, extra))
  }

  return (
    <div className="modal-backdrop hangar-backdrop" role="dialog" aria-labelledby="rebuild-title">
      <div className="hangar-sheet">
        <header className="modal-header">
          <div>
            <h3 id="rebuild-title">Rebuild</h3>
            <p className="muted">Rebuild trades current-cycle development for permanent growth.</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="hangar-body">
          <section className="hangar-cycle">
            <p className="combat-hud-kicker">Current cycle</p>
            <div className="stat-row dock-stats">
              <div>
                <span className="muted">Best Wave</span>
                <strong>{cycleBestWave(state) || '—'}</strong>
              </div>
              <div>
                <span className="muted">Sorties</span>
                <strong>{cycle.sorties}</strong>
              </div>
              <div>
                <span className="muted">Scrap generated</span>
                <strong>{formatCompact(cycle.scrapEarned)}</strong>
              </div>
              <div>
                <span className="muted">Workshop</span>
                <strong>{workshopInvestment(state)} ranks</strong>
              </div>
            </div>
          </section>

          <ConsequencePanel lists={lists} />
          {isSystemUnlocked(state, 'yard') ? (
            <p className="muted">Construction: {yardPendingSummary(state)}.</p>
          ) : null}

          {shopOpen ? (
            <section className="hangar-matter">
              <p className="combat-hud-kicker">Matter shop</p>
              <h4>{formatCompact(matter, 1)} {label}</h4>
              <p className="muted">Permanent ranks. Spend here — there is no separate Slag screen.</p>
              {MATTER_SHOP.map((item) => {
                const rank = shopRank(state.prestige.matterShop, item.id)
                const can = canBuyMatterShop(state, item.id)
                return (
                  <article key={item.id} className="network-row">
                    <div className="network-row-main">
                      <strong>{item.name}</strong>
                      <span className="muted">Lv {rank}</span>
                    </div>
                    <p className="network-row-stats">{item.description}</p>
                    <p className="muted">{matterShopEffectBlurb(item, rank)}</p>
                    <button
                      type="button"
                      className="primary"
                      disabled={!onBuyMatter || !can.ok}
                      onClick={() => onBuyMatter?.(item.id)}
                    >
                      {can.ok ? `${can.cost} ${label}` : can.reason}
                    </button>
                  </article>
                )
              })}
            </section>
          ) : null}

          <h4 data-guide="hangar-hull">Hull</h4>
          <div className="hangar-picks">
            {available.map((f) => (
              <button
                key={f.id}
                type="button"
                className={frameId === f.id ? 'primary' : undefined}
                onClick={() => pickFrame(f.id)}
              >
                {f.name}
                <span className="muted">
                  {' '}
                  {f.weaponSlots}W {f.defenseSlots}S {f.utilitySlots + extra.utility}U
                </span>
              </button>
            ))}
          </div>

          <h4>Weapon</h4>
          <div className="hangar-picks">
            {weapons.map((m) => (
              <button
                key={m.id}
                type="button"
                className={modules.includes(m.id) ? 'primary' : undefined}
                onClick={() => toggle(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>

          <h4>Shield</h4>
          <div className="hangar-picks">
            {shields.map((m) => (
              <button
                key={m.id}
                type="button"
                className={modules.includes(m.id) ? 'primary' : undefined}
                onClick={() => toggle(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>

          {utilities.length > 0 ? (
            <>
              <h4>Utility</h4>
              <div className="hangar-picks">
                {utilities.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={modules.includes(m.id) ? 'primary' : undefined}
                    onClick={() => toggle(m.id)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            data-guide="hangar-confirm"
            disabled={!ready}
            onClick={() => onConfirm({ frameId, modules })}
          >
            {ready ? `Rebuild · +${gain} Matter` : `Reach Wave ${need} this cycle`}
          </button>
        </div>
      </div>
    </div>
  )
}
