import type {
  FoundryRecipeId,
  FurnaceChannelId,
  GameState,
  HiveResearchBranch,
  ProcessCorePriority,
  ProcessNetworkPreset,
  ProcessThenKind,
  ProcessWhenKind,
  YardArmId,
} from '../../game/types'
import { isSystemUnlocked } from '../../game/progression'
import { ACT1_CADENCE, PROCESS_MIN_REBUILDS } from '../../game/cadence'
import {
  CORE_PRIORITY_LABELS,
  NETWORK_PRESET_LABELS,
  PROCESS_ACCUMULATION,
  PROCESS_NODES,
  PROCESS_REVEAL_TIERS,
  canBuyProcessNode,
  firstAffordableProcessNode,
  hasProcess,
  processAccumulationStatus,
  processAvailable,
  processConfig,
  processEarned,
  processExtraPresetSlots,
  processNodeTier,
  processOnlineBlurb,
  processRevealAllows,
  processVisibleNodes,
} from '../../game/process'
import { FOUNDRY_RECIPES, foundryQueueCap } from '../../game/foundry'
import { hiveResearchQueueCap, hiveResearchStartableBranches, HIVE_RESEARCH_BRANCHES } from '../../game/hiveResearch'
import { FURNACE_CHANNELS, furnacePriority } from '../../game/furnace'
import { STATIONS } from '../../game/catalog'
import { WORKER_JOB_IDS, workerJobLabel } from '../../game/workers'
import { PROTOCOLS, protocolRank } from '../../game/protocols'
import { formatCompact } from '../../game/format'

interface ProcessTabProps {
  state: GameState
  onBack: () => void
  onBuy: (id: string) => void
  onConfig?: (config: GameState['process']['config']) => void
  guideTarget?: string | null
}

function nodeStatus(
  state: GameState,
  id: string,
): 'owned' | 'affordable' | 'locked' {
  if (hasProcess(state, id)) return 'owned'
  return canBuyProcessNode(state, id).ok ? 'affordable' : 'locked'
}

function NodeCard({
  state,
  nodeId,
  onBuy,
  onConfig,
  highlight,
}: {
  state: GameState
  nodeId: string
  onBuy: (id: string) => void
  onConfig?: (config: GameState['process']['config']) => void
  highlight?: boolean
}) {
  const node = PROCESS_NODES.find((n) => n.id === nodeId)
  if (!node) return null
  const owned = hasProcess(state, node.id)
  const check = canBuyProcessNode(state, node.id)
  const status = nodeStatus(state, node.id)
  const prior = node.requiresId ? PROCESS_NODES.find((n) => n.id === node.requiresId) : undefined
  return (
    <article
      className={`network-row process-node is-${status}${highlight ? ' is-guide' : ''}`}
      data-guide={highlight ? 'process-first-buy' : undefined}
    >
      <div className="network-row-main">
        <strong>{node.name}</strong>
        <span className="muted">
          {owned ? 'Purchased' : check.ok ? `${node.cost} Process · affordable` : `${node.cost} Process`}
        </span>
      </div>
      <p className="network-row-stats">{node.blurb}</p>
      {!owned && prior && !hasProcess(state, prior.id) ? (
        <p className="muted">Need {prior.name}</p>
      ) : null}
      <button
        type="button"
        className="primary"
        disabled={owned || !check.ok}
        onClick={() => onBuy(node.id)}
      >
        {owned ? 'Purchased' : check.ok ? 'Buy' : check.reason}
      </button>
      {owned && onConfig ? <NodeConfig state={state} nodeId={node.id} onConfig={onConfig} /> : null}
    </article>
  )
}

