import { APP_BUILD } from './buildMeta'

/** Unique query so Reload still fetches when APP_BUILD has not changed. */
export function nextReloadHref(href: string, now = Date.now()): string {
  const url = new URL(href)
  url.searchParams.set('v', APP_BUILD)
  url.searchParams.set('_', String(now))
  return url.toString()
}

export async function forceReloadApp(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    // Still reload even if cleanup fails.
  }
  window.location.replace(nextReloadHref(window.location.href))
}
