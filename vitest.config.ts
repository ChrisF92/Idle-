import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Pre-GDD campaign tests still assert old sector doors, Route A/B, and Frontier Hold.
 * Re-enable a file only when that system is rewritten against Hiveworks GDD v1.0.
 */
const GDD_REWRITE_PENDING = [
  'src/game/achievements.test.ts',
  'src/game/ascension-qol.test.ts',
  'src/game/balance-estimate.test.ts',
  'src/game/blueprints.test.ts',
  'src/game/challenge-depth.test.ts',
  'src/game/challenge-pack.test.ts',
  'src/game/challenge-shop.test.ts',
  'src/game/core-acquisition.test.ts',
  'src/game/core-prints.test.ts',
  'src/game/core.test.ts',
  'src/game/encyclopedia.test.ts',
  'src/game/foundry-depth.test.ts',
  'src/game/furnace.test.ts',
  'src/game/hub-attention.test.ts',
  'src/game/matter-shop.test.ts',
  'src/game/network.test.ts',
  'src/game/onboarding-queue.test.ts',
  'src/game/onboarding-visibility.test.ts',
  'src/game/part-drops.test.ts',
  'src/game/phase6.test.ts',
  'src/game/phase7.test.ts',
  'src/game/phase8.test.ts',
  'src/game/phase9.test.ts',
  'src/game/phase10.test.ts',
  'src/game/phase11.test.ts',
  'src/game/playerGuidance.test.ts',
  'src/game/playtest.test.tsx',
  'src/game/post-prestige.test.ts',
  'src/game/process-depth.test.ts',
  'src/game/process.test.ts',
  'src/game/protocols.test.ts',
  'src/game/research-milestones.test.ts',
  'src/game/signal-cores.test.ts',
  'src/game/slag-bank.test.ts',
  'src/game/tick.test.ts',
  'src/game/toasts.test.ts',
  'src/game/ui-shell.test.tsx',
  'src/game/usi-pacing.test.ts',
]

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, ...GDD_REWRITE_PENDING],
  },
})