function NodeConfig({
  state,
  nodeId,
  onConfig,
}: {
  state: GameState
  nodeId: string
  onConfig: (config: GameState['process']['config']) => void
}) {
  const cfg = processConfig(state)
  const patch = (mutate: (next: GameState['process']['config']) => void) => {
    const next = structuredClone(cfg)
    mutate(next)
    onConfig(next)
  }

  if (nodeId === 'auto-shop') {
    return (
      <label className="process-config" data-guide="process-config">
        <input
          type="checkbox"
          checked={cfg.shop.autoBuy}
          onChange={(e) => patch((c) => { c.shop.autoBuy = e.target.checked })}
        />
        Auto-buy Attack / Defense / Economy
      </label>
    )
  }
  if (nodeId === 'spend-ratios') {
    const row = (key: 'attack' | 'defense' | 'economy', label: string) => (
      <label key={key} className="process-config">
        {label}
        <input
          type="number"
          min={0}
          value={cfg.shop.ratios[key]}
          onChange={(e) =>
            patch((c) => {
              c.shop.ratios[key] = Math.max(0, Number(e.target.value) || 0)
            })
          }
        />
      </label>
    )
    return (
      <div className="process-config-block" data-guide="process-config">
        {row('attack', 'Attack %')}
        {row('defense', 'Defense %')}
        {row('economy', 'Economy %')}
        <label className="process-config">
          Salvage reserve
          <input
            type="number"
            min={0}
            value={cfg.shop.salvageReserve}
            onChange={(e) =>
              patch((c) => {
                c.shop.salvageReserve = Math.max(0, Number(e.target.value) || 0)
              })
            }
          />
        </label>
      </div>
    )
  }
  if (nodeId === 'auto-salvage') {
    return (
      <label className="process-config" data-guide="process-config">
        <input
          type="checkbox"
          checked={cfg.core.enabled}
          onChange={(e) => patch((c) => { c.core.enabled = e.target.checked })}
        />
        Auto Upgrade on
      </label>
    )
  }
  if (nodeId === 'core-priority') {
    const options = (Object.keys(CORE_PRIORITY_LABELS) as ProcessCorePriority[]).filter(
      (id) => id !== 'value' || hasProcess(state, 'smart-core'),
    ).filter((id) => id !== 'custom' || hasProcess(state, 'core-ratios'))
    return (
      <label className="process-config" data-guide="process-config">
        Priority
        <select
          value={cfg.core.priority}
          onChange={(e) => patch((c) => { c.core.priority = e.target.value as ProcessCorePriority })}
        >
          {options.map((id) => (
            <option key={id} value={id}>
              {CORE_PRIORITY_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
    )
  }
  if (nodeId === 'core-ratios') {
    const row = (key: 'weapon' | 'shield' | 'utility', label: string) => (
      <label key={key} className="process-config">
        {label}
        <input
          type="number"
          min={0}
          value={cfg.core.ratios[key]}
          onChange={(e) =>
            patch((c) => {
              c.core.ratios[key] = Math.max(0, Number(e.target.value) || 0)
              c.core.priority = 'custom'
            })
          }
        />
      </label>
    )
    return (
      <div className="process-config-block" data-guide="process-config">
        {row('weapon', 'Weapon')}
        {row('shield', 'Shield')}
        {row('utility', 'Utility')}
      </div>
    )
  }
  if (nodeId === 'network-presets' || nodeId === 'network-balance') {
    return (
      <div className="process-config-block" data-guide="process-config">
        <label className="process-config">
          <input
            type="checkbox"
            checked={cfg.network.enabled}
            onChange={(e) => patch((c) => { c.network.enabled = e.target.checked })}
          />
          Auto Optimise on
        </label>
        <label className="process-config">
          Preset
          <select
            value={cfg.network.preset}
            onChange={(e) => patch((c) => { c.network.preset = e.target.value as ProcessNetworkPreset })}
          >
            {(Object.keys(NETWORK_PRESET_LABELS) as ProcessNetworkPreset[])
              .filter((id) => id !== 'custom' || hasProcess(state, 'network-ratios'))
              .map((id) => (
                <option key={id} value={id}>
                  {NETWORK_PRESET_LABELS[id]}
                </option>
              ))}
          </select>
        </label>
      </div>
    )
  }
  if (nodeId === 'network-ratios') {
    const jobs = STATIONS.filter((station) => WORKER_JOB_IDS.includes(station.id))
    return (
      <div className="process-config-block" data-guide="process-config">
        <p className="muted">Jobs</p>
        {jobs.map((job) => (
          <label key={job.id} className="process-config">
            {workerJobLabel(job.id, job.name)}
            <input
              type="number"
              min={0}
              value={cfg.network.ratios[job.id] ?? 0}
              onChange={(e) =>
                patch((c) => {
                  c.network.ratios[job.id] = Math.max(0, Number(e.target.value) || 0)
                  c.network.preset = 'custom'
                })
              }
            />
          </label>
        ))}
      </div>
    )
  }
  if (nodeId === 'foundry-repeat') {
    return (
      <label className="process-config">
        Repeat
        <select
          value={cfg.foundry.repeatRecipe ?? ''}
          onChange={(e) =>
            patch((c) => {
              c.foundry.repeatRecipe = (e.target.value || null) as FoundryRecipeId | null
            })
          }
        >
          <option value="">None</option>
          {FOUNDRY_RECIPES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
    )
  }
  if (nodeId === 'foundry-queue') {
    const cap = foundryQueueCap(state)
    const queue = [...cfg.foundry.queue]
    while (queue.length < cap) queue.push('' as FoundryRecipeId)
    return (
      <div className="process-config-block" data-guide="process-foundry-queue">
        <p className="muted">Production queue · {cap} slots</p>
        {queue.slice(0, cap).map((id, i) => (
          <label key={i} className="process-config">
            {i + 1}
            <select
              value={id}
              onChange={(e) =>
                patch((c) => {
                  const next = [...c.foundry.queue]
                  while (next.length < cap) next.push('' as FoundryRecipeId)
                  next[i] = e.target.value as FoundryRecipeId
                  c.foundry.queue = next.filter(Boolean) as FoundryRecipeId[]
                })
              }
            >
              <option value="">Empty</option>
              {FOUNDRY_RECIPES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    )
  }
  if (nodeId === 'foundry-prereqs') {
    return (
      <label className="process-config">
        Target
        <select
          value={cfg.foundry.targetRecipe ?? ''}
          onChange={(e) =>
            patch((c) => {
              c.foundry.targetRecipe = (e.target.value || null) as FoundryRecipeId | null
            })
          }
        >
          <option value="">None</option>
          {FOUNDRY_RECIPES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
    )
  }
  if (nodeId === 'foundry-priority' || nodeId === 'foundry-auto') {
    return (
      <div className="process-config-block">
        {nodeId === 'foundry-auto' ? (
          <label className="process-config">
            <input
              type="checkbox"
              checked={cfg.foundry.autoBuy}
              onChange={(e) => patch((c) => { c.foundry.autoBuy = e.target.checked })}
            />
            Auto Buy on
          </label>
        ) : null}
        <label className="process-config">
          Rank priority
          <select
            value={cfg.foundry.upgradePriority}
            onChange={(e) =>
              patch((c) => {
                c.foundry.upgradePriority = e.target.value as typeof c.foundry.upgradePriority
              })
            }
          >
            <option value="cheapest">Cheapest</option>
            <option value="speed">Speed</option>
            <option value="slots">Slots</option>
            <option value="output">Output</option>
          </select>
        </label>
      </div>
    )
  }
  if (nodeId === 'auto-relic' || nodeId === 'reliquary-keep' || nodeId === 'reliquary-quality' || nodeId === 'reliquary-merge') {
    return (
      <div className="process-config-block" data-guide="process-config">
        <label className="process-config">
          <input
            type="checkbox"
            checked={cfg.reliquary.autoEquip}
            onChange={(e) => patch((c) => { c.reliquary.autoEquip = e.target.checked })}
          />
          Auto Equip
        </label>
        {hasProcess(state, 'reliquary-keep') ? (
          <label className="process-config">
            Keep
            <select
              value={cfg.reliquary.keepMode}
              onChange={(e) =>
                patch((c) => {
                  c.reliquary.keepMode = e.target.value as typeof c.reliquary.keepMode
                })
              }
            >
              <option value="keep-all">Keep fitted</option>
              <option value="keep-best">Keep best</option>
              <option value="upgrade-only">Upgrade only</option>
            </select>
          </label>
        ) : null}
        {hasProcess(state, 'reliquary-quality') ? (
          <label className="process-config">
            Min score
            <input
              type="number"
              min={0}
              step={0.01}
              value={cfg.reliquary.minScore}
              onChange={(e) => patch((c) => { c.reliquary.minScore = Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        ) : null}
        {hasProcess(state, 'reliquary-merge') ? (
          <label className="process-config">
            <input
              type="checkbox"
              checked={cfg.reliquary.autoMerge}
              onChange={(e) => patch((c) => { c.reliquary.autoMerge = e.target.checked })}
            />
            Auto Merge Signal Cores
          </label>
        ) : null}
      </div>
    )
  }
  if (nodeId === 'auto-extract' || nodeId === 'sortie-relaunch') {
    return (
      <div className="process-config-block">
        <label className="process-config">
          <input
            type="checkbox"
            checked={cfg.sortie.autoExtract}
            onChange={(e) => patch((c) => { c.sortie.autoExtract = e.target.checked })}
          />
          Safe Hold
        </label>
        <label className="process-config">
          Hull %
          <input
            type="number"
            min={5}
            max={90}
            value={Math.round(cfg.sortie.extractHullPct * 100)}
            onChange={(e) =>
              patch((c) => {
                c.sortie.extractHullPct = Math.min(0.9, Math.max(0.05, (Number(e.target.value) || 35) / 100))
              })
            }
          />
        </label>
        {hasProcess(state, 'sortie-relaunch') ? (
          <label className="process-config">
            <input
              type="checkbox"
              checked={cfg.sortie.autoRelaunch}
              onChange={(e) => patch((c) => { c.sortie.autoRelaunch = e.target.checked })}
            />
            Auto relaunch
          </label>
        ) : null}
      </div>
    )
  }
  if (nodeId === 'protocol-repeat' || nodeId === 'protocol-presets') {
    return (
      <div className="process-config-block" data-guide="process-protocol-repeat">
        {hasProcess(state, 'protocol-repeat') ? (
          <label className="process-config">
            <input
              type="checkbox"
              checked={cfg.sortie.protocolRepeat}
              onChange={(e) => patch((c) => { c.sortie.protocolRepeat = e.target.checked })}
            />
            Auto restart Challenge
          </label>
        ) : null}
        {hasProcess(state, 'protocol-presets') || hasProcess(state, 'protocol-repeat') ? (
          <label className="process-config">
            Challenge
            <select
              value={cfg.sortie.protocolId ?? cfg.sortie.lastProtocolId ?? ''}
              onChange={(e) => patch((c) => { c.sortie.protocolId = e.target.value || null })}
            >
              <option value="">Last started</option>
              {PROTOCOLS.map((p) => (
                <option key={p.id} value={p.id} disabled={protocolRank(state, p.id) < 1}>
                  {p.name}
                  {protocolRank(state, p.id) < 1 ? ' · clear by hand first' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    )
  }
  if (nodeId === 'research-queue' || nodeId === 'research-priorities' || nodeId === 'research-focus') {
    const branches = hiveResearchStartableBranches(state)
    const cap = hiveResearchQueueCap(state)
    const queue = [...cfg.research.queue]
    while (queue.length < cap) queue.push('' as HiveResearchBranch)
    return (
      <div className="process-config-block" data-guide="process-research-queue">
        {hasProcess(state, 'research-focus') ? (
          <label className="process-config" data-guide="process-research-auto">
            <input
              type="checkbox"
              checked={cfg.research.autoResearch}
              onChange={(e) => patch((c) => { c.research.autoResearch = e.target.checked })}
            />
            Auto Research
          </label>
        ) : null}
        {hasProcess(state, 'research-queue') ? (
          <>
            <p className="muted">Focus queue · {cap} slots</p>
            {queue.slice(0, cap).map((id, i) => (
              <label key={i} className="process-config">
                {i + 1}
                <select
                  value={id}
                  onChange={(e) =>
                    patch((c) => {
                      const next = [...c.research.queue]
                      while (next.length < cap) next.push('' as HiveResearchBranch)
                      next[i] = e.target.value as HiveResearchBranch
                      c.research.queue = next.filter(Boolean) as HiveResearchBranch[]
                    })
                  }
                >
                  <option value="">Empty</option>
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {HIVE_RESEARCH_BRANCHES.find((d) => d.id === b)?.name ?? b}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </>
        ) : null}
        {hasProcess(state, 'research-priorities') ? (
          <label className="process-config">
            Priority order
            <input
              value={cfg.research.branchPriority.join(',')}
              onChange={(e) =>
                patch((c) => {
                  c.research.branchPriority = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter((id): id is HiveResearchBranch => branches.includes(id as HiveResearchBranch))
                })
              }
            />
          </label>
        ) : null}
      </div>
    )
  }
  if (
    nodeId === 'furnace-reserve' ||
    nodeId === 'furnace-auto' ||
    nodeId === 'auto-bank' ||
    nodeId === 'furnace-presets' ||
    nodeId === 'furnace-channels'
  ) {
    return (
      <div className="process-config-block">
        <label className="process-config">
          <input
            type="checkbox"
            checked={cfg.furnace.autoFeed}
            onChange={(e) => patch((c) => { c.furnace.autoFeed = e.target.checked })}
          />
          Auto feed
        </label>
        {hasProcess(state, 'furnace-auto') ? (
          <label className="process-config">
            <input
              type="checkbox"
              checked={cfg.furnace.manager}
              onChange={(e) => patch((c) => { c.furnace.manager = e.target.checked })}
            />
            Manager on
          </label>
        ) : null}
        {hasProcess(state, 'furnace-channels') ? (
          <label className="process-config">
            <input
              type="checkbox"
              checked={cfg.furnace.autoChannel}
              onChange={(e) => patch((c) => { c.furnace.autoChannel = e.target.checked })}
            />
            Auto Channel levels
          </label>
        ) : null}
        {hasProcess(state, 'furnace-reserve') ? (
          <label className="process-config">
            Reserve Heat
            <input
              type="number"
              min={0}
              value={cfg.furnace.reserveHeat}
              onChange={(e) => patch((c) => { c.furnace.reserveHeat = Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        ) : null}
        <p className="muted">Priority is starve order — first stays lit longest.</p>
        {furnacePriority(state).map((id, index) => {
          const name = FURNACE_CHANNELS.find((ch) => ch.id === id)?.name ?? id
          return (
            <p key={id} className="assign-row">
              <span className="muted">
                {index + 1}. {name}
              </span>
              <button
                type="button"
                disabled={index <= 0}
                onClick={() =>
                  patch((c) => {
                    const next = [...furnacePriority(state)]
                    const swap = next[index - 1]
                    next[index - 1] = next[index]!
                    next[index] = swap!
                    c.furnace.priority = next as FurnaceChannelId[]
                  })
                }
              >
                Priority up
              </button>
            </p>
          )
        })}
        <p className="muted">
          Reserve is the floor. Auto Channel may raise or drop levels, then recover when the tank is healthy.
        </p>
      </div>
    )
  }
  if (nodeId === 'yard-buy-max' || nodeId === 'yard-auto' || nodeId === 'yard-layouts') {
    const arms: YardArmId[] = ['damage', 'shield', 'salvage', 'network']
    return (
      <div className="process-config-block">
        {hasProcess(state, 'yard-auto') ? (
          <label className="process-config">
            <input
              type="checkbox"
              checked={cfg.yard.autoUpgrade}
              onChange={(e) => patch((c) => { c.yard.autoUpgrade = e.target.checked })}
            />
            Auto Arms
          </label>
        ) : null}
        <p className="muted">Buy Max spends Ingots on the arms you tick.</p>
        {arms.map((id) => (
          <label key={id} className="process-config">
            <input
              type="checkbox"
              checked={cfg.yard.selectedArms.includes(id)}
              onChange={(e) =>
                patch((c) => {
                  const next = new Set(c.yard.selectedArms)
                  if (e.target.checked) next.add(id)
                  else next.delete(id)
                  c.yard.selectedArms = arms.filter((arm) => next.has(arm))
                })
              }
            />
            {id}
          </label>
        ))}
        {hasProcess(state, 'yard-layouts') ? (
          <p className="muted">Extra layout slots from Accumulation: {processExtraPresetSlots(state)}</p>
        ) : null}
      </div>
    )
  }
  return null
}

const WHEN_OPTIONS: { id: ProcessWhenKind; label: string }[] = [
  { id: 'wave-gte', label: 'Wave ≥' },
  { id: 'wave-of-best', label: 'Wave % of Best' },
  { id: 'threat', label: 'Threat' },
  { id: 'queue-empty', label: 'Foundry queue empty' },
  { id: 'ash-gte', label: 'Ash ≥' },
  { id: 'hull-lte', label: 'Hull % ≤' },
  { id: 'research-idle', label: 'Research idle' },
]

const THEN_OPTIONS: { id: ProcessThenKind; label: string }[] = [
  { id: 'spend-profile', label: 'Spend profile' },
  { id: 'economy-target', label: 'Economy target' },
  { id: 'extract', label: 'Extract' },
  { id: 'furnace-push', label: 'Furnace push' },
  { id: 'repeat-recipe', label: 'Repeat recipe' },
  { id: 'research-next', label: 'Next Research' },
  { id: 'fab-tracked', label: 'Tracked fab' },
]

function ProfileDesk({
  state,
  onConfig,
}: {
  state: GameState
  onConfig: (config: GameState['process']['config']) => void
}) {
  const cfg = processConfig(state)
  const showProfiles = hasProcess(state, 'run-profiles')
  const showRules = hasProcess(state, 'rule-builder')
  if (!showProfiles && !showRules) return null
  const patch = (mutate: (next: GameState['process']['config']) => void) => {
    const next = structuredClone(cfg)
    mutate(next)
    onConfig(next)
  }
  const active = cfg.profiles.find((p) => p.id === cfg.activeProfileId) ?? cfg.profiles[0]
  return (
    <div className="process-config-block" data-guide="process-profiles">
      {showProfiles ? (
        <>
          <h3 className="foundry-heading">Run profile</h3>
          <p className="muted">Farm banks Economy and Extracts. Push dumps Economy near Best and lights Furnace.</p>
          <div className="assign-row">
            {cfg.profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={cfg.activeProfileId === profile.id ? 'sheet-tab active' : 'sheet-tab'}
                onClick={() => patch((c) => { c.activeProfileId = profile.id })}
              >
                {profile.name}
              </button>
            ))}
            <button type="button" className="sheet-tab" onClick={() => patch((c) => { c.activeProfileId = null })}>
              Off
            </button>
          </div>
        </>
      ) : null}
      {showRules && active ? (
        <>
          <h3 className="foundry-heading">WHEN / THEN</h3>
          {active.rules.map((rule, index) => (
            <article key={rule.id} className="network-row">
              <p className="combat-hud-kicker">WHEN</p>
              {rule.when.map((cond, ci) => (
                <div key={`${rule.id}-w-${ci}`} className="assign-row">
                  <select
                    value={cond.kind}
                    onChange={(e) =>
                      patch((c) => {
                        const p = c.profiles.find((row) => row.id === active.id)
                        if (!p?.rules[index]?.when[ci]) return
                        p.rules[index].when[ci].kind = e.target.value as ProcessWhenKind
                      })
                    }
                  >
                    {WHEN_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {cond.kind === 'threat' ? (
                    <select
                      value={cond.threat ?? 'SURVIVABILITY'}
                      onChange={(e) =>
                        patch((c) => {
                          const p = c.profiles.find((row) => row.id === active.id)
                          if (!p?.rules[index]?.when[ci]) return
                          p.rules[index].when[ci].threat = e.target.value as NonNullable<
                            typeof cond.threat
                          >
                        })
                      }
                    >
                      <option value="SURVIVABILITY">Survivability</option>
                      <option value="DAMAGE">Damage</option>
                      <option value="MIXED">Mixed</option>
                    </select>
                  ) : cond.kind === 'queue-empty' || cond.kind === 'research-idle' ? null : (
                    <input
                      type="number"
                      min={0}
                      value={cond.value ?? 0}
                      onChange={(e) =>
                        patch((c) => {
                          const p = c.profiles.find((row) => row.id === active.id)
                          if (!p?.rules[index]?.when[ci]) return
                          p.rules[index].when[ci].value = Number(e.target.value) || 0
                        })
                      }
                    />
                  )}
                </div>
              ))}
              <p className="combat-hud-kicker">THEN</p>
              <select
                value={rule.then.kind}
                onChange={(e) =>
                  patch((c) => {
                    const p = c.profiles.find((row) => row.id === active.id)
                    if (!p?.rules[index]) return
                    p.rules[index].then.kind = e.target.value as ProcessThenKind
                  })
                }
              >
                {THEN_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {rule.then.kind === 'economy-target' ? (
                <label className="process-config">
                  Economy %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rule.then.economyPct ?? 0}
                    onChange={(e) =>
                      patch((c) => {
                        const p = c.profiles.find((row) => row.id === active.id)
                        if (!p?.rules[index]) return
                        p.rules[index].then.economyPct = Number(e.target.value) || 0
                      })
                    }
                  />
                </label>
              ) : null}
              <label className="process-config">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) =>
                    patch((c) => {
                      const p = c.profiles.find((row) => row.id === active.id)
                      if (!p?.rules[index]) return
                      p.rules[index].enabled = e.target.checked
                    })
                  }
                />
                On
              </label>
            </article>
          ))}
        </>
      ) : null}
    </div>
  )
}

export function ProcessTab({
  state,
  onBack,
  onBuy,
  onConfig,
  guideTarget = null,
}: ProcessTabProps) {
  const open = isSystemUnlocked(state, 'process')
  const available = processAvailable(state)
  const earned = processEarned(state)
  const firstBuy = firstAffordableProcessNode(state)
  const visible = processVisibleNodes(state)
  const showAccount = (state.process?.purchased?.length ?? 0) >= 1

  return (
    <section className="panel screen-panel">
      <header className="panel-header">
        <p className="assign-row">
          <button type="button" onClick={onBack}>
            Systems
          </button>
        </p>
        <h2>Process</h2>
        <p>
          {open
            ? processOnlineBlurb(state)
            : `Reach Wave ${ACT1_CADENCE.process}, Rebuild ${PROCESS_MIN_REBUILDS} times, and finish a Research project.`}
        </p>
      </header>
      {!open ? (
        <p className="muted">
          Process Points bank from achievements until then. Automate only what you have already done by hand.
        </p>
      ) : (
        <>
          <div className="process-ledger">
            <p data-guide="process-available">
              <span className="muted">Process Available</span>
              <strong>{formatCompact(available, 1)}</strong>
            </p>
            <p data-guide="process-earned">
              <span className="muted">Process Earned</span>
              <strong>{formatCompact(earned, 1)}</strong>
            </p>
          </div>
          <div className="panel-scroll">
            <p className="muted" data-guide="process-automation">
              Quality of life first, then simple actions. Deeper priorities open after you buy something.
            </p>
            {onConfig ? <ProfileDesk state={state} onConfig={onConfig} /> : null}
            {PROCESS_REVEAL_TIERS.filter((tier) => processRevealAllows(state, tier.id)).map((tier) => {
              const nodes = visible.filter((node) => processNodeTier(node) === tier.id)
              if (nodes.length === 0) return null
              return (
                <div key={tier.id}>
                  <h3 className="foundry-heading">{tier.name}</h3>
                  {nodes.map((node) => (
                    <NodeCard
                      key={node.id}
                      state={state}
                      nodeId={node.id}
                      onBuy={onBuy}
                      onConfig={onConfig}
                      highlight={guideTarget === 'process-first-buy' && firstBuy?.id === node.id}
                    />
                  ))}
                </div>
              )
            })}
            {showAccount ? (
              <>
                <h3 className="foundry-heading">Account</h3>
                <p className="muted" data-guide="process-accumulation">
                  Lifetime Process Earned. Spending Available does not undo these.
                </p>
                {PROCESS_ACCUMULATION.map((row) => {
                  const status = processAccumulationStatus(earned, row)
                  return (
                    <article key={row.id} className={`network-row process-accum is-${status}`}>
                      <div className="network-row-main">
                        <strong>{row.name}</strong>
                        <span className="muted">
                          {status === 'achieved' ? 'Achieved' : status === 'next' ? 'Next' : 'Future'} · {row.atEarned}{' '}
                          Earned
                        </span>
                      </div>
                      <p className="network-row-stats">{row.blurb}</p>
                    </article>
                  )
                })}
              </>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
