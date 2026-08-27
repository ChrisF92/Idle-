import { useMemo, useState } from 'react'
import type { GameState, RelicSocketClass, TabId } from '../game/types'
import {
  INVENTORY_CATEGORIES,
  RELIC_FILTERS,
  RELIC_STORAGE_NOTE,
  filterInventoryRows,
  inventoryEquipment,
  inventoryMaterials,
  inventoryRelics,
  inventorySearchUseful,
  type InventoryCategory,
} from '../game/inventory'
import { formatCompact } from '../game/format'
import { canUpgradeRelic, RELIC_SOCKET_LABELS, shardEffectBlurb, getShard } from '../game/reliquary'
import { SheetTabs } from './SheetTabs'
import { EmptyState, FullSheet, ItemRow, Kicker, Section, SectionHeader, StatPair } from '../ui/primitives'
import { CoreDetailSheet, FrameSheet } from './LoadoutSheets'
import { getModule, moduleMasteryRank } from '../game/catalog'
import { coreStartingLevel } from '../game/coreProgression'
import { coreInstanceCopyNumber } from '../game/coreInstances'

interface InventoryScreenProps {
  state: GameState
  open: boolean
  onClose: () => void
  onOpenFoundry?: (pane: 'fabrication' | 'mastery') => void
  onSelectFrame?: (frameId: string) => void
  onFitCore?: (moduleId: string, coreInstanceId?: string) => void
  onUpgradeCore?: (coreInstanceId: string, count?: number) => void
}

