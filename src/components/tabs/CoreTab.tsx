import { useMemo, useState } from 'react'
import type { GameState, SignalCoreSlotType } from '../../game/types'
import {
  CORE_ATTR_IDS,
  CORE_ATTR_LABELS,
  CORE_TRAIN_STATION,
  coreAttrBonusSummary,
  coreTrainingSpeed,
  secondsForNextRank,
} from '../../game/core'
import { getStation, idleWorkers, isStationUnlocked } from '../../game/catalog'
import {
  SIGNAL_CORE_MAX_RANK,
  SIGNAL_CORE_MERGE_COUNT,
  SIGNAL_SLOT_LABELS,
  SIGNAL_SLOT_TYPES,
  canEquipSignalCore,
  computeSignalCoreBonuses,
  countMergeable,
  formatSignalCoreBonuses,
  getSignalCoreDef,
  isSignalCoreEquipBlocked,
  listSignalSlots,
  signalCoreBaseBlurb,
  signalCoreSlotBlurb,
} from '../../game/signalCores'

interface CoreTabProps {
  state: GameState
  onAssign: (stationId: string, delta: number) => void
  onEquipCore: (uid: string, slotKey: string) => void
  onUnequipCore: (slotKey: string) => void
  onMergeCores: (defId: string, rank: number) => void
}

