import { describe, expect, it } from 'vitest'
import {
  normalizeStorageNamespace,
  resolveDevToolsAvailable,
  scopedStorageKey,
} from './buildMode'

describe('build mode gates', () => {
  it('keeps developer tools out of production unless the build opts in', () => {
    expect(resolveDevToolsAvailable({ DEV: false })).toBe(false)
    expect(resolveDevToolsAvailable({ DEV: false, VITE_HIVEWORKS_DEVTOOLS: '0' })).toBe(false)
    expect(resolveDevToolsAvailable({ DEV: false, VITE_HIVEWORKS_DEVTOOLS: '1' })).toBe(true)
    expect(resolveDevToolsAvailable({ DEV: true })).toBe(true)
  })

  it('isolates developer storage with a stable safe suffix', () => {
    expect(normalizeStorageNamespace(' Dev Lab ')).toBe('dev-lab')
    expect(scopedStorageKey('cosmic-idle-save')).toBe('cosmic-idle-save')
    expect(scopedStorageKey('cosmic-idle-save', 'Dev Lab')).toBe('cosmic-idle-save:dev-lab')
    expect(scopedStorageKey('hiveworks-sim-history', 'dev/lab')).toBe(
      'hiveworks-sim-history:dev-lab',
    )
  })
})
