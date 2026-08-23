import { useState } from 'react'
import type { GameState, ResourceId } from '../game/types'
import { RESOURCE_LABELS } from '../game/state'
import { isResourceVisible, visibleResourceIds } from '../game/progression'
import { formatNumber } from '../game/format'
import { ConfirmModal, StatPair } from '../ui/primitives'

const WALLET_ORDER: ResourceId[] = [
  'scrap',
  'salvage',
  'prestigeMatter',
  'choirAsh',
  'heat',
  'alloys',
  'energy',
  'data',
  'essence',
  'aiPoints',
  'challengePoints',
]

export function walletResourceIds(state: GameState): ResourceId[] {
  const visible = new Set(visibleResourceIds(state))
  return WALLET_ORDER.filter(
    (id) => visible.has(id) || isResourceVisible(state, id) || (state.resources[id] ?? 0) > 0 || id === 'scrap',
  )
}

export function WalletButton({ state }: { state: GameState }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="wallet-btn" aria-label="Wallet" onClick={() => setOpen(true)}>
        ◈
      </button>
      <ConfirmModal open={open} title="Wallet" onClose={() => setOpen(false)} overlayId="wallet">
        <div className="wallet-list">
          {walletResourceIds(state).map((id) => (
            <StatPair
              key={id}
              label={RESOURCE_LABELS[id]}
              value={formatNumber(state.resources[id], state.meta.numberNotation)}
            />
          ))}
        </div>
      </ConfirmModal>
    </>
  )
}