export function CoreTab({
  state,
  onAssign,
  onEquipCore,
  onUnequipCore,
  onMergeCores,
}: CoreTabProps) {
  const idle = idleWorkers(state)
  const unlocked = state.research.unlocked.includes('core-training')
  const slots = listSignalSlots(state)
  const inventory = state.signalCores?.inventory ?? []
  const equipped = state.signalCores?.equipped ?? {}
  const equippedUids = new Set(Object.values(equipped))
  const bonuses = computeSignalCoreBonuses(state)
  const carryOver = state.meta.signalCoresCarryOver
  const equipBlocked = isSignalCoreEquipBlocked(state)
  const [equipPick, setEquipPick] = useState<string | null>(null)

  const byUid = useMemo(() => {
    const m = new Map(inventory.map((c) => [c.uid, c]))
    return m
  }, [inventory])

  const mergeGroups = useMemo(() => {
    const groups = new Map<string, { defId: string; rank: number; count: number }>()
    for (const c of inventory) {
      if (equippedUids.has(c.uid)) continue
      if (c.rank >= SIGNAL_CORE_MAX_RANK) continue
      const key = `${c.defId}:${c.rank}`
      const prev = groups.get(key)
      if (prev) prev.count += 1
      else groups.set(key, { defId: c.defId, rank: c.rank, count: 1 })
    }
    return [...groups.values()].filter((g) => g.count >= SIGNAL_CORE_MERGE_COUNT)
  }, [inventory, equippedUids])

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Core</h2>
        <p>
          Assign workers to training stations to raise Core attributes. Ranks only increase —
          there is no respec. Prestige and challenge resets clear all ranks.
        </p>
      </header>

      {!unlocked ? (
        <p className="muted">Requires research: Core Training.</p>
      ) : (
        <>
          <div className="stat-row">
            <div>
              <span className="muted">Workers</span>
              <strong>{state.base.workerDrones}</strong>
            </div>
            <div>
              <span className="muted">Idle</span>
              <strong>{idle}</strong>
            </div>
          </div>

          <h3>Attributes</h3>
          <ul className="def-list">
            {CORE_ATTR_IDS.map((attrId) => {
              const stationId = CORE_TRAIN_STATION[attrId]
              const station = getStation(stationId)
              const stationOpen = isStationUnlocked(state, stationId)
              const assigned = state.base.assignments[stationId] ?? 0
              const rank = state.core.ranks[attrId] ?? 0
              const progress = state.core.progress[attrId] ?? 0
              const speed = coreTrainingSpeed(state, attrId)
              const eta =
                speed > 0
                  ? ((1 - progress) * secondsForNextRank(rank)) / speed
                  : null

              return (
                <li key={attrId}>
                  <div>
                    <strong>
                      {CORE_ATTR_LABELS[attrId]}{' '}
                      <span className="badge">Rank {rank}</span>
                    </strong>
                    <p className="muted">{station?.description}</p>
                    <p className="muted">{coreAttrBonusSummary(attrId, rank)}</p>
                    {!stationOpen ? (
                      <p className="muted">Station locked</p>
                    ) : (
                      <p className="muted">
                        {assigned} workers
                        {eta != null ? ` · next rank ~${eta.toFixed(0)}s` : ' · assign workers to train'}
                      </p>
                    )}
                    <div className="manufacture-bar" aria-label={`${attrId} training progress`}>
                      <div
                        className="manufacture-bar-fill"
                        style={{ width: `${Math.min(100, progress * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="action-col">
                    <span className="badge">{assigned} assigned</span>
                    <div className="assign-row">
                      <button
                        type="button"
                        disabled={!stationOpen || assigned <= 0}
                        onClick={() => onAssign(stationId, -1)}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        disabled={!stationOpen || idle <= 0}
                        onClick={() => onAssign(stationId, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <h3>Signal Cores</h3>
      <p className="muted">
        Equip cores into Assault, Ward, and Signal slots. Merge three identical cores (same
        def + rank) into one higher rank (max {SIGNAL_CORE_MAX_RANK}).
      </p>
      {carryOver ? (
        <p className="notice-warn">Signal bank stable across prestige.</p>
      ) : (
        <p className="muted">Cores wipe on prestige until Null Signal is cleared.</p>
      )}
      {equipBlocked ? (
        <p className="notice-warn">Null Signal active — equipping cores is blocked.</p>
      ) : null}
      <p className="muted">Active: {formatSignalCoreBonuses(bonuses)}</p>

      <div className="signal-slot-groups">
        {SIGNAL_SLOT_TYPES.map((type) => {
          const typeSlots = slots.filter((s) => s.type === type)
          return (
            <div key={type} className="signal-slot-group">
              <h4>{SIGNAL_SLOT_LABELS[type]}</h4>
              <ul className="def-list">
                {typeSlots.map((slot) => {
                  const uid = equipped[slot.key]
                  const inst = uid ? byUid.get(uid) : undefined
                  const def = inst ? getSignalCoreDef(inst.defId) : undefined
                  return (
                    <li key={slot.key}>
                      <div>
                        {def && inst ? (
                          <>
                            <strong>
                              {def.name}{' '}
                              <span className="badge">R{inst.rank}</span>
                            </strong>
                            <p className="muted">
                              {signalCoreBaseBlurb(def, inst.rank)}
                            </p>
                            <p className="muted">
                              Slot: {signalCoreSlotBlurb(def, inst.rank)}
                            </p>
                          </>
                        ) : (
                          <>
                            <strong>Empty</strong>
                            <p className="muted">{slot.key}</p>
                          </>
                        )}
                      </div>
                      <div className="action-col">
                        {inst ? (
                          <button type="button" onClick={() => onUnequipCore(slot.key)}>
                            Unequip
                          </button>
                        ) : equipPick &&
                          canEquipSignalCore(state, equipPick, slot.key) ? (
                          <button
                            type="button"
                            onClick={() => {
                              onEquipCore(equipPick, slot.key)
                              setEquipPick(null)
                            }}
                          >
                            Place
                          </button>
                        ) : (
                          <span className="badge">Open</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      {equipPick ? (
        <p className="notice-warn">
          Select an open slot above to equip, or{' '}
          <button type="button" onClick={() => setEquipPick(null)}>
            cancel
          </button>
          .
        </p>
      ) : null}

      <h4>Inventory</h4>
      {inventory.length === 0 ? (
        <p className="muted">No Signal Cores yet — recover them from combat kills and sector clears.</p>
      ) : (
        <ul className="def-list">
          {inventory.map((inst) => {
            const def = getSignalCoreDef(inst.defId)
            if (!def) return null
            const isEquipped = equippedUids.has(inst.uid)
            const mergeCount = countMergeable(state, inst.defId, inst.rank)
            const canMerge =
              !isEquipped &&
              inst.rank < SIGNAL_CORE_MAX_RANK &&
              mergeCount >= SIGNAL_CORE_MERGE_COUNT
            const allowed = def.allowedSlots
              .map((t: SignalCoreSlotType) => SIGNAL_SLOT_LABELS[t])
              .join(', ')
            return (
              <li key={inst.uid}>
                <div>
                  <strong>
                    {def.name}{' '}
                    <span className="badge">
                      {def.rarity} · R{inst.rank}
                    </span>
                    {isEquipped ? <span className="badge">Equipped</span> : null}
                  </strong>
                  <p className="muted">{def.description}</p>
                  <p className="muted">{signalCoreBaseBlurb(def, inst.rank)}</p>
                  <p className="muted">{signalCoreSlotBlurb(def, inst.rank)}</p>
                  <p className="muted">Slots: {allowed}</p>
                </div>
                <div className="action-col">
                  {!isEquipped ? (
                    <button
                      type="button"
                      disabled={equipBlocked}
                      onClick={() => setEquipPick(inst.uid)}
                    >
                      Equip
                    </button>
                  ) : null}
                  {canMerge ? (
                    <button
                      type="button"
                      onClick={() => onMergeCores(inst.defId, inst.rank)}
                    >
                      Merge ×{SIGNAL_CORE_MERGE_COUNT}
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {mergeGroups.length > 0 ? (
        <p className="muted">
          Merge ready:{' '}
          {mergeGroups
            .map((g) => {
              const name = getSignalCoreDef(g.defId)?.name ?? g.defId
              return `${name} R${g.rank} (×${g.count})`
            })
            .join(', ')}
        </p>
      ) : null}
    </section>
  )
}