export function InventoryScreen({
  state,
  open,
  onClose,
  onOpenFoundry,
  onSelectFrame,
  onFitCore,
  onUpgradeCore,
}: InventoryScreenProps) {
  const [category, setCategory] = useState<InventoryCategory>('equipment')
  const [relicFilter, setRelicFilter] = useState<'all' | RelicSocketClass>('all')
  const [query, setQuery] = useState('')
  const [coreId, setCoreId] = useState<{
    moduleId: string
    coreInstanceId: string
  } | null>(null)
  const [frameOpen, setFrameOpen] = useState(false)
  const [relicId, setRelicId] = useState<string | null>(null)
  const [materialId, setMaterialId] = useState<string | null>(null)
  const showSearch = inventorySearchUseful(state)
  const docked = Boolean(state.combat.docked)

  const equipment = useMemo(() => {
    const rows = inventoryEquipment(state)
    return filterInventoryRows(rows, query)
  }, [state, query])
  const relics = useMemo(() => {
    const rows = inventoryRelics(state, relicFilter)
    return filterInventoryRows(rows, query)
  }, [state, relicFilter, query])
  const materials = useMemo(() => {
    const rows = inventoryMaterials(state)
    return filterInventoryRows(rows, query)
  }, [state, query])
  const coreRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.shipyard.coreInstances
      .flatMap((instance) => {
        const def = getModule(instance.moduleId)
        if (!def || (q && !def.name.toLowerCase().includes(q))) return []
        return [{
          instance,
          def,
          copy: coreInstanceCopyNumber(state, instance.id),
          equipped: state.shipyard.equippedCoreIds.includes(instance.id),
          level: coreStartingLevel(state, instance.id),
          mastery: moduleMasteryRank(state, instance.moduleId),
        }]
      })
  }, [state, query])

  const relic = relicId ? relics.find((row) => row.id === relicId) ?? inventoryRelics(state).find((row) => row.id === relicId) : null
  const material = materialId
    ? materials.find((row) => row.id === materialId) ?? inventoryMaterials(state).find((row) => row.id === materialId)
    : null

  return (
    <>
      <FullSheet open={open} title="Inventory" onClose={onClose} overlayId="inventory" kicker="Owned items">
        <SheetTabs value={category} onChange={setCategory} options={INVENTORY_CATEGORIES} label="Inventory categories" />
        {category === 'relics' ? (
          <SheetTabs value={relicFilter} onChange={setRelicFilter} options={RELIC_FILTERS} label="Relic filters" />
        ) : null}
        {showSearch ? (
          <label className="ui-search">
            <Kicker>Search</Kicker>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter owned items" />
          </label>
        ) : null}

        {category === 'equipment' ? (
          <Section>
            <SectionHeader title="Frames" />
            {equipment.filter((row) => row.kind === 'frame').map((row) =>
              row.kind === 'frame' ? (
                <ItemRow
                  key={row.id}
                  title={row.name}
                  meta={row.equipped ? 'Owned · Equipped' : 'Owned'}
                  onClick={() => setFrameOpen(true)}
                />
              ) : null,
            )}
            <SectionHeader title="Cores" />
            {coreRows.map((row) => (
              <ItemRow
                key={row.instance.id}
                title={row.def.name}
                meta={`${row.def.role === 'weapon' ? 'Attack' : row.def.role === 'defense' ? 'Defense' : 'Utility'} Core · Copy ${row.copy} · ${row.equipped ? 'Equipped' : 'Available'}`}
                value={`Lv${row.level} · M${row.mastery}`}
                onClick={() =>
                  setCoreId({
                    moduleId: row.instance.moduleId,
                    coreInstanceId: row.instance.id,
                  })
                }
              />
            ))}
            {equipment.length === 0 && coreRows.length === 0 ? (
              <EmptyState title="No equipment yet" />
            ) : null}
          </Section>
        ) : null}

        {category === 'relics' ? (
          <Section>
            {relics.map((row) => (
              <ItemRow
                key={row.id}
                title={row.name}
                meta={`${RELIC_SOCKET_LABELS[row.socket]} · Owned ×${row.owned}`}
                value={`Eq ${row.equipped} · Free ${row.available}`}
                onClick={() => setRelicId(row.id)}
              />
            ))}
            {relics.length === 0 ? (
              <EmptyState title="No Relics yet" body="Recover Relics from wrecks, then fit them at Dock." />
            ) : null}
          </Section>
        ) : null}

        {category === 'materials' ? (
          <Section>
            {(['industrial', 'recovered'] as const).map((family) => {
              const group = materials.filter((row) => row.family === family)
              if (group.length === 0) return null
              return (
                <div key={family}>
                  <SectionHeader title={family === 'industrial' ? 'Industrial' : 'Recovered'} />
                  {group.map((row) => (
                    <ItemRow
                      key={row.id}
                      title={row.name}
                      meta={row.source}
                      value={formatCompact(row.stock)}
                      onClick={() => setMaterialId(row.id)}
                    />
                  ))}
                </div>
              )
            })}
            {materials.length === 0 ? <EmptyState title="No materials stocked" /> : null}
          </Section>
        ) : null}
      </FullSheet>

      {coreId ? (
        <CoreDetailSheet
          state={state}
          moduleId={coreId.moduleId}
          coreInstanceId={coreId.coreInstanceId}
          locked={!docked}
          onUpgradeCore={docked ? onUpgradeCore : undefined}
          onChange={
            docked &&
            onFitCore &&
            !state.shipyard.equippedCoreIds.includes(coreId.coreInstanceId)
              ? () => {
                  onFitCore(coreId.moduleId, coreId.coreInstanceId)
                  setCoreId(null)
                }
              : undefined
          }
          onClose={() => setCoreId(null)}
        />
      ) : null}

      {frameOpen ? (
        <FrameSheet
          state={state}
          locked={!docked}
          onEquip={(id) => {
            onSelectFrame?.(id)
            setFrameOpen(false)
          }}
          onClose={() => setFrameOpen(false)}
        />
      ) : null}

      <FullSheet
        open={Boolean(relic)}
        title={relic?.name ?? 'Relic'}
        kicker={relic ? `${RELIC_SOCKET_LABELS[relic.socket]} · Tier ${relic.tier}` : undefined}
        onClose={() => setRelicId(null)}
        overlayId="inventory-relic"
      >
        {relic ? (
          <>
            <p>{getShard(relic.id) ? shardEffectBlurb(getShard(relic.id)!) : relic.blurb}</p>
            <div className="ui-context-bar">
              <StatPair label="Owned" value={`×${relic.owned}`} />
              <StatPair label="Equipped" value={relic.equipped} />
              <StatPair label="Free" value={relic.available} />
            </div>
            <p className="ui-meta">
              {relic.fittedOn.length > 0 ? `On ${relic.fittedOn.join(', ')}` : 'Not fitted'}
            </p>
            {relic.upgradesTo ? (
              <p className="ui-meta">
                {canUpgradeRelic(state, relic.id).ok
                  ? `Upgrade ready → ${getShard(relic.upgradesTo)?.name ?? relic.upgradesTo}`
                  : `Upgrade route → ${getShard(relic.upgradesTo)?.name ?? relic.upgradesTo}`}
              </p>
            ) : null}
            <p className="ui-meta">{RELIC_STORAGE_NOTE}</p>
            {onOpenFoundry ? (
              <button type="button" onClick={() => onOpenFoundry('fabrication')}>
                Open Foundry
              </button>
            ) : null}
          </>
        ) : null}
      </FullSheet>

      <FullSheet
        open={Boolean(material)}
        title={material?.name ?? 'Material'}
        onClose={() => setMaterialId(null)}
        overlayId="inventory-material"
      >
        {material ? (
          <>
            <div className="ui-context-bar">
              <StatPair label="Stock" value={formatCompact(material.stock)} />
              <StatPair label="Foundry Mastery" value={material.mastery || '—'} />
            </div>
            <p className="ui-meta">Source · {material.source}</p>
            {material.consumedBy.length > 0 ? (
              <p className="ui-meta">Used by {material.consumedBy.join(', ')}</p>
            ) : (
              <p className="ui-meta">Produces {material.producedAs}</p>
            )}
            {onOpenFoundry ? (
              <button type="button" className="primary" onClick={() => onOpenFoundry('mastery')}>
                Open Foundry Mastery
              </button>
            ) : null}
          </>
        ) : null}
      </FullSheet>
    </>
  )
}

export function inventoryNavTarget(): TabId {
  return 'foundry'
}
