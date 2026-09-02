/** Bump when shipping UI that players must refresh to see (PWA cache). */
export const APP_BUILD = '2026-09-02b'

export interface SimulationBuildMeta {
  appBuild: string
  mode: string
  href?: string
}

/** Preview / PWA identity for copied simulation reports. No GitHub API. */
export function simulationBuildMeta(): SimulationBuildMeta {
  const meta: SimulationBuildMeta = {
    appBuild: APP_BUILD,
    mode: typeof import.meta !== 'undefined' ? String(import.meta.env?.MODE ?? 'unknown') : 'unknown',
  }
  if (typeof window !== 'undefined') {
    try {
      meta.href = window.location.href
    } catch {
      // ignore
    }
  }
  return meta
}
